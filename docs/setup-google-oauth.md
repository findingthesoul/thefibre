# Google OAuth setup

This is the one step that requires clicking around in Google Cloud and Supabase — there's no CLI for it. ~10 minutes.

## 1. Create the Google Cloud OAuth client

1. Open https://console.cloud.google.com — create a new project called **"The Fibre"** (or reuse one).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: **The Fibre**
   - User support email: your email
   - Developer contact: your email
   - Authorized domains: `thefibre.app`, `supabase.co`
   - Scopes: leave defaults (`email`, `profile`, `openid`)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: **The Fibre — Supabase**
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://thefibre.app`
     - `https://suite.thefibre.app`
     - `https://thread.thefibre.app`
     - `https://sales.thefibre.app`
     - `https://zfsyyokepyycefbxiblc.supabase.co`
   - **Authorized redirect URIs:**
     - `https://zfsyyokepyycefbxiblc.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback`
4. Click **Create**. Copy the **Client ID** and **Client secret**.

## 2. Wire it into Supabase

1. Open https://supabase.com/dashboard/project/zfsyyokepyycefbxiblc/auth/providers
2. Find **Google**, toggle it on.
3. Paste **Client ID** and **Client secret**.
4. Leave **Skip nonce check** off.
5. Save.

## 3. Configure redirect URLs in Supabase

1. https://supabase.com/dashboard/project/zfsyyokepyycefbxiblc/auth/url-configuration
2. **Site URL:** `https://thefibre.app` (for prod; use `http://localhost:3000` during local dev)
3. **Redirect URLs** (add each):
   - `http://localhost:3000/**`
   - `https://thefibre.app/**`
   - `https://*.thefibre.app/**`

## 4. Test

Once we wire the sign-in button on the landing page (next task in the implementation plan), clicking "Sign in with Google" will:

1. Redirect to Google
2. Google redirects back to Supabase `/auth/v1/callback`
3. Supabase exchanges the code, creates a Supabase Auth user
4. Supabase redirects to your app's `/auth/callback`
5. Your callback calls the API `POST /api/v1/sso/resolve` which runs `resolve_sso_identity()` — see [`migrations/20260512130000_phase0_sso_match.sql`](../supabase/migrations/20260512130000_phase0_sso_match.sql)
6. The platform now has matched (or created) a `user` + `person` row tied to this Google identity

## What to do later

- **Microsoft / LinkedIn:** same flow. No schema change — `user_identity_provider` already supports any provider.
- **Hosted domain (`hd`) auto-suggest:** when a user signs in with a Google Workspace email, the `hd` claim is in `provider_metadata`. We use this to suggest org links — see brief §7.
- **Verify the OAuth consent screen** before going to production (Google requires verification once you have >100 users).
