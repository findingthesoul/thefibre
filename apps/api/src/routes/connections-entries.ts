// Entries — who can get us in.
//
// docs/connections-model.md §3.6. Like the rest of Connections this is a read
// with no store of its own: the paths are derived at request time from tables
// other apps already fill (relationship, org_membership, thread_enrolment,
// person_relationship_context) and nothing is written back. Derived edges are
// displayed, never stored — D26.
//
// MOUNT AT `/connections`, next to connectionsRoutes:
//     v1.route('/connections', connectionsEntriesRoutes);
// which puts the endpoints at /api/v1/connections/entries and
// /api/v1/connections/entries/targets. The web app calls those paths.
//
// The ranking rules all live in the SQL function connections_entries (two
// hops hard-capped, strength is the weakest edge, every edge decays). This
// file does three things the database should not: it hydrates names, it turns
// the 'Careful: ' prefix into a structured flag, and it DEGRADES — when no
// path exists it answers with relatedness instead of an empty state, because
// "no path" is a dead end and most early lookups will find nothing.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const connectionsEntriesRoutes = new Hono();

/** An entry via somebody marked `sceptic` is a warning, not an opportunity.
 *  The SQL function marks those reasons with this literal prefix — a small
 *  contract between that function and this file, kept here so the interface
 *  can label it rather than hoping the user reads to the end of a sentence. */
const WARNING_PREFIX = 'Careful: ';

