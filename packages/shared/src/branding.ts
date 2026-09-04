// Single source of truth for app names, URLs, taglines and the legal entity.
// Every UI surface (landing pages, sidebars, footers, app switcher, no-access
// pages) reads from here. White-labelling or a rename is one file change.
//
// Note: URLs default to the production thefibre.app subdomains; override per
// app at deploy time with the env var keys in `urlEnv` below.

import type { AppId } from './index.js';

export type AppBrand = {
  /** Full display name. e.g. 'Fibre Meet' */
  name: string;
  /** Short colloquial name. e.g. 'Meet' */
  shortName: string;
  /** 2-character brand mark used in the sidebar tile. */
  brandLetters: string;
  /** One-line tagline used on the public landing page. */
  tagline: string;
  /** Production URL. Override at deploy time via the matching env var. */
  url: string;
  /** Env var key that overrides url at runtime. */
  urlEnv: string;
  /** Whether the app is operational. If false, the app switcher hides it. */
  available: boolean;
};

export const ENTITY = {
  /** Legal entity that owns and operates the platform. */
  name: 'Solidarity Lab B.V.',
  /** Postal address for the footer line of public emails. */
  address: 'Rotterdam, The Netherlands',
  /** Footer line for public surfaces. */
  hostedLine: 'Hosted in the EU',
  /** Default transactional "from" address. Override via EMAIL_FROM env. */
  emailFromAddress: 'noreply@thefibre.app',
  /** Address recipients should add to their address book to avoid spam filters. */
  whitelistEmail: 'hello@thefibre.app',
  /** Default reply-to / support address. */
  supportEmail: 'support@thefibre.app',
};

/** URLs surfaced in the footer of public emails, and by the policy list a
 *  participant accepts when enrolling. All four are real public routes in
 *  apps/web/app/(public)/ — they must stay that way (they 404'd from the
 *  first email we ever sent until v0.18.2). Note `privacy` is deliberately
 *  /privacy-policy, not /privacy: the latter is the signed-in dashboard where
 *  you manage your own consents. */
export const FOOTER_LINKS = {
  help: 'https://thefibre.app/support',
  about: 'https://thefibre.app/about',
  legal: 'https://thefibre.app/terms',
  privacy: 'https://thefibre.app/privacy-policy',
};

/** Hosted brand assets. Served from apps/web/public/brand/. */
export const BRAND_ASSETS = {
  /** Absolute URL of the handwritten "the fibre" wordmark. */
  logoUrl: 'https://thefibre.app/brand/the-fibre.png',
  /** Native pixel dimensions; used by emails for proper retina rendering. */
  logoNativeWidth: 1404,
  logoNativeHeight: 704,
  /** Alt text for screen readers / image-off email clients. */
  logoAlt: 'The Fibre',
};

/** The platform-app entry, exposed as a constant for convenience. The
 *  product's display name in legal / footer / email-signature contexts. */
export const PLATFORM_APP_ID = 'fibre-platform' as const;

// Display names follow docs/naming-brief.md (decided 2026-09-01): Thread is
// the flagship and stands alone; Meet / Sales / Flow / Learn are plain
// function names serving it; Fibre is the backstage foundation and keeps its
// name only where the audience is technical. SLUGS (the record keys) are
// FKs and published API contract — they NEVER change; only these labels do.
export const APPS: Record<AppId, AppBrand> = {
  'fibre-platform': {
    name: 'The Fibre',
    shortName: 'Fibre',
    brandLetters: 'tf',
    tagline: 'Relationships, kept honestly.',
    url: 'https://thefibre.app',
    urlEnv: 'NEXT_PUBLIC_FIBRE_URL',
    available: true,
  },
  'fibre-meet': {
    name: 'Meet',
    shortName: 'Meet',
    brandLetters: 'fm',
    tagline: 'How meetings happen inside a Thread.',
    url: 'https://meet.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_MEET_URL',
    available: true,
  },
  'the-thread': {
    name: 'Thread',
    shortName: 'Thread',
    brandLetters: 'tt',
    tagline: 'The learning journey a person walks.',
    url: 'https://thread.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_THREAD_URL',
    available: true,
  },
  'fibre-flow': {
    name: 'Flow',
    shortName: 'Flow',
    brandLetters: 'ff',
    tagline: 'The engine underneath — pipelines and task gates.',
    url: 'https://flow.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_FLOW_URL',
    available: true,
  },
  'fibre-pulse': {
    name: 'Pulse',
    shortName: 'Pulse',
    brandLetters: 'fp',
    tagline: 'The heartbeat of the business — cashflow, planned.',
    url: 'https://pulse.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_PULSE_URL',
    available: true,
  },
  'membership': {
    name: 'Membership',
    shortName: 'Membership',
    brandLetters: 'mb',
    tagline: 'Your community, subscribed — tiers, renewals, access.',
    url: 'https://membership.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_MEMBERSHIP_URL',
    available: true,
  },
  'fibre-sales': {
    name: 'Sales',
    shortName: 'Sales',
    brandLetters: 'fs',
    tagline: 'Moving a prospect toward becoming a Thread.',
    url: 'https://sales.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_SALES_URL',
    available: false,
  },
  'fibre-learn': {
    name: 'Learn',
    shortName: 'Learn',
    brandLetters: 'fl',
    tagline: 'Self-paced learning — modules, reflections.',
    url: 'https://learn.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_LEARN_URL',
    available: false,
  },
};

/**
 * Resolve an app's URL, preferring its env override over the registry default.
 * Pass `env` from your runtime (`process.env` on the server). Falls back to
 * the registry URL if the override is empty/undefined.
 */
export function appUrl(slug: AppId, env?: Record<string, string | undefined>): string {
  const meta = APPS[slug];
  const fromEnv = env?.[meta.urlEnv];
  return (fromEnv && fromEnv.trim()) || meta.url;
}

/** The "from" line we want emails to use. Mirrors `EMAIL_FROM` env or builds
 *  a default from ENTITY. Use everywhere instead of hard-coding. */
export function defaultEmailFrom(env?: Record<string, string | undefined>): string {
  const platform = APPS[PLATFORM_APP_ID];
  return env?.EMAIL_FROM || `${platform.name} <${ENTITY.emailFromAddress}>`;
}

/** Single-line legal footer used at the bottom of public emails + landing
 *  pages. e.g. "The Fibre · Rotterdam, The Netherlands · Hosted in the EU".
 *  Excludes the legal entity name (ENTITY.name) by design — it stays in
 *  branding.ts for internal billing / invoicing but isn't on public brand
 *  surfaces. */
export function legalFooterLine(): string {
  const platform = APPS[PLATFORM_APP_ID];
  return `${platform.name} · ${ENTITY.address} · ${ENTITY.hostedLine}`;
}

/** The "— The Fibre" email sign-off. */
export function emailSignoff(): string {
  return `— ${APPS[PLATFORM_APP_ID].name}`;
}

/** App display name by slug. Drop-in for the duplicated `APP_NAMES` maps
 *  scattered across the web app. */
export function appName(slug: AppId): string {
  return APPS[slug]?.name ?? slug;
}
