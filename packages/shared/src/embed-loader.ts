// The ONE website-embed integration (Sjoerd 2026-09-05: "embeds should be
// @thefibre/shared"). Every app with public embeds serves the same
// loader-script pattern — the Thread's, which is design-leading:
//
//   <script src="https://<app>.thefibre.app/embed.js" defer></script>
//   <div data-<ns>="<kind>" data-…></div>
//
// This module builds that loader's JS source from a per-app config; each
// app serves it from `app/embed.js/route.ts`. The mechanism (origin
// detection, query building, CSS lift, height/ready/css postMessage
// protocol, click popups) lives here ONCE; an app contributes only its
// kinds and paths. The iframe-side halves of the protocol are the shared
// `EmbedHeightReporter` / `EmbedCssReceiver` components (./ui/embed-frame).
//
// The emitted JS is a published integration contract (pasted into Webflow
// sites we don't control): additive-only, ES5, framework-free, idempotent.

/** One embeddable widget kind (`data-<ns>="<kind>"`). */
export type EmbedKind = {
  /** Embed-page path; `{param}` placeholders fill from data-* attributes. */
  path: string;
  /** dataset keys forwarded as query params (also valid in `path`). */
  params?: string[];
  /** Constants merged into the query string. */
  fixed?: Record<string, string>;
  /** 'inline' mounts an iframe in place (default); 'popup' opens an overlay on click. */
  mode?: 'inline' | 'popup';
};

export type EmbedLoaderConfig = {
  /** Attribute + message namespace, e.g. 'thread-embed' → data-thread-embed, 'thread-embed:height'. */
  ns: string;
  /** window property guarding double-include (keep historical values stable). */
  flag: string;
  /** iframe title attribute. */
  title: string;
  /** Comment block at the top of the served file (usage docs). */
  header: string;
  kinds: Record<string, EmbedKind>;
  /**
   * Messages from inside an embed that open a popup on the host page:
   * message-type suffix → popup target; `{param}`s fill from the message data.
   */
  popupMessages?: Record<string, EmbedKind>;
  /**
   * Legacy `<ns>:open {url}` handler (pre data-lang Thread lists): the url's
   * path segments fill `{0}`, `{1}`, … in `path`. Omit for new apps.
   */
  legacyOpen?: { path: string; fixed?: Record<string, string> };
};

