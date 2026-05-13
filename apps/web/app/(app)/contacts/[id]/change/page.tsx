import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { ChangeEdit, type ChangeRow } from './edit';

const ROLE_LABELS: Record<string, string> = {
  sponsor: 'Sponsor',
  champion: 'Champion',
  implementer: 'Implementer',
  sceptic: 'Sceptic',
  bystander: 'Bystander',
  gatekeeper: 'Gatekeeper',
};

const STANCE_LABELS: Record<string, string> = {
  driving: 'Driving',
  supporting: 'Supporting',
  ambivalent: 'Ambivalent',
  resistant: 'Resistant',
};

const READINESS_LABELS: Record<string, string> = {
  not_ready: 'Not ready',
  cautious: 'Cautious',
  open: 'Open',
  ready: 'Ready',
  driving: 'Driving',
};

function isEmptyRow(r: ChangeRow | null): boolean {
  if (!r) return true;
  return (
    !r.role_in_change &&
    !r.stance_on_change &&
    !r.readiness_level &&
    !r.leadership_style &&
    !r.current_challenge &&
    !r.facilitator_notes &&
    !(r.change_themes && r.change_themes.length) &&
    !(r.blockers && r.blockers.length) &&
    !(r.motivators && r.motivators.length)
  );
}

export default async function ChangeTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let row: ChangeRow | null = null;
  try {
    row = await apiFetch<ChangeRow | null>(`/api/v1/persons/${id}/change`);
  } catch {
    // Non-fatal; leave null.
  }

  const empty = isEmptyRow(row);

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Change context</SectionLabel>
        <ChangeEdit personId={id} initial={row} />
      </div>

      {empty ? (
        <div className="mt-4">
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field
              label="Role in change"
              value={row?.role_in_change ? ROLE_LABELS[row.role_in_change] ?? row.role_in_change : null}
            />
            <Field
              label="Stance"
              value={
                row?.stance_on_change ? STANCE_LABELS[row.stance_on_change] ?? row.stance_on_change : null
              }
            />
            <Field
              label="Readiness"
              value={
                row?.readiness_level ? READINESS_LABELS[row.readiness_level] ?? row.readiness_level : null
              }
            />
            <Field label="Leadership style" value={row?.leadership_style ?? null} />
            <Field
              label="Change themes"
              value={row?.change_themes && row.change_themes.length ? row.change_themes.join(', ') : null}
            />
            <Field
              label="Blockers"
              value={row?.blockers && row.blockers.length ? row.blockers.join(', ') : null}
            />
            <Field
              label="Motivators"
              value={row?.motivators && row.motivators.length ? row.motivators.join(', ') : null}
            />
          </section>

          <section className="mt-14">
            <SectionLabel>Current challenge</SectionLabel>
            {row?.current_challenge ? (
              <p className="mt-2 text-sm whitespace-pre-wrap">{row.current_challenge}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            )}
          </section>

          <section className="mt-10">
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
