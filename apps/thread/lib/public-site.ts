// The workspace's public site, as the public pages see it.
//
// Mirror of apps/api/src/lib/public-site.ts — the payload shape, not the
// storage. Sjoerd, 2026-09-11: three design styles at workspace level, plus
// "the ingredients of a website (image, navbar, logo, intro text, footer,
// privacy (from the fibre), conditions, contact page (with basic form))".
//
// A THEME IS A LAYOUT, NOT A SKIN. The three are not one page with different
// colours — they put different things first, because they are for people
// arriving in different states of mind:
//
//   festival   a stranger who must be made to feel something before they read
//   corporate  someone sent here to find a date and a price
//   community  someone who already belongs and wants to know what is on
//
// 'plain' is what every page was before this existed and stays the default,
// so nothing anybody has published changed the day this shipped.
//
// KEEP THIS MODULE FREE OF DIRECTIVES, and think before importing a VALUE
// from it into a 'use client' file. Nine server components read it and one
// client component does — settings/website/form.tsx — and that only works
// because the client one takes `import type { SiteTheme }`, which is erased
// before Next builds a module graph. A value crossing the same way gets
// replaced by a proxy: it typechecks, `next build` says nothing, and it
// crashes on first render. PLAIN_SITE and siteOf are values. See the
// handbook §12, "Sharing a constant between a server and a client
// component" — this file is named there as surviving by accident, and this
// comment is the part that makes it deliberate.

export type SiteTheme = 'plain' | 'festival' | 'corporate' | 'community';

export type PublicSite = {
  theme: SiteTheme;
  name: string | null;
  logo_url: string | null;
  hero_url: string | null;
  headline: string | null;
  /** Sanitised HTML — safe for RichText / dangerouslySetInnerHTML. */
  intro: string | null;
  footer_note: string | null;
  links: { label: string; href: string }[];
  contact_enabled: boolean;
  contact_intro: string | null;
};

export const PLAIN_SITE: PublicSite = {
  theme: 'plain',
  name: null,
  logo_url: null,
  hero_url: null,
  headline: null,
  intro: null,
  footer_note: null,
  links: [],
  contact_enabled: false,
  contact_intro: null,
};

/** An older payload has no `site` key at all — render the plain page. */
export function siteOf(payload: { site?: PublicSite | null } | null | undefined): PublicSite {
  return payload?.site ?? PLAIN_SITE;
}
