'use client';

// CONNECT A GOOGLE DRIVE FOLDER to the member page (2026-10-17, Sjoerd: "go
// Drive folders"; builder 4's routes). Two steps, because the community must
// show it controls the folder:
//   1. paste the folder's link → Start: the API checks our service account
//      can see it and hands out a one-hour code;
//   2. the admin shares the folder with that account (Viewer) and puts the
//      code in the folder's description → Verify: the folder joins the page
//      as one more document, shown to everyone until an audience is chosen.
// Every refusal is said in words, with what to do next.

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { driveConfig, driveStart, driveVerify, type DriveCode, type DriveEntry, type DriveStart } from '../actions';

const FIELD = 'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none';
const MESSAGE: Record<DriveCode, UiKey> = {
  bad_url: 'drv_err_bad_url',
  not_shared: 'drv_err_not_shared',
  bound_elsewhere: 'drv_err_bound_elsewhere',
  drive_not_configured: 'drv_err_not_configured',
  unavailable: 'drv_err_unavailable',
  code_missing: 'drv_err_code_missing',
  code_expired: 'drv_err_code_expired',
  failed: 'drv_err_failed',
};

function CopyField({ value, label, locale }: { value: string; label: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface-sunken px-2 py-1">
      <code className="truncate font-mono text-xs text-ink">{value}</code>
      <button
        type="button"
        aria-label={`${t(locale, 'drv_copy')}: ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-xs text-ink-subtle hover:bg-surface hover:text-ink"
      >
        <Copy size={13} aria-hidden />
        {copied ? t(locale, 'drv_copied') : t(locale, 'drv_copy')}
      </button>
    </span>
  );
}

export function DriveConnect({ locale, onConnected }: { locale: Locale; onConnected: (entry: DriveEntry) => void }) {
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [started, setStarted] = useState<DriveStart | null>(null);
  const [busy, setBusy] = useState<'start' | 'verify' | null>(null);
  const [problem, setProblem] = useState<{ code: DriveCode; account?: string | null } | null>(null);

  useEffect(() => {
    void driveConfig().then((r) => setAccount(r.ok ? r.data.service_account : null));
  }, []);

  if (account === undefined) return <p className="text-sm text-ink-muted">{t(locale, 'drv_loading')}</p>;
  if (account === null) return <p className="text-sm text-ink-muted">{t(locale, 'drv_err_not_configured')}</p>;

  async function start() {
    setBusy('start');
    setProblem(null);
    const r = await driveStart(url.trim());
    setBusy(null);
    if (r.ok) {
      setStarted(r.data);
      if (!title.trim()) setTitle(r.data.folder_name);
    } else setProblem({ code: r.code, account: r.service_account });
  }

  async function verify() {
    if (!started) return;
    setBusy('verify');
    setProblem(null);
    const r = await driveVerify(started.folder_id, title.trim() || null);
    setBusy(null);
    if (r.ok) {
      onConnected(r.data);
      setStarted(null);
      setUrl('');
      setTitle('');
    } else {
      if (r.code === 'code_expired') setStarted(null);
      setProblem({ code: r.code, account: r.service_account });
    }
  }

  const shareWith = problem?.account || started?.service_account || account;
  return (
    <div className="space-y-3">
      {!started ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[16rem] flex-[2] flex-col gap-1 text-sm text-ink-subtle">
              {t(locale, 'drv_folder_link')}
              <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={FIELD} />
            </label>
            <Button type="button" onClick={() => void start()} disabled={busy !== null || !url.trim()}>
              {busy === 'start' ? t(locale, 'drv_checking') : t(locale, 'drv_start')}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            {t(locale, 'drv_hint_share')} <CopyField value={shareWith} label={t(locale, 'drv_service_account')} locale={locale} />
          </p>
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-medium text-ink">{t(locale, 'drv_steps_title', { name: started.folder_name })}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-subtle">
            <li>
              {t(locale, 'drv_step_share')} <CopyField value={started.service_account} label={t(locale, 'drv_service_account')} locale={locale} />
            </li>
            <li>
              {t(locale, 'drv_step_code')} <CopyField value={started.code} label={t(locale, 'drv_code')} locale={locale} />
            </li>
            <li>{t(locale, 'drv_step_verify')}</li>
          </ol>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-ink-subtle">
              {t(locale, 'mp_title')}
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </label>
            <Button type="button" onClick={() => void verify()} disabled={busy !== null}>
              {busy === 'verify' ? t(locale, 'drv_checking') : t(locale, 'drv_verify')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setStarted(null); setProblem(null); }} disabled={busy !== null}>
              {t(locale, 'cancel')}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">{t(locale, 'drv_code_after')}</p>
        </div>
      )}
      {problem && (
        <p className={NOTICE.error} role="status">
          {t(locale, MESSAGE[problem.code])}
          {problem.code === 'not_shared' && shareWith ? <> <CopyField value={shareWith} label={t(locale, 'drv_service_account')} locale={locale} /></> : null}
        </p>
      )}
    </div>
  );
}
