// Website embeds — the copy-paste snippets for Webflow (or any site).
// The embed system shipped in 3.10.0; this page makes it discoverable
// (Sjoerd 2026-07-02: "the webflow integrations" looked missing — they
// weren't, they were invisible).

import { apiFetch } from '@/lib/api';
import { one, type OrganiserRow, type ThreadRow, type TeamOption } from '@/lib/thread-types';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel } from '@/components/ui/page';
import { EmbedGenerator, type GeneratorThread, type GeneratorTeam } from './embed-generator';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

export default async function EmbedsSettingsPage() {
  const [organiser, threadsRes, teamsRes] = await Promise.all([
    apiFetch<OrganiserRow>('/api/v1/thread/me'),
    apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads').catch(() => ({
      items: [] as ThreadRow[],
    })),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
      items: [] as TeamOption[],
    })),
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
      title: '1 · Load the script once',
      desc: 'Paste in your site’s <head> (Webflow: Site settings → Custom code).',
      code: `<script src="${HOST}/embed.js" defer></script>`,
    },
    {
      title: '2 · Overview of your threads',
      desc: 'Lists your public threads. Swap data-organiser for data-team="<team-uuid>", data-org="<org-uuid>" or data-workspace="<workspace-uuid>" (everyone\u2019s public threads).',
      code: `<div data-thread-embed="list" data-organiser="${organiser.slug}"></div>`,
    },
    {
      title: '3 · One thread, chosen elements',
      desc: 'Pick the sections: cover, intention, agenda, price, enrol.',
      code: `<div data-thread-embed="thread" data-organiser="${organiser.slug}"\n     data-thread="your-thread-slug" data-elements="cover,intention,enrol"></div>`,
    },
    {
      title: '4 · Enrolment popup from any button',
      desc: 'Opens the subscription form in an overlay — Luma style.',
      code: `<a href="#" data-thread-embed="enrol" data-organiser="${organiser.slug}"\n   data-thread="your-thread-slug">Enrol now</a>`,
    },
  ];

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Website embeds"
        description="Show your threads and take enrolments on any website — auto-sizing, no code beyond copy-paste."
      />
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
          <SectionLabel>Language (data-lang)</SectionLabel>
          <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
            Add <code className="font-mono">data-lang</code> to any embed to force the language
            of the embedded UI (labels, buttons, enrol form). Supported:{' '}
            {LOCALES.map((l, i) => (
              <span key={l}>
                {i > 0 && ', '}
                <code className="font-mono">{l}</code> ({LOCALE_LABELS[l]})
              </span>
            ))}
            . Without it, the thread embed and the enrol popup use the thread&apos;s own
            language; the list falls back to English for its chrome while each item&apos;s
            button and popup still follow that thread&apos;s language.
          </p>
          <pre className="mt-2 rounded-lg border border-line bg-surface-raised p-4 text-xs overflow-x-auto font-mono leading-relaxed">
            {`<div data-thread-embed="thread" data-organiser="${organiser.slug}"\n     data-thread="your-thread-slug" data-lang="nl"></div>`}
          </pre>
          <p className="mt-2 text-xs text-ink-subtle leading-relaxed">
            In the embedded list, threads whose public interaction is set to
            &ldquo;popup&rdquo; open the enrolment overlay right on your site; threads set to
            &ldquo;page&rdquo; link out to their public page.
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
        </section>

        <EmbedGenerator
          organiserSlug={organiser.slug}
          workspaceId={organiser.workspace_id}
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
