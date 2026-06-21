// ── Presets ───────────────────────────────────────────────────────────────────

const MOBILE_PRESETS = [
  { label: 'iPhone X / 11 / 12 / 13', w: 375, h: 812 },
  { label: 'iPhone 14',         w: 390, h: 844 },
  { label: 'iPhone 14 Pro Max', w: 430, h: 932 },
  { label: 'Pixel 7',           w: 412, h: 915 },
  { label: 'Samsung S23',       w: 360, h: 780 },
  { label: 'iPad Mini',         w: 768, h: 1024 },
];
const DESKTOP_PRESETS = [
  { label: '1280px', w: 1280, h: 900 },
  { label: '1440px', w: 1440, h: 900 },
  { label: '1920px', w: 1920, h: 900 },
];

// ── State ─────────────────────────────────────────────────────────────────────

let _pid = 0, _tid = 0;
let _suppressHistory = false;

function makeTab(url = '') {
  return { id: 't' + (++_tid), url, history: url ? [url] : [], histIdx: 0, title: 'New Tab', favicon: null };
}

function makePanel(type = 'mobile') {
  const preset = type === 'mobile' ? MOBILE_PRESETS[0] : DESKTOP_PRESETS[1];
  const tab = makeTab();
  return { id: 'p' + (++_pid), type, viewport: { w: preset.w, h: preset.h }, tabs: [tab], activeTabId: tab.id };
}

const state = {
  panels: [makePanel('mobile'), makePanel('desktop')],
  sync: false,
};

function getPanel(id) { return state.panels.find(p => p.id === id); }
function getActiveTab(panel) { return panel.tabs.find(t => t.id === panel.activeTabId); }

function normalizeUrl(input) {
  const s = input.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+/.test(s)) return 'https://' + s;
  return 'https://www.google.com/search?q=' + encodeURIComponent(s);
}

function faviconUrl(pageUrl) {
  try { return 'https://www.google.com/s2/favicons?sz=32&domain_url=' + encodeURIComponent(new URL(pageUrl).origin); }
  catch { return null; }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveState() {
  try { localStorage.setItem('dbs3', JSON.stringify({ panels: state.panels, sync: state.sync, _pid, _tid })); } catch(e) {}
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem('dbs3') || 'null');
    if (!d || !Array.isArray(d.panels) || d.panels.length === 0) return;
    // validate each panel has required fields
    const valid = d.panels.every(p => p.id && p.type && p.viewport && Array.isArray(p.tabs) && p.tabs.length > 0);
    if (!valid) { localStorage.removeItem('dbs3'); return; }
    state.panels = d.panels;
    state.sync = d.sync || false;
    _pid = d._pid || 0;
    _tid = d._tid || 0;
  } catch(e) {
    localStorage.removeItem('dbs3'); // clear corrupted state
  }
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const panelsWrap = document.getElementById('panels-wrap');
const syncToggle = document.getElementById('sync-toggle');

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  panelsWrap.innerHTML = '';
  state.panels.forEach((panel, idx) => {
    if (idx > 0) panelsWrap.appendChild(makeDivider(idx));
    panelsWrap.appendChild(makePanelEl(panel));
  });
  syncToggle.checked = state.sync;
  updatePresetBtns();
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function makePanelEl(panel) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.dataset.panelId = panel.id;

  // panel width = viewport width + padding on both sides (no wasted gray space)
  const PAD = 24;
  el.style.flex = `0 0 ${panel.viewport.w + PAD * 2}px`;

  const win = document.createElement('div');
  win.className = 'browser-win';
  win.style.width = panel.viewport.w + 'px';
  win.appendChild(makeTabStrip(panel));
  win.appendChild(makeUrlbar(panel));
  win.appendChild(makeIframe(panel));
  el.appendChild(win);

  return el;
}

// ── Tab strip ─────────────────────────────────────────────────────────────────

