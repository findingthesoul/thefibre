import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, isAppSlug, type AppSlug, type PersonSubResource } from '@/lib/apps';

import { ChangeEdit, type ChangeRow } from '../../change/edit';
import { RelationshipEdit, type RelationshipRow } from '../../relationship/edit';
import { LearningEdit, type LearningRow } from '../../learning/edit';
import { PersonBillingEdit, type PersonBillingRow } from '../../billing/edit';
import { MeetTab } from '../../meet/tab';
import { MembershipTab } from '../../membership/tab';
import { countryName } from '@/lib/countries';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

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
  const locale = await uiLocale();
  if (!isAppSlug(appSlug)) notFound();
  // Platform's content is folded into Profile.
  if (appSlug === 'fibre-platform') notFound();

  // Fibre Meet has its own bespoke layout (Meet profile + upcoming/past
  // meetings + activity), not the generic curator-section layout.
  if (appSlug === 'fibre-meet') {
    return <MeetTab personId={id} locale={locale} />;
  }

  // Membership likewise: its curator data is the member row itself (tier,
  // status, renewal), rendered read-only — writes happen in the Membership app.
  if (appSlug === 'membership') {
    return <MembershipTab personId={id} locale={locale} />;
  }

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
        {t(locale, 'curator_owned_pre')}{' '}
        <span className="text-ink font-medium">{app.label}</span>{' '}
        {t(locale, 'curator_owned_post', { app: app.label })}
      </div>

      {app.personSubResources.length === 0 ? (
        <EmptyState>{t(locale, 'no_curator_fields', { app: app.label })}</EmptyState>
      ) : (
        <div className="mt-6 space-y-14">
          {app.personSubResources.map((sub) => (
            <SubResourceSection key={sub} personId={id} sub={sub} appSlug={appSlug} locale={locale} />
          ))}
        </div>
      )}

      <section className="mt-14">
        <SectionLabel>{t(locale, 'activity_from', { app: app.label })}</SectionLabel>
        {activities.length === 0 ? (
          <EmptyState>{t(locale, 'no_activity_from', { app: app.label })}</EmptyState>
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
  locale,
}: {
  personId: string;
  sub: PersonSubResource;
  appSlug: AppSlug;
  locale: Locale;
}) {
  switch (sub) {
    case 'change':
      return <ChangeSection personId={personId} appSlug={appSlug} locale={locale} />;
    case 'relationship':
      return <RelationshipSection personId={personId} appSlug={appSlug} locale={locale} />;
    case 'learning':
      return <LearningSection personId={personId} appSlug={appSlug} locale={locale} />;
    case 'billing':
      return <BillingSection personId={personId} appSlug={appSlug} locale={locale} />;
    case 'professional':
      // Professional lives on the Profile tab; not expected here but guard anyway.
      return null;
    default:
      return null;
  }
}

