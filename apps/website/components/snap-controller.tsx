'use client';

// The magnet, zoned (Sjoerd, 2026-09-08: "the whole stickiness is gone" /
// "can't scroll up from the footer" — both true at once). Inside the card
// deck the snap is MANDATORY (the full magnetic feel); once the reader
// nears the page tail (invitation + footer) it relaxes to proximity so
// the footer scrolls freely. Hysteresis between the two thresholds keeps
// it from flapping at the boundary. SSR default is proximity (safe
// without JS). The whole magnet lives behind min-width:768px in
// globals.css — on mobile there is NO snap at all (v0.68.17: sections
// exceed a phone viewport, so any snap fights momentum scrolling), and
// this controller's data-snap flag simply has no CSS to bite on there.

import { useEffect } from 'react';

export function SnapController({ deckEndId }: { deckEndId: string }) {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const marker = document.getElementById(deckEndId);
      if (!marker) return;
      const deckEnd = marker.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight;
      const y = window.scrollY;
      const current = root.dataset.snap ?? 'soft';
      if (y < deckEnd - 1.5 * vh) {
        if (current !== 'hard') root.dataset.snap = 'hard';
      } else if (y > deckEnd - 1.1 * vh) {
        if (current !== 'soft') root.dataset.snap = 'soft';
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      delete root.dataset.snap;
    };
  }, [deckEndId]);
  return null;
}
