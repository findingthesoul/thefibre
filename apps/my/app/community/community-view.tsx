// One community's page: the admin's introduction, what is next, the
// community's documents, and the documents the member's own threads have
// already sent them. Members only — the API answers nothing to anyone else.

import Link from 'next/link';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import type { CommunityView } from '@/lib/portal-api';
import { DEFAULT_TZ, fmtDate, fmtDateTime } from '@/lib/format';
import { CommunityDocumentList, ThreadDocumentGroup } from '../document-rows';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';

export function CommunityPage({ c, locale }: { c: CommunityView; locale: Locale }) {
  return (
    <div className="mt-6 space-y-10">
      {c.intro_html && (
        <section className="max-w-prose text-ink">
          <RichText html={c.intro_html} />
        </section>
      )}

      {/* The member's own tiers', then directory categories', sections —
          ADDED under the community's intro, named only to their holders. */}
      {[
        ...(c.tier_sections ?? []).map((x) => ({ key: x.tier_id, name: x.tier_name, html: x.intro_html })),
        ...(c.category_sections ?? []).map((x) => ({ key: x.category_id, name: x.category_name, html: x.intro_html })),
      ].map((x) => (
        <section key={x.key} className="max-w-prose text-ink">
          <h2 className={SECTION_LABEL}>{x.name}</h2>
          <div className="mt-3">
            <RichText html={x.html} />
          </div>
        </section>
      ))}

      {c.next && (
        <section>
          <h2 className={SECTION_LABEL}>{t(locale, 'nav_next')}</h2>
          <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
            <p className="text-base text-ink">{c.next.title}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {c.next.kind === 'yours'
                ? fmtDateTime(c.next.starts_at, locale, c.next.timezone || DEFAULT_TZ)
                : fmtDate(c.next.starts_at, locale, c.next.timezone || DEFAULT_TZ)}
              {c.next.thread_title ? ` · ${c.next.thread_title}` : ''}
            </p>
            {c.next.kind === 'upcoming' && (
              <Link href="/upcoming" className="mt-2 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70">
                {t(locale, 'see_under_upcoming')}
              </Link>
            )}
          </div>
        </section>
      )}

      {c.documents.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL}>{t(locale, 'documents')}</h2>
          <CommunityDocumentList workspaceId={c.workspace_id} documents={c.documents} />
        </section>
      )}

      {c.thread_documents.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL}>{t(locale, 'from_threads')}</h2>
          {c.thread_documents.map((g) => (
            <ThreadDocumentGroup key={g.thread_title} title={g.thread_title} items={g.items} locale={locale} />
          ))}
        </section>
      )}

      {!c.intro_html && !c.tier_sections?.length && !c.category_sections?.length && !c.next && !c.documents.length && !c.thread_documents.length && (
        <p className="text-sm text-ink-muted">{t(locale, 'community_empty')}</p>
      )}
    </div>
  );
}
