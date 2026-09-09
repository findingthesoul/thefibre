'use client';

// The certificate builder's autosave — a plain client-side PATCH, not a
// server action, and that distinction is the whole point of this file.
//
// Sjoerd, 2026-09-09: "once I am in the certificate editor, I can't leave —
// clicking on any item does not respond."
//
// The builder saves itself on a two-second debounce, so while you are
// dragging elements around there is a save in flight or about to be, more or
// less continuously. When each of those was a SERVER ACTION, two things
// followed. Next.js re-renders the current route after a server action, and
// this page's server component makes four sequential API calls to Frankfurt
// before it can render. And client-side navigation queues behind a pending
// action. Between the two, every sidebar link was dead for as long as you
// kept working — which reads as a frozen app rather than a busy one.
//
// So the hot path leaves the App Router alone entirely. `lib/upload.ts` set
// this precedent for the same class of reason (server actions serialise
// binaries poorly); the sanctioned shape is a browser Supabase session token
// plus the X-App-ID header, straight to the EU API.
//
// The list still has to notice a renamed template, but that is once, on the
// way out, and it stays a server action — see `refreshCertificateList`.

import { browserSupabase } from './supabase/client';
import type {
  CertElement,
  CertGuide,
  CertOrientation,
  CertPageSize,
  CertScope,
} from './certificate-types';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export type CertPatch = {
  name?: string;
  page_size?: CertPageSize;
  orientation?: CertOrientation;
  background_url?: string | null;
  elements?: CertElement[];
  guides?: CertGuide[];
  scope?: CertScope;
  owner_team_id?: string | null;
};

export async function saveCertificateTemplate(
  id: string,
  patch: CertPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data } = await browserSupabase().auth.getSession();
    if (!data.session) return { ok: false, error: 'not signed in' };
    const res = await fetch(`${baseUrl}/api/v1/thread/certificate-templates/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'X-App-ID': 'the-thread',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
      // The unmount flush fires this and does not wait for it. keepalive
      // lets the request outlive the page it started on.
      keepalive: true,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `save failed (${res.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save failed' };
  }
}
