'use client';

// One full-viewport story beat (the counder.com grammar, in our voice): a
// single huge sentence, the key words inked while the rest stays muted,
// fading in as the scene reaches the reader. Reduced motion / no JS: the
// sentence is simply there.

import { useEffect, useRef, useState } from 'react';

export function Scene({
  children,
  className = '',
  tall = true,
}: {
  children: React.ReactNode;
  className?: string;
  tall?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setShown(false);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`relative flex ${tall ? 'min-h-[92svh]' : 'min-h-[55svh]'} items-center justify-center px-6 md:px-10 ${className}`}
    >
      <div
        className="mx-auto max-w-4xl text-center transition-all duration-700 ease-out"
        style={shown ? undefined : { opacity: 0, transform: 'translateY(24px)' }}
      >
        {children}
      </div>
    </section>
  );
}

/** The sentence itself: muted ground, inked emphasis. */
export function Line({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-4xl font-semibold leading-tight tracking-tight text-ink-muted md:text-6xl">
      {children}
    </p>
  );
}

export function Ink({ children }: { children: React.ReactNode }) {
  return <span className="text-ink">{children}</span>;
}
