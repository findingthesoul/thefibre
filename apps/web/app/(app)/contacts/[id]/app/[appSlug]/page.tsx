import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, isAppSlug, type AppSlug, type PersonSubResource } from '@/lib/apps';

import { ChangeEdit, type ChangeRow } from '../../change/edit';
import { RelationshipEdit, type RelationshipRow } from '../../relationship/edit';
import { LearningEdit, type LearningRow } from '../../learning/edit';
import { PersonBillingEdit, type PersonBillingRow } from '../../billing/edit';
import { countryName } from '@/lib/countries';

function AppChip({ slug }: { slug: AppSlug }) {
  return (
    <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
      {APPS[slug].label}
    </span>
  );
}

type Activity = {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app_id: string;
  app: { slug: string; name: string } | null;
};

export default async function ContactAppTab({
  params,
}: {
  params: Promise<{ id: string; appSlug: string }>;
}) {
  const { id, appSlug } = await params;
  if (!isAppSlug(appSlug)) notFound();
  // Platform's content is folded into Profile.
  if (appSlug === 'fibre-platform') notFound();

  const app = APPS[appSlug];

  let activities: Activity[] = [];
  try {
    const data = await apiFetch<{ items: Activity[] }>(
      `/api/v1/activities?person_id=${id}&app_id=${appSlug}&limit=100`,
    );
    activities = data.items;
  } catch {
    // Non-fatal.
  }

  return (
    <>
      <div className="text-xs text-ink-subtle">
        Curator fields below are owned by{' '}
        <span className="text-ink font-medium">{app.label}</span> — they only
        exist because this app justifies them. Workspace members without
        access to {app.label} don&apos;t see them.
      </div>

      {app.personSubResources.length === 0 ? (
        <EmptyState>
          No curator fields yet for {app.label}. Activity from this app will appear below.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-14">
          {app.personSubResources.map((sub) => (
            <SubResourceSection key={sub} personId={id} sub={sub} appSlug={appSlug} />
          ))}
        </div>
      )}

      <section className="mt-14">
        <SectionLabel>Activity from {app.label}</SectionLabel>
        {activities.length === 0 ? (
          <EmptyState>No activity yet from {app.label}.</EmptyState>
        ) : (
          <ol className="mt-4 border-l border-line pl-6 space-y-6">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  {new Date(a.occurred_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
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

async function SubResourceSection({
  personId,
  sub,
  appSlug,
}: {
  personId: string;
  sub: PersonSubResource;
  appSlug: AppSlug;
}) {
  switch (sub) {
    case 'change':
      return <ChangeSection personId={personId} appSlug={appSlug} />;
    case 'relationship':
      return <RelationshipSection personId={personId} appSlug={appSlug} />;
    case 'learning':
      return <LearningSection personId={personId} appSlug={appSlug} />;
    case 'billing':
      return <BillingSection personId={personId} appSlug={appSlug} />;
    case 'professional':
      // Professional lives on the Profile tab; not expected here but guard anyway.
      return null;
    default:
      return null;
  }
}

async function BillingSection({ personId, appSlug }: { personId: string; appSlug: AppSlug }) {
  let row: PersonBillingRow | null = null;
  try {
    row = await apiFetch<PersonBillingRow | null>(`/api/v1/persons/${personId}/billing`);
  } catch {
    // Non-fatal.
  }

  const allEmpty =
    !row ||
    (!row.legal_name && !row.tax_id && !row.billing_email && !row.billing_street &&
      !row.billing_postal_code && !row.billing_city && !row.billing_region &&
      !row.billing_country && row.payment_terms_days === null && !row.currency &&
      row.po_required === null && !row.notes);

  const addressLine = [row?.billing_street, row?.billing_postal_code].filter(Boolean).join(', ');
  const billingLocation = [row?.billing_city, row?.billing_region, countryName(row?.billing_country)]
    .filter(Boolean)
    .join(', ');

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>Invoicing<AppChip slug={appSlug} /></SectionLabel>
        <PersonBillingEdit personId={personId} initial={row} />
      </div>
      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <BillingField label="Legal name" value={row?.legal_name ?? null} />
            <BillingField label="Tax / VAT ID" value={row?.tax_id ?? null} />
            <BillingField label="Billing email" value={row?.billing_email ?? null} />
            <BillingField label="Currency" value={row?.currency ?? null} />
            <BillingField
              label="Payment terms"
              value={
                row?.payment_terms_days !== null && row?.payment_terms_days !== undefined
                  ? `${row.payment_terms_days} days`
                  : null
              }
            />
            <BillingField
              label="PO required"
              value={row?.po_required === null || row?.po_required === undefined
                ? null
                : row.po_required ? 'Yes' : 'No'}
            />
            <BillingField label="Billing address" value={addressLine || null} />
            <BillingField label="Billing location" value={billingLocation || null} />
          </div>
          {row?.notes && (
            <div className="mt-10">
              <SectionLabel>Notes</SectionLabel>
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.notes}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function BillingField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">{value ? value : <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}

// ---------- Change ----------

const CHANGE_ROLE: Record<string, string> = {
  sponsor: 'Sponsor',
  champion: 'Champion',
  implementer: 'Implementer',
  sceptic: 'Sceptic',
  bystander: 'Bystander',
  gatekeeper: 'Gatekeeper',
};
const CHANGE_STANCE: Record<string, string> = {
  driving: 'Driving',
  supporting: 'Supporting',
  ambivalent: 'Ambivalent',
  resistant: 'Resistant',
};
const CHANGE_READINESS: Record<string, string> = {
  not_ready: 'Not ready',
  cautious: 'Cautious',
  open: 'Open',
  ready: 'Ready',
  driving: 'Driving',
};

async function ChangeSection({ personId, appSlug }: { personId: string; appSlug: AppSlug }) {
  let row: ChangeRow | null = null;
  try {
    row = await apiFetch<ChangeRow | null>(`/api/v1/persons/${personId}/change`);
  } catch {
    // leave null
  }
  const empty =
    !row ||
    (!row.role_in_change &&
      !row.stance_on_change &&
      !row.readiness_level &&
      !row.leadership_style &&
      !row.current_challenge &&
      !row.facilitator_notes &&
      !(row.change_themes && row.change_themes.length) &&
      !(row.blockers && row.blockers.length) &&
      !(row.motivators && row.motivators.length));

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>Change context<AppChip slug={appSlug} /></SectionLabel>
        <ChangeEdit personId={personId} initial={row} />
      </div>
      {empty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Role in change"
              value={
                row?.role_in_change
                  ? CHANGE_ROLE[row.role_in_change] ?? row.role_in_change
                  : null
              }
            />
            <Field
              label="Stance"
              value={
                row?.stance_on_change
                  ? CHANGE_STANCE[row.stance_on_change] ?? row.stance_on_change
                  : null
              }
            />
            <Field
              label="Readiness"
              value={
                row?.readiness_level
                  ? CHANGE_READINESS[row.readiness_level] ?? row.readiness_level
                  : null
              }
            />
            <Field label="Leadership style" value={row?.leadership_style ?? null} />
            <Field
              label="Change themes"
              value={
                row?.change_themes && row.change_themes.length
                  ? row.change_themes.join(', ')
                  : null
              }
            />
            <Field
              label="Blockers"
              value={row?.blockers && row.blockers.length ? row.blockers.join(', ') : null}
            />
            <Field
              label="Motivators"
              value={
                row?.motivators && row.motivators.length ? row.motivators.join(', ') : null
              }
            />
          </div>

          <div className="mt-10">
            <SectionLabel>Current challenge</SectionLabel>
            {row?.current_challenge ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenge}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>
              Facilitator notes
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                Sensitive
              </span>
            </SectionLabel>
            {row?.facilitator_notes ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.facilitator_notes}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Relationship ----------

const REL_SOURCE: Record<string, string> = {
  event_attendee: 'Event attendee',
  referral: 'Referral',
  cold_outreach: 'Cold outreach',
  client_contact: 'Client contact',
  inbound: 'Inbound',
};
const REL_STRENGTH: Record<string, string> = {
  weak: 'Weak',
  warm: 'Warm',
  strong: 'Strong',
  advocate: 'Advocate',
};
const REL_COMM: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  linkedin: 'LinkedIn',
  in_person: 'In person',
};

async function RelationshipSection({ personId, appSlug }: { personId: string; appSlug: AppSlug }) {
  let row: RelationshipRow | null = null;
  try {
    row = await apiFetch<RelationshipRow | null>(
      `/api/v1/persons/${personId}/relationship`,
    );
  } catch {
    // leave null
  }
  const empty =
    !row ||
    (row.source == null &&
      row.source_detail == null &&
      row.introduced_by == null &&
      row.relationship_strength == null &&
      row.communication_preference == null &&
      row.best_time_to_reach == null &&
      row.is_key_contact == null &&
      row.is_ambassador == null &&
      row.first_contact_notes == null &&
      row.first_contact_at == null);

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>Relationship context<AppChip slug={appSlug} /></SectionLabel>
        <RelationshipEdit personId={personId} initial={row} />
      </div>
      {empty ? (
        <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field
            label="Source"
            value={row!.source ? REL_SOURCE[row!.source] ?? row!.source : null}
          />
          <Field label="Source detail" value={row!.source_detail} />
          <Field label="Introduced by" value={row!.introduced_by} />
          <Field
            label="Strength"
            value={
              row!.relationship_strength
                ? REL_STRENGTH[row!.relationship_strength] ?? row!.relationship_strength
                : null
            }
          />
          <Field
            label="Communication preference"
            value={
              row!.communication_preference
                ? REL_COMM[row!.communication_preference] ?? row!.communication_preference
                : null
            }
          />
          <Field label="Best time to reach" value={row!.best_time_to_reach} />
          <Field label="Key contact" value={boolLabel(row!.is_key_contact)} />
          <Field label="Ambassador" value={boolLabel(row!.is_ambassador)} />
          <Field
            label="First contact"
            value={
              row!.first_contact_at
                ? new Date(row!.first_contact_at).toLocaleDateString('en-GB')
                : null
            }
          />
          <div className="md:col-span-3">
            <Field label="First contact notes" value={row!.first_contact_notes} />
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Learning ----------

const LEARNING_STYLE: Record<string, string> = {
  visual: 'Visual',
  auditory: 'Auditory',
  reading: 'Reading',
  kinaesthetic: 'Kinaesthetic',
  reflective: 'Reflective',
};
const GROUP_ROLE: Record<string, string> = {
  connector: 'Connector',
  challenger: 'Challenger',
  synthesiser: 'Synthesiser',
  anchor: 'Anchor',
  observer: 'Observer',
};

async function LearningSection({ personId, appSlug }: { personId: string; appSlug: AppSlug }) {
  let row: LearningRow | null = null;
  try {
    row = await apiFetch<LearningRow | null>(`/api/v1/persons/${personId}/learning`);
  } catch {
    // leave null
  }
  const empty =
    !row ||
    ((row.learning_interests?.length ?? 0) === 0 &&
      (row.prior_programmes?.length ?? 0) === 0 &&
      !row.learning_style &&
      !row.group_role_tendency &&
      !row.development_goals &&
      !row.post_programme_reflection &&
      row.open_to_coaching === null &&
      row.open_to_peer_exchange === null);

  const listLabel = (xs: string[] | null | undefined) =>
    xs && xs.length ? xs.join(', ') : null;

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>Learning profile<AppChip slug={appSlug} /></SectionLabel>
        <LearningEdit personId={personId} initial={row} />
      </div>
      {empty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Learning style"
              value={
                row?.learning_style
                  ? LEARNING_STYLE[row.learning_style] ?? row.learning_style
                  : null
              }
            />
            <Field
              label="Group role tendency"
              value={
                row?.group_role_tendency
                  ? GROUP_ROLE[row.group_role_tendency] ?? row.group_role_tendency
                  : null
              }
            />
            <Field label="Open to coaching" value={boolLabel(row?.open_to_coaching ?? null)} />
            <Field
              label="Open to peer exchange"
              value={boolLabel(row?.open_to_peer_exchange ?? null)}
            />
            <Field label="Learning interests" value={listLabel(row?.learning_interests)} />
            <Field label="Prior programmes" value={listLabel(row?.prior_programmes)} />
          </div>

          <div className="mt-10">
            <SectionLabel>Development goals</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.development_goals ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>

          <div className="mt-10">
            <SectionLabel>
              Post-programme reflection
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                Participant-owned
              </span>
            </SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.post_programme_reflection ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Shared ----------

function boolLabel(v: boolean | null): string | null {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return null;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1 whitespace-pre-wrap">
        {value ? value : <span className="text-ink-muted">—</span>}
      </div>
    </div>
  );
}