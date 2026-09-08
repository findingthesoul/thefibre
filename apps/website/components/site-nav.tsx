'use client';

// The V3 nav pattern, kept: transparent over the hero, the wordmark fades
// in once the hero's own wordmark scrolls away (sentinel div on Home; on
// subpages the sentinel is absent and the logo is simply there).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StartButton } from '@/components/start-dialog';
import { APP_URL } from '@/lib/site';

const LINKS = [
  { href: '/why', label: 'Why' },
  { href: '/workshop', label: 'The workshop' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hasSentinel, setHasSentinel] = useState(false);
  // The hamburger (Sjoerd 2026-09-08): below sm the link row is hidden, so
  // without it a phone visitor can reach nothing but the Start button.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const sentinel = document.getElementById('hero-wordmark-sentinel');
    setHasSentinel(!!sentinel);
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry!.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const showLogo = !hasSentinel || scrolled;

  return (
    <nav
      className={`sticky top-0 z-50 flex h-16 items-center justify-between px-6 transition-all duration-300 md:px-10 ${
        showLogo ? 'border-b border-line/60 bg-surface/20 backdrop-blur-sm' : 'border-b border-transparent'
      }`}
    >
      <Link href="/" className="flex items-center" aria-label="The Thread — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-the-thread.svg"
          alt="The Thread"
          className={`h-7 w-auto transition-all duration-300 ${
            showLogo ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
          }`}
        />
      </Link>
      <div className="flex items-center gap-2 md:gap-5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-ink-subtle transition-colors hover:bg-surface-paper hover:text-ink sm:inline-block"
          >
            {l.label}
          </Link>
        ))}
        <a
          href={APP_URL}
          className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-ink-subtle transition-colors hover:bg-surface-paper hover:text-ink sm:inline-block"
        >
          Sign in
        </a>
        <StartButton className="inline-block rounded-lg bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(255,221,0,0.35)]">
          Start a Thread
        </StartButton>
        <div ref={menuRef} className="relative sm:hidden">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-paper"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-52 rounded-xl border border-line bg-surface p-2 shadow-[0_12px_32px_-8px_rgba(26,26,46,0.18)]">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-paper"
                >
                  {l.label}
                </Link>
              ))}
              <a
                href={APP_URL}
                className="mt-1 block rounded-lg border-t border-line px-3 pb-2.5 pt-3 text-sm font-medium text-ink-subtle transition-colors hover:bg-surface-paper hover:text-ink"
              >
                Sign in
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
