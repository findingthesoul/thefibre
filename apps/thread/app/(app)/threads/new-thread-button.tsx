'use client';

// "New thread" with a hover menu (Sjoerd 2026-07-02): hovering reveals the
// saved thread templates — pick one to start from it; clicking the button
// itself starts from scratch.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, LayoutTemplate, Plus } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';

export function NewThreadButton({
  locale,
  templates,
}: {
  locale: Locale;
  templates: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function hideSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative" onMouseEnter={templates.length ? show : undefined} onMouseLeave={hideSoon}>
      <button
        type="button"
        onClick={() => router.push('/threads/new')}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:opacity-90"
      >
        <Plus size={15} strokeWidth={2} />
        {t(locale, 'new_thread')}
      </button>

      {open && templates.length > 0 && (
        <div
          className="absolute right-0 z-40 mt-1.5 w-72 rounded-lg border border-line bg-surface-raised shadow-lg py-2"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
        >
          <button
            type="button"
            onClick={() => router.push('/threads/new')}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
          >
            <CalendarRange size={15} strokeWidth={1.75} />
            {t(locale, 'start_from_scratch')}
          </button>
          <div className="my-1.5 border-t border-line" />
          <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'from_a_template')}
          </div>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => router.push(`/templates/threads?use=${t.id}`)}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
            >
              <LayoutTemplate size={15} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
