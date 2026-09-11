// The workspace's public site — the wrapper its public pages render inside.
//
// Sjoerd, 2026-09-11, asked for three design styles at workspace level plus
// "the ingredients of a website (image, navbar, logo, intro text, footer,
// privacy (from the fibre), conditions, contact page (with basic form))".
// The ingredients live on thread_settings (migration 20260911193000); this
// is the read side, and the one place that decides what of it is PUBLIC.
//
// The distinction matters: `site_contact_email` is where the contact form's
// mail lands, and it never crosses the wire. A public payload that carried
// it would be a scraper's address book, and the form works without the
// visitor ever learning it — which is most of why the form exists.

import { adminClient } from '../db.js';

export type SiteTheme = 'plain' | 'festival' | 'corporate' | 'community';

export type PublicSite = {
  theme: SiteTheme;
  /** The site's own name, when it differs from the owner's. Null = use the
   *  owner's display name, which is right for almost everybody. */
  name: string | null;
  logo_url: string | null;
  hero_url: string | null;
  headline: string | null;
  /** Sanitised HTML — written through sanitizeRichText. */
  intro: string | null;
  footer_note: string | null;
  links: { label: string; href: string }[];
  contact_enabled: boolean;
  contact_intro: string | null;
};

/** What a workspace that has never opened the editor gets: today's page. */
export const DEFAULT_SITE: PublicSite = {
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

/** Only http(s) links reach a public navbar. A `javascript:` href in a nav
 *  is the same stored-XSS shape the rich-text sanitiser exists for, arriving
 *  through a field nobody thinks of as content. */
function safeLinks(raw: unknown): { label: string; href: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is { label: string; href: string } =>
        !!l && typeof l === 'object' && typeof (l as { href?: unknown }).href === 'string',
    )
    .filter((l) => /^https?:\/\//i.test(l.href.trim()) || l.href.startsWith('/'))
    .slice(0, 8)
    .map((l) => ({ label: String(l.label ?? l.href).slice(0, 60), href: l.href.trim() }));
}

/** The public half of a workspace's site settings. Never throws — a missing
 *  row or a failed read renders the plain page rather than a 500, because
 *  the site config is decoration and the listing under it is the point. */
export async function publicSite(workspaceId: string): Promise<PublicSite> {
  const { data } = await adminClient
    .from('thread_settings')
    .select(
      'site_theme, site_name, site_logo_url, site_hero_url, site_headline, site_intro, site_footer_note, site_links, site_contact_enabled, site_contact_email, site_contact_intro',
    )
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data) return DEFAULT_SITE;
  const theme = (data.site_theme ?? 'plain') as SiteTheme;
  return {
    theme,
    name: data.site_name ?? null,
    logo_url: data.site_logo_url ?? null,
    hero_url: data.site_hero_url ?? null,
    headline: data.site_headline ?? null,
    intro: data.site_intro ?? null,
    footer_note: data.site_footer_note ?? null,
    links: safeLinks(data.site_links),
    // A contact page with nowhere to deliver is a form that eats messages,
    // so the switch and the address have to agree before it is offered.
    contact_enabled: !!data.site_contact_enabled && !!data.site_contact_email,
    contact_intro: data.site_contact_intro ?? null,
  };
}

/** Where a workspace's contact form delivers. Server-side only. */
export async function siteContactEmail(workspaceId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('thread_settings')
    .select('site_contact_enabled, site_contact_email')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data?.site_contact_enabled) return null;
  return (data.site_contact_email as string | null) ?? null;
}
