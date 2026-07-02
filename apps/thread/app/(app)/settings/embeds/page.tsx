// Website embeds — the copy-paste snippets for Webflow (or any site).
// The embed system shipped in 3.10.0; this page makes it discoverable
// (Sjoerd 2026-07-02: "the webflow integrations" looked missing — they
// weren't, they were invisible).

import { apiFetch } from '@/lib/api';
import type { OrganiserRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel } from '@/components/ui/page';

const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

export default async function EmbedsSettingsPage() {
  const organiser = await apiFetch<OrganiserRow>('/api/v1/thread/me');

  const snippets: { title: string; desc: string; code: string }[] = [
    {
      title: '1 · Load the script once',
      desc: 'Paste in your site’s <head> (Webflow: Site settings → Custom code).',
      code: `<script src="${HOST}/embed.js" defer></script>`,
    },
    {
      title: '2 · Overview of your threads',
      desc: 'Lists your public threads. Swap data-organiser for data-team="<team-uuid>" or data-org="<org-uuid>" for a subset.',
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
        <p className="text-xs text-ink-muted">
          Team threads live under the team&apos;s slug — use it as data-organiser. Enrolments made
          through embeds flow into Fibre exactly like the public page (consents, contacts,
          activity).
        </p>
      </div>
    </PageContainer>
  );
}
