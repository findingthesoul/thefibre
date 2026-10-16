'use client';

// The editor for a community's own words in its member emails (Sjoerd 2ix).
// Pick the email (welcome: all tiers or one tier; digest), pick a language,
// write — subject, an image, your words, a closing — then Preview (the real
// template, rendered by the API) or Send me a test (to your own address).
// The facts block is always added by us and says so.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextField } from '@thefibre/shared/ui/rich-text-field';
import { tokenChips } from '@thefibre/shared/merge-tokens';
import { LOCALES, LOCALE_LABELS, type Locale as AnyLocale } from '@thefibre/shared/i18n';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { previewEmail, resetEmailTemplate, saveEmailTemplate, sendTestEmail, type EmailDraft } from './actions';

export type StoredTemplate = {
  id: string;
  kind: 'welcome' | 'digest' | 'signature';
  tier_id: string | null;
  locale: AnyLocale;
  subject: string | null;
  image_path: string | null;
  image_alt: string | null;
  image_url: string | null;
  intro_html: string | null;
  closing: string | null;
};

const INPUT = 'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';
const CHIPS = tokenChips('member_email');

export function EmailsClient({ templates, tiers, locale }: { templates: StoredTemplate[]; tiers: { id: string; name: string }[]; locale: Locale }) {
  const router = useRouter();
  // Which email: 'digest', 'signature', 'welcome:' (all tiers) or
  // 'welcome:<tierId>'.
  const [target, setTarget] = useState('welcome:');
  const [lang, setLang] = useState<AnyLocale>(locale as AnyLocale);
  const kind: 'welcome' | 'digest' | 'signature' = target === 'digest' ? 'digest' : target === 'signature' ? 'signature' : 'welcome';
  const tierId = kind === 'welcome' ? target.slice('welcome:'.length) || null : null;
  const stored = useMemo(
    () => templates.find((x) => x.kind === kind && (x.tier_id ?? null) === tierId && x.locale === lang) ?? null,
    [templates, kind, tierId, lang],
  );
  // The form is keyed on what it edits, so switching email or language starts
  // from that one's stored words.
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-ink-muted">{t(locale, 'st_emails_title')}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={INPUT}>
            <option value="welcome:">{t(locale, 'em_kind_welcome')} — {t(locale, 'em_all_tiers')}</option>
            {tiers.map((x) => (
              <option key={x.id} value={`welcome:${x.id}`}>
                {t(locale, 'em_kind_welcome')} — {x.name}
              </option>
            ))}
            <option value="digest">{t(locale, 'em_kind_digest')}</option>
            <option value="signature">{t(locale, 'em_kind_signature')}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-1">
          {LOCALES.map((l) => {
            const has = templates.some((x) => x.kind === kind && (x.tier_id ?? null) === tierId && x.locale === l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-full border px-3 py-1 text-xs ${lang === l ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-subtle hover:text-ink'}`}
              >
                {LOCALE_LABELS[l]}
                {has ? ' •' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-ink-muted">{t(locale, 'em_lang_note')}</p>
      <Editor key={`${target}:${lang}`} stored={stored} kind={kind} tierId={tierId} lang={lang} locale={locale} onSaved={() => router.refresh()} />
    </div>
  );
}

function Editor({
  stored,
  kind,
  tierId,
  lang,
  locale,
  onSaved,
}: {
  stored: StoredTemplate | null;
  kind: 'welcome' | 'digest' | 'signature';
  tierId: string | null;
  lang: AnyLocale;
  locale: Locale;
  onSaved: () => void;
}) {
  // A signature is one sign-off: no subject, image or closing of its own.
  const sig = kind === 'signature';
  const [subject, setSubject] = useState(stored?.subject ?? '');
  const [imagePath, setImagePath] = useState(stored?.image_path ?? null);
  const [imageUrl, setImageUrl] = useState(stored?.image_url ?? null);
  const [imageAlt, setImageAlt] = useState(stored?.image_alt ?? '');
  const [intro, setIntro] = useState(stored?.intro_html ?? '');
  const [closing, setClosing] = useState(stored?.closing ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const draft = (): EmailDraft => ({
    kind,
    tier_id: tierId,
    locale: lang,
    subject: subject || null,
    image_path: imagePath,
    image_alt: imagePath ? imageAlt || null : null,
    intro_html: intro || null,
    closing: closing || null,
  });

  async function run<T>(label: string, f: () => Promise<{ ok?: boolean; error?: string; data?: T }>, done?: (d: T | undefined) => void) {
    setBusy(label);
    setError(null);
    setNotice(null);
    const r = await f();
    setBusy(null);
    if (r.error) return setError(r.error);
    done?.(r.data);
  }

  async function upload(file: File) {
    setBusy('upload');
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/email-templates/image', { method: 'POST', body: fd }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { path?: string; url?: string; error?: string };
    setBusy(null);
    if (!res?.ok || !body.path) return setError(body.error ?? 'Upload failed.');
    setImagePath(body.path);
    setImageUrl(body.url ?? null);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface-raised p-5">
      <p className="text-xs text-ink-muted">{stored ? t(locale, 'em_custom') : t(locale, 'em_standard')}</p>
      {sig && <p className={NOTICE.info}>{t(locale, 'em_signature_note')}</p>}
      {!sig && (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t(locale, 'em_subject')}</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={INPUT} />
      </label>
      )}

      {!sig && (
      <div className="text-sm">
        <span className="mb-1 block font-medium">{t(locale, 'em_image')}</span>
        {imageUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={imageAlt} className="max-h-40 rounded-md border border-line" />
            <input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} maxLength={200} placeholder={t(locale, 'em_image_alt')} className={INPUT} />
            <button type="button" onClick={() => { setImagePath(null); setImageUrl(null); setImageAlt(''); }} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
              {t(locale, 'em_remove_image')}
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center rounded-md border border-line px-3 py-1.5 text-xs text-ink-subtle hover:text-ink">
            {busy === 'upload' ? '…' : t(locale, 'em_upload')}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        )}
      </div>
      )}

      <RichTextField locale={locale} label={sig ? t(locale, 'em_kind_signature') : t(locale, 'em_intro')} name="intro" defaultValue={intro} onHtmlChange={setIntro} insertTokens={CHIPS} minHeight={140} />

      {!sig && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t(locale, 'em_closing')}</span>
          <textarea value={closing} onChange={(e) => setClosing(e.target.value)} maxLength={2000} rows={2} className={INPUT} />
        </label>
      )}

      {!sig && <p className={NOTICE.info}>{t(locale, 'em_facts_note')}</p>}
      {error && <p className={NOTICE.error}>{error}</p>}
      {notice && <p className={NOTICE.success}>{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void run('preview', () => previewEmail(draft()), (d) => d && setPreview(d))}>
          {t(locale, 'em_preview')}
        </Button>
        <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void run('test', () => sendTestEmail(draft()), (d) => d && setNotice(t(locale, 'em_test_sent', { email: d.sent_to })))}>
          {t(locale, 'em_send_test')}
        </Button>
        {stored && (
          <button type="button" disabled={!!busy} onClick={() => void run('reset', () => resetEmailTemplate(stored.id), onSaved)} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
            {t(locale, 'em_reset')}
          </button>
        )}
        <div className="ml-auto">
          <Button type="button" disabled={!!busy} onClick={() => void run('save', () => saveEmailTemplate(draft()), () => { setNotice(t(locale, 'em_saved')); onSaved(); })}>
            {busy === 'save' ? '…' : t(locale, 'save')}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-ink-muted">{t(locale, 'em_subject')}: </span>
            <span className="font-medium">{preview.subject}</span>
          </p>
          <iframe title={t(locale, 'em_preview')} srcDoc={preview.html} sandbox="" className="h-[640px] w-full rounded-md border border-line bg-white" />
        </div>
      )}
    </div>
  );
}
