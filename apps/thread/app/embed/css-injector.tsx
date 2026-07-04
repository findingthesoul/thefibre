'use client';

// Custom CSS receiver — integrators put a <style> block INSIDE their embed
// div; embed.js forwards its text here and we inject it into the iframe's
// head. Injected last, so equal-specificity rules win over the defaults.
// The parent page controls its own embed, so any origin may send; only a
// plain CSS string is accepted and it can't run script.

import { useEffect } from 'react';

const MAX_CSS = 20_000;

export function CssInjector() {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; css?: string } | null;
      if (!d || d.type !== 'thread-embed:css' || typeof d.css !== 'string') return;
      let el = document.getElementById('te-custom-css') as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = 'te-custom-css';
        document.head.appendChild(el);
      }
      el.textContent = d.css.slice(0, MAX_CSS);
    }
    window.addEventListener('message', onMessage);
    // Tell the parent we can receive CSS now (covers load-order races).
    try {
      window.parent?.postMessage({ type: 'thread-embed:ready' }, '*');
    } catch {
      /* not embedded */
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return null;
}
