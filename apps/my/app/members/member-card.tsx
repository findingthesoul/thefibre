// One member, as another member sees them.
//
// Everything here was decided by the server: the contact fields are null
// unless that member chose to show them, so this component never has to know
// the rule — it only has to not invent one.

import Link from 'next/link';
import { Mail, Phone, Globe, Linkedin } from 'lucide-react';
import type { DirectoryMember } from '@/lib/portal-api';

export function MemberCard({
  member: m,
  href,
}: {
  member: DirectoryMember;
  /** Where clicking this member goes. Optional: the card is used in one
   *  place today, and a card that cannot be opened is a card, not a bug. */
  href?: string;
}) {
  // The NAME is the link, not the whole card. A card full of mailto: and
  // tel: links wrapped in another link is a thing that misbehaves — the
  // inner anchors still work, but a tap near one is ambiguous, and on a
  // phone that is most taps.
  const name = href ? (
    <Link href={href} className="hover:underline">
      {m.display_name}
    </Link>
  ) : (
    m.display_name
  );
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        {(() => {
          const avatar = m.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.photo_url}
              alt={m.display_name}
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line"
            />
          ) : (
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-medium text-ink-subtle ring-1 ring-line">
              {m.display_name.slice(0, 1).toUpperCase()}
            </span>
          );
          return href ? (
            <Link href={href} aria-label={m.display_name} className="shrink-0">
              {avatar}
            </Link>
          ) : (
            avatar
          );
        })()}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{name}</p>
          {(m.city || m.country) && (
            <p className="text-xs text-ink-muted">
              {[m.city, m.country].filter(Boolean).join(', ')}
            </p>
          )}
          {m.bio && (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{m.bio}</p>
          )}

          {(m.tags.length > 0 || m.categories.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.categories.map((c) => (
                <span
                  key={`c-${c}`}
                  className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-subtle"
                >
                  {c}
                </span>
              ))}
              {m.tags.map((tg) => (
                <span
                  key={`t-${tg}`}
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted"
                >
                  {tg}
                </span>
              ))}
            </div>
          )}

          {/* Only what this member chose to show. The server decides
              — these are null unless show(M) resolved true. */}
          {(m.email || m.phone || m.linkedin_url || m.website_url) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {m.email && (
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <Mail size={13} strokeWidth={1.75} />
                  {m.email}
                </a>
              )}
              {m.phone && (
                <a
                  href={`tel:${m.phone}`}
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <Phone size={13} strokeWidth={1.75} />
                  {m.phone}
                </a>
              )}
              {m.linkedin_url && (
                <a
                  href={m.linkedin_url}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <Linkedin size={13} strokeWidth={1.75} />
                  LinkedIn
                </a>
              )}
              {m.website_url && (
                <a
                  href={m.website_url}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <Globe size={13} strokeWidth={1.75} />
                  Website
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
