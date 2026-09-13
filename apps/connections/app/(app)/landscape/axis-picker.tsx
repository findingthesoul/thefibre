import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n-ui';
import { AXIS_QUESTION_KEYS, axisTitle, type Axis, type AxisConfig } from './bands';

// The picker that makes this surface one page instead of five.
//
// docs/connections-mobile.md §2 / D32: the same population, re-segmented, in
// an IDENTICAL visual. Everything below the picker keeps its grammar — bands,
// proportions, counts, movement — and only the MEANING of a band changes.
// That is what lets a facilitator learn this once and read it five ways, and
// it is the reason the sales pipeline is a chip here rather than a second
// product with its own navigation.
//
// Plain links, not a client control: the axis is in the URL, so a reading is
// shareable and bookmarkable, the back button steps through the axes a person
// actually looked at, and the page keeps working before any JavaScript has
// arrived. Mobile rule 5 — the shape survives a bad connection.
export function AxisPicker({
  axis,
  locale,
  axes,
  config,
}: {
  axis: Axis;
  locale: Locale;
  /** The axes this workspace reads. Since 2026-09-13 a workspace can switch
   *  one off, so the row is no longer the shipped five. */
  axes: readonly Axis[];
  /** Their titles, where the workspace has chosen its own word. */
  config?: AxisConfig;
}) {
  return (
    <div className="mt-6">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {t(locale, 'landscape_axis')}
      </div>

      {/* The row scrolls INSIDE itself and bleeds to the screen edge: five
          chips do not fit across 375px, and a page that scrolls sideways is
          forbidden outright by this project's mobile rules. The negative
          margin matches PageContainer's px-8 so the first chip still lines up
          with the heading above it. */}
      <div className="-mx-8 mt-2 overflow-x-auto px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {axes.map((a) => {
            const on = a === axis;
            return (
              <Link
                key={a}
                href={`/landscape?axis=${a}`}
                scroll={false}
                aria-current={on ? 'true' : undefined}
                className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors ${
                  on
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface-raised text-ink-muted hover:text-ink'
                }`}
              >
                {axisTitle(locale, config, a)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* The question the chosen axis answers. Without it a chip row is five
          nouns; with it, the picker teaches what the bands underneath mean. */}
      <p className="mt-3 max-w-2xl text-sm text-ink-muted">{t(locale, AXIS_QUESTION_KEYS[axis])}</p>
    </div>
  );
}
