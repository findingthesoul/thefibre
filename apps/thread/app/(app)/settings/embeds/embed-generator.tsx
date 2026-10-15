'use client';

// Embed code generator (Sjoerd 2026-07-03): pick what to embed, the thread,
// the elements and the language — the copy-paste snippet builds itself.
// Lives at the bottom of Settings → Website embeds, under the docs.

import { useMemo, useState } from 'react';
import { CodeBlock } from '@thefibre/shared/ui/code-block';
import { CHIP, CHIP_STATE } from '@thefibre/shared/ui/recipes';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n-ui';
import { DEFAULT_EMBED_CSS } from './default-embed-css';
import { SectionLabel } from '@/components/ui/page';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { THREAD_ORIGIN } from '@/lib/public-host';

export type GeneratorThread = {
  id: string;
  slug: string;
  title: string;
  /** Public owner slug — the team's for team threads, else the organiser's. */
  ownerSlug: string;
  listed: boolean;
};

export type GeneratorTeam = { id: string; name: string; slug?: string };

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
  // list: the site owner's include/exclude (server-side) and the filters a
  // visitor may use (client-side) — backlog 2jt, 2026-10-16.
  const [onlyCats, setOnlyCats] = useState<Set<string>>(new Set());
  const [skipCats, setSkipCats] = useState<Set<string>>(new Set());
  const [skipTeams, setSkipTeams] = useState<Set<string>>(new Set());
  const [visitorFilters, setVisitorFilters] = useState<Set<string>>(new Set());
  // What the card's date line shows (thread dates part 3). 'default' = the
  // workspace's choice in Settings; the two extras are only ADDED here.
  const [cardRange, setCardRange] = useState<string>('default');
  const [cardExtras, setCardExtras] = useState<Set<string>>(new Set());
  const flip = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  // changes the labels around the two blocks — Webflow has named places
  const [target, setTarget] = useState<'any' | 'webflow'>('any');
  const [threadId, setThreadId] = useState<string>(threads[0]?.id ?? '');
  const [elements, setElements] = useState<Set<string>>(new Set(ELEMENTS.map((e) => e.key)));
  const [lang, setLang] = useState<string>('auto');
  const [buttonText, setButtonText] = useState('Enrol now');
  const [includeCss, setIncludeCss] = useState(false);

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
    const cardAttrs =
      (cardRange !== 'default' ? ` data-dates="${cardRange.replace(/_/g, '-')}"` : '') +
      (cardExtras.has('sessions') ? ' data-sessions="1"' : '') +
      (cardExtras.has('signup_by') ? ' data-signup-by="1"' : '');
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
      const list = (set: Set<string>) => [...set].join(',');
      const categoryAttr = onlyCats.size ? ` data-category="${list(onlyCats)}"` : '';
      const skipCatAttr = skipCats.size ? ` data-exclude-category="${list(skipCats)}"` : '';
      // Leaving teams out only means something when the list is not one team.
      const skipTeamAttr = skipTeams.size && (listOwner === 'mine' || listOwner === 'workspace') ? ` data-exclude-team="${list(skipTeams)}"` : '';
      // Canonical order, so the same choice always gives the same snippet.
      const filterAttr = visitorFilters.size
        ? ` data-filters="${['date', 'team', 'category', 'language'].filter((k) => visitorFilters.has(k)).join(',')}"`
        : '';
      return `<div data-thread-embed="list" ${ownerAttr}${formatAttr}${categoryAttr}${skipCatAttr}${skipTeamAttr}${filterAttr}${cardAttrs}${langAttr}>${styleBlock}</div>`;
    }
    if (!thread) return '<!-- create a thread first -->';
    if (kind === 'card' || kind === 'card_form') {
      const formAttr = kind === 'card_form' ? ' data-form="1"' : '';
      return `<div data-thread-embed="card" data-organiser="${thread.ownerSlug}"\n     data-thread="${thread.slug}"${formAttr}${cardAttrs}${langAttr}>${styleBlock}</div>`;
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
  }, [kind, listOwner, listFormat, onlyCats, skipCats, skipTeams, visitorFilters, cardRange, cardExtras, thread, elements, lang, buttonText, includeCss, organiserSlug, workspaceId]);

  const scriptTag = `<script src="${THREAD_ORIGIN}/embed.js" defer></script>`;

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
                  <ChipRow
                    label={t(locale, 'embed_only_categories')}
                    options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                    chosen={onlyCats}
                    onToggle={(v) => setOnlyCats((s) => flip(s, v))}
                  />
                  <ChipRow
                    label={t(locale, 'embed_leave_out_categories')}
                    options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                    chosen={skipCats}
                    onToggle={(v) => setSkipCats((s) => flip(s, v))}
                  />
                </>
              )}
              {(listOwner === 'mine' || listOwner === 'workspace') && teams.some((tm) => tm.slug) && (
                <ChipRow
                  label={t(locale, 'embed_leave_out_teams')}
                  options={teams.filter((tm) => tm.slug).map((tm) => ({ value: tm.slug!, label: tm.name }))}
                  chosen={skipTeams}
                  onToggle={(v) => setSkipTeams((s) => flip(s, v))}
                />
              )}
              <ChipRow
                label={t(locale, 'embed_visitor_filters')}
                options={[
                  { value: 'date', label: t(locale, 'embed_vf_date') },
                  { value: 'team', label: t(locale, 'embed_vf_team') },
                  { value: 'category', label: t(locale, 'embed_vf_category') },
                  { value: 'language', label: t(locale, 'embed_vf_language') },
                ]}
                chosen={visitorFilters}
                onToggle={(v) => setVisitorFilters((s) => flip(s, v))}
              />
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

          {(kind === 'list' || kind === 'card' || kind === 'card_form') && (
            <div className="sm:col-span-2 space-y-2">
              <ChipRow
                label={t(locale, 'embed_card_dates')}
                options={[
                  { value: 'default', label: t(locale, 'embed_cd_default') },
                  { value: 'event', label: t(locale, 'embed_cd_event') },
                  { value: 'thread', label: t(locale, 'embed_cd_thread') },
                  { value: 'start_thread', label: t(locale, 'embed_cd_start_thread') },
                  { value: 'start_event', label: t(locale, 'embed_cd_start_event') },
                ]}
                chosen={new Set([cardRange])}
                onToggle={(v) => setCardRange(v)}
              />
              <ChipRow
                label={t(locale, 'embed_cd_add')}
                options={[
                  { value: 'sessions', label: t(locale, 'embed_cd_sessions') },
                  { value: 'signup_by', label: t(locale, 'embed_cd_signup_by') },
                ]}
                chosen={cardExtras}
                onToggle={(v) => setCardExtras((s) => flip(s, v))}
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
          <CodeBlock
            label={target === 'webflow' ? t(locale, 'head_label_webflow') : t(locale, 'head_label_any')}
            code={scriptTag}
          />
          <CodeBlock
            label={target === 'webflow' ? t(locale, 'body_label_webflow') : t(locale, 'body_label_any')}
            code={snippet}
          />
        </div>
      </div>
    </section>
  );
}

/** A row of toggle chips (the shared CHIP recipe) — several may be on. */
function ChipRow({
  label,
  options,
  chosen,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  chosen: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-2">
      <span className="block text-xs text-ink-subtle">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={chosen.has(o.value)}
            onClick={() => onToggle(o.value)}
            className={`${CHIP} ${chosen.has(o.value) ? CHIP_STATE.on : CHIP_STATE.off}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

