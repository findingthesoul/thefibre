import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { RelationshipEdit, type RelationshipRow } from './edit';

const SOURCE_LABELS: Record<string, string> = {
  event_attendee: 'Event attendee',
  referral: 'Referral',
  cold_outreach: 'Cold outreach',
  client_contact: 'Client contact',
  inbound: 'Inbound',
};

const STRENGTH_LABELS: Record<string, string> = {
  weak: 'Weak',
  warm: 'Warm',
  strong: 'Strong',
  advocate: 'Advocate',
};

const COMM_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  linkedin: 'LinkedIn',
  in_person: 'In person',
};

type Props = { params: Promise<{ id: string }> };

export default async function RelationshipTab({ params }: Props) {
  const { id } = await params;

  let row: RelationshipRow | null = null;
  try {
    row = await apiFetch<RelationshipRow | null>(`/api/v1/persons/${id}/relationship`);
  } catch {
    // leave null
  }

  const isEmpty =
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
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Relationship context</SectionLabel>
        <RelationshipEdit personId={id} initial={row} />
      </div>

      {isEmpty ? (
        <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
      ) : (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field label="Source" value={row!.source ? SOURCE_LABELS[row!.source] ?? row!.source : null} />
          <Field label="Source detail" value={row!.source_detail} />
          <Field label="Introduced by" value={row!.introduced_by} />
          <Field
            label="Strength"
            value={row!.relationship_strength ? STRENGTH_LABELS[row!.relationship_strength] ?? row!.relationship_strength : null}
          />
          <Field
            label="Communication preference"
            value={row!.communication_preference ? COMM_LABELS[row!.communication_preference] ?? row!.communication_preference : null}
          />
          <Field label="Best time to reach" value={row!.best_time_to_reach} />
          <Field label="Key contact" value={boolLabel(row!.is_key_contact)} />
          <Field label="Ambassador" value={boolLabel(row!.is_ambassador)} />
          <Field
            label="First contact"
            value={row!.first_contact_at ? new Date(row!.first_contact_at).toLocaleDateString('en-GB') : null}
          />
          <div className="md:col-span-3">
            <Field label="First contact notes" value={row!.first_contact_notes} />
          </div>
        </section>
      )}
    </>
  );
}

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
