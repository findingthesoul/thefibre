import { appUrl } from '@thefibre/shared';

// The host shown next to slug inputs and booking links ("meet.thefibre.app/…").
// Derived from the same env override the links themselves use, so staging
// shows staging URLs (docs/environments.md Phase 1 audit). NEXT_PUBLIC_* is
// inlined at build time, which makes this safe in client components too —
// but only when the property is accessed statically, hence no dynamic key.
export const MEET_HOST = new URL(
  appUrl('fibre-meet', { NEXT_PUBLIC_MEET_URL: process.env.NEXT_PUBLIC_MEET_URL }),
).host;
