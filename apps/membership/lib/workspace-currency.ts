// Workspace-level currency SPoT (2026-09-04): the platform's /workspace
// endpoint owns which currencies this workspace sells in. Read-only here;
// the Settings currency card writes it back through the same endpoint.
import { apiFetch } from '@/lib/api';

export type WorkspaceCurrencies = { default_currency: string; currencies: string[] };

export async function workspaceCurrencies(): Promise<WorkspaceCurrencies> {
  try {
    const r = await apiFetch<{ default_currency?: string; currencies?: string[] }>(
      '/api/v1/workspace',
    );
    return {
      default_currency: r.default_currency ?? 'EUR',
      currencies: r.currencies?.length ? r.currencies : ['EUR'],
    };
  } catch {
    return { default_currency: 'EUR', currencies: ['EUR'] };
  }
}
