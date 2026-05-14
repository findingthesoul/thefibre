import { redirect } from 'next/navigation';

export default async function ProfessionalRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contacts/${id}/profile`);
}
