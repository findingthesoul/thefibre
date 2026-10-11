// Who appears on an organisation's public page, and who does not.
//
// The listing is the one genuinely new thing in the person/organisation split
// (docs/person-and-organisation-pages.md §2), and it is the one that can do
// real harm if it is got wrong: `thread_organiser` rows are created
// AUTOMATICALLY the first time an external app publishes a thread for a
// workspace, so the people in that table include some who never asked for an
// account. Listing them by default would publish a staff directory nobody
// agreed to.
//
// Hence the first case, which is the one this slice owes: never asked means
// NOT listed. It is the opposite default from `is_published` on the same
// table, and the opposite-ness is the thing a future reader is most likely to
// "fix".

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let app: Hono;
let ws = '';
let wsSlug = '';
const tag = randomUUID().slice(0, 8);

/** Three people, so each state has somebody in it. */
const PEOPLE = {
  listed: { userId: '', organiserId: '', slug: `int-people-yes-${tag}` },
  neverAsked: { userId: '', organiserId: '', slug: `int-people-null-${tag}` },
  listedButHidden: { userId: '', organiserId: '', slug: `int-people-hidden-${tag}` },
};

type Person = { slug: string; display_name: string | null; linked: boolean };

const page = async (): Promise<{ people: Person[] }> => {
  const r = await app.request(`/api/v1/thread/public/organiser/${wsSlug}`, {
    headers: { 'X-App-ID': 'the-thread' },
  });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()) as { people: Person[] };
};

async function makePerson(
  key: keyof typeof PEOPLE,
  name: string,
  listed: boolean | null,
  isPublished: boolean | null,
) {
  const p = PEOPLE[key];
  const { data: u, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: ws, email: `${p.slug}@example.com`, full_name: name })
    .select('id')
    .single();
  if (uErr) throw new Error(`user ${key}: ${uErr.message}`);
  p.userId = u!.id as string;
  const { data: o, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      workspace_id: ws,
      user_id: p.userId,
      slug: p.slug,
      display_name: name,
      listed_on_org_page: listed,
      is_published: isPublished,
    })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser ${key}: ${oErr.message}`);
  p.organiserId = o!.id as string;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('org-people');
  const { data: w, error } = await service.from('workspace').select('slug').eq('id', ws).single();
  if (error) throw new Error(`workspace slug: ${error.message}`);
  wsSlug = w!.slug as string;

  // Alphabetical names, because the order is asserted below.
  await makePerson('listed', 'Anna Listed', true, true);
  await makePerson('neverAsked', 'Bram NeverAsked', null, true);
  await makePerson('listedButHidden', 'Carla Hidden', true, false);
}, 90_000);

afterAll(async () => {
  for (const p of Object.values(PEOPLE)) {
    if (p.organiserId) await service.from('thread_organiser').delete().eq('id', p.organiserId);
    if (p.userId) await service.from('user').delete().eq('id', p.userId);
  }
  await deleteThrowawayWorkspace(ws);
}, 90_000);

describe('the people on an organisation page', () => {
  // THE case the slice owes.
  it('never asked means NOT listed', async () => {
    const { people } = await page();
    const slugs = people.map((p) => p.slug);
    expect(slugs, JSON.stringify(people)).not.toContain(PEOPLE.neverAsked.slug);
  });

  it('lists the person who said yes', async () => {
    const { people } = await page();
    const anna = people.find((p) => p.slug === PEOPLE.listed.slug);
    expect(anna, `looked for ${PEOPLE.listed.slug} in ${JSON.stringify(people)}`).toBeTruthy();
    expect(anna!.display_name).toBe('Anna Listed');
  });

  // Q2: listed, but their own page is off. They appear, and they are NOT a
  // link — a link to a deliberate 404 is worse than no link. Two separate
  // assertions, because "absent" would also satisfy a careless "not linked".
  it('somebody with their own page switched off is listed but not linked', async () => {
    const { people } = await page();
    const carla = people.find((p) => p.slug === PEOPLE.listedButHidden.slug);
    expect(carla, `expected ${PEOPLE.listedButHidden.slug} to be listed`).toBeTruthy();
    expect(carla!.linked, 'must not link to a page that 404s').toBe(false);
  });

  it('links to somebody whose page is on', async () => {
    const { people } = await page();
    expect(people.find((p) => p.slug === PEOPLE.listed.slug)!.linked).toBe(true);
  });

  // The flags are what the listing is ABOUT; publishing them would leak who
  // declined, which is the opposite of asking.
  it('never exposes either flag', async () => {
    const body = JSON.stringify(await page());
    expect(body.includes('listed_on_org_page')).toBe(false);
    expect(body.includes('is_published')).toBe(false);
  });

  it('is ordered by name, not by whoever was created first', async () => {
    const { people } = await page();
    const names = people.map((p) => p.display_name ?? '');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  // A PERSON's page is the person speaking. Listing their colleagues there is
  // exactly the confusion the whole split exists to undo.
  it('a person’s own page carries no people at all', async () => {
    const r = await app.request(`/api/v1/thread/public/organiser/${PEOPLE.listed.slug}`, {
      headers: { 'X-App-ID': 'the-thread' },
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { owner_kind: string; people: Person[] };
    expect(body.owner_kind).toBe('organiser');
    expect(body.people).toEqual([]);
  });
});
