'use client';

// Website embeds — the loader integration (the Thread-style generator,
// trimmed to Membership's two embeds). One script per site + a data-div
// where the embed should appear; /embed.js turns the div into an
// auto-sizing iframe. The card chrome follows the user's interface
// language (i18n P3); the GENERATED SNIPPETS are code and stay verbatim.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale as PublicLocale } from '@/lib/i18n';
import { t, type Locale } from '@/lib/i18n-ui';
import { SectionLabel } from './page-chrome';

type Kind = 'tiers' | 'button';

const SELECT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function EmbedsCard({
  host,
  workspaceSlug,
  locale,
}: {
  host: string;
  workspaceSlug: string;
  locale: Locale;
}) {
  const [kind, setKind] = useState<Kind>('tiers');
  // The default label travels INTO the public embed, whose language is the
  // embed's own (data-lang / workspace) — deliberately not this UI's.
  const [label, setLabel] = useState('Become a member');
  const [lang, setLang] = useState<string>('auto');
  const [copied, setCopied] = useState<'script' | 'snippet' | 'all' | null>(null);

  const scriptTag = `<script src="${host}/embed.js" defer></script>`;

  const snippet = useMemo(() => {
    const langAttr = lang !== 'auto' ? ` data-lang="${lang}"` : '';
    if (kind === 'button') {
      return `<div data-membership-embed="button" data-workspace="${workspaceSlug}"\n     data-label="${label || 'Become a member'}"${langAttr}></div>`;
    }
    return `<div data-membership-embed="tiers" data-workspace="${workspaceSlug}"${langAttr}></div>`;
  }, [kind, label, lang, workspaceSlug]);

  const allInOne = `${scriptTag}\n${snippet}`;

  async function copy(which: 'script' | 'snippet' | 'all', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard unavailable (permissions) — the user can select manually.
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>{t(locale, 'st_embeds_title')}</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        {t(locale, 'embeds_blurb_1')} <code className="font-mono">me-*</code>{' '}
        {t(locale, 'embeds_blurb_2')} <code className="font-mono">&lt;style&gt;</code>{' '}
        {t(locale, 'embeds_blurb_3')}
      </p>

      <div className="mt-4 space-y-4">
        {/* What */}
        <div>
          <span className="text-xs text-ink-subtle">{t(locale, 'what_to_embed')}</span>
          <div className="mt-1.5 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm max-w-md">
            {(
              [
                ['tiers', t(locale, 'tier_cards')],
                ['button', t(locale, 'join_button')],
              ] as [Kind, string][]
            ).map(([k, kindLabel]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  kind === k
                    ? 'bg-surface-sunken text-ink font-medium'
                    : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                }
              >
                {kindLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          {/* Language */}
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'language')}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className={`${SELECT} mt-1`}
            >
              <option value="auto">{t(locale, 'lang_auto')}</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l as PublicLocale]}
                </option>
              ))}
            </select>
          </label>

          {/* Button label */}
          {kind === 'button' && (
            <label className="block">
              <span className="text-xs text-ink-subtle">{t(locale, 'button_text')}</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={`${SELECT} mt-1`}
              />
            </label>
          )}
        </div>

        {/* Output */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">{t(locale, 'embed_step1')}</span>
              <CopyButton
                copied={copied === 'script'}
                locale={locale}
                onClick={() => void copy('script', scriptTag)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {scriptTag}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">{t(locale, 'embed_step2')}</span>
              <CopyButton
                copied={copied === 'snippet'}
                locale={locale}
                onClick={() => void copy('snippet', snippet)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {snippet}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">{t(locale, 'embed_all_in_one')}</span>
              <CopyButton
                copied={copied === 'all'}
                locale={locale}
                onClick={() => void copy('all', allInOne)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {allInOne}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyButton({
  copied,
  locale,
  onClick,
}: {
  copied: boolean;
  locale: Locale;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
    >
      {copied ? (
        <>
          <Check size={12} strokeWidth={2} className="text-emerald-600" />
          {t(locale, 'copied')}
        </>
      ) : (
        <>
          <Copy size={12} strokeWidth={1.75} />
          {t(locale, 'copy')}
        </>
      )}
    </button>
  );
}
