'use client';

// The iframe-side half of the website-embed protocol (the host-page half is
// the loader built by ../embed-loader.ts). Extracted from the Thread's
// embed pages (design-leading) when Membership grew the same two components
// — per the components-first rule the per-app copies are now shims binding
// `ns` / ids.
//
// Protocol (all types are `<ns>:<sub>`):
//   iframe → host: 'height' {height}   — auto-size the iframe
//   iframe → host: 'ready'             — CSS can be received now
//   host → iframe: 'css' {css}         — the integrator's lifted <style>

import { useEffect } from 'react';

/**
 * Posts the embed content height to the parent window so the loader can
 * size the iframe. Measures `rootId` (not the document — a root layout's
 * `min-h-screen` body would pin scrollHeight to the iframe height and the
 * frame could grow but never shrink).
 */
export function EmbedHeightReporter({ ns, rootId }: { ns: string; rootId: string }) {
  useEffect(() => {
    if (window.parent === window) return; // not framed — nothing to report to

    const root = document.getElementById(rootId);
    if (!root) return;

    let last = -1;
    const post = () => {
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      // '*' target: embeds live on arbitrary third-party origins. The payload
      // is just a number — nothing sensitive crosses the boundary.
      window.parent.postMessage({ type: `${ns}:height`, height }, '*');
    };

    post();
    const ro = new ResizeObserver(post);
    ro.observe(root);
    const mo = new MutationObserver(post);
    mo.observe(root, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', post);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', post);
    };
  }, [ns, rootId]);

  return null;
}

const MAX_CSS = 20_000;

/**
 * Custom CSS receiver — integrators put a <style> block INSIDE their embed
 * div; the loader lifts it and forwards its text here, and we inject it
 * into the iframe's head. Injected last, so equal-specificity rules win
 * over the defaults. The parent page controls its own embed, so any origin
 * may send; only a plain CSS string is accepted and it can't run script.
 */
export function EmbedCssReceiver({ ns, styleId }: { ns: string; styleId: string }) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; css?: string } | null;
      if (!d || d.type !== `${ns}:css` || typeof d.css !== 'string') return;
      let el = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = d.css.slice(0, MAX_CSS);
    }
    window.addEventListener('message', onMessage);
    // Tell the parent we can receive CSS now (covers load-order races).
    try {
      window.parent?.postMessage({ type: `${ns}:ready` }, '*');
    } catch {
      /* not embedded */
    }
    return () => window.removeEventListener('message', onMessage);
  }, [ns, styleId]);
  return null;
}
