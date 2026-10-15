// What a THREAD TEMPLATE carries — every column of every table it captures,
// accounted for, and ONE list used both ways: by "save as template" to write
// the structure, and by "new thread from template" to read it back.
//
// The same disease as the duplicate route (lib/thread-copy.ts): two
// hand-written lists, one on each side, that fell behind the tables. A
// template saved the RSVP switch nowhere and the enrolment note nowhere, and
// carried system messages without their role — so a thread made from it got
// a second set seeded on first open. An integration test reads each table's
// real columns and fails when one is in none of carry / set / skip.

export type TemplateSpec = {
  /** Written into the structure under the same name and read back. */
  carry: readonly string[];
  /** Given a value when the thread is made from the template. Why, for each. */
  set: Readonly<Record<string, string>>;
  /** Left out on purpose. Why, for each. */
  skip: Readonly<Record<string, string>>;
};

export const TEMPLATE_THREAD: TemplateSpec = {
  carry: [
    'intention', 'timezone', 'language', 'facilitation_language', 'public_scope', 'cover_url',
    'requires_approval', 'public_interaction', 'price_cents', 'price_currency', 'payment_methods',
    'capacity', 'registration_fields', 'certificate_enabled', 'certificate_criteria',
    'certificate_template_id',
    // Joined 2026-10-15 — each was set on a thread and silently dropped by
    // the template.
    'enrolment_note', 'rsvp_enabled', 'share_participants_public', 'share_participants_participants',
    'public_agenda', 'public_enrolment_open', 'payment_destination',
  ],
  set: {
    workspace_id: 'the workspace applying the template',
    program_id: 'a new draft programme for the new thread',
    organiser_id: 'the person applying the template',
    slug: 'chosen when applying',
    is_public_listed: 'a new thread starts unlisted',
    created_by: 'the person applying the template',
    system_messages_seeded: 'set by seedTemplateEngagements to the roles of the system messages the template brought, so they are not seeded twice',
  },
  skip: {
    id: 'a new row',
    created_at: 'made now',
    updated_at: 'made now',
    team_id: 'whoever applies the template decides where the new thread lives',
    organisation_id: 'a workspace-scoped id; a template can be shared into another workspace',
    locked_at: 'a lock is a decision about one thread',
    locked_by: 'as locked_at',
    main_facilitator_id: 'a host row of the original thread; hosts are people of one run, not part of the shape',
    signups_close_engagement_id: 'an id of the original thread; a thread made from a template closes at its first key moment until one is chosen',
  },
};

export const TEMPLATE_ENGAGEMENT: TemplateSpec = {
  carry: [
    'type', 'title', 'description', 'position', 'location', 'location_url', 'image_url',
    'meeting_url', 'meeting_provider', 'show_in_agenda', 'content', 'trigger_kind',
    'trigger_offset_days', 'trigger_time',
    // Joined 2026-10-15.
    'rsvp_enabled', 'system_role',
    // Joined 2026-10-16.
    'is_key_moment',
  ],
  set: {
    workspace_id: 'the workspace applying the template',
    thread_id: 'the new thread',
    created_by: 'the person applying the template',
    starts_at: 'rebased onto the new start date (day_offset + time_of_day)',
    ends_at: 'rebased (duration_minutes)',
    scheduled_at: 'rebased, for fixed-time messages',
    trigger_anchor: "'engagement' becomes 'start': the anchor's id does not survive the template",
  },
  skip: {
    id: 'a new row',
    created_at: 'made now',
    updated_at: 'made now',
    trigger_engagement_id: 'an id of the original thread',
    status: 'a thread made from a template starts with its items as drafts, as it always has — the editor and the published /apps route (MCP thread_create, "makes drafts") both rely on it',
    daily_schedule: 'absolute dates of one run',
    source_app: 'an external app owns the original, not the template',
    source_ref: 'as source_app',
    calendar_sequence: 'no invitation has gone out for the new thread',
    calendar_sent_at: 'as calendar_sequence',
    excluded_people: 'host rows of the original thread',
    room_owner_id: 'a host row of the original thread',
    meeting_account_user_id: 'a person’s account belongs to one run',
    invited_hosts: 'no invitation has gone out for the new thread',
  },
};

export const TEMPLATE_TICKET: TemplateSpec = {
  carry: ['name', 'description', 'price_cents', 'price_currency', 'quantity_limit', 'payment_methods', 'is_active', 'position'],
  set: { workspace_id: 'the workspace applying the template', thread_id: 'the new thread' },
  skip: {
    id: 'a new row',
    created_at: 'made now',
    available_until: 'an absolute sales deadline of one run — three months later it would already have passed',
  },
};

/** The carried fields of one source row, for the structure. */
export function carriedOut(spec: TemplateSpec, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of spec.carry) if (k in row) out[k] = row[k];
  return out;
}

/** The carried fields read back from a structure. A key the structure does
 *  not hold (a template saved before it was carried) is LEFT OUT, so the
 *  column keeps its database default rather than becoming null. */
export function carriedIn(spec: TemplateSpec, structure: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of spec.carry) if (k in structure && structure[k] !== undefined) out[k] = structure[k];
  return out;
}

export function accountedFor(spec: TemplateSpec): Set<string> {
  return new Set([...spec.carry, ...Object.keys(spec.set), ...Object.keys(spec.skip)]);
}
