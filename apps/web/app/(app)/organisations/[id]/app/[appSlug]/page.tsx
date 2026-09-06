import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, isAppSlug, type AppSlug } from '@/lib/apps';

function AppChip({ slug }: { slug: AppSlug }) {
  return (
    <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
      {APPS[slug].label}
    </span>
  );
}
import {
  SystemContextEdit,
  type SystemContextRow,
} from '../../system-context/edit';
import {
  OrgRelationshipEdit,
  type OrgRelationshipRow,
} from '../../relationship/edit';
import { OrgBillingEdit, type OrgBillingRow } from '../../billing/edit';
import { countryName } from '@/lib/countries';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

const STAGE_LABELS: Record<string, UiKey> = {
  pre_awareness: 'stage_pre_awareness',
  exploring: 'stage_exploring',
  committed: 'stage_committed',
  in_programme: 'stage_in_programme',
  sustaining: 'stage_sustaining',
  alumni: 'stage_alumni',
};

const STABILITY_LABELS: Record<string, UiKey> = {
  stable: 'stability_stable',
  transitioning: 'career_transitioning',
  turbulent: 'stability_turbulent',
};

const READINESS_LABELS: Record<string, UiKey> = {
  not_ready: 'readiness_not_ready',
  cautious: 'readiness_cautious',
  open: 'readiness_open',
  ready: 'readiness_ready',
  driving: 'stance_driving',
};

const REL_STAGE_LABELS: Record<string, UiKey> = {
  prospect: 'rel_stage_prospect',
  engaged: 'rel_stage_engaged',
  active_client: 'rel_stage_active_client',
  alumni: 'stage_alumni',
  dormant: 'rel_stage_dormant',
  lost: 'rel_stage_lost',
};

const HEALTH_LABELS: Record<string, UiKey> = {
  active: 'consent_active',
  at_risk: 'health_at_risk',
  dormant: 'rel_stage_dormant',
  lost: 'rel_stage_lost',
  never_converted: 'health_never_converted',
};

const ENGAGEMENT_LABELS: Record<string, UiKey> = {
  facilitation: 'engagement_facilitation',
  learning: 'engagement_learning',
  advisory: 'engagement_advisory',
  speaking: 'engagement_speaking',
  mixed: 'engagement_mixed',
};

type Props = { params: Promise<{ id: string; appSlug: string }> };

export default async function OrgAppTab({ params }: Props) {
  const { id, appSlug } = await params;
  const locale = await uiLocale();
  if (!isAppSlug(appSlug)) notFound();

  const app = APPS[appSlug];

  return (
    <>
      {appSlug === 'fibre-meet' && (
        <SystemContextSection orgId={id} locale={locale} />
      )}
      {appSlug === 'fibre-sales' && (
        <>
          <RelationshipSection orgId={id} locale={locale} />
          <div className="mt-14">
            <BillingSection orgId={id} locale={locale} />
          </div>
        </>
      )}
      {(appSlug === 'fibre-platform' ||
        appSlug === 'the-thread' ||
        appSlug === 'fibre-learn') && (
        <section>
          <SectionLabel>{app.label}</SectionLabel>
          <EmptyState>{t(locale, 'no_org_curator_fields', { app: app.label })}</EmptyState>
        </section>
      )}

      <section className="mt-12">
        <SectionLabel>{t(locale, 'timeline')} — {app.label}</SectionLabel>
        <OrgAppTimeline orgId={id} appSlug={appSlug} locale={locale} />
      </section>
    </>
  );
}

type ActivityRow = {
  id: string;
  person_id: string;
  type: string;
  subject: string;
  occurred_at: string;
};

async function OrgAppTimeline({
  orgId,
  appSlug,
  locale,
}: {
  orgId: string;
  appSlug: string;
  locale: Locale;
}) {
  let items: ActivityRow[] = [];
  try {
    const data = await apiFetch<{ items: ActivityRow[] }>(
      `/api/v1/activities?organisation_id=${orgId}&app_id=${appSlug}&limit=50`,
    );
    items = data.items;
  } catch {
    // Non-fatal.
  }

  if (items.length === 0) {
    return <EmptyState>{t(locale, 'no_org_activity_yet')}</EmptyState>;
  }

  return (
    <ol className="mt-4 border-l border-line pl-6 space-y-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            {new Date(a.occurred_at).toLocaleString(INTL_LOCALES[locale], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {' · '}{a.type}
          </div>
          <div className="mt-1 text-sm">{a.subject}</div>
        </li>
      ))}
    </ol>
  );
}

