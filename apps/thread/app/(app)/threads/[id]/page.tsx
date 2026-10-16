import { loadTogether } from '@/lib/load-together';
import { HandoverPanel } from './handover-panel';
import type { HandoverItem } from '../actions';
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
import { CalendarTray } from './calendar-tray';

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

  // The thread and the eight side loads start TOGETHER. None of the eight
  // needs the thread, and awaiting it first made the page's server time the
  // SUM of the two (measured 1.7–2.6s on staging, 2026-10-14) instead of the
  // slower of them. The thread's own outcome is still decided first: a 404
  // is still notFound() and any other failure still throws, exactly as
  // before — the side loads' results are simply never used then.
  const threadP = apiFetch<ThreadDetail>(`/api/v1/thread/threads/${id}`);

  const sideP = Promise.all([
    apiFetch<{ items: WorkspaceMember[] }>('/api/v1/thread/workspace-members').catch(() => ({
      items: [],
    })),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
    apiFetch<{ items: { id: string; name: string; archived_at: string | null }[] }>(
      '/api/v1/thread/certificate-templates',
    ).catch(() => ({ items: [] })),
    apiFetch<{
      personal_room_url: string | null;
      google_connected?: boolean;
      zoom_available?: boolean;
      user_id?: string;
    }>('/api/v1/thread/me').catch(() => ({
      personal_room_url: null,
      google_connected: false,
      zoom_available: false,
      user_id: undefined as string | undefined,
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
    // The thread's shared to-do list: the header badge, and whether the plan
    // has the feature at all.
    //
    // Availability is DERIVED from this call rather than asked for
    // separately — a 402 is the API's own gate answering, so the button
    // cannot disagree with the route behind it. Any other failure leaves the
    // feature available and the badge at 0: a network blip should not make
    // the button vanish.
    apiFetch<{ open_count: number }>(`/api/v1/thread/threads/${id}/tasks`)
      .then((r) => ({ open_count: r.open_count, available: true }))
      .catch((e) => ({
        open_count: 0,
        available: !(e instanceof ApiError && e.status === 402),
      })),
    // Organiser handover requests (docs/organiser-handover-design.md): the
    // panel shows this thread's pending one. A failure shows none.
    apiFetch<{ items: HandoverItem[] }>('/api/v1/thread/handovers').catch(() => ({ items: [] as HandoverItem[] })),
  ]);

  const [thread, [members, teams, certTemplates, me, categories, brand, library, tasks, handovers]] = await loadTogether(
    threadP,
    sideP,
    (e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    },
  );

  // v3 layout: a single centred column, the thread as the main item, the
  // engagements immediately under it. No tabs.
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Above the thread, because it is about what has already happened to it
          — and because a bar under a long timeline is a bar nobody scrolls to.
          It renders nothing when nothing is owed. */}
      <CalendarTray threadId={thread.id} />
      <HandoverPanel
        locale={locale}
        threadId={thread.id}
        organiserUserId={(Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser)?.user_id ?? null}
        meUserId={me.user_id ?? null}
        isAdmin={['admin', 'super_admin'].includes(
          members.items.find((m) => m.user_id === me.user_id)?.workspace_role ?? '',
        )}
        workspaceMembers={members.items}
        pending={handovers.items.find((h) => h.thread_id === thread.id && h.status === 'pending') ?? null}
      />
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
        // The MAIN FACILITATOR's room (the organiser's when none is named),
        // decided by the API — not the room of whoever has the editor open.
        // An older API without meeting_room falls back to the old reading.
        personalRoomUrl={thread.meeting_room ? thread.meeting_room.url : me.personal_room_url}
        meetingRoom={thread.meeting_room ?? null}
        googleConnected={me.google_connected ?? false}
        zoomAvailable={me.zoom_available ?? false}
        workspaceNote={brand.enrolment_note}
        workspaceSlug={brand.slug}
        canEditStructure={library.can_edit_structure}
        openTaskCount={tasks.open_count}
        todoAvailable={tasks.available}
      />
    </div>
  );
}
