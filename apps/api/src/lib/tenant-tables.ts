// Every table whose rows belong to one workspace through a `workspace_id`
// column — what lib/tenant-db.ts may scope. lib/tenant-tables.test.ts derives
// the same set from the migrations and fails, naming the table and this file,
// when the two disagree: a new table with a workspace_id needs one line here.
//
// Deliberately NOT listed, though it has the column:
//   user — `user.workspace_id` is the workspace the account was created in,
//          not the set it belongs to (that is `workspace_member`). Scoping by
//          it would hide every member who joined from elsewhere, and suggest
//          a meaning the column does not have.

export const NOT_TENANCY_KEY: Record<string, string> = {
  user: 'user.workspace_id is the home workspace, not membership; ask workspace_member',
};

export const TENANT_TABLES = [
  'activity', 'activity_ref', 'app_entity_mapping', 'app_key', 'app_record_link', 'assistant_usage',
  'connections_agenda_calendar', 'connections_axis_label', 'connections_band_label',
  'connections_effort_default', 'discount_code', 'flow_definition',
  'flow_document_link', 'flow_run', 'flow_run_note', 'flow_run_note_mention',
  'flow_task', 'hygiene_finding', 'mcp_grant', 'meet_booking',
  'meet_booking_link_request', 'meet_calendar', 'meet_host', 'meet_intake_form',
  'meet_meeting_type', 'meet_poll_invite', 'meet_root_slug', 'member_notification',
  'member_notification_pref', 'membership_access_grant',
  'membership_directory_category', 'membership_directory_entry',
  'membership_drive_binding', 'membership_email_template', 'membership_google_account',
  'membership_member', 'membership_pricing_rule', 'membership_product',
  'membership_product_group', 'membership_product_purchase', 'membership_settings',
  'membership_tier', 'models_model', 'oauth_client', 'org_domain_verification',
  'organisation', 'organisation_distinct', 'organisation_merge', 'person',
  'person_contact_point', 'person_meet_profile', 'person_merge', 'processing_purpose',
  'program', 'public_root_slug', 'pulse_account', 'pulse_budget', 'pulse_budget_line',
  'pulse_cashflow_grant', 'pulse_commitment', 'pulse_commitment_stage_event',
  'pulse_involved_team', 'pulse_offering', 'pulse_project',
  'pulse_projection_snapshot', 'pulse_reservation_rule', 'pulse_settings',
  'pulse_stage', 'purchase', 'purchase_credit_note', 'relationship',
  'retention_policy', 'role_change', 'signup_request', 'tag', 'team',
  'thread_calendar_change', 'thread_calendar_held', 'thread_calendar_nudge',
  'thread_calendar_seen', 'thread_cancellation_request', 'thread_category',
  'thread_certificate', 'thread_certificate_template', 'thread_coupon',
  'thread_engagement', 'thread_enrolment', 'thread_message_hold', 'thread_organiser',
  'thread_organiser_handover', 'thread_owner_history', 'thread_payout', 'thread_rsvp',
  'thread_settings', 'thread_slug_history', 'thread_task', 'thread_team_offer',
  'thread_template', 'thread_template_share', 'thread_thread', 'thread_ticket',
  'usage_overage_charge', 'usage_warning', 'user_active_workspace', 'user_task',
  'workspace_app', 'workspace_assistant', 'workspace_domain', 'workspace_member',
  'workspace_subscription',
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];

const SET: ReadonlySet<string> = new Set(TENANT_TABLES);

export function isTenantTable(table: string): table is TenantTable {
  return SET.has(table);
}
