// Meet's lifecycle mails, in the recipient's language (2026-10-17).
//
// These eight were written inline in routes/meet.ts in English while the
// booking mails beside them spoke six languages: a request that expired, the
// host's approval ask, a declined request, a payment due, the Meet-access
// invite, and a team invite with its reminder. A Dutch guest got "Your
// booking is confirmed" in Dutch and "Your request expired" in English.
//
// Same rule as templates.ts: WHICH language is not decided here. The caller
// resolves it — bookingLocales() for a booking's guest or host, and
// platformEmailLocale() for a colleague — and these render whatever they are
// handed. Each returns the subject, the text, and the title + body for the
// branded shell, which the caller wraps (meetEmailHtml) exactly as before.
//
// Every value is escaped in the html. The catalog text itself is ours.

import type { Locale } from '@thefibre/shared';
import { APPS, emailSignoff } from '@thefibre/shared';
import { meetT, type MeetBookingKey } from './meet-booking-i18n.js';
import { escapeHtml } from './templates.js';

const MEET = APPS['fibre-meet'];
const PLATFORM = APPS['fibre-platform'];

export type LifecycleMail = { subject: string; text: string; title: string; bodyHtml: string };

/** A sentence for the html: the catalog's text with each value escaped, and
 *  the named ones in bold. */
function h(L: Locale, key: MeetBookingKey, vars: Record<string, string>, bold: string[] = []): string {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    safe[k] = bold.includes(k) ? `<strong>${escapeHtml(v)}</strong>` : escapeHtml(v);
  }
  return meetT(L, key, safe);
}

const link = (url: string, label: string) => `<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`;
const button = (url: string, label: string) =>
  `<p style="margin:24px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(label)}</a></p>`;

/** "Hi Anna," — or nothing at all when there is no first name to use. */
function greeting(L: Locale, first: string): { text: string; html: string } {
  if (!first) return { text: '', html: '' };
  return { text: `${meetT(L, 'greeting', { first })}\n\n`, html: `<p>${escapeHtml(meetT(L, 'greeting', { first }))}</p>` };
}

const firstOf = (name: string | null | undefined) => (name ?? '').trim().split(' ')[0] ?? '';

// ---------------------------------------------------------------------------

/** To the guest: the host did not answer, the time is free again. */
export function requestExpiredInvitee(
  L: Locale,
  a: { inviteeName: string; hostName: string | null; meeting: string; when: string; askAgainUrl: string },
): LifecycleMail {
  const host = a.hostName || meetT(L, 'fallback_host');
  const g = greeting(L, firstOf(a.inviteeName));
  const vars = { host, meeting: a.meeting, when: a.when };
  return {
    subject: meetT(L, 'expired_subject', { meeting: a.meeting }),
    title: meetT(L, 'expired_title'),
    text: `${g.text}${meetT(L, 'expired_body', vars)}\n\n${meetT(L, 'expired_ask_line', { url: a.askAgainUrl })}\n\n${emailSignoff()}`,
    bodyHtml: `${g.html}<p>${h(L, 'expired_body', vars, ['meeting'])}</p>${link(a.askAgainUrl, meetT(L, 'expired_ask_link'))}`,
  };
}

/** To the host: a request nobody answered has expired. */
export function requestExpiredHost(
  L: Locale,
  a: { inviteeName: string; inviteeEmail: string; meeting: string; when: string; askAgainUrl: string },
): LifecycleMail {
  const vars = { invitee: a.inviteeName, email: a.inviteeEmail, meeting: a.meeting, when: a.when };
  return {
    subject: meetT(L, 'expired_host_subject', { meeting: a.meeting, invitee: a.inviteeName }),
    title: meetT(L, 'expired_host_title'),
    text: `${meetT(L, 'expired_host_asked', vars)} ${meetT(L, 'expired_host_body')}\n\n${meetT(L, 'expired_host_line', { url: a.askAgainUrl })}\n\n${emailSignoff()}`,
    bodyHtml: `<p>${h(L, 'expired_host_asked', vars, ['invitee', 'meeting'])}</p><p>${escapeHtml(meetT(L, 'expired_host_body'))}</p>${link(a.askAgainUrl, meetT(L, 'expired_host_link'))}`,
  };
}

/** To the host: approve or decline this request (again, at its new time, when
 *  it moved). The load-bearing one: unanswered, the request waits. */
export function approvalNeededHost(
  L: Locale,
  a: { inviteeName: string; inviteeEmail: string; meeting: string; when: string; movedFromWhen: string | null; reviewUrl: string },
): LifecycleMail {
  const moved = !!a.movedFromWhen;
  const vars = { invitee: a.inviteeName, email: a.inviteeEmail, meeting: a.meeting, when: a.when };
  const movedText = moved ? `\n\n${meetT(L, 'approval_moved_from', { when: a.movedFromWhen! })}` : '';
  const movedHtml = moved
    ? `<p style="color:#525252;">${escapeHtml(meetT(L, 'approval_moved_from', { when: a.movedFromWhen! }))}</p>`
    : '';
  return {
    subject: meetT(L, moved ? 'approval_subject_moved' : 'approval_subject', { meeting: a.meeting, invitee: a.inviteeName }),
    title: meetT(L, moved ? 'approval_title_moved' : 'approval_title'),
    text: `${meetT(L, 'approval_body', vars)}${movedText}\n\n${meetT(L, 'approval_review_line', { url: a.reviewUrl })}\n\n${emailSignoff()}`,
    bodyHtml: `<p>${h(L, 'approval_body', vars, ['invitee', 'meeting'])}</p>${movedHtml}${link(a.reviewUrl, meetT(L, 'approval_review_link'))}`,
  };
}

