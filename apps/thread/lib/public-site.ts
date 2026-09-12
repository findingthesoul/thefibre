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
