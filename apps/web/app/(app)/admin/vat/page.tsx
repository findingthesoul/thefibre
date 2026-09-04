import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { VatEditor } from './editor';
import type { VatConfig } from './actions';

export const metadata = { title: 'VAT' };

type Me = { user: { is_super_admin?: boolean } };

export default async function AdminVatPage() {
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let config: VatConfig | null = null;
  try {
    config = await apiFetch<VatConfig>('/api/v1/admin/vat');
  } catch {
    /* empty state below */
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="VAT"
        description="The platform's own rate table — the reference for every rail Stripe Tax doesn't cover, updated here when the law updates. Card payments keep computing through Stripe Tax."
      />
      <section className="mt-8">
        {config ? <VatEditor initial={config} /> : <EmptyState>Could not load the VAT table.</EmptyState>}
      </section>
      <section className="mt-10 border-t border-line pt-5">
        <SectionLabel>How it is applied</SectionLabel>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-subtle">
          Home country → home rate. EU business with a validated VAT number → reverse-charged
          (when the toggle above is on). EU consumer → the destination country&rsquo;s rate.
          Outside the EU → out of scope. Rates here are seeded from public sources — verify
          against the official register before invoicing a new country.
        </p>
      </section>
    </PageContainer>
  );
}