/** To the guest: the host could not confirm the request. */
export function bookingDeclinedInvitee(
  L: Locale,
  a: { inviteeName: string; hostName: string | null; meeting: string; note: string | null },
): LifecycleMail {
  const host = a.hostName || meetT(L, 'fallback_host');
  const g = greeting(L, firstOf(a.inviteeName));
  const vars = { host, meeting: a.meeting };
  const note = a.note?.trim() ? meetT(L, 'declined_note', { host, note: a.note.trim() }) : null;
  return {
    subject: meetT(L, 'declined_subject', { meeting: a.meeting }),
    title: meetT(L, 'declined_title'),
    text: `${g.text}${meetT(L, 'declined_body', vars)}${note ? `\n\n${note}` : ''}\n\n${emailSignoff()}`,
    bodyHtml: `${g.html}<p>${h(L, 'declined_body', vars, ['meeting'])}</p>${note ? `<p><em>${escapeHtml(note)}</em></p>` : ''}`,
  };
}

/** The amount, in the reader's own number format ("€ 60,00" in Dutch). */
export function meetMoney(L: Locale, cents: number, currency: string): string {
  return new Intl.NumberFormat(L === 'en' ? 'en-GB' : L, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

/** To the guest: a payment link for a booking the host made for them. */
export function paymentDueInvitee(
  L: Locale,
  a: { inviteeName: string; meeting: string; amount: string; payUrl: string },
): LifecycleMail {
  const g = greeting(L, firstOf(a.inviteeName));
  const vars = { amount: a.amount, meeting: a.meeting };
  return {
    subject: meetT(L, 'payment_subject', { meeting: a.meeting }),
    title: meetT(L, 'payment_title'),
    text: `${g.text}${meetT(L, 'payment_body', vars)}\n\n${meetT(L, 'payment_line', { url: a.payUrl })}\n\n${emailSignoff()}`,
    bodyHtml: `${g.html}<p>${h(L, 'payment_body', vars, ['amount'])}</p>${button(a.payUrl, meetT(L, 'payment_button'))}
    <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(meetT(L, 'payment_transfer'))}</p>`,
  };
}

/** To a colleague: you were added to the workspace with access to Meet. */
export function meetAccessInvite(
  L: Locale,
  a: { inviterName: string | null; email: string; signInUrl: string },
): LifecycleMail {
  const inviter = a.inviterName || meetT(L, 'fallback_teammate');
  return {
    subject: meetT(L, 'access_subject', { inviter, meet: MEET.name }),
    title: meetT(L, 'access_title'),
    text: `${meetT(L, 'access_body', { inviter, platform: PLATFORM.name, meet: MEET.name })}\n\n${meetT(L, 'access_signin_line', { url: a.signInUrl, email: a.email, meet: MEET.shortName })}\n\n${emailSignoff()}`,
    bodyHtml: `<p>${h(L, 'access_body', { inviter, platform: PLATFORM.name, meet: MEET.name }, ['inviter'])}</p>${button(a.signInUrl, meetT(L, 'access_signin_button', { platform: PLATFORM.name }))}<p style="margin-top:12px;font-size:12px;color:#737373;">${h(L, 'access_use_email', { email: a.email }, ['email'])}</p>`,
  };
}

/** To a colleague: join this team. */
export function teamInvite(
  L: Locale,
  a: { inviterName: string | null; teamName: string | null; email: string; acceptUrl: string },
): LifecycleMail {
  const inviter = a.inviterName || meetT(L, 'fallback_teammate');
  const team = a.teamName || meetT(L, 'fallback_team');
  const url = escapeHtml(a.acceptUrl);
  return {
    subject: meetT(L, 'team_subject', { inviter, team, platform: PLATFORM.name }),
    title: meetT(L, 'team_title'),
    text: `${meetT(L, 'team_text_lead', { inviter, team, meet: MEET.name })}

${meetT(L, 'team_accept_line', { url: a.acceptUrl })}

${meetT(L, 'team_how_text', { email: a.email })}

${emailSignoff()}`,
    bodyHtml: `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${h(L, 'team_headline', { inviter, team })}</h1>
<p style="margin-top:18px;font-size:14px;line-height:1.6;color:#404040;">${escapeHtml(meetT(L, 'team_how_html'))}</p>
<p style="margin-top:24px;"><a href="${url}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:6px;">${escapeHtml(meetT(L, 'team_accept_button'))}</a></p>
<p style="margin-top:18px;font-size:12px;color:#737373;">${h(L, 'team_google_account', { email: a.email }, ['email'])}</p>
<p style="margin-top:24px;font-size:11px;color:#a3a3a3;word-break:break-all;">${h(L, 'team_copy_link', { url: a.acceptUrl })}</p>
<p style="margin-top:18px;font-size:11px;color:#a3a3a3;">${escapeHtml(meetT(L, 'team_ignore'))}</p>`,
  };
}

/** To a colleague who has not accepted yet: the same invite, once more. */
export function teamInviteReminder(L: Locale, a: { teamName: string | null; acceptUrl: string }): LifecycleMail {
  const team = a.teamName || meetT(L, 'fallback_team');
  return {
    subject: meetT(L, 'reminder_subject', { team }),
    title: meetT(L, 'reminder_title'),
    text: `${meetT(L, 'team_accept_line', { url: a.acceptUrl })}\n\n${emailSignoff()}`,
    bodyHtml: `<p>${escapeHtml(meetT(L, 'reminder_body'))}</p>${button(a.acceptUrl, meetT(L, 'team_accept_button'))}`,
  };
}
