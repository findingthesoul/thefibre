'use client';

// How to reach somebody: phone, email, LinkedIn, where they are.
//
// Extracted 2026-09-14 from person-popup.tsx, the day a second surface needed
// it — the fourth column of the landscape shows the same person, and two
// copies of a contact row are two places for a phone link to break
// differently. Components first (CLAUDE.md).

import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { PersonCard } from '@/app/(app)/people/[id]/load';

export function ContactRow({ person }: { person: PersonCard }) {
  return (
    <>
      {/* Everything you need to reach them, before you decide to
          leave. Sjoerd, 2026-09-13: *"when I am searching for someone
          in my network and use maps to identify them, and want to call
          them... I need to leave MAPS and go to FIBRE for more info..
          and then when I talked to them, I need to go back to
          Connections, search him again and then file the info"*.

          That round trip was the cost, and it bought nothing: these
          fields were already in the response the popup had fetched —
          `GET /persons/:id` is a `select('*')` — and were simply never
          shown. So the call happens from here and the note is written
          in the same dialog, without leaving once.

          A `tel:` link and not a number to copy: on a phone it dials,
          on a Mac it hands off to whatever takes calls. That is the
          whole point of the change. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {person.phone && (
          <a
            href={`tel:${person.phone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1.5 text-ink hover:underline"
          >
            <Phone size={13} strokeWidth={1.75} />
            {person.phone}
          </a>
        )}
        {person.email && (
          <a
            href={`mailto:${person.email}`}
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink hover:underline"
          >
            <Mail size={13} strokeWidth={1.75} />
            {person.email}
          </a>
        )}
        {person.linkedin_url && (
          <a
            href={person.linkedin_url}
            // A genuinely external site, so a new tab is right here in
            // a way it was not for The Fibre: nobody expects LinkedIn
            // to replace the thing they were reading.
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
          >
            <ExternalLink size={12} strokeWidth={1.75} />
            LinkedIn
          </a>
        )}
        {(person.city || person.country) && (
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <MapPin size={13} strokeWidth={1.75} />
            {[person.city, person.country].filter(Boolean).join(', ')}
          </span>
        )}
      </div>
      {/* The second number and address, only when they exist. Kept off
          the main row so the one you will actually use is not one of
          four things competing for the same glance. */}
      {(person.phone_secondary || person.email_secondary) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 text-xs text-ink-subtle">
          {person.phone_secondary && (
            <a
              href={`tel:${person.phone_secondary.replace(/\s+/g, '')}`}
              className="hover:text-ink hover:underline"
            >
              {person.phone_secondary}
            </a>
          )}
          {person.email_secondary && (
            <a
              href={`mailto:${person.email_secondary}`}
              className="hover:text-ink hover:underline"
            >
              {person.email_secondary}
            </a>
          )}
        </div>
      )}
    </>
  );
}
