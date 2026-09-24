// Payments — in The Fibre, where the values live.
//
// Sjoerd, 2026-09-23: *"the settings for my company: payment etc. is needed in
// 4 apps, but it does not show in the fibre settings... I expect that reusable
// items are always there."* He was right and the omission was backwards: the
// data has been platform-level since 2026-07-04 (personal on user_profile,
// workspace on the workspace row, all readers through lib/payment-accounts.ts)
// and the page existed in Thread, Meet, Members and Pulse — every app except
// the one that owns it.
//
// Same endpoints, same shared form, same strings. Change it here or there and
// it is the same answer; this is simply the place you look first.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PaymentsForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payments · The Fibre' };

type Personal = {
  stripe_account_id: string | null;
  invoice_details?: { legal_name?: string; address?: string; tax_no?: string } | null;
  default_payment_methods?: ('stripe' | 'invoice')[] | null;
};
type WorkspaceBilling = Personal & { editable: boolean };

export default async function PaymentsSettingsPage() {
  const locale = await uiLocale();
  const [profile, workspace, brand] = await Promise.all([
    apiFetch<Personal>('/api/v1/profile').catch(() => ({ stripe_account_id: null }) as Personal),
    apiFetch<WorkspaceBilling>('/api/v1/workspace-billing').catch(
      () => ({ stripe_account_id: null, editable: false }) as WorkspaceBilling,
    ),
    apiFetch<{ name: string | null }>('/api/v1/workspace-brand').catch(() => ({ name: null })),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'payments_title')} description={t(locale, 'payments_desc')} />
      <PaymentsForm
        locale={locale}
        personalAccount={profile.stripe_account_id}
        personalDetails={profile.invoice_details ?? null}
        personalMethods={profile.default_payment_methods ?? null}
        workspaceAccount={workspace.stripe_account_id}
        workspaceDetails={workspace.invoice_details ?? null}
        workspaceMethods={workspace.default_payment_methods ?? null}
        isAdmin={workspace.editable}
        workspaceName={brand.name}
      />
    </PageContainer>
  );
}
