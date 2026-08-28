// Reserved slugs — anything that would collide with Meet's actual routes
// if a user picked it as a host slug, team slug, or meeting-type slug.
//
// Why this exists: until v0.13.19, nothing stopped a host from naming
// themselves `settings` — the resulting URL `meet.thefibre.app/settings`
// matches the `(app)/settings` route group instead of `[hostSlug]`, and
// the host becomes silently unreachable. Same shape for MT slugs (would
// collide with `confirmed/<bookingId>` etc.) and team slugs.
//
// We gate at the API layer (zod refine), not the DB, so the error is a
// nice 400 with a field-specific message instead of a constraint
// violation.

// Top-level + auth routes under apps/meet/app/.
// Host slugs and team slugs route here directly via the [hostSlug] catch.
const TOP_LEVEL_ROUTES = [
  'app',
  'auth',
  'invite',
  'no-access',
  'sign-in',
  'signup',
  'login',
] as const;

// (app) route group — internal authenticated routes. Host/team slugs
// can't visually collide because Next ignores the group, but listing
// them protects against UI ambiguity ("my team is called Settings").
const APP_GROUP_ROUTES = [
  'bookings',
  'contacts',
  'dashboard',
  'internal-team',
  'meeting-types',
  'organisations',
  'persons',
  'programmes',
  'programs',
  'settings',
  'teams',
] as const;

// Sub-paths used under `[hostSlug]/[mtSlug]/`. Reserved for MT slugs.
// Listing them in the shared set is harmless for host/team slugs too.
const MT_SUBPATHS = ['confirmed', 'cancel', 'reschedule'] as const;

// Top-level routes under apps/thread/app/. Organiser and team slugs route
// through [organiserSlug] at the same level, so any of these taken as a slug
// makes that organiser silently unreachable — the exact bug this file was
// created for, which had only ever been fixed for Meet. No existing organiser
// or team holds one (checked 2026-08-29 before adding them).
const THREAD_ROUTES = ['certificate', 'developers', 'embed', 'my'] as const;

// Conventional infra / SaaS-y reserves. Cheap to deny up front.
const INFRA = [
  'api',
  'admin',
  'about',
  'brand',
  'callback',
  'docs',
  'faq',
  'health',
  'help',
  'legal',
  'oauth',
  'privacy',
  'public',
  'pricing',
  'robots',
  'status',
  'support',
  'terms',
  'webhook',
  'webhooks',
  'www',
] as const;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set<string>([
  ...TOP_LEVEL_ROUTES,
  ...APP_GROUP_ROUTES,
  ...MT_SUBPATHS,
  ...THREAD_ROUTES,
  ...INFRA,
]);

/** True if `slug` would collide with a known route. Case-insensitive. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

// Conservative URL-safe pattern: lowercase letters, digits, hyphens.
// 2+ chars, must start and end with alnum (no leading/trailing hyphen).
// Already enforced at min/max in the schema; this adds the character class.
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
