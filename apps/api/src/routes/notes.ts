// Conversation notes — the capture primitive.
//
// A note is the one thing in Connections that cannot be derived. Everything
// else on those surfaces is computed from what other apps recorded; this is
// the part a person types, which is why the capture rules in
// docs/connections-data-integrity.md §7 are enforced here rather than left to
// the interface:
//
//   - Autosave, not a save button. The client mints a client_ref before its
//     first attempt and every subsequent write upserts the same row. The
//     idempotency key and the autosave key are the same key.
//   - A draft is a real state. Autosave creates a row before the user has
//     decided anything, so nothing derived fires until a draft commits.
//   - Default from context, never ask. kind, happened_at and the subject all
//     arrive from wherever the capture came from; the interface's job is one
//     text box and a name.
//   - Offer the next action, do not block on it. follow_up_at is optional;
//     leaving it empty is allowed, and the omission surfaces in the
//     attention list rather than in a modal (D30).
//
// The body never crosses the data wall. Committing a note writes ONE activity
// row carrying type + subject only — the platform learns that a conversation
// happened, never what was said.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const notesRoutes = new Hono();

/** Vocabulary lives here, not in a CHECK constraint — adding one is a deploy.
 *  Broadcast kinds are separated deliberately: a newsletter is not a
 *  conversation, and only personal kinds count as "last spoken" (D19). */
const PERSONAL_KINDS = ['call', 'meeting', 'message', 'note'] as const;
const BROADCAST_KINDS = ['email'] as const;
const KINDS = [...PERSONAL_KINDS, ...BROADCAST_KINDS] as const;
const ORIGINS = ['manual', 'calendar_scan', 'bcc', 'import'] as const;

const NoteUpsert = z.object({
  /** Client-generated. The same value on every retry and every autosave. */
  client_ref: z.string().uuid(),
  person_id: z.string().uuid().nullable().optional(),
  organisation_id: z.string().uuid().nullable().optional(),
  flow_run_id: z.string().uuid().nullable().optional(),
  body: z.string().max(20000).default(''),
  kind: z.enum(KINDS).default('note'),
  origin: z.enum(ORIGINS).default('manual'),
  happened_at: z.string().datetime({ offset: true }).optional(),
  /** IANA zone of wherever the capture happened. Validated, because an
   *  unvalidated timezone string is a live wound in this codebase already. */
  happened_tz: z.string().max(64).nullable().optional(),
  follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
  /** True while the composer is open. Derived effects fire on the first
   *  commit (is_draft false), never per keystroke. */
  is_draft: z.boolean().default(true),
  /**
   * Tags the composer showed as chips and the person did not remove.
   *
   * Sent explicitly rather than re-detected here, and that is the whole
   * design: detection runs once, in the composer, and what the person SAW is
   * what gets written. Re-running the match server-side would be a second
   * implementation of the same rules, free to disagree with the chips — and
   * the first time it disagreed, somebody would be tagged with a word they
   * watched themselves remove.
   *
   * `organisation_id` is present when the word names an organisation this
   * workspace holds, which is how "met her at EBBF" connects a person to a
   * real entity rather than to a loose word.
   */
  tags: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        organisation_id: z.string().uuid().optional(),
      }),
    )
    .max(20)
    .optional(),
});

