import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { CurrenciesClient } from './currencies-client';
import type { EcbRates } from '@thefibre/shared/ui/currency-editor';

export const dynamic = 'force-dynamic';

// Workspace currency SPoT, edited HERE (platform-wide setting — Sjoerd,
// 2026-09-05). Apps link to this page via the settings canon; their pickers
// read the same /api/v1/workspace values.
export default async function CurrenciesPage() {
  const [ws, rates] = await Promise.all([
    apiFetch<{ default_currency?: string; currencies?: string[]; editable?: boolean }>(
      '/api/v1/workspace',
    ).catch(() => null),
    apiFetch<EcbRates>('/api/v1/currencies/rates').catch(() => null),
  ]);

  return (
    <PageContainer max="3xl">
      <PageHeader
        title="Currencies"
        description="Which currencies this workspace sells in — one list for everything priced, in every app."
      />
      <div className="mt-8">
        {ws?.editable === false ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            Workspace admins only.
          </p>
        ) : (
          <CurrenciesClient
            defaultCurrency={ws?.default_currency ?? 'EUR'}
            currencies={ws?.currencies?.length ? ws.currencies : ['EUR']}
            rates={rates}
          />
        )}
      </div>
    </PageContainer>
  );
}
