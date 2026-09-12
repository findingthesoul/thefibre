import { PageContainer, PageHeader } from '@thefibre/shared/ui/page';
import { appUrl } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { EntriesClient, type EntriesResult, type TargetOption } from './client';

// Entries — who can get us in. docs/connections-model.md §3.6.
//
// The page holds no state and fetches nothing on load: there is no useful
// "all entries" list, because an entry is only an answer to a question
// somebody asked ("can we reach Acme?"). So the surface is a search box, and
// the two server actions below are the app-bound half — apiFetch cannot run
// in the browser, so it is injected into the client component as props
// (CLAUDE.md, "Components first": shared pieces take the app-bound bits in).

export default async function EntriesPage() {
  const locale = (await uiLocale()) as Locale;

  /** Search box → people and organisations this workspace can see. */
  async function searchTargets(q: string): Promise<TargetOption[]> {
    'use server';
    const query = q.trim();
    if (query.length < 2) return [];
    try {
      const r = await apiFetch<{
        organisations: { id: string; name: string; sector: string | null; country: string | null }[];
        people: { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
      }>(`/api/v1/connections/entries/targets?q=${encodeURIComponent(query)}`);
      return [
        ...r.organisations.map((o) => ({
          value: `org:${o.id}`,
          label: o.name,
          kind: 'organisation' as const,
          hint: o.sector ?? o.country ?? null,
        })),
        ...r.people.map((p) => ({
          value: `person:${p.id}`,
          label:
            [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
            p.email ||
            p.id.slice(0, 8),
          kind: 'person' as const,
          hint: p.email,
        })),
      ];
    } catch {
      // A failed lookup must not blow up the search field — an empty list
      // reads as "nothing matched", which is the same shape of answer.
      return [];
    }
  }

  /** A chosen target → the paths to it, or the degrade. */
  async function findEntries(value: string): Promise<EntriesResult> {
    'use server';
    const [kind, id] = value.split(':');
    const param = kind === 'org' ? 'org_id' : 'person_id';
    try {
      return await apiFetch<EntriesResult>(
        `/api/v1/connections/entries?${param}=${encodeURIComponent(id)}&limit=50`,
      );
    } catch (e) {
      return {
        target: null,
        items: [],
        related: [],
        error: e instanceof ApiError ? `API ${e.status}` : 'unknown error',
      };
    }
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_entries')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'entries_intro')}</p>
      <EntriesClient
        locale={locale}
        // Resolved on the server: appUrl reads an env var the browser bundle
        // has no business carrying a whole process.env for.
        contactsBase={appUrl('fibre-platform', process.env)}
        searchTargets={searchTargets}
        findEntries={findEntries}
      />
    </PageContainer>
  );
}
