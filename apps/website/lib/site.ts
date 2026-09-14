// Site-wide constants, derived from the shared branding registry so the hosts
// live in ONE place (the domain-flip lesson). The signup door is
// env-indirected on purpose: today the only working entry is the Fibre
// request-access flow (signup mode is invited); when self-serve ships on
// app.thethread.app, this repoints via config — no rebuild of copy or pages.
//
// This file is imported by client components, so env is read as literal
// `process.env.NEXT_PUBLIC_*` accesses (the only form Next inlines into the
// browser bundle) — never as the whole `process.env` object.

import { appUrl } from '@thefibre/shared';

export const SIGNUP_URL =
  process.env.NEXT_PUBLIC_SIGNUP_URL ??
  `${appUrl('fibre-platform', { NEXT_PUBLIC_FIBRE_URL: process.env.NEXT_PUBLIC_FIBRE_URL })}/request-access`;

/** The Thread door — where "Sign in" and "Open the app" go. */
export const APP_URL = appUrl('the-thread', {
  NEXT_PUBLIC_THREAD_URL: process.env.NEXT_PUBLIC_THREAD_URL,
});

// Not in the registry: ENTITY carries hello@thefibre.app (whitelist) and
// support@thefibre.app, neither of which is this public address.
export const CONTACT_EMAIL = 'hello@thethread.app';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';

/** "Start a Thread" href, optionally preselecting a plan on the door. */
export function startHref(planId?: string): string {
  return planId ? `${SIGNUP_URL}?plan=${encodeURIComponent(planId)}` : SIGNUP_URL;
}