function validTimezone(tz: string | null | undefined): boolean {
  if (!tz) return true;
  try {
    // Intl.supportedValuesOf is the check the Thread editor crash of
    // 2026-09-08 went without. Fall back to constructing a formatter on
    // runtimes that lack it.
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone');
    if (list) return list.includes(tz);
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A note with no body and no follow-up is not a conversation. Abandoned
 *  drafts must never read as "you spoke to them". */
function isEmpty(body: string, followUp: string | null | undefined): boolean {
  return body.trim().length < 2 && !followUp;
}

// PUT /notes — create or update by client_ref. The only write path.
//
// Idempotent by construction: update-first-insert-second on
// (workspace_id, client_ref), the same shape the purchase ledger uses so
// webhook retries and double-submits are harmless.
notesRoutes.put('/', async (c) => {
  const ctx = c.get('ctx');
  const parsed = NoteUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const d = parsed.data;

  if (!d.person_id && !d.organisation_id && !d.flow_run_id) {
    return c.json({ error: 'a note must be about a person, an organisation or a run' }, 400);
  }
  if (!validTimezone(d.happened_tz)) {
    return c.json({ error: `unknown timezone: ${d.happened_tz}` }, 400);
  }

  const row = {
    workspace_id: ctx.workspaceId,
    person_id: d.person_id ?? null,
    organisation_id: d.organisation_id ?? null,
    flow_run_id: d.flow_run_id ?? null,
    body: d.body,
    kind: d.kind,
    origin: d.origin,
    happened_at: d.happened_at ?? new Date().toISOString(),
    happened_tz: d.happened_tz ?? null,
    follow_up_at: d.follow_up_at ?? null,
    is_draft: d.is_draft,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await adminClient
    .from('flow_run_note')
    .select('id, is_draft, follow_up_task_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('client_ref', d.client_ref)
    .is('deleted_at', null)
    .maybeSingle();

  let noteId: string;
  const wasDraft = existing?.is_draft ?? true;

  if (existing) {
    const { error } = await adminClient
      .from('flow_run_note')
      .update(row)
      .eq('id', existing.id);
    if (error) {
      console.error('[notes] update failed', { code: error.code, message: error.message });
      return c.json({ error: error.message }, 500);
    }
    noteId = existing.id;
  } else {
    const { data: created, error } = await adminClient
      .from('flow_run_note')
      .insert({ ...row, client_ref: d.client_ref, created_by: ctx.userId || null })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[notes] insert failed', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      });
      return c.json({ error: error?.message ?? 'create failed' }, 500);
    }
    noteId = created.id;
  }

  // Derived effects fire ONCE, on the transition from draft to committed —
  // never per keystroke, or the append-only trail fills with a hundred rows
  // for one conversation.
  const justCommitted = wasDraft && !d.is_draft && !isEmpty(d.body, d.follow_up_at);
  let followUpTaskId = existing?.follow_up_task_id ?? null;

  if (justCommitted) {
    // 1. The follow-up becomes a flow_task. Every next action is a task —
    //    there is no second to-do list (D3).
    if (d.follow_up_at && d.person_id && !followUpTaskId) {
      const { data: task, error: tErr } = await adminClient
        .from('flow_task')
        .insert({
          workspace_id: ctx.workspaceId,
          title: 'Follow up',
          actor_type: 'personal',
          assignee_user_id: ctx.userId || null,
          contact_id: d.person_id,
          organisation_id: d.organisation_id ?? null,
          due_at: d.follow_up_at,
          created_by: ctx.userId || null,
        })
        .select('id')
        .single();
      if (tErr) console.warn('[notes] follow-up task failed (non-fatal)', tErr.message);
      else {
        followUpTaskId = task.id;
        await adminClient
          .from('flow_run_note')
          .update({ follow_up_task_id: followUpTaskId })
          .eq('id', noteId);
      }
    }

    // 2. Tags, find-or-created and attached to the person.
    //
    //    On commit only, like everything else here: a draft is somebody
    //    still thinking, and creating workspace vocabulary from a sentence
    //    that is later deleted would leave litter nobody asked for.
    //
    //    Failures are warned and swallowed. A tag is an enrichment; losing
    //    one must never cost somebody the note they actually wrote, which is
    //    the thing that cannot be derived from anything else.
    if (d.person_id && d.tags?.length) {
      await applyTags(ctx.workspaceId, d.person_id, noteId, d.tags);
    }

    // 3. One activity row. Type + subject only — the body never crosses.
    if (d.person_id) {
      const { data: app } = await adminClient
        .from('app')
        .select('id')
        .eq('slug', 'fibre-flow')
        .maybeSingle();
      if (app) {
        const first = d.body.trim().split('\n')[0] ?? '';
        await adminClient.from('activity').insert({
          workspace_id: ctx.workspaceId,
          person_id: d.person_id,
          app_id: app.id,
          type: `fibre-flow.${d.kind}.logged`,
          subject: first.slice(0, 200) || `A ${d.kind} was logged`,
          occurred_at: row.happened_at,
          created_by: ctx.userId || null,
        });
      }
    }
  }

  return c.json({ id: noteId, committed: justCommitted, follow_up_task_id: followUpTaskId });
});

/**
 * Find-or-create each tag in the workspace, then attach it to the person.
 *
 * Find-or-create rather than insert: `tag` is unique on (workspace_id, name),
 * so two people writing "outreach" in the same minute must converge on one
 * tag rather than one of them failing. The upsert with ignoreDuplicates
 * handles the race without a transaction.
 *
 * `person_tag` is upserted with ignoreDuplicates too, because a person can
 * be tagged with the same word by several notes over months and the first
 * one is the one that means something — overwriting `created_at` and
 * `note_id` each time would keep rewriting history to say the tag arrived
 * today, which is exactly what the epoch backfill in the migration exists to
 * avoid.
 */
async function applyTags(
  workspaceId: string,
  personId: string,
  noteId: string,
  tags: { name: string; organisation_id?: string | undefined }[],
): Promise<void> {
  try {
    // organisation_id is always present in the shape, null when the word is
    // not an organisation's name. A conditional spread would give the array a
    // union element type that PostgREST's generated types reject.
    const rows = tags.map((t) => ({
      workspace_id: workspaceId,
      name: t.name.trim(),
      organisation_id: t.organisation_id ?? null,
    }));

    const { error: upErr } = await adminClient
      .from('tag')
      .upsert(rows, { onConflict: 'workspace_id,name', ignoreDuplicates: true });
    if (upErr) {
      console.warn('[notes] tag upsert failed (non-fatal)', upErr.message);
      return;
    }

    // Read back by name — the upsert above returns nothing for rows it
    // ignored, so the ids have to be fetched rather than assumed.
    const { data: found, error: selErr } = await adminClient
      .from('tag')
      .select('id,name')
      .eq('workspace_id', workspaceId)
      .in(
        'name',
        rows.map((r) => r.name),
      );
    if (selErr || !found?.length) {
      if (selErr) console.warn('[notes] tag read-back failed (non-fatal)', selErr.message);
      return;
    }

    const { error: linkErr } = await adminClient.from('person_tag').upsert(
      found.map((t) => ({
        person_id: personId,
        tag_id: t.id as string,
        note_id: noteId,
        created_via: 'note',
      })),
      { onConflict: 'person_id,tag_id', ignoreDuplicates: true },
    );
    if (linkErr) console.warn('[notes] person_tag link failed (non-fatal)', linkErr.message);
  } catch (e) {
    console.warn('[notes] applyTags threw (non-fatal)', e);
  }
}

const ListQuery = z.object({
  person_id: z.string().uuid().optional(),
  organisation_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Drafts are the author's own unfinished business; off by default. */
  include_drafts: z.coerce.boolean().default(false),
});

// GET /notes?person_id=… — a person's conversation history, newest first.
notesRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const q = parsed.data;

  if (!q.person_id && !q.organisation_id) {
    return c.json({ error: 'person_id or organisation_id is required' }, 400);
  }

  let query = adminClient
    .from('flow_run_note')
    .select('id, body, kind, origin, happened_at, happened_tz, follow_up_at, is_draft, created_by, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .order('happened_at', { ascending: false })
    .limit(q.limit);

  if (q.person_id) query = query.eq('person_id', q.person_id);
  if (q.organisation_id) query = query.eq('organisation_id', q.organisation_id);
  if (!q.include_drafts) query = query.eq('is_draft', false);

  const { data, error } = await query;
  if (error) {
    console.error('[notes] list failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// DELETE /notes/:id — soft, like everything holding personal data.
notesRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const { error } = await adminClient
    .from('flow_run_note')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

export { KINDS as NOTE_KINDS, PERSONAL_KINDS, BROADCAST_KINDS, ORIGINS as NOTE_ORIGINS };