export function buildEmbedLoader(cfg: EmbedLoaderConfig): string {
  const conf = JSON.stringify({
    ns: cfg.ns,
    flag: cfg.flag,
    title: cfg.title,
    kinds: cfg.kinds,
    popupMessages: cfg.popupMessages ?? {},
    legacyOpen: cfg.legacyOpen ?? null,
  });
  return `${cfg.header}
(function () {
  'use strict';
  var CFG = ${conf};
  if (window[CFG.flag]) return;
  window[CFG.flag] = true;

  // The embed pages live on the same origin this script was loaded from.
  var ORIGIN = (function () {
    var s = document.currentScript;
    if (!s || !s.src) {
      var all = document.querySelectorAll('script[src]');
      for (var i = 0; i < all.length; i++) {
        if (/\\/embed\\.js(\\?|#|$)/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    try { return s && s.src ? new URL(s.src, location.href).origin : null; }
    catch (e) { return null; }
  })();
  if (!ORIGIN) return;

  function query(params) {
    var parts = [];
    for (var k in params) {
      if (params[k] != null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  // Build a kind's iframe src from a value bag (dataset or message data).
  function srcFor(kind, values) {
    var path = kind.path.replace(/\\{([a-zA-Z0-9_]+)\\}/g, function (_, name) {
      return encodeURIComponent(values[name] == null ? '' : String(values[name]));
    });
    var q = {};
    var i, k;
    var params = kind.params || [];
    for (i = 0; i < params.length; i++) {
      k = params[i];
      if (values[k] != null && values[k] !== '') q[k] = String(values[k]);
    }
    for (k in (kind.fixed || {})) q[k] = kind.fixed[k];
    return ORIGIN + path + query(q);
  }

  function makeIframe(src) {
    var f = document.createElement('iframe');
    f.src = src;
    f.title = CFG.title;
    f.style.width = '100%';
    f.style.border = '0';
    f.style.display = 'block';
    f.style.height = '160px';
    f.style.colorScheme = 'light';
    return f;
  }

  // Lift the integrator's <style> out of the embed element: its text goes
  // into the iframe (<ns>:css) and the node is removed so it can never
  // leak onto the host page.
  function extractCss(el) {
    var st = el.querySelector('style');
    if (!st) return '';
    var css = st.textContent || '';
    if (st.parentNode) st.parentNode.removeChild(st);
    return css;
  }

  var inlineFrames = [];

  function mountInline(el, kind) {
    var css = extractCss(el);
    var f = makeIframe(srcFor(kind, el.dataset));
    f.__embCss = css;
    el.appendChild(f);
    inlineFrames.push(f);
  }

  /* ---- popup (fixed overlay + centered iframe) ---- */
  var popup = null;

  function closePopup() {
    if (!popup) return;
    if (popup.el.parentNode) popup.el.parentNode.removeChild(popup.el);
    popup = null;
  }

  function openPopup(src, css) {
    closePopup();
    var backdrop = document.createElement('div');
    backdrop.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;background:rgba(20,20,18,.55);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;';
    var box = document.createElement('div');
    box.style.cssText = 'position:relative;width:100%;max-width:440px;';
    var f = makeIframe(src);
    f.style.height = '320px';
    f.style.maxHeight = '85vh';
    f.style.background = '#fff';
    f.style.borderRadius = '14px';
    f.style.boxShadow = '0 12px 40px rgba(0,0,0,.28)';
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '\\u00d7';
    close.style.cssText =
      'position:absolute;top:-12px;right:-12px;width:30px;height:30px;border-radius:50%;' +
      'border:0;background:#fff;color:#333;font-size:19px;line-height:28px;padding:0;' +
      'cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.3);';
    close.addEventListener('click', closePopup);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closePopup(); });
    box.appendChild(f);
    box.appendChild(close);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    f.__embCss = css || '';
    popup = { el: backdrop, frame: f };
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  function mountPopupTrigger(el, kind) {
    var css = extractCss(el);
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openPopup(srcFor(kind, el.dataset), css);
    });
  }

  /* ---- messages from embed iframes ---- */
  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN || !e.data || typeof e.data !== 'object') return;
    var type = typeof e.data.type === 'string' ? e.data.type : '';
    if (type.indexOf(CFG.ns + ':') !== 0) return;
    var sub = type.slice(CFG.ns.length + 1);
    var i;
    if (sub === 'ready') {
      // An embed page can now receive CSS — send the frame's, if any.
      var frames = inlineFrames.slice();
      if (popup) frames.push(popup.frame);
      for (var r = 0; r < frames.length; r++) {
        if (frames[r].contentWindow === e.source && frames[r].__embCss) {
          e.source.postMessage({ type: CFG.ns + ':css', css: frames[r].__embCss }, ORIGIN);
        }
      }
    } else if (sub === 'height') {
      var h = Math.max(0, Math.ceil(Number(e.data.height) || 0));
      if (!h) return;
      for (i = 0; i < inlineFrames.length; i++) {
        if (inlineFrames[i].contentWindow === e.source) inlineFrames[i].style.height = h + 'px';
      }
      if (popup && popup.frame.contentWindow === e.source) popup.frame.style.height = h + 'px';
    } else if (CFG.popupMessages[sub]) {
      // A click inside an embed asked the host page to open a popup — the
      // popup inherits the source embed's custom CSS.
      var srcCss = '';
      for (i = 0; i < inlineFrames.length; i++) {
        if (inlineFrames[i].contentWindow === e.source) srcCss = inlineFrames[i].__embCss || '';
      }
      openPopup(srcFor(CFG.popupMessages[sub], e.data), srcCss);
    } else if (sub === 'open' && CFG.legacyOpen && typeof e.data.url === 'string') {
      // Legacy message (pre data-lang): a public URL whose path segments
      // fill {0}, {1}, … of the configured popup path.
      try {
        var parts = new URL(e.data.url).pathname.split('/').filter(Boolean);
        var bag = {};
        for (i = 0; i < parts.length; i++) bag[String(i)] = parts[i];
        openPopup(srcFor({ path: CFG.legacyOpen.path, fixed: CFG.legacyOpen.fixed || {} }, bag));
      } catch (err) { /* malformed url — ignore */ }
    }
  });

  /* ---- boot ---- */
  function scan() {
    var els = document.querySelectorAll('[data-' + CFG.ns + ']');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-' + CFG.ns + '-mounted')) continue;
      el.setAttribute('data-' + CFG.ns + '-mounted', '1');
      var kind = CFG.kinds[el.getAttribute('data-' + CFG.ns)];
      if (!kind) continue;
      if (kind.mode === 'popup') mountPopupTrigger(el, kind);
      else mountInline(el, kind);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
`;
}
