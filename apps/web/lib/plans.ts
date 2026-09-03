// The plan catalogue as the web app understands it — shared by the public
// /pricing page, Settings → Plan, and the super-admin matrix at /admin/plans.
//
// The VALUES always come from billing_plan via the API (the same rows the
// gates read). What lives here is only presentation: which feature keys exist,
// what to call them, and which app each belongs to. Adding a NEW key here
// without its PlanFeature entry + can() call site in the API does nothing —
// a gate is a deploy, and this list mirrors the deployed vocabulary.

export type CataloguePlan = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
  included_seats: number | null;
  extra_seat_cents_month: number | null;
  included_emails_month: number | null;
  included_storage_gb: number | null;
  retention_months: number | null;
  meet_paid_pct: number;
  meet_paid_cap_cents: number | null;
  features: Record<string, boolean | number | null>;
};

export type FeatureRow = {
  key: string;
  label: string;
  /** flag = checkbox; limit = small number, null meaning "unlimited". */
  kind: 'flag' | 'limit';
  /** Shown on the public page under the label. */
  note?: string;
};

export type FeatureGroup = { app: string; rows: FeatureRow[] };

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    app: 'Meet',
    rows: [
      // Meet is in every tier by decision (pricing-proposal D-list) — there is
      // deliberately no 'meet' gate key. The fee ladder is what varies, and it
      // renders from meet_paid_pct/cap, not from here.
    ],
  },
  {
    app: 'Thread',
    rows: [
      { key: 'thread', label: 'Thread', kind: 'flag' },
      {
        key: 'thread_live_limit',
        label: 'Live events at once',
        kind: 'limit',
        note: 'Empty = unlimited',
      },
      {
        key: 'thread_template_limit',
        label: 'Event templates',
        kind: 'limit',
        note: 'Empty = the whole library',
      },
      { key: 'thread_custom_templates', label: 'Design your own threads', kind: 'flag' },
      { key: 'certificates', label: 'Certificates', kind: 'flag' },
    ],
  },
  {
    app: 'Flow',
    rows: [{ key: 'flow', label: 'Flow', kind: 'flag' }],
  },
  {
    app: 'Pulse',
    rows: [{ key: 'pulse', label: 'Pulse', kind: 'flag' }],
  },
  {
    app: 'Platform',
    rows: [
      { key: 'email_branding', label: 'Your logo + sender name on email', kind: 'flag' },
      { key: 'custom_sender_domain', label: 'Your own sending domain', kind: 'flag' },
      { key: 'app_keys', label: 'API keys', kind: 'flag' },
      { key: 'third_party_apps', label: 'External apps', kind: 'flag' },
      { key: 'sso', label: 'SSO', kind: 'flag' },
      { key: 'audit_log', label: 'Audit log', kind: 'flag' },
      { key: 'retention_controls', label: 'Retention controls', kind: 'flag' },
    ],
  },
];

/** €19 for round numbers, €19.50 otherwise. */
export function eur(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const whole = cents % 100 === 0;
  return `€${(cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "2%, max €2" / "0%" — the fee ladder in one phrase. */
export function feePhrase(pct: number, capCents: number | null): string {
  const p = `${(pct * 100).toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`;
  if (pct === 0) return '0%';
  return capCents ? `${p}, max ${eur(capCents)}` : p;
}
