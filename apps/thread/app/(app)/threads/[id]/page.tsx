import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  type ThreadRow,
  type EngagementRow,
  type ThreadMember,
  type WorkspaceMember,
  type TeamOption,
} from '@/lib/thread-types';
import { uiLocale } from '@/lib/locale';
import { ThreadTimeline } from './timeline';

type ThreadDetail = ThreadRow & {
  engagements: EngagementRow[];
  co_organisers: ThreadMember[];
};

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await uiLocale();
  const { id } = await params;

  let thread: ThreadDetail;
  try {
    thread = await apiFetch<ThreadDetail>(`/api/v1/thread/threads/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [members, teams, certTemplates, me, categories, brand, library] = await Promise.all([
    apiFetch<{ items: WorkspaceMember[] }>('/api/v1/thread/workspace-members').catch(() => ({
      items: [],
    })),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
    apiFetch<{ items: { id: string; name: string; archived_at: string | null }[] }>(
      '/api/v1/thread/certificate-templates',
    ).catch(() => ({ items: [] })),
    apiFetch<{ personal_room_url: string | null }>('/api/v1/thread/me').catch(() => ({
      personal_room_url: null,
    })),
  
    apiFetch<{ items: { id: string; name: string; slug: string }[] }>(
      '/api/v1/thread/categories',
    ).catch(() => ({ items: [] as { id: string; name: string; slug: string }[] })),
    // Registration tab: the inherited enrolment note. Basics tab: the
    // workspace's public slug — the URL prefix for workspace-scoped threads
    // (docs/brief-workspace-urls.md D1).
    apiFetch<{ enrolment_note: string | null; slug: string | null }>(
      '/api/v1/workspace-brand',
    ).catch(() => ({
      enrolment_note: null,
      slug: null,
    })),
    // Structure gating: whether this plan may add/remove timeline elements
    // (thread_custom_templates). Fail open — the API still enforces it.
    apiFetch<{ can_edit_structure: boolean }>('/api/v1/thread/template-library').catch(() => ({
      can_edit_structure: true,
    })),
  ]);

  // v3 layout: a single centred column, the thread as the main item, the
  // engagements immediately under it. No tabs.
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <ThreadTimeline
        locale={locale}
        categories={categories.items}
        thread={thread}
        engagements={thread.engagements}
        members={thread.co_organisers}
        workspaceMembers={members.items}
        teams={teams.items}
        // Archived templates stay resolvable for threads already pointing at
        // them but disappear from the picker.
        certTemplates={certTemplates.items.filter((t) => !t.archived_at)}
        personalRoomUrl={me.personal_room_url}
        workspaceNote={brand.enrolment_note}
        workspaceSlug={brand.slug}
        canEditStructure={library.can_edit_structure}
      />
    </div>
  );
}
