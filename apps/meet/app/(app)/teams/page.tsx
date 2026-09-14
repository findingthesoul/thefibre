import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { ButtonLink } from '@/components/ui/button';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { MEET_HOST } from '@/lib/public-host';
import { CopyLinkButton, OpenBookingLink } from '@/components/copy-link-button';

type Team = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  my_role: 'lead' | 'member';
};

export default async function TeamsPage() {
  const locale = await uiLocale();
  let items: Team[] = [];
  let error: string | null = null;

  try {
    const r = await apiFetch<{ items: Team[] }>('/api/v1/meet/teams');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'teams_title')}
        description={t(locale, 'teams_desc')}
        actions={<ButtonLink href="/teams/new">{t(locale, 'new_team')}</ButtonLink>}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>{t(locale, 'your_teams')}</SectionLabel>
        {items.length === 0 ? (
          <EmptyState>{t(locale, 'teams_empty')}</EmptyState>
        ) : (
          <ListGroup>
            {items.map((tm) => (
              <ListRow
                key={tm.id}
                href={`/teams/${tm.id}`}
                primary={tm.name}
                secondary={`${MEET_HOST}/${tm.slug}`}
                meta={
                  <>
                    {!tm.is_active && (
                      <span className="uppercase tracking-wider text-ink-muted">
                        {t(locale, 'hidden')}
                      </span>
                    )}
                    <span className="uppercase tracking-wider text-ink-muted">
                      {tm.my_role === 'lead' ? t(locale, 'role_lead') : t(locale, 'role_member')}
                    </span>
                    {/* The team's public landing page, one click from the list
                        (Sjoerd, 2026-09-14). */}
                    <CopyLinkButton
                      url={`/${tm.slug}`}
                      label={t(locale, 'copy_link')}
                      copiedLabel={t(locale, 'copied')}
                    />
                    <OpenBookingLink href={`/${tm.slug}`} label={t(locale, 'open_booking_page')} />
                  </>
                }
              />
            ))}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}
