// /embed.js — Membership's website-embed loader, from the shared builder
// (@thefibre/shared/embed-loader). Same integration as the Thread's:
// one script + a data-membership-embed div, auto-sizing, CSS lift.
// Replaces the raw-iframe-plus-inline-script snippets the embeds card
// used to emit (those keep working — the height message is unchanged).

import { buildEmbedLoader } from '@thefibre/shared/embed-loader';

const HEADER = `/* Membership — embeddable widgets (tier cards, join button).
 *
 * Usage on any website (Webflow etc.):
 *   <script src="https://membership.thefibre.app/embed.js" defer></script>
 *   <div data-membership-embed="tiers" data-workspace="my-community"></div>
 *   <div data-membership-embed="button" data-workspace="my-community"
 *        data-label="Become a member"></div>
 *
 * Optional data-lang="en|nl|es|pt|de|fr" on any embed forces the UI
 * language; without it the workspace's own language is used.
 *
 * Custom CSS: put a <style> block INSIDE the embed element — it is lifted
 * off the host page and injected into the embed iframe. Every element
 * carries a stable me-* class (me-card, me-title, me-price, me-btn, …).
 *
 * Framework-free, idempotent (safe to include twice). Iframes auto-size via
 * \`membership-embed:height\` postMessages from the embed pages.
 */`;

const JS = buildEmbedLoader({
  ns: 'membership-embed',
  flag: '__membershipEmbedLoaded',
  title: 'Membership',
  header: HEADER,
  kinds: {
    tiers: {
      path: '/embed/tiers',
      params: ['workspace', 'theme', 'lang'],
    },
    button: {
      path: '/embed/button',
      params: ['workspace', 'label', 'theme', 'lang'],
    },
  },
});

export function GET() {
  return new Response(JS, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
