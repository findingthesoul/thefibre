import Link from 'next/link';
import { Orbit } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';

// The tag cloud — Sjoerd, 2026-09-12: *"could be in the form of a list... or
// in the form of visual cloud"*, *"or maybe even a map (landcard)"*.
//
// ── Why a cloud earns its place here when a node graph does not ─────────────
//
// connections-desktop.md rejects the force-directed hairball: it demos
// beautifully and answers no question. A cloud is different because it encodes
// something a list cannot show at a glance — RELATIVE weight — and because the
// thing being weighted is the one number that decides whether a tag connects
// anybody at all.
//
// ── The rarity rule, made visible ───────────────────────────────────────────
//
// connections-model.md §3.5: *"A tag on three people is a strong link. A tag
// on three hundred is not a link at all."* That rule is what stops a tag
// vocabulary from rotting without anybody policing it, and until now it lived
// only in prose.
//
// So two dimensions, doing different jobs:
//
//   SIZE      how many people carry it — reach.
//   STRENGTH  how much it connects, which falls as reach grows. A tag on
//             nearly everybody is a category, not a connection, and it fades
//             rather than shouts.
//
// The result is deliberately counter-intuitive at first glance: the biggest
// word is not the most important one. That is the point. A cloud where size
// meant importance would say "everyone" is your strongest link.

export type TagRow = {
  id: string;
  name: string;
  color: string | null;
  organisation_id: string | null;
  people: number;
  from_notes: number;
};

/**
 * Type size from reach, on a square-root scale.
 *
 * Linear scaling makes one popular tag dwarf everything else into
 * illegibility; sqrt is the standard fix and keeps a 3-person tag readable
 * next to a 300-person one. Clamped at both ends because a cloud nobody can
 * read is not a visualisation.
 */
function sizeRem(people: number, max: number): number {
  if (max <= 1) return 1;
  const scaled = Math.sqrt(people) / Math.sqrt(max);
  // Two decimals: `1.7859709753334592rem` in the markup is noise, and nobody
  // can see the difference from `1.79rem`.
  return Math.round((0.85 + scaled * 1.45) * 100) / 100;
}

/**
 * How much this tag actually connects, as opacity.
 *
 * A tag on more than a third of the people it could apply to has stopped
 * being a link between them. Not a cliff: it fades, because the boundary is a
 * judgement and a hard cut would make two similar tags look categorically
 * different.
 */
function strength(people: number, total: number): number {
  if (total <= 0) return 1;
  const share = people / total;
  if (share <= 0.05) return 1;
  if (share >= 0.5) return 0.32;
  return Math.round((1 - ((share - 0.05) / 0.45) * 0.68) * 100) / 100;
}

export function TagCloud({
  tags,
  totalPeople,
  locale,
}: {
  tags: TagRow[];
  /** Everybody in the workspace — the denominator the rarity rule needs. */
  totalPeople: number;
  locale: Locale;
}) {
  if (tags.length === 0) return null;
  const max = Math.max(...tags.map((t) => t.people));

  // Alphabetical, not by size. A cloud sorted by weight is a bar chart with
  // extra steps, and the whole reason to draw it this way is that the eye
  // finds the heavy ones without the order doing the work.
  const shown = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {shown.map((tag) => (
          <span key={tag.id} className="inline-flex items-baseline gap-1.5">
            <Link
              href={`/people?tag=${tag.id}`}
              title={t(locale, 'tags_carried_by', { n: tag.people })}
              className="leading-tight transition-colors hover:text-ink"
              style={{
                fontSize: `${sizeRem(tag.people, max)}rem`,
                opacity: strength(tag.people, totalPeople),
              }}
            >
              {tag.name}
            </Link>
            {/* The same tag, as a web rather than a list. Sjoerd, 2026-09-13:
                *"Can you also create a cloud around a location - space... or
                tag? So you select people around a NODE?"* — a separate small
                target rather than changing where the word itself goes,
                because "show me the list" and "show me the shape" are both
                real questions and the list was here first. */}
            <Link
              href={`/map?focus=${tag.id}&kind=tag`}
              aria-label={t(locale, 'tags_as_web', { name: tag.name })}
              title={t(locale, 'tags_as_web', { name: tag.name })}
              className="text-ink-subtle transition-colors hover:text-ink"
            >
              <Orbit size={13} strokeWidth={1.75} />
            </Link>
          </span>
        ))}
      </div>

      <p className="mt-5 max-w-2xl text-xs text-ink-subtle">{t(locale, 'tags_cloud_legend')}</p>
    </div>
  );
}
