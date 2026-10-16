'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type EmailDraft = {
  kind: 'welcome' | 'digest' | 'signature';
  tier_id: string | null;
  locale: 'en' | 'nl' | 'es' | 'pt' | 'de' | 'fr';
  subject: string | null;
  image_path: string | null;
  image_alt: string | null;
  intro_html: string | null;
  closing: string | null;
};
type Result<T = unknown> = { ok?: boolean; error?: string; data?: T };

function msg(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong.';
  const b = e.body as { error?: unknown } | undefined;
  return typeof b?.error === 'string' ? b.error : `API ${e.status}`;
}

export async function saveEmailTemplate(d: EmailDraft): Promise<Result<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/email-templates', { method: 'PUT', body: JSON.stringify(d) });
    revalidatePath('/settings/emails');
    return { ok: true, data: r };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function resetEmailTemplate(id: string): Promise<Result> {
  try {
    await apiFetch(`/api/v1/membership/email-templates/${id}`, { method: 'DELETE' });
    revalidatePath('/settings/emails');
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function previewEmail(d: EmailDraft): Promise<Result<{ subject: string; html: string }>> {
  try {
    return { ok: true, data: await apiFetch('/api/v1/membership/email-templates/preview', { method: 'POST', body: JSON.stringify(d) }) };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function sendTestEmail(d: EmailDraft): Promise<Result<{ sent_to: string }>> {
  try {
    return { ok: true, data: await apiFetch('/api/v1/membership/email-templates/send-test', { method: 'POST', body: JSON.stringify(d) }) };
  } catch (e) {
    return { error: msg(e) };
  }
}
