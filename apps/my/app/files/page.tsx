// FILES (Sjoerd 2ij): every document this person may open, in one place —
// per community, its own documents first, then what each of their threads
// has released to them. The API decides what is admitted, by the same
// readers as the community page; this only lays it out.

import { SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { loadFrame } from '@/lib/session';
import { fetchFiles, type FilesGroup } from '@/lib/portal-api';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { CommunityDocumentList, ThreadDocumentGroup } from '../document-rows';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const locale = await pageLocale();
  let groups: FilesGroup[] | null = null;
  try {
    groups = await fetchFiles(session.token);
  } catch (e) {
    console.error('[my] /me/portal/files failed', e);
  }
  if (!groups) {
    return (
      <PageShell title={t(locale, 'nav_files')}>
        <Empty title={t(locale, 'page_failed')}>{t(locale, 'try_again_moment')}</Empty>
      </PageShell>
    );
  }
  return (
    <PageShell title={t(locale, 'nav_files')}>
      {groups.length === 0 ? (
        <Empty title={t(locale, 'files_none_title')}>{t(locale, 'files_none_body')}</Empty>
      ) : (
        <div className="mt-6 space-y-10">
          {groups.map((g) => (
            <section key={g.workspace_id} aria-labelledby={`files-${g.workspace_id}`}>
              {/* With one community the heading still names it: the page is
                  about where each file comes from. */}
              <h2 id={`files-${g.workspace_id}`} className="text-base font-medium text-ink">
                {g.name}
              </h2>
              {g.community.length > 0 && (
                <div className="mt-4">
                  <h3 className={SECTION_LABEL}>{t(locale, 'from_community')}</h3>
                  <CommunityDocumentList workspaceId={g.workspace_id} documents={g.community} />
                </div>
              )}
              {g.threads.length > 0 && (
                <div className="mt-6">
                  <h3 className={SECTION_LABEL}>{t(locale, 'from_threads')}</h3>
                  {g.threads.map((th) => (
                    <ThreadDocumentGroup key={th.thread_id} title={th.thread_title} items={th.items} locale={locale} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
