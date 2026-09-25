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
        tags?: { id: string; name: string }[];
        locations?: { name: string; people: number }[];
      }>(`/api/v1/connections/entries/targets?q=${encodeURIComponent(query)}`);
      return [
        // Tags and places too. Sjoerd, 2026-09-14: "why can I only search for
        // a person or an org and not on other things like tags or location?"
        ...(r.tags ?? []).map((tg) => ({
          value: `tag:${tg.id}`,
          label: `#${tg.name}`,
          kind: 'tag' as const,
          hint: null,
        })),
        ...(r.locations ?? []).map((l) => ({
          value: `loc:${encodeURIComponent(l.name)}`,
          label: l.name,
          kind: 'location' as const,
          hint: null,
        })),
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
    } catch (e) {
      // THROW, do not return []. The comment that used to sit here said an
      // empty list "reads as nothing matched, which is the same shape of
      // answer" — it is the same shape and the opposite meaning, and that is
      // the bug rather than the justification for it.
      //
      // SearchSelect handles a rejected search properly since 2026-09-23: it
      // keeps the last good results, says it could not look, and WITHHOLDS
      // the create row — which matters here for the same reason it mattered
      // there, because "nothing matched" beside "add what you typed" invites
      // somebody to create a person who already exists.
      //
      // Found by the stress-test session's silent-empty sweep, one of
      // thirteen. It reached production because every happy-path check
      // passes: a failing search and a search with no results are the same
      // screen.
      throw e;
    }
  }

  /** A chosen target → the paths to it, or the degrade. */
  async function findEntries(value: string): Promise<EntriesResult> {
    'use server';
    const at = value.indexOf(':');
    const kind = value.slice(0, at);
    // Location values are URI-encoded in the option value (a place can hold a colon).
    const id = kind === 'loc' ? decodeURIComponent(value.slice(at + 1)) : value.slice(at + 1);
    const param = { org: 'org_id', person: 'person_id', tag: 'tag_id', loc: 'location' }[kind] ?? 'person_id';
    try {
      return await apiFetch<EntriesResult>(
        `/api/v1/connections/entries?${param}=${encodeURIComponent(id ?? '')}&limit=50`,
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
