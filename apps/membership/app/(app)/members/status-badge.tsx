import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import type { MemberStatus } from './types';

const STYLES: Record<MemberStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  grace: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  lapsed: 'bg-surface-sunken text-ink-muted',
  cancelled: 'bg-surface-sunken text-ink-muted',
};

const KEYS: Record<MemberStatus, UiKey> = {
  active: 'status_active',
  grace: 'status_grace',
  lapsed: 'status_lapsed',
  cancelled: 'status_cancelled',
};

export function StatusBadge({ status, locale }: { status: MemberStatus; locale: Locale }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {t(locale, KEYS[status])}
    </span>
  );
}
