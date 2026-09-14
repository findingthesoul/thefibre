// The response headers every Fibre surface sends — ONE list (2026-09-14).
//
// Until then no app set any: no HSTS, no nosniff, no referrer policy, no
// framing rule. Each next.config.mjs adds one `headers()` entry that returns
// this, so the list lives here and a new app inherits it the day it exists.
//
// What is deliberately NOT here:
//   - Content-Security-Policy. Nine apps, inline styles from the theme
//     script, Stripe, Google, Vercel analytics: a CSP is real work with a
//     real blast radius, and a wrong one blanks a page for every visitor.
//     Roadmap item in docs/data-protection-approach.md, report-only first.
//   - X-Frame-Options / frame-ancestors on EMBED routes. The Thread's embed
//     pages exist to be framed by any organiser's website (Webflow, Wix), so
//     the framing rule is applied everywhere except those routes — see
//     securityHeaderRoutes().

export type Header = { key: string; value: string };

/** Headers for a page that must not be framed by another site. */
export function securityHeaders(): Header[] {
  return [
    // One year, subdomains too; the apps live on subdomains of both apexes.
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    // A response is what its Content-Type says, never what it looks like.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // A link out of a signed-in page reveals the origin, never the path
    // (paths carry workspace, contact and thread ids).
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Nothing here uses camera, microphone or geolocation.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // Signed-in pages are not framed — clickjacking's whole premise.
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  ];
}

/** The same, minus the framing rule, for routes that exist to be embedded. */
export function embeddableHeaders(): Header[] {
  return securityHeaders().filter(
    (h) => h.key !== 'X-Frame-Options' && h.key !== 'Content-Security-Policy',
  );
}

/**
 * The `headers()` array for a next.config.mjs. Pass the path patterns (Next
 * `source` syntax) that other sites may frame; everything else gets the
 * framing rule. Order matters to Next: the specific embed rule comes first
 * and the catch-all last, and the catch-all excludes the embed paths so a
 * page never receives both answers.
 */
export function securityHeaderRoutes(embeddable: string[] = []): { source: string; headers: Header[] }[] {
  const rules = embeddable.map((source) => ({ source, headers: embeddableHeaders() }));
  const excluded = embeddable.map((s) => s.replace(/^\//, '').replace(/\/:path\*$/, ''));
  const catchAll =
    excluded.length === 0
      ? '/(.*)'
      : `/((?!${excluded.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}).*)`;
  return [...rules, { source: catchAll, headers: securityHeaders() }];
}
