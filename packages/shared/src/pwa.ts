// Installing an app: the manifest and the iOS tags, in one place.
//
// Sjoerd, 2026-10-07: "meet app go" — he lives in Meet and wants it in his
// Dock and on his home screen, in its own window with no browser chrome.
//
// By then three apps were already installable (Connect, My Thread, The
// Fibre) and each carried its own hand-written `app/manifest.ts`: the same
// four icon files, the same purposes, the same colour reasoning, written out
// three times. The third began with "Shape copied from
// apps/connections/app/manifest.ts rather than invented", which is a copy
// admitting it is one. Meet would have been the fourth, so this is the shape
// extracted instead — components-first, and the next app is one call.
//
// ---------------------------------------------------------------------------
// What being installable IS and IS NOT
// ---------------------------------------------------------------------------
// It is an icon, a name, and a window of its own that opens where the app is
// actually used. It is NOT an offline app: there is no service worker here,
// and without a connection these apps behave like any web page. Safari does
// not require one to offer "Add to Dock" or "Add to Home Screen", so adding a
// cache purely to look like an app would buy nothing and risk the thing that
// actually matters — a worker that cached an authenticated page or an API
// response would serve one person's data to the next person on that device,
// or quietly serve yesterday's. Offline is its own piece of work.
//
// ---------------------------------------------------------------------------
// iOS reads almost none of the manifest
// ---------------------------------------------------------------------------
// Safari takes the home-screen icon from `apple-touch-icon`, decides whether
// to open without browser chrome from `appleWebApp.capable`, and uses its own
// title. So an app needs BOTH halves of this file: the manifest for Android
// and desktop Chrome, the metadata for iOS and macOS. With only the manifest,
// "Add to Home Screen" on an iPhone makes a bookmark that opens a browser
// tab — the exact thing this exists to avoid.

import { LIGHT } from './design/tokens.js';

/** `'247 247 244'` → `'#f7f7f4'`. The manifest wants hex; the tokens are the
 *  RGB triples CSS variables carry. Derived, never typed: a colour written
 *  out here is a fourth copy of a value that already has one home
 *  (docs/brand-design.md), and the splash screen is the one place nobody
 *  notices it has drifted. */
function hex(token: string): string {
  const parts = token.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return '#ffffff';
  return '#' + parts.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}

/** The splash: the ground behind cards, because that is what the app paints
 *  onto a moment later. */
export const PWA_BACKGROUND = hex(LIGHT['surface-sunken']);
/** The status bar: the page itself, which the top bar sits against. */
export const PWA_THEME = hex(LIGHT.surface);

/** The four files `scripts/make-app-icons.sh <app> <source.png>` writes into
 *  an app's `public/`. Listed once so a manifest cannot name a file the
 *  generator does not produce. */
export const PWA_ICONS = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
  // Cropped tighter than the others: Android may cut a maskable icon to a
  // circle, so the artwork sits inside the safe area on a ground that reaches
  // the edges.
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
];

export type PwaShortcut = { name: string; short_name?: string; url: string };

export type PwaManifestInput = {
  /** Shown under the icon. From branding, never typed at the call site: a
   *  second copy of the name is how an icon and a sidebar end up disagreeing
   *  after a rename. */
  name: string;
  shortName?: string;
  description?: string;
  /** Where the installed app OPENS — the surface somebody installed it for,
   *  not a landing page. */
  startUrl: string;
  /** Long-press the icon. Two or three things somebody opens the app in a
   *  hurry to do; more than that and nobody reads them. */
  shortcuts?: PwaShortcut[];
  /** Only for an app whose own globals.css overrides the shared ground —
   *  Connect does. Everything else takes the token and should pass nothing. */
  backgroundColor?: string;
};

/**
 * An app's web manifest.
 *
 * Structural, not Next's `MetadataRoute.Manifest` — this package has no next
 * dependency (house rule); the shape is a subset Next accepts, and each app's
 * `app/manifest.ts` types the return itself.
 */
export function appManifest(input: PwaManifestInput) {
  return {
    name: input.name,
    short_name: input.shortName ?? input.name,
    ...(input.description ? { description: input.description } : {}),
    start_url: input.startUrl,
    // The whole app. Without it, following a link from inside the installed
    // window kicks the person out into a browser tab.
    scope: '/',
    display: 'standalone' as const,
    // One colour each, light only: a manifest carries no notion of scheme, and
    // the apps follow the system theme — so dark mode gets a light splash for
    // the instant before the page paints. Per-scheme colour is a meta-tag
    // concern, not this one.
    background_color: input.backgroundColor ?? PWA_BACKGROUND,
    theme_color: PWA_THEME,
    icons: PWA_ICONS,
    ...(input.shortcuts?.length ? { shortcuts: input.shortcuts } : {}),
  };
}

/**
 * The half of the metadata that makes iOS and macOS treat it as an app, to
 * spread into an app's exported `metadata`.
 *
 * Spread at the app rather than folded into `appMetadata`, deliberately:
 * saying "I am a standalone app" is a decision per app, and putting it in the
 * shared helper would make all ten claim it at once — including the ones with
 * no icons, which is how you get a generic tile with a blurry screenshot in
 * somebody's Dock.
 */
export function appleWebAppMetadata(appName: string) {
  return {
    applicationName: appName,
    // BOTH spellings of the one tag that decides whether iOS opens this
    // without browser chrome.
    //
    // `appleWebApp.capable` is how you ask Next for it, and Next 15 renders
    // that as `<meta name="mobile-web-app-capable">` — the standardised name,
    // not the `apple-` one iOS has honoured since 2008. Checked against a
    // real build on 2026-10-07: the apple-prefixed tag is not emitted at all
    // any more. Whether a given iOS version treats the unprefixed name as an
    // alias is a question about somebody's phone, and the answer being "no"
    // looks exactly like the bug this whole file exists to fix — an icon that
    // opens a browser tab. So the legacy tag is written out as well. It costs
    // one line, it is ignored where it is not needed, and it removes a
    // dependency on both Next's choice and Apple's.
    other: { 'apple-mobile-web-app-capable': 'yes' },
    appleWebApp: {
      capable: true,
      title: appName,
      // `default` keeps the status bar legible against the white top bar.
      // `black-translucent` draws the app under it and needs safe-area
      // padding the shells do not have.
      statusBarStyle: 'default' as const,
    },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
  };
}
