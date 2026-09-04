import type { MemberStatus } from './types';

const STYLES: Record<MemberStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  grace: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  lapsed: 'bg-surface-sunken text-ink-muted',
  cancelled: 'bg-surface-sunken text-ink-muted',
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
