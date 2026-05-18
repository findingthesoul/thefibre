import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { countryName } from '@/lib/countries';
import { AddMemberButton, type PersonOption } from './add-member';
import { EndMemberButton } from './end-member';
import {
  DomainVerification,
  type DomainVerificationState,
} from './domain-verification';

type Organisation = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  sector: string | null;
  size_band: string | null;
  org_type: string | null;
  domain_verified_at: string | null;
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

export default async function OrganisationOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let org: Organisation;
  let members: Member[] = [];
  let people: PersonOption[] = [];
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
  try {
    const data = await apiFetch<{ items: PersonOption[] }>(`/api/v1/persons?limit=100`);
    const memberIds = new Set(members.map((m) => m.person.id));
    people = data.items.filter((p) => !memberIds.has(p.id));
  } catch {
    // Non-fatal.
  }

  // Domain verification — fetch on the server so the panel renders with
  // accurate state on first paint. Non-fatal: if the endpoint fails we
  // fall back to "Not verified" and the panel offers a Start button.
  let domainVerification: DomainVerificationState = {
    domain: org.domain,
    domain_verified_at: null,
    challenge: null,
  };
  try {
    domainVerification = await apiFetch<DomainVerificationState>(
      `/api/v1/organisations/${id}/domain-verification`,
    );
  } catch {
    // Non-fatal — leave the synthesised defaults above.
  }

  const addressLine = [org.street, org.postal_code].filter(Boolean).join(', ');
  const location = [org.city, org.region, countryName(org.country)].filter(Boolean).join(', ');

  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label="Domain" value={org.domain} />
        <Field label="Website" value={org.website} link />
        <Field label="LinkedIn" value={org.linkedin_url} link />
        <Field label="Address" value={addressLine || null} />
        <Field label="Location" value={location || null} />
        <Field label="Sector" value={org.sector} />
        <Field label="Size" value={org.size_band} />
        <Field label="Type" value={org.org_type} />
      </section>

      {org.domain && (
        <section className="mt-12">
          <SectionLabel>Domain verification</SectionLabel>
          <div className="mt-3">
            <DomainVerification orgId={org.id} initial={domainVerification} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionLabel>Members</SectionLabel>
          <AddMemberButton orgId={org.id} people={people} />
        </div>
        {members.length === 0 ? (
          <EmptyState>No members linked yet. Click Add member to link a contact.</EmptyState>
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
                  meta={m.is_primary ? <span className="uppercase">Primary</span> : null}
                  trailing={<EndMemberButton orgId={org.id} membershipId={m.id} personLabel={name} />}
                />
              );
            })}
          </ListGroup>
        )}
      </section>
    </>
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
