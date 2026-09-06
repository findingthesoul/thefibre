'use client';

// Thread settings → Embed: this one thread on any website — a compact card
// (cover, title, date, price, button) or just a registration button that
// opens the enrol popup. The workspace-wide generator (whole agendas, list
// filters) lives in Settings → Website embeds; this tab is deliberately only
// what makes sense for ONE thread.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n-ui';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://app.thethread.app';

const SELECT =
  'h-[34px] w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink';

export function ThreadEmbedPanel({
  locale,
  ownerSlug,
  threadSlug,
}: {
  locale: Locale;
  ownerSlug: string;
  threadSlug: string;
}) {
  const [kind, setKind] = useState<'card' | 'card_form' | 'enrol'>('card');
  const [target, setTarget] = useState<'any' | 'webflow'>('any');
  const [lang, setLang] = useState('auto');
  const [buttonText, setButtonText] = useState('Enrol now');
  const [copied, setCopied] = useState<string | null>(null);

  const scriptTag = `<script src="${HOST}/embed.js" defer></script>`;
  const snippet = useMemo(() => {
    const langAttr = lang !== 'auto' ? ` data-lang="${lang}"` : '';
    if (kind === 'enrol') {
      return `<a href="#" data-thread-embed="enrol" data-organiser="${ownerSlug}"\n   data-thread="${threadSlug}"${langAttr}>${buttonText || 'Enrol now'}</a>`;
    }
    const formAttr = kind === 'card_form' ? ' data-form="1"' : '';
    return `<div data-thread-embed="card" data-organiser="${ownerSlug}"\n     data-thread="${threadSlug}"${formAttr}${langAttr}></div>`;
  }, [kind, lang, buttonText, ownerSlug, threadSlug]);

  async function copy(which: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — select manually */
    }
  }

  const headLabel =
    target === 'webflow' ? t(locale, 'head_label_webflow') : t(locale, 'head_label_any');
  const bodyLabel =
    target === 'webflow' ? t(locale, 'body_label_webflow') : t(locale, 'body_label_any');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'what')}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'card' | 'card_form' | 'enrol')}
            className={`${SELECT} mt-1`}
          >
            <option value="card">{t(locale, 'embed_card_option')}</option>
            <option value="card_form">{t(locale, 'embed_card_form_option')}</option>
            <option value="enrol">{t(locale, 'embed_enrol_option')}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'website')}</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as 'any' | 'webflow')}
            className={`${SELECT} mt-1`}
          >
            <option value="any">{t(locale, 'any_website')}</option>
            <option value="webflow">Webflow</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'language')}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className={`${SELECT} mt-1`}
          >
            <option value="auto">{t(locale, 'auto_thread_lang')}</option>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l as Locale]}
              </option>
            ))}
          </select>
        </label>
        {kind === 'enrol' && (
          <label className="block sm:col-span-3 max-w-xs">
            <span className="text-xs text-ink-subtle">{t(locale, 'button_text')}</span>
            <input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              className={`${SELECT} mt-1`}
            />
          </label>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">{headLabel}</span>
            <CopyBtn locale={locale} copied={copied === 'script'} onClick={() => void copy('script', scriptTag)} />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {scriptTag}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">{bodyLabel}</span>
            <CopyBtn locale={locale} copied={copied === 'snippet'} onClick={() => void copy('snippet', snippet)} />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {snippet}
          </pre>
        </div>
        {target === 'any' && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">{t(locale, 'all_in_one')}</span>
              <CopyBtn
                locale={locale}
                copied={copied === 'both'}
                onClick={() => void copy('both', `${scriptTag}\n${snippet}`)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {`${scriptTag}\n${snippet}`}
            </pre>
          </div>
        )}
      </div>
      <p className="text-xs text-ink-muted">{t(locale, 'embed_more_note')}</p>
    </div>
  );
}

function CopyBtn({
  locale,
  copied,
  onClick,
}: {
  locale: Locale;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink"
    >
      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
      {copied ? t(locale, 'copied_word') : t(locale, 'copy')}
    </button>
  );
}