async function SystemContextSection({ orgId, locale }: { orgId: string; locale: Locale }) {
  let row: SystemContextRow | null = null;
  try {
    row = await apiFetch<SystemContextRow | null>(
      `/api/v1/organisations/${orgId}/system-context`,
    );
  } catch {
    // Non-fatal.
  }

  const empty =
    !row ||
    (!row.transformation_stage &&
      !row.leadership_stability &&
      !row.change_readiness &&
      !row.strategic_priorities &&
      !row.current_challenges &&
      !row.political_landscape &&
      !row.lessons_from_previous_work &&
      !(row.active_change_themes && row.active_change_themes.length) &&
      !(row.structural_tensions && row.structural_tensions.length) &&
      !(row.previous_interventions && row.previous_interventions.length) &&
      !(row.blockers && row.blockers.length) &&
      !(row.enablers && row.enablers.length));

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>{t(locale, 'system_context')}<AppChip slug="fibre-meet" /></SectionLabel>
        <SystemContextEdit orgId={orgId} initial={row} locale={locale} />
      </div>

      {empty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'transformation_stage')}
              value={
                row?.transformation_stage
                  ? STAGE_LABELS[row.transformation_stage]
                    ? t(locale, STAGE_LABELS[row.transformation_stage]!)
                    : row.transformation_stage
                  : null
              }
            />
            <Field
              label={t(locale, 'leadership_stability')}
              value={
                row?.leadership_stability
                  ? STABILITY_LABELS[row.leadership_stability]
                    ? t(locale, STABILITY_LABELS[row.leadership_stability]!)
                    : row.leadership_stability
                  : null
              }
            />
            <Field
              label={t(locale, 'change_readiness')}
              value={
                row?.change_readiness
                  ? READINESS_LABELS[row.change_readiness]
                    ? t(locale, READINESS_LABELS[row.change_readiness]!)
                    : row.change_readiness
                  : null
              }
            />
            <Field
              label={t(locale, 'active_change_themes')}
              value={
                row?.active_change_themes && row.active_change_themes.length
                  ? row.active_change_themes.join(', ')
                  : null
              }
            />
            <Field
              label={t(locale, 'structural_tensions')}
              value={
                row?.structural_tensions && row.structural_tensions.length
                  ? row.structural_tensions.join(', ')
                  : null
              }
            />
            <Field
              label={t(locale, 'previous_interventions')}
              value={
                row?.previous_interventions && row.previous_interventions.length
                  ? row.previous_interventions.join(', ')
                  : null
              }
            />
            <Field
              label={t(locale, 'blockers')}
              value={row?.blockers && row.blockers.length ? row.blockers.join(', ') : null}
            />
            <Field
              label={t(locale, 'enablers')}
              value={row?.enablers && row.enablers.length ? row.enablers.join(', ') : null}
            />
          </div>

          <div className="mt-14">
            <SectionLabel>{t(locale, 'strategic_priorities')}</SectionLabel>
            {row?.strategic_priorities ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.strategic_priorities}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'current_challenges')}</SectionLabel>
            {row?.current_challenges ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenges}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'lessons_previous_work')}</SectionLabel>
            {row?.lessons_from_previous_work ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.lessons_from_previous_work}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>
              {t(locale, 'political_landscape')}
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'sensitive')}
              </span>
            </SectionLabel>
            {row?.political_landscape ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.political_landscape}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

