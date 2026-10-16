// The Files page (Sjoerd 2ij) — against staging, through filesFor itself.
// It has no rule of its own, so this checks it admits exactly what the
// existing readers admit:
//   · a member sees the community's documents for the tiers they hold;
//   · somebody with a live place and no membership sees only what the thread
//     has RELEASED to them (week 1, not week 3), and no community group;
//   · a released step whose link is javascript: is left out;
//   · a dropped place shows nothing; a lapsed member loses the community;
//   · a stranger gets an empty list.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let page: typeof import('../lib/member-page.js');
let files: typeof import('../lib/portal-files.js');
let ws = '';
const tag = randomUUID().slice(0, 6);
const memberEmail = `pf-member-${tag}@example.com`;
const placeEmail = `pf-place-${tag}@example.com`;
const droppedEmail = `pf-dropped-${tag}@example.com`;
const strangerEmail = `pf-stranger-${tag}@example.com`;
let memberId = '';
let tierA = '';
let tierB = '';
let placeEnrolment = '';
let droppedEnrolment = '';
let threadId = '';
let placePersonId = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

beforeAll(async () => {
  page = await import('../lib/member-page.js');
  files = await import('../lib/portal-files.js');
  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('portalfiles');
  tierA = await insert('membership_tier', { workspace_id: ws, name: 'Singer' });
  tierB = await insert('membership_tier', { workspace_id: ws, name: 'Board' });
  const memberPerson = await insert('person', { workspace_id: ws, first_name: 'M', email: memberEmail });
  memberId = await insert('membership_member', { workspace_id: ws, person_id: memberPerson, tier_id: tierA, status: 'active', renews_at: '2099-01-01T00:00:00Z' });
  const placePerson = await insert('person', { workspace_id: ws, first_name: 'P', email: placeEmail });
  const droppedPerson = await insert('person', { workspace_id: ws, first_name: 'D', email: droppedEmail });

  // The community page: one for everyone, one for the board.
  await page.addLink(ws, 'https://example.com/handbook', 'Handbook');
  const board = (await page.addLink(ws, 'https://example.com/minutes', 'Board minutes')) as { id: string };
  await page.setDocumentTiers(ws, board.id, [tierB]);

  // A thread with three document steps; week 1 and the unsafe one released.
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Journey', format: 'journey', status: 'active' });
  const user = await insert('user', { workspace_id: ws, email: `pf-org-${tag}@example.com` });
  const organiser = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: `pf-org-${tag}` });
  const thread = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: organiser, slug: `pf-${tag}` });
  threadId = thread;
  placePersonId = placePerson;
  placeEnrolment = await insert('enrolment', { program_id: program, person_id: placePerson, status: 'enrolled' });
  droppedEnrolment = await insert('enrolment', { program_id: program, person_id: droppedPerson, status: 'dropped' });
  await insert('thread_enrolment', { workspace_id: ws, thread_id: thread, enrolment_id: placeEnrolment, person_id: placePerson, request_id: `pf-${randomUUID()}` });
  await insert('thread_enrolment', { workspace_id: ws, thread_id: thread, enrolment_id: droppedEnrolment, person_id: droppedPerson, request_id: `pf-${randomUUID()}` });
  const week1 = await insert('thread_engagement', { workspace_id: ws, thread_id: thread, title: 'Week 1 reading', type: 'document', status: 'published', position: 1, content: { external_url: 'https://example.com/w1.pdf' } });
  await insert('thread_engagement', { workspace_id: ws, thread_id: thread, title: 'Week 3 reading', type: 'document', status: 'published', position: 3, content: { external_url: 'https://example.com/w3.pdf' } });
  const unsafe = await insert('thread_engagement', { workspace_id: ws, thread_id: thread, title: 'Unsafe', type: 'document', status: 'published', position: 2, content: { external_url: 'javascript:alert(1)' } });
  for (const [eng, person, email] of [
    [week1, placePerson, placeEmail],
    [unsafe, placePerson, placeEmail],
    [week1, droppedPerson, droppedEmail],
  ] as const) {
    await insert('thread_message_send', { engagement_id: eng, person_id: person, email });
  }
}, 120_000);

afterAll(async () => {
  await service.from('membership_settings').delete().eq('workspace_id', ws);
  const { data: tes } = await service.from('thread_enrolment').select('id').eq('workspace_id', ws);
  if (tes?.length) await service.from('thread_enrolment').delete().in('id', tes.map((t) => t.id));
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
  // Read back: the throwaway workspace and its people are gone.
  const { count } = await service.from('person').select('id', { count: 'exact', head: true }).like('email', `pf-%-${tag}@example.com`);
  expect(count).toBe(0);
}, 120_000);

const mineIn = async (email: string) => (await files.filesFor(email)).find((g) => g.workspace_id === ws);

