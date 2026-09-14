'use client';

// Thread's binding of the shared browser uploader (@thefibre/shared/upload):
// this file only supplies the route, the app id and how the browser client
// reads the session.

import { createAssetUploader } from '@thefibre/shared/upload';
import { browserSupabase } from './supabase/client';

export const uploadAsset = createAssetUploader({
  appId: 'the-thread',
  path: '/api/v1/thread/uploads',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    browserSupabase()
      .auth.getSession()
      .then((r) => r.data.session?.access_token),
});
