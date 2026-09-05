'use server';

// Members-page server actions (seat follow-ups, build-plan P4, decided
// 2026-09-04). Lives beside the members UI rather than in ../actions.ts so
// the seat-cost contract and the removal path stay next to the screens that
// use them. `updateMember` (role/relationship/grants) stays in ../actions.ts.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type InviteInput = {
  email: string;
  name?: string | undefined;
  workspace_role?: 'super_admin' | 'admin' | 'organiser' | undefined;
  relationship_type?: 'internal' | 'external' | undefined;
  apps: ({ slug: string; role: 'member' | 'admin' } | string)[];
};

export type InviteMemberResult = {
  ok?: boolean | undefined;
  invited?: boolean | undefined;
  error?: string | undefined;
  /**
   * The API refused (402 `seat-cost-confirmation-required`) because this
   * invite adds a PAID seat. `message` is the server's own sentence with the
   * server-computed price — the client never does the arithmetic. Re-submit
   * with acceptSeatCost=true after the admin explicitly confirms.
   */
  seatConfirmation?:
    | { message: string; costCentsMonth: number | null }
    | undefined;
};

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return `API ${e.status}`;
  }
  return 'Unknown error';
}

export async function inviteMember(
  input: InviteInput,
  acceptSeatCost: boolean,
): Promise<InviteMemberResult> {
  const email = input.email.trim();
  if (!email) return { error: 'Email is required.' };

  try {
    const res = await apiFetch<{ ok: boolean; user_id: string; invited: boolean }>(
      '/api/v1/members',
      {
        method: 'POST',
        body: JSON.stringify({ ...input, email, accept_seat_cost: acceptSeatCost }),
      },
    );
    revalidatePath('/settings/members');
    return { ok: true, invited: res.invited };
  } catch (e) {
    if (e instanceof ApiError && e.status === 402) {
      const body = e.body as
        | {
            error?: unknown;
            requires_seat_confirmation?: unknown;
            seat_cost_cents_month?: unknown;
          }
        | undefined;
      if (body?.requires_seat_confirmation === true) {
        return {
          seatConfirmation: {
            message:
              typeof body.error === 'string'
                ? body.error
                : 'This invite adds a paid seat to your subscription.',
            costCentsMonth:
              typeof body.seat_cost_cents_month === 'number'
                ? body.seat_cost_cents_month
                : null,
          },
        };
      }
    }
    return { error: errorMessage(e) };
  }
}

/**
 * Remove a workspace member. Soft on the API side (the seat's user row gets
 * deleted_at); the seat stops billing from the NEXT period — no mid-month
 * credit. The person stays in the contact graph.
 */
export async function removeMember(userId: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath('/settings/members');
  return { ok: true };
}
