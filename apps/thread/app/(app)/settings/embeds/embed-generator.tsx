'use client';

// Embed code generator (Sjoerd 2026-07-03): pick what to embed, the thread,
// the elements and the language — the copy-paste snippet builds itself.
// Lives at the bottom of Settings → Website embeds, under the docs.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { DEFAULT_EMBED_CSS } from './default-embed-css';
import { SectionLabel } from '@/components/ui/page';
import { SearchSelect } from '@thefibre/shared/ui/search-select';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

export type GeneratorThread = {
  id: string;
  slug: string;
  title: string;
  /** Public owner slug — the team's for team threads, else the organiser's. */
  ownerSlug: string;
  listed: boolean;
};

export type GeneratorTeam = { id: string; name: string };

type Kind = 'list' | 'thread' | 'card' | 'card_form' | 'enrol';


const ELEMENTS = [
  { key: 'cover', label: 'Cover image' },
  { key: 'intention', label: 'Intention' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'price', label: 'Price' },
  { key: 'enrol', label: 'Enrol form' },
] as const;

const SELECT =
  'w-full rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function EmbedGenerator({
  organiserSlug,
  workspaceId,
  threads,
  teams,
  categories = [],
}: {
  organiserSlug: string;
  workspaceId: string;
  threads: GeneratorThread[];
  teams: GeneratorTeam[];
  categories?: { name: string; slug: string }[];
}) {
  const [kind, setKind] = useState<Kind>('thread');
  // list: my threads, the whole workspace, or one team
  const [listOwner, setListOwner] = useState<string>('mine'); // 'mine' | 'workspace' | team id
  // list: narrow to one kind of thread ('all' | 'event' | 'journey')
  const [listFormat, setListFormat] = useState<string>('all');
  // list: narrow to one category slug ('' = all) — Settings \u2192 Categories
  const [listCategory, setListCategory] = useState<string>('');
  // changes the labels around the two blocks — Webflow has named places
  const [target, setTarget] = useState<'any' | 'webflow'>('any');
  const [threadId, setThreadId] = useState<string>(threads[0]?.id ?? '');
  const [elements, setElements] = useState<Set<string>>(new Set(ELEMENTS.map((e) => e.key)));
  const [lang, setLang] = useState<string>('auto');
  const [buttonText, setButtonText] = useState('Enrol now');
  const [includeCss, setIncludeCss] = useState(false);
  const [copied, setCopied] = useState<'script' | 'snippet' | null>(null);

  const thread = threads.find((t) => t.id === threadId) ?? null;

  function toggleElement(key: string) {
    setElements((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const snippet = useMemo(() => {
    const langAttr = lang !== 'auto' ? ` data-lang="${lang}"` : '';
    // The <style> goes INSIDE the embed element — embed.js lifts it into
    // the iframe so it styles the embed, never the host page.
    const styleBlock = includeCss ? `\n  <style>\n${DEFAULT_EMBED_CSS}  </style>\n` : '';
    if (kind === 'list') {
      const ownerAttr =
        listOwner === 'mine'
          ? `data-organiser="${organiserSlug}"`
          : listOwner === 'workspace'
            ? `data-workspace="${workspaceId}"`
            : `data-team="${listOwner}"`;
      const formatAttr =
        listFormat === 'event' || listFormat === 'journey'
          ? ` data-format="${listFormat}"`
          : '';
      const categoryAttr = listCategory ? ` data-category="${listCategory}"` : '';
      return `<div data-thread-embed="list" ${ownerAttr}${formatAttr}${categoryAttr}${langAttr}>${styleBlock}</div>`;
    }
    if (!thread) return '<!-- create a thread first -->';
    if (kind === 'card' || kind === 'card_form') {
      const formAttr = kind === 'card_form' ? ' data-form="1"' : '';
      return `<div data-thread-embed="card" data-organiser="${thread.ownerSlug}"\n     data-thread="${thread.slug}"${formAttr}${langAttr}>${styleBlock}</div>`;
    }
    if (kind === 'enrol') {
      return `<a href="#" data-thread-embed="enrol" data-organiser="${thread.ownerSlug}"\n   data-thread="${thread.slug}"${langAttr}>${styleBlock}${buttonText || 'Enrol now'}</a>`;
    }
    // single thread — data-elements only when it's a subset.
    const allSelected = elements.size === ELEMENTS.length;
    const elementsAttr = allSelected
      ? ''
      : `\n     data-elements="${ELEMENTS.filter((e) => elements.has(e.key))
          .map((e) => e.key)
          .join(',')}"`;
    return `<div data-thread-embed="thread" data-organiser="${thread.ownerSlug}"\n     data-thread="${thread.slug}"${elementsAttr}${langAttr}>${styleBlock}</div>`;
  }, [kind, listOwner, listFormat, listCategory, thread, elements, lang, buttonText, includeCss, organiserSlug, workspaceId]);

  const scriptTag = `<script src="${HOST}/embed.js" defer></script>`;

  async function copy(which: 'script' | 'snippet', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard unavailable (permissions) — the user can select manually.
    }
  }

  return (
    <section>
      <SectionLabel>Code generator</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        Pick what you want on your website — the code builds itself below.
      </p>

      <div className="mt-3 rounded-lg border border-line bg-surface-raised p-4 space-y-4">
        {/* What */}
        <div>
          <span className="text-xs text-ink-subtle">What do you want to embed?</span>
          <div className="mt-1.5 grid grid-cols-5 rounded-md border border-line overflow-hidden h-[34px] text-sm max-w-2xl">
            {(
              [
                ['list', 'Thread list'],
                ['thread', 'One thread'],
                ['card', 'Card'],
                ['card_form', 'Card + form'],
                ['enrol', 'Enrol button'],
              ] as [Kind, string][]
            ).map(([k, label]) => (
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
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Which */}
          {kind === 'list' ? (
            <label className="block">
              <span className="text-xs text-ink-subtle">Which threads</span>
              <select
                value={listOwner}
                onChange={(e) => setListOwner(e.target.value)}
                className={`${SELECT} mt-1`}
              >
                <option value="mine">All my public threads</option>
                <option value="workspace">Whole workspace — everyone&apos;s public threads</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    Team · {t.name}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-ink-subtle">Kind</span>
              <select
                value={listFormat}
                onChange={(e) => setListFormat(e.target.value)}
                className={`${SELECT} mt-1`}
              >
                <option value="all">Events and journeys</option>
                <option value="event">Events only</option>
                <option value="journey">Journeys only</option>
              </select>
              {categories.length > 0 && (
                <>
                  <span className="mt-2 block text-xs text-ink-subtle">Category</span>
                  <select
                    value={listCategory}
                    onChange={(e) => setListCategory(e.target.value)}
                    className={`${SELECT} mt-1`}
                  >
                    <option value="">All categories</option>
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </label>
          ) : (
            <div>
              <span className="text-xs text-ink-subtle">Thread</span>
              <SearchSelect
                className="mt-1"
                value={threadId}
                onChange={setThreadId}
                options={threads.map((t) => ({ value: t.id, label: t.title }))}
                placeholder="Pick a thread…"
                searchPlaceholder="Search threads…"
              />
            </div>
          )}

          {/* Where it will be pasted — only changes the instructions */}
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

          {/* Language */}
          <label className="block">
            <span className="text-xs text-ink-subtle">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className={`${SELECT} mt-1`}
            >
              <option value="auto">Automatic — the thread&apos;s own language</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l as Locale]}
                </option>
              ))}
            </select>
          </label>

          {/* Button text for the enrol popup */}
          {kind === 'enrol' && (
            <label className="block">
              <span className="text-xs text-ink-subtle">Button text</span>
              <input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className={`${SELECT} mt-1`}
              />
            </label>
          )}
        </div>

        {/* Elements for the single-thread embed */}
        {kind === 'thread' && (
          <div>
            <span className="text-xs text-ink-subtle">Sections to show</span>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {ELEMENTS.map((e) => (
                <label
                  key={e.key}
                  className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={elements.has(e.key)}
                    onChange={() => toggleElement(e.key)}
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="inline-flex items-start gap-2 text-sm text-ink-subtle cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeCss}
            onChange={(e) => setIncludeCss(e.target.checked)}
          />
          <span>
            Include the starter stylesheet — every element listed with its default look, ready
            to change. Only affects the embed, never your page.
          </span>
        </label>

        {kind !== 'list' && thread && !thread.listed && (
          <p className="text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded-md px-2.5 py-2 max-w-2xl">
            This thread is unlisted — the embed still works (direct link), it just won&apos;t
            appear in list embeds.
          </p>
        )}

        {/* Output */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">
                {target === 'webflow'
                  ? '1 · Webflow: Site settings → Custom code → Head code (once per site)'
                  : '1 · Once per site, in the <head> (or before </body>)'}
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
              <span className="text-xs text-ink-subtle">
                {target === 'webflow'
                  ? '2 · Add an Embed element where it should appear, paste this'
                  : '2 · Where the embed should appear'}
              </span>
              <CopyButton
                copied={copied === 'snippet'}
                onClick={() => void copy('snippet', snippet)}
              />
            </div>
            <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
              {snippet}
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
