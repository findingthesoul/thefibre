// Meet's binding of the shared API client. The fetch, ApiError and
// errorMessage live in packages/shared/src/api-fetch.ts; this file only
// supplies what Meet alone knows: its app id and how it reads the session.

import { createApiFetch } from '@thefibre/shared/api-fetch';
import { serverSupabase } from './supabase/server';

export { ApiError, errorMessage } from '@thefibre/shared/api-fetch';

// Meet identifies itself to the Fibre API as 'fibre-meet'. RLS uses this
// (combined with the user's JWT) to gate the curator rows it can see.
export const apiFetch = createApiFetch({
  appId: 'fibre-meet',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    (await serverSupabase()).auth.getSession().then((r) => r.data.session?.access_token),
});
