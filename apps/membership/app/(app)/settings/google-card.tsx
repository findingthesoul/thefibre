'use client';

// Google Workspace — integration row two (after Circle). The grant kind
// 'google_user' SUSPENDS a member's Google account on lapse and unsuspends
// on (re)join; this card holds the workspace's credential: a service
// account with domain-wide delegation + the admin it impersonates.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { SectionLabel } from './page-chrome';
import { saveGoogle } from './actions';

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function GoogleCard({
  adminEmail,
  configured,
  locale,
}: {
  adminEmail: string | null;
  configured: boolean;
  locale: Locale;
}) {
  const [admin, setAdmin] = useState(adminEmail ?? '');
  // Empty string = untouched (keep the stored key). The API only ever says
  // whether a credential exists — the key itself never leaves it.
  const [saJson, setSaJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save(remove = false) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveGoogle({
      google_admin_email: remove ? null : admin.trim() || null,
      ...(remove
        ? { google_sa_json: null }
        : saJson.trim()
          ? { google_sa_json: saJson.trim() }
          : {}),
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaJson('');
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>Google Workspace</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">{t(locale, 'google_blurb')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mt-4 space-y-3"
      >
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'google_admin_email_label')}</span>
          <input
            type="email"
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            placeholder="admin@your-domain.com"
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">
            {t(locale, 'sa_key_label')}
            {configured ? t(locale, 'sa_key_stored_suffix') : ''}
          </span>
          <textarea
            value={saJson}
            onChange={(e) => setSaJson(e.target.value)}
            placeholder={configured ? t(locale, 'stored_ph') : '{ "type": "service_account", … }'}
            rows={4}
            className={`mt-1 font-mono text-xs ${INPUT}`}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
          {configured && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void save(true)}>
              {t(locale, 'disconnect')}
            </Button>
          )}
          {saved && <span className="text-sm text-ink-subtle">{t(locale, 'saved_dot')}</span>}
        </div>
      </form>
    </section>
  );
}
