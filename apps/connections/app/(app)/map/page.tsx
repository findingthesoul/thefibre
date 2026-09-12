import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import type { MapPerson } from '@/lib/map-layout';
import { MapView } from './map-view';

// The desktop map (docs/connections-desktop.md). The server fetches facts;
// placement happens in the browser (lib/map-layout.ts), because it is a pure
// function and must not cost a round trip per change of focus.
//
// Desktop-first by design. A phone gets the same page with a sentence saying
// so, not a broken miniature: the landscape and the queue are the phone's
// surfaces (docs/connections-mobile.md §1).
export default async function MapPage() {
  const locale = (await uiLocale()) as Locale;

  let people: MapPerson[] = [];
  let error: string | null = null;
  try {
    people = (await apiFetch<{ people: MapPerson[] }>('/api/v1/connections/map')).people ?? [];
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_map')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'map_intro')}</p>
      <p className="mt-2 text-xs text-ink-subtle lg:hidden">{t(locale, 'map_desktop_note')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!error && people.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted">{t(locale, 'map_empty')}</p>
      )}
      {!error && people.length > 0 && (
        <MapView people={people} now={Date.now()} locale={locale} />
      )}
    </PageContainer>
  );
}
