'use client';

// Website embeds — the loader integration (the Thread-style generator,
// trimmed to Membership's two embeds). One script per site + a data-div
// where the embed should appear; /embed.js turns the div into an
// auto-sizing iframe. The card chrome follows the user's interface
// language (i18n P3); the GENERATED SNIPPETS are code and stay verbatim.

import { useMemo, useState } from 'react';
import { CodeBlock } from '@thefibre/shared/ui/code-block';
import { LOCALES, LOCALE_LABELS, type Locale as PublicLocale } from '@/lib/i18n';
import { t, type Locale } from '@/lib/i18n-ui';
import { SectionLabel } from './page-chrome';

type Kind = 'page' | 'tiers' | 'join' | 'button';

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
  const [kind, setKind] = useState<Kind>('page');
  // The default label travels INTO the public embed, whose language is the
  // embed's own (data-lang / workspace) — deliberately not this UI's.
  const [label, setLabel] = useState('Become a member');
  const [lang, setLang] = useState<string>('auto');

  const scriptTag = `<script src="${host}/embed.js" defer></script>`;

  const snippet = useMemo(() => {
    const langAttr = lang !== 'auto' ? ` data-lang="${lang}"` : '';
    const text = label || 'Become a member';
    if (kind === 'button') {
      return `<div data-membership-embed="button" data-workspace="${workspaceSlug}"\n     data-label="${text}"${langAttr}></div>`;
    }
    if (kind === 'join') {
      // The popup binds to the host's OWN element — the loader does not draw
      // a button, it opens an overlay when this div is clicked. So the
      // snippet ships a plain button inside it: it works pasted as-is, and
      // anyone who wants their site's own button just replaces the inner
      // element and keeps the wrapper.
      return `<div data-membership-embed="join" data-workspace="${workspaceSlug}"${langAttr}>\n  <button type="button">${text}</button>\n</div>`;
    }
    if (kind === 'page') {
      return `<div data-membership-embed="page" data-workspace="${workspaceSlug}"${langAttr}></div>`;
    }
    return `<div data-membership-embed="tiers" data-workspace="${workspaceSlug}"${langAttr}></div>`;
  }, [kind, label, lang, workspaceSlug]);

  const allInOne = `${scriptTag}\n${snippet}`;

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
          <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 rounded-md border border-line overflow-hidden text-sm max-w-md">
            {(
              [
                ['page', t(locale, 'whole_page')],
                ['tiers', t(locale, 'tier_cards')],
                ['join', t(locale, 'join_popup')],
                ['button', t(locale, 'join_button')],
              ] as [Kind, string][]
            ).map(([k, kindLabel]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`h-[34px] px-1 ${
                  kind === k
                    ? 'bg-surface-sunken text-ink font-medium'
                    : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                }`}
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
          {(kind === 'button' || kind === 'join') && (
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
          <CodeBlock label={t(locale, 'embed_step1')} code={scriptTag} />
          <CodeBlock label={t(locale, 'embed_step2')} code={snippet} />
          <CodeBlock label={t(locale, 'embed_all_in_one')} code={allInOne} />
        </div>
      </div>
    </section>
  );
}
