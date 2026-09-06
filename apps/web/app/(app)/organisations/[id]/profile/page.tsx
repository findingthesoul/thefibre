import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type UiKey } from '@/lib/i18n-ui';
import { IdentityEdit, type IdentityRow } from '../identity/edit';

const GOVERNANCE_LABELS: Record<string, UiKey> = {
  hierarchical: 'gov_hierarchical',
  flat: 'gov_flat',
  matrix: 'gov_matrix',
  holacracy: 'gov_holacracy',
  cooperative: 'org_type_cooperative',
};

const OWNERSHIP_LABELS: Record<string, UiKey> = {
  private: 'org_type_private',
  public: 'org_type_public',
  family: 'ownership_family',
  employee: 'ownership_employee',
  state: 'ownership_state',
  ngo: 'org_type_ngo',
};

const DECISION_STYLE_LABELS: Record<string, UiKey> = {
  top_down: 'decision_top_down',
  consultative: 'decision_consultative',
  consensus: 'decision_consensus',
  delegated: 'decision_delegated',
};

const MATURITY_LABELS: Record<string, UiKey> = {
  startup: 'maturity_startup',
  growth: 'maturity_growth',
  established: 'career_established',
  legacy: 'maturity_legacy',
  transitioning: 'career_transitioning',
};

type Props = { params: Promise<{ id: string }> };

export default async function OrgProfile({ params }: Props) {
  const { id } = await params;
  const locale = await uiLocale();

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
        <SectionLabel>{t(locale, 'identity')}</SectionLabel>
        <IdentityEdit orgId={id} initial={row} locale={locale} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label={t(locale, 'governance_model')}
              value={
                row?.governance_model
                  ? GOVERNANCE_LABELS[row.governance_model]
                    ? t(locale, GOVERNANCE_LABELS[row.governance_model]!)
                    : row.governance_model
                  : null
              }
            />
            <Field
              label={t(locale, 'ownership_type')}
              value={
                row?.ownership_type
                  ? OWNERSHIP_LABELS[row.ownership_type]
                    ? t(locale, OWNERSHIP_LABELS[row.ownership_type]!)
                    : row.ownership_type
                  : null
              }
            />
            <Field
              label={t(locale, 'decision_making_style')}
              value={
                row?.decision_making_style
                  ? DECISION_STYLE_LABELS[row.decision_making_style]
                    ? t(locale, DECISION_STYLE_LABELS[row.decision_making_style]!)
                    : row.decision_making_style
                  : null
              }
            />
            <Field
              label={t(locale, 'maturity_stage')}
              value={
                row?.maturity_stage
                  ? MATURITY_LABELS[row.maturity_stage]
                    ? t(locale, MATURITY_LABELS[row.maturity_stage]!)
                    : row.maturity_stage
                  : null
              }
            />
            <Field label={t(locale, 'stated_values')} value={listLabel(row?.stated_values)} />
            <Field label={t(locale, 'cultural_descriptors')} value={listLabel(row?.cultural_descriptors)} />
            <Field label={t(locale, 'languages_of_operation')} value={listLabel(row?.languages_of_operation)} />
          </section>

          <section className="mt-10">
            <SectionLabel>{t(locale, 'mission')}</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.mission_statement ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>{t(locale, 'vision')}</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.vision_statement ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>{t(locale, 'notes')}</SectionLabel>
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
