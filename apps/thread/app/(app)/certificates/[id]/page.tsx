import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { TeamOption, WorkspaceMember } from '@/lib/thread-types';
import type { CertShares, CertTemplate } from '@/lib/certificate-types';
import { uiLocale } from '@/lib/locale';
import { CertificateBuilder } from './builder';

export default async function CertificateTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await uiLocale();
  const { id } = await params;

  let template: CertTemplate;
  try {
    template = await apiFetch<CertTemplate>(`/api/v1/thread/certificate-templates/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [teams, members, shares] = await Promise.all([
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
      items: [] as TeamOption[],
    })),
    apiFetch<{ items: WorkspaceMember[] }>('/api/v1/thread/workspace-members').catch(() => ({
      items: [] as WorkspaceMember[],
    })),
    apiFetch<CertShares>(`/api/v1/thread/certificate-templates/${id}/shares`).catch(
      (): CertShares => ({ user_ids: [], team_ids: [] }),
    ),
  ]);

  // Wider than the standard PageContainer — the builder needs room for the
  // fields panel next to a 700px canvas.
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <CertificateBuilder
        locale={locale}
        template={template}
        teams={teams.items}
        members={members.items}
        initialShares={shares}
      />
    </div>
  );
}
