import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, isAppSlug } from '@/lib/apps';
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

const STAGE_LABELS: Record<string, string> = {
  pre_awareness: 'Pre-awareness',
  exploring: 'Exploring',
  committed: 'Committed',
  in_programme: 'In programme',
  sustaining: 'Sustaining',
  alumni: 'Alumni',
};

const STABILITY_LABELS: Record<string, string> = {
  stable: 'Stable',
  transitioning: 'Transitioning',
  turbulent: 'Turbulent',
};

const READINESS_LABELS: Record<string, string> = {
  not_ready: 'Not ready',
  cautious: 'Cautious',
  open: 'Open',
  ready: 'Ready',
  driving: 'Driving',
};

const REL_STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  engaged: 'Engaged',
  active_client: 'Active client',
  alumni: 'Alumni',
  dormant: 'Dormant',
  lost: 'Lost',
};

const HEALTH_LABELS: Record<string, string> = {
  active: 'Active',
  at_risk: 'At risk',
  dormant: 'Dormant',
  lost: 'Lost',
  never_converted: 'Never converted',
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  facilitation: 'Facilitation',
  learning: 'Learning',
  advisory: 'Advisory',
  speaking: 'Speaking',
  mixed: 'Mixed',
};

type Props = { params: Promise<{ id: string; appSlug: string }> };

export default async function OrgAppTab({ params }: Props) {
  const { id, appSlug } = await params;
  if (!isAppSlug(appSlug)) notFound();

  const app = APPS[appSlug];

  return (
    <>
      {appSlug === 'fibre-meet' && (
        <SystemContextSection orgId={id} />
      )}
      {appSlug === 'fibre-sales' && (
        <>
          <RelationshipSection orgId={id} />
          <div className="mt-14">
            <BillingSection orgId={id} />
          </div>
        </>
      )}
      {(appSlug === 'fibre-platform' ||
        appSlug === 'the-thread' ||
        appSlug === 'fibre-learn') && (
        <section>
          <SectionLabel>{app.label}</SectionLabel>
          <EmptyState>
            {app.label} doesn&apos;t curate dedicated fields on organisations. Activity from {app.label} will appear on this tab once written.
          </EmptyState>
        </section>
      )}

      <section className="mt-12">
        <SectionLabel>Timeline — {app.label}</SectionLabel>
        <OrgAppTimeline orgId={id} appSlug={appSlug} />
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

async function OrgAppTimeline({ orgId, appSlug }: { orgId: string; appSlug: string }) {
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
    return (
      <EmptyState>
        No activity yet. Events from current members of this organisation written by this app will appear here.
      </EmptyState>
    );
  }

  return (
    <ol className="mt-4 border-l border-line pl-6 space-y-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            {new Date(a.occurred_at).toLocaleString('en-GB', {
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

async function SystemContextSection({ orgId }: { orgId: string }) {
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
        <SectionLabel>System context</SectionLabel>
        <SystemContextEdit orgId={orgId} initial={row} />
      </div>

      {empty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Transformation stage"
              value={
                row?.transformation_stage
                  ? STAGE_LABELS[row.transformation_stage] ?? row.transformation_stage
                  : null
              }
            />
            <Field
              label="Leadership stability"
              value={
                row?.leadership_stability
                  ? STABILITY_LABELS[row.leadership_stability] ?? row.leadership_stability
                  : null
              }
            />
            <Field
              label="Change readiness"
              value={
                row?.change_readiness
                  ? READINESS_LABELS[row.change_readiness] ?? row.change_readiness
                  : null
              }
            />
            <Field
              label="Active change themes"
              value={
                row?.active_change_themes && row.active_change_themes.length
                  ? row.active_change_themes.join(', ')
                  : null
              }
            />
            <Field
              label="Structural tensions"
              value={
                row?.structural_tensions && row.structural_tensions.length
                  ? row.structural_tensions.join(', ')
                  : null
              }
            />
            <Field
              label="Previous interventions"
              value={
                row?.previous_interventions && row.previous_interventions.length
                  ? row.previous_interventions.join(', ')
                  : null
              }
            />
            <Field
              label="Blockers"
              value={row?.blockers && row.blockers.length ? row.blockers.join(', ') : null}
            />
            <Field
              label="Enablers"
              value={row?.enablers && row.enablers.length ? row.enablers.join(', ') : null}
            />
          </div>

          <div className="mt-14">
            <SectionLabel>Strategic priorities</SectionLabel>
            {row?.strategic_priorities ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.strategic_priorities}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>Current challenges</SectionLabel>
            {row?.current_challenges ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenges}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>Lessons from previous work</SectionLabel>
            {row?.lessons_from_previous_work ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.lessons_from_previous_work}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </div>

          <div className="mt-10">
            <SectionLabel>
              Political landscape
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                Sensitive
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

async function RelationshipSection({ orgId }: { orgId: string }) {
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
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB');
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>Commercial relationship</SectionLabel>
        <OrgRelationshipEdit orgId={orgId} initial={row} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Relationship stage"
              value={
                row?.relationship_stage
                  ? REL_STAGE_LABELS[row.relationship_stage] ?? row.relationship_stage
                  : null
              }
            />
            <Field
              label="Health status"
              value={
                row?.health_status
                  ? HEALTH_LABELS[row.health_status] ?? row.health_status
                  : null
              }
            />
            <Field
              label="Engagement type"
              value={
                row?.engagement_type
                  ? ENGAGEMENT_LABELS[row.engagement_type] ?? row.engagement_type
                  : null
              }
            />
            <Field
              label="Total participants reached"
              value={numLabel(row?.total_participants_reached)}
            />
            <Field label="Touchpoints" value={numLabel(row?.touchpoints_count)} />
            <Field label="Last touchpoint" value={dateLabel(row?.last_touchpoint_at)} />
            <Field
              label="Next planned contact"
              value={dateLabel(row?.next_planned_contact)}
            />
            <Field
              label="Programmes completed"
              value={listLabel(row?.programmes_completed)}
            />
            <Field label="Primary owner" value={row?.primary_owner ?? null} />
            <Field label="Secondary owner" value={row?.secondary_owner ?? null} />
          </div>

          <div className="mt-10">
            <SectionLabel>Next opportunity</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.next_opportunity ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>

          <div className="mt-10">
            <SectionLabel>Relationship history</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.relationship_history ?? <span className="text-ink-muted">—</span>}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

async function BillingSection({ orgId }: { orgId: string }) {
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
        <SectionLabel>Invoicing</SectionLabel>
        <OrgBillingEdit orgId={orgId} initial={row} />
      </div>
      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field label="Legal name" value={row?.legal_name ?? null} />
            <Field label="Tax / VAT ID" value={row?.tax_id ?? null} />
            <Field label="Billing email" value={row?.billing_email ?? null} />
            <Field label="Currency" value={row?.currency ?? null} />
            <Field
              label="Payment terms"
              value={
                row?.payment_terms_days !== null && row?.payment_terms_days !== undefined
                  ? `${row.payment_terms_days} days`
                  : null
              }
            />
            <Field
              label="PO required"
              value={row?.po_required === null || row?.po_required === undefined
                ? null
                : row.po_required ? 'Yes' : 'No'}
            />
            <Field label="Billing address" value={addressLine || null} />
            <Field label="Billing location" value={billingLocation || null} />
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">{value ? value : <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}

