// Shared shapes for The Thread's own API payloads.
// PostgREST returns FK joins as object-or-array depending on the relation;
// normalize with one() before use.

export type ProgramCore = {
  id: string;
  title: string;
  format: 'event' | 'journey';
  status: 'draft' | 'active' | 'completed' | 'archived';
  starts_on: string | null;
  ends_on: string | null;
};

export type OrganiserCore = {
  id: string;
  slug: string;
  display_name: string | null;
  user_id: string;
};

export type ThreadRow = {
  id: string;
  workspace_id: string;
  program_id: string;
  organiser_id: string;
  slug: string;
  intention: string | null;
  timezone: string;
  cover_url: string | null;
  is_public_listed: boolean;
  requires_approval: boolean;
  price_cents: number | null;
  price_currency: string | null;
  payment_destination: 'workspace' | 'personal' | null;
  language: 'en' | 'nl' | 'es' | 'pt' | 'de';
  public_interaction: 'page' | 'popup';
  capacity: number | null;
  registration_fields: RegistrationField[];
  certificate_enabled: boolean;
  certificate_criteria: string | null;
  certificate_template_id: string | null;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  organisation_id: string | null;
  program: ProgramCore | ProgramCore[] | null;
  organiser: OrganiserCore | OrganiserCore[] | null;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
  organisation: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type ThreadMember = {
  role: 'host' | 'facilitator';
  organiser: OrganiserCore | OrganiserCore[] | null;
};

export type WorkspaceMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  workspace_role: string;
};

export type TeamOption = { id: string; name: string; slug: string };

export type RegistrationField = {
  key: string;
  label: string;
  type: 'short' | 'long' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
};

// Engagement families — mirror of the API's rule: type only changes within
// its family after creation.
export const ACTIVITY_TYPES = ['event', 'conversation', 'workshop'] as const;
export const MESSAGE_TYPES = [
  'reflection',
  'practice',
  'message',
  'document',
  'inspiration',
] as const;
export type EngagementType =
  | (typeof ACTIVITY_TYPES)[number]
  | (typeof MESSAGE_TYPES)[number];

export type TriggerKind =
  | 'fixed'
  | 'on_enrolment'
  | 'on_approval'
  | 'on_completion'
  | 'relative';

export type EngagementRow = {
  id: string;
  thread_id: string;
  title: string;
  description: string | null;
  type: EngagementType;
  status: 'draft' | 'published' | 'closed';
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  location_url: string | null;
  meeting_url: string | null;
  meeting_provider: 'google_meet' | 'zoom' | 'teams' | 'personal_room' | 'custom' | null;
  scheduled_at: string | null;
  // Message-family send trigger (see migration 20260702100000).
  trigger_kind: TriggerKind;
  trigger_anchor: 'start' | 'end' | 'engagement' | null;
  trigger_engagement_id: string | null;
  trigger_offset_days: number | null; // signed: negative = before anchor
  trigger_time: string | null; // 'HH:MM' in the thread's timezone
  content: Record<string, unknown>;
  position: number;
  show_in_agenda: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganiserRow = OrganiserCore & {
  workspace_id: string;
  bio: string | null;
  photo_url: string | null;
  timezone: string;
  stripe_account_id: string | null;
  vendor_cut_percent: number;
};

/** PostgREST join normalizer: object-or-array → object. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
