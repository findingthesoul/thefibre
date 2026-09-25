import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { GoogleConnect } from './google-connect';
import { PersonalRoomForm } from './personal-room';
import { AssistantsConnected, type AssistantGrant } from './assistants';
import { ThreadPromptCard } from './thread-prompt';

// Connections are a user-level SPoT: one Google Calendar link + one personal
// meeting room per person, shared across the Fibre apps. The data lives
// behind /api/v1/meet/connections; this page manages the same row Meet's
// Settings → Connections does.

type Connections = {
  google_connected: boolean;
  personal_room_url: string | null;
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const { google: googleStatus, reason } = await searchParams;
  const locale = await uiLocale();
  let conn: Connections | null = null;
  let grants: AssistantGrant[] = [];
  let error: string | null = null;
  try {
    [conn, grants] = await Promise.all([
      apiFetch<Connections>('/api/v1/meet/connections'),
      apiFetch<{ items: AssistantGrant[] }>('/api/v1/mcp-auth/grants').then((r) => r.items),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'connections_title')}
        description={t(locale, 'connections_blurb')}
      />
      {error && <ErrorBanner>{t(locale, 'load_failed')} {error}</ErrorBanner>}
      {conn && (
        <>
          <section className="mt-10">
            <SectionLabel>{t(locale, 'calendars')}</SectionLabel>
            <div className="mt-4">
              <GoogleConnect
                connected={conn.google_connected}
                statusParam={googleStatus ?? null}
                reasonParam={reason ?? null}
                locale={locale}
              />
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>{t(locale, 'personal_room')}</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              {t(locale, 'personal_room_blurb')}
            </p>
            <div className="mt-4">
              <PersonalRoomForm initial={conn.personal_room_url ?? ''} locale={locale} />
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>{t(locale, 'assistants_title')}</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">{t(locale, 'assistants_blurb')}</p>
            <div className="mt-4">
              <AssistantsConnected grants={grants} locale={locale} />
            </div>
            {/* What a connected assistant is actually FOR. Shown whether or
                not a grant exists: somebody deciding whether to connect one
                is exactly the person who needs to see what it would do. */}
            <div className="mt-4">
              <ThreadPromptCard locale={locale} />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
