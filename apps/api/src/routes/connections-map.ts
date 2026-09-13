// The desktop map: everybody, and who is near somebody.
//
// docs/connections-desktop.md. Two reads, both derived, nothing stored.
//
//   GET /connections/map                       everyone, with what placement
//                                              needs: rung, last contact,
//                                              whether they need attention
//   GET /connections/map/:personId/neighbourhood   who is near one person, and
//                                              every reason why, plus the
//                                              organisations they belong to
//   GET /connections/map/org/:orgId            an organisation and its people
//   GET /connections/map/tag/:tagId            a topic and the people who carry it
//
// Both neighbourhood reads also return `links`: how the people they return are
// tied to EACH OTHER. Sjoerd, 2026-09-13: "some words are not only connected to
// the central word, but also to other words that are shown". Without it the web
// is a star and says nothing about the community's own shape.
//
// Organisations in the web (Sjoerd, 2026-09-13: "company needs to be connected
// to the person"). A current org_membership is a RECORDED fact — somebody put
// that person in that organisation — so it is an edge, drawn solid, unlike a
// shared tag. A company named in a note is not a membership and is not drawn
// as one (system-handbook §12).
//
// Placement itself is NOT here. It is a pure function in the web app
// (lib/map-layout.ts), because it has to be stable and cheap to recompute as
// the view pans, and because doing it server-side would mean a round trip per
// zoom. This returns facts; the browser decides where they go.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsMapRoutes);

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { rowInWorkspace } from '../lib/workspace-refs.js';

export const connectionsMapRoutes = new Hono();

type PersonRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function nameOf(p: PersonRow): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Unnamed';
}

connectionsMapRoutes.get('/map', async (c) => {
  const ctx = c.get('ctx');

  // Four reads that do not depend on each other, in parallel.
  const [peopleRes, landscapeRes, attentionRes, notesRes] = await Promise.all([
    adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .limit(5000),
    // Rung and last_seen, from the one definition of the ladder.
    adminClient.rpc('connections_landscape', { p_workspace: ctx.workspaceId }),
    adminClient.rpc('connections_attention', { p_workspace: ctx.workspaceId, p_limit: 500 }),
    // The latest committed personal note per person. last_seen in the
    // landscape is built from activity and attendance; a conversation written
    // down is contact too, and the most deliberate kind.
    adminClient
      .from('flow_run_note')
      .select('person_id, happened_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_draft', false)
      .is('deleted_at', null)
      .not('person_id', 'is', null)
      .in('kind', ['call', 'meeting', 'message', 'note'])
      .order('happened_at', { ascending: false })
      .limit(5000),
  ]);

  if (peopleRes.error) return c.json({ error: peopleRes.error.message }, 500);

  const rung = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const r of (landscapeRes.data ?? []) as { person_id: string; rung: string; last_seen: string | null }[]) {
    rung.set(r.person_id, r.rung);
    // -infinity comes back as a string PostgREST cannot turn into a date;
    // treat anything unparseable as "never" rather than as today.
    if (r.last_seen && !Number.isNaN(new Date(r.last_seen).getTime())) seen.set(r.person_id, r.last_seen);
  }

  for (const n of (notesRes.data ?? []) as { person_id: string; happened_at: string }[]) {
    const prev = seen.get(n.person_id);
    if (!prev || new Date(n.happened_at) > new Date(prev)) seen.set(n.person_id, n.happened_at);
  }

  const attention = new Set(
    ((attentionRes.data ?? []) as { person_id: string }[]).map((r) => r.person_id),
  );

  const people = ((peopleRes.data ?? []) as PersonRow[]).map((p) => ({
    id: p.id,
    name: nameOf(p),
    rung: rung.get(p.id) ?? null,
    lastContactAt: seen.get(p.id) ?? null,
    attention: attention.has(p.id),
  }));

  return c.json({ people });
});

