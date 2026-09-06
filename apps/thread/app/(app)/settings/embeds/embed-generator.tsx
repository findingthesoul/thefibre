'use client';

// Embed code generator (Sjoerd 2026-07-03): pick what to embed, the thread,
// the elements and the language — the copy-paste snippet builds itself.
// Lives at the bottom of Settings → Website embeds, under the docs.

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n-ui';
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
  { key: 'cover', labelKey: 'el_cover' },
  { key: 'intention', labelKey: 'intention' },
  { key: 'agenda', labelKey: 'agenda' },
  { key: 'price', labelKey: 'price' },
  { key: 'enrol', labelKey: 'enrol_form' },
] as const;

const SELECT =
  'w-full rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function EmbedGenerator({
  locale,
  organiserSlug,
  workspaceId,
  threads,
  teams,
  categories = [],
}: {
  locale: Locale;
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
      <SectionLabel>{t(locale, 'code_generator')}</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        {t(locale, 'code_generator_desc')}
      </p>

      <div className="mt-3 rounded-lg border border-line bg-surface-raised p-4 space-y-4">
        {/* What */}
        <div>
          <span className="text-xs text-ink-subtle">{t(locale, 'what_embed')}</span>
          <div className="mt-1.5 grid grid-cols-5 rounded-md border border-line overflow-hidden h-[34px] text-sm max-w-2xl">
            {(
              [
                ['list', t(locale, 'gen_thread_list')],
                ['thread', t(locale, 'gen_one_thread')],
                ['card', t(locale, 'gen_card')],
                ['card_form', t(locale, 'gen_card_form')],
                ['enrol', t(locale, 'gen_enrol_button')],
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
              <span className="text-xs text-ink-subtle">{t(locale, 'which_threads')}</span>
              <select
                value={listOwner}
                onChange={(e) => setListOwner(e.target.value)}
                className={`${SELECT} mt-1`}
              >
                <option value="mine">{t(locale, 'all_my_public')}</option>
                <option value="workspace">{t(locale, 'whole_ws_public')}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {t(locale, 'team_option_prefix', { name: tm.name })}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-ink-subtle">{t(locale, 'kind')}</span>
              <select
                value={listFormat}
                onChange={(e) => setListFormat(e.target.value)}
                className={`${SELECT} mt-1`}
              >
                <option value="all">{t(locale, 'events_and_journeys')}</option>
                <option value="event">{t(locale, 'events_only')}</option>
                <option value="journey">{t(locale, 'journeys_only')}</option>
              </select>
              {categories.length > 0 && (
                <>
                  <span className="mt-2 block text-xs text-ink-subtle">
                    {t(locale, 'category')}
                  </span>
                  <select
                    value={listCategory}
                    onChange={(e) => setListCategory(e.target.value)}
                    className={`${SELECT} mt-1`}
                  >
                    <option value="">{t(locale, 'all_categories')}</option>
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
              <span className="text-xs text-ink-subtle">{t(locale, 'thread')}</span>
              <SearchSelect
                className="mt-1"
                value={threadId}
                onChange={setThreadId}
                options={threads.map((th) => ({ value: th.id, label: th.title }))}
                placeholder={t(locale, 'pick_thread')}
                searchPlaceholder={t(locale, 'search_threads')}
              />
            </div>
          )}

          {/* Where it will be pasted — only changes the instructions */}
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

          {/* Language */}
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

          {/* Button text for the enrol popup */}
          {kind === 'enrol' && (
            <label className="block">
              <span className="text-xs text-ink-subtle">{t(locale, 'button_text')}</span>
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
            <span className="text-xs text-ink-subtle">{t(locale, 'sections_to_show')}</span>
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
                  {t(locale, e.labelKey)}
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
          <span>{t(locale, 'include_css')}</span>
        </label>

        {kind !== 'list' && thread && !thread.listed && (
          <p className="text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded-md px-2.5 py-2 max-w-2xl">
            {t(locale, 'unlisted_note')}
          </p>
        )}

        {/* Output */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">
                {target === 'webflow'
                  ? t(locale, 'head_label_webflow')
                  : t(locale, 'head_label_any')}
              </span>
              <CopyButton
                locale={locale}
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
                  ? t(locale, 'body_label_webflow')
                  : t(locale, 'body_label_any')}
              </span>
              <CopyButton
                locale={locale}
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

function CopyButton({
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
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
    >
      {copied ? (
        <>
          <Check size={12} strokeWidth={2} className="text-emerald-600" />
          {t(locale, 'copied_word')}
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
