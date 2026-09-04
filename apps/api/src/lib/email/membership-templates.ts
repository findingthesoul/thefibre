// Membership lifecycle emails. EN-only v1 (the Thread's typed i18n catalog
// is the pattern to adopt when a non-EN community shows up). All of them
// render inside the shared shell with the WORKSPACE's brand — a membership
// email is from the community, not from The Fibre.

import { shell, escapeHtml } from './templates.js';
import type { EmailBrand } from './templates.js';

function euro(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '';
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(cents / 100);
}

export function membershipWelcome(opts: {
  name: string;
  communityName: string;
  tierName: string;
  renewsAt: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const renewLine = opts.renewsAt
    ? `Your membership renews on ${new Date(opts.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : '';
  const subject = `Welcome to ${opts.communityName}`;
  const body = `
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>Your <strong>${escapeHtml(opts.tierName)}</strong> membership of
    <strong>${escapeHtml(opts.communityName)}</strong> is active. ${escapeHtml(renewLine)}</p>
    <p>You'll receive access to your member spaces shortly — invitations
    arrive by email from each space.</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `Hi ${opts.name},\n\nYour ${opts.tierName} membership of ${opts.communityName} is active. ${renewLine}\n\nYou'll receive access to your member spaces shortly.`,
  };
}

export function membershipRenewalReminder(opts: {
  name: string;
  communityName: string;
  tierName: string;
  renewsAt: string;
  amountCents: number | null;
  currency: string;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const date = new Date(opts.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const amount = opts.amountCents != null ? ` (${euro(opts.amountCents, opts.currency)})` : '';
  const subject = `Your ${opts.communityName} membership renews on ${date}`;
  const body = `
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>A quick heads-up: your <strong>${escapeHtml(opts.tierName)}</strong> membership of
    <strong>${escapeHtml(opts.communityName)}</strong> renews on <strong>${escapeHtml(date)}</strong>${escapeHtml(amount)}.</p>
    <p>Nothing to do if you'd like to continue — the renewal happens
    automatically. To make changes, reply to this email.</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `Hi ${opts.name},\n\nYour ${opts.tierName} membership of ${opts.communityName} renews on ${date}${amount}. Nothing to do if you'd like to continue. To make changes, reply to this email.`,
  };
}

export function membershipPaymentFailed(opts: {
  name: string;
  communityName: string;
  tierName: string;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const subject = `Payment issue with your ${opts.communityName} membership`;
  const body = `
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>The renewal payment for your <strong>${escapeHtml(opts.tierName)}</strong> membership of
    <strong>${escapeHtml(opts.communityName)}</strong> didn't go through. Your membership stays
    active for now while the payment is retried.</p>
    <p>Usually this is an expired card — updating your payment method fixes
    it. If you need help, just reply to this email.</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `Hi ${opts.name},\n\nThe renewal payment for your ${opts.tierName} membership of ${opts.communityName} didn't go through. Your membership stays active while the payment is retried. Updating your payment method usually fixes it.`,
  };
}

export function membershipLapsed(opts: {
  name: string;
  communityName: string;
  joinUrl: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const subject = `Your ${opts.communityName} membership has ended`;
  const rejoin = opts.joinUrl
    ? `<p style="margin:24px 0 0;"><a href="${opts.joinUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Rejoin ${escapeHtml(opts.communityName)}</a></p>`
    : '';
  const body = `
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>Your membership of <strong>${escapeHtml(opts.communityName)}</strong> has ended.
    We'd love to have you back any time.</p>${rejoin}`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `Hi ${opts.name},\n\nYour membership of ${opts.communityName} has ended. We'd love to have you back any time.${opts.joinUrl ? `\n\nRejoin: ${opts.joinUrl}` : ''}`,
  };
}
