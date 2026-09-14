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
import { findDoubles, findStale, findUnused, mentions, type TagFacts } from '../lib/tag-cleaning.js';

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
 * People ARE in this payload, under their own key, and were deliberately not
 * until `@` existed. The distinction is the one that governs this whole area:
 * `detectTags` must never see them, because matching a name in prose is a
 * guess that lands a claim on a real person's record. `@` is somebody typing
 * a marker and choosing from a list — intent, not inference — so the names
 * have to be here for the picker to work, in a SEPARATE array the automatic
 * matcher cannot reach.
 */
connectionsTagsRoutes.get('/vocabulary', async (c) => {
  const ctx = c.get('ctx');

  const [{ data: tags, error: tErr }, { data: orgs, error: oErr }, { data: people }] =
    await Promise.all([
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
      adminClient
        .from('person')
        .select('id,first_name,last_name,email')
        .eq('workspace_id', ctx.workspaceId)
        .is('deleted_at', null)
        .is('merged_into', null)
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

  // A separate key, never merged into `words`. The shape is the guarantee:
  // detectTags takes `words` and has no parameter that could receive these.
  const mentionable = (people ?? [])
    .map((p) => ({
      id: p.id as string,
      name:
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        ((p.email as string | null) ?? ''),
    }))
    // A person with no name and no address cannot be typed after an @, so
    // shipping them would only make the payload bigger.
    .filter((p) => p.name.length > 0);

  return c.json({ words, people: mentionable });
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

// ── Tag cleaning ─────────────────────────────────────────────────────────────
//
// Sjoerd, 2026-09-14: *"there should be tag cleaning. Look for doubles...
// look for ones that have not been used for a long time... present a list for
// cleaning once in a while."* The rules are in lib/tag-cleaning.ts; these
// routes read the rows and apply what a person decided.
//
// Changing the vocabulary changes it for everybody in the workspace, so the
// three writes are for workspace admins — the same bar as renaming the steps.

const STALE_DAYS = 180;

async function isWorkspaceAdmin(ctx: { auth: string; userId: string; workspaceId: string }): Promise<boolean> {
  if (ctx.auth !== 'user') return false;
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

/**
 * What wants tidying: probable doubles, tags on nobody, and tags not used in
 * six months. `count` alone is what Today's once-in-a-while nudge reads.
 *
 * "Used" is the later of somebody being tagged and a note in the period
 * mentioning the word. The second matters: a tag already on a person is not
 * re-dated when a new note mentions it again (the link is ignore-on-conflict),
 * so link dates alone would call a word used every week stale. The note bodies
 * are read here, in memory, only to answer yes/no per tag — nothing of them is
 * returned.
 */
connectionsTagsRoutes.get('/tags/cleaning', async (c) => {
  const ctx = c.get('ctx');

  const { data: tags, error } = await adminClient
    .from('tag')
    .select('id,name,organisation_id')
    .eq('workspace_id', ctx.workspaceId)
    .limit(2000);
  if (error) return c.json({ error: error.message }, 500);

  const ids = (tags ?? []).map((t) => t.id as string);
  const people = new Map<string, Set<string>>();
  const lastLinked = new Map<string, number>();
  if (ids.length) {
    const { data: links, error: lErr } = await adminClient
      .from('person_tag')
      .select('tag_id,person_id,created_at')
      .in('tag_id', ids)
      .limit(20000);
    if (lErr) return c.json({ error: lErr.message }, 500);
    for (const l of links ?? []) {
      const tid = l.tag_id as string;
      (people.get(tid) ?? people.set(tid, new Set()).get(tid)!).add(l.person_id as string);
      const at = Date.parse(l.created_at as string);
      // The epoch marks links from before dates were recorded: no honest date.
      if (at > 0) lastLinked.set(tid, Math.max(lastLinked.get(tid) ?? 0, at));
    }
  }

  const since = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const { data: notes, error: nErr } = await adminClient
    .from('flow_run_note')
    .select('body,happened_at')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .gte('happened_at', since)
    .order('happened_at', { ascending: false })
    .limit(5000);
  if (nErr) return c.json({ error: nErr.message }, 500);

  const facts: TagFacts[] = (tags ?? []).map((t) => {
    const id = t.id as string;
    let used = lastLinked.get(id) ?? 0;
    // Newest first, so the first mention is the latest one.
    const hit = (notes ?? []).find((n) => mentions((n.body as string | null) ?? '', t.name as string));
    if (hit) used = Math.max(used, Date.parse(hit.happened_at as string));
    return {
      id,
      name: t.name as string,
      organisation_id: (t.organisation_id as string | null) ?? null,
      people: people.get(id)?.size ?? 0,
      last_used: used > 0 ? new Date(used).toISOString() : null,
    };
  });

  const doubles = findDoubles(facts);
  const unused = findUnused(facts);
  const stale = findStale(facts, new Date(), STALE_DAYS);
  return c.json({
    doubles,
    unused,
    stale,
    stale_days: STALE_DAYS,
    count: doubles.length + unused.length + stale.length,
    can_edit: await isWorkspaceAdmin(ctx),
  });
});

const MergeBody = z.object({
  into: z.string().uuid(),
  from: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Fold tags into one. Everybody carrying any of them ends up carrying `into`,
 * keeping when and how they were first tagged; the others are then removed.
 *
 * No transaction across PostgREST calls, so the order is what makes a failure
 * safe: links are copied BEFORE anything is deleted, and the copy ignores
 * links that already exist — running the same merge again finishes the job.
 */
connectionsTagsRoutes.post('/tags/merge', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json({ error: 'admins only' }, 403);
  const parsed = MergeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
  const from = [...new Set(parsed.data.from)].filter((id) => id !== parsed.data.into);
  if (!from.length) return c.json({ error: 'nothing to merge' }, 400);

  const { data: rows, error } = await adminClient
    .from('tag')
    .select('id,organisation_id')
    .eq('workspace_id', ctx.workspaceId)
    .in('id', [parsed.data.into, ...from]);
  if (error) return c.json({ error: error.message }, 500);
  if ((rows ?? []).length !== from.length + 1) return c.json({ error: 'tag not found' }, 404);
  const into = rows!.find((r) => r.id === parsed.data.into)!;
  // Two organisations are two real things; never fold one into the other.
  const orgs = rows!.filter((r) => r.organisation_id);
  if (orgs.length > 1) return c.json({ error: 'two organisations cannot be merged' }, 409);

  const { data: links, error: lErr } = await adminClient
    .from('person_tag')
    .select('person_id,created_at,created_via,note_id')
    .in('tag_id', from)
    .limit(20000);
  if (lErr) return c.json({ error: lErr.message }, 500);
  if (links?.length) {
    const { error: upErr } = await adminClient.from('person_tag').upsert(
      links.map((l) => ({
        person_id: l.person_id as string,
        tag_id: into.id as string,
        created_at: l.created_at as string,
        created_via: (l.created_via as string | null) ?? null,
        note_id: (l.note_id as string | null) ?? null,
      })),
      { onConflict: 'person_id,tag_id', ignoreDuplicates: true },
    );
    if (upErr) return c.json({ error: upErr.message }, 500);
  }

  // An organisation's tag folded in hands its pointer to the survivor. Read
  // before the delete, written after it: the unique (workspace, organisation)
  // index would refuse two tags holding the same pointer at once.
  const orgFrom = orgs.find((r) => r.id !== into.id);

  const { error: delErr } = await adminClient
    .from('tag')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .in('id', from);
  if (delErr) return c.json({ error: delErr.message }, 500);

  if (orgFrom && !into.organisation_id) {
    const { error: pErr } = await adminClient
      .from('tag')
      .update({ organisation_id: orgFrom.organisation_id })
      .eq('id', into.id as string)
      .eq('workspace_id', ctx.workspaceId);
    if (pErr) return c.json({ error: pErr.message }, 500);
  }
  return c.json({ ok: true, moved: links?.length ?? 0 });
});

const RenameBody = z.object({ name: z.string().trim().min(1).max(80) });

/** Rename a tag. A name another tag already has is a merge, and says so. */
connectionsTagsRoutes.patch('/tags/:id', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json({ error: 'admins only' }, 403);
  const parsed = RenameBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
  const id = c.req.param('id');

  const { data: clash, error: cErr } = await adminClient
    .from('tag')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('name', parsed.data.name)
    .neq('id', id)
    .maybeSingle();
  if (cErr) return c.json({ error: cErr.message }, 500);
  if (clash) return c.json({ error: 'name taken', existing_id: clash.id }, 409);

  const { data, error } = await adminClient
    .from('tag')
    .update({ name: parsed.data.name })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id')
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'tag not found' }, 404);
  return c.json({ ok: true });
});

/**
 * Remove a tag, and with it the tag on everybody who had it. The words in
 * notes are untouched: a note is what somebody wrote, and this removes a
 * label, not a sentence.
 */
connectionsTagsRoutes.delete('/tags/:id', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx))) return c.json({ error: 'admins only' }, 403);
  const { data, error } = await adminClient
    .from('tag')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId)
    .select('id')
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'tag not found' }, 404);
  return c.json({ ok: true });
});
