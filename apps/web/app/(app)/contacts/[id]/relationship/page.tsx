import { redirect } from 'next/navigation';

export default async function RelationshipRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contacts/${id}/app/fibre-sales`);
}
