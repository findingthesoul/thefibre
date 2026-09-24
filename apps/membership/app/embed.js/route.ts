// /embed.js — Membership's website-embed loader, from the shared builder
// (@thefibre/shared/embed-loader). Same integration as the Thread's:
// one script + a data-membership-embed div, auto-sizing, CSS lift.
// Replaces the raw-iframe-plus-inline-script snippets the embeds card
// used to emit (those keep working — the height message is unchanged).

import { APPS } from '@thefibre/shared';
import { buildEmbedLoader } from '@thefibre/shared/embed-loader';

const HEADER = `/* Membership — embeddable widgets (join page, tier cards, join button).
 *
 * Usage on any website (Webflow etc.):
 *   <script src="https://membership.thefibre.app/embed.js" defer></script>
 *
 *   The whole join page — headline, tiers, products:
 *   <div data-membership-embed="page" data-workspace="my-community"></div>
 *
 *   Just the tier cards:
 *   <div data-membership-embed="tiers" data-workspace="my-community"></div>
 *
 *   A button that opens joining in an overlay, leaving the host page up:
 *   <div data-membership-embed="join" data-workspace="my-community"
 *        data-label="Become a member"></div>
 *
 *   A button that navigates to the join page instead:
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
  title: APPS.membership.name,
  header: HEADER,
  kinds: {
    page: {
      path: '/embed/page',
      params: ['workspace', 'theme', 'lang'],
    },
    tiers: {
      path: '/embed/tiers',
      params: ['workspace', 'theme', 'lang'],
    },
    button: {
      path: '/embed/button',
      params: ['workspace', 'label', 'theme', 'lang'],
    },
    // The popup: the host page stays where it is and the join page opens in
    // an overlay above it. The button that triggers it is the `button` embed
    // rendered in trigger mode — the loader handles the overlay, so nothing
    // here has to know how to draw a modal.
    join: {
      mode: 'popup',
      path: '/embed/page',
      params: ['workspace', 'label', 'lang'],
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