describe('the Files page admits what the existing readers admit', () => {
  it('a member: the community documents for their tier, nothing for the board', async () => {
    const g = await mineIn(memberEmail);
    expect(g?.community.map((d) => d.title)).toEqual(['Handbook']);
    expect(g?.threads).toEqual([]);
  });

  it('a live place, no membership: only what the thread has released, safe links only', async () => {
    const g = await mineIn(placeEmail);
    expect(g, 'the workspace appears for its threads').toBeTruthy();
    expect(g!.community).toEqual([]);
    expect(g!.threads).toHaveLength(1);
    expect(g!.threads[0]!.thread_title).toBe('Journey');
    expect(g!.threads[0]!.items.map((i) => i.title)).toEqual(['Week 1 reading']);
    expect(JSON.stringify(g)).not.toContain('javascript:');
  });

  it('a dropped place shows nothing', async () => {
    expect(await mineIn(droppedEmail)).toBeUndefined();
  });

  it('a lapsed member loses the community group', async () => {
    await service.from('membership_member').update({ status: 'lapsed' }).eq('id', memberId);
    try {
      expect(await mineIn(memberEmail)).toBeUndefined();
    } finally {
      await service.from('membership_member').update({ status: 'active' }).eq('id', memberId);
    }
  });

  it('a stranger gets an empty list', async () => {
    expect(await files.filesFor(strangerEmail)).toEqual([]);
  });

  it('the community page reads the same released steps (one reader, two callers)', async () => {
    const { data: m } = await service.from('membership_member').select('id, person_id').eq('id', memberId).single();
    // The member holds no place, so their community page has no thread documents …
    const view = await page.communityView({ workspace_id: ws, person_id: m!.person_id as string, member_id: memberId });
    expect(view.thread_documents).toEqual([]);
    // … and the released reader, asked directly for the place holder, agrees with Files.
    const { data: placePerson } = await service.from('person').select('id').eq('email', placeEmail).single();
    const { live } = await page.threadPlaces([placePerson!.id as string]);
    const released = await page.releasedThreadDocuments([placePerson!.id as string], live);
    expect(released[0]!.items.map((i) => [i.title, i.url])).toEqual([
      ['Week 1 reading', 'https://example.com/w1.pdf'],
      ['Unsafe', null],
    ]);
  });

  it('the my.thread SCHEDULE waits too: week 1 has its link, week 3 shows title only until released', async () => {
    const { loadAgendaByThread } = await import('../lib/portal-agenda.js');
    const { buildFeedForEmail } = await import('../lib/calendar-feed.js');
    // The calendar FEED reads the same list but only dated items — so the
    // steps get dates, or the feed check below would pass on an empty feed.
    const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
    await service.from('thread_engagement').update({ starts_at: day(7) }).eq('thread_id', threadId).eq('title', 'Week 1 reading');
    await service.from('thread_engagement').update({ starts_at: day(21) }).eq('thread_id', threadId).eq('title', 'Week 3 reading');
    const unfold = (ics: string) => ics.replace(/\r?\n[ \t]/g, '');
    const feedBefore = unfold(await buildFeedForEmail(placeEmail));
    expect(feedBefore, 'the feed lists both steps — not an empty pass').toContain('SUMMARY:Week 3 reading');
    expect(feedBefore).toContain('SUMMARY:Week 1 reading');
    expect(feedBefore).toContain('https://example.com/w1.pdf');
    // Held back: no URL property and no description line carries it.
    expect(feedBefore).not.toContain('w3.pdf');
    const items = (await loadAgendaByThread({ threadIds: [threadId], personIds: [placePersonId], droppedThreads: new Set() })).get(threadId) ?? [];
    const by = new Map(items.map((i) => [i.title, i]));
    expect(by.get('Week 1 reading')?.external_url).toBe('https://example.com/w1.pdf');
    // Still on the schedule, with its title — but no link before release.
    expect(by.has('Week 3 reading')).toBe(true);
    expect(by.get('Week 3 reading')?.external_url).toBeNull();

    // Released now → the link appears.
    const { data: w3 } = await service.from('thread_engagement').select('id').eq('thread_id', threadId).eq('title', 'Week 3 reading').single();
    await insert('thread_message_send', { engagement_id: w3!.id, person_id: placePersonId, email: placeEmail });
    const after = (await loadAgendaByThread({ threadIds: [threadId], personIds: [placePersonId], droppedThreads: new Set() })).get(threadId) ?? [];
    expect(after.find((i) => i.title === 'Week 3 reading')?.external_url).toBe('https://example.com/w3.pdf');
    expect(unfold(await buildFeedForEmail(placeEmail)), 'released → the feed carries it too').toContain('https://example.com/w3.pdf');

    // The organiser's own view reads the step whole — the content is untouched.
    const { data: row } = await service.from('thread_engagement').select('content').eq('id', w3!.id).single();
    expect((row!.content as { external_url?: string }).external_url).toBe('https://example.com/w3.pdf');
  });
});

