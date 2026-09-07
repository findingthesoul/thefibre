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
function ElementSequence({
  locale,
  elements,
}: {
  locale: Locale;
  elements: LibraryTemplate['elements'];
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5">
      {elements.map((el, i) => {
        const meta = metaFor(el.type as EngagementType);
        const Icon = meta.icon;
        return (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="mx-1 text-[10px] text-ink-muted">→</span>}
            <span
              title={engagementTypeLabel(locale, el.type)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 ${meta.chip}`}
            >
              <Icon size={12} strokeWidth={1.75} className={meta.text} />
            </span>
            {el.days > 1 && (
              <span className="ml-0.5 text-[10px] tabular-nums text-ink-muted">×{el.days}</span>
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
  const body = (
    <>
      <div className="text-sm font-medium">{templateName(locale, template.id)}</div>
      <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
        {templateDesc(locale, template.id)}
      </p>
      <ElementSequence locale={locale} elements={template.elements} />
    </>
  );

  if (!template.available) {
    return (
      <div className="rounded-lg border border-line bg-surface-sunken/50 p-4 opacity-70">
        {body}
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Lock size={11} strokeWidth={1.75} />
          {t(locale, 'tpl_locked')}
        </div>
      </div>
    );
  }

  const cls = `block w-full rounded-lg border p-4 text-left transition-all cursor-pointer ${
    selected
      ? 'border-yellow-400 bg-yellow-50/50 ring-1 ring-yellow-300'
      : 'border-line bg-surface-raised hover:border-line-strong hover:shadow-[0_4px_12px_-4px_rgb(0_0_0/0.1)]'
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
