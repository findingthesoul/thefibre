'use server';

// The signup request, submitted from the website's own Start-a-Thread
// dialog (Sjoerd, 2026-09-08: a popup on thethread.app, not a hop to
// thefibre.app). Server-to-server to the same public API endpoint the
// Fibre's request-access page uses — mirrored from
// apps/web/app/request-access/actions.ts.

export type StartRequestResult = {
  ok?: boolean;
  alreadyRequested?: boolean;
  /** Signup v2: auto-approved — the workspace exists, sign in now. */
  approved?: boolean;
  error?: string;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function submitStartRequest(
  _prev: StartRequestResult,
  formData: FormData,
): Promise<StartRequestResult> {
  const body = {
    email: strOrNull(formData.get('email'))?.toLowerCase() ?? '',
    full_name: strOrNull(formData.get('full_name')) ?? '',
    organisation_name: strOrNull(formData.get('organisation_name')),
    reason: strOrNull(formData.get('reason')),
    desired_plan: strOrNull(formData.get('desired_plan')),
  };

  if (!body.email || !body.full_name) {
    return { error: 'Name and email are required.' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/signup-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return { error: `Request failed (${res.status}). Please try again.` };
    const data = (await res.json()) as {
      ok: boolean;
      already_requested?: boolean;
      approved?: boolean;
    };
    return {
      ok: true,
      alreadyRequested: data.already_requested ?? false,
      approved: data.approved ?? false,
    };
  } catch (e) {
    console.error('submitStartRequest', e);
    return { error: 'Could not reach the server. Please try again in a minute.' };
  }
}
