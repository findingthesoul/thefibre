'use server';

export type RequestAccessResult = {
  ok?: boolean;
  alreadyRequested?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function submitRequestAccess(
  _prev: RequestAccessResult,
  formData: FormData,
): Promise<RequestAccessResult> {
  const body = {
    email: strOrNull(formData.get('email'))?.toLowerCase() ?? '',
    full_name: strOrNull(formData.get('full_name')) ?? '',
    organisation_name: strOrNull(formData.get('organisation_name')),
    reason: strOrNull(formData.get('reason')),
  };

  if (!body.email || !body.full_name) {
    return { error: 'Email and name are required.' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/signup-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as {
        error?: { fieldErrors?: Record<string, string[]> } | string;
      } | null;
      const fieldErrors =
        j && typeof j.error === 'object' ? j.error.fieldErrors : undefined;
      return {
        error: `Request failed (${res.status}).`,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }
    const data = (await res.json()) as { ok: boolean; already_requested?: boolean };
    return { ok: true, alreadyRequested: data.already_requested ?? false };
  } catch (e) {
    console.error('submitRequestAccess', e);
    return { error: 'Could not reach the server. Please try again in a minute.' };
  }
}
