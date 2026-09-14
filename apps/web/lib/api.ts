// The Fibre web app's binding of the shared API client. The fetch, ApiError
// and errorMessage live in @thefibre/shared/api-fetch; this file supplies
// only what the platform knows — its app id and how it reads the session.

import { createApiFetch } from '@thefibre/shared/api-fetch';
import { serverSupabase } from './supabase/server';

export { ApiError, errorMessage } from '@thefibre/shared/api-fetch';

export const apiFetch = createApiFetch({
  appId: 'fibre-platform',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    (await serverSupabase()).auth.getSession().then((r) => r.data.session?.access_token),
});
