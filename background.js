const MOBILE_UA       = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const MOBILE_PLATFORM = '"iOS"';
const MOBILE_CH_UA    = '"Not_A Brand";v="8", "Mobile Safari";v="16"';
const REAL_UA         = navigator.userAgent;

// Rule ID 1: desktop UA override. Rule ID 2: no-cache for new tab home. Both permanent.
const DESKTOP_OVERRIDE_RULE_ID = 1;
const NO_CACHE_RULE_ID = 2;
const NEW_TAB_HOME_HOST = 'wtyczka-ramka-aktualizacji.vercel.app';
const devRuleId = new Map();
let nextRuleId = 1001;

async function initRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const toRemove = rules.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: toRemove,
      addRules: [
        {
          id: DESKTOP_OVERRIDE_RULE_ID,
          priority: 100,
          action: { type: 'modifyHeaders', requestHeaders: [{ header: 'User-Agent', operation: 'set', value: REAL_UA }] },
          condition: { urlFilter: '__dbid', resourceTypes: ['main_frame', 'sub_frame'] },
        },
        {
          id: NO_CACHE_RULE_ID,
          priority: 1,
          action: { type: 'modifyHeaders', responseHeaders: [
            { header: 'Cache-Control', operation: 'set', value: 'no-cache, no-store, must-revalidate' },
            { header: 'Pragma',        operation: 'set', value: 'no-cache' },
            { header: 'Expires',       operation: 'set', value: '0' },
          ]},
          condition: { requestDomains: [NEW_TAB_HOME_HOST], resourceTypes: ['main_frame', 'sub_frame', 'script', 'stylesheet', 'image', 'xmlhttprequest', 'other'] },
        },
      ],
    });
  } catch (e) { console.error('[DB] initRules failed:', e); }
  devRuleId.clear();
}

chrome.runtime.onInstalled.addListener(initRules);
chrome.runtime.onStartup.addListener(initRules);
initRules();

async function clearAllDynamicRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (rules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) });
    }
  } catch (e) {}
  devRuleId.clear();
}

chrome.action.onClicked.addListener((tab) => {
  const url = chrome.runtime.getURL('app/index.html');
  if (tab.incognito) {
    chrome.windows.create({ url, incognito: true });
  } else {
    chrome.tabs.create({ url, windowId: tab.windowId });
  }
});

// Cache: original url → resolved mobile url (5 min TTL).
const preflightCache = new Map();

// Fetch the URL with a real iPhone User-Agent and follow all HTTP redirects.
// Returns the final URL (e.g. trojmiasto.pl → m.trojmiasto.pl).
// This mirrors exactly what Chrome DevTools mobile emulation does at the
// network layer — the server reads the UA and does a 302 redirect.
async function resolveMobileUrl(url) {
  const cached = preflightCache.get(url);
  if (cached) return cached;

  let finalUrl = url;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8',
      },
      redirect: 'follow',
      credentials: 'omit',
      signal: AbortSignal.timeout(8000),
    });
    finalUrl = resp.url || url;
    // Discard body — we only needed the final URL from the redirect chain.
    resp.body?.cancel().catch(() => {});
  } catch (e) {
    console.warn('[DB] preflight failed for', url, '—', e.message);
  }

  // Strip any leftover params we may have added previously.
  try {
    const u = new URL(finalUrl);
    ['__dbid', '__dbt', '__dbw', '__dbh'].forEach(k => u.searchParams.delete(k));
    finalUrl = u.toString();
  } catch (e) {}

  console.log('[DB] preflight', url, '→', finalUrl);
  preflightCache.set(url, finalUrl);
  setTimeout(() => preflightCache.delete(url), 5 * 60 * 1000);
  return finalUrl;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

if (msg.type === 'set-panel-mute') {
    const tabId = sender.tab?.id;
    if (tabId) chrome.tabs.update(tabId, { muted: msg.muted });
    return false;
  }

  if (msg.type === 'db-mobile-ua') {
    // Preflight: fetch URL with iPhone UA to resolve mobile redirect destination.
    // Register DNR rule for the FINAL hostname (e.g. m.wp.pl) not the original
    // (wp.pl) — this way a desktop panel on wp.pl is unaffected by the rule.
    (async () => {
      const finalUrl = await resolveMobileUrl(msg.url);
      const redirected = (() => {
        try { return new URL(finalUrl).hostname !== new URL(msg.url).hostname; } catch(e) { return false; }
      })();

      let ruleId = devRuleId.get(msg.devId);
      if (!ruleId) { ruleId = nextRuleId++; devRuleId.set(msg.devId, ruleId); }

      // Always use hostname-based DNR for the final URL's hostname.
      // For redirected sites (e.g. trojmiasto.pl → m.trojmiasto.pl): final hostname is m.trojmiasto.pl.
      // For responsive sites (wp.pl stays wp.pl): hostname is wp.pl.
      const ruleHostname = new URL(finalUrl).hostname.replace(/^www\./, '');
      const condition = { urlFilter: '||' + ruleHostname, resourceTypes: ['main_frame', 'sub_frame'] };

      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId],
        addRules: [{ id: ruleId, priority: 2, action: { type: 'modifyHeaders', requestHeaders: [{ header: 'User-Agent', operation: 'set', value: MOBILE_UA }] }, condition }],
      }, () => {
        if (chrome.runtime.lastError) console.error('[DB] DNR FAILED:', chrome.runtime.lastError.message);
        sendResponse({ ok: true, url: finalUrl, redirected });
      });
    })();
    return true;
  }

  if (msg.type === 'db-clear-ua') {
    const ruleId = devRuleId.get(msg.devId);
    if (ruleId) {
      devRuleId.delete(msg.devId);
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] }, () => sendResponse({ ok: true }));
      return true;
    }
    sendResponse({ ok: true });
    return false;
  }
});
