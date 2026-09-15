// The tool catalogue: one entry per route an app key may reach.
//
// This is a THIN CLIENT of apps/api/src/middleware/app-context.ts — the
// default-deny allow-list is the contract, and every tool here maps onto one
// line of it. Nothing is added on the assistant's side: no search, no cross-
// workspace anything, no route the key could not call with curl. If a tool
// needs a route the key cannot reach, the answer is a new allow-list entry
// with a scope on the API side, never a wider credential here.
//
// Two things a reader should know about the descriptions:
//   - They say what a tool DOES, not which response fields come back. Response
//     shapes under /api/v1/apps/* are additive-only (CLAUDE.md hard rule 8);
//     restating them here would make this file a second copy of that promise.
//   - Input schemas mirror the request bodies in routes/apps.ts, app-thread.ts,
//     app-flow.ts and activities.ts. Where the API's own schema is large and
//     shared with The Thread's editor (engagements), the tool passes the object
//     through and lets the API's 400 explain — one validator, not two.

import { z } from 'zod';
import type { FibreClient } from './client.js';

/**
 * The scope vocabulary, as apps/api/src/lib/app-keys.ts spells it. Kept as a
 * string union rather than imported: this package ships on its own, outside
 * the API's build. If the API adds a scope, add it here and the tools it gates.
 */
export type AppScope =
  | 'read:persons'
  | 'write:persons'
  | 'read:organisations'
  | 'write:organisations'
  | 'read:activities'
  | 'write:activities'
  | 'write:curator_data'
  | 'write:messages'
  | 'read:flows'
  | 'write:flow_runs'
  | 'read:programs'
  | 'write:programs'
  | 'read:enrolments'
  | 'review:enrolments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyShape = Record<string, z.ZodTypeAny>;