function makeTabStrip(panel) {
  const strip = document.createElement('div');
  strip.className = 'tab-strip';

  // drag handle
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '⠿';
  strip.appendChild(handle);

  // tabs area
  const tabsArea = document.createElement('div');
  tabsArea.className = 'tabs-area';
  panel.tabs.forEach(tab => tabsArea.appendChild(makeTabEl(panel, tab)));

  // new tab btn
  const newBtn = document.createElement('button');
  newBtn.className = 'tab-new';
  newBtn.textContent = '+';
  newBtn.title = 'Nowa zakładka (Cmd+T)';
  newBtn.onclick = () => addTab(panel.id);
  tabsArea.appendChild(newBtn);
  strip.appendChild(tabsArea);

  // right side
  const right = document.createElement('div');
  right.className = 'tab-strip-right';

  // viewport chip
  const vpChip = makeVpChip(panel);
  right.appendChild(vpChip);

  // mute icon (decorative)
  const muteBtn = document.createElement('button');
  muteBtn.className = 'strip-icon-btn';
  muteBtn.title = 'Wycisz';
  muteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>`;
  right.appendChild(muteBtn);

  // panel menu btn
  const menuBtn = document.createElement('button');
  menuBtn.className = 'strip-icon-btn';
  menuBtn.title = 'Opcje panelu';
  menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
  menuBtn.onclick = (e) => { e.stopPropagation(); openPanelMenu(panel.id, menuBtn); };
  right.appendChild(menuBtn);

  strip.appendChild(right);
  return strip;
}

function makeTabEl(panel, tab) {
  const el = document.createElement('button');
  el.className = 'tab' + (tab.id === panel.activeTabId ? ' active' : '');
  el.dataset.tabId = tab.id;
  el.title = tab.url || 'New Tab';

  if (tab.favicon) {
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = tab.favicon;
    img.width = 14; img.height = 14;
    img.onerror = () => img.remove();
    el.appendChild(img);
  }

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New Tab';
  el.appendChild(title);

  const close = document.createElement('span');
  close.className = 'tab-close';
  close.textContent = '×';
  close.onclick = (e) => { e.stopPropagation(); closeTab(panel.id, tab.id); };
  el.appendChild(close);

  el.onclick = () => switchTab(panel.id, tab.id);
  return el;
}

function makeVpChip(panel) {
  const chip = document.createElement('div');
  chip.className = 'vp-chip';
  chip.textContent = panel.viewport.w + ' × ' + panel.viewport.h;

  const dropdown = document.createElement('div');
  dropdown.className = 'vp-dropdown';

  const presets = panel.type === 'mobile' ? MOBILE_PRESETS : DESKTOP_PRESETS;
  presets.forEach(p => {
    const opt = document.createElement('div');
    opt.className = 'vp-option' + (p.w === panel.viewport.w ? ' active' : '');
    opt.textContent = p.label + ' — ' + p.w + ' × ' + p.h;
    opt.onclick = (e) => {
      e.stopPropagation();
      setViewport(panel.id, p.w, p.h);
      dropdown.classList.remove('open');
    };
    dropdown.appendChild(opt);
  });
  const customOpt = document.createElement('div');
  customOpt.className = 'vp-option';
  customOpt.textContent = 'Custom…';
  customOpt.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.remove('open');
    promptCustomViewport(panel.id);
  };
  dropdown.appendChild(customOpt);
  chip.appendChild(dropdown);

  chip.onclick = (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.vp-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) dropdown.classList.add('open');
  };

  return chip;
}

// ── URL bar ───────────────────────────────────────────────────────────────────

function makeUrlbar(panel) {
  const tab = getActiveTab(panel);
  const bar = document.createElement('div');
  bar.className = 'urlbar';

  const back = navBtn(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`, 'Wstecz');
  back.disabled = !tab || tab.histIdx <= 0;
  back.onclick = () => navBack(panel.id);

  const fwd = navBtn(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`, 'Naprzód');
  fwd.disabled = !tab || tab.histIdx >= tab.history.length - 1;
  fwd.onclick = () => navForward(panel.id);

  const reload = navBtn(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`, 'Odśwież');
  reload.onclick = () => reloadPanel(panel.id);

  bar.appendChild(back);
  bar.appendChild(fwd);
  bar.appendChild(reload);

  const input = document.createElement('input');
  input.className = 'url-input';
  input.type = 'text';
  input.value = tab ? tab.url : '';
  input.placeholder = 'Wpisz adres lub wyszukaj…';
  input.spellcheck = false;
  input.onkeydown = (e) => { if (e.key === 'Enter') navigate(panel.id, input.value); };
  input.onfocus = () => input.select();
  bar.appendChild(input);

  const openBtn = document.createElement('button');
  openBtn.className = 'open-btn';
  openBtn.title = 'Otwórz w nowej karcie';
  openBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  openBtn.onclick = () => { if (tab?.url) window.open(tab.url, '_blank'); };
  bar.appendChild(openBtn);

  return bar;
}

