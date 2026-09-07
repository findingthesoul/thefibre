'use client';

// The five standard event shapes (apps/api/src/lib/thread-template-library.ts)
// as picker cards. One component, two postures: selectable (new-thread form)
// or a link (dashboard first-event hero). Names + descriptions are UI chrome
// from lib/i18n-ui.ts (`tpl_<id>` / `tpl_<id>_desc`); the element sequence
// renders as small type-chips in blueprint order via ENGAGEMENT_META.

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { metaFor } from '@/lib/engagement-meta';
import type { EngagementType } from '@/lib/thread-types';
import { t, engagementTypeLabel, type UiKey } from '@/lib/i18n-ui';

/** GET /api/v1/thread/template-library response. */
export type LibraryTemplate = {
  id: string;
  available: boolean;
  elements: { type: string; title: string; days: number }[];
};
export type TemplateLibrary = {
  templates: LibraryTemplate[];
  can_edit_structure: boolean;
};

/** Fallback when the library couldn't be fetched — hide pickers, gate open. */
export const EMPTY_LIBRARY: TemplateLibrary = { templates: [], can_edit_structure: true };

// Explicit id → catalog-key maps (the ids are stable; a new template is a
// deploy on both sides, so an unknown id falls back to its raw id).
const NAME_KEYS: Record<string, UiKey> = {
  'single-event': 'tpl_single_event',
  'two-day-event': 'tpl_two_day_event',
  'guided-event': 'tpl_guided_event',
  'workshop-series': 'tpl_workshop_series',
  'conversation-circle': 'tpl_conversation_circle',
};
const DESC_KEYS: Record<string, UiKey> = {
  'single-event': 'tpl_single_event_desc',
  'two-day-event': 'tpl_two_day_event_desc',
  'guided-event': 'tpl_guided_event_desc',
  'workshop-series': 'tpl_workshop_series_desc',
  'conversation-circle': 'tpl_conversation_circle_desc',
};

export function templateName(locale: Locale, id: string): string {
  const key = NAME_KEYS[id];
  return key ? t(locale, key) : id;
}
export function templateDesc(locale: Locale, id: string): string {
  const key = DESC_KEYS[id];
  return key ? t(locale, key) : '';
}

/** The blueprint's element sequence as ordered type-chips (✉ → ● → ✉). */
// Each template wears one of the brand's paper-cut colours — a soft wash
// and the thread that strings its moments together (Sjoerd 2026-09-08:
// "this looks like a program of the '80s" — the Matisse language belongs
// here too). Washes are translucent so both themes carry them.
const ACCENTS: Record<string, { wash: string; thread: string }> = {
  'single-event': { wash: 'bg-yellow-300/15', thread: 'bg-yellow-400/70' },
  'two-day-event': { wash: 'bg-sky-400/10', thread: 'bg-sky-400/60' },
  'guided-event': { wash: 'bg-rose-400/10', thread: 'bg-rose-400/60' },
  'workshop-series': { wash: 'bg-emerald-400/10', thread: 'bg-emerald-500/60' },
  'conversation-circle': { wash: 'bg-orange-400/10', thread: 'bg-orange-400/60' },
};
const DEFAULT_ACCENT = { wash: 'bg-surface-sunken/60', thread: 'bg-ink/20' };

function ElementSequence({
  locale,
  elements,
  thread,
}: {
  locale: Locale;
  elements: LibraryTemplate['elements'];
  thread: string;
}) {
  return (
    <div className="relative mt-4 flex flex-wrap items-center gap-y-2 py-1">
      {/* The thread itself, strung behind the moments. */}
      <span
        aria-hidden="true"
        className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full ${thread}`}
      />
      {elements.map((el, i) => {
        const meta = metaFor(el.type as EngagementType);
        const Icon = meta.icon;
        const activity =
          el.type === 'event' || el.type === 'conversation' || el.type === 'workshop';
        return (
          <span key={i} className="relative inline-flex items-center">
            <span
              title={engagementTypeLabel(locale, el.type)}
              className={`inline-flex items-center justify-center rounded-full ring-2 ring-surface-raised shadow-sm ${meta.chip} ${
                activity ? 'h-10 w-10' : 'h-7 w-7 mx-1'
              }`}
            >
              <Icon size={activity ? 17 : 12} strokeWidth={1.75} className={meta.text} />
            </span>
            {el.days > 1 && (
              <span className="absolute -top-1.5 -right-1 rounded-full bg-ink text-surface text-[9px] font-semibold px-1 leading-4 tabular-nums">
                ×{el.days}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * One template card. Pass `onSelect` (+ `selected`) for the picker posture,
 * or `href` for the link posture. An unavailable template renders locked in
 * both — a short higher-plan hint, no click.
 */
export function TemplateCard({
  locale,
  template,
  selected = false,
  onSelect,
  href,
}: {
  locale: Locale;
  template: LibraryTemplate;
  selected?: boolean;
  onSelect?: () => void;
  href?: string;
}) {
  const accent = ACCENTS[template.id] ?? DEFAULT_ACCENT;
  const body = (
    <>
      <div className="text-[15px] font-semibold tracking-tight">
        {templateName(locale, template.id)}
      </div>
      <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
        {templateDesc(locale, template.id)}
      </p>
      <ElementSequence locale={locale} elements={template.elements} thread={accent.thread} />
    </>
  );

  if (!template.available) {
    return (
      <div className={`rounded-xl border border-line p-5 opacity-60 ${accent.wash}`}>
        {body}
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Lock size={11} strokeWidth={1.75} />
          {t(locale, 'tpl_locked')}
        </div>
      </div>
    );
  }

  const cls = `block w-full rounded-xl border p-5 text-left transition-all cursor-pointer ${accent.wash} ${
    selected
      ? 'border-yellow-400 ring-2 ring-yellow-300 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] -translate-y-0.5'
      : 'border-line hover:border-line-strong hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.16)]'
  }`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cls}>
      {body}
    </button>
  );
}

/** The "start blank" card — only offered when the plan can edit structure. */
export function BlankTemplateCard({
  locale,
  selected,
  onSelect,
}: {
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`block w-full rounded-lg border-2 border-dashed p-4 text-left transition-all cursor-pointer ${
        selected
          ? 'border-yellow-400 bg-yellow-50/50'
          : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      <div className="text-sm font-medium">{t(locale, 'tpl_blank')}</div>
      <p className="mt-1 text-xs text-ink-subtle leading-relaxed">{t(locale, 'tpl_blank_desc')}</p>
    </button>
  );
}
