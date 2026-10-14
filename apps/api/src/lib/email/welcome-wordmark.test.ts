import { describe, expect, it } from 'vitest';
import { membershipWelcome } from './membership-templates.js';

// ---------------------------------------------------------------------------
// THE WORDMARK AND THE LINK MUST AGREE ABOUT WHICH STACK THEY ARE ON.
//
// Sjoerd: *"Can you use the logo of my.thread for opening it?"* So the
// portal's own wordmark is the door. The risk in an email is never the image
// — it is a second hand-built URL beside the first, which is how a staging
// mail comes to carry a production asset, or a production mail a staging one.
//
// So the image URL is DERIVED from the portal link, and this says so in a way
// that fails if somebody ever builds it separately.
// ---------------------------------------------------------------------------

const FACTS = {
  name: 'Marja',
  communityName: 'soul.com',
  tierName: 'Community member',
  renewsAt: '2027-01-01T00:00:00Z',
  email: 'marja@example.com',
  locale: 'en',
} as const;

const imgSrc = (html: string) =>
  [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]!);

describe('the my.thread wordmark', () => {
  it('comes from the same origin as the link it opens', () => {
    for (const portal of [
      'https://my.thethread.app/memberships',
      'https://my.thefibre.tech/memberships',
      'https://my.example.test/memberships',
    ]) {
      const html = membershipWelcome({ ...FACTS, portalUrl: portal }).html;
      const origin = new URL(portal).origin;
      expect(imgSrc(html), portal).toContain(`${origin}/wordmark.png`);
      // And the link around it is the portal itself, not the image.
      expect(html).toContain(`href="${portal}"`);
    }
  });

  it('never carries the other stack', () => {
    const staging = membershipWelcome({
      ...FACTS,
      portalUrl: 'https://my.thefibre.tech/memberships',
    }).html;
    expect(staging).not.toContain('my.thethread.app');
  });

  it('keeps a text link under it, because clients block images', () => {
    // An image-only link is invisible wherever images are blocked by
    // default, which is most places — the member would see a heading, a gap
    // and nothing to press.
    const html = membershipWelcome({
      ...FACTS,
      portalUrl: 'https://my.thethread.app/memberships',
    }).html;
    const links = [...html.matchAll(/href="https:\/\/my\.thethread\.app\/memberships"/g)];
    expect(links.length).toBeGreaterThanOrEqual(2);
    // And the plain-text half is unaffected by any of this.
    expect(membershipWelcome({ ...FACTS, portalUrl: 'https://my.thethread.app/memberships' }).text)
      .toContain('https://my.thethread.app/memberships');
  });

  it('carries alt text that says what it does', () => {
    const html = membershipWelcome({
      ...FACTS,
      portalUrl: 'https://my.thethread.app/memberships',
    }).html;
    const alt = /<img[^>]+src="[^"]*wordmark\.png"[^>]*alt="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(alt.trim().length).toBeGreaterThan(0);
    expect(alt).not.toContain('wordmark');
  });

  it('is simply absent when there is no portal to open', () => {
    // No URL, no logo — rather than a broken image pointing nowhere.
    const html = membershipWelcome({ ...FACTS, portalUrl: null }).html;
    expect(html).not.toContain('wordmark.png');
  });

  it('is absent rather than broken when the URL is malformed', () => {
    const html = membershipWelcome({ ...FACTS, portalUrl: 'not a url' }).html;
    expect(html).not.toContain('wordmark.png');
  });
});
