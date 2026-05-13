import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { LearningEdit, type LearningRow } from './edit';

const LEARNING_STYLE_LABELS: Record<string, string> = {
  visual: 'Visual',
  auditory: 'Auditory',
  reading: 'Reading',
  kinaesthetic: 'Kinaesthetic',
  reflective: 'Reflective',
};

const GROUP_ROLE_LABELS: Record<string, string> = {
  connector: 'Connector',
  challenger: 'Challenger',
  synthesiser: 'Synthesiser',
  anchor: 'Anchor',
  observer: 'Observer',
};

type Props = { params: Promise<{ id: string }> };

export default async function LearningTab({ params }: Props) {
  const { id } = await params;

  let row: LearningRow | null = null;
  try {
    row = await apiFetch<LearningRow | null>(`/api/v1/persons/${id}/learning`);
  } catch {
    // Non-fatal — treat as empty.
  }

  const allEmpty =
    !row ||
    ((row.learning_interests?.length ?? 0) === 0 &&
      (row.prior_programmes?.length ?? 0) === 0 &&
      !row.learning_style &&
      !row.group_role_tendency &&
      !row.development_goals &&
      !row.post_programme_reflection &&
      row.open_to_coaching === null &&
      row.open_to_peer_exchange === null);

  const boolLabel = (v: boolean | null) => (v === true ? 'Yes' : v === false ? 'No' : null);
  const listLabel = (xs: string[] | null | undefined) =>
    xs && xs.length ? xs.join(', ') : null;

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Learning profile</SectionLabel>
        <LearningEdit personId={id} initial={row} />
      </div>

      {allEmpty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Learning style"
              value={row?.learning_style ? LEARNING_STYLE_LABELS[row.learning_style] ?? row.learning_style : null}
            />
            <Field
              label="Group role tendency"
              value={row?.group_role_tendency ? GROUP_ROLE_LABELS[row.group_role_tendency] ?? row.group_role_tendency : null}
            />
            <Field label="Open to coaching" value={boolLabel(row?.open_to_coaching ?? null)} />
            <Field label="Open to peer exchange" value={boolLabel(row?.open_to_peer_exchange ?? null)} />
            <Field label="Learning interests" value={listLabel(row?.learning_interests)} />
            <Field label="Prior programmes" value={listLabel(row?.prior_programmes)} />
          </section>

          <section className="mt-10">
            <SectionLabel>Development goals</SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.development_goals ?? <span className="text-ink-muted">—</span>}
            </p>
          </section>

          <section className="mt-10">
            <SectionLabel>
              Post-programme reflection
              <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                Participant-owned
              </span>
            </SectionLabel>
            <p className="mt-2 text-sm whitespace-pre-wrap">
              {row?.post_programme_reflection ?? <span className="text-ink-muted">—</span>}
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
