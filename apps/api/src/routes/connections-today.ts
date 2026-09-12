// Connections — Today: what I owe, and what is coming at me.
//
// Two halves that look adjacent and are not (docs/connections-mobile.md §3).
//
//   OWED     what I owe. Tasks due or overdue. `flow_task`, nothing clever.
//            Every CRM ships a version of this.
//
//   PREPARE  what is coming AT me that needs work BEFORE it. Derived from an
//            upcoming commitment PLUS the state of the people attached to it,
//            which Fibre can compute only because it holds delivery,
//            participation and money in one system. This is the half nobody
//            else has, and it is the reason this route exists.
//
// THE LEAD-TIME RULE. Preparation surfaces on its OWN lead time, never on the
// date of the thing. A thread wants attention two weeks out; a meeting brief
// wants a day. Surfacing both on the day the thing happens makes one useless
// and the other panic. So every prepare row carries `prepare_at`
// (= happens_at − lead_days) and it is `prepare_at`, not `happens_at`, that
// decides which horizon segment the row falls into.
//
// A read, not a store — like routes/connections.ts. Nothing here is written,
// nothing is configured and there is no schema of its own.
//
// NOTE ON RLS: this runs on `adminClient` (service role), so RLS is NOT
// filtering for us. Every query below filters `workspace_id` explicitly, or
// filters by ids that were themselves fetched under a workspace filter.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { actorUserId } from '../middleware/app-context.js';
import { effortFor, taskKind, type EffortKind } from '../lib/effort.js';
import { loadEffortOverrides } from './connections-effort.js';

export const connectionsTodayRoutes = new Hono();

const DAY = 86_400_000;

const HORIZONS = ['today', 'tomorrow', 'week', 'next_week'] as const;
type Horizon = (typeof HORIZONS)[number];

const TodayQuery = z.object({
  horizon: z.enum(HORIZONS).default('today'),
});

/**
 * How far ahead of the thing each kind of preparation becomes work.
 *
 * These are the numbers in docs/connections-mobile.md §3, turned into a
 * constant so the rule is one edit rather than four. They are deliberately
 * different from each other — that difference IS the feature.
 */
const LEAD_DAYS = {
  /** "Athens starts in nine days, four of the twelve have never been
   *  contacted." Reaching four people is a fortnight's work, not a day's. */
  thread_unreached: 14,
  /** Chasing money wants a week: long enough to ask twice, short enough
   *  that the ask is about a session they can still remember booking. */
  thread_unpaid: 7,
  /** "You are meeting Marja tomorrow; you last spoke eight months ago."
   *  §3 says ten minutes, which is true of reading the brief and useless as
   *  a horizon — a ten-minute lead time means tomorrow's meeting never
   *  appears until tomorrow. One day puts the brief in front of you the
   *  evening before, which is the example the spec itself gives. */
  meeting_brief: 1,
  /** An invoice that has not gone out yet for money expected on a date. */
  money_uninvoiced: 7,
} as const;

type PrepareSignal = keyof typeof LEAD_DAYS;

/** Don't drag the whole history of unsent invoices into a mobile queue. */
const MONEY_LOOKBACK_DAYS = 90;

// Caps. Each one is a "this list stopped being a queue" guard, not a
// pagination scheme — a horizon longer than a thumb-scroll has already failed
// (docs/connections-mobile.md §4.3).
const MAX_TASKS = 300;
const MAX_ENGAGEMENTS = 500;
const MAX_ENROLMENTS = 2000;
const MAX_CONTACT_CHECK_PEOPLE = 400;
const MAX_ACTIVITY_ROWS = 5000;
const MAX_BOOKINGS = 100;
const MAX_BRIEFS = 30;
const MAX_COMMITMENTS = 500;
const MAX_MONEY_LINES = 500;

