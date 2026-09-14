import { ContactInvoicesTab } from './invoices-tab';

// /contacts/:id/invoices — see ./invoices-tab.tsx. The layout above decides
// whether the tab is offered at all (only when there is something to show);
// the page itself renders for anyone who reaches the URL, and the API decides
// what they may see.
export default async function ContactInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContactInvoicesTab personId={id} />;
}
