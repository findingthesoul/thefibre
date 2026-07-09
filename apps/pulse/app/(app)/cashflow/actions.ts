'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult<T = unknown> = { ok?: boolean; error?: string; data?: T };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try {
      detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

// Matches the API's CreateCommitment zod schema. owner_user_id is optional —
// omitted means the API defaults to the caller (create) / keeps current (patch).
export type CommitmentPayload = {
  direction: 'in' | 'out';
  label: string;
  person_id: string | null;
  organisation_id: string | null;
  team_id: string | null;
  project_id: string | null;
  offering_id: string | null;
  owner_user_id?: string;
  // Free string since stages became configurable — the API validates the key
  // against pulse_stage and rejects unknowns.
  stage: string;
  probability: number;
  quantity: number;
  unit_amount_cents: number | null;
  // Recurring characteristic — null cadence = one-off. When set, the API's
  // projection expands quantity × unit_amount_cents per occurrence.
  repeat_cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null;
  repeat_starts_on: string | null;
  repeat_until: string | null;
  // VAT tariff (pct) applied on top of the net total. null = no VAT.
  // Optional so quick-add and other minimal callers stay untouched.
  vat_pct?: number | null;
  // Offer/quotation URL — optional; the API strips it until the
  // pulse_commitment.quote_url column + zod field are live.
  quote_url?: string | null;
  notes: string | null;
};

export type LinePayload = {
  id?: string; // present = existing line
  dirty?: boolean; // existing line whose fields changed → PATCH
  expected_date: string;
  amount_cents: number;
  invoice_ref: string | null;
  invoiced_at: string | null;
  settled_at: string | null;
};

// Offering rows — same diffing contract as lines (delete removed, post new,
// patch dirty existing).
export type ItemPayload = {
  id?: string; // present = existing item
  dirty?: boolean; // existing item whose fields changed → PATCH
  offering_id: string | null;
  name: string;
  quantity: number;
  unit_amount_cents: number;
  repeat_cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null;
  sort_order: number;
};

