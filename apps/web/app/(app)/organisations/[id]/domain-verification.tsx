'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  startDomainVerification,
  checkDomainVerification,
  backfillDomainMembers,
  type DomainVerificationAction,
} from './domain-actions';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

export type DomainVerificationState = {
  domain: string | null;
  domain_verified_at: string | null;
  challenge: {
    record_name: string;
    record_value: string;
    created_at: string;
    verified_at: string | null;
  } | null;
};

// Whole panel — drops into the org overview. Renders one of three states:
//   - no domain on the org → tells the user to set one in Edit
//   - verified → green chip + "Re-verify" link
//   - unverified → shows the TXT challenge (or button to issue one) + Check
export function DomainVerification({
  orgId,
  initial,
  locale,
}: {
  orgId: string;
  initial: DomainVerificationState;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [state, setState] = useState<DomainVerificationState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [checkInfo, setCheckInfo] = useState<string | null>(null);

  if (!state.domain) {
    return (
      <div className="text-sm text-ink-subtle">{t(locale, 'add_domain_first')}</div>
    );
  }

  const verified = !!state.domain_verified_at;

  function runStart() {
    setError(null);
    setCheckInfo(null);
    startBusy(async () => {
      const r: DomainVerificationAction = await startDomainVerification(orgId);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.state) setState(r.state);
    });
  }

  function runCheck() {
    setError(null);
    setCheckInfo(null);
    startBusy(async () => {
      const r: DomainVerificationAction = await checkDomainVerification(orgId);
      if (r.error) setError(r.error);
      if (r.message) setCheckInfo(r.message);
      if (r.state) setState(r.state);
      if (r.verified) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {verified ? (
          <>
            <ShieldCheck size={16} className="text-emerald-600" strokeWidth={1.75} />
            <span className="font-medium">{t(locale, 'verified')}</span>
            <span className="text-ink-subtle">
              {t(locale, 'on_date')}{' '}
              {new Date(state.domain_verified_at!).toLocaleDateString(INTL_LOCALES[locale], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </>
        ) : (
          <>
            <ShieldAlert size={16} className="text-amber-600" strokeWidth={1.75} />
            <span className="font-medium">{t(locale, 'not_verified')}</span>
          </>
        )}
        <span className="text-ink-subtle">·</span>
        <span className="font-mono text-xs text-ink-subtle">{state.domain}</span>
      </div>

      {!verified && !state.challenge && (
        <div>
          <Button onClick={runStart} disabled={busy} size="sm">
            {busy ? t(locale, 'generating_challenge') : t(locale, 'start_dns_verification')}
          </Button>
          <p className="mt-2 text-xs text-ink-subtle">{t(locale, 'dns_challenge_blurb')}</p>
        </div>
      )}

      {!verified && state.challenge && (
        <ChallengePanel
          recordName={state.challenge.record_name}
          recordValue={state.challenge.record_value}
          onCheck={runCheck}
          onRotate={runStart}
          busy={busy}
          locale={locale}
        />
      )}

      {verified && (
        <div className="space-y-3">
          <BackfillRow orgId={orgId} locale={locale} />
          <button
            type="button"
            onClick={runStart}
            disabled={busy}
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-50"
          >
            {busy ? t(locale, 'reissuing') : t(locale, 'reverify')}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {checkInfo && !error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-xs text-ink-subtle">
          {checkInfo}
        </div>
      )}
    </div>
  );
}

function ChallengePanel({
  recordName,
  recordValue,
  onCheck,
  onRotate,
  busy,
  locale,
}: {
  recordName: string;
  recordValue: string;
  onCheck: () => void;
  onRotate: () => void;
  busy: boolean;
  locale: Locale;
}) {
  return (
    <div className="space-y-3 rounded-md border border-line bg-surface-raised p-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          {t(locale, 'step1_txt_record')}
        </div>
        <div className="mt-2 grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-xs">
          <div className="text-ink-subtle">{t(locale, 'type')}</div>
          <div className="font-mono">TXT</div>
          <div className="text-ink-subtle">{t(locale, 'name_host')}</div>
          <CopyableMono value={recordName} locale={locale} />
          <div className="text-ink-subtle">{t(locale, 'value')}</div>
          <CopyableMono value={recordValue} locale={locale} />
          <div className="text-ink-subtle">TTL</div>
          <div className="font-mono text-ink-subtle">{t(locale, 'ttl_default')}</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          {t(locale, 'step2_check')}
        </div>
        <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'dns_propagation_note')}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button onClick={onCheck} disabled={busy} size="sm">
            {busy ? t(locale, 'checking') : t(locale, 'check_dns')}
          </Button>
          <button
            type="button"
            onClick={onRotate}
            disabled={busy}
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-50"
          >
            {t(locale, 'generate_new_challenge')}
          </button>
        </div>
      </div>
    </div>
  );
}

// One-shot "scan existing contacts and link them to this org" button.
// Shown only after the org's domain is verified. Idempotent — clicking
// again after a successful run will just report 0 new links.
function BackfillRow({ orgId, locale }: { orgId: string; locale: Locale }) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setResult(null);
    setError(null);
    startBusy(async () => {
      const r = await backfillDomainMembers(orgId);
      if (r.error) {
        setError(r.error);
        return;
      }
      const linked = r.linked ?? 0;
      const skipped = r.skipped ?? 0;
      setResult(
        linked === 0
          ? skipped === 0
            ? t(locale, 'no_matching_contacts')
            : t(locale, 'no_new_links', { n: skipped })
          : linked === 1
            ? t(locale, 'linked_one_contact')
            : t(locale, 'linked_n_contacts', { n: linked }),
      );
      if (linked > 0) router.refresh();
    });
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-line bg-surface-raised px-3 py-1.5 font-medium text-ink-subtle hover:text-ink disabled:opacity-50"
      >
        {busy ? t(locale, 'scanning_contacts') : t(locale, 'link_existing_contacts')}
      </button>
      {result && <span className="ml-3 text-ink-subtle">{result}</span>}
      {error && <span className="ml-3 text-red-700">{error}</span>}
    </div>
  );
}

function CopyableMono({ value, locale }: { value: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-mono break-all">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t(locale, 'copied') : t(locale, 'copy')}
        title={copied ? t(locale, 'copied') : t(locale, 'copy')}
        className="shrink-0 text-ink-subtle hover:text-ink"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