// ---------------------------------------------------------------------------
// The horizon windows.
//
// Computed in UTC. The workspace's real timezone is not on the request (the
// page is server-rendered, so there is no browser offset to pass either), so
// "today" can start an hour or two off for a European user late at night.
// Known, bounded, and cheaper to live with than a wrong guess at a timezone;
// the fix is a tz parameter once a caller can supply one.
//
// The segments deliberately OVERLAP — "this week" contains today and
// tomorrow. They are four questions about the same queue, not four buckets,
// and a count that excluded today would answer no question anybody asks.
// ---------------------------------------------------------------------------
type Windows = {
  now: Date;
  dayStart: Date;
  tomorrowStart: Date;
  dayAfterTomorrow: Date;
  /** Start of next ISO week — Monday 00:00. End of "this week". */
  nextMonday: Date;
  nextWeekEnd: Date;
};

function windowsFor(now: Date): Windows {
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // ISO day-of-week: Monday 1 … Sunday 7.
  const dow = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const nextMonday = new Date(dayStart.getTime() + (8 - dow) * DAY);
  return {
    now,
    dayStart,
    tomorrowStart: new Date(dayStart.getTime() + DAY),
    dayAfterTomorrow: new Date(dayStart.getTime() + 2 * DAY),
    nextMonday,
    nextWeekEnd: new Date(nextMonday.getTime() + 7 * DAY),
  };
}

/**
 * Which segments an item falls into, given the moment it becomes work.
 *
 * Anything already past lands in `today` (and in `week`, which starts today).
 * That is the point: an overdue task and a thread whose prep window opened
 * last Tuesday are both work you have *now*, and hiding them because their
 * date has gone by is how a queue quietly stops being trusted.
 */
function segmentsFor(at: Date, w: Windows): Record<Horizon, boolean> {
  return {
    today: at < w.tomorrowStart,
    tomorrow: at >= w.tomorrowStart && at < w.dayAfterTomorrow,
    week: at < w.nextMonday,
    next_week: at >= w.nextMonday && at < w.nextWeekEnd,
  };
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------
type PersonRef = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};
type OrgRef = { id: string; name: string };

type OwedRow = {
  id: string;
  title: string;
  due_at: string;
  overdue: boolean;
  person_id: string | null;
  organisation_id: string | null;
  person: PersonRef | null;
  organisation: OrgRef | null;
  /** Where the task came from, which decides its estimate (lib/effort.ts). */
  kind: EffortKind;
  /** Estimated minutes. Never asked for: the kind's default, or the
   *  workspace's own number for that kind. */
  minutes: number;
  in: Record<Horizon, boolean>;
};

type PrepareRow = {
  /** Stable across requests — the client keys rows on it. */
  id: string;
  signal: PrepareSignal;
  /** When this becomes work. The lead-time rule lives in this field. */
  prepare_at: string;
  /** When the thing itself happens. */
  happens_at: string;
  lead_days: number;
  days_until: number;
  /** What it is about, already named: a thread's title, a person, a deal. */
  subject: string;
  /** "four of the twelve" — count and of, never a pre-phrased sentence, so
   *  the interface can say it in six languages. */
  count: number | null;
  of: number | null;
  /** Days since the last PERSONAL contact. null = never, for meeting briefs. */
  days_since_spoken: number | null;
  amount_cents: number | null;
  /** The workspace's Pulse currency. Set only on money rows — an amount with
   *  no currency is a number pretending to be money. */
  currency: string | null;
  person_id: string | null;
  person: PersonRef | null;
  /** Where the row taps to. Exactly one destination, never a menu (§4.4). */
  link: { kind: 'person' | 'thread'; id: string } | null;
  /** Estimated minutes; per-person signals multiply by `count`. */
  minutes: number;
  in: Record<Horizon, boolean>;
};

