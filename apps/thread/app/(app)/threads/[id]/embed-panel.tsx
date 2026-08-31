'use client';

// Thread settings → Embed: this one thread on any website — a compact card
// (cover, title, date, price, button) or just a registration button that
// opens the enrol popup. The workspace-wide generator (whole agendas, list
// filters) lives in Settings → Website embeds; this tab is deliberately only
// what makes sense for ONE thread.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

const SELECT =
  'h-[34px] w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink';

export function ThreadEmbedPanel({
  ownerSlug,
  threadSlug,
}: {
  ownerSlug: string;
  threadSlug: string;
}) {
  const [kind, setKind] = useState<'card' | 'enrol'>('card');
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
    return `<div data-thread-embed="card" data-organiser="${ownerSlug}"\n     data-thread="${threadSlug}"${langAttr}></div>`;
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
    target === 'webflow'
      ? '1 · Webflow: Site settings → Custom code → Head code (once per site)'
      : '1 · Once per site, in the <head> (or before </body>)';
  const bodyLabel =
    target === 'webflow'
      ? '2 · Add an Embed element where it should appear, paste this'
      : '2 · Where the embed should appear';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <label className="block">
          <span className="text-xs text-ink-subtle">What</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'card' | 'enrol')}
            className={`${SELECT} mt-1`}
          >
            <option value="card">Card — image, title, date, price</option>
            <option value="enrol">Registration button only</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">Website</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as 'any' | 'webflow')}
            className={`${SELECT} mt-1`}
          >
            <option value="any">Any website</option>
            <option value="webflow">Webflow</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">Language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className={`${SELECT} mt-1`}
          >
            <option value="auto">Automatic — the thread&apos;s own</option>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l as Locale]}
              </option>
            ))}
          </select>
        </label>
        {kind === 'enrol' && (
          <label className="block sm:col-span-3 max-w-xs">
            <span className="text-xs text-ink-subtle">Button text</span>
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
            <CopyBtn copied={copied === 'script'} onClick={() => void copy('script', scriptTag)} />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {scriptTag}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">{bodyLabel}</span>
            <CopyBtn copied={copied === 'snippet'} onClick={() => void copy('snippet', snippet)} />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {snippet}
          </pre>
        </div>
        {target === 'any' && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">
                Or all-in-one, if you can only paste a single block
              </span>
              <CopyBtn
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
      <p className="text-xs text-ink-muted">
        Whole agendas, team or workspace listings and custom CSS live in Settings → Website
        embeds.
      </p>
    </div>
  );
}

function CopyBtn({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink"
    >
      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
