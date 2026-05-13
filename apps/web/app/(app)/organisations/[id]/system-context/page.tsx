import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { SystemContextEdit, type SystemContextRow } from './edit';

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

function isEmptyRow(r: SystemContextRow | null): boolean {
  if (!r) return true;
  return (
    !r.transformation_stage &&
    !r.leadership_stability &&
    !r.change_readiness &&
    !r.strategic_priorities &&
    !r.current_challenges &&
    !r.political_landscape &&
    !r.lessons_from_previous_work &&
    !(r.active_change_themes && r.active_change_themes.length) &&
    !(r.structural_tensions && r.structural_tensions.length) &&
    !(r.previous_interventions && r.previous_interventions.length) &&
    !(r.blockers && r.blockers.length) &&
    !(r.enablers && r.enablers.length)
  );
}

export default async function SystemContextTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let row: SystemContextRow | null = null;
  try {
    row = await apiFetch<SystemContextRow | null>(
      `/api/v1/organisations/${id}/system-context`,
    );
  } catch {
    // Non-fatal; leave null.
  }

  const empty = isEmptyRow(row);

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>System context</SectionLabel>
        <SystemContextEdit orgId={id} initial={row} />
      </div>

      {empty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
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
          </section>

          <section className="mt-14">
            <SectionLabel>Strategic priorities</SectionLabel>
            {row?.strategic_priorities ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.strategic_priorities}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </section>

          <section className="mt-10">
            <SectionLabel>Current challenges</SectionLabel>
            {row?.current_challenges ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenges}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </section>

          <section className="mt-10">
            <SectionLabel>Lessons from previous work</SectionLabel>
            {row?.lessons_from_previous_work ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.lessons_from_previous_work}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </section>

          <section className="mt-10">
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
      <div className="mt-1">{value ? value : <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}
