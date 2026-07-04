/* The Thread — embeddable widgets (list, thread, enrol popup).
 *
 * Usage on any website (Webflow etc.):
 *   <script src="https://thread.thefibre.app/embed.js" defer></script>
 *   <div data-thread-embed="list" data-organiser="sjoerd"></div>
 *   <div data-thread-embed="thread" data-organiser="sjoerd" data-thread="my-event"
 *        data-elements="cover,intention,enrol"></div>
 *   <a href="#" data-thread-embed="enrol" data-organiser="sjoerd" data-thread="my-event">Enrol</a>
 *
 * Optional data-lang="en|nl|es|pt|de" on any embed forces the UI language.
 * Without it, thread + enrol embeds follow the thread's own language; the
 * list falls back to English for its chrome (each popup still opens in the
 * thread's language).
 *
 * Framework-free, idempotent (safe to include twice). Iframes auto-size via
 * `thread-embed:height` postMessages from the embed pages.
 */
(function () {
  'use strict';
  if (window.__threadEmbedLoaded) return;
  window.__threadEmbedLoaded = true;

  // The embed pages live on the same origin this script was loaded from.
  var ORIGIN = (function () {
    var s = document.currentScript;
    if (!s || !s.src) {
      var all = document.querySelectorAll('script[src]');
      for (var i = 0; i < all.length; i++) {
        if (/\/embed\.js(\?|#|$)/.test(all[i].src)) { s = all[i]; break; }
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

  function makeIframe(src) {
    var f = document.createElement('iframe');
    f.src = src;
    f.title = 'The Thread';
    f.style.width = '100%';
    f.style.border = '0';
    f.style.display = 'block';
    f.style.height = '160px';
    f.style.colorScheme = 'light';
    return f;
  }

  function threadSrc(organiser, thread, extra) {
    return ORIGIN + '/embed/thread/' + encodeURIComponent(organiser || '') + '/' +
      encodeURIComponent(thread || '') + query(extra);
  }

  var inlineFrames = [];

  function mountList(el) {
    var d = el.dataset;
    var f = makeIframe(ORIGIN + '/embed/list' + query({
      organiser: d.organiser, team: d.team, org: d.org, workspace: d.workspace,
      compact: d.compact, theme: d.theme, lang: d.lang, popup: '1',
    }));
    el.appendChild(f);
    inlineFrames.push(f);
  }

  function mountThread(el) {
    var d = el.dataset;
    var f = makeIframe(threadSrc(d.organiser, d.thread, {
      elements: d.elements, theme: d.theme, lang: d.lang, popup: '1',
    }));
    el.appendChild(f);
    inlineFrames.push(f);
  }

  /* ---- enrol popup (fixed overlay + centered iframe) ---- */
  var popup = null;

  function closePopup() {
    if (!popup) return;
    if (popup.el.parentNode) popup.el.parentNode.removeChild(popup.el);
    popup = null;
  }

  function openPopup(src) {
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
    close.innerHTML = '×';
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
    popup = { el: backdrop, frame: f };
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  function mountEnrol(el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openPopup(threadSrc(el.dataset.organiser, el.dataset.thread, {
        elements: 'enrol', popup: '1', lang: el.dataset.lang,
      }));
    });
  }

  /* ---- messages from embed iframes ---- */
  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'thread-embed:height') {
      var h = Math.max(0, Math.ceil(Number(e.data.height) || 0));
      if (!h) return;
      for (var i = 0; i < inlineFrames.length; i++) {
        if (inlineFrames[i].contentWindow === e.source) inlineFrames[i].style.height = h + 'px';
      }
      if (popup && popup.frame.contentWindow === e.source) popup.frame.style.height = h + 'px';
    } else if (e.data.type === 'thread-embed:open-enrol') {
      // A list card with popup interaction was clicked inside the list
      // iframe — open the enrol overlay on the host page.
      var organiser = typeof e.data.organiser === 'string' ? e.data.organiser : '';
      var thread = typeof e.data.thread === 'string' ? e.data.thread : '';
      if (organiser && thread) {
        openPopup(threadSrc(organiser, thread, {
          elements: 'enrol', popup: '1',
          lang: typeof e.data.lang === 'string' ? e.data.lang : null,
        }));
      }
    } else if (e.data.type === 'thread-embed:open' && typeof e.data.url === 'string') {
      // Legacy list-card message (pre data-lang). Convert the public thread
      // URL (…/{organiser}/{thread}) into the embed enrol view and pop it up.
      try {
        var parts = new URL(e.data.url).pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          openPopup(threadSrc(parts[0], parts[1], { elements: 'enrol', popup: '1' }));
        }
      } catch (err) { /* malformed url — ignore */ }
    }
  });

  /* ---- boot ---- */
  function scan() {
    var els = document.querySelectorAll('[data-thread-embed]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-thread-embed-mounted')) continue;
      el.setAttribute('data-thread-embed-mounted', '1');
      var kind = el.getAttribute('data-thread-embed');
      if (kind === 'list') mountList(el);
      else if (kind === 'thread') mountThread(el);
      else if (kind === 'enrol') mountEnrol(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
