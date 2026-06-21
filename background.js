const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const MOBILE_PLATFORM = '"iOS"';

// One DNR rule per mobile panel. Scoped to a unique URL token via urlFilter, so the
// SAME domain can get a mobile UA in one iframe and the real desktop UA in another —
// requestDomains can't distinguish two iframes, but a unique token in the URL can.
const panelRuleId = new Map(); // panelId -> numeric rule id
let nextRuleId = 1000;

chrome.runtime.onInstalled.addListener(clearAllDynamicRules);
chrome.runtime.onStartup.addListener(clearAllDynamicRules);
clearAllDynamicRules();

async function clearAllDynamicRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (rules.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) });
  } catch (e) {}
  panelRuleId.clear();
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app/index.html') });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'mobile-ua') {
    // Set / replace the mobile-UA rule for this panel, matching the given token.
    let id = panelRuleId.get(msg.panelId);
    if (!id) { id = nextRuleId++; panelRuleId.set(msg.panelId, id); }
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [id],
      addRules: [{
        id,
        priority: 2,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: MOBILE_UA },
            { header: 'Sec-Ch-Ua-Platform', operation: 'set', value: MOBILE_PLATFORM },
          ],
        },
        condition: {
          urlFilter: msg.token,
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: ['main_frame', 'sub_frame'],
        },
      }],
    }, () => sendResponse({ ok: true }));
    return true; // async
  }
});
