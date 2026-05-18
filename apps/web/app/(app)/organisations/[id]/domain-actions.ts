'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import type { DomainVerificationState } from './domain-verification';

export type DomainVerificationAction = {
  state?: DomainVerificationState;
  verified?: boolean;
  message?: string;
  error?: string;
};

type GetResp = {
  domain: string | null;
  domain_verified_at: string | null;
  challenge: {
    record_name: string;
    record_value: string;
    created_at: string;
    verified_at: string | null;
  } | null;
};

type StartResp = { record_name: string; record_value: string };
type CheckResp =
  | { verified: true; verified_at: string }
  | {
      verified: false;
      error?: string;
      record_name?: string;
      record_value?: string;
      found?: string[];
    };

async function fetchState(orgId: string): Promise<DomainVerificationState> {
  const r = await apiFetch<GetResp>(`/api/v1/organisations/${orgId}/domain-verification`);
  return r;
}

function unwrapError(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: string } | undefined;
    return body?.error ?? `API ${e.status}`;
  }
  return 'Unknown error';
}

export async function startDomainVerification(
  orgId: string,
): Promise<DomainVerificationAction> {
  try {
    await apiFetch<StartResp>(`/api/v1/organisations/${orgId}/domain-verification`, {
      method: 'POST',
    });
    const state = await fetchState(orgId);
    revalidatePath(`/organisations/${orgId}`);
    return { state };
  } catch (e) {
    return { error: unwrapError(e) };
  }
}

export async function backfillDomainMembers(
  orgId: string,
): Promise<{ linked?: number; skipped?: number; total?: number; error?: string }> {
  try {
    return await apiFetch(
      `/api/v1/organisations/${orgId}/domain-verification/backfill`,
      { method: 'POST' },
    );
  } catch (e) {
    return { error: unwrapError(e) };
  }
}

export async function checkDomainVerification(
  orgId: string,
): Promise<DomainVerificationAction> {
  try {
    const r = await apiFetch<CheckResp>(
      `/api/v1/organisations/${orgId}/domain-verification/check`,
      { method: 'POST' },
    );
    const state = await fetchState(orgId);
    revalidatePath(`/organisations/${orgId}`);
    if (r.verified) {
      return { state, verified: true, message: 'Domain verified.' };
    }
    return {
      state,
      verified: false,
      message: r.error
        ? `Not verified yet — ${r.error}.`
        : 'Not verified yet.',
    };
  } catch (e) {
    return { error: unwrapError(e) };
  }
}
