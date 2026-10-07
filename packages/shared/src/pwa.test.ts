import { describe, expect, it } from 'vitest';
import { appManifest, appleWebAppMetadata, PWA_BACKGROUND, PWA_ICONS, PWA_THEME } from './pwa.js';
import { LIGHT } from './design/tokens.js';

describe('the colours are the design tokens, not a fourth copy of them', () => {
  // The three hand-written manifests this replaced each spelled these out as
  // hex. They happened to be right; the point is that now they cannot be
  // wrong, and a token change reaches the splash screen.
  it('derives the splash from surface-sunken and the status bar from surface', () => {
    const asHex = (t: string) =>
      '#' + t.split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    expect(PWA_BACKGROUND).toBe(asHex(LIGHT['surface-sunken']));
    expect(PWA_THEME).toBe(asHex(LIGHT.surface));
  });

  it('is byte-for-byte what the three apps carried before the extraction', () => {
    // If a token moves, this case is the one that should be re-read rather
    // than updated on reflex: it says what shipped, and somebody chose it.
    expect(PWA_BACKGROUND).toBe('#f7f7f4');
    expect(PWA_THEME).toBe('#ffffff');
  });
});

describe('the manifest', () => {
  const m = appManifest({
    name: 'Meet',
    shortName: 'Meet',
    description: 'A meeting is a thing of its own.',
    startUrl: '/dashboard',
    shortcuts: [{ name: 'Bookings', url: '/bookings' }],
  });

  it('opens where the app is used, in its own window, scoped to the whole app', () => {
    expect(m.start_url).toBe('/dashboard');
    expect(m.display).toBe('standalone');
    // Without scope, a link from inside the installed window kicks the person
    // out to a browser tab — the one thing an installed app must not do.
    expect(m.scope).toBe('/');
  });

  it('names three icons, one of them maskable', () => {
    expect(m.icons).toHaveLength(3);
    expect(m.icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
    expect(m.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    // Every path is absolute from the app root: a relative one resolves
    // against the manifest's own URL and 404s on some platforms.
    for (const i of PWA_ICONS) expect(i.src.startsWith('/')).toBe(true);
  });

  it('falls back to the name when no short name is given, and omits empty parts', () => {
    const bare = appManifest({ name: 'The Fibre', startUrl: '/' });
    expect(bare.short_name).toBe('The Fibre');
    expect('description' in bare).toBe(false);
    expect('shortcuts' in bare).toBe(false);
  });

  it('lets one app override the splash, because Connect genuinely does', () => {
    const connect = appManifest({ name: 'Connect', startUrl: '/today', backgroundColor: '#eef1f6' });
    expect(connect.background_color).toBe('#eef1f6');
    // and nobody else inherits that
    expect(appManifest({ name: 'Meet', startUrl: '/' }).background_color).toBe(PWA_BACKGROUND);
  });
});

describe('the iOS half, which is the half Safari actually reads', () => {
  const meta = appleWebAppMetadata('Meet');

  it('declares itself capable, or Add to Home Screen makes a browser bookmark', () => {
    expect(meta.appleWebApp.capable).toBe(true);
    // Next renders `capable` as the UNPREFIXED meta name; this is the
    // apple-prefixed one iOS has always read, written out because a phone
    // that ignores the new name is indistinguishable from the bug.
    expect(meta.other['apple-mobile-web-app-capable']).toBe('yes');
    expect(meta.appleWebApp.title).toBe('Meet');
    expect(meta.appleWebApp.statusBarStyle).toBe('default');
    expect(meta.applicationName).toBe('Meet');
  });

  it('points at the 180px apple-touch-icon, which is the only one Safari takes', () => {
    expect(meta.icons.apple[0]!.url).toBe('/apple-touch-icon.png');
    expect(meta.icons.apple[0]!.sizes).toBe('180x180');
  });
});
