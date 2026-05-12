import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

type Organisation = {
  id: string;
  name: string;
  legal_name: string | null;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  vat_number: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  size_band: string | null;
  sector: string | null;
  industry: string | null;
  org_type: string | null;
  org_identity?: { mission_statement?: string | null; stated_values?: string[] } | null;
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
    <div className="mx-auto max-w-4xl px-8 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/organisations" className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink">
          <ChevronLeft size={14} strokeWidth={1.75} />
          Organisations
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-medium tracking-tight">{org.name}</h1>
        {org.legal_name && org.legal_name !== org.name && (
          <p className="text-sm text-ink-subtle mt-1">{org.legal_name}</p>
        )}
      </header>

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
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">Members</div>
        {members.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            No members linked yet.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {members.map((m) => {
              const name = [m.person.first_name, m.person.last_name].filter(Boolean).join(' ') || m.person.email || 'Unnamed';
              return (
                <li key={m.id}>
                  <Link
                    href={`/contacts/${m.person.id}`}
                    className="flex items-baseline justify-between gap-4 px-5 py-4 hover:bg-surface-sunken"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-sm text-ink-subtle truncate">
                        {[m.title, m.department].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    {m.is_primary && (
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted shrink-0">primary</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, link = false }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? (
          link ? (
            <a href={value.startsWith('http') ? value : `https://${value}`} className="underline" target="_blank" rel="noreferrer">
              {value.replace(/^https?:\/\//, '')}
            </a>
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
