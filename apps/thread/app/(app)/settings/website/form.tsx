'use client';

// The site editor. One screen, in the order you'd answer the questions:
// which design, what it is called, what it looks like, what it says, and
// whether people can write to you.
//
// The theme cards carry a tiny abstract of each layout rather than a
// screenshot. A screenshot of a page with somebody else's photograph in it
// teaches the wrong thing — what differs between the three is where the
// weight sits, and three rectangles say that honestly and never go stale.

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, ImagePlus, Plus, X } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';
import { RichTextField } from '@/components/ui/rich-text';
import { uploadAsset } from '@/lib/upload';
import { t, type UiKey } from '@/lib/i18n-ui';
import type { SiteTheme } from '@/lib/public-site';
import { updateWorkspaceSettings } from '../actions';

export type SiteSettings = {
  site_theme: SiteTheme | null;
  site_name: string | null;
  site_logo_url: string | null;
  site_hero_url: string | null;
  site_headline: string | null;
  site_intro: string | null;
  site_footer_note: string | null;
  site_links: { label: string; href: string }[] | null;
  site_contact_enabled: boolean | null;
  site_contact_email: string | null;
  site_contact_intro: string | null;
};

const THEMES: { value: SiteTheme; labelKey: UiKey; descKey: UiKey }[] = [
  { value: 'plain', labelKey: 'theme_plain', descKey: 'theme_plain_desc' },
  { value: 'festival', labelKey: 'theme_festival', descKey: 'theme_festival_desc' },
  { value: 'corporate', labelKey: 'theme_corporate', descKey: 'theme_corporate_desc' },
  { value: 'community', labelKey: 'theme_community', descKey: 'theme_community_desc' },
];

/** Where the weight sits, in four rectangles. */
function ThemeSketch({ theme }: { theme: SiteTheme }) {
  const bar = 'rounded-[2px] bg-current';
  if (theme === 'festival')
    return (
      <span className="block h-14 w-full rounded-md bg-current/10 p-1.5">
        <span className="flex h-full w-full flex-col justify-end rounded-[3px] bg-current/70 p-1.5">
          <span className={`${bar} h-1.5 w-2/3 opacity-90`} />
          <span className={`${bar} mt-1 h-1 w-1/2 opacity-60`} />
        </span>
      </span>
    );
  if (theme === 'corporate')
    return (
      <span className="block h-14 w-full rounded-md bg-current/10 p-1.5">
        <span className={`${bar} h-1.5 w-1/2 opacity-80`} />
        <span className="mt-2 flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={`${bar} h-1 w-5 opacity-40`} />
              <span className={`${bar} h-1 flex-1 opacity-70`} />
            </span>
          ))}
        </span>
      </span>
    );
  if (theme === 'community')
    return (
      <span className="block h-14 w-full rounded-md bg-current/10 p-1.5">
        <span className="mx-auto block h-4 w-4 rounded-full bg-current opacity-70" />
        <span className={`${bar} mx-auto mt-1.5 h-1 w-1/3 opacity-80`} />
        <span className="mt-2 flex flex-col gap-1">
          <span className={`${bar} h-1.5 w-full opacity-35`} />
          <span className={`${bar} h-1.5 w-full opacity-35`} />
        </span>
      </span>
    );
  return (
    <span className="block h-14 w-full rounded-md bg-current/10 p-1.5">
      <span className="flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-full bg-current opacity-60" />
        <span className={`${bar} h-1 w-1/3 opacity-70`} />
      </span>
      <span className="mt-2.5 flex flex-col gap-1">
        <span className={`${bar} h-1.5 w-full opacity-30`} />
        <span className={`${bar} h-1.5 w-full opacity-30`} />
      </span>
    </span>
  );
}

