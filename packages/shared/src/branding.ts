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
  /** Legal entity that owns and operates The Fibre. */
  name: 'Solidarity Lab B.V.',
  /** Footer line for public surfaces. */
  hostedLine: 'Hosted in the EU',
};

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
    name: 'Fibre Meet',
    shortName: 'Meet',
    brandLetters: 'fm',
    tagline: 'A meeting is a thing of its own.',
    url: 'https://meet.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_MEET_URL',
    available: true,
  },
  'the-thread': {
    name: 'The Thread',
    shortName: 'Thread',
    brandLetters: 'tt',
    tagline: 'The arc that carries the work.',
    url: 'https://thread.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_THREAD_URL',
    available: true,
  },
  'fibre-sales': {
    name: 'Fibre Sales',
    shortName: 'Sales',
    brandLetters: 'fs',
    tagline: 'Account relationships, deals, invoicing.',
    url: 'https://sales.thefibre.app',
    urlEnv: 'NEXT_PUBLIC_SALES_URL',
    available: false,
  },
  'fibre-learn': {
    name: 'Fibre Learn',
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

/** Domain to scope auth cookies to, for cross-subdomain SSO. */
export function cookieDomain(env?: Record<string, string | undefined>): string | undefined {
  return env?.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
}
