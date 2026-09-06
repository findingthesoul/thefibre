import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

type Programme = {
  id: string;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  app: { slug: string; name: string } | null;
};

const FORMAT_LABEL: Record<string, UiKey> = {
  meeting: 'format_meeting',
  event: 'format_event',
  journey: 'format_journey',
  self_paced: 'format_self_paced',
  blended: 'format_blended',
};

const STATUS_LABEL: Record<string, UiKey> = {
  draft: 'status_draft',
  active: 'consent_active',
  completed: 'status_prog_completed',
  archived: 'status_archived',
};

export default async function ProgrammesPage() {
  const locale = await uiLocale();
  let items: Programme[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Programme[] }>('/api/v1/programs');
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'nav_programmes')}
        description={t(locale, 'help_programmes_blurb')}
        actions={
          <ButtonLink href="/programmes/new" leading={<Plus size={14} strokeWidth={2.25} />}>
            {t(locale, 'new_programme')}
          </ButtonLink>
        }
      />

      {error && <ErrorBanner>{t(locale, 'programmes_load_failed')} {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          {t(locale, 'no_programmes_yet')}{' '}
          <Link href="/programmes/new" className="underline">{t(locale, 'create_first_one')}</Link>.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ListGroup>
          {items.map((p) => {
            const dates = formatDateRange(p.starts_on, p.ends_on, locale);
            return (
              <ListRow
                key={p.id}
                href={`/programmes/${p.id}`}
                primary={p.title}
                secondary={
                  [
                    FORMAT_LABEL[p.format] ? t(locale, FORMAT_LABEL[p.format]!) : p.format,
                    p.app?.name,
                    dates,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
                meta={STATUS_LABEL[p.status] ? t(locale, STATUS_LABEL[p.status]!) : p.status}
              />
            );
          })}
        </ListGroup>
      )}
    </PageContainer>
  );
}

function formatDateRange(start: string | null, end: string | null, locale: Locale): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString(INTL_LOCALES[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `${t(locale, 'from')} ${fmt(start)}`;
  if (end) return `${t(locale, 'until')} ${fmt(end!)}`;
  return null;
}
