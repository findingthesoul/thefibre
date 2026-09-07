// Site-wide constants. The signup door is env-indirected on purpose:
// today the only working entry is the Fibre request-access flow (signup
// mode is invited); when self-serve ships on app.thethread.app, this
// repoints via config — no rebuild of copy or pages.

export const SIGNUP_URL =
  process.env.NEXT_PUBLIC_SIGNUP_URL ?? 'https://thefibre.app/request-access';

export const APP_URL = 'https://app.thethread.app';

export const CONTACT_EMAIL = 'hello@thethread.app';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';

/** "Start a Thread" href, optionally preselecting a plan on the door. */
export function startHref(planId?: string): string {
  return planId ? `${SIGNUP_URL}?plan=${encodeURIComponent(planId)}` : SIGNUP_URL;
}
