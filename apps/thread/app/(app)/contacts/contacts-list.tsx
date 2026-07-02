'use client';

// Contacts list — whole row clickable, opening a popup with the person's
// thread memberships and a jump-out to their Fibre platform profile.

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/page';

export type ContactItem = {
  person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  threads: { id: string; title: string; status: string }[];
  last_enrolled_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function contactName(it: ContactItem): string {
  return (
    [it.person.first_name, it.person.last_name].filter(Boolean).join(' ') ||
    it.person.email ||
    'Unknown'
  );
}

export function ContactsList({ items }: { items: ContactItem[] }) {
  const [selected, setSelected] = useState<ContactItem | null>(null);

  return (
    <>
      <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
        {items.map((it) => (
          <li key={it.person.id}>
            <button
              type="button"
              onClick={() => setSelected(it)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-surface-sunken transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{contactName(it)}</div>
                <div className="text-xs text-ink-subtle mt-0.5 truncate">{it.person.email}</div>
                {it.threads.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {it.threads.map((t) => (
                      <span
                        key={t.id}
                        className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-subtle"
                      >
                        {t.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {it.last_enrolled_at && (
                <span className="text-xs text-ink-muted shrink-0">
                  {formatDate(it.last_enrolled_at)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <Dialog open onClose={() => setSelected(null)} title={contactName(selected)}>
          <div className="space-y-5">
            <div>
              <SectionLabel>Email</SectionLabel>
              <p className="mt-1 text-sm">
                {selected.person.email ?? <span className="text-ink-muted">No email</span>}
              </p>
            </div>

            <div>
              <SectionLabel>Threads</SectionLabel>
              {selected.threads.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">No thread enrolments.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.threads.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-subtle"
                    >
                      {t.title}
                      <span className="text-ink-muted capitalize">· {t.status}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selected.last_enrolled_at && (
              <div>
                <SectionLabel>Last enrolled</SectionLabel>
                <p className="mt-1 text-sm">{formatDate(selected.last_enrolled_at)}</p>
              </div>
            )}

            <a
              href={`https://thefibre.app/contacts/${selected.person.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors h-8 px-3 text-sm border border-line bg-surface-raised text-ink hover:bg-surface-sunken"
            >
              Open in The Fibre
              <ExternalLink size={13} strokeWidth={1.75} />
            </a>
          </div>
        </Dialog>
      )}
    </>
  );
}
