// The community page (item 4) — against staging. Needs migration
// 20261014171844_member_page_and_held_threads (the member_page column and the
// private member-documents bucket).
//
// The promises:
//   · only an active or grace member gets a document, and only through a
//     signed address that expires (a non-member gets nothing at all);
//   · the type is read from the bytes — a script renamed .pdf is refused;
//   · a photo is stored WITHOUT its EXIF;
//   · removing a document deletes the stored file, not only the entry;
//   · a thread's document step appears only once the thread's own triggers
//     have released it to that member (a thread_message_send row).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let page: typeof import('../lib/member-page.js');
let ws = '';
let threadAppId = '';
const memberEmail = `mp-member-${randomUUID().slice(0, 6)}@example.com`;
const strangerEmail = `mp-stranger-${randomUUID().slice(0, 6)}@example.com`;
let memberPerson = '';
let memberId = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
/** A tiny JPEG carrying an EXIF block with a GPS-like marker. */
const jpegWithExif = () => {
  const exif = ascii('Exif\0\0GPS52.37N');
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, exif.length + 2, ...exif,
    0xff, 0xdb, 0x00, 0x04, 0x01, 0x02,
    0xff, 0xda, 0x00, 0x04, 0x09, 0x09, 0xaa, 0xbb, 0xff, 0xd9,
  ]);
};

beforeAll(async () => {
  page = await import('../lib/member-page.js');
  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('memberpage');
  memberPerson = await insert('person', { workspace_id: ws, first_name: 'M', email: memberEmail });
  await insert('person', { workspace_id: ws, first_name: 'S', email: strangerEmail });
  const tier = await insert('membership_tier', { workspace_id: ws, name: 'Member page tier' });
  memberId = await insert('membership_member', {
    workspace_id: ws,
    person_id: memberPerson,
    tier_id: tier,
    status: 'active',
    renews_at: '2099-01-01T00:00:00Z',
  });
}, 120_000);

