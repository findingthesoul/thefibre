// Web push on this device (docs/web-push-plan.md): the browser half.
//
// Used by the push card on You → Notifications, and by sign-out, which takes
// this device off before the session goes — a signed-out phone must not keep
// buzzing with someone's sessions.

import { browserSupabase } from './supabase/client';

const base = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const {
    data: { session },
  } = await browserSupabase().auth.getSession();
  const res = await fetch(`${base()}/api/v1/me/portal/push${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `push ${res.status}`);
  return json;
}

/** What this browser can do. `ios-not-installed` is Safari on an iPhone or
 *  iPad in a tab: push exists there only for the app on the Home Screen. */
export type PushSupport = 'ok' | 'ios-not-installed' | 'unsupported';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ios && !standalone) return 'ios-not-installed';
  return capable ? 'ok' : 'unsupported';
}

export async function pushConfig(): Promise<string | null> {
  return (await api<{ publicKey: string | null }>('/config')).publicKey;
}

export type PushDevice = { id: string; device_label: string | null; created_at: string; endpoint_hint: string };

export async function listDevices(): Promise<PushDevice[]> {
  return (await api<{ items: PushDevice[] }>('/subscriptions')).items;
}

/** This device's current subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function urlBase64ToBuffer(b64: string): ArrayBuffer {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

/** Ask, subscribe, and tell the API. MUST run inside a click: iOS refuses
 *  the permission prompt from anywhere else. */
export async function turnOn(publicKey: string): Promise<'on' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(publicKey) }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  await api('/subscriptions', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
  return 'on';
}

/** Take THIS device off: in the browser and at the API. Never throws — it
 *  runs on sign-out, which must not be blocked by it. */
export async function turnOffThisDevice(): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await api('/subscriptions', { method: 'DELETE', body: { endpoint } }).catch(() => {});
  } catch {
    // Sign-out goes ahead regardless.
  }
}

export async function removeDevice(id: string): Promise<void> {
  await api('/subscriptions', { method: 'DELETE', body: { id } });
}
