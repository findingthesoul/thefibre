import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { IdentityEdit, type IdentityRow } from '../identity/edit';

const GOVERNANCE_LABELS: Record<string, string> = {
  hierarchical: 'Hierarchical',
  flat: 'Flat',
  matrix: 'Matrix',
  holacracy: 'Holacracy',
  cooperative: 'Cooperative',
};

const OWNERSHIP_LABELS: Record<string, string> = {
  private: 'Private',
  public: 'Public',
  family: 'Family',
  employee: 'Employee',
  state: 'State',
  ngo: 'NGO',
};

const DECISION_STYLE_LABELS: Record<string, string> = {
  top_down: 'Top-down',
  consultative: 'Consultative',
  consensus: 'Consensus',
  delegated: 'Delegated',
};

const MATURITY_LABELS: Record<string, string> = {
  startup: 'Startup',
  growth: 'Growth',
  established: 'Established',
  legacy: 'Legacy',
  transitioning: 'Transitioning',
};

type Props = { params: Promise<{ id: string }> };

export default async function OrgProfile({ params }: Props) {
  const { id } = await params;

  let row: IdentityRow | null = null;
  try {
    row = await apiFetch<IdentityRow | null>(`/api/v1/organisations/${id}/identity`);
  } catch {
    // Non-fatal — treat as empty.
  }

  const allEmpty =
    !row ||
    (!row.mission_statement &&
      !row.vision_statement &&
      (row.stated_values?.length ?? 0) === 0 &&
      (row.cultural_descriptors?.length ?? 0) === 0 &&
      !row.governance_model &&
      !row.ownership_type &&
      !row.decision_making_style &&
      (row.languages_of_operation?.length ?? 0) === 0 &&
      !row.maturity_stage &&
      !row.identity_notes);

  const listLabel = (xs: string[] | null | undefined) =>
    xs && xs.length ? xs.join(', ') : null;

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Identity</SectionLabel>
        <IdentityEdit orgId={id} initial={row} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Governance model"
              value={row?.governance_model ? GOVERNANCE_LABELS[row.governance_model] ?? row.governance_model : null}
            />
            <Field
              label="Ownership type"
              value={row?.ownership_type ? OWNERSHIP_LABELS[row.ownership_type] ?? row.ownership_type : null}
            />
            <Field
              label="Decision-making style"
              value={row?.decision_making_style ? DECISION_STYLE_LABELS[row.decision_making_style] ?? row.decision_making_style : null}
            />
            <Field
              label="Maturity stage"
              value={row?.maturity_stage ? MATURITY_LABELS[row.maturity_stage] ?? row.maturity_stage : null}
            />
            <Field label="Stated values" value={listLabel(row?.stated_values)} />
            <Field label="Cultural descriptors" value={listLabel(row?.cultural_descriptors)} />
            <Field label="Languages of operation" value={listLabel(row?.languages_of_operation)} />
          </section>

          <section className="mt-10">
            <SectionLabel>Mission</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.mission_statement ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>Vision</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.vision_statement ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>Notes</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.identity_notes ?? <span className="text-ink-muted">—</span>}
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
