'use client';

// Website embeds — the loader integration (the Thread-style generator,
// trimmed to Membership's two embeds). One script per site + a data-div
// where the embed should appear; /embed.js turns the div into an
// auto-sizing iframe. Admin surface — its own copy stays English.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { SectionLabel } from './page-chrome';

type Kind = 'tiers' | 'button';

const SELECT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function EmbedsCard({ host, workspaceSlug }: { host: string; workspaceSlug: string }) {
  const [kind, setKind] = useState<Kind>('tiers');
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
      <SectionLabel>Website embeds</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        Show your tiers and take memberships on any website — auto-sizing, copy-paste. Every
        element inside the embed carries a stable <code className="font-mono">me-*</code> class
        (me-card, me-title, me-price, me-btn, …); to restyle it, put a{' '}
        <code className="font-mono">&lt;style&gt;</code> block INSIDE the embed div — it is
        lifted into the embed and never touches your page.
      </p>

      <div className="mt-4 space-y-4">
        {/* What */}
        <div>
          <span className="text-xs text-ink-subtle">What do you want to embed?</span>
          <div className="mt-1.5 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm max-w-md">
            {(
              [
                ['tiers', 'Tier cards'],
                ['button', 'Join button'],
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
            <span className="text-xs text-ink-subtle">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className={`${SELECT} mt-1`}
            >
              <option value="auto">Automatic — the workspace&apos;s</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l as Locale]}
                </option>
              ))}
            </select>
          </label>

          {/* Button label */}
          {kind === 'button' && (
            <label className="block">
              <span className="text-xs text-ink-subtle">Button text</span>
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
              <span className="text-xs text-ink-subtle">
                1 · Once per site, in the &lt;head&gt; (or before &lt;/body&gt;)
              </span>
              <CopyButton
                copied={copied === 'script'}
                onClick={() => void copy('script', scriptTag)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {scriptTag}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">2 · Where the embed should appear</span>
              <CopyButton
                copied={copied === 'snippet'}
                onClick={() => void copy('snippet', snippet)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {snippet}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">
                Or all-in-one — script and embed in a single paste
              </span>
              <CopyButton copied={copied === 'all'} onClick={() => void copy('all', allInOne)} />
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

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
    >
      {copied ? (
        <>
          <Check size={12} strokeWidth={2} className="text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy size={12} strokeWidth={1.75} />
          Copy
        </>
      )}
    </button>
  );
}
