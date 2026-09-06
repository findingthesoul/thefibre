// Website embeds — the copy-paste snippets for Webflow (or any site).
// The embed system shipped in 3.10.0; this page makes it discoverable
// (Sjoerd 2026-07-02: "the webflow integrations" looked missing — they
// weren't, they were invisible).

import { apiFetch } from '@/lib/api';
import { one, type OrganiserRow, type ThreadRow, type TeamOption } from '@/lib/thread-types';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel } from '@/components/ui/page';
import {
  EmbedGenerator,
  type GeneratorThread,
  type GeneratorTeam,
} from './embed-generator';
// From its own server-safe module — never from the client module above:
// a 'use client' export reaches a Server Component as a proxy, and calling
// .split on the proxy was exactly the production 500 this page had.
import { DEFAULT_EMBED_CSS } from './default-embed-css';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

export default async function EmbedsSettingsPage() {
  const locale = await uiLocale();
  const [organiser, threadsRes, teamsRes, categoriesRes] = await Promise.all([
    apiFetch<OrganiserRow>('/api/v1/thread/me'),
    apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads').catch(() => ({
      items: [] as ThreadRow[],
    })),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
      items: [] as TeamOption[],
    })),
    apiFetch<{ items: { name: string; slug: string }[] }>('/api/v1/thread/categories').catch(
      () => ({ items: [] as { name: string; slug: string }[] }),
    ),
  ]);

  // Feed the generator real threads: title from the program, public owner
  // slug = the team's for team threads (organiser URLs 404 for those).
  const generatorThreads: GeneratorThread[] = threadsRes.items.map((t) => {
    const program = one(t.program);
    const team = one(t.team);
    return {
      id: t.id,
      slug: t.slug,
      title: program?.title ?? t.slug,
      ownerSlug: team?.slug ?? organiser.slug,
      listed: t.is_public_listed,
    };
  });
  const generatorTeams: GeneratorTeam[] = teamsRes.items.map((t) => ({ id: t.id, name: t.name }));

  const snippets: { title: string; desc: string; code: string }[] = [
    {
      title: t(locale, 'snippet_1_title'),
      desc: t(locale, 'snippet_1_desc'),
      code: `<script src="${HOST}/embed.js" defer></script>`,
    },
    {
      title: t(locale, 'snippet_2_title'),
      desc: t(locale, 'snippet_2_desc'),
      code: `<div data-thread-embed="list" data-organiser="${organiser.slug}"></div>`,
    },
    {
      title: t(locale, 'snippet_3_title'),
      desc: t(locale, 'snippet_3_desc'),
      code: `<div data-thread-embed="thread" data-organiser="${organiser.slug}"\n     data-thread="your-thread-slug" data-elements="cover,intention,enrol"></div>`,
    },
    {
      title: t(locale, 'snippet_4_title'),
      desc: t(locale, 'snippet_4_desc'),
      code: `<a href="#" data-thread-embed="enrol" data-organiser="${organiser.slug}"\n   data-thread="your-thread-slug">Enrol now</a>`,
    },
  ];

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'settings_embeds')}
        description={t(locale, 'embeds_page_desc')}
      />
      <p className="mt-2 text-xs text-ink-subtle">
        {t(locale, 'embeds_dev_note_1')}{' '}
        <a href="/developers" className="underline underline-offset-2" target="_blank">
          /developers
        </a>
        .
      </p>
      <div className="mt-8 space-y-8">
        {snippets.map((s) => (
          <section key={s.title}>
            <SectionLabel>{s.title}</SectionLabel>
            <p className="mt-1.5 text-xs text-ink-subtle">{s.desc}</p>
            <pre className="mt-2 rounded-lg border border-line bg-surface-raised p-4 text-xs overflow-x-auto font-mono leading-relaxed">
              {s.code}
            </pre>
          </section>
        ))}
        <section>
          <SectionLabel>{t(locale, 'embeds_lang_label')}</SectionLabel>
          <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
            {t(locale, 'embeds_lang_1')} <code className="font-mono">data-lang</code>{' '}
            {t(locale, 'embeds_lang_2')}{' '}
            {LOCALES.map((l, i) => (
              <span key={l}>
                {i > 0 && ', '}
                <code className="font-mono">{l}</code> ({LOCALE_LABELS[l]})
              </span>
            ))}
            {t(locale, 'embeds_lang_3')}
          </p>
          <pre className="mt-2 rounded-lg border border-line bg-surface-raised p-4 text-xs overflow-x-auto font-mono leading-relaxed">
            {`<div data-thread-embed="thread" data-organiser="${organiser.slug}"\n     data-thread="your-thread-slug" data-lang="nl"></div>`}
          </pre>
          <p className="mt-2 text-xs text-ink-subtle leading-relaxed">
            {t(locale, 'embeds_popup_note')}
          </p>
        </section>
        <section>
          <SectionLabel>Styling (CSS)</SectionLabel>
          <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
            Embeds render inside iframes — your site&apos;s CSS styles the <em>frame</em>, the
            inside stays Fibre (always light, on the cream canvas). Wrap the embed div in a
            container with a class and style that. In Webflow: put the snippet in an Embed
            element inside a styled Div Block, or add this to the page&apos;s custom code:
          </p>
          <pre className="mt-2 rounded-lg border border-line bg-surface-raised p-4 text-xs overflow-x-auto font-mono leading-relaxed">
{`.thread-embed-wrap {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 16px;
  overflow: hidden;            /* clips the iframe to the radius */
  box-shadow: 0 8px 30px rgba(0,0,0,.08);
}`}
          </pre>
          <p className="mt-2 text-xs text-ink-subtle leading-relaxed">
            For full design freedom, build the page natively in Webflow and embed only the
            transactional piece: <code className="font-mono">data-elements=&quot;enrol&quot;</code>{' '}
            renders just the enrol card, and the popup variant (snippet 4) turns any
            Webflow-styled button into the trigger — our UI only appears as the overlay.
          </p>
          <p className="mt-4 text-xs text-ink-subtle leading-relaxed">
            <strong>Styling the inside:</strong> every element in the embeds carries a stable{' '}
            <code className="font-mono">te-*</code> class. Put a{' '}
            <code className="font-mono">&lt;style&gt;</code> block <em>inside</em> the embed
            element and it is lifted into the embed (and its popup) — it never touches the rest
            of your page. This is the complete element list with the default look; change the
            values:
          </p>
          <pre className="mt-2 rounded-lg border border-line bg-surface-raised p-4 text-xs overflow-x-auto font-mono leading-relaxed">
            {`<div data-thread-embed="thread" data-organiser="${organiser.slug}" data-thread="your-thread-slug">
  <style>
${DEFAULT_EMBED_CSS.split('\n').map((l) => (l ? '    ' + l : l)).join('\n')}  </style>
</div>`}
          </pre>
        </section>

        <EmbedGenerator
          locale={locale}
          organiserSlug={organiser.slug}
          workspaceId={organiser.workspace_id}
          categories={categoriesRes.items}
          threads={generatorThreads}
          teams={generatorTeams}
        />

        <p className="text-xs text-ink-muted">
          Team threads live under the team&apos;s slug — use it as data-organiser. Enrolments made
          through embeds flow into Fibre exactly like the public page (consents, contacts,
          activity).
        </p>
      </div>
    </PageContainer>
  );
}
