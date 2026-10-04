import { redirect } from 'next/navigation';
import { ENTITY } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { PlatformInvoicesClient } from './invoices-client';

// The platform's own outgoing invoices — the SELLER side of the same
// purchase ledger the app Invoices pages read (Sjoerd, 2026-09-03: "The
// Fibre already has an invoice system… can we use it for the super admin
// also?"). Every fibre-platform row across all workspaces: who pays for
// their Fibre, when, and the Stripe-hosted PDF that is the legal document.
//
// Rebuilt on the shared Invoices area 2026-10-04. Sjoerd, with this page open
// beside Meet's: *"this is the interface of meet. Why not the same in fibre
// (and hopefully in all the other)."* It had been a fork — a hand-rolled
// table whose rows did not open, so the operator could see that a workspace
// paid but not the invoice itself. It also typed its own colours for the
// status pills, which docs/brand-design.md forbids in an app; the shared
// component's pills come from the design tokens, so that went away with it.

export const metadata = { title: 'Platform invoices' };

type Me = { user: { is_super_admin?: boolean } };

export default async function AdminInvoicesPage() {
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  // The same seller the platform's own receipts are issued under
  // (routes/purchases.ts, the fibre-platform branch): one entity, every row.
  // Deliberately the SAME source rather than a second description of who we
  // are — two places naming the seller is how an invoice ends up in the wrong
  // legal entity's name, which has happened here before.
  const seller = { legal_name: ENTITY.name, address: ENTITY.address };

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Platform invoices"
        description="What workspaces pay The Fibre — the seller side of the same ledger every app's Invoices page reads. The Stripe-hosted PDF is the legal document."
      />
      <PlatformInvoicesClient seller={seller} />
    </PageContainer>
  );
}