connectionsMapRoutes.get('/map/:personId/neighbourhood', async (c) => {
  const ctx = c.get('ctx');
  const personId = c.req.param('personId');

  // The focus must live in this workspace. The SQL function is security
  // definer and scopes its OUTPUT to p_workspace, but asking it about a
  // foreign person should be refused outright rather than answered with an
  // empty list — the same 404 for "missing" and "elsewhere" that every
  // service-role route now gives (lib/workspace-refs.ts).
  if (!(await rowInWorkspace('person', personId, ctx.workspaceId))) {
    return c.json({ error: 'not found' }, 404);
  }

  const { data, error } = await adminClient.rpc('connections_neighbourhood', {
    p_workspace: ctx.workspaceId,
    p_person: personId,
    p_limit: 40,
  });
  if (error) return c.json({ error: error.message }, 500);

  const rows = (data ?? []) as { person_id: string; weight: number; reasons: { kind: string; label: string }[] }[];

  const organisations = await currentOrganisations(personId, ctx.workspaceId);

  // How the neighbours are tied to each other. The centre is excluded: its own
  // lines are the neighbourhood weights above, and including it would return
  // every one of them a second time.
  const links = await linksAmong(rows.map((r) => r.person_id), ctx.workspaceId);
  const ids = rows.map((r) => r.person_id);

  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', ids);
    for (const p of (people ?? []) as PersonRow[]) names.set(p.id, nameOf(p));
  }

  return c.json({
    organisations,
    links,
    neighbours: rows
      // A neighbour whose name could not be read was filtered by the workspace
      // above — drop it rather than show an anonymous dot.
      .filter((r) => names.has(r.person_id))
      .map((r) => ({
        id: r.person_id,
        name: names.get(r.person_id)!,
        weight: r.weight,
        reasons: r.reasons,
      })),
  });
});

type Membership = { org_id: string; person_id: string; title: string | null };

/** A person's CURRENT organisations, in this workspace, primary first. */
async function currentOrganisations(personId: string, workspaceId: string) {
  const { data: ms } = await adminClient
    .from('org_membership')
    .select('org_id, person_id, title, is_primary')
    .eq('person_id', personId)
    .is('ended_at', null);
  const memberships = (ms ?? []) as (Membership & { is_primary: boolean })[];
  if (!memberships.length) return [];
  // org_membership has no workspace column; the organisation's row decides.
  const { data: orgs } = await adminClient
    .from('organisation')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('id', memberships.map((m) => m.org_id));
  const name = new Map(((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]));
  return memberships
    .filter((m) => name.has(m.org_id))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((m) => ({ id: m.org_id, name: name.get(m.org_id)!, title: m.title }));
}

connectionsMapRoutes.get('/map/org/:orgId', async (c) => {
  const ctx = c.get('ctx');
  const orgId = c.req.param('orgId');

  const { data: org } = await adminClient
    .from('organisation')
    .select('id, name')
    .eq('id', orgId)
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .maybeSingle();
  // Missing and elsewhere answer the same, as everywhere (lib/workspace-refs.ts).
  if (!org) return c.json({ error: 'not found' }, 404);

  const { data: ms } = await adminClient
    .from('org_membership')
    .select('person_id, title, is_decision_maker, is_primary')
    .eq('org_id', orgId)
    .is('ended_at', null)
    .limit(200);
  const memberships = (ms ?? []) as { person_id: string; title: string | null; is_decision_maker: boolean; is_primary: boolean }[];

  const names = new Map<string, string>();
  if (memberships.length) {
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .in('id', memberships.map((m) => m.person_id));
    for (const p of (people ?? []) as PersonRow[]) names.set(p.id, nameOf(p));
  }

  const memberLinks = await linksAmong(
    memberships.filter((m) => names.has(m.person_id)).map((m) => m.person_id),
    ctx.workspaceId,
  );

  return c.json({
    organisation: org,
    links: memberLinks,
    members: memberships
      .filter((m) => names.has(m.person_id))
      // Decision makers and people for whom this is their main organisation
      // first: when a web can show only a dozen names, those are the ones.
      .sort((a, b) => Number(b.is_decision_maker) - Number(a.is_decision_maker) || Number(b.is_primary) - Number(a.is_primary))
      .map((m) => ({ id: m.person_id, name: names.get(m.person_id)!, title: m.title })),
  });
});

