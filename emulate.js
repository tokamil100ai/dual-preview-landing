// emulate.js — world: MAIN, document_start, all_frames.
// Device type + dimensions come from window.name = "db|<type>|<w>|<h>|<devId>".
// window.name is set by the extension on the <iframe> element and persists through
// all same-frame navigations (server-side redirects, SPA pushState, cross-origin
// navigations) — so emulation keeps working even after wp.pl → www.wp.pl redirects.
// The __dbid token in the URL is only used by the DNR rule for the first request.
(() => {
  const parts = String(window.name).split('|');
  if (parts[0] !== 'db') return;

  const type    = parts[1] || 'desktop';
  const isMobile = type === 'mobile';
  const W = parseInt(parts[2]) || (isMobile ? 375 : 1440);
  const H = parseInt(parts[3]) || (isMobile ? 812 : 900);
  const devId = parts[4] || '';
  const dpr = isMobile ? 2 : 1;

  // Strip our private params from the live URL so page scripts don't see them.
  try {
    const u = new URL(location.href);
    let changed = false;
    ['__dbid', '__dbt', '__dbw', '__dbh'].forEach(k => { if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; } });
    if (changed) history.replaceState(history.state, '', u.toString());
  } catch (e) {}

  // ── matchMedia emulation ──────────────────────────────────────────────────────
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
    return false;
  };

  try {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q) => ({
        matches: evalQuery(q), media: q, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  } catch (e) {}

  const def = (obj, prop, getter) => {
    try { Object.defineProperty(obj, prop, { get: getter, configurable: true }); } catch (e) {}
  };
  def(window.screen, 'width',       () => W);
  def(window.screen, 'height',      () => H);
  def(window.screen, 'availWidth',  () => W);
  def(window.screen, 'availHeight', () => isMobile ? H - 44 : H - 40);
  def(window, 'devicePixelRatio',   () => dpr);
  def(navigator, 'maxTouchPoints',  () => isMobile ? 10 : 0);

  if (isMobile) {
    const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
    def(navigator, 'userAgent',    () => IPHONE_UA);
    def(navigator, 'platform',     () => 'iPhone');
    def(navigator, 'vendor',       () => 'Apple Computer, Inc.');
    def(navigator, 'appVersion',   () => '5.0 (iPhone)');
    // Ensure ontouchstart exists — some sites check this to detect touch device.
    if (!('ontouchstart' in window)) window.ontouchstart = null;
  }

  // ── Report navigation to the extension page ───────────────────────────────────
  function cleanHref(href) {
    try {
      const u = new URL(href, location.href);
      ['__dbid', '__dbt', '__dbw', '__dbh'].forEach(k => u.searchParams.delete(k));
      return u.toString();
    } catch (e) { return href; }
  }

  function report(type) {
    try {
      window.parent.postMessage({ type, devId, url: cleanHref(location.href), title: document.title || '' }, '*');
    } catch (e) {}
  }

  window.addEventListener('load', () => report('db-loaded'));

  // SPA navigation.
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = function (s, t, u) { _push(s, t, u);    setTimeout(() => report('db-loaded'),    0); };
  history.replaceState = function (s, t, u) { _replace(s, t, u); setTimeout(() => report('db-urlchange'), 0); };
  window.addEventListener('popstate', () => setTimeout(() => report('db-loaded'), 0));

  // ── Link interception ─────────────────────────────────────────────────────────
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    let href;
    try { href = new URL(a.href, location.href); } catch (e) { return; }
    if (href.protocol !== 'http:' && href.protocol !== 'https:') return;

    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target === '_blank' || target === '_new') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      window.parent.postMessage({ type: 'db-newtab', devId, url: cleanHref(href.href) }, '*');
      return;
    }

    if (!target || target === '_self') {
      // Pure in-page hash change — let it pass through.
      if (href.href.split('#')[0] === location.href.split('#')[0] && href.hash) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      window.parent.postMessage({ type: 'db-navigate', devId, url: cleanHref(href.href) }, '*');
    }
  }, true);
})();
