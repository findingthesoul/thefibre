// A COMMUNITY'S OWN WORDS IN ITS MEMBER EMAILS (Sjoerd 2ix, 2026-10-14:
// "would be great if it was editable in the settings").
//
// membership_email_template holds, per community: a welcome per tier (or a
// community default), the digest's words, and — kept for a later slice — a
// signature. This module picks the row for one email and fills its tokens;
// the templates put the community's words around the FACTS, which stay ours.
//
// WHICH ROW, for a member in locale L of a community whose page language is P:
//   tier row in L → tier row in P → default row in L → default row in P → none
// The community's own words in its own language beat our standard text in the
// member's language: an email in two voices reads as broken. No row → today's
// email, unchanged.

import { adminClient } from '../db.js';
import { fillTokens } from '@thefibre/shared/merge-tokens';
import { INTL_LOCALES, toLocale, type Locale } from '@thefibre/shared/i18n';
import type { CustomEmailParts } from './email/membership-templates.js';

export type TemplateKind = 'welcome' | 'digest' | 'signature';
export type TemplateRow = {
  id: string;
  kind: TemplateKind;
  tier_id: string | null;
  locale: Locale;
  subject: string | null;
  image_path: string | null;
  image_alt: string | null;
  intro_html: string | null;
  closing: string | null;
};

export const EMAIL_IMAGE_BUCKET = 'fibre-assets';

/** The public URL of an uploaded email image (the bucket is public). */
export function emailImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return adminClient.storage.from(EMAIL_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The row for one email, by the order above — pure, for its test. */
export function pickTemplate(rows: TemplateRow[], kind: TemplateKind, tierId: string | null, memberLocale: Locale, pageLocale: Locale): TemplateRow | null {
  const of = (tier: string | null, loc: Locale) => rows.find((r) => r.kind === kind && r.tier_id === tier && r.locale === loc) ?? null;
  return (
    (tierId ? of(tierId, memberLocale) ?? of(tierId, pageLocale) : null) ??
    of(null, memberLocale) ??
    of(null, pageLocale)
  );
}

/** Fill a row's tokens for one member. Text fields are filled as text (the
 *  templates escape them); the intro is sanitised HTML, filled with escaping. */
export function fillTemplate(row: TemplateRow | null, values: Record<string, string | null | undefined>): CustomEmailParts | null {
  if (!row) return null;
  const text = (s: string | null) => (s ? fillTokens(s, values, 'member_email', { html: false }) : null);
  return {
    subject: text(row.subject),
    imageUrl: emailImageUrl(row.image_path),
    imageAlt: row.image_alt,
    introHtml: row.intro_html ? fillTokens(row.intro_html, values, 'member_email', { html: true }) : null,
    closing: text(row.closing),
  };
}

/** The community's page language (its join page's default). */
export async function communityPageLocale(workspaceId: string): Promise<Locale> {
  const { data } = await adminClient.from('membership_settings').select('locale').eq('workspace_id', workspaceId).maybeSingle();
  return toLocale((data?.locale as string | null) ?? null);
}

/** The community's own words for one email to one member, tokens filled —
 *  or null (send the standard email). Never throws: a template that cannot
 *  be read must not stop a welcome. */
export async function communityWords(input: {
  workspaceId: string;
  kind: TemplateKind;
  tierId?: string | null;
  memberLocale: string | null | undefined;
  values: Record<string, string | null | undefined>;
}): Promise<CustomEmailParts | null> {
  try {
    const { data } = await adminClient
      .from('membership_email_template')
      .select('id, kind, tier_id, locale, subject, image_path, image_alt, intro_html, closing')
      .eq('workspace_id', input.workspaceId)
      .eq('kind', input.kind);
    const rows = (data ?? []) as TemplateRow[];
    if (!rows.length) return null;
    const page = await communityPageLocale(input.workspaceId);
    return fillTemplate(pickTemplate(rows, input.kind, input.tierId ?? null, toLocale(input.memberLocale ?? null), page), input.values);
  } catch (e) {
    console.warn('[member-email-templates] read failed — standard email', (e as Error).message);
    return null;
  }
}

/** The community's SIGNATURE for one transactional email to one member
 *  (renewal reminder, payment failed, lapsed, stopped/resumed, card changed),
 *  tokens filled with escaping — or null. Same order as the welcome, without
 *  a tier: member's language → page language → none. Never throws: a
 *  signature that cannot be read must not stop a payment-failed email. */
export async function communitySignature(input: {
  workspaceId: string;
  memberLocale: string | null | undefined;
  values: Record<string, string | null | undefined>;
}): Promise<string | null> {
  try {
    const { data } = await adminClient
      .from('membership_email_template')
      .select('id, kind, tier_id, locale, subject, image_path, image_alt, intro_html, closing')
      .eq('workspace_id', input.workspaceId)
      .eq('kind', 'signature');
    const rows = (data ?? []) as TemplateRow[];
    if (!rows.length) return null;
    const page = await communityPageLocale(input.workspaceId);
    const row = pickTemplate(rows, 'signature', null, toLocale(input.memberLocale ?? null), page);
    return row?.intro_html ? fillTokens(row.intro_html, input.values, 'member_email', { html: true }) : null;
  } catch (e) {
    console.warn('[member-email-templates] signature read failed — sent without', (e as Error).message);
    return null;
  }
}

/** The member_email token values for one member — one place, so the welcome,
 *  the digest, the preview and the test send fill the same way. */
export function memberEmailValues(input: {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  communityName?: string | null | undefined;
  tierName?: string | null | undefined;
  renewsAt?: string | null | undefined;
  portalUrl?: string | null | undefined;
  locale: string | null | undefined;
}): Record<string, string | null> {
  const loc = toLocale(input.locale ?? null);
  const renews = input.renewsAt
    ? new Intl.DateTimeFormat(INTL_LOCALES[loc], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(input.renewsAt))
    : null;
  const first = input.firstName?.trim() || null;
  const last = input.lastName?.trim() || null;
  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' ') || null,
    community: input.communityName ?? null,
    tier: input.tierName ?? null,
    renews_on: renews,
    'my.thread': input.portalUrl ?? null,
  };
}

/** One call for a send site: the member's tokens, then their signature. */
export async function signatureFor(
  workspaceId: string,
  locale: string | null | undefined,
  who: { firstName?: string | null; lastName?: string | null; communityName?: string | null; tierName?: string | null; renewsAt?: string | null },
): Promise<string | null> {
  return communitySignature({ workspaceId, memberLocale: locale, values: memberEmailValues({ ...who, locale }) });
}