type EntryRow = {
  via_person_id: string;
  target_id: string;
  target_kind: 'organisation' | 'person';
  hops: number;
  reason: string;
  strength: number;
};

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const EntriesQuery = z
  .object({
    org_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine((v) => Boolean(v.org_id) !== Boolean(v.person_id), {
    message: 'exactly one of org_id or person_id',
  });

function label(p: PersonRow | undefined | null, fallback: string) {
  if (!p) return fallback;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || fallback;
}

async function peopleByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, PersonRow>();
  const { data } = await adminClient
    .from('person')
    .select('id, first_name, last_name, email')
    .in('id', ids);
  return new Map(((data ?? []) as PersonRow[]).map((p) => [p.id, p]));
}

/** Everything the user typed is a value, never filter syntax. PostgREST's
 *  filter grammar is comma- and paren-delimited, so a raw `q` interpolated
 *  into one is an injection — strip the grammar characters and cap the
 *  length rather than trusting the client library to escape them. */
function safeLike(q: string) {
  return q.replace(/[,()*\\%]/g, ' ').trim().slice(0, 80);
}

// ---------------------------------------------------------------------------
// Degrade, rather than fail.
//
// "No path" is where the user leaves. "No path, but three people you know are
// in the same sector" keeps them in the tool — §3.6, "Cold start". These are
// explicitly NOT entries: nobody here can get you in, they are simply the
// nearest thing the data knows, and the interface says so in those words.
// ---------------------------------------------------------------------------
type Related = { person_id: string; note: string; person: PersonRow | null };

async function relatedPeople(
  workspaceId: string,
  opts: { sectors: string[]; countries: string[]; excludeOrgIds: string[]; excludePersonIds: string[] },
): Promise<Related[]> {
  const sectors = [...new Set(opts.sectors.filter(Boolean))];
  const countries = [...new Set(opts.countries.filter(Boolean))];

  // Sector first, country second — and the second is tried whenever the
  // first comes back empty, not only when there is no sector to try. That
  // distinction is the whole point of degrading: a target whose sector
  // nobody else shares is exactly the lookup that most needs a second-best
  // answer, and stopping at "sector matched nothing" hands back the empty
  // state this function exists to avoid.
  const attempts: { col: 'sector' | 'country'; vals: string[] }[] = [];
  if (sectors.length) attempts.push({ col: 'sector', vals: sectors });
  if (countries.length) attempts.push({ col: 'country', vals: countries });
  if (attempts.length === 0) return [];

  let by: { col: 'sector' | 'country'; vals: string[] } | null = null;
  let orgById = new Map<string, Record<string, unknown>>();
  for (const attempt of attempts) {
    const { data: orgs } = await adminClient
      .from('organisation')
      .select('id, name, sector, country')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .in(attempt.col, attempt.vals)
      .limit(60);
    const candidates = (orgs ?? []).filter((o) => !opts.excludeOrgIds.includes(o.id as string));
    if (candidates.length === 0) continue;
    by = attempt;
    orgById = new Map(candidates.map((o) => [o.id as string, o]));
    break;
  }
  if (!by || orgById.size === 0) return [];

  const { data: members } = await adminClient
    .from('org_membership')
    .select('person_id, org_id, title, ended_at')
    .in('org_id', [...orgById.keys()])
    .limit(200);

  const rows = (members ?? []).filter((m) => !opts.excludePersonIds.includes(m.person_id as string));
  if (rows.length === 0) return [];

  // Only people who are really in this workspace and not soft-deleted or
  // merged away. org_membership carries no workspace_id of its own.
  const { data: live } = await adminClient
    .from('person')
    .select('id, first_name, last_name, email')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('merged_into', null)
    .in('id', [...new Set(rows.map((m) => m.person_id as string))]);
  const liveById = new Map(((live ?? []) as PersonRow[]).map((p) => [p.id, p]));

  const seen = new Set<string>();
  const out: Related[] = [];
  for (const m of rows) {
    const pid = m.person_id as string;
    const person = liveById.get(pid);
    if (!person || seen.has(pid)) continue;
    seen.add(pid);
    const org = orgById.get(m.org_id as string);
    const where = (org?.name as string) ?? 'another organisation';
    const title = (m.title as string | null)?.trim();
    const tense = m.ended_at ? 'was at' : 'is at';
    out.push({
      person_id: pid,
      person,
      note:
        by.col === 'sector'
          ? `in the same sector — ${title ? `${title}, ` : ''}${tense} ${where}`
          : `in the same country — ${title ? `${title}, ` : ''}${tense} ${where}`,
    });
    if (out.length >= 12) break;
  }
  return out;
}

// GET /entries?org_id=… | ?person_id=…
//
// One row per connector, never three variations on "ask Marja": the product
// is the introduction you request, and a list of near-duplicates is a list
// nobody acts on (§3.6, "The ask is the product").
connectionsEntriesRoutes.get('/entries', async (c) => {
  const ctx = c.get('ctx');
  const parsed = EntriesQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { org_id, person_id, limit } = parsed.data;

  // Resolve the target inside this workspace first — an id from another
  // workspace must read as "not found", not as an empty result that looks
  // like "nobody here knows them".
  let target: { id: string; kind: 'organisation' | 'person'; name: string };
  let targetSectors: string[] = [];
  let targetCountries: string[] = [];
  let excludeOrgIds: string[] = [];
  let excludePersonIds: string[] = [];

  if (org_id) {
    const { data: org } = await adminClient
      .from('organisation')
      .select('id, name, sector, country')
      .eq('id', org_id)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!org) return c.json({ error: 'not found' }, 404);
    target = { id: org.id as string, kind: 'organisation', name: (org.name as string) ?? '' };
    targetSectors = [org.sector as string].filter(Boolean);
    targetCountries = [org.country as string].filter(Boolean);
    excludeOrgIds = [org.id as string];
  } else {
    const { data: person } = await adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('id', person_id!)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!person) return c.json({ error: 'not found' }, 404);
    target = { id: person.id as string, kind: 'person', name: label(person as PersonRow, 'this person') };
    excludePersonIds = [person.id as string];

    // Where they sit, so the degrade can answer "same sector" for a person too.
    const { data: mems } = await adminClient
      .from('org_membership')
      .select('org_id')
      .eq('person_id', person.id as string);
    const orgIds = [...new Set((mems ?? []).map((m) => m.org_id as string))];
    excludeOrgIds = orgIds;
    if (orgIds.length) {
      const { data: orgs } = await adminClient
        .from('organisation')
        .select('id, sector, country')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', orgIds);
      targetSectors = (orgs ?? []).map((o) => o.sector as string).filter(Boolean);
      targetCountries = (orgs ?? []).map((o) => o.country as string).filter(Boolean);
    }
  }

  const { data, error } = await adminClient.rpc('connections_entries', {
    p_workspace: ctx.workspaceId,
    p_target_org: org_id ?? null,
    p_target_person: person_id ?? null,
    p_limit: limit,
  });
  if (error) {
    console.error('[connections/entries] failed', error);
    return c.json({ error: error.message }, 500);
  }

  const rows = (data ?? []) as unknown as EntryRow[];
  const byId = await peopleByIds([...new Set(rows.map((r) => r.via_person_id))]);

  // A path through somebody marked `sceptic` is a warning, not an
  // opportunity — so it never heads a list of opportunities, however strong
  // the path is. It still appears: "there is a sceptic in there" is real
  // intelligence, it just belongs under the people you would actually ask.
  // Presentation order only; the SQL's ranking (weakest edge, decayed) is
  // untouched and still decides who beats whom within each group.
  const ordered = [...rows].sort((a, b) => {
    const aw = a.reason.startsWith(WARNING_PREFIX) ? 1 : 0;
    const bw = b.reason.startsWith(WARNING_PREFIX) ? 1 : 0;
    if (aw !== bw) return aw - bw;
    if (b.strength !== a.strength) return b.strength - a.strength;
    return a.hops - b.hops;
  });

  const items = ordered.map((r) => {
    const warning = r.reason.startsWith(WARNING_PREFIX);
    return {
      via_person_id: r.via_person_id,
      target_id: r.target_id,
      target_kind: r.target_kind,
      hops: r.hops,
      // The sentence, without the machine-readable prefix — the interface
      // renders the caution as a label of its own so it can be translated.
      reason: warning ? r.reason.slice(WARNING_PREFIX.length) : r.reason,
      warning,
      strength: r.strength,
      person: byId.get(r.via_person_id) ?? null,
    };
  });

  const related =
    items.length === 0
      ? await relatedPeople(ctx.workspaceId, {
          sectors: targetSectors,
          countries: targetCountries,
          excludeOrgIds,
          excludePersonIds,
        })
      : [];

  return c.json({ target, items, related });
});

