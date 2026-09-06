// /embed.js — the Thread's website-embed loader, served from the shared
// builder (@thefibre/shared/embed-loader) since i18n P1. Same URL, same
// behavior as the old static public/embed.js it replaces (that file is
// gone — public/ assets shadow app routes). The emitted JS is a published
// integration contract: additive-only.

import { buildEmbedLoader } from '@thefibre/shared/embed-loader';

const HEADER = `/* The Thread — embeddable widgets (list, thread, enrol popup).
 *
 * Usage on any website (Webflow etc.):
 *   <script src="https://app.thethread.app/embed.js" defer></script>
 *   <div data-thread-embed="list" data-organiser="sjoerd"></div>
 *   <div data-thread-embed="thread" data-organiser="sjoerd" data-thread="my-event"
 *        data-elements="cover,intention,enrol"></div>
 *   <div data-thread-embed="card" data-organiser="sjoerd" data-thread="my-event"></div>
 *   <div data-thread-embed="card" data-organiser="sjoerd" data-thread="my-event"
 *        data-form="1"></div>   <!-- card WITH the enrolment form in it -->
 *   <a href="#" data-thread-embed="enrol" data-organiser="sjoerd" data-thread="my-event">Enrol</a>
 *
 * List embeds accept data-format="event|journey" to narrow to one kind,
 * and data-category="<slug>" to narrow to one category (Settings → Categories).
 *
 * Optional data-lang="en|nl|es|pt|de|fr" on any embed forces the UI language.
 * Without it, thread + enrol embeds follow the thread's own language; the
 * list falls back to English for its chrome (each popup still opens in the
 * thread's language).
 *
 * Custom CSS: put a <style> block INSIDE the embed element — it is lifted
 * off the host page and injected into the embed iframe (and its popup).
 * Every element carries a stable te-* class; see Settings → Website embeds
 * for the full reference stylesheet.
 *
 * Framework-free, idempotent (safe to include twice). Iframes auto-size via
 * \`thread-embed:height\` postMessages from the embed pages.
 */`;

const JS = buildEmbedLoader({
  ns: 'thread-embed',
  flag: '__threadEmbedLoaded',
  title: 'The Thread',
  header: HEADER,
  kinds: {
    list: {
      path: '/embed/list',
      params: ['organiser', 'team', 'org', 'workspace', 'format', 'category', 'compact', 'theme', 'lang'],
      fixed: { popup: '1' },
    },
    card: {
      path: '/embed/card',
      params: ['organiser', 'thread', 'form', 'theme', 'lang'],
      fixed: { popup: '1' },
    },
    thread: {
      path: '/embed/thread/{organiser}/{thread}',
      params: ['elements', 'theme', 'lang'],
      fixed: { popup: '1' },
    },
    enrol: {
      mode: 'popup',
      path: '/embed/thread/{organiser}/{thread}',
      params: ['lang'],
      fixed: { elements: 'enrol', popup: '1' },
    },
  },
  // A list card with popup interaction was clicked inside the list iframe —
  // open the enrol overlay on the host page.
  popupMessages: {
    'open-enrol': {
      path: '/embed/thread/{organiser}/{thread}',
      params: ['lang'],
      fixed: { elements: 'enrol', popup: '1' },
    },
  },
  // Legacy list-card message (pre data-lang): the public thread URL
  // (…/{organiser}/{thread}) becomes the embed enrol view.
  legacyOpen: { path: '/embed/thread/{0}/{1}', fixed: { elements: 'enrol', popup: '1' } },
});

export function GET() {
  return new Response(JS, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
