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

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  let groups: FilesGroup[] | null = null;
  try {
    groups = await fetchFiles(session.token);
  } catch (e) {
    console.error('[my] /me/portal/files failed', e);
  }
  if (!groups) {
    return (
      <PageShell title="Files">
        <Empty title="This page could not be loaded.">Try again in a moment.</Empty>
      </PageShell>
    );
  }
  return (
    <PageShell title="Files">
      {groups.length === 0 ? (
        <Empty title="No files yet.">
          Documents from your communities, and the ones your threads send you, are gathered here.
        </Empty>
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
                  <h3 className={SECTION_LABEL}>From your community</h3>
                  <CommunityDocumentList workspaceId={g.workspace_id} documents={g.community} />
                </div>
              )}
              {g.threads.length > 0 && (
                <div className="mt-6">
                  <h3 className={SECTION_LABEL}>From your threads</h3>
                  {g.threads.map((t) => (
                    <ThreadDocumentGroup key={t.thread_id} title={t.thread_title} items={t.items} />
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