async function BillingSection({
  personId,
  appSlug,
  locale,
}: {
  personId: string;
  appSlug: AppSlug;
  locale: Locale;
}) {
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
        <SectionLabel>{t(locale, 'invoicing')}<AppChip slug={appSlug} /></SectionLabel>
        <PersonBillingEdit personId={personId} initial={row} locale={locale} />
      </div>
      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <BillingField label={t(locale, 'legal_name')} value={row?.legal_name ?? null} />
            <BillingField label={t(locale, 'tax_vat_id')} value={row?.tax_id ?? null} />
            <BillingField label={t(locale, 'billing_email')} value={row?.billing_email ?? null} />
            <BillingField label={t(locale, 'currency')} value={row?.currency ?? null} />
            <BillingField
              label={t(locale, 'payment_terms')}
              value={
                row?.payment_terms_days !== null && row?.payment_terms_days !== undefined
                  ? t(locale, 'n_days', { n: row.payment_terms_days })
                  : null
              }
            />
            <BillingField
              label={t(locale, 'po_required')}
              value={row?.po_required === null || row?.po_required === undefined
                ? null
                : row.po_required ? t(locale, 'yes') : t(locale, 'no')}
            />
            <BillingField label={t(locale, 'billing_address')} value={addressLine || null} />
            <BillingField label={t(locale, 'billing_location')} value={billingLocation || null} />
          </div>
          {row?.notes && (
            <div className="mt-10">
              <SectionLabel>{t(locale, 'notes')}</SectionLabel>
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

const CHANGE_ROLE: Record<string, UiKey> = {
  sponsor: 'change_role_sponsor',
  champion: 'champion',
  implementer: 'change_role_implementer',
  sceptic: 'change_role_sceptic',
  bystander: 'change_role_bystander',
  gatekeeper: 'change_role_gatekeeper',
};
const CHANGE_STANCE: Record<string, UiKey> = {
  driving: 'stance_driving',
  supporting: 'stance_supporting',
  ambivalent: 'stance_ambivalent',
  resistant: 'stance_resistant',
};
const CHANGE_READINESS: Record<string, UiKey> = {
  not_ready: 'readiness_not_ready',
  cautious: 'readiness_cautious',
  open: 'readiness_open',
  ready: 'readiness_ready',
  driving: 'stance_driving',
};

async function ChangeSection({
  personId,
  appSlug,
  locale,
}: {
  personId: string;
  appSlug: AppSlug;
  locale: Locale;
}) {
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
        <SectionLabel>{t(locale, 'change_context')}<AppChip slug={appSlug} /></SectionLabel>
        <ChangeEdit personId={personId} initial={row} locale={locale} />
      </div>
      {empty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'role_in_change')}
              value={
                row?.role_in_change
                  ? CHANGE_ROLE[row.role_in_change]
                    ? t(locale, CHANGE_ROLE[row.role_in_change]!)
                    : row.role_in_change
                  : null
              }
            />
            <Field
              label={t(locale, 'stance')}
              value={
                row?.stance_on_change
                  ? CHANGE_STANCE[row.stance_on_change]
                    ? t(locale, CHANGE_STANCE[row.stance_on_change]!)
                    : row.stance_on_change
                  : null
              }
            />
            <Field
              label={t(locale, 'readiness')}
              value={
                row?.readiness_level
                  ? CHANGE_READINESS[row.readiness_level]
                    ? t(locale, CHANGE_READINESS[row.readiness_level]!)
                    : row.readiness_level
                  : null
              }
            />
            <Field label={t(locale, 'leadership_style')} value={row?.leadership_style ?? null} />
            <Field
              label={t(locale, 'change_themes')}
              value={
                row?.change_themes && row.change_themes.length
                  ? row.change_themes.join(', ')
                  : null
              }
            />
            <Field
              label={t(locale, 'blockers')}
              value={row?.blockers && row.blockers.length ? row.blockers.join(', ') : null}
            />
            <Field
              label={t(locale, 'motivators')}
              value={
                row?.motivators && row.motivators.length ? row.motivators.join(', ') : null
              }
            />
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'current_challenge')}</SectionLabel>
            {row?.current_challenge ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenge}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>
              {t(locale, 'facilitator_notes')}
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'sensitive')}
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

const REL_SOURCE: Record<string, UiKey> = {
  event_attendee: 'source_event_attendee',
  referral: 'source_referral',
  cold_outreach: 'source_cold_outreach',
  client_contact: 'source_client_contact',
  inbound: 'source_inbound',
};
const REL_STRENGTH: Record<string, UiKey> = {
  weak: 'strength_weak',
  warm: 'strength_warm',
  strong: 'strength_strong',
  advocate: 'strength_advocate',
};
const REL_COMM: Record<string, UiKey> = {
  email: 'email_label',
  phone: 'phone',
  linkedin: 'comm_linkedin',
  in_person: 'comm_in_person',
};

