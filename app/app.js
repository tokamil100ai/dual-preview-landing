// ── Presets ───────────────────────────────────────────────────────────────────

const NEW_TAB_HOME = 'https://kamil-lukasiewicz.lovable.app';

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
// Per-iframe suppress flag: key = 'panelId-tabId', value = true when WE
// initiated the load and don't want to push to history on db-loaded.
// Must be per-iframe (not global) — otherwise one panel clearing the flag
// prevents redirect-detection from firing in another panel.
const _suppressHistory = new Set();

function makeTab(url = '') {
  return { id: 't' + (++_tid), url, history: url ? [url] : [], histIdx: 0, title: 'New Tab', favicon: null };
}

function makePanel(type = 'mobile') {
  const preset = type === 'mobile' ? MOBILE_PRESETS[0] : DESKTOP_PRESETS[1];
  const tab = makeTab();
  // devId: this panel's private token. Goes into every iframe URL as __dbid and
  // is the match key for the panel's mobile-UA DNR rule. Stable for the panel's life.
  const devId = 'd' + Math.random().toString(36).slice(2, 11);
  return { id: 'p' + (++_pid), type, devId, viewport: { w: preset.w, h: preset.h }, tabs: [tab], activeTabId: tab.id, muted: false };
}

// Promise wrapper around chrome.runtime.sendMessage.
function sendBg(msg) {
  return new Promise(resolve => {
    try { chrome.runtime.sendMessage(msg, resolve); }
    catch (e) { resolve(undefined); }
  });
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

// ── Auto-scale ────────────────────────────────────────────────────────────────

function applyAutoScale() {
  panelsWrap.style.transform  = '';
  panelsWrap.style.height     = '';
  panelsWrap.style.marginLeft = '';

  const availW   = window.innerWidth;
  const availH   = window.innerHeight - (panelsWrap.offsetTop || 0);
  const naturalW = [...panelsWrap.children].reduce((s, el) => s + el.offsetWidth, 0);
  const naturalH = panelsWrap.scrollHeight;
  if (naturalW <= 0 || naturalH <= 0) return;

  const factor = Math.min(
    naturalW > availW ? availW / naturalW : 1,
    naturalH > availH ? availH / naturalH : 1,
  );
  if (factor >= 1) return;

  // Scale from top-left, then shift right to center the scaled result.
  const scaledW  = naturalW * factor;
  const marginL  = Math.max(0, (availW - scaledW) / 2);
  panelsWrap.style.transformOrigin = 'top left';
  panelsWrap.style.transform       = `scale(${factor})`;
  panelsWrap.style.marginLeft      = marginL + 'px';
  panelsWrap.style.height          = (naturalH * factor) + 'px';
}

window.addEventListener('resize', applyAutoScale);
new ResizeObserver(applyAutoScale).observe(panelsWrap);

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  panelsWrap.innerHTML = '';
  state.panels.forEach((panel, idx) => {
    if (idx > 0) panelsWrap.appendChild(makeDivider(idx));
    panelsWrap.appendChild(makePanelEl(panel));
  });
  syncToggle.checked = state.sync;
  updatePresetBtns();
  applyAutoScale();
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function makePanelEl(panel) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.dataset.panelId = panel.id;

  // panel width = viewport width + padding on both sides (no wasted gray space)
  const PAD = 12;
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

// ── Panel drag-to-reorder ─────────────────────────────────────────────────────

function initPanelDrag(panelId, handleEl) {
  handleEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const panelEl = panelsWrap.querySelector(`[data-panel-id="${panelId}"]`);
    if (!panelEl) return;

    const panelRect = panelEl.getBoundingClientRect();
    const offsetX = e.clientX - panelRect.left;

    // Ghost — shows only the top chrome (tab strip + urlbar)
    const chromeSrc = panelEl.querySelector('.browser-win');
    const chromeRect = chromeSrc ? chromeSrc.getBoundingClientRect() : panelRect;
    const ghostH = Math.min(chromeRect.height, 82);

    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:fixed',
      `left:${panelRect.left}px`,
      `top:${panelRect.top}px`,
      `width:${panelRect.width}px`,
      `height:${ghostH}px`,
      'pointer-events:none',
      'z-index:9999',
      'border-radius:10px',
      'background:rgba(26,115,232,0.07)',
      'border:2px solid rgba(26,115,232,0.45)',
      'box-shadow:0 10px 36px rgba(0,0,0,0.22)',
      'transform:rotate(1.5deg) scale(0.97)',
      'transition:transform 0.12s',
      'backdrop-filter:blur(2px)',
    ].join(';');
    document.body.appendChild(ghost);

    // Drop indicator line
    const indicator = document.createElement('div');
    indicator.style.cssText = [
      'position:fixed',
      'width:4px',
      'border-radius:3px',
      'background:#1a73e8',
      'box-shadow:0 0 10px rgba(26,115,232,0.6)',
      'pointer-events:none',
      'z-index:9998',
      'opacity:0',
      'transition:left 0.1s, opacity 0.1s',
    ].join(';');
    document.body.appendChild(indicator);

    panelEl.style.opacity = '0.35';
    panelEl.style.transition = 'opacity 0.15s';
    document.body.style.cursor = 'grabbing';

    let dropIdx = -1;

    function onMove(ev) {
      ghost.style.left = (ev.clientX - offsetX) + 'px';
      ghost.style.top = panelRect.top + 'px';

      const allPanels = [...panelsWrap.querySelectorAll('.panel')];
      const wrapRect = panelsWrap.getBoundingClientRect();

      // Find insertion index based on cursor vs panel midpoints
      let best = allPanels.length;
      for (let i = 0; i < allPanels.length; i++) {
        const r = allPanels[i].getBoundingClientRect();
        if (ev.clientX < r.left + r.width / 2) { best = i; break; }
      }
      dropIdx = best;

      // Position the indicator between panels
      let lineX;
      if (allPanels.length === 0) {
        lineX = wrapRect.left;
      } else if (best === 0) {
        lineX = allPanels[0].getBoundingClientRect().left - 4;
      } else if (best >= allPanels.length) {
        lineX = allPanels[allPanels.length - 1].getBoundingClientRect().right;
      } else {
        const prev = allPanels[best - 1].getBoundingClientRect();
        const next = allPanels[best].getBoundingClientRect();
        lineX = Math.round((prev.right + next.left) / 2) - 2;
      }

      indicator.style.left = lineX + 'px';
      indicator.style.top = wrapRect.top + 'px';
      indicator.style.height = wrapRect.height + 'px';
      indicator.style.opacity = '1';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      ghost.remove();
      indicator.remove();
      panelEl.style.opacity = '';
      panelEl.style.transition = '';
      document.body.style.cursor = '';

      const fromIdx = state.panels.findIndex(p => p.id === panelId);
      let toIdx = dropIdx;
      if (toIdx > fromIdx) toIdx--;
      if (toIdx >= 0 && toIdx !== fromIdx) {
        const [panel] = state.panels.splice(fromIdx, 1);
        state.panels.splice(toIdx, 0, panel);
        render();
        saveState();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Tab strip ─────────────────────────────────────────────────────────────────

function makeTabStrip(panel) {
  const strip = document.createElement('div');
  strip.className = 'tab-strip';

  // drag handle
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '⠿';
  handle.title = 'Przeciągnij aby zmienić kolejność';
  initPanelDrag(panel.id, handle);
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

  const content = document.createElement('div');
  content.className = 'tab-content';

  if (tab.favicon) {
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = tab.favicon;
    img.width = 16; img.height = 16;
    img.onerror = () => img.remove();
    content.appendChild(img);
  }

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New Tab';
  content.appendChild(title);

  const canClose = panel.tabs.length > 1 || !!tab.url;
  if (canClose) {
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.onclick = (e) => {
      e.stopPropagation();
      if (panel.tabs.length > 1) {
        closeTab(panel.id, tab.id);
      } else {
        // Reset sole tab to blank new-tab state instead of closing panel.
        tab.url = '';
        tab.title = 'New Tab';
        tab.favicon = null;
        tab.history = [];
        tab.histIdx = 0;
        refreshPanel(panel.id);
        saveState();
      }
    };
    content.appendChild(close);
  }

  el.appendChild(content);
  el.onclick = () => switchTab(panel.id, tab.id);

  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
    setTimeout(() => el.classList.add('tab-dragging'), 0);
  });
  el.addEventListener('dragend', () => el.classList.remove('tab-dragging'));
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = el.getBoundingClientRect();
    el.classList.toggle('tab-drop-before', e.clientX < r.left + r.width / 2);
    el.classList.toggle('tab-drop-after',  e.clientX >= r.left + r.width / 2);
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('tab-drop-before', 'tab-drop-after');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('tab-drop-before', 'tab-drop-after');
    const fromId = e.dataTransfer.getData('text/plain');
    if (fromId === tab.id) return;
    const p = getPanel(panel.id);
    const fromIdx = p.tabs.findIndex(t => t.id === fromId);
    let toIdx = p.tabs.findIndex(t => t.id === tab.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left + r.width / 2) toIdx++;
    if (toIdx > fromIdx) toIdx--;
    const [moved] = p.tabs.splice(fromIdx, 1);
    p.tabs.splice(toIdx, 0, moved);
    refreshPanel(panel.id);
    saveState();
  });

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

  const back = navBtn(`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`, 'Wstecz');
  back.disabled = !tab || tab.histIdx <= 0;
  back.onclick = () => navBack(panel.id);

  const fwd = navBtn(`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`, 'Naprzód');
  fwd.disabled = !tab || tab.histIdx >= tab.history.length - 1;
  fwd.onclick = () => navForward(panel.id);

  const reload = navBtn(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`, 'Odśwież');
  reload.onclick = () => reloadPanel(panel.id);

  bar.appendChild(back);
  bar.appendChild(fwd);
  bar.appendChild(reload);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'url-input-wrap';

  const input = document.createElement('input');
  input.className = 'url-input';
  input.type = 'text';
  input.value = tab ? tab.url : '';
  input.placeholder = 'Search or type a URL';
  input.spellcheck = false;
  input.autocomplete = 'off';

  const suggestions = document.createElement('div');
  suggestions.className = 'url-suggestions';

  let _sugg = [];
  let _suggIdx = -1;

  function hideSuggestions() {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    _sugg = [];
    _suggIdx = -1;
  }

  function selectSuggestion(url) {
    input.value = url;
    hideSuggestions();
    navigate(panel.id, url);
  }

  function renderSuggestions(items) {
    suggestions.innerHTML = '';
    _sugg = items;
    _suggIdx = -1;
    if (!items.length) { suggestions.style.display = 'none'; return; }
    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'url-sugg-row';

      const favicon = document.createElement('img');
      favicon.className = 'url-sugg-favicon';
      try {
        favicon.src = 'https://www.google.com/s2/favicons?sz=32&domain_url=' + encodeURIComponent(new URL(item.url).origin);
      } catch(e) {}
      favicon.onerror = () => {
        favicon.style.display = 'none';
        const fallback = document.createElement('span');
        fallback.className = 'url-sugg-favicon-fallback';
        row.insertBefore(fallback, favicon.nextSibling);
      };

      const label = document.createElement('span');
      label.className = 'url-sugg-label';
      if (item.title) {
        const titleSpan = document.createElement('span');
        titleSpan.className = 'url-sugg-name';
        titleSpan.textContent = item.title;
        const sep = document.createElement('span');
        sep.className = 'url-sugg-sep';
        sep.textContent = ' — ';
        const urlSpan = document.createElement('span');
        urlSpan.className = 'url-sugg-url';
        urlSpan.textContent = item.url;
        label.appendChild(titleSpan);
        label.appendChild(sep);
        label.appendChild(urlSpan);
      } else {
        const urlSpan = document.createElement('span');
        urlSpan.className = 'url-sugg-url';
        urlSpan.textContent = item.url;
        label.appendChild(urlSpan);
      }

      row.appendChild(favicon);
      row.appendChild(label);
      row.onmousedown = (e) => { e.preventDefault(); selectSuggestion(item.url); };
      row.onmouseover = () => { _suggIdx = i; highlightSuggestion(); };
      suggestions.appendChild(row);
    });
    suggestions.style.display = 'block';
  }

  function highlightSuggestion() {
    [...suggestions.children].forEach((el, i) => el.classList.toggle('active', i === _suggIdx));
    if (_suggIdx >= 0) input.value = _sugg[_suggIdx].url;
  }

  input.oninput = () => {
    const q = input.value.trim();
    if (!q) { hideSuggestions(); return; }
    const dotIdx = q.lastIndexOf('.');
    const q2 = dotIdx > 0 ? q.slice(0, dotIdx) : null;
    const seen = new Set();
    const merge = (a, b) => {
      const all = [...(a || []), ...(b || [])].filter(r => r.url && !seen.has(r.url) && seen.add(r.url));
      renderSuggestions(all.slice(0, 8).map(r => ({ url: r.url, title: r.title })));
    };
    if (q2) {
      chrome.history.search({ text: q, maxResults: 8, startTime: 0 }, (r1) => {
        chrome.history.search({ text: q2, maxResults: 8, startTime: 0 }, (r2) => merge(r1, r2));
      });
    } else {
      chrome.history.search({ text: q, maxResults: 8, startTime: 0 }, (r) => merge(r, []));
    }
  };

  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _suggIdx = Math.min(_suggIdx + 1, _sugg.length - 1);
      highlightSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _suggIdx = Math.max(_suggIdx - 1, -1);
      highlightSuggestion();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      hideSuggestions();
      navigate(panel.id, input.value);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  };

  input.onfocus = () => { input.select(); };
  input.onblur = () => { setTimeout(hideSuggestions, 150); };

  inputWrap.appendChild(input);
  inputWrap.appendChild(suggestions);
  bar.appendChild(inputWrap);


  return bar;
}

function navBtn(svg, title) {
  const btn = document.createElement('button');
  btn.className = 'nav-btn';
  btn.title = title;
  btn.innerHTML = svg;
  return btn;
}

// ── New-tab facts ─────────────────────────────────────────────────────────────

const FACTS = {
  mobile: [
    "The first smartphone, IBM Simon, was released in 1994 — 13 years before the iPhone.",
    "Mobile users spend 90% of their time in apps, not in mobile browsers.",
    "The average person checks their phone 96 times a day — once every 10 minutes.",
    "Touch screens were invented in 1965 by E.A. Johnson for air traffic control.",
    "Over 6 billion people have smartphones — more than have access to running water.",
    "The first mobile phone call was made in 1973 and lasted 30 minutes.",
    "Apple's App Store launched in 2008 with just 500 apps. Today there are over 1.8 million.",
    "Mobile data traffic has grown 100× in the last 10 years.",
    "The average smartphone today is more powerful than all of NASA's computers in 1969.",
    "Mobile users convert 3× slower than desktop users — despite generating more traffic.",
    "The word 'smartphone' was first used in 1997 by Ericsson to describe their GS 88 model.",
    "A typical mobile user touches their screen 2,617 times a day.",
    "The largest app market by downloads is India, followed by China and the US.",
    "Mobile page load time above 3 seconds causes 53% of users to abandon the site.",
    "The iPhone's original price in 2007 was $499 — equivalent to about $750 today.",
    "Android's first phone, the HTC Dream, launched in 2008 with a full slide-out keyboard.",
    "Mobile screens have gone from 3.5\" (iPhone 1) to 6.7\" (iPhone 15 Pro Max) in 17 years.",
    "The longest phone call ever recorded lasted 56 hours, 4 minutes.",
    "5G is up to 100× faster than 4G and has latency as low as 1 millisecond.",
    "Over 50% of all web traffic now comes from mobile devices.",
    "Dark mode can reduce battery usage by up to 47% on OLED screens.",
    "The human thumb can comfortably reach only 75% of a 6\" screen one-handed.",
    "Push notifications have an average open rate of 7.8% — far higher than email.",
    "In Japan, 90% of teens use their phones in the shower — driving waterproof phone demand.",
    "The average app loses 77% of its daily active users within the first 3 days after install.",
    "Mobile ad spending surpassed desktop ad spending for the first time in 2015.",
    "The most-downloaded app of all time is Facebook — followed by WhatsApp and Messenger.",
    "A dropped phone screen repair costs on average $200, making screen protectors very popular.",
    "Safari on iOS is the most popular mobile browser globally with over 27% market share.",
    "The first phone to feature a camera was the Sharp J-SH04, released in Japan in 2000.",
  ],
  desktop: [
    "The first commercial desktop computer, the Altair 8800, launched in 1975 for $439.",
    "The average desktop monitor refresh rate has jumped from 60Hz to 144Hz or more in 10 years.",
    "A standard desktop SSD is 30× faster at reading data than a hard drive from 2010.",
    "The QWERTY keyboard layout was designed in 1873 to slow typists down and prevent jamming.",
    "The first computer mouse had two perpendicular wheels — not a ball or optical sensor.",
    "Desktop users spend an average of 15 minutes longer per session than mobile users.",
    "The world's first website (info.cern.ch) was built on a NeXT desktop workstation in 1990.",
    "A modern CPU performs over 3 billion cycles per second — the first ran at 740,000.",
    "The 'blue screen of death' first appeared in Windows 3.1 in 1992.",
    "Desktop conversion rates average 3.9% — significantly higher than mobile at 1.8%.",
    "The '@' symbol in email addresses was chosen in 1971 because it meant 'at a rate of'.",
    "Windows 95's launch was so hyped that stores opened at midnight — a first for software.",
    "The average desktop page has grown from 702KB in 2010 to over 2.5MB today.",
    "Double-clicking was not standard until 1984 when the Mac introduced it to consumers.",
    "The first 1GB hard drive, released in 1980, weighed 550 pounds and cost $40,000.",
    "A full HD monitor can display over 2 million pixels simultaneously.",
    "The world's fastest desktop CPU can perform over 100 billion floating-point operations per second.",
    "Copy and paste was invented by Larry Tesler at Xerox PARC in 1973.",
    "Desktop users are 68% more likely to complete a purchase than mobile users.",
    "The first computer virus, 'Creeper', appeared in 1971 and displayed 'I'm the creeper, catch me if you can!'",
    "WiFi was invented in 1997 — the same year Google was founded.",
    "The spacebar is the most-pressed key on a keyboard, hit about 20,000 times a day by a typical user.",
    "A standard 1080p monitor has 2,073,600 pixels — each capable of showing 16.7 million colors.",
    "The first email was sent in 1971 between two computers sitting side by side in the same room.",
    "Desktop browsers account for 70%+ of all B2B web traffic, making them crucial for SaaS products.",
    "The Ctrl+Z undo shortcut was introduced by Apple in 1984 and adopted by Microsoft in 1990.",
    "The average office worker opens 8 browser tabs simultaneously.",
    "Desktop CPUs now include built-in AI accelerators capable of running neural networks locally.",
    "The resolution of a 4K monitor is 4× higher than 1080p — exactly 8,294,400 pixels.",
    "The first graphical web browser, Mosaic, was released in 1993 and changed the internet forever.",
  ],
};

function getNextFact(type) {
  const key = 'db-facts-' + type;
  let queue;
  try { queue = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { queue = null; }
  if (!Array.isArray(queue) || queue.length === 0) {
    queue = [...Array(FACTS[type].length).keys()].sort(() => Math.random() - 0.5);
  }
  const idx = queue.shift();
  try { localStorage.setItem(key, JSON.stringify(queue)); } catch(e) {}
  return FACTS[type][idx];
}

function makeNewTabPage(panel) {
  const fact = getNextFact(panel.type);
  const icon = panel.type === 'mobile' ? '📱' : '🖥';
  const el = document.createElement('div');
  el.className = 'new-tab-page';
  el.innerHTML = `
    <div class="new-tab-fact">
      <span class="new-tab-icon">${icon}</span>
      <p class="new-tab-label">Did you know?</p>
      <p class="new-tab-text">${fact}</p>
    </div>`;
  el.style.width = panel.viewport.w + 'px';
  el.style.height = panel.viewport.h + 'px';
  return el;
}

// ── Iframe ────────────────────────────────────────────────────────────────────

function makeIframe(panel) {
  const tab = getActiveTab(panel);
  const iframe = document.createElement('iframe');
  iframe.id = 'ifr-' + panel.id + '-' + tab.id;
  // window.name persists across same-frame navigations (even cross-origin redirects).
  // emulate.js reads it to know device type + dimensions on every page in this frame.
  iframe.name = `db|${panel.type}|${panel.viewport.w}|${panel.viewport.h}|${panel.devId}`;
  iframe.title = panel.type === 'mobile'
    ? `Podgląd mobilny (${panel.viewport.w}×${panel.viewport.h})`
    : `Podgląd desktop (${panel.viewport.w}×${panel.viewport.h})`;
  iframe.setAttribute('width', panel.viewport.w);
  iframe.setAttribute('height', panel.viewport.h);
  iframe.style.width = panel.viewport.w + 'px';
  iframe.style.minWidth = panel.viewport.w + 'px';
  iframe.style.maxWidth = panel.viewport.w + 'px';
  iframe.style.height = panel.viewport.h + 'px';
  iframe.style.display = 'block';
  iframe.style.border = 'none';
  iframe.setAttribute('sandbox',
    'allow-forms allow-modals allow-orientation-lock allow-pointer-lock ' +
    'allow-popups allow-popups-to-escape-sandbox allow-presentation ' +
    'allow-same-origin allow-scripts allow-downloads'
  );
  iframe.onload = () => {
    try {
      const title = iframe.contentDocument?.title;
      if (title) {
        const p = getPanel(panel.id); const t = p?.tabs.find(t => t.id === tab.id);
        if (t && title !== t.title) { t.title = title; if (t.id === p.activeTabId) refreshTabStrip(panel.id); }
      }
    } catch(e) {}
  };
  if (tab.url) {
    loadIntoIframe(panel, iframe, tab.url);
  } else {
    if (panel.type === 'mobile') sendBg({ type: 'db-clear-ua', devId: panel.devId });
    iframe.src = NEW_TAB_HOME;
  }
  return iframe;
}

// Appends our private device params to a URL. emulate.js reads them, then strips
// them from the displayed URL. __dbid is also the DNR match key for mobile UA.
function buildSrc(panel, url) {
  try {
    const u = new URL(url);
    u.searchParams.set('__dbid', panel.devId);
    u.searchParams.set('__dbt', panel.type);
    u.searchParams.set('__dbw', panel.viewport.w);
    u.searchParams.set('__dbh', panel.viewport.h);
    return u.toString();
  } catch (e) { return url; }
}

// Loads a URL into an iframe.
// For mobile panels: registers the DNR rule (sets mobile UA for requests
// bearing __dbid token), then loads the URL with that token embedded.
// If the server redirects to a mobile subdomain (e.g. trojmiasto.pl →
// m.trojmiasto.pl), the db-loaded handler detects the host change and
// calls loadIntoIframe again with the redirect target — this time the
// token is on the mobile subdomain URL and DNR fires there too.
async function loadIntoIframe(panel, iframe, url) {
  const key = iframe.id.slice(4); // strip 'ifr-' → 'panelId-tabId'
  _suppressHistory.add(key);
  iframe.removeAttribute('srcdoc');
  if (panel.type !== 'mobile') {
    iframe.src = buildSrc(panel, url);
    return;
  }
  // Preflight resolves redirect destination. DNR rule is either hostname-based
  // (redirect detected) or token-based (__dbid in URL, no redirect).
  const resp = await sendBg({ type: 'db-mobile-ua', devId: panel.devId, url });
  const finalUrl = resp?.url || url;
  _suppressHistory.add(key);
  // Redirected: load final URL (e.g. m.wp.pl) directly — DNR matches its hostname.
  // Not redirected: load with token so DNR can match __dbid uniquely per panel.
  iframe.src = resp?.redirected ? finalUrl : buildSrc(panel, finalUrl);
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
  tab.favicon = faviconUrl(url);
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

// Messages from emulate.js (MAIN world) running inside each panel iframe.
//   db-loaded    — a page finished loading or an SPA pushState/popstate happened.
//   db-urlchange — replaceState: update URL bar/title, never touch history.
//   db-navigate  — a same-frame link click: navigate this panel (re-attaches params).
//   db-newtab    — a target=_blank link: open in a new tab of this mini-browser.
window.addEventListener('message', e => {
  const data = e.data;
  if (!data || (data.type !== 'db-loaded' && data.type !== 'db-urlchange' && data.type !== 'db-navigate' && data.type !== 'db-newtab')) return;
  const iframe = [...document.querySelectorAll('iframe')].find(f => f.contentWindow === e.source);
  if (!iframe) return;
  const parts = iframe.id.split('-');
  const panelId = parts[1], tabId = parts[2];
  const panel = getPanel(panelId); if (!panel) return;
  const tab = panel.tabs.find(t => t.id === tabId); if (!tab) return;
  const url = data.url;
  if (!url || url === 'about:blank') return;

  if (data.type === 'db-newtab') {
    addTab(panelId, url);
    return;
  }

  if (data.type === 'db-navigate') {
    navigate(panelId, url);
    return;
  }

  if (data.type === 'db-urlchange') {
    if (!tab.url && url.startsWith(NEW_TAB_HOME)) return;
    // replaceState — update URL bar and title without pushing to history.
    tab.url = url;
    if (data.title) tab.title = data.title;
    tab.favicon = faviconUrl(url);
    if (tab.id === panel.activeTabId) { refreshUrlbar(panelId); refreshTabStrip(panelId); saveState(); }
    return;
  }

  // db-loaded
  // When a new tab shows the homepage, don't expose its URL in the address bar.
  if (!tab.url && url.startsWith(NEW_TAB_HOME)) {
    if (data.title) tab.title = 'New Tab';
    if (tab.id === panel.activeTabId) { refreshTabStrip(panelId); }
    return;
  }

  const _suppKey = panelId + '-' + tabId;
  const _wasSuppressed = _suppressHistory.has(_suppKey);

  // Detect server-side redirect to a mobile subdomain (e.g. trojmiasto.pl →
  // m.trojmiasto.pl). When it happens the token is gone from the redirect URL,
  // so DNR didn't fire for that request. Reload the redirect target with our
  // token so the server receives mobile UA and serves mobile content.
  if (panel.type === 'mobile' && _wasSuppressed) {
    let fromHost, toHost;
    try { fromHost = new URL(tab.url).hostname; } catch (e) {}
    try { toHost   = new URL(url).hostname;     } catch (e) {}
    if (fromHost && toHost && fromHost !== toHost) {
      // Update history entry in-place (transparent server redirect, not a user navigation).
      if (tab.histIdx >= 0) tab.history[tab.histIdx] = url;
      tab.url = url;
      tab.favicon = faviconUrl(url);
      _suppressHistory.delete(_suppKey);
      const ifr = document.getElementById('ifr-' + panelId + '-' + tabId);
      if (ifr) loadIntoIframe(panel, ifr, url);
      if (tab.id === panel.activeTabId) { refreshUrlbar(panelId); refreshTabStrip(panelId); saveState(); }
      return;
    }
  }

  if (!_wasSuppressed && url !== tab.url) {
    tab.history = tab.history.slice(0, tab.histIdx + 1);
    tab.history.push(url);
    tab.histIdx = tab.history.length - 1;
  }
  _suppressHistory.delete(_suppKey);

  tab.url = url;
  if (data.title) tab.title = data.title;
  tab.favicon = faviconUrl(url);
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
  if (!url) {
    setTimeout(() => {
      panelsWrap.querySelector(`[data-panel-id="${panelId}"] .url-input`)?.focus();
    }, 0);
  }
}

// Opens a new tab without switching focus — current tab stays active.
function addTabBackground(panelId, url = '') {
  const panel = getPanel(panelId);
  const tab = makeTab(url);
  if (url) tab.favicon = faviconUrl(url);
  panel.tabs.push(tab);
  refreshTabStrip(panelId);
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

// Mute the entire tab permanently so no audio ever plays from the extension page.
chrome.runtime.sendMessage({ type: 'set-panel-mute', muted: true });

// ── Panels ────────────────────────────────────────────────────────────────────

function addPanel(type) { state.panels.push(makePanel(type)); render(); saveState(); }

function removePanel(panelId) {
  if (state.panels.length <= 1) return;
  const panel = getPanel(panelId);
  if (panel) sendBg({ type: 'db-clear-ua', devId: panel.devId });
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

async function switchPanelType(panelId) {
  const panel   = getPanel(panelId);
  const leavingMobile = panel.type === 'mobile';

  // Wait for DNR rule removal BEFORE loading the new iframe — otherwise the
  // first request fires while the mobile-UA rule is still active.
  if (leavingMobile) await sendBg({ type: 'db-clear-ua', devId: panel.devId });

  panel.type     = leavingMobile ? 'desktop' : 'mobile';
  panel.viewport = panel.type === 'mobile'
    ? { w: MOBILE_PRESETS[0].w,  h: MOBILE_PRESETS[0].h  }
    : { w: DESKTOP_PRESETS[1].w, h: DESKTOP_PRESETS[1].h };

  // When leaving mobile, strip mobile subdomain (m., mobile.) so the desktop
  // version loads instead of staying on m.trojmiasto.pl etc.
  if (leavingMobile) {
    const tab = getActiveTab(panel);
    try {
      const u = new URL(tab.url);
      u.hostname = u.hostname.replace(/^(m|mobile)\./, '');
      tab.url = u.toString();
    } catch (e) {}
  }

  // Update panel element width and browser-win width to match new viewport.
  const PAD = 12;
  const el  = panelsWrap.querySelector(`[data-panel-id="${panelId}"]`);
  if (el) {
    el.style.flex = `0 0 ${panel.viewport.w + PAD * 2}px`;
    const win = el.querySelector('.browser-win');
    if (win) win.style.width = panel.viewport.w + 'px';
  }

  refreshPanel(panelId);
  applyAutoScale();
  saveState();
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
  const newIframe = makeIframe(panel);
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
    state.panels.length > 1 ? { icon: svgClose(), label: 'Close', danger: true, fn: () => removePanel(panelId) } : null,
    { icon: svgDup(),   label: 'Duplicate',                                 fn: () => duplicatePanel(panelId) },
    null,
    { icon: svgQr(),    label: 'Create QR code for this URL',               fn: () => showQR(tab?.url) },
    { icon: svgSwitch(),label: panel.type === 'mobile' ? 'Switch to desktop' : 'Switch to mobile', fn: () => switchPanelType(panelId) },
    { icon: svgSpeed(), label: 'Open in PageSpeed Insights',                fn: () => tab?.url && window.open('https://pagespeed.web.dev/report?url=' + encodeURIComponent(tab.url), '_blank') },
  ];

  // Remove leading/trailing separators (nulls) to avoid orphan lines.
  const trimmed = items.filter((x, i, a) => {
    if (x !== null) return true;
    const prev = a.slice(0, i).findLast(v => v !== null);
    const next = a.slice(i + 1).find(v => v !== null);
    return !!prev && !!next;
  });
  trimmed.forEach(item => {
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

function drawQR(container, text) {
  container.innerHTML = '';
  QRCode.toString(text, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' }, (err, svg) => {
    if (err) { container.textContent = 'Błąd QR'; return; }
    container.innerHTML = svg;
    const svgEl = container.querySelector('svg');
    if (svgEl) { svgEl.style.width = '260px'; svgEl.style.height = '260px'; }
  });
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

window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = ''; });
