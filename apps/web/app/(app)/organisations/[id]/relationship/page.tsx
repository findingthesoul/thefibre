import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { OrgRelationshipEdit, type OrgRelationshipRow } from './edit';

const STAGE_LABELS: Record<string, string> = {
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

type Props = { params: Promise<{ id: string }> };

export default async function OrgRelationshipTab({ params }: Props) {
  const { id } = await params;

  let row: OrgRelationshipRow | null = null;
  try {
    row = await apiFetch<OrgRelationshipRow | null>(
      `/api/v1/organisations/${id}/relationship`,
    );
  } catch {
    // Non-fatal — treat as empty.
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
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Commercial relationship</SectionLabel>
        <OrgRelationshipEdit orgId={id} initial={row} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Relationship stage"
              value={
                row?.relationship_stage
                  ? STAGE_LABELS[row.relationship_stage] ?? row.relationship_stage
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
          </section>

          <section className="mt-10">
            <SectionLabel>Next opportunity</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.next_opportunity ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>Relationship history</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.relationship_history ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>
        </>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? value : <span className="text-ink-muted">—</span>}
      </div>
    </div>
  );
}
