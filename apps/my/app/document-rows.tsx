// The document rows, ONE copy for the two pages that list documents: a
// community's page and Files (Sjoerd 2ij). Moved out of community-view.tsx
// rather than forked, so a file opens the same way wherever it is listed.

import { FileText, Image as ImageIcon, Link2 } from 'lucide-react';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { DEFAULT_TZ, fmtDate } from '@/lib/format';
import type { Locale } from '@thefibre/shared/i18n';

export type CommunityDocument =
  | { id: string; title: string; kind: 'file'; mime: string; bytes: number }
  | { id: string; title: string; kind: 'link'; url: string };

/** A community's own documents. A file opens through this app's own route,
 *  which checks the session and hands over a one-minute address; a link goes
 *  straight to its address in a new tab. */
export function CommunityDocumentList({ workspaceId, documents }: { workspaceId: string; documents: CommunityDocument[] }) {
  return (
    <ul className={`mt-3 ${ROW_LIST}`}>
      {documents.map((d) => (
        <li key={d.id}>
          {d.kind === 'link' ? (
            // No opener — the page it opens cannot reach back into this one.
            // The API only stores http(s) addresses.
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
            <a
              href={`/community-document/${workspaceId}/${d.id}`}
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
  );
}

/** One thread's released document steps: title, link, the day it came. */
export function ThreadDocumentGroup({
  title,
  items,
  locale,
}: {
  title: string;
  items: { title: string; url: string | null; sent_at: string }[];
  locale?: Locale;
}) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((i, k) => (
          <li key={k} className="text-sm">
            {i.url ? (
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70">
                {i.title}
              </a>
            ) : (
              <span className="text-ink">{i.title}</span>
            )}
            <span className="text-ink-muted"> · {fmtDate(i.sent_at, locale, DEFAULT_TZ)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
