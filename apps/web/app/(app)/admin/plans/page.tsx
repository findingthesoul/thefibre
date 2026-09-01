import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, EmptyState } from '@/components/ui/page';
import { PlanMatrix, type AdminPlan } from './matrix';

// The tier matrix — every package, every functionality, priced monthly and
// yearly, with checkboxes that ARE the gates (same billing_plan rows
// lib/plan.ts reads). Super-admin only.

export const metadata = { title: 'Plans' };

type Me = { user: { is_super_admin?: boolean } };

export default async function AdminPlansPage() {
  // Gate at the page level — the API refuses too, but a clean redirect beats
  // a 403 rendered as an empty screen.
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let plans: AdminPlan[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ plans: AdminPlan[] }>('/api/v1/admin/plans');
    plans = data.plans;
  } catch {
    error = 'Could not load the plans.';
  }

  return (
    <PageContainer max="5xl">
      <PageHeader
        title="Plans"
        description="The packages, side by side: what each one costs and what it switches on. This table is what the gates enforce and what the public pricing page shows — there is no second list anywhere."
      />
      <section className="mt-8">
        {error ? <EmptyState>{error}</EmptyState> : <PlanMatrix plans={plans} />}
      </section>
    </PageContainer>
  );
}