async function RelationshipSection({ orgId, locale }: { orgId: string; locale: Locale }) {
  let row: OrgRelationshipRow | null = null;
  try {
    row = await apiFetch<OrgRelationshipRow | null>(
      `/api/v1/organisations/${orgId}/relationship`,
    );
  } catch {
    // Non-fatal.
  }

  const allEmpty =
    !row ||
    (!row.primary_owner &&
      !row.secondary_owner &&
      !row.relationship_stage &&
      !row.health_status &&
      !row.engagement_type &&
      (row.programmes_completed?.length ?? 0) === 0 &&
      row.total_participants_reached === null &&
      row.touchpoints_count === null &&
      !row.relationship_history &&
      !row.next_opportunity &&
      !row.last_touchpoint_at &&
      !row.next_planned_contact);

  const listLabel = (xs: string[] | null | undefined) =>
    xs && xs.length ? xs.join(', ') : null;
  const numLabel = (n: number | null | undefined) =>
    typeof n === 'number' ? String(n) : null;
  const dateLabel = (s: string | null | undefined) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(INTL_LOCALES[locale]);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>{t(locale, 'commercial_relationship')}<AppChip slug="fibre-sales" /></SectionLabel>
        <OrgRelationshipEdit orgId={orgId} initial={row} locale={locale} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'relationship_stage')}
              value={
                row?.relationship_stage
                  ? REL_STAGE_LABELS[row.relationship_stage]
                    ? t(locale, REL_STAGE_LABELS[row.relationship_stage]!)
                    : row.relationship_stage
                  : null
              }
            />
            <Field
              label={t(locale, 'health_status')}
              value={
                row?.health_status
                  ? HEALTH_LABELS[row.health_status]
                    ? t(locale, HEALTH_LABELS[row.health_status]!)
                    : row.health_status
                  : null
              }
            />
            <Field
              label={t(locale, 'engagement_type')}
              value={
                row?.engagement_type
                  ? ENGAGEMENT_LABELS[row.engagement_type]
                    ? t(locale, ENGAGEMENT_LABELS[row.engagement_type]!)
                    : row.engagement_type
                  : null
              }
            />
            <Field
              label={t(locale, 'total_participants_reached')}
              value={numLabel(row?.total_participants_reached)}
            />
            <Field label={t(locale, 'touchpoints')} value={numLabel(row?.touchpoints_count)} />
            <Field label={t(locale, 'last_touchpoint')} value={dateLabel(row?.last_touchpoint_at)} />
            <Field
              label={t(locale, 'next_planned_contact')}
              value={dateLabel(row?.next_planned_contact)}
            />
            <Field
              label={t(locale, 'programmes_completed')}
              value={listLabel(row?.programmes_completed)}
            />
            <Field label={t(locale, 'primary_owner')} value={row?.primary_owner ?? null} />
            <Field label={t(locale, 'secondary_owner')} value={row?.secondary_owner ?? null} />
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'next_opportunity')}</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.next_opportunity ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>

          <div className="mt-10">
            <SectionLabel>{t(locale, 'relationship_history')}</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.relationship_history ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

async function BillingSection({ orgId, locale }: { orgId: string; locale: Locale }) {
  let row: OrgBillingRow | null = null;
  try {
    row = await apiFetch<OrgBillingRow | null>(`/api/v1/organisations/${orgId}/billing`);
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
        <SectionLabel>{t(locale, 'invoicing')}<AppChip slug="fibre-sales" /></SectionLabel>
        <OrgBillingEdit orgId={orgId} initial={row} locale={locale} />
      </div>
      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field label={t(locale, 'legal_name')} value={row?.legal_name ?? null} />
            <Field label={t(locale, 'tax_vat_id')} value={row?.tax_id ?? null} />
            <Field label={t(locale, 'billing_email')} value={row?.billing_email ?? null} />
            <Field label={t(locale, 'currency')} value={row?.currency ?? null} />
            <Field
              label={t(locale, 'payment_terms')}
              value={
                row?.payment_terms_days !== null && row?.payment_terms_days !== undefined
                  ? t(locale, 'n_days', { n: row.payment_terms_days })
                  : null
              }
            />
            <Field
              label={t(locale, 'po_required')}
              value={row?.po_required === null || row?.po_required === undefined
                ? null
                : row.po_required ? t(locale, 'yes') : t(locale, 'no')}
            />
            <Field label={t(locale, 'billing_address')} value={addressLine || null} />
            <Field label={t(locale, 'billing_location')} value={billingLocation || null} />
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">{value ? value : <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}