function navBtn(svg, title) {
  const btn = document.createElement('button');
  btn.className = 'nav-btn';
  btn.title = title;
  btn.innerHTML = svg;
  return btn;
}

// ── Iframe ────────────────────────────────────────────────────────────────────

function makeIframe(panel) {
  const tab = getActiveTab(panel);
  const iframe = document.createElement('iframe');
  iframe.id = 'ifr-' + panel.id + '-' + tab.id;
  // name encodes device type + viewport so content.js (MAIN world) can emulate.
  // window.name persists across in-frame navigation, even cross-origin.
  iframe.name = `db|${panel.type}|${panel.viewport.w}|${panel.viewport.h}`;
  iframe.style.width = panel.viewport.w + 'px';
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads';
  iframe.onload = () => {
    try {
      const title = iframe.contentDocument?.title;
      if (title) {
        const p = getPanel(panel.id); const t = p?.tabs.find(t => t.id === tab.id);
        if (t && title !== t.title) { t.title = title; if (t.id === p.activeTabId) refreshTabStrip(panel.id); }
      }
    } catch(e) {}
  };
  if (tab.url) loadIntoIframe(panel, iframe, tab.url);
  return iframe;
}

// Loads a URL into an iframe. For mobile panels, first registers a per-iframe
// mobile-UA DNR rule scoped to a unique token, then loads the URL carrying that
// token — so the server returns the real mobile site (e.g. i.pl), independently
// of what the desktop panel does with the same domain.
function loadIntoIframe(panel, iframe, url) {
  _suppressHistory = true;
  if (panel.type !== 'mobile') { iframe.src = url; return; }
  const token = 'dbm' + Math.random().toString(36).slice(2, 11);
  let finalUrl;
  try { const u = new URL(url); u.searchParams.set(token, '1'); finalUrl = u.toString(); }
  catch (e) { finalUrl = url; }
  chrome.runtime.sendMessage({ type: 'mobile-ua', panelId: panel.id, token }, () => {
    _suppressHistory = true;
    iframe.src = finalUrl;
  });
}

// ── Divider ───────────────────────────────────────────────────────────────────

