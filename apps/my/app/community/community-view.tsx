// One community's page: the admin's introduction, what is next, the
// community's documents, and the documents the member's own threads have
// already sent them. Members only — the API answers nothing to anyone else.

import Link from 'next/link';
import { FileText, Image as ImageIcon, Link2 } from 'lucide-react';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { ROW_LIST, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import type { CommunityView } from '@/lib/portal-api';
import { fmtDate, fmtDateTime } from '@/lib/format';

export function CommunityPage({ c }: { c: CommunityView }) {
  return (
    <div className="mt-6 space-y-10">
      {c.intro_html && (
        <section className="max-w-prose text-ink">
          <RichText html={c.intro_html} />
        </section>
      )}

      {/* The member's own tiers' sections, ADDED under the community's intro. */}
      {(c.tier_sections ?? []).map((x) => (
        <section key={x.tier_id} className="max-w-prose text-ink">
          <h2 className={SECTION_LABEL}>{x.tier_name}</h2>
          <div className="mt-3">
            <RichText html={x.intro_html} />
          </div>
        </section>
      ))}

      {c.next && (
        <section>
          <h2 className={SECTION_LABEL}>Next</h2>
          <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
            <p className="text-base text-ink">{c.next.title}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {c.next.kind === 'yours' ? fmtDateTime(c.next.starts_at) : fmtDate(c.next.starts_at)}
              {c.next.thread_title ? ` · ${c.next.thread_title}` : ''}
            </p>
            {c.next.kind === 'upcoming' && (
              <Link href="/upcoming" className="mt-2 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70">
                See it under Upcoming
              </Link>
            )}
          </div>
        </section>
      )}

      {c.documents.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL}>Documents</h2>
          <ul className={`mt-3 ${ROW_LIST}`}>
            {c.documents.map((d) => (
              <li key={d.id}>
                {d.kind === 'link' ? (
                  // A link entry: straight to the address, in a new tab, with
                  // no opener — the page it opens cannot reach back into this
                  // one. The API only stores http(s) addresses.
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-surface-sunken sm:px-5"
                  >
                    <Link2 size={18} strokeWidth={1.75} className="shrink-0 text-ink-subtle" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  </a>
                ) : (
                  /* Through this app's own route: it checks the session and
                     hands over a one-minute address. */
                  <a
                    href={`/community-document/${c.workspace_id}/${d.id}`}
                    className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-surface-sunken sm:px-5"
                  >
                    {d.mime === 'application/pdf' ? (
                      <FileText size={18} strokeWidth={1.75} className="shrink-0 text-ink-subtle" aria-hidden />
                    ) : (
                      <ImageIcon size={18} strokeWidth={1.75} className="shrink-0 text-ink-subtle" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.thread_documents.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL}>From your threads</h2>
          {c.thread_documents.map((g) => (
            <div key={g.thread_title} className="mt-3">
              <p className="text-sm font-medium text-ink">{g.thread_title}</p>
              <ul className="mt-1 space-y-1">
                {g.items.map((i, k) => (
                  <li key={k} className="text-sm">
                    {i.url ? (
                      <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70">
                        {i.title}
                      </a>
                    ) : (
                      <span className="text-ink">{i.title}</span>
                    )}
                    <span className="text-ink-muted"> · {fmtDate(i.sent_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!c.intro_html && !c.tier_sections?.length && !c.next && !c.documents.length && !c.thread_documents.length && (
        <p className="text-sm text-ink-muted">Nothing here yet. Your community can add an introduction and documents.</p>
      )}
    </div>
  );
}