export interface ToolDef<S extends AnyShape = AnyShape> {
  name: string;
  title: string;
  description: string;
  /** The scope the key must hold for this tool to be offered. `null` = any key. */
  scope: AppScope | null;
  readOnly: boolean;
  /** Only meaningful for writes. Defaults: not destructive, not idempotent. */
  destructive?: boolean;
  idempotent?: boolean;
  input: S;
  run: (client: FibreClient, slug: string, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}

// A tiny helper so each entry stays a literal the eye can scan.
function tool<S extends AnyShape>(def: ToolDef<S>): ToolDef<AnyShape> {
  return def as unknown as ToolDef<AnyShape>;
}

const uuid = z.string().uuid();
const recordRef = z.object({
  app_entity: z.string().min(1).max(100).describe('Your entity name, as declared in the manifest'),
  app_record_id: z.string().min(1).max(200).describe('Your own id for the record'),
});

const linkInput = {
  app_entity: z
    .string()
    .min(1)
    .max(100)
    .describe('Your entity name, as declared in the manifest (e.g. "mailchimp_subscriber")'),
  app_record_id: z.string().min(1).max(255).describe('Your own id for this record'),
  match_on: z
    .object({
      email: z.string().email().optional().describe('Primary key for persons'),
      name: z.string().max(200).optional(),
      domain: z.string().max(200).optional().describe('Primary key for organisations'),
    })
    .describe('What to find (or create) the platform record by'),
  create_if_missing: z
    .boolean()
    .optional()
    .describe('Create a platform record when nothing matches. Omit or false to get a not-found instead.'),
};

const apps = (slug: string) => `/api/v1/apps/${encodeURIComponent(slug)}`;
const enc = encodeURIComponent;

export const TOOLS: ToolDef[] = [
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------
  tool({
    name: 'fibre_whoami',
    title: 'Who am I on The Fibre',
    description:
      'Verify the app key and see which app it acts as, which workspace it is bound to, and which scopes it holds. Call this first when unsure what you are allowed to do.',
    scope: null,
    readOnly: true,
    input: {},
    run: (c) => c.whoami(),
  }),
  tool({
    name: 'fibre_get_manifest',
    title: 'Read the app manifest',
    description:
      "Read what this app declared to the platform: its entity mappings (which of your records map to persons or organisations, and how they match) and the activity types it may log. Use it to learn the app_entity names and activity types the other tools accept.",
    scope: null,
    readOnly: true,
    input: {},
    run: (c, slug) => c.request('GET', `${apps(slug)}/manifest`),
  }),

  // -------------------------------------------------------------------------
  // Links — the app's records ↔ platform persons/organisations
  // -------------------------------------------------------------------------
  tool({
    name: 'fibre_link_record',
    title: 'Link one of your records to a person or organisation',
    description:
      'Find (or create) the platform person/organisation behind one of your records and remember the link. Idempotent on (app_entity, app_record_id). Whether it targets a person or an organisation follows the manifest mapping for app_entity; an organisation link needs the write:organisations scope. Store the returned platform id — it is your durable key into The Fibre.',
    scope: 'write:persons',
    readOnly: false,
    idempotent: true,
    input: linkInput,
    run: (c, slug, args) => c.request('POST', `${apps(slug)}/links`, args),
  }),
  tool({
    name: 'fibre_link_records',
    title: 'Link many records at once',
    description:
      'Bulk form of fibre_link_record for an initial sync, up to 500 per call. Each item reports its own outcome; the batch is a partial success (207) unless all of them landed.',
    scope: 'write:persons',
    readOnly: false,
    idempotent: true,
    input: { links: z.array(z.object(linkInput)).min(1).max(500) },
    run: (c, slug, args) => c.request('POST', `${apps(slug)}/links:bulk`, args),
  }),
  tool({
    name: 'fibre_get_link',
    title: 'Look up the link for one of your records',
    description:
      'Which platform person or organisation is one of your records linked to? Only records this app linked itself are visible — there is no search across the workspace.',
    scope: 'read:persons',
    readOnly: true,
    input: recordRef.shape,
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/links/${enc(a.app_entity)}/${enc(a.app_record_id)}`),
  }),
  tool({
    name: 'fibre_get_person',
    title: 'Read the person behind one of your records',
    description:
      'The link plus the platform person row, in one round-trip. Only for records this app linked to a person.',
    scope: 'read:persons',
    readOnly: true,
    input: recordRef.shape,
    run: (c, slug, a) =>
      c.request('GET', `${apps(slug)}/persons/${enc(a.app_entity)}/${enc(a.app_record_id)}`),
  }),
  tool({
    name: 'fibre_get_organisation',
    title: 'Read the organisation behind one of your records',
    description:
      'The link plus the platform organisation row, in one round-trip. Only for records this app linked to an organisation.',
    scope: 'read:organisations',
    readOnly: true,
    input: recordRef.shape,
    run: (c, slug, a) =>
      c.request('GET', `${apps(slug)}/organisations/${enc(a.app_entity)}/${enc(a.app_record_id)}`),
  }),
  tool({
    name: 'fibre_add_org_membership',
    title: 'Connect a person to an organisation',
    description:
      'Record that a person (one of your linked records) belongs to an organisation (another of your linked records), optionally with a title, and optionally as their primary organisation. Both must already be linked.',
    scope: 'write:organisations',
    readOnly: false,
    idempotent: true,
    input: {
      person: recordRef,
      organisation: recordRef,
      title: z.string().max(200).optional().describe('Their role there, free text'),
      is_primary: z.boolean().optional().describe('Their main organisation; marking one unsets the others'),
    },
    run: (c, slug, args) => c.request('POST', `${apps(slug)}/memberships`, args),
  }),

  // -------------------------------------------------------------------------
  // Activity — the sanctioned data-wall crossing
  // -------------------------------------------------------------------------
  tool({
    name: 'fibre_log_activity',
    title: 'Log an activity on a person',
    description:
      "Append one event to a person's timeline: a type your manifest declared plus a short subject line. Type + subject only — never a body, never anything sensitive; the subject is visible to everyone in the workspace. Activity is append-only: there is no edit or delete, so get the type right (fibre_get_manifest lists the declared ones).",
    scope: 'write:activities',
    readOnly: false,
    input: {
      person_id: uuid.describe('Platform person id, e.g. from fibre_link_record'),
      type: z.string().max(64).describe('One of the activity types this app declared'),
      subject: z.string().min(1).max(200).describe('Short, non-sensitive one-liner'),
      occurred_at: z.string().datetime().optional().describe('ISO 8601; defaults to now'),
    },
    run: (c, _slug, args) => c.request('POST', '/api/v1/activities', args),
  }),
  tool({
    name: 'fibre_list_activities',
    title: 'List activity in the workspace',
    description:
      'Newest-first activity across all apps in this workspace, optionally narrowed to a person, an organisation (its current members), an app slug or a type. Cursor-paginated: pass the returned cursor as `after` for the next page.',
    scope: 'read:activities',
    readOnly: true,
    input: {
      person_id: uuid.optional(),
      organisation_id: uuid.optional(),
      app_id: z.string().optional().describe('An app slug, or its uuid'),
      type: z.string().max(64).optional(),
      after: uuid.optional().describe('Cursor from the previous page'),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: (c, _slug, args) => c.request('GET', '/api/v1/activities', undefined, args),
  }),

  // -------------------------------------------------------------------------
  // The Thread — publish a programme, keep its page in step, see who came
  // -------------------------------------------------------------------------
  tool({
    name: 'fibre_thread_templates',
    title: 'List Thread templates',
    description:
      "The workspace's programme templates an event can be built from, with a sense of their size and whether choosing one would send anyone email.",
    scope: 'read:programs',
    readOnly: true,
    input: {},
    run: (c, slug) => c.request('GET', `${apps(slug)}/thread/templates`),
  }),
  tool({
    name: 'fibre_thread_publish',
    title: 'Publish a programme on The Thread',
    description:
      'Create a programme page (an event or a journey) that people can register for. Idempotent on source_ref: a retry returns the existing page instead of a second one. Omit organiser_person_id to publish under the workspace; pass template_id to lay down a template\'s structure rebased onto starts_on. The page starts as a draft — set status to "active" with fibre_thread_update when it should go live.',
    scope: 'write:programs',
    readOnly: false,
    idempotent: true,
    input: {
      title: z.string().min(1).max(200),
      format: z.enum(['event', 'journey']),
      slug: z.string().min(2).max(80).describe('lowercase kebab-case, unique for the organiser'),
      organiser_person_id: uuid.optional().describe('A person with a Fibre account and organiser profile'),
      template_id: uuid.optional(),
      intention: z.string().max(2000).nullable().optional(),
      starts_on: z.string().date().nullable().optional().describe('YYYY-MM-DD'),
      ends_on: z.string().date().nullable().optional().describe('YYYY-MM-DD'),
      timezone: z.string().max(100).optional().describe('IANA zone, e.g. Europe/Amsterdam'),
      source_ref: uuid.nullable().optional().describe('Your own id for this programme; makes the call idempotent'),
    },
    run: (c, slug, args) => c.request('POST', `${apps(slug)}/thread/threads`, args),
  }),
  tool({
    name: 'fibre_thread_list',
    title: 'List the programmes this app published',
    description: 'The Thread pages this app itself published in the workspace. Other organisers\' pages are not visible.',
    scope: 'read:programs',
    readOnly: true,
    input: {},
    run: (c, slug) => c.request('GET', `${apps(slug)}/thread/threads`),
  }),
  tool({
    name: 'fibre_thread_get',
    title: 'Read one published programme',
    description: 'One of the pages this app published, with its current settings and status.',
    scope: 'read:programs',
    readOnly: true,
    input: { thread_id: uuid },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/thread/threads/${a.thread_id}`),
  }),
  tool({
    name: 'fibre_thread_update',
    title: 'Update a published programme',
    description:
      'Change a page this app published: title, dates, intention, cover, capacity, public listing, approval requirement, language, timezone, price, categories (by name — the platform mints unknown ones), and status. Status draft→active makes the page live AND opens registration in one step. Money destinations, tickets, certificates and registration fields cannot be set from here — a human does that in The Thread.',
    scope: 'write:programs',
    readOnly: false,
    idempotent: true,
    input: {
      thread_id: uuid,
      title: z.string().min(1).max(200).optional(),
      intention: z.string().max(2000).nullable().optional(),
      starts_on: z.string().date().nullable().optional(),
      ends_on: z.string().date().nullable().optional(),
      cover_url: z.string().url().max(1000).nullable().optional(),
      is_public_listed: z.boolean().optional(),
      capacity: z.number().int().positive().nullable().optional(),
      status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
      categories: z.array(z.string().min(1).max(60)).max(20).optional(),
      timezone: z.string().min(1).max(100).optional(),
      language: z.enum(['en', 'nl', 'es', 'pt', 'de']).optional(),
      requires_approval: z.boolean().optional(),
      public_interaction: z.enum(['page', 'popup']).optional(),
      share_participants_public: z.boolean().optional(),
      share_participants_participants: z.boolean().optional(),
      price_cents: z.number().int().min(0).nullable().optional().describe('null = free, stated'),
      price_currency: z.string().length(3).nullable().optional(),
    },
    run: (c, slug, { thread_id, ...patch }) =>
      c.request('PATCH', `${apps(slug)}/thread/threads/${thread_id}`, patch),
  }),
  tool({
    name: 'fibre_thread_add_host',
    title: 'Credit a host on a programme',
    description:
      'Name one of your linked persons as a host or facilitator of a page this app published. The person must already be linked with fibre_link_record.',
    scope: 'write:programs',
    readOnly: false,
    idempotent: true,
    input: {
      thread_id: uuid,
      person: recordRef,
      role: z.enum(['host', 'facilitator']).optional(),
    },
    run: (c, slug, { thread_id, ...body }) =>
      c.request('POST', `${apps(slug)}/thread/threads/${thread_id}/hosts`, body),
  }),
  tool({
    name: 'fibre_thread_enrolments',
    title: 'Who registered for a programme',
    description:
      'The registrations on a page this app published, and where each one stands (including whether it is waiting for the organiser\'s approval). Form answers and payment instruments are never included — a payment state is.',
    scope: 'read:enrolments',
    readOnly: true,
    input: { thread_id: uuid },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/thread/threads/${a.thread_id}/enrolments`),
  }),
  tool({
    name: 'fibre_thread_approve_enrolment',
    title: 'Approve an application',
    description:
      'Admit someone who applied to a programme that requires approval. Runs exactly what The Thread\'s own Approve button runs: confirms the registration, sends the confirmation, releases the waiting messages. Idempotent. Only on pages this app published.',
    scope: 'review:enrolments',
    readOnly: false,
    idempotent: true,
    input: { enrolment_id: uuid.describe('The registration id from fibre_thread_enrolments') },
    run: (c, slug, a) => c.request('POST', `${apps(slug)}/thread/enrolments/${a.enrolment_id}/approve`, {}),
  }),
  tool({
    name: 'fibre_thread_decline_enrolment',
    title: 'Decline an application',
    description:
      'Turn down someone who applied to a programme that requires approval, expiring any open checkout. Idempotent. Only on pages this app published.',
    scope: 'review:enrolments',
    readOnly: false,
    destructive: true,
    idempotent: true,
    input: { enrolment_id: uuid.describe('The registration id from fibre_thread_enrolments') },
    run: (c, slug, a) => c.request('POST', `${apps(slug)}/thread/enrolments/${a.enrolment_id}/decline`, {}),
  }),
  tool({
    name: 'fibre_thread_checkin_lookup',
    title: 'Resolve a scanned ticket',
    description:
      'At the door: turn a ticket code (32 hex characters) into who this is, their registration and payment state, and whether they are already checked in.',
    scope: 'review:enrolments',
    readOnly: true,
    input: { code: z.string().regex(/^[0-9a-f]{32}$/) },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/thread/checkin/${a.code}`),
  }),
  tool({
    name: 'fibre_thread_checkin',
    title: 'Check someone in (or undo it)',
    description: 'Mark a registration as arrived, first tap wins. Pass undo to reverse it.',
    scope: 'review:enrolments',
    readOnly: false,
    idempotent: true,
    input: { enrolment_id: uuid, undo: z.boolean().optional() },
    run: (c, slug, { enrolment_id, undo }) =>
      c.request('POST', `${apps(slug)}/thread/enrolments/${enrolment_id}/checkin`, { undo: !!undo }),
  }),
  tool({
    name: 'fibre_thread_engagements',
    title: 'List the engagements on a programme',
    description:
      'The agenda items and scheduled messages on a page this app published. Who received which message is per-person delivery data and never appears.',
    scope: 'read:programs',
    readOnly: true,
    input: { thread_id: uuid },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/thread/threads/${a.thread_id}/engagements`),
  }),
  tool({
    name: 'fibre_thread_add_engagement',
    title: 'Add an engagement to a programme',
    description:
      'Lay down one agenda item (activity family: a session, with starts_at/ends_at/location) or one scheduled message (message family: an email to everyone enrolled, on a trigger) on a page this app published. Required: source_ref (your uuid for it — makes retries idempotent), title, type. Anchor a relative trigger to another of your items with trigger_anchor_ref. The fields are the same ones The Thread\'s own editor sends; the API answers 400 with the exact problem if a field is off. Message-family items additionally need the write:messages scope, because they can email people.',
    scope: 'write:programs',
    readOnly: false,
    idempotent: true,
    input: {
      thread_id: uuid,
      engagement: z
        .object({
          source_ref: uuid,
          title: z.string().min(1).max(200),
          type: z.string().describe('An engagement type The Thread knows, e.g. session, reminder, welcome'),
        })
        .passthrough()
        .describe('The engagement body; extra fields pass straight through to the API'),
    },
    run: (c, slug, { thread_id, engagement }) =>
      c.request('POST', `${apps(slug)}/thread/threads/${thread_id}/engagements`, engagement),
  }),
  tool({
    name: 'fibre_thread_update_engagement',
    title: 'Update an engagement',
    description:
      'Change an engagement this app laid down. Pass only the fields to change; they pass straight through to the API, which answers 400 with the exact problem if one is off.',
    scope: 'write:programs',
    readOnly: false,
    idempotent: true,
    input: {
      engagement_id: uuid,
      changes: z.record(z.unknown()).describe('Fields to change'),
    },
    run: (c, slug, { engagement_id, changes }) =>
      c.request('PATCH', `${apps(slug)}/thread/engagements/${engagement_id}`, changes),
  }),
  tool({
    name: 'fibre_thread_delete_engagement',
    title: 'Delete an engagement',
    description: 'Remove an engagement this app laid down. Needs write:messages, since deleting can silence a scheduled email.',
    scope: 'write:messages',
    readOnly: false,
    destructive: true,
    idempotent: true,
    input: { engagement_id: uuid },
    run: (c, slug, a) => c.request('DELETE', `${apps(slug)}/thread/engagements/${a.engagement_id}`),
  }),

  // -------------------------------------------------------------------------
  // Fibre Flow — consume a process someone authored in Flow
  // -------------------------------------------------------------------------
  tool({
    name: 'fibre_flow_list',
    title: 'List the flows this app may run',
    description:
      'The published workspace flows (step-by-step processes) an app can start runs on. An app consumes flows; it never authors them.',
    scope: 'read:flows',
    readOnly: true,
    input: {},
    run: (c, slug) => c.request('GET', `${apps(slug)}/flow/flows`),
  }),
  tool({
    name: 'fibre_flow_get',
    title: "Read a flow's shape",
    description:
      'The steps of a flow in order, with the tasks each one seeds, optional sections, and per-step app metadata. Also tells you whether the flow is gated (one step at a time) or open (self-paced). Steps are addressed by key.',
    scope: 'read:flows',
    readOnly: true,
    input: { flow_id: uuid },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/flow/flows/${a.flow_id}`),
  }),
  tool({
    name: 'fibre_flow_start_run',
    title: 'Start a run on a flow',
    description:
      "Begin one subject's journey through a flow. The subject can be a person, an organisation, a plain label (a project, an event), or any combination. Idempotent on source_ref: a retry returns the run that already exists.",
    scope: 'write:flow_runs',
    readOnly: false,
    idempotent: true,
    input: {
      flow_id: uuid,
      subject_label: z.string().min(1).max(200).optional(),
      person_id: uuid.optional(),
      organisation_id: uuid.optional(),
      source_ref: uuid.optional().describe('Your own uuid for the subject; makes the call idempotent'),
    },
    run: (c, slug, { flow_id, ...body }) => c.request('POST', `${apps(slug)}/flow/flows/${flow_id}/runs`, body),
  }),
  tool({
    name: 'fibre_flow_runs',
    title: 'List the runs this app owns',
    description: 'Runs this app started, newest first, optionally on one flow. Runs started by people in Flow or by other apps are not visible.',
    scope: 'read:flows',
    readOnly: true,
    input: { flow_id: uuid.optional() },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/flow/runs`, undefined, { flow_id: a.flow_id }),
  }),
  tool({
    name: 'fibre_flow_get_run',
    title: 'Read a run',
    description:
      'Everything about one run in one call: each step with its tasks, your note on it, and a derived status; plus tasks not filed under a step.',
    scope: 'read:flows',
    readOnly: true,
    input: { run_id: uuid },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/flow/runs/${a.run_id}`),
  }),
  tool({
    name: 'fibre_flow_move_run',
    title: 'Move a run to a step',
    description: 'Jump a run to any step by key. No gate, no ordering, no lock.',
    scope: 'write:flow_runs',
    readOnly: false,
    idempotent: true,
    input: { run_id: uuid, step_key: z.string().min(1) },
    run: (c, slug, { run_id, step_key }) => c.request('POST', `${apps(slug)}/flow/runs/${run_id}/move`, { step_key }),
  }),
  tool({
    name: 'fibre_flow_add_task',
    title: 'Add a task to a run',
    description: 'Add a task of your own to a run, optionally filed under a step.',
    scope: 'write:flow_runs',
    readOnly: false,
    input: {
      run_id: uuid,
      title: z.string().min(1).max(300),
      description: z.string().max(4000).nullable().optional(),
      step_key: z.string().min(1).nullable().optional(),
    },
    run: (c, slug, { run_id, ...body }) => c.request('POST', `${apps(slug)}/flow/runs/${run_id}/tasks`, body),
  }),
  tool({
    name: 'fibre_flow_update_task',
    title: 'Update a task',
    description: 'Check a task off (status done), reopen it, cancel it, or retitle it.',
    scope: 'write:flow_runs',
    readOnly: false,
    idempotent: true,
    input: {
      task_id: uuid,
      status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
      title: z.string().min(1).max(300).optional(),
      description: z.string().max(4000).nullable().optional(),
    },
    run: (c, slug, { task_id, ...body }) => c.request('PATCH', `${apps(slug)}/flow/tasks/${task_id}`, body),
  }),
  tool({
    name: 'fibre_flow_get_note',
    title: "Read this app's note on a step",
    description: 'The one note this app keeps on a step of a run.',
    scope: 'read:flows',
    readOnly: true,
    input: { run_id: uuid, step_key: z.string().min(1) },
    run: (c, slug, a) => c.request('GET', `${apps(slug)}/flow/runs/${a.run_id}/steps/${enc(a.step_key)}/note`),
  }),
  tool({
    name: 'fibre_flow_set_note',
    title: "Write this app's note on a step",
    description: 'Rewrite the one note this app keeps on a step of a run, in place. An empty body clears it. It never collides with the log a person keeps in Flow.',
    scope: 'write:flow_runs',
    readOnly: false,
    idempotent: true,
    input: { run_id: uuid, step_key: z.string().min(1), body: z.string().max(20000) },
    run: (c, slug, { run_id, step_key, body }) =>
      c.request('PUT', `${apps(slug)}/flow/runs/${run_id}/steps/${enc(step_key)}/note`, { body }),
  }),
];

/** The tools a key with these scopes may be offered. */
export function toolsForScopes(scopes: readonly string[]): ToolDef[] {
  return TOOLS.filter((t) => t.scope === null || scopes.includes(t.scope));
}