function makeDivider(afterIdx) {
  const div = document.createElement('div');
  div.className = 'divider';
  let startX, startWidths;
  div.addEventListener('mousedown', e => {
    e.preventDefault();
    div.classList.add('dragging');
    startX = e.clientX;
    startWidths = [...panelsWrap.querySelectorAll('.panel')].map(p => p.getBoundingClientRect().width);
    const onMove = e => {
      const dx = e.clientX - startX;
      const li = afterIdx - 1, ri = afterIdx;
      const panels = [...panelsWrap.querySelectorAll('.panel')];
      const total = startWidths[li] + startWidths[ri];
      const newL = Math.max(280, Math.min(total - 280, startWidths[li] + dx));
      panels[li].style.flex = 'none'; panels[li].style.width = newL + 'px';
      panels[ri].style.flex = 'none'; panels[ri].style.width = (total - newL) + 'px';
    };
    const onUp = () => { div.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  div.addEventListener('dblclick', () => {
    panelsWrap.querySelectorAll('.panel').forEach(p => { p.style.flex = '1'; p.style.width = ''; });
  });
  return div;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(panelId, rawUrl, push = true) {
  const url = normalizeUrl(rawUrl);
  if (!url) return;
  const panel = getPanel(panelId);
  const tab = getActiveTab(panel);
  tab.url = url;
  if (push) { tab.history = tab.history.slice(0, tab.histIdx + 1); tab.history.push(url); tab.histIdx = tab.history.length - 1; }
  if (!tab.favicon) tab.favicon = faviconUrl(url);
  refreshUrlbar(panelId);
  refreshTabStrip(panelId);
  saveState();
  if (state.sync) state.panels.forEach(p => { if (p.id !== panelId) navigate(p.id, url, true); });

  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  if (!iframe) return;
  loadIntoIframe(panel, iframe, url);
}

function navBack(panelId) {
  const panel = getPanel(panelId); const tab = getActiveTab(panel);
  if (tab.histIdx <= 0) return;
  tab.histIdx--; tab.url = tab.history[tab.histIdx];
  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  if (iframe) loadIntoIframe(panel, iframe, tab.url);
  refreshUrlbar(panelId); saveState();
}

function navForward(panelId) {
  const panel = getPanel(panelId); const tab = getActiveTab(panel);
  if (tab.histIdx >= tab.history.length - 1) return;
  tab.histIdx++; tab.url = tab.history[tab.histIdx];
  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  if (iframe) loadIntoIframe(panel, iframe, tab.url);
  refreshUrlbar(panelId); saveState();
}

function reloadPanel(panelId) {
  const panel = getPanel(panelId); const tab = getActiveTab(panel);
  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  if (iframe && tab.url) loadIntoIframe(panel, iframe, tab.url);
}

// Messages from content.js (MAIN world) in each iframe.
window.addEventListener('message', e => {
  const data = e.data;
  if (!data || (data.type !== 'iframe-navigated' && data.type !== 'mobile-reload-needed' && data.type !== 'navigate-request')) return;
  const iframe = [...document.querySelectorAll('iframe')].find(f => f.contentWindow === e.source);
  if (!iframe) return;
  const parts = iframe.id.split('-');
  const panelId = parts[1], tabId = parts[2];
  const panel = getPanel(panelId); if (!panel) return;
  const tab = panel.tabs.find(t => t.id === tabId); if (!tab) return;
  const url = data.url;
  if (!url || url === 'about:blank') return;

  if (data.type === 'navigate-request') {
    // Intercepted link click inside a mobile frame — load directly with a token
    // so the first request is already mobile (no desktop flash, no reload).
    navigate(panelId, url);
    return;
  }

  if (data.type === 'mobile-reload-needed') {
    // Real user navigation inside a mobile frame that was served as desktop.
    // Record it in history, then reload WITH a token so the server returns mobile.
    if (url !== tab.url) {
      tab.history = tab.history.slice(0, tab.histIdx + 1);
      tab.history.push(url);
      tab.histIdx = tab.history.length - 1;
    }
    tab.url = url;
    if (!tab.favicon) tab.favicon = faviconUrl(url);
    if (tab.id === panel.activeTabId) { refreshUrlbar(panelId); refreshTabStrip(panelId); saveState(); }
    loadIntoIframe(panel, iframe, url); // adds fresh token + mobile-UA rule, reloads
    return;
  }

  // iframe-navigated: desktop frames, or the final tokened mobile load.
  if (!_suppressHistory && url !== tab.url) {
    tab.history = tab.history.slice(0, tab.histIdx + 1);
    tab.history.push(url);
    tab.histIdx = tab.history.length - 1;
  }
  _suppressHistory = false;
  tab.url = url;
  if (!tab.favicon) tab.favicon = faviconUrl(url);
  if (tab.id === panel.activeTabId) { refreshUrlbar(panelId); refreshTabStrip(panelId); saveState(); }
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

function addTab(panelId, url = '') {
  const panel = getPanel(panelId);
  const tab = makeTab(url);
  if (url) tab.favicon = faviconUrl(url);
  panel.tabs.push(tab);
  panel.activeTabId = tab.id;
  refreshPanel(panelId);
  saveState();
}

function switchTab(panelId, tabId) {
  const panel = getPanel(panelId);
  if (panel.activeTabId === tabId) return;
  panel.activeTabId = tabId;
  refreshPanel(panelId);
}

function closeTab(panelId, tabId) {
  const panel = getPanel(panelId);
  if (panel.tabs.length === 1) { if (state.panels.length > 1) removePanel(panelId); return; }
  const idx = panel.tabs.findIndex(t => t.id === tabId);
  panel.tabs.splice(idx, 1);
  if (panel.activeTabId === tabId) panel.activeTabId = panel.tabs[Math.max(0, idx - 1)].id;
  refreshPanel(panelId);
  saveState();
}

// ── Panels ────────────────────────────────────────────────────────────────────

function addPanel(type) { state.panels.push(makePanel(type)); render(); saveState(); }

function removePanel(panelId) {
  if (state.panels.length <= 1) return;
  state.panels = state.panels.filter(p => p.id !== panelId);
  render(); saveState();
}

function duplicatePanel(panelId) {
  const panel = getPanel(panelId); const srcTab = getActiveTab(panel);
  const np = makePanel(panel.type);
  np.viewport = { ...panel.viewport };
  if (srcTab.url) { Object.assign(np.tabs[0], { url: srcTab.url, title: srcTab.title, favicon: srcTab.favicon, history: [...srcTab.history], histIdx: srcTab.histIdx }); }
  state.panels.splice(state.panels.findIndex(p => p.id === panelId) + 1, 0, np);
  render(); saveState();
}

function switchPanelType(panelId) {
  const panel = getPanel(panelId);
  panel.type = panel.type === 'mobile' ? 'desktop' : 'mobile';
  panel.viewport = panel.type === 'mobile' ? { w: MOBILE_PRESETS[0].w, h: MOBILE_PRESETS[0].h } : { w: DESKTOP_PRESETS[1].w, h: DESKTOP_PRESETS[1].h };
  refreshPanel(panelId); saveState();
}

// ── Viewport ──────────────────────────────────────────────────────────────────

function setViewport(panelId, w, h) {
  const panel = getPanel(panelId);
  panel.viewport = { w, h };
  const tab = getActiveTab(panel);
  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  if (iframe) { iframe.style.width = w + 'px'; }
  const win = panelsWrap.querySelector(`[data-panel-id="${panelId}"] .browser-win`);
  if (win) win.style.width = w + 'px';
  refreshTabStrip(panelId);
  saveState();
}

function promptCustomViewport(panelId) {
  const panel = getPanel(panelId);
  const w = prompt('Szerokość (px):', panel.viewport.w);
  if (!w) return;
  const h = prompt('Wysokość (px):', panel.viewport.h);
  if (!h) return;
  setViewport(panelId, parseInt(w) || 375, parseInt(h) || 812);
}

// ── Partial re-renders ────────────────────────────────────────────────────────

function refreshPanel(panelId) {
  const panel = getPanel(panelId);
  const el = panelsWrap.querySelector(`[data-panel-id="${panelId}"]`);
  if (!el) { render(); return; }
  refreshTabStrip(panelId);
  refreshUrlbar(panelId);
  const oldIframe = el.querySelector('iframe');
  const newIframe = makeIframe(panel); // makeIframe loads tab.url itself (with mobile token)
  oldIframe.replaceWith(newIframe);
}

function refreshTabStrip(panelId) {
  const panel = getPanel(panelId);
  const win = panelsWrap.querySelector(`[data-panel-id="${panelId}"] .browser-win`);
  if (!win) { render(); return; }
  win.querySelector('.tab-strip').replaceWith(makeTabStrip(panel));
}

function refreshUrlbar(panelId) {
  const panel = getPanel(panelId);
  const win = panelsWrap.querySelector(`[data-panel-id="${panelId}"] .browser-win`);
  if (!win) return;
  win.querySelector('.urlbar').replaceWith(makeUrlbar(panel));
}

// ── Panel menu ────────────────────────────────────────────────────────────────

let activeDropdown = null;

function closeAllDropdowns() {
  if (activeDropdown) { activeDropdown.remove(); activeDropdown = null; }
  document.getElementById('add-dropdown').style.display = 'none';
  document.querySelectorAll('.vp-dropdown.open').forEach(d => d.classList.remove('open'));
}

function openPanelMenu(panelId, anchor) {
  closeAllDropdowns();
  const panel = getPanel(panelId);
  const tab = getActiveTab(panel);
  const menu = document.createElement('div');
  menu.className = 'dropdown';
  activeDropdown = menu;

  const items = [
    { icon: svgClose(), label: 'Close',                       danger: true, fn: () => removePanel(panelId) },
    { icon: svgDup(),   label: 'Duplicate',                                 fn: () => duplicatePanel(panelId) },
    null,
    { icon: svgQr(),    label: 'Create QR code for this URL',               fn: () => showQR(tab?.url) },
    { icon: svgSwitch(),label: panel.type === 'mobile' ? 'Switch to desktop' : 'Switch to mobile', fn: () => switchPanelType(panelId) },
    { icon: svgCam(),   label: 'Screenshot',                                fn: () => alert('Użyj Cmd+Shift+4') },
    { icon: svgSpeed(), label: 'Open in PageSpeed Insights',                fn: () => tab?.url && window.open('https://pagespeed.web.dev/report?url=' + encodeURIComponent(tab.url), '_blank') },
    { icon: svgTrash(), label: 'Clear cookies and local storage',           fn: () => clearStorage(panelId) },
  ];

  items.forEach(item => {
    if (!item) { const s = document.createElement('div'); s.className = 'dropdown-sep'; menu.appendChild(s); return; }
    const el = document.createElement('div');
    el.className = 'dropdown-item' + (item.danger ? ' danger' : '');
    el.innerHTML = item.icon;
    el.appendChild(Object.assign(document.createElement('span'), { textContent: item.label }));
    el.onclick = () => { closeAllDropdowns(); item.fn(); };
    menu.appendChild(el);
  });

  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - r.right) + 'px';
  menu.style.left = 'auto';
}

// ── QR ────────────────────────────────────────────────────────────────────────

function showQR(url) {
  if (!url) { alert('Brak URL.'); return; }
  document.getElementById('qr-url').textContent = url;
  drawQR(document.getElementById('qr-canvas'), url);
  document.getElementById('qr-modal').classList.add('open');
}
document.getElementById('qr-close').onclick = () => document.getElementById('qr-modal').classList.remove('open');
document.getElementById('qr-modal').onclick = e => { if (e.target.id === 'qr-modal') document.getElementById('qr-modal').classList.remove('open'); };

function drawQR(canvas, text) {
  const s = 200; canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#111'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Skanuj URL:', s/2, 80);
  const wrap = t => { const r = []; for (let i=0; i<t.length; i+=28) r.push(t.slice(i,i+28)); return r; };
  wrap(text).slice(0,4).forEach((l,i) => ctx.fillText(l, s/2, 100+i*15));
  ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeRect(3,3,s-6,s-6);
}

// ── Clear storage ─────────────────────────────────────────────────────────────

function clearStorage(panelId) {
  const panel = getPanel(panelId); const tab = getActiveTab(panel);
  const iframe = document.getElementById('ifr-' + panelId + '-' + tab.id);
  try { iframe?.contentWindow?.localStorage?.clear(); alert('localStorage wyczyszczony.'); }
  catch(e) { alert('Nie można wyczyścić – cross-origin.'); }
}

// ── Share ─────────────────────────────────────────────────────────────────────

document.getElementById('share-btn').onclick = () => {
  const p = new URLSearchParams();
  state.panels.forEach((panel, i) => { const t = getActiveTab(panel); p.set('p'+i+'u', t.url||''); p.set('p'+i+'t', panel.type); p.set('p'+i+'v', panel.viewport.w+'x'+panel.viewport.h); });
  navigator.clipboard.writeText(location.href.split('?')[0]+'?'+p).then(() => {
    const btn = document.getElementById('share-btn');
    const span = btn.querySelector('span') || btn;
    const orig = span.textContent; span.textContent = 'Skopiowano!';
    setTimeout(() => span.textContent = orig, 2000);
  });
};

function applyPermalink() {
  const p = new URLSearchParams(location.search);
  if (!p.has('p0u')) return;
  const panels = []; let i = 0;
  while (p.has('p'+i+'u')) {
    const type = p.get('p'+i+'t')||'mobile';
    const url = p.get('p'+i+'u')||'';
    const [w,h] = (p.get('p'+i+'v')||'375x812').split('x').map(Number);
    const panel = makePanel(type);
    panel.viewport = { w:w||375, h:h||812 };
    if (url) { const t=panel.tabs[0]; t.url=url; t.history=[url]; t.favicon=faviconUrl(url); }
    panels.push(panel); i++;
  }
  if (panels.length) state.panels = panels;
}

// ── Layout presets ────────────────────────────────────────────────────────────

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.onclick = () => {
    const urls = state.panels.map(p => getActiveTab(p)?.url||'');
    const map = { 'mobile-desktop':['mobile','desktop'], 'mobile-mobile':['mobile','mobile'], 'desktop-desktop':['desktop','desktop'] };
    const types = map[btn.dataset.preset]; if (!types) return;
    state.panels = types.map(makePanel);
    state.panels.forEach((p,i) => { if (urls[i]) { const t=getActiveTab(p); t.url=urls[i]; t.history=[urls[i]]; t.favicon=faviconUrl(urls[i]); } });
    render(); saveState();
  };
});

function updatePresetBtns() {
  const types = state.panels.map(p => p.type).join('-');
  const n = state.panels.length;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    const m = btn.dataset.preset;
    const active =
      (m==='mobile-desktop' && types==='mobile-desktop' && n===2) ||
      (m==='mobile-mobile' && state.panels.every(p=>p.type==='mobile') && n===2) ||
      (m==='desktop-desktop' && state.panels.every(p=>p.type==='desktop') && n===2);
    btn.classList.toggle('active', active);
  });
}

// ── Add panel ─────────────────────────────────────────────────────────────────

document.getElementById('add-panel-btn').onclick = e => {
  e.stopPropagation();
  const dd = document.getElementById('add-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};
document.querySelectorAll('[data-add]').forEach(el => {
  el.onclick = () => { addPanel(el.dataset.add); closeAllDropdowns(); };
});

// ── Sync ─────────────────────────────────────────────────────────────────────

syncToggle.onchange = () => { state.sync = syncToggle.checked; saveState(); };

// ── Screenshot ────────────────────────────────────────────────────────────────

document.getElementById('screenshot-all-btn').onclick = () => alert('Użyj Cmd+Shift+4 żeby zaznaczyć obszar.');

// ── Theme ─────────────────────────────────────────────────────────────────────

document.getElementById('theme-btn').onclick = () => document.body.classList.toggle('dark');

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

let lastPanel = null;
panelsWrap.addEventListener('click', e => { const p = e.target.closest('.panel'); if (p) lastPanel = p.dataset.panelId; }, true);

document.addEventListener('keydown', e => {
  if (!e.metaKey && !e.ctrlKey) return;
  const pid = lastPanel || state.panels[0]?.id;
  if (!pid) return;
  if (e.key==='l') { e.preventDefault(); panelsWrap.querySelector(`[data-panel-id="${pid}"] .url-input`)?.focus(); }
  if (e.key==='t') { e.preventDefault(); addTab(pid); }
  if (e.key==='w') { e.preventDefault(); const p=getPanel(pid); if(p) closeTab(pid, p.activeTabId); }
  if (e.key==='r') { e.preventDefault(); reloadPanel(pid); }
  if (e.key==='[') { e.preventDefault(); navBack(pid); }
  if (e.key===']') { e.preventDefault(); navForward(pid); }
});

// ── Outside click ─────────────────────────────────────────────────────────────

document.addEventListener('click', e => {
  if (activeDropdown && !activeDropdown.contains(e.target)) closeAllDropdowns();
  const dd = document.getElementById('add-dropdown');
  if (!document.getElementById('add-panel-btn').contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
  if (!e.target.closest('.vp-chip')) document.querySelectorAll('.vp-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ── Icons ─────────────────────────────────────────────────────────────────────

function svgClose()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }
function svgDup()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`; }
function svgQr()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="17" y="17" width="4" height="4"/></svg>`; }
function svgSwitch() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>`; }
function svgCam()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`; }
function svgSpeed()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`; }
function svgTrash()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`; }

// ── Boot ──────────────────────────────────────────────────────────────────────

// loadState(); — disabled: always start with default panels

applyPermalink();
render();
notifyMobileDomains();