async function RelationshipSection({
  personId,
  appSlug,
  locale,
}: {
  personId: string;
  appSlug: AppSlug;
  locale: Locale;
}) {
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
        <SectionLabel>{t(locale, 'relationship_context')}<AppChip slug={appSlug} /></SectionLabel>
        <RelationshipEdit personId={personId} initial={row} locale={locale} />
      </div>
      {empty ? (
        <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field
            label={t(locale, 'source')}
            value={
              row!.source
                ? REL_SOURCE[row!.source]
                  ? t(locale, REL_SOURCE[row!.source]!)
                  : row!.source
                : null
            }
          />
          <Field label={t(locale, 'source_detail')} value={row!.source_detail} />
          <Field label={t(locale, 'introduced_by')} value={row!.introduced_by} />
          <Field
            label={t(locale, 'strength')}
            value={
              row!.relationship_strength
                ? REL_STRENGTH[row!.relationship_strength]
                  ? t(locale, REL_STRENGTH[row!.relationship_strength]!)
                  : row!.relationship_strength
                : null
            }
          />
          <Field
            label={t(locale, 'communication_preference')}
            value={
              row!.communication_preference
                ? REL_COMM[row!.communication_preference]
                  ? t(locale, REL_COMM[row!.communication_preference]!)
                  : row!.communication_preference
                : null
            }
          />
          <Field label={t(locale, 'best_time_to_reach')} value={row!.best_time_to_reach} />
          <Field label={t(locale, 'key_contact')} value={boolLabel(row!.is_key_contact, locale)} />
          <Field label={t(locale, 'ambassador')} value={boolLabel(row!.is_ambassador, locale)} />
          <Field
            label={t(locale, 'first_contact')}
            value={
              row!.first_contact_at
                ? new Date(row!.first_contact_at).toLocaleDateString(INTL_LOCALES[locale])
                : null
            }
          />
          <div className="md:col-span-3">
            <Field label={t(locale, 'first_contact_notes')} value={row!.first_contact_notes} />
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Learning ----------

const LEARNING_STYLE: Record<string, UiKey> = {
  visual: 'learning_visual',
  auditory: 'learning_auditory',
  reading: 'learning_reading',
  kinaesthetic: 'learning_kinaesthetic',
  reflective: 'learning_reflective',
};
const GROUP_ROLE: Record<string, UiKey> = {
  connector: 'group_connector',
  challenger: 'group_challenger',
  synthesiser: 'group_synthesiser',
  anchor: 'group_anchor',
  observer: 'group_observer',
};

async function LearningSection({
  personId,
  appSlug,
  locale,
}: {
  personId: string;
  appSlug: AppSlug;
  locale: Locale;
}) {
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
        <SectionLabel>{t(locale, 'learning_profile')}<AppChip slug={appSlug} /></SectionLabel>
        <LearningEdit personId={personId} initial={row} locale={locale} />
      </div>
      {empty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'learning_style')}
              value={
                row?.learning_style
                  ? LEARNING_STYLE[row.learning_style]
                    ? t(locale, LEARNING_STYLE[row.learning_style]!)
                    : row.learning_style
                  : null
              }
            />
            <Field
              label={t(locale, 'group_role_tendency')}
              value={
                row?.group_role_tendency
                  ? GROUP_ROLE[row.group_role_tendency]
                    ? t(locale, GROUP_ROLE[row.group_role_tendency]!)
                    : row.group_role_tendency
                  : null
              }
            />
            <Field
              label={t(locale, 'open_to_coaching')}
              value={boolLabel(row?.open_to_coaching ?? null, locale)}
            />
            <Field
              label={t(locale, 'open_to_peer_exchange')}
              value={boolLabel(row?.open_to_peer_exchange ?? null, locale)}
            />
            <Field label={t(locale, 'learning_interests')} value={listLabel(row?.learning_interests)} />
            <Field label={t(locale, 'prior_programmes')} value={listLabel(row?.prior_programmes)} />
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'development_goals')}</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.development_goals ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>

          <div className="mt-10">
            <SectionLabel>
              {t(locale, 'post_programme_reflection')}
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'participant_owned')}
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

function boolLabel(v: boolean | null, locale: Locale): string | null {
  if (v === true) return t(locale, 'yes');
  if (v === false) return t(locale, 'no');
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