/** PostgREST hands an embedded row back as an object or a one-element array
 *  depending on how it inferred the relationship. Normalise once. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

// ---------------------------------------------------------------------------
// GET /connections/today
// ---------------------------------------------------------------------------
connectionsTodayRoutes.get('/today', async (c) => {
  const ctx = c.get('ctx');
  const parsed = TodayQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const horizon = parsed.data.horizon;
  const ws = ctx.workspaceId;
  const w = windowsFor(new Date());
  const meUserId = actorUserId(ctx);

  // Everything is gathered across the WIDEST window once, then bucketed. The
  // counts on the segmented control are the useful part before you tap
  // (§3, §4.2), and they only exist if the other three horizons were counted
  // even though you asked for one.
  const owed: OwedRow[] = [];
  const prepare: PrepareRow[] = [];

  try {
    // ── OWED ───────────────────────────────────────────────────────────────
    // Tasks with a date, still open. Overdue ones have no lower bound: work
    // you did not do last week is work you have today.
    const { data: taskRows, error: taskErr } = await adminClient
      .from('flow_task')
      .select('id, title, due_at, status, contact_id, organisation_id, assignee_user_id, step_default_task_id, gate_task_id')
      .eq('workspace_id', ws)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress'])
      .not('due_at', 'is', null)
      .lt('due_at', w.nextWeekEnd.toISOString())
      .order('due_at', { ascending: true })
      .limit(MAX_TASKS);
    if (taskErr) throw new Error(`flow_task: ${taskErr.message}`);

    // Which of these tasks a note created, so a follow-up is estimated as a
    // follow-up. Recognised by the note's pointer, never by the title.
    const taskIds = ((taskRows ?? []) as { id: string }[]).map((t) => t.id);
    const followUps = new Set<string>();
    if (taskIds.length) {
      const { data, error } = await adminClient
        .from('flow_run_note')
        .select('follow_up_task_id')
        .eq('workspace_id', ws)
        .in('follow_up_task_id', taskIds);
      if (error) throw new Error(`flow_run_note: ${error.message}`);
      for (const r of (data ?? []) as { follow_up_task_id: string }[]) followUps.add(r.follow_up_task_id);
    }

    for (const t of (taskRows ?? []) as Record<string, string | null>[]) {
      // "What I OWE" — mine, plus anything nobody has picked up. An
      // unassigned task in a facilitator's workspace is not somebody else's;
      // it is the one most likely to rot. A task assigned to a colleague is
      // theirs and stays off this list.
      if (meUserId && t.assignee_user_id && t.assignee_user_id !== meUserId) continue;
      const due = new Date(t.due_at as string);
      owed.push({
        id: t.id as string,
        title: (t.title as string) ?? '',
        due_at: t.due_at as string,
        overdue: due < w.now,
        person_id: t.contact_id ?? null,
        organisation_id: t.organisation_id ?? null,
        person: null,
        organisation: null,
        kind: taskKind(
          {
            step_default_task_id: t.step_default_task_id ?? null,
            gate_task_id: t.gate_task_id ?? null,
          },
          followUps.has(t.id as string),
        ),
        // Filled in once the overrides are read, below.
        minutes: 0,
        in: segmentsFor(due, w),
      });
    }

    // ── PREPARE 1 + 2: upcoming sessions, and the state of who is enrolled ──
    //
    // A thread carries NO date of its own — the dates live on its
    // engagements. This trips people up, and getting it wrong means every
    // thread looks either imminent or invisible.
    //
    // We look as far as the widest horizon PLUS the longest lead time,
    // because a session fourteen days beyond next week is already work now.
    const engagementsEnd = new Date(
      w.nextWeekEnd.getTime() + LEAD_DAYS.thread_unreached * DAY,
    );
    const { data: engRows, error: engErr } = await adminClient
      .from('thread_engagement')
      .select('id, thread_id, title, starts_at, status')
      .eq('workspace_id', ws)
      // Closed is done; draft is not. A dated draft session is still a
      // commitment somebody made, and is exactly the kind of thing that
      // arrives unprepared.
      .neq('status', 'closed')
      .not('starts_at', 'is', null)
      .gte('starts_at', w.now.toISOString())
      .lt('starts_at', engagementsEnd.toISOString())
      .order('starts_at', { ascending: true })
      .limit(MAX_ENGAGEMENTS);
    if (engErr) throw new Error(`thread_engagement: ${engErr.message}`);

    // One row per THREAD, not per session: a twelve-session journey would
    // otherwise fill the queue on its own. Rows are already ordered by
    // starts_at, so the first one seen is the next one happening.
    type EngagementRow = {
      id: string;
      thread_id: string;
      title: string | null;
      starts_at: string;
    };
    const nextByThread = new Map<string, { id: string; title: string; starts_at: string }>();
    for (const e of (engRows ?? []) as unknown as EngagementRow[]) {
      if (!nextByThread.has(e.thread_id)) {
        nextByThread.set(e.thread_id, {
          id: e.id,
          title: e.title ?? '',
          starts_at: e.starts_at,
        });
      }
    }
    const threadIds = [...nextByThread.keys()];

    // Thread titles live on `program`, one hop away. A second query, not a
    // join — the house style in routes/connections.ts.
    const threadTitle = new Map<string, string>();
    if (threadIds.length) {
      const { data: threads, error: thErr } = await adminClient
        .from('thread_thread')
        .select('id, slug, program:program_id (title)')
        .eq('workspace_id', ws)
        .in('id', threadIds);
      if (thErr) throw new Error(`thread_thread: ${thErr.message}`);
      for (const t of (threads ?? []) as Record<string, unknown>[]) {
        const prog = one(t.program as { title?: string } | { title?: string }[] | null);
        threadTitle.set(t.id as string, prog?.title || (t.slug as string) || '');
      }
    }

    type Enrolment = {
      thread_id: string;
      person_id: string;
      payment_status: string;
      created_at: string;
    };
    let enrolments: Enrolment[] = [];
    if (threadIds.length) {
      const { data, error } = await adminClient
        .from('thread_enrolment')
        .select('thread_id, person_id, payment_status, created_at')
        .eq('workspace_id', ws)
        .in('thread_id', threadIds)
        .limit(MAX_ENROLMENTS);
      if (error) throw new Error(`thread_enrolment: ${error.message}`);
      enrolments = (data ?? []) as unknown as Enrolment[];
    }

    // "Never been contacted" = nothing on the activity log since they signed
    // up. Same definition the attention conditions use
    // (connections_attention, `arrived_unattended`), so the two surfaces
    // cannot disagree about the same person.
    //
    // We want max(occurred_at) per person and PostgREST cannot group, so the
    // rows come back raw and are reduced here. The read is bounded from below
    // by the earliest enrolment in the set, which is the only part that can
    // change the answer. If the cap is still hit the set is genuinely large
    // and the reduction would be missing people — and a MISSING person reads
    // as "never contacted", which is the wrong direction to be wrong in. So
    // on truncation this signal is dropped rather than guessed.
    const enrolledPeople = [...new Set(enrolments.map((e) => e.person_id))].slice(
      0,
      MAX_CONTACT_CHECK_PEOPLE,
    );
    const lastActivity = new Map<string, number>();
    let contactCheckReliable = enrolledPeople.length < MAX_CONTACT_CHECK_PEOPLE;
    if (enrolledPeople.length) {
      const earliest = enrolments.reduce<string>(
        (min, e) => (min === '' || e.created_at < min ? e.created_at : min),
        '',
      );
      const { data, error } = await adminClient
        .from('activity')
        .select('person_id, occurred_at')
        .eq('workspace_id', ws)
        .in('person_id', enrolledPeople)
        .gte('occurred_at', earliest)
        .limit(MAX_ACTIVITY_ROWS);
      if (error) throw new Error(`activity: ${error.message}`);
      const rows = (data ?? []) as { person_id: string; occurred_at: string }[];
      if (rows.length >= MAX_ACTIVITY_ROWS) contactCheckReliable = false;
      for (const r of rows) {
        const at = new Date(r.occurred_at).getTime();
        const prev = lastActivity.get(r.person_id);
        if (prev === undefined || at > prev) lastActivity.set(r.person_id, at);
      }
    }

    for (const threadId of threadIds) {
      const next = nextByThread.get(threadId)!;
      const mine = enrolments.filter((e) => e.thread_id === threadId);
      if (mine.length === 0) continue;
      const happensAt = new Date(next.starts_at);
      const subject = threadTitle.get(threadId) || next.title;

      if (contactCheckReliable) {
        const unreached = mine.filter((e) => {
          const last = lastActivity.get(e.person_id);
          return last === undefined || last <= new Date(e.created_at).getTime();
        }).length;
        if (unreached > 0) {
          const prepareAt = new Date(
            happensAt.getTime() - LEAD_DAYS.thread_unreached * DAY,
          );
          prepare.push({
            id: `unreached:${threadId}`,
            signal: 'thread_unreached',
            prepare_at: prepareAt.toISOString(),
            happens_at: next.starts_at,
            lead_days: LEAD_DAYS.thread_unreached,
            days_until: daysBetween(happensAt, w.now),
            subject,
            count: unreached,
            of: mine.length,
            days_since_spoken: null,
            amount_cents: null,
            currency: null,
            person_id: null,
            person: null,
            link: { kind: 'thread', id: threadId },
            minutes: 0,
          in: segmentsFor(prepareAt, w),
          });
        }
      }

      const unpaid = mine.filter(
        (e) => e.payment_status === 'pending' || e.payment_status === 'failed',
      ).length;
      if (unpaid > 0) {
        const prepareAt = new Date(happensAt.getTime() - LEAD_DAYS.thread_unpaid * DAY);
        prepare.push({
          id: `unpaid:${threadId}`,
          signal: 'thread_unpaid',
          prepare_at: prepareAt.toISOString(),
          happens_at: next.starts_at,
          lead_days: LEAD_DAYS.thread_unpaid,
          days_until: daysBetween(happensAt, w.now),
          subject,
          count: unpaid,
          of: mine.length,
          days_since_spoken: null,
          amount_cents: null,
          currency: null,
          person_id: null,
          person: null,
          link: { kind: 'thread', id: threadId },
          minutes: 0,
          in: segmentsFor(prepareAt, w),
        });
      }
    }

    // ── PREPARE 3: the meeting brief ───────────────────────────────────────
    // The one facilitators will care about most. A meeting always needs a
    // brief, so unlike the thread signals this one fires on every booking —
    // what varies is how loudly, and that is what days_since_spoken carries.
    const bookingsEnd = new Date(w.nextWeekEnd.getTime() + LEAD_DAYS.meeting_brief * DAY);
    const { data: bookingRows, error: bookErr } = await adminClient
      .from('meet_booking')
      .select('id, starts_at, status, invitee_person_id, invitee_name, invitee_email, meeting_type_id')
      .eq('workspace_id', ws)
      .eq('status', 'confirmed')
      .gte('starts_at', w.now.toISOString())
      .lt('starts_at', bookingsEnd.toISOString())
      .order('starts_at', { ascending: true })
      .limit(MAX_BOOKINGS);
    if (bookErr) throw new Error(`meet_booking: ${bookErr.message}`);
    const bookings = ((bookingRows ?? []) as Record<string, string | null>[]).slice(
      0,
      MAX_BRIEFS,
    );

    const typeName = new Map<string, string>();
    const typeIds = [
      ...new Set(bookings.map((b) => b.meeting_type_id).filter(Boolean) as string[]),
    ];
    if (typeIds.length) {
      const { data, error } = await adminClient
        .from('meet_meeting_type')
        .select('id, name')
        .eq('workspace_id', ws)
        .in('id', typeIds);
      if (error) throw new Error(`meet_meeting_type: ${error.message}`);
      for (const t of (data ?? []) as { id: string; name: string }[]) {
        typeName.set(t.id, t.name);
      }
    }

    // last_spoken_at() counts PERSONAL contact only — a newsletter is not a
    // conversation, and if a mailshot reset this the brief would cheerfully
    // report a dead relationship as healthy. One call per person, which is
    // affordable precisely because the set is capped at MAX_BRIEFS: this is
    // the smallest list on the page, by design.
    const briefPeople = [
      ...new Set(bookings.map((b) => b.invitee_person_id).filter(Boolean) as string[]),
    ];
    const spokenAt = new Map<string, number | null>();
    await Promise.all(
      briefPeople.map(async (pid) => {
        const { data, error } = await adminClient.rpc('last_spoken_at', { p_person: pid });
        if (error) {
          // A missing brief is a worse outcome than a brief without the
          // "you last spoke" line, so this degrades rather than fails.
          console.error('[connections/today] last_spoken_at failed', pid, error.message);
          spokenAt.set(pid, null);
          return;
        }
        spokenAt.set(pid, data ? new Date(data as string).getTime() : null);
      }),
    );

    for (const b of bookings) {
      const happensAt = new Date(b.starts_at as string);
      const prepareAt = new Date(happensAt.getTime() - LEAD_DAYS.meeting_brief * DAY);
      const pid = b.invitee_person_id ?? null;
      const last = pid ? spokenAt.get(pid) ?? null : null;
      prepare.push({
        id: `brief:${b.id}`,
        signal: 'meeting_brief',
        prepare_at: prepareAt.toISOString(),
        happens_at: b.starts_at as string,
        lead_days: LEAD_DAYS.meeting_brief,
        days_until: daysBetween(happensAt, w.now),
        subject:
          b.invitee_name ||
          b.invitee_email ||
          (b.meeting_type_id ? typeName.get(b.meeting_type_id) : null) ||
          '',
        count: null,
        of: null,
        days_since_spoken: last === null ? null : daysBetween(w.now, new Date(last)),
        amount_cents: null,
        currency: null,
        person_id: pid,
        person: null,
        link: pid ? { kind: 'person', id: pid } : null,
        minutes: 0,
          in: segmentsFor(prepareAt, w),
      });
    }

    // ── PREPARE 4: money expected, invoice not sent ────────────────────────
    //
    // `pulse_commitment_line` is the payment SCHEDULE, and its truth levels
    // (expected → invoiced → settled) are what make this computable at all:
    // a line with an expected_date and no invoiced_at is an invoice somebody
    // still has to write. `pulse_commitment_item.expected_date` is the input
    // that FANS OUT into these lines, so it is the wrong table to read —
    // reading it would count a split payment twice.
    const { data: commitRows, error: cErr } = await adminClient
      .from('pulse_commitment')
      .select('id, label, person_id, organisation_id, stage')
      .eq('workspace_id', ws)
      .is('deleted_at', null)
      .eq('direction', 'in')
      .in('stage', ['proposal', 'committed'])
      .limit(MAX_COMMITMENTS);
    if (cErr) throw new Error(`pulse_commitment: ${cErr.message}`);
    const commitments = new Map(
      ((commitRows ?? []) as Record<string, string | null>[]).map((r) => [r.id as string, r]),
    );

    if (commitments.size) {
      // One row per workspace; absent means Pulse was never set up, and EUR
      // is its own default. Read rather than assumed — a number labelled in
      // the wrong currency is worse than one with no label.
      const { data: settings } = await adminClient
        .from('pulse_settings')
        .select('currency')
        .eq('workspace_id', ws)
        .maybeSingle();
      const currency = ((settings as { currency?: string } | null)?.currency) ?? 'EUR';

      const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
      const { data: lineRows, error: lErr } = await adminClient
        .from('pulse_commitment_line')
        .select('id, commitment_id, expected_date, amount_cents, invoiced_at, settled_at')
        .in('commitment_id', [...commitments.keys()])
        .is('invoiced_at', null)
        .is('settled_at', null)
        .gte('expected_date', dateOnly(new Date(w.dayStart.getTime() - MONEY_LOOKBACK_DAYS * DAY)))
        .lte('expected_date', dateOnly(w.nextWeekEnd))
        .order('expected_date', { ascending: true })
        .limit(MAX_MONEY_LINES);
      if (lErr) throw new Error(`pulse_commitment_line: ${lErr.message}`);

      for (const l of (lineRows ?? []) as Record<string, string | number | null>[]) {
        const commitment = commitments.get(l.commitment_id as string);
        if (!commitment) continue;
        const happensAt = new Date(`${l.expected_date as string}T00:00:00.000Z`);
        const prepareAt = new Date(
          happensAt.getTime() - LEAD_DAYS.money_uninvoiced * DAY,
        );
        const pid = commitment.person_id ?? null;
        prepare.push({
          id: `money:${l.id as string}`,
          signal: 'money_uninvoiced',
          prepare_at: prepareAt.toISOString(),
          happens_at: happensAt.toISOString(),
          lead_days: LEAD_DAYS.money_uninvoiced,
          days_until: daysBetween(happensAt, w.now),
          subject: (commitment.label as string) ?? '',
          count: null,
          of: null,
          days_since_spoken: null,
          amount_cents: typeof l.amount_cents === 'number' ? l.amount_cents : null,
          currency,
          person_id: pid,
          person: null,
          link: pid ? { kind: 'person', id: pid } : null,
          minutes: 0,
          in: segmentsFor(prepareAt, w),
        });
      }
    }

    // ── Hydration ──────────────────────────────────────────────────────────
    // Names in a second query rather than a join, once for the whole page.
    const personIds = [
      ...new Set(
        [...owed.map((o) => o.person_id), ...prepare.map((p) => p.person_id)].filter(
          Boolean,
        ) as string[],
      ),
    ];
    if (personIds.length) {
      const { data, error } = await adminClient
        .from('person')
        .select('id, first_name, last_name, email')
        .eq('workspace_id', ws)
        .in('id', personIds);
      if (error) throw new Error(`person: ${error.message}`);
      const byId = new Map(
        ((data ?? []) as PersonRef[]).map((p) => [p.id, p]),
      );
      for (const o of owed) o.person = o.person_id ? byId.get(o.person_id) ?? null : null;
      for (const p of prepare) p.person = p.person_id ? byId.get(p.person_id) ?? null : null;
    }

    const orgIds = [
      ...new Set(owed.map((o) => o.organisation_id).filter(Boolean) as string[]),
    ];
    if (orgIds.length) {
      const { data, error } = await adminClient
        .from('organisation')
        .select('id, name')
        .eq('workspace_id', ws)
        .in('id', orgIds);
      if (error) throw new Error(`organisation: ${error.message}`);
      const byId = new Map(((data ?? []) as OrgRef[]).map((o) => [o.id, o]));
      for (const o of owed) {
        o.organisation = o.organisation_id ? byId.get(o.organisation_id) ?? null : null;
      }
    }
  } catch (e) {
    console.error('[connections/today] failed', (e as Error).message);
    return c.json({ error: (e as Error).message }, 500);
  }

  // Estimates, after everything is collected: one read of the workspace's
  // overrides, applied to every row. A failed read falls back to the shipped
  // defaults inside loadEffortOverrides rather than failing the page.
  const overrides = await loadEffortOverrides(ws);
  for (const o of owed) o.minutes = effortFor(o.kind, null, overrides);
  for (const p of prepare) p.minutes = effortFor(p.signal, p.count, overrides);

  // Counts for ALL four segments — the number is what you read before you
  // tap, and "next week is heavy" is only visible if next week was counted.
  // Minutes beside them turn the count into a plan (connections-overview §3).
  const segments = HORIZONS.map((key) => {
    const rows = [...owed.filter((o) => o.in[key]), ...prepare.filter((p) => p.in[key])];
    return { key, count: rows.length, minutes: rows.reduce((sum, r) => sum + r.minutes, 0) };
  });

  const owedNow = owed
    .filter((o) => o.in[horizon])
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const prepareNow = prepare
    .filter((p) => p.in[horizon])
    .sort((a, b) => a.prepare_at.localeCompare(b.prepare_at));

  return c.json({
    now: w.now.toISOString(),
    horizon,
    segments,
    owed: owedNow,
    prepare: prepareNow,
  });
});
