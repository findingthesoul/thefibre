import { describe, it, expect } from 'vitest';
import { EMAIL_BRAND, BRAND_ASSETS } from '@thefibre/shared';
import { shell, bookingNotificationHost, type EmailCommon } from './templates.js';

// Whose logo an email wears. Sjoerd, on a booking email carrying the fibre
// wordmark: "Should this not be THE THREAD? and WORKSPACE in this specific
// case?" The branding pivot made The Thread the public face; these emails
// had been left behind on the backstage mark.
describe('the email shell', () => {
  it('wears The Thread when no workspace brand is given', () => {
    const html = shell('Title', '<p>body</p>');
    expect(html).toContain(EMAIL_BRAND.logoUrl);
    expect(html).not.toContain(BRAND_ASSETS.logoUrl);
  });

  it("wears the workspace's own mark when it has one", () => {
    const html = shell('Title', '<p>body</p>', {
      logoUrl: 'https://example.test/soul.png',
      name: 'soul.com',
    });
    expect(html).toContain('https://example.test/soul.png');
    expect(html).toContain('soul.com');
    expect(html).not.toContain(EMAIL_BRAND.logoUrl);
  });
});

describe('booking emails carry the brand through', () => {
  const common = (brand?: { logoUrl: string | null; name: string | null }): EmailCommon => ({
    inviteeName: 'Tuana',
    inviteeEmail: 'tuana@example.test',
    hostName: 'Sjoerd Luteijn',
    hostEmail: 'sjoerd@example.test',
    meetingName: 'personal meeting',
    startsAt: new Date('2026-09-28T13:00:00Z'),
    endsAt: new Date('2026-09-28T14:00:00Z'),
    hostTimezone: 'Europe/Amsterdam',
    bookingId: 'b1',
    meetAppUrl: 'https://meet.example.test',
    hostSlug: 'sjoerd-luteijn',
    meetingTypeSlug: 'personal-meeting',
    ...(brand ? { brand } : {}),
  });

  it('uses the workspace mark on the host notification', () => {
    const { html } = bookingNotificationHost(
      common({ logoUrl: 'https://example.test/soul.png', name: 'soul.com' }),
    );
    expect(html).toContain('https://example.test/soul.png');
  });

  it('falls back to The Thread, never to The Fibre', () => {
    const { html } = bookingNotificationHost(common());
    expect(html).toContain(EMAIL_BRAND.logoUrl);
    expect(html).not.toContain(BRAND_ASSETS.logoUrl);
  });
});
