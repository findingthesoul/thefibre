// Payments — the platform SPoT (Sjoerd 2026-07-04): the SAME values every
// Fibre app reads and writes. Personal level = user_profile; workspace
// level = the workspace row (admin-gated). Teams hold no accounts — team
// sales pay out to the workspace account by the payout rule.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { PaymentsForm } from './form';

export const dynamic = 'force-dynamic';

type Personal = {
  stripe_account_id: string | null;
  invoice_details?: { legal_name?: string; address?: string; tax_no?: string } | null;
  default_payment_methods?: ('stripe' | 'invoice')[] | null;
};
type WorkspaceBilling = {
  stripe_account_id: string | null;
  invoice_details?: { legal_name?: string; address?: string; tax_no?: string } | null;
  default_payment_methods?: ('stripe' | 'invoice')[] | null;
  editable: boolean;
};

export default async function PaymentsSettingsPage() {
  const [profile, workspace] = await Promise.all([
    apiFetch<Personal>('/api/v1/profile').catch(
      () => ({ stripe_account_id: null }) as Personal,
    ),
    apiFetch<WorkspaceBilling>('/api/v1/workspace-billing').catch(
      () => ({ stripe_account_id: null, editable: false }) as WorkspaceBilling,
    ),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Payments"
        description="One set of payment settings for all Fibre apps — your personal account and the workspace's, plus your default payment options."
      />
      <PaymentsForm
        personalAccount={profile.stripe_account_id}
        personalDetails={profile.invoice_details ?? null}
        personalMethods={profile.default_payment_methods ?? null}
        workspaceAccount={workspace.stripe_account_id}
        workspaceDetails={workspace.invoice_details ?? null}
        workspaceMethods={workspace.default_payment_methods ?? null}
        isAdmin={workspace.editable}
      />
    </PageContainer>
  );
}
