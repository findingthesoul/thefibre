import Link from 'next/link';
import { Workflow } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { NewFlowButton } from './new-flow';
import { FavoriteStar } from './favorite-star';

export const metadata = { title: 'Flows — Flow' };

type FlowRow = {
  id: string;
  name: string;
  description: string | null;
  scope: 'personal' | 'team' | 'workspace';
  lifecycle: 'draft' | 'active' | 'closed' | 'archived';
  active_run_count: number;
  is_favorite: boolean;
  updated_at: string;
};

const LIFECYCLE_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-600',
  active: 'bg-emerald-50 text-emerald-600',
  closed: 'bg-slate-100 text-slate-500',
  archived: 'bg-slate-50 text-slate-400',
};

const SCOPE_KEY: Record<string, UiKey> = {
  personal: 'scope_personal',
  team: 'scope_team',
  workspace: 'scope_workspace',
};

const LIFECYCLE_KEY: Record<string, UiKey> = {
  draft: 'lifecycle_draft',
  active: 'lifecycle_active',
  closed: 'lifecycle_closed',
  archived: 'lifecycle_archived',
};

export default async function FlowsPage() {
  const locale = await uiLocale();
  let items: FlowRow[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: FlowRow[] }>('/api/v1/flow/flows');
    items = r.items;
  } catch {
    loadError = t(locale, 'load_flows_failed');
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t(locale, 'flows')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'flows_blurb')}</p>
        </div>
        <NewFlowButton locale={locale} />
      </div>

      {loadError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && items.length === 0 && <EmptyState locale={locale} />}

      {items.length > 0 && (
        <div className="mt-8 space-y-2">
          {items.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 shadow-card hover:shadow-card-hover transition-shadow pr-3"
            >
              <Link href={`/flows/${f.id}`} className="flex items-center gap-4 flex-1 min-w-0 px-4 py-4">
                <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Workflow size={18} strokeWidth={1.75} className="text-violet-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{f.name}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        LIFECYCLE_STYLE[f.lifecycle] ?? ''
                      }`}
                    >
                      {t(locale, LIFECYCLE_KEY[f.lifecycle] ?? 'lifecycle_draft')}
                    </span>
                  </div>
                  {f.description && (
                    <p className="mt-0.5 text-sm text-ink-subtle truncate">{f.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-ink-muted">{t(locale, SCOPE_KEY[f.scope] ?? 'scope_personal')}</div>
                  <div className="text-xs text-ink-subtle mt-0.5">{t(locale, 'n_active', { n: f.active_run_count })}</div>
                </div>
              </Link>
              <FavoriteStar flowId={f.id} initial={f.is_favorite} locale={locale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ locale }: { locale: Locale }) {
  return (
    <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-12 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-violet-50 flex items-center justify-center">
        <Workflow size={22} strokeWidth={1.5} className="text-violet-600" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{t(locale, 'no_flows_yet')}</h2>
      <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto leading-relaxed">
        {t(locale, 'no_flows_blurb')}
      </p>
      <div className="mt-5 flex justify-center">
        <NewFlowButton locale={locale} />
      </div>
    </div>
  );
}
