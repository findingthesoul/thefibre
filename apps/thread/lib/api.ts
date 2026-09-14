// Thread's binding of the shared API client. The fetch, ApiError and
// errorMessage live in @thefibre/shared/api-fetch; this file only supplies
// what the shared code cannot know — the app id and how to read the session.
import { createApiFetch } from '@thefibre/shared/api-fetch';
import { serverSupabase } from './supabase/server';

export { ApiError, errorMessage } from '@thefibre/shared/api-fetch';

export const apiFetch = createApiFetch({
  appId: 'the-thread',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    (await serverSupabase()).auth.getSession().then((r) => r.data.session?.access_token),
});