// GET /entries/targets?q=… — what can be reached, to search before asking.
//
// Organisations and people in one list. Three narrow queries merged by id
// rather than one `.or()` string: PostgREST's filter grammar is not a place
// to interpolate a user's search box.
connectionsEntriesRoutes.get('/entries/targets', async (c) => {
  const ctx = c.get('ctx');
  const raw = new URL(c.req.url).searchParams.get('q') ?? '';
  const q = safeLike(raw);
  if (q.length < 2) return c.json({ organisations: [], people: [] });

  const { data: orgs, error: orgErr } = await adminClient
    .from('organisation')
    .select('id, name, sector, country')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10);
  if (orgErr) {
    console.error('[connections/entries/targets] org search failed', orgErr);
    return c.json({ error: orgErr.message }, 500);
  }

  const base = () =>
    adminClient
      .from('person')
      .select('id, first_name, last_name, email')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .limit(10);

  const [first, last, mail] = await Promise.all([
    base().ilike('first_name', `%${q}%`),
    base().ilike('last_name', `%${q}%`),
    base().ilike('email', `%${q}%`),
  ]);
  const firstErr = first.error ?? last.error ?? mail.error;
  if (firstErr) {
    console.error('[connections/entries/targets] person search failed', firstErr);
    return c.json({ error: firstErr.message }, 500);
  }

  const merged = new Map<string, PersonRow>();
  for (const r of [first, last, mail]) {
    for (const p of (r.data ?? []) as PersonRow[]) merged.set(p.id, p);
  }

  return c.json({
    organisations: orgs ?? [],
    people: [...merged.values()].slice(0, 10),
  });
});
