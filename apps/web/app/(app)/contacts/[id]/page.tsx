import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Building2, Crown, Star } from 'lucide-react';
import { appName, type AppId } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { countryName } from '@/lib/countries';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';

type Person = {
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
  pronouns: string | null;
};

type Activity = {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app_id: string;
  app: { slug: string; name: string } | null;
};

type OrgMembership = {
  id: string;
  title: string | null;
  department: string | null;
  seniority_level: string | null;
  employment_type: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
  is_budget_holder: boolean;
  is_champion: boolean;
  started_at: string | null;
  ended_at: string | null;
  organisation: { id: string; name: string; slug: string; domain: string | null } | null;
};

type Memberships = {
  org_memberships: OrgMembership[];
  workspace_member: {
    workspace_role: 'admin' | 'member';
    relationship_type: 'internal' | 'external';
    joined_at: string;
    workspace: { id: string; name: string; slug: string } | null;
  } | null;
  app_memberships: { app: { slug: string; name: string }; role: string }[];
  has_account: boolean;
};

export default async function ContactOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

  let person: Person;
  let activities: Activity[] = [];
  let memberships: Memberships = {
    org_memberships: [],
    workspace_member: null,
    app_memberships: [],
    has_account: false,
  };
  try {
    person = await apiFetch<Person>(`/api/v1/persons/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  try {
    const data = await apiFetch<{ items: Activity[] }>(
      `/api/v1/activities?person_id=${id}&limit=100`,
    );
    activities = data.items;
  } catch {
    // Non-fatal.
  }
  try {
    memberships = await apiFetch<Memberships>(`/api/v1/persons/${id}/memberships`);
  } catch {
    // Non-fatal — leave defaults.
  }

  const addressLine = [person.street, person.postal_code].filter(Boolean).join(', ');
  const location = [person.city, person.region, countryName(person.country)].filter(Boolean).join(', ');

  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label={t(locale, 'email_label')} value={person.email} />
        <Field label={t(locale, 'phone')} value={person.phone} />
        <Field label="LinkedIn" value={person.linkedin_url} link />
        <Field label={t(locale, 'address_label')} value={addressLine || null} />
        <Field label={t(locale, 'location')} value={location || null} />
        <Field label={t(locale, 'language')} value={person.preferred_language} />
        <Field label={t(locale, 'pronouns')} value={person.pronouns} />
      </section>

      {/* Organisation memberships — platform-owned contact-graph edges
          per brief §2. Shows current + historical positions. */}
      <section className="mt-14">
        <SectionLabel>{t(locale, 'nav_organisations')}</SectionLabel>
        {memberships.org_memberships.length === 0 ? (
          <div className="mt-4">
            <EmptyState>{t(locale, 'no_orgs_linked')}</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {memberships.org_memberships.map((m) => {
              const ended = !!m.ended_at;
              const dateRange = [
                m.started_at && new Date(m.started_at).getFullYear(),
                m.ended_at ? new Date(m.ended_at).getFullYear() : t(locale, 'present'),
              ]
                .filter(Boolean)
                .join(' – ');
              return (
                <li key={m.id} className="px-5 py-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-ink-muted shrink-0" strokeWidth={1.5} />
                        {m.organisation ? (
                          <Link
                            href={`/organisations/${m.organisation.id}`}
                            className="font-medium hover:underline"
                          >
                            {m.organisation.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{t(locale, 'unknown_org')}</span>
                        )}
                        {m.is_primary && <Chip>{t(locale, 'primary')}</Chip>}
                        {ended && <Chip tone="muted">{t(locale, 'ended')}</Chip>}
                      </div>
                      <div className="mt-1 text-xs text-ink-muted">
                        {[m.title, m.department, m.seniority_level].filter(Boolean).join(' · ') || '—'}
                        {dateRange && (
                          <>
                            {' · '}
                            {dateRange}
                          </>
                        )}
                      </div>
                      {(m.is_decision_maker || m.is_budget_holder || m.is_champion) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.is_decision_maker && (
                            <Chip>
                              <Crown className="h-3 w-3" /> {t(locale, 'decision_maker')}
                            </Chip>
                          )}
                          {m.is_budget_holder && <Chip>{t(locale, 'budget_holder')}</Chip>}
                          {m.is_champion && (
                            <Chip>
                              <Star className="h-3 w-3" /> {t(locale, 'champion')}
                            </Chip>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Workspace + app access — only meaningful if the person has a
          Fibre user account (i.e. they sign in). Per brief §2, workspace
          memberships are platform-owned. */}
      {memberships.has_account && memberships.workspace_member && (
        <section className="mt-14">
          <SectionLabel>{t(locale, 'workspace_access')}</SectionLabel>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'nav_workspace')}
              value={memberships.workspace_member.workspace?.name ?? null}
            />
            <Field label={t(locale, 'role')} value={memberships.workspace_member.workspace_role} />
            <Field
              label={t(locale, 'relationship')}
              value={t(
                locale,
                memberships.workspace_member.relationship_type === 'internal'
                  ? 'internal'
                  : 'external',
              )}
            />
          </div>
          {memberships.app_memberships.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'apps_access_to')}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {memberships.app_memberships.map((am) => (
                  <span
                    key={am.app.slug}
                    className="text-xs rounded border border-line bg-surface-raised px-2 py-1"
                  >
                    {appName(am.app.slug as AppId) ?? am.app.name}
                    {am.role !== 'member' && (
                      <span className="text-ink-muted ml-1">· {am.role}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-14">
        <SectionLabel>{t(locale, 'timeline')}</SectionLabel>
        {activities.length === 0 ? (
          <EmptyState>{t(locale, 'no_activity_yet')}</EmptyState>
        ) : (
          <ol className="mt-4 border-l border-line pl-6 space-y-6">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  {new Date(a.occurred_at).toLocaleString(INTL_LOCALES[locale], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {' · '}
                  {a.app ? appName(a.app.slug as AppId) ?? a.app.name : a.app_id}
                  {' · '}
                  {a.type}
                </div>
                <div className="mt-1 text-sm">{a.subject}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'muted';
}) {
  const cls =
    tone === 'muted'
      ? 'bg-surface-sunken text-ink-muted border-line'
      : 'bg-ink text-surface-raised border-ink';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${cls}`}
    >
      {children}
    </span>
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
