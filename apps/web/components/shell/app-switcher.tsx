'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';

export type AppEntry = {
  slug: string;
  name: string;
  url: string;
  current?: boolean;
};

export function AppSwitcher({
  current,
  apps,
}: {
  current: { slug: string; name: string };
  apps: AppEntry[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink hover:bg-surface-sunken"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {current.name}
        <ChevronDown size={14} strokeWidth={1.75} className="text-ink-muted" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 rounded-lg bg-surface-raised border border-line shadow-lg py-2 text-sm z-40">
          <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
            Switch app
          </div>
          {apps.map((a) => {
            const isCurrent = a.current ?? a.slug === current.slug;
            const cls =
              'flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-surface-sunken';
            const inner = (
              <>
                <span className={isCurrent ? 'font-medium' : ''}>{a.name}</span>
                {isCurrent && <Check size={14} strokeWidth={2} className="text-ink-subtle" />}
              </>
            );
            if (isCurrent) {
              return (
                <div key={a.slug} className={`${cls} cursor-default`}>
                  {inner}
                </div>
              );
            }
            return (
              <Link key={a.slug} href={a.url} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
