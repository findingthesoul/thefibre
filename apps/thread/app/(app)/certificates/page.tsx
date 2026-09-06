import Link from 'next/link';
import { Award } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { TeamOption } from '@/lib/thread-types';
import {
  PAGE_SIZE_LABELS,
  type CertScope,
  type CertTemplate,
} from '@/lib/certificate-types';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewTemplateDialog } from './new-template-dialog';

const SCOPE_STYLES: Record<CertScope, string> = {
  personal: 'bg-surface-sunken text-ink-subtle ring-line',
  team: 'bg-sky-50 text-sky-700 ring-sky-200',
  workspace: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

function scopeLabel(locale: Locale, scope: CertScope): string {
  return scope === 'personal'
    ? t(locale, 'personal')
    : scope === 'team'
      ? t(locale, 'team')
      : t(locale, 'workspace');
}

function fmtDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default async function CertificatesPage() {
  const locale = await uiLocale();
  let templates: CertTemplate[] = [];
  let error: string | null = null;
  let teams: TeamOption[] = [];
  try {
    const [t, tm] = await Promise.all([
      apiFetch<{ items: CertTemplate[] }>('/api/v1/thread/certificate-templates'),
      apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
        items: [] as TeamOption[],
      })),
    ]);
    templates = t.items;
    teams = tm.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'certificates')}
        description={t(locale, 'certificates_desc')}
        actions={<NewTemplateDialog locale={locale} teams={teams} />}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!error && templates.length === 0 && <EmptyState>{t(locale, 'cert_empty')}</EmptyState>}

      {templates.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {[...templates]
            .sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at))
            .map((tpl) => (
            <li key={tpl.id}>
              <Link
                href={`/certificates/${tpl.id}`}
                className={`flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors ${
                  tpl.archived_at ? 'opacity-55' : ''
                }`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                  <Award size={17} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">{tpl.name}</span>
                    {tpl.archived_at && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-muted shrink-0">
                        {t(locale, 'status_archived')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-subtle mt-0.5">
                    {PAGE_SIZE_LABELS[tpl.page_size] ?? tpl.page_size} ·{' '}
                    <span>
                      {tpl.orientation === 'landscape'
                        ? t(locale, 'orientation_landscape')
                        : tpl.orientation === 'portrait'
                          ? t(locale, 'orientation_portrait')
                          : tpl.orientation}
                    </span>{' '}
                    · {t(locale, 'updated_on', { date: fmtDate(locale, tpl.updated_at) })}
                  </div>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                    SCOPE_STYLES[tpl.scope] ?? SCOPE_STYLES.personal
                  }`}
                >
                  {scopeLabel(locale, tpl.scope)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
