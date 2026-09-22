// Where Connect opens.
//
// Sjoerd, 2026-09-22: *"when I open connect - save the last page used.... first
// timer is TODAY."*
//
// The sections somebody may be sent back to. An ALLOW-LIST, not "whatever the
// cookie says": a cookie is written by the browser and a redirect that trusts
// one is a redirect anybody can aim. These are exactly the sidebar's
// destinations (components/shell/sidebar.tsx) plus settings.
export const SECTIONS = [
  'today',
  'attention',
  'landscape',
  'map',
  'people',
  'tags',
  'entries',
  'settings',
] as const;

export type Section = (typeof SECTIONS)[number];

/** The cookie the app writes as you move around. Per-app, unlike the theme:
 *  where you were in Connect says nothing about where you were in Thread. */
export const COOKIE_LAST = 'connect.last';

/** The first segment of a path, when it is a section we will return to. */
export function sectionOf(pathname: string): Section | null {
  const first = pathname.split('?')[0]!.split('/').filter(Boolean)[0];
  return (SECTIONS as readonly string[]).includes(first ?? '') ? (first as Section) : null;
}

/**
 * Where a signed-in visitor lands.
 *
 * Their last section when it is one we know, and TODAY otherwise — which
 * covers the first visit, a cookie that has expired, and anything unexpected
 * in it. Today is the right first answer: it is the page with a reason to be
 * opened every morning.
 */
export function landingPath(cookieValue: string | undefined): string {
  const section = cookieValue ? sectionOf(`/${cookieValue.replace(/^\//, '')}`) : null;
  return `/${section ?? 'today'}`;
}
