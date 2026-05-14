import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function IdentityRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/organisations/${id}/profile`);
}
