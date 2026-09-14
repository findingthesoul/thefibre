// Connections' binding of the shared API client. The fetch, ApiError and
// errorMessage live in @thefibre/shared/api-fetch (one copy since 2026-09-14);
// this file only supplies what Connections alone knows: its app id and its
// session. It identifies itself as 'fibre-sales' — the slug never changes,
// only the display name did.
import { createApiFetch } from '@thefibre/shared/api-fetch';
import { serverSupabase } from './supabase/server';

export { ApiError, errorMessage } from '@thefibre/shared/api-fetch';

export const apiFetch = createApiFetch({
  appId: 'fibre-sales',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    (await serverSupabase()).auth.getSession().then((r) => r.data.session?.access_token),
});
