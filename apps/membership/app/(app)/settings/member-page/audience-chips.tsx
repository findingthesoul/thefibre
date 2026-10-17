'use client';

// WHO SEES IT — one picker for everything on the member page that has an
// audience: a document, a link, and (2026-10-17) a connected Google Drive
// folder. "Everyone" + one chip per tier + one per directory category, read
// by the API's visibleTo (ANY chosen tier OR ANY chosen category; nothing
// chosen = everyone). Extracted from member-page-client.tsx so a folder
// cannot get a second, drifting copy (components first).

import { CHIP, CHIP_STATE } from '@thefibre/shared/ui/recipes';
import { t, type Locale } from '@/lib/i18n-ui';

export type Audience = { tier_ids: string[]; category_ids: string[] };
type Option = { id: string; name: string };

export function AudienceChips({
  value,
  onChange,
  tiers,
  categories,
  label,
  locale,
}: {
  value: { tier_ids?: string[] | null; category_ids?: string[] | null };
  onChange: (next: Audience) => void;
  tiers: Option[];
  categories: Option[];
  /** The accessible name of the group, e.g. "Shown to: Welcome pack". */
  label: string;
  locale: Locale;
}) {
  const tierIds = value.tier_ids ?? [];
  const catIds = value.category_ids ?? [];
  const everyone = !tierIds.length && !catIds.length;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  if (tiers.length + categories.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs text-ink-muted">{t(locale, 'mp_shown_to')}</span>
      <button
        type="button"
        aria-pressed={everyone}
        onClick={() => !everyone && onChange({ tier_ids: [], category_ids: [] })}
        className={`${CHIP} ${everyone ? CHIP_STATE.on : CHIP_STATE.off}`}
      >
        {t(locale, 'mp_everyone')}
      </button>
      {tiers.map((x) => {
        const on = tierIds.includes(x.id);
        return (
          <button key={x.id} type="button" aria-pressed={on} onClick={() => onChange({ tier_ids: toggle(tierIds, x.id), category_ids: catIds })} className={`${CHIP} ${on ? CHIP_STATE.on : CHIP_STATE.off}`}>
            {x.name}
          </button>
        );
      })}
      {categories.length > 0 && tiers.length > 0 && <span className="mx-0.5 text-ink-muted" aria-hidden>·</span>}
      {categories.map((x) => {
        const on = catIds.includes(x.id);
        return (
          <button key={x.id} type="button" aria-pressed={on} onClick={() => onChange({ tier_ids: tierIds, category_ids: toggle(catIds, x.id) })} className={`${CHIP} ${on ? CHIP_STATE.on : CHIP_STATE.off}`}>
            {x.name}
          </button>
        );
      })}
    </div>
  );
}
