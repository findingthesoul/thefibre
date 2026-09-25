import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { CopyLinkButton, OpenBookingLink } from '@/components/copy-link-button';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { NewMeetingTypeMenu } from './new-menu';
import { MeetingTypesViewTabs } from './view-tabs';
import { MEET_HOST } from '@/lib/public-host';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

type MeetingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  conferencing_provider: string;
  is_active: boolean;
  archived_at: string | null;
  team_id: string | null;
  team:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

type Host = { slug: string };

export default async function MeetingTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const locale = await uiLocale();
  const view = (await searchParams).view === 'archived' ? 'archived' : 'active';
  let items: MeetingType[] = [];
  let host: Host | null = null;
  let teams: Team[] = [];
  let error: string | null = null;

  try {
    const [data, h, tm] = await Promise.all([
      apiFetch<{ items: MeetingType[] }>('/api/v1/meet/meeting-types'),
      apiFetch<Host>('/api/v1/meet/me'),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
    ]);
    items = data.items;
    host = h;
    teams = tm.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Archived types are out of the way, not gone: the Archived tab is the only
  // place they appear. "Active" here means "not archived" — a HIDDEN type is
  // still something you offer, just not publicly listed, so it stays.
  const visible = items.filter((m) => (view === 'archived' ? !!m.archived_at : !m.archived_at));
  const personal = visible.filter((m) => !m.team_id);
  const byTeam = new Map<string, { name: string; slug: string; items: MeetingType[] }>();
  for (const mt of visible) {
    if (!mt.team_id) continue;
    const tm = Array.isArray(mt.team) ? mt.team[0] : mt.team;
    if (!tm) continue;
    const bucket = byTeam.get(tm.id) ?? { name: tm.name, slug: tm.slug, items: [] };
    bucket.items.push(mt);
    byTeam.set(tm.id, bucket);
  }

  function renderList(prefix: string, list: MeetingType[], locale: Locale) {
    return (
      <ListGroup>
        {list.map((mt) => {
          // The public booking path. We store it as a path (not absolute
          // URL) so the icon buttons resolve it against window.location.
          const bookingPath = `/${prefix}/${mt.slug}`;
          return (
            <ListRow
              key={mt.id}
              href={`/meeting-types/${mt.id}`}
              primary={mt.name}
              secondary={`${MEET_HOST}${bookingPath}`}
              meta={
                <>
                  {mt.archived_at ? (
                    <span className="uppercase tracking-wider text-ink-muted">
                      {t(locale, 'archived')}
                    </span>
                  ) : (
                    !mt.is_active && (
                      <span className="uppercase tracking-wider text-ink-muted">
                        {t(locale, 'hidden')}
                      </span>
                    )
                  )}
                  <span>{mt.duration_minutes} min</span>
                </>
              }
              trailing={
                mt.is_active && (
                  <div className="flex items-center gap-1">
                    <CopyLinkButton
                      url={bookingPath}
                      label={t(locale, 'copy_booking_link')}
                      copiedLabel={t(locale, 'copied')}
                    />
                    <OpenBookingLink href={bookingPath} label={t(locale, 'open_booking_page')} />
                  </div>
                )
              }
            />
          );
        })}
      </ListGroup>
    );
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'mt_title')}
        description={t(locale, 'mt_desc')}
        actions={<NewMeetingTypeMenu teams={teams} locale={locale} />}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      <MeetingTypesViewTabs
        view={view}
        labels={{ active: t(locale, 'active'), archived: t(locale, 'archived') }}
      />

      <section className="mt-10">
        <SectionLabel>{t(locale, 'personal')}</SectionLabel>
        {personal.length === 0 ? (
          <EmptyState>
            {view === 'archived' ? t(locale, 'no_archived_mts') : t(locale, 'no_personal_mts')}
          </EmptyState>
        ) : (
          host && renderList(host.slug, personal, locale)
        )}
      </section>

      {Array.from(byTeam.entries()).map(([id, bucket]) => (
        <section key={id} className="mt-14">
          <SectionLabel>{bucket.name}</SectionLabel>
          {renderList(bucket.slug, bucket.items, locale)}
        </section>
      ))}
    </PageContainer>
  );
}
