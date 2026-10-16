// Sending a web push, and the rules about WHERE we may send one.
//
// docs/web-push-plan.md. The `web-push` package does the protocol (VAPID
// signing, RFC 8291 payload encryption); this file holds the three decisions
// that are ours:
//
//   1. DARK UNTIL CONFIGURED. Without VAPID_PRIVATE_KEY the config route says
//      `publicKey: null`, the button shows nothing, and nothing is sent — the
//      same posture as the assistant without ANTHROPIC_API_KEY. The keys are
//      Sjoerd's to set, one pair per stack (a subscription is bound to the
//      public key it was made with, so staging must never share production's).
//
//   2. AN ENDPOINT IS AN ADDRESS THE SERVER POSTS TO, so it is allow-listed by
//      host before it is stored. Without the list, "subscribe" would be a way
//      to make our API send requests anywhere (SSRF). The four push services
//      the browsers we support use, and nothing else.
//
//   3. WHAT A FAILURE MEANS. 404/410 = the browser dropped the subscription:
//      delete the row at once (hard delete, Sjoerd 2026-10-16). Anything else
//      is counted, and the row goes after 5 failures spread over 3+ days.

import webpush from 'web-push';

/** Hosts a push endpoint may live on. Exact hosts, or `.suffix` for a family. */
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge, Android
  'updates.push.services.mozilla.com', // Firefox
  '.push.apple.com', // Safari (macOS, and iOS installed web apps)
  '.notify.windows.com', // legacy Edge / Windows
];

/** True only for an https URL on a known push service, with no tricks. */
export function isAllowedEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => (h.startsWith('.') ? host.endsWith(h) && host.length > h.length : host === h));
}

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/** The stack's keys, or null while push is dark. */
export function vapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || 'mailto:hello@thethread.app' };
}

/** What the device receives. Title and a link, nothing else (plan §8). */
export type PushPayload = { title: string; url: string; tag: string };

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type SendOutcome = 'sent' | 'gone' | 'failed';

/** Classify a push service's answer. Pure, so the rule is testable. */
export function outcomeFor(status: number | null): SendOutcome {
  if (status === null) return 'failed';
  if (status === 404 || status === 410) return 'gone';
  return status >= 200 && status < 300 ? 'sent' : 'failed';
}

/** Send one push. Never throws: the outcome says what happened. */
export async function sendPush(target: PushTarget, payload: PushPayload, cfg: VapidConfig): Promise<SendOutcome> {
  // A row stored before the allow-list existed, or written by hand, still
  // gets checked here: the list guards the SEND, not only the store.
  if (!isAllowedEndpoint(target.endpoint)) return 'gone';
  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
        // A change to tomorrow's session is no use next week: let the push
        // service drop it after a day rather than deliver it stale.
        TTL: 24 * 60 * 60,
        urgency: 'normal',
        timeout: 10_000,
      },
    );
    return outcomeFor(res.statusCode);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? null;
    return outcomeFor(status);
  }
}

/** "iPhone · Safari" from a user agent; the raw string is never stored. */
export function deviceLabel(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  return [device, browser].filter(Boolean).join(' · ') || null;
}
