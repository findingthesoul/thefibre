// Tags: the vocabulary a workspace writes with, and what it has connected.
//
// Sjoerd, 2026-09-12: *"if you type something after a visit or conversation,
// that it would integrate tags in the text... which connects things (without
// you having to do it)"* and *"e.g. company names are tags (if they exist; if
// not you can create it)"*.
//
// `tag` and `person_tag` were modelled in the first migration and read by
// nothing but the Article 15 export until now. connections-model.md §3.5
// settled years ago that user-defined characteristics ARE tags rather than
// custom fields; this is the first surface that uses them.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsTagsRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const connectionsTagsRoutes = new Hono();

/**
 * Everything the composer needs to recognise a word, in one call.
 *
 * Sent to the browser and held there for the length of a note, because
 * detection has to run on every keystroke and a round trip per keystroke is
 * both slow and a way to leak a half-typed sentence to the server.
 *
 * WHY THAT IS ACCEPTABLE, stated carefully because the obvious version of
 * this sentence is wrong. It is NOT that organisation names are not personal
 * data: a sole trader is a person with a business name, and "Jan de Vries
 * Coaching" identifies a natural person as directly as their name does. There
 * is nothing in the row that distinguishes that case from "EBBF", and there
 * never will be.
 *
 * The defensible reason is the recipient. This payload goes to a signed-in
 * workspace member who can already read every one of these rows through the
 * ordinary interface, so it discloses nothing they did not already have. That
 * holds for the sole trader too, which is what makes it the right test.
 *
 * Person names are still deliberately absent, for a different reason:
 * matching bare names is where false positives live (see lib/detect-tags.ts),
 * and a feature that would need them is a feature that should not exist.
 */
connectionsTagsRoutes.get('/vocabulary', async (c) => {
  const ctx = c.get('ctx');

  const [{ data: tags, error: tErr }, { data: orgs, error: oErr }] = await Promise.all([
    adminClient
      .from('tag')
      .select('id,name,organisation_id')
      .eq('workspace_id', ctx.workspaceId)
      .limit(2000),
    adminClient
      .from('organisation')
      .select('id,name')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .limit(2000),
  ]);
  if (tErr || oErr) return c.json({ error: (tErr ?? oErr)!.message }, 500);

  // An organisation that already has a tag appears once, as that tag, so the
  // composer cannot offer to create a second tag for a company it already
  // knows — which would split its people into two groups that look unrelated.
  const taggedOrgs = new Set(
    (tags ?? []).map((t) => t.organisation_id as string | null).filter(Boolean) as string[],
  );

  const words = [
    ...(tags ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      ...(t.organisation_id ? { organisation_id: t.organisation_id as string } : {}),
    })),
    ...(orgs ?? [])
      .filter((o) => !taggedOrgs.has(o.id as string))
      .map((o) => ({ name: o.name as string, organisation_id: o.id as string })),
  ];

  return c.json({ words });
});

/**
 * Who carries one tag.
 *
 * Ids only. The people list already knows how to render a person from its own
 * read, so returning names here would be a second source for the same fact
 * and a second place for it to go stale.
 */
connectionsTagsRoutes.get('/tags/:id/people', async (c) => {
  const ctx = c.get('ctx');
  const tagId = c.req.param('id');

  // The tag must belong to this workspace. Checked rather than assumed: this
  // runs on the service client, so RLS is not filtering, and without the check
  // a guessed uuid would read another tenant's membership.
  const { data: tag } = await adminClient
    .from('tag')
    .select('id')
    .eq('id', tagId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!tag) return c.json({ error: 'not found' }, 404);

  const { data, error } = await adminClient
    .from('person_tag')
    .select('person_id')
    .eq('tag_id', tagId)
    .limit(5000);
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ person_ids: [...new Set((data ?? []).map((r) => r.person_id as string))] });
});

const ListQuery = z.object({
  /** Tags used by nobody are noise on a list meant to show what connects. */
  min_people: z.coerce.number().int().min(0).max(1000).default(1),
});

/**
 * The tags this workspace actually uses, with how many people carry each.
 *
 * The count is the whole point rather than a decoration. connections-model.md
 * §3.5's rarity rule says a tag on three people is a strong link and a tag on
 * three hundred is not a link at all — so a surface drawing connections has
 * to see the size to know the weight, and a list sorted by it shows a person
 * their own vocabulary in the order it matters.
 */
connectionsTagsRoutes.get('/tags', async (c) => {
  const ctx = c.get('ctx');
  const parsed = ListQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'invalid query' }, 400);

  const { data: tags, error } = await adminClient
    .from('tag')
    .select('id,name,color,organisation_id')
    .eq('workspace_id', ctx.workspaceId)
    .limit(2000);
  if (error) return c.json({ error: error.message }, 500);
  if (!tags?.length) return c.json({ tags: [] });

  // One read of the join table rather than a count per tag: a workspace with
  // four hundred tags would otherwise make four hundred round trips to render
  // one page. Counted in memory, which is fine at this size and honest about
  // its ceiling — the limit above is the ceiling.
  const { data: links, error: lErr } = await adminClient
    .from('person_tag')
    .select('tag_id,person_id,created_via')
    .in(
      'tag_id',
      tags.map((t) => t.id as string),
    )
    .limit(20000);
  if (lErr) return c.json({ error: lErr.message }, 500);

  const people = new Map<string, Set<string>>();
  const fromNotes = new Map<string, number>();
  for (const l of links ?? []) {
    const tid = l.tag_id as string;
    (people.get(tid) ?? people.set(tid, new Set()).get(tid)!).add(l.person_id as string);
    if (l.created_via === 'note') fromNotes.set(tid, (fromNotes.get(tid) ?? 0) + 1);
  }

  const out = tags
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      color: (t.color as string | null) ?? null,
      organisation_id: (t.organisation_id as string | null) ?? null,
      people: people.get(t.id as string)?.size ?? 0,
      // How many of those arrived from a sentence rather than by hand. Shown
      // so somebody can tell a vocabulary that grew itself from one that was
      // curated, which are different things to trust differently.
      from_notes: fromNotes.get(t.id as string) ?? 0,
    }))
    .filter((t) => t.people >= parsed.data.min_people)
    .sort((a, b) => b.people - a.people || a.name.localeCompare(b.name));

  return c.json({ tags: out });
});
