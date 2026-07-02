'use client';

import { useEffect } from 'react';

// Posts the embed content height to the parent window so embed.js can size
// the iframe. Measures #thread-embed-root (not the document — the root
// layout's `min-h-screen` body would pin scrollHeight to the iframe height
// and the frame could grow but never shrink).
export function HeightReporter() {
  useEffect(() => {
    if (window.parent === window) return; // not framed — nothing to report to

    const root = document.getElementById('thread-embed-root');
    if (!root) return;

    let last = -1;
    const post = () => {
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      // '*' target: embeds live on arbitrary third-party origins. The payload
      // is just a number — nothing sensitive crosses the boundary.
      window.parent.postMessage({ type: 'thread-embed:height', height }, '*');
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
  }, []);

  return null;
}