// One action for the whole dialog save: create-or-patch the commitment, then
// diff the desired lines AND offering items against the originals (delete
// removed, post new, patch changed). Single round-trip from the client.
export async function saveCommitment(input: {
  id: string | null;
  commitment: CommitmentPayload;
  lines: LinePayload[];
  originalLineIds: string[];
  items?: ItemPayload[];
  originalItemIds?: string[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { id, commitment, lines, originalLineIds } = input;
    const items = input.items ?? [];
    const originalItemIds = input.originalItemIds ?? [];

    let commitmentId = id;
    if (commitmentId) {
      await apiFetch(`/api/v1/pulse/commitments/${commitmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(commitment),
      });
    } else {
      const r = await apiFetch<{ item: { id: string } }>('/api/v1/pulse/commitments', {
        method: 'POST',
        body: JSON.stringify(commitment),
      });
      commitmentId = r.item.id;
    }

    // Removed rows first — original ids no longer present.
    const keptIds = new Set(lines.map((l) => l.id).filter(Boolean));
    for (const lineId of originalLineIds) {
      if (!keptIds.has(lineId)) {
        await apiFetch(`/api/v1/pulse/lines/${lineId}`, { method: 'DELETE' });
      }
    }

    for (const l of lines) {
      const body = JSON.stringify({
        expected_date: l.expected_date,
        amount_cents: l.amount_cents,
        invoice_ref: l.invoice_ref,
        invoiced_at: l.invoiced_at,
        settled_at: l.settled_at,
      });
      if (!l.id) {
        await apiFetch(`/api/v1/pulse/commitments/${commitmentId}/lines`, {
          method: 'POST',
          body,
        });
      } else if (l.dirty) {
        await apiFetch(`/api/v1/pulse/lines/${l.id}`, { method: 'PATCH', body });
      }
    }

    // Offering items — the exact same diffing dance.
    const keptItemIds = new Set(items.map((i) => i.id).filter(Boolean));
    for (const itemId of originalItemIds) {
      if (!keptItemIds.has(itemId)) {
        await apiFetch(`/api/v1/pulse/items/${itemId}`, { method: 'DELETE' });
      }
    }
    for (const i of items) {
      const body = JSON.stringify({
        offering_id: i.offering_id,
        name: i.name,
        quantity: i.quantity,
        unit_amount_cents: i.unit_amount_cents,
        repeat_cadence: i.repeat_cadence,
        sort_order: i.sort_order,
      });
      if (!i.id) {
        await apiFetch(`/api/v1/pulse/commitments/${commitmentId}/items`, {
          method: 'POST',
          body,
        });
      } else if (i.dirty) {
        await apiFetch(`/api/v1/pulse/items/${i.id}`, { method: 'PATCH', body });
      }
    }

    revalidatePath('/cashflow');
    return { ok: true, data: { id: commitmentId } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Inline "Create '<query>'" support for the counterparty comboboxes.
// Both platform routes return the created row DIRECTLY (not { item: … }).
// ---------------------------------------------------------------------------
export async function createOrganisation(
  name: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const r = await apiFetch<{ id: string; name: string }>('/api/v1/organisations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    revalidatePath('/cashflow');
    return { ok: true, data: { id: r.id, name: r.name } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// The API's PersonCreate requires first_name, last_name AND email — so the
// combobox collects an email before calling this. The query splits on the
// last space; a single word becomes first_name with "—" as last_name.
export async function createPerson(input: {
  query: string;
  email: string;
}): Promise<
  ActionResult<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>
> {
  try {
    const q = input.query.trim();
    const cut = q.lastIndexOf(' ');
    const first_name = cut > 0 ? q.slice(0, cut) : q;
    const last_name = cut > 0 ? q.slice(cut + 1) : '—';
    const r = await apiFetch<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>('/api/v1/persons', {
      method: 'POST',
      body: JSON.stringify({ first_name, last_name, email: input.email.trim() }),
    });
    revalidatePath('/cashflow');
    return {
      ok: true,
      data: { id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email },
    };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Company-aware person picking (Sjoerd 2026-07-08: "select the person
// belonging to the company"): who works at the selected organisation, plus
// the checked-before-made link when a non-member person is picked.
// ---------------------------------------------------------------------------
export type OrgMemberPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export async function getOrgMembers(
  orgId: string,
): Promise<ActionResult<OrgMemberPerson[]>> {
  try {
    // PostgREST person embeds can come back as object OR single-element array.
    type MemberRow = {
      id: string;
      title: string | null;
      person: OrgMemberPerson | OrgMemberPerson[] | null;
    };
    const r = await apiFetch<{ items: MemberRow[] }>(
      `/api/v1/organisations/${orgId}/members`,
    );
    const persons: OrgMemberPerson[] = [];
    for (const m of r.items ?? []) {
      const p = Array.isArray(m.person) ? m.person[0] : m.person;
      if (p) persons.push(p);
    }
    return { ok: true, data: persons };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function linkPersonToOrg(
  orgId: string,
  personId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>(`/api/v1/organisations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    });
    revalidatePath('/cashflow');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Drag-and-drop on the by-period board: retime a single expected payment.
// The board applies the move optimistically, then refreshes on success.
export async function moveLine(lineId: string, expectedDate: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify({ expected_date: expectedDate }),
    });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Org-level drag on the by-period board (Sjoerd 2026-07-09: "the numbers on
// org level should be drag and drop too"): re-date every one-off line of a
// client group's period in one go. One revalidate at the end.
export async function moveLines(
  lineIds: string[],
  expectedDate: string,
): Promise<ActionResult> {
  try {
    for (const id of lineIds) {
      await apiFetch(`/api/v1/pulse/lines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ expected_date: expectedDate }),
      });
    }
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Inline chip editing on the by-period grid: change one payment's amount
// without opening the dialog.
export async function updateLineAmount(
  lineId: string,
  amountCents: number,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify({ amount_cents: amountCents }),
    });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Inline add on the by-period grid: typing an amount into an empty period
// cell creates a new expected payment dated on that period's start.
export async function addLine(
  commitmentId: string,
  expectedDate: string,
  amountCents: number,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/commitments/${commitmentId}/lines`, {
      method: 'POST',
      body: JSON.stringify({ expected_date: expectedDate, amount_cents: amountCents }),
    });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Inline field editing on the by-counterparty table: PATCH just the cells
// that changed (the API accepts partial commitment bodies).
export type CommitmentFieldPatch = Partial<
  Pick<
    CommitmentPayload,
    | 'label'
    | 'quantity'
    | 'unit_amount_cents'
    | 'repeat_cadence'
    | 'repeat_starts_on'
    | 'repeat_until'
    | 'stage'
    | 'probability'
  >
>;

export async function patchCommitmentField(
  id: string,
  patch: CommitmentFieldPatch,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/commitments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Transfer an opportunity into an invoice (proposal §2.8): the API assigns
// the next number from Settings, writes the purchase-ledger row, moves the
// stage to invoiced, and (with send) emails the counterparty. `note` carries
// the plain-english reason when the email couldn't go out.
export async function invoiceCommitment(
  id: string,
  send: boolean,
): Promise<ActionResult<{ invoice_no: string; sent: boolean; note: string | null }>> {
  try {
    const r = await apiFetch<{ invoice_no: string; sent: boolean; note: string | null }>(
      `/api/v1/pulse/commitments/${id}/invoice${send ? '?send=1' : ''}`,
      { method: 'POST' },
    );
    revalidatePath('/cashflow');
    return {
      ok: true,
      data: { invoice_no: r.invoice_no, sent: r.sent, note: r.note ?? null },
    };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ⌥-drag = copy: duplicate expected payments into another period.
export async function duplicateLines(
  lineIds: string[],
  expectedDate: string,
): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/lines/duplicate', {
      method: 'POST',
      body: JSON.stringify({ ids: lineIds, expected_date: expectedDate }),
    });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Soft delete (API sets deleted_at — hard rule #4).
export async function deleteCommitment(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/commitments/${id}`, { method: 'DELETE' });
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
