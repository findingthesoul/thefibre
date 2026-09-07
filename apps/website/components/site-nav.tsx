'use client';

// The V3 nav pattern, kept: transparent over the hero, the wordmark fades
// in once the hero's own wordmark scrolls away (sentinel div on Home; on
// subpages the sentinel is absent and the logo is simply there).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { startHref } from '@/lib/site';

const LINKS = [
  { href: '/workshop', label: 'The workshop' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hasSentinel, setHasSentinel] = useState(false);

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
        showLogo ? 'border-b border-line bg-surface/90 backdrop-blur' : 'border-b border-transparent'
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
            className="hidden text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink sm:inline-block"
          >
            {l.label}
          </Link>
        ))}
        <a
          href={startHref()}
          className="inline-block rounded-lg bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(255,221,0,0.35)]"
        >
          Start a Thread
        </a>
      </div>
    </nav>
  );
}
