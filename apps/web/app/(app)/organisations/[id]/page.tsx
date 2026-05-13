import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { OrgActions, type EditableOrg } from './org-actions';

type Organisation = EditableOrg & {
  org_identity?: { mission_statement?: string | null } | null;
  org_system_context?: { transformation_stage?: string | null } | null;
  org_relationship?: {
    relationship_stage?: string | null;
    health_status?: string | null;
    last_touchpoint_at?: string | null;
  } | null;
};

type Member = {
  id: string;
  title: string | null;
  department: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
  started_at: string | null;
  ended_at: string | null;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null };
};

export default async function OrganisationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let org: Organisation;
  let members: Member[] = [];
  try {
    org = await apiFetch<Organisation>(`/api/v1/organisations/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  try {
    const data = await apiFetch<{ items: Member[] }>(`/api/v1/organisations/${id}/members`);
    members = data.items;
  } catch {
    // Non-fatal.
  }

  const location = [org.city, org.region, org.country].filter(Boolean).join(', ');

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/organisations" label="Organisations" />
      <PageHeader
        title={org.name}
        description={org.legal_name && org.legal_name !== org.name ? org.legal_name : undefined}
        actions={<OrgActions org={org} />}
      />

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label="Domain" value={org.domain} />
        <Field label="Website" value={org.website} link />
        <Field label="LinkedIn" value={org.linkedin_url} link />
        <Field label="Location" value={location || null} />
        <Field label="Sector" value={org.sector} />
        <Field label="Size" value={org.size_band} />
        <Field label="Type" value={org.org_type} />
        <Field label="Stage" value={org.org_relationship?.relationship_stage ?? null} />
        <Field label="Health" value={org.org_relationship?.health_status ?? null} />
      </section>

      <section className="mt-12">
        <SectionLabel>Members</SectionLabel>
        {members.length === 0 ? (
          <EmptyState>No members linked yet.</EmptyState>
        ) : (
          <ListGroup>
            {members.map((m) => {
              const name =
                [m.person.first_name, m.person.last_name].filter(Boolean).join(' ') ||
                m.person.email ||
                'Unnamed';
              return (
                <ListRow
                  key={m.id}
                  href={`/contacts/${m.person.id}`}
                  primary={name}
                  secondary={[m.title, m.department].filter(Boolean).join(' · ') || '—'}
                  meta={m.is_primary ? 'PRIMARY' : ''}
                />
              );
            })}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}

function Field({ label, value, link = false }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? (
          link ? (
            <Link href={value.startsWith('http') ? value : `https://${value}`} className="underline" target="_blank">
              {value.replace(/^https?:\/\//, '')}
            </Link>
          ) : (
            value
          )
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
    </div>
  );
}
