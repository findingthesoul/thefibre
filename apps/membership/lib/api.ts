// Membership's binding of the shared API client. The fetch, ApiError and
// errorMessage live in @thefibre/shared/api-fetch (one copy since 2026-09-14);
// this file only supplies what Membership alone knows: its app id and its session.
import { createApiFetch } from '@thefibre/shared/api-fetch';
import { serverSupabase } from './supabase/server';

export { ApiError, errorMessage } from '@thefibre/shared/api-fetch';

export const apiFetch = createApiFetch({
  appId: 'membership',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    (await serverSupabase()).auth.getSession().then((r) => r.data.session?.access_token),
});