/**
 * A topic, and everybody it is on.
 *
 * Sjoerd, 2026-09-13: *"Can you also create a cloud around a location -
 * space... or tag? So you select people around a NODE?"*
 *
 * The map already draws topics — every name hangs off a junction, and a
 * junction IS a tag — but a junction was somewhere you could look and not
 * somewhere you could stand. This is the standing place: the same web, with a
 * word in the middle instead of a person.
 *
 * ── What this does NOT claim ───────────────────────────────────────────────
 *
 * Two people carrying one tag is not a relationship (system-handbook §12), and
 * this endpoint does not turn it into one. It answers "who carries this word",
 * which is a fact about each person separately. The lines drawn BETWEEN the
 * people it returns come from `linksAmong` exactly as they do everywhere else
 * — real ties, computed the one way they are computed — so standing on a tag
 * cannot invent an edge that standing on a person would not show.
 *
 * ── Rarity is carried, not applied ─────────────────────────────────────────
 *
 * connections-model.md §3.5: a tag on three people is a strong link and a tag
 * on three hundred is not a link at all. The count comes back so the surface
 * can say so; it is deliberately not a filter here, because "show me everyone
 * with this word" is a legitimate question even when the word is on everybody,
 * and an endpoint that silently returned nothing would be lying about the
 * data rather than reporting it.
 */
connectionsMapRoutes.get('/map/tag/:tagId', async (c) => {
  const ctx = c.get('ctx');
  const tagId = c.req.param('tagId');

  const { data: tag } = await adminClient
    .from('tag')
    .select('id, name')
    .eq('id', tagId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  // Missing and elsewhere answer the same, as everywhere.
  if (!tag) return c.json({ error: 'not found' }, 404);

  const { data: pt } = await adminClient
    .from('person_tag')
    .select('person_id, created_via')
    .eq('tag_id', tagId)
    .limit(500);
  const carriers = (pt ?? []) as { person_id: string; created_via: string | null }[];

  const names = new Map<string, string>();
  if (carriers.length) {
    // person_tag has no workspace column; the person's row decides — the same
    // shape as org_membership, and the same reason it is filtered here.
    const { data: people } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .in('id', carriers.map((x) => x.person_id));
    for (const p of (people ?? []) as PersonRow[]) names.set(p.id, nameOf(p));
  }

  const present = carriers.filter((x) => names.has(x.person_id));
  const memberLinks = await linksAmong(present.map((x) => x.person_id), ctx.workspaceId);

  return c.json({
    tag: { id: tag.id as string, name: tag.name as string, people: present.length },
    links: memberLinks,
    members: present
      // By hand first. Somebody deciding this word belongs on this person is a
      // firmer statement than a matcher finding it in a sentence, and when a
      // web can show only a dozen names those are the ones worth showing.
      .sort((a, b) => Number(a.created_via === 'note') - Number(b.created_via === 'note'))
      .map((x) => ({
        id: x.person_id,
        name: names.get(x.person_id)!,
        // Where the tag came from, so the surface can say "found in a note"
        // rather than presenting a guess and a decision as the same thing.
        title: x.created_via === 'note' ? 'note' : null,
      })),
  });
});

type LinkRow = { a_person_id: string; b_person_id: string; weight: number; reasons: { kind: string; label: string }[] };

/**
 * How a set of people are tied to each other. Never throws and never fails the
 * page: a web without its cross-links is still a web, and the star from the
 * centre is the part that carries the meaning.
 */
async function linksAmong(personIds: string[], workspaceId: string) {
  if (personIds.length < 2) return [];
  const { data, error } = await adminClient.rpc('connections_links_among', {
    p_workspace: workspaceId,
    p_people: personIds,
  });
  if (error) {
    console.error('[connections/map] links_among failed', error.message);
    return [];
  }
  return ((data ?? []) as LinkRow[]).map((r) => ({
    a: r.a_person_id,
    b: r.b_person_id,
    weight: r.weight,
    reasons: r.reasons,
  }));
}
