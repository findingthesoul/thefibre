// Payments — organised at user + workspace level (Sjoerd 2026-07-04: no
// more bouncing to Meet in a new tab). One Stripe connection per PERSON
// (shared by Meet and Thread) and one per WORKSPACE; teams don't hold
// accounts — team threads pay out to the workspace account by the payout
// rule. Workspace section is admin-gated.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { PaymentsForm } from './form';

export const dynamic = 'force-dynamic';

export default async function PaymentsSettingsPage() {
  type Payee = {
    stripe_account_id: string | null;
    invoice_details?: { legal_name?: string; address?: string; tax_no?: string } | null;
  };
  const [me, settings, purchases] = await Promise.all([
    apiFetch<Payee>('/api/v1/thread/me').catch(() => ({ stripe_account_id: null }) as Payee),
    apiFetch<Payee>('/api/v1/thread/settings').catch(() => ({ stripe_account_id: null }) as Payee),
    apiFetch<{ role: string }>('/api/v1/purchases?scope=me').catch(() => ({ role: 'organiser' })),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Payments"
        description="Where your money lands — one Stripe connection per person (shared across Fibre Meet and The Thread) and one for the workspace."
      />
      <PaymentsForm
        personalAccount={me.stripe_account_id}
        personalDetails={me.invoice_details ?? null}
        workspaceAccount={settings.stripe_account_id}
        workspaceDetails={settings.invoice_details ?? null}
        isAdmin={purchases.role === 'admin' || purchases.role === 'super_admin'}
      />
    </PageContainer>
  );
}
