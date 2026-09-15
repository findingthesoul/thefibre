import { OrganisationInvoicesTab } from './invoices-tab';

// /organisations/:id/invoices — the layout offers the tab only when there is
// something to show; the API decides what the viewer may see.
export default async function OrganisationInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrganisationInvoicesTab orgId={id} />;
}
