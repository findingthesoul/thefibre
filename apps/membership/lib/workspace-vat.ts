// Is this community VAT-registered? For the admin "Price includes VAT"
// switch, which is shown only then (a community that is not registered has
// prices that are just prices). Fails closed: unknown → not registered → no
// switch, which is the old behaviour.

import { apiFetch } from '@/lib/api';

export async function workspaceVatRegistered(): Promise<boolean> {
  try {
    const b = await apiFetch<{ invoice_details?: { vat_registered?: boolean } | null }>('/api/v1/workspace-billing');
    return b.invoice_details?.vat_registered === true;
  } catch {
    return false;
  }
}
