// Payments — the platform SPoT (Sjoerd 2026-07-04): the SAME values every
// Fibre app reads and writes. Personal level = user_profile; workspace
// level = the workspace row (admin-gated). Ported from The Thread's
// settings/payments page (the canonical pattern); only the page chrome
// import differs.

import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { PaymentsForm } from './form';

export const metadata = { title: 'Payments settings · Pulse' };
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
  const locale = await uiLocale();
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
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'payments')}
        description={t(locale, 'payments_blurb')}
      />
      <PaymentsForm
        locale={locale}
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
