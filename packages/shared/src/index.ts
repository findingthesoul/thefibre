export const APP_IDS = ['fibre-platform', 'fibre-meet', 'the-thread', 'fibre-flow', 'fibre-sales', 'fibre-learn'] as const;
export type AppId = (typeof APP_IDS)[number];

export {
  APPS,
  ENTITY,
  FOOTER_LINKS,
  BRAND_ASSETS,
  PLATFORM_APP_ID,
  appUrl,
  appName,
  cookieDomain,
  defaultEmailFrom,
  emailSignoff,
  legalFooterLine,
  type AppBrand,
} from './branding.js';

export const PROGRAM_FORMATS = ['meeting', 'event', 'journey', 'self_paced', 'blended'] as const;
export type ProgramFormat = (typeof PROGRAM_FORMATS)[number];

export const ENROLMENT_STATUSES = ['invited', 'enrolled', 'active', 'completed', 'dropped'] as const;
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];

export const CONSENT_PURPOSES = [
  'transactional_email',
  'marketing_email',
  'learning_analytics',
  'cohort_directory',
  'facilitation_data',
  'sales_contact',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const ACTIVITY_TYPES = [
  // Fibre Meet
  'meeting_attended',
  'meeting_facilitated',
  'action_item_assigned',
  // The Thread
  'event_registered',
  'session_attended',
  'journey_step_completed',
  // Fibre Learn
  'lesson_completed',
  'module_completed',
  'assessment_passed',
  // Fibre Sales
  'deal_won',
  'call_made',
  'proposal_sent',
  'meeting_scheduled',
  // Platform
  'user_created',
  'consent_granted',
  'consent_revoked',
  'erasure_completed',
  'programme_completed',
  'correction',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
