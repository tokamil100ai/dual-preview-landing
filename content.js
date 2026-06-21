// world: MAIN, document_start — runs in every frame before any page script.
// The extension sets iframe.name = "db|<type>|<w>|<h>" (e.g. "db|mobile|375|812").
// window.name persists across navigations (even cross-origin), so device emulation
// survives clicking links inside the frame without any per-request rewriting.
(() => {
  if (window === window.top) return; // only emulate inside iframes

  const parts = String(window.name).split('|');
  if (parts[0] !== 'db') return;

  const isMobile = parts[1] === 'mobile';

  // Did THIS request carry our mobile-UA token? If so, the mobile User-Agent header
  // was applied at the network layer and the server returned the mobile site.
  // If a mobile frame loaded WITHOUT a token (i.e. the user clicked a link inside
  // the frame), the server got the desktop UA — we must reload it with a token so
  // the article page is fetched as mobile too. Strip the token either way so the
  // page and our history never see it.
  let hadToken = false;
  try {
    const u = new URL(location.href);
    for (const k of [...u.searchParams.keys()]) {
      if (/^dbm[a-z0-9]+$/.test(k)) { u.searchParams.delete(k); hadToken = true; }
    }
    if (hadToken) history.replaceState(history.state, '', u.toString());
  } catch (e) {}
  const W = parseInt(parts[2]) || (isMobile ? 375 : 1440);
  const H = parseInt(parts[3]) || (isMobile ? 812 : 900);
  const dpr = isMobile ? 2 : 1;

  // ── matchMedia: the property most responsive sites rely on ──────────────
  const evalQuery = (raw) => {
    const e = String(raw).trim();
    if (e === '(pointer: coarse)' || e === '(any-pointer: coarse)') return isMobile;
    if (e === '(pointer: fine)' || e === '(any-pointer: fine)') return !isMobile;
    if (e === '(hover: hover)' || e === '(any-hover: hover)') return !isMobile;
    if (e === '(hover: none)' || e === '(any-hover: none)') return isMobile;
    if (e === '(orientation: portrait)') return isMobile;
    if (e === '(orientation: landscape)') return !isMobile;
    if (e.includes('max-width'))  { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return W <= r; }
    if (e.includes('min-width'))  { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return W >= r; }
    if (e.includes('width'))      { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return W === r; }
    if (e.includes('max-height')) { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return H <= r; }
    if (e.includes('min-height')) { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return H >= r; }
    if (e.includes('height'))     { const r = parseInt(e.match(/\d+/)?.[0] || '0'); return H === r; }
    if (e.includes('device-pixel-ratio') || e.includes('-webkit-device-pixel-ratio')) {
      const c = parseFloat(e.match(/[\d.]+/)?.[0] || '1');
      return e.includes('min-') ? dpr >= c : e.includes('max-') ? dpr <= c : dpr === c;
    }
    if (e.includes('touch')) return isMobile;
    if (e === 'screen' || e === 'all') return true;
    if (e === 'print') return false;
    return false; // unknown → don't force
  };

  const realMatchMedia = window.matchMedia.bind(window);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q) => {
      // Combine our viewport verdict with the real one so nothing breaks unexpectedly.
      const mql = realMatchMedia(q);
      try {
        return {
          matches: evalQuery(q),
          media: q,
          onchange: null,
          addListener: () => {}, removeListener: () => {},
          addEventListener: () => {}, removeEventListener: () => {},
          dispatchEvent: () => false,
        };
      } catch (e) { return mql; }
    },
  });

  // ── screen / devicePixelRatio / touch ───────────────────────────────────
  const def = (obj, prop, getter) => {
    try { Object.defineProperty(obj, prop, { get: getter, configurable: true }); } catch (e) {}
  };
  def(window.screen, 'width',  () => W);
  def(window.screen, 'height', () => H);
  def(window.screen, 'availWidth',  () => W);
  def(window.screen, 'availHeight', () => isMobile ? H - 44 : H - 40);
  def(window, 'devicePixelRatio', () => dpr);
  def(navigator, 'maxTouchPoints', () => isMobile ? 10 : 0);

  // ── userAgent (least important, but some sites still sniff it) ───────────
  if (isMobile) {
    const ua = navigator.userAgent;
    def(navigator, 'userAgent', () => ua.includes('Mobile') ? ua : ua.replace(')', '; Mobile)'));
  }

  // ── intercept in-frame link clicks (mobile) to avoid a desktop flash ─────
  // Catch plain same-frame navigations BEFORE they fire, and let the parent load
  // them with a token straight away (mobile UA from the first request, no reload).
  if (isMobile) {
    document.addEventListener('click', (ev) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target.closest && ev.target.closest('a[href]');
      if (!a) return;
      const target = (a.getAttribute('target') || '').toLowerCase();
      if (target && target !== '_self') return; // _blank etc. → let it open normally
      let href;
      try { href = new URL(a.href, location.href); } catch (e) { return; }
      if (href.protocol !== 'http:' && href.protocol !== 'https:') return;
      // pure in-page anchor jumps don't navigate — let the browser handle them
      if (href.href.split('#')[0] === location.href.split('#')[0] && href.hash) return;
      ev.preventDefault();
      window.parent.postMessage({ type: 'navigate-request', url: href.href }, '*');
    }, true);
  }

  // ── report to the parent app ────────────────────────────────────────────
  window.addEventListener('load', () => {
    try {
      if (isMobile && !hadToken) {
        // user navigated inside the mobile frame (link/form) → served as desktop;
        // ask the parent to reload this URL WITH a token so it becomes mobile.
        window.parent.postMessage({ type: 'mobile-reload-needed', url: location.href }, '*');
      } else {
        window.parent.postMessage({ type: 'iframe-navigated', url: location.href }, '*');
      }
    } catch (e) {}
  });
})();