afterAll(async () => {
  const p = await page.readMemberPage(ws).catch(() => ({ documents: [] as { path?: string }[] }));
  const paths = p.documents.map((d) => ('path' in d ? d.path : undefined)).filter((x): x is string => !!x);
  if (paths.length) await service.storage.from('member-documents').remove(paths);
  await service.from('membership_settings').delete().eq('workspace_id', ws);
  const { data: tes } = await service.from('thread_enrolment').select('id').eq('workspace_id', ws);
  if (tes?.length) await service.from('thread_enrolment').delete().in('id', tes.map((t) => t.id));
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('documents', () => {
  let photoId = '';

  it('a photo is stored WITHOUT its EXIF, typed from its bytes', async () => {
    const doc = await page.addDocument(ws, { name: 'flyer.png', bytes: jpegWithExif() }, 'Flyer');
    expect(typeof doc).toBe('object');
    const d = doc as Exclude<typeof doc, string>;
    photoId = d.id;
    // The name said .png; the bytes say JPEG, and the bytes win.
    expect(d.mime).toBe('image/jpeg');
    const { data: blob } = await service.storage.from('member-documents').download(d.path);
    const stored = String.fromCharCode(...new Uint8Array(await blob!.arrayBuffer()));
    expect(stored).not.toContain('GPS');
  });

  it('a script renamed .pdf is refused', async () => {
    expect(await page.addDocument(ws, { name: 'notes.pdf', bytes: Uint8Array.from(ascii('<script>x</script>')) }, null)).toBe('not_allowed');
  });

  it('a member gets a signed address that expires; a non-member gets nothing', async () => {
    const url = await page.signedDocumentUrl(memberEmail, ws, photoId);
    expect(url).toMatch(/\/object\/sign\/member-documents\/.+token=/);
    expect(await page.signedDocumentUrl(strangerEmail, ws, photoId)).toBeNull();
    // The bucket itself is private: the public address answers nothing.
    const { data } = service.storage.from('member-documents').getPublicUrl(`${ws}/whatever.jpg`);
    expect((await fetch(data.publicUrl)).status).toBeGreaterThanOrEqual(400);
  });

  it('a lapsed member gets nothing either', async () => {
    await service.from('membership_member').update({ status: 'lapsed' }).eq('id', memberId);
    try {
      expect(await page.signedDocumentUrl(memberEmail, ws, photoId)).toBeNull();
    } finally {
      await service.from('membership_member').update({ status: 'active' }).eq('id', memberId);
    }
  });

  it('removing it deletes the stored file, not only the entry', async () => {
    const before = (await page.readMemberPage(ws)).documents.find((d) => d.id === photoId)!;
    expect(await page.removeDocument(ws, photoId)).toBe(true);
    const { data, error } = await service.storage.from('member-documents').download(before.path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect((await page.readMemberPage(ws)).documents).toEqual([]);
  });
});

describe('link entries', () => {
  it('a link is stored as title + address and reaches the member as a link', async () => {
    const r = await page.addLink(ws, 'https://docs.google.com/document/d/abc/edit', 'Rehearsal notes');
    expect(typeof r).toBe('object');
    const link = r as Exclude<typeof r, string>;
    expect(link).toMatchObject({ kind: 'link', title: 'Rehearsal notes', url: 'https://docs.google.com/document/d/abc/edit' });
    // The member's view carries the address; the signed route has nothing to sign.
    const view = await page.communityView({ workspace_id: ws, person_id: memberPerson, member_id: memberId });
    expect(view.documents.find((d) => d.id === link.id)).toEqual({ id: link.id, title: 'Rehearsal notes', kind: 'link', url: link.url });
    expect(await page.signedDocumentUrl(memberEmail, ws, link.id)).toBeNull();
    // It drags into the same order as the files, and removes without a file.
    expect(await page.removeDocument(ws, link.id)).toBe(true);
    expect((await page.readMemberPage(ws)).documents.some((d) => d.id === link.id)).toBe(false);
  });

  it('refuses javascript:, data: and non-addresses — nothing is stored', async () => {
    for (const bad of ['javascript:alert(document.cookie)', 'data:text/html,<script>1</script>', 'not a url']) {
      expect(await page.addLink(ws, bad, 'x')).toBe('bad_url');
    }
    expect((await page.readMemberPage(ws)).documents.filter((d) => d.kind === 'link')).toEqual([]);
  });
});

describe('tags in the introduction', () => {
  it('are filled per member, escaped, at read time; an unknown tag stays as typed', async () => {
    await page.saveIntro(ws, '<p>Hi {first_name} {last_name}, welcome to {community} as {tier}. {frist_name}</p>');
    // Stored as typed: the tags are filled when READ, per member.
    expect((await page.readMemberPage(ws)).intro_html).toContain('{first_name}');

    // A member whose name is markup.
    await service.from('person').update({ first_name: '<script>alert(1)</script>', last_name: null }).eq('id', memberPerson);
    try {
      const view = await page.communityView({ workspace_id: ws, person_id: memberPerson, member_id: memberId });
      const { data: w } = await service.from('workspace').select('name').eq('id', ws).single();
      expect(view.intro_html).not.toContain('<script>');
      expect(view.intro_html).toContain('Hi &lt;script&gt;alert(1)&lt;/script&gt; , welcome to');
      expect(view.intro_html).toContain(`welcome to ${w!.name} as Member page tier.`);
      expect(view.intro_html).toContain('{frist_name}');
      expect(view.intro_html).not.toContain('{last_name}');
    } finally {
      await service.from('person').update({ first_name: 'M' }).eq('id', memberPerson);
      await page.saveIntro(ws, null);
    }
  });
});

describe("a thread's document steps", () => {
  it('appear only once released to that member by the thread itself', async () => {
    const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Journey', format: 'journey', status: 'active' });
    const user = await insert('user', { workspace_id: ws, email: `mp-org-${randomUUID().slice(0, 6)}@example.com` });
    const organiser = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: `mp-org-${randomUUID().slice(0, 6)}` });
    const thread = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: organiser, slug: `mp-${randomUUID().slice(0, 6)}` });
    const enr = await insert('enrolment', { program_id: program, person_id: memberPerson, status: 'enrolled' });
    await insert('thread_enrolment', { workspace_id: ws, thread_id: thread, enrolment_id: enr, person_id: memberPerson, request_id: `mp-${randomUUID()}` });
    const week1 = await insert('thread_engagement', { workspace_id: ws, thread_id: thread, title: 'Week 1 reading', type: 'document', status: 'published', content: { external_url: 'https://example.com/w1.pdf' } });
    await insert('thread_engagement', { workspace_id: ws, thread_id: thread, title: 'Week 3 reading', type: 'document', status: 'published', content: { external_url: 'https://example.com/w3.pdf' } });
    // The thread's own trigger delivered week 1, and only week 1.
    await insert('thread_message_send', { engagement_id: week1, person_id: memberPerson, email: memberEmail });

    const view = await page.communityView({ workspace_id: ws, person_id: memberPerson, member_id: memberId });
    const titles = view.thread_documents.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(['Week 1 reading']);
  });
});
