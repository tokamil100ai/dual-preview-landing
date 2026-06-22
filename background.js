const MOBILE_UA       = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const MOBILE_PLATFORM = '"iOS"';
const MOBILE_CH_UA    = '"Not_A Brand";v="8", "Mobile Safari";v="16"';

const devRuleId = new Map();
let nextRuleId = 1000;

chrome.runtime.onInstalled.addListener(clearAllDynamicRules);
chrome.runtime.onStartup.addListener(clearAllDynamicRules);
clearAllDynamicRules();

async function clearAllDynamicRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (rules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) });
    }
  } catch (e) {}
  devRuleId.clear();
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app/index.html') });
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
    // Register a DNR rule per-hostname so the iframe request gets iPhone UA.
    // ||hostname matches the domain AND all its subdomains (www., m., etc.)
    // so a single rule covers trojmiasto.pl → www.trojmiasto.pl → m.trojmiasto.pl.
    let hostname = '';
    try {
      hostname = new URL(msg.url).hostname.replace(/^www\./, '');
    } catch (e) {}

    let ruleId = devRuleId.get(msg.devId);
    if (!ruleId) { ruleId = nextRuleId++; devRuleId.set(msg.devId, ruleId); }

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 2,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: MOBILE_UA },
          ],
        },
        condition: {
          urlFilter: '||' + hostname,
          resourceTypes: ['main_frame', 'sub_frame'],
        },
      }],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DB] DNR register FAILED:', chrome.runtime.lastError.message);
      } else {
        chrome.declarativeNetRequest.getDynamicRules(rules => {
          console.log('[DB] active rules:', rules.map(r => ({ id: r.id, urlf: r.condition?.urlFilter })));
        });
      }
      sendResponse({ ok: true });
    });
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