function ImageField({
  locale,
  label,
  hint,
  url,
  onChange,
  aspect,
}: {
  locale: Locale;
  label: string;
  hint: string;
  url: string | null;
  onChange: (url: string | null) => void;
  aspect: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadAsset(file));
    } catch (x) {
      setErr(x instanceof Error ? x.message : t(locale, 'upload_failed'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <span className="text-sm text-ink-subtle">{label}</span>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {url ? (
        <div className="mt-1 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={`${aspect} rounded-md object-cover ring-1 ring-line`} />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-ink-subtle hover:text-ink text-left"
            >
              {t(locale, 'replace')}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1"
            >
              <X size={11} strokeWidth={1.75} /> {t(locale, 'remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="mt-1 w-full rounded-md border-2 border-dashed border-line hover:border-yellow-400 hover:bg-yellow-50/50 text-ink-subtle hover:text-ink py-4 text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <ImagePlus size={16} strokeWidth={1.75} />
          {busy ? t(locale, 'uploading') : t(locale, 'upload_image')}
        </button>
      )}
      <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

export function WebsiteForm({
  locale,
  settings,
  publicUrl,
}: {
  locale: Locale;
  settings: SiteSettings;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<SiteTheme>(settings.site_theme ?? 'plain');
  const [logo, setLogo] = useState<string | null>(settings.site_logo_url);
  const [hero, setHero] = useState<string | null>(settings.site_hero_url);
  const [links, setLinks] = useState<{ label: string; href: string }[]>(settings.site_links ?? []);
  const [contact, setContact] = useState<boolean>(!!settings.site_contact_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const clean = (v: FormDataEntryValue | null) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length ? s : null;
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const email = clean(fd.get('site_contact_email'));
    // A form with nowhere to deliver would silently eat messages, so the
    // two halves have to agree here rather than at render time.
    if (contact && !email) return setError(t(locale, 'site_contact_email_label'));
    start(async () => {
      const r = await updateWorkspaceSettings({
        site_theme: theme,
        site_name: clean(fd.get('site_name')),
        site_logo_url: logo,
        site_hero_url: hero,
        site_headline: clean(fd.get('site_headline')),
        site_intro: clean(fd.get('site_intro')),
        site_footer_note: clean(fd.get('site_footer_note')),
        site_links: links.filter((l) => l.label.trim() && l.href.trim()),
        site_contact_enabled: contact,
        site_contact_email: email,
        site_contact_intro: clean(fd.get('site_contact_intro')),
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-10 max-w-xl">
      <section>
        <span className="text-sm text-ink-subtle">{t(locale, 'site_design')}</span>
        <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
          {t(locale, 'site_design_desc')}
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEMES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                theme === opt.value
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface hover:bg-surface-sunken'
              }`}
            >
              <span className="block text-ink-subtle">
                <ThemeSketch theme={opt.value} />
              </span>
              <span className="mt-3 block text-sm font-medium">{t(locale, opt.labelKey)}</span>
              <span className="mt-1 block text-xs text-ink-subtle leading-relaxed">
                {t(locale, opt.descKey)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'site_name_label')}</span>
          <input
            name="site_name"
            defaultValue={settings.site_name ?? ''}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-ink-muted">{t(locale, 'site_name_hint')}</span>
        </label>

        <ImageField
          locale={locale}
          label={t(locale, 'site_logo')}
          hint={t(locale, 'site_logo_hint')}
          url={logo}
          onChange={setLogo}
          aspect="h-10 w-32"
        />

        <ImageField
          locale={locale}
          label={t(locale, 'site_hero')}
          hint={t(locale, 'site_hero_hint')}
          url={hero}
          onChange={setHero}
          aspect="h-20 w-36"
        />

        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'site_headline')}</span>
          <input
            name="site_headline"
            defaultValue={settings.site_headline ?? ''}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            {t(locale, 'site_headline_hint')}
          </span>
        </label>

        <RichTextField
          locale={locale}
          label={t(locale, 'site_intro')}
          name="site_intro"
          defaultValue={settings.site_intro}
          hint={t(locale, 'site_intro_hint')}
        />
      </section>

      <section>
        <span className="text-sm text-ink-subtle">{t(locale, 'site_links')}</span>
        <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'site_links_hint')}</p>
        <div className="mt-2 space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={l.label}
                placeholder={t(locale, 'nav_link_label')}
                onChange={(e) =>
                  setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              <input
                value={l.href}
                placeholder="https://"
                onChange={(e) =>
                  setLinks(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))
                }
                className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
                aria-label={t(locale, 'remove')}
                className="text-ink-muted hover:text-ink shrink-0"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
        {links.length < 8 && (
          <button
            type="button"
            onClick={() => setLinks([...links, { label: '', href: '' }])}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink"
          >
            <Plus size={14} strokeWidth={1.75} /> {t(locale, 'add_link')}
          </button>
        )}
      </section>

      <section className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'site_footer_note')}</span>
          <textarea
            name="site_footer_note"
            rows={3}
            defaultValue={settings.site_footer_note ?? ''}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-ink-muted">{t(locale, 'site_footer_hint')}</span>
        </label>
      </section>

      <section className="space-y-4">
        <span className="text-sm text-ink-subtle">{t(locale, 'site_contact')}</span>
        <SwitchField
          label={t(locale, 'site_contact_enable')}
          hint={t(locale, 'site_contact_enable_hint')}
          checked={contact}
          onChange={setContact}
        />
        {contact && (
          <>
            <label className="block">
              <span className="text-sm text-ink-subtle">
                {t(locale, 'site_contact_email_label')}
                <span className="text-red-600"> *</span>
              </span>
              <input
                name="site_contact_email"
                type="email"
                defaultValue={settings.site_contact_email ?? ''}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink-subtle">
                {t(locale, 'site_contact_intro_label')}
              </span>
              <textarea
                name="site_contact_intro"
                rows={2}
                defaultValue={settings.site_contact_intro ?? ''}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
          </>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">{t(locale, 'saved')}</span>}
        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink"
          >
            {t(locale, 'view_public_page')}
            <ExternalLink size={13} strokeWidth={1.75} />
          </a>
        )}
      </div>
    </form>
  );
}
