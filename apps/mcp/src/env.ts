// Where the server's credentials come from, and the one guard that matters.
//
// Phase 1 of docs/ai-assistance-plan.md runs LOCALLY, for ONE seat, against
// STAGING. Every one of those three words is enforced here rather than
// remembered:
//
//   locally   — this file reads a `.env` file on disk, the same one
//               apps/api/scripts already use (`apps/api/.env.staging`). There
//               is no deploy target and no way to run this without a machine
//               that already holds those files.
//   one seat  — FIBRE_USER_EMAIL names the person the assistant acts as. The
//               session is minted for that address and nothing else.
//   staging   — the Supabase project ref is checked against the staging
//               project. Pointing at production is refused unless
//               FIBRE_MCP_ALLOW_PRODUCTION=1 is set on purpose, in the shell,
//               where the person can see themselves doing it.
//
// Two ways to authenticate, both as a real user (never an app key — see the
// README for why):
//
//   FIBRE_JWT           a Supabase access token pasted from a signed-in
//                       browser. Lasts an hour. Nothing else is needed.
//   (service role)      NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
//                       + SUPABASE_SERVICE_ROLE_KEY + FIBRE_USER_EMAIL: the
//                       server mints a session for that user the same way
//                       apps/api/scripts/verify-external-app.mjs does, and
//                       re-mints when it expires. The service key is used for
//                       exactly that and never for a data read.
//
// Values already in the process win over the file, as in scripts/lib/env.mjs.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The staging Supabase project. Same literal as apps/api/src/integration/staging.ts. */
export const STAGING_PROJECT_REF = 'lukhyylwhhjyihqtghvw';

export const DEFAULT_API = 'https://thefibre-api-staging.fly.dev';

/** The X-App-ID this server announces. The platform itself: always active,
 *  never something a workspace can switch off. */
export const DEFAULT_APP_ID = 'fibre-platform';

export type Credentials =
  | { mode: 'jwt'; jwt: string }
  | {
      mode: 'mint';
      supabaseUrl: string;
      anonKey: string;
      serviceKey: string;
      userEmail: string;
    };

export type Config = {
  api: string;
  appId: string;
  credentials: Credentials;
  /** Which file the values came from, so the server can say so at startup. */
  envFile: string | null;
};

/** Parse the `.env` grammar apps/api/scripts/lib/env.mjs documents: split at
 *  the first `=`, drop surrounding double quotes, ignore blanks and `#`. */
export function parseEnvFile(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')];
      }),
  );
}

/** `https://abcd.supabase.co` → `abcd`. */
export function projectRefOf(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] ?? url;
  } catch {
    return url;
  }
}

/**
 * The guard. Returns null when the target is acceptable, or the sentence to
 * refuse with. Pure, so the refusal is tested rather than trusted.
 */
export function refuseNonStaging(
  supabaseUrl: string | undefined,
  allowProduction: boolean,
): string | null {
  if (!supabaseUrl) return null; // nothing to judge; the JWT path may not carry a URL
  const ref = projectRefOf(supabaseUrl);
  if (ref === STAGING_PROJECT_REF || allowProduction) return null;
  return (
    `Refusing to run against Supabase project "${ref}": it is not the staging project. ` +
    `Phase 1 runs against staging only. Set FIBRE_MCP_ALLOW_PRODUCTION=1 in the shell ` +
    `if you mean it.`
  );
}

/**
 * Resolve a config from a merged environment. Pure; `readConfig()` below is
 * the one that touches the disk.
 */
export function resolveConfig(
  env: Record<string, string | undefined>,
  envFile: string | null,
): Config {
  const api = (env.FIBRE_API ?? DEFAULT_API).replace(/\/+$/, '');
  const appId = env.FIBRE_APP_ID ?? DEFAULT_APP_ID;

  const refusal = refuseNonStaging(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.FIBRE_MCP_ALLOW_PRODUCTION === '1',
  );
  if (refusal) throw new Error(refusal);

  if (env.FIBRE_JWT) {
    return { api, appId, envFile, credentials: { mode: 'jwt', jwt: env.FIBRE_JWT } };
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const userEmail = env.FIBRE_USER_EMAIL;
  const missing = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !userEmail && 'FIBRE_USER_EMAIL',
  ].filter((x): x is string => typeof x === 'string');
  if (missing.length) {
    throw new Error(
      `Cannot authenticate. Either set FIBRE_JWT (a token from a signed-in browser), ` +
        `or provide ${missing.join(', ')}` +
        (envFile ? ` (looked in ${envFile})` : '') +
        `. See apps/mcp/README.md.`,
    );
  }
  return {
    api,
    appId,
    envFile,
    credentials: {
      mode: 'mint',
      supabaseUrl: supabaseUrl!,
      anonKey: anonKey!,
      serviceKey: serviceKey!,
      userEmail: userEmail!,
    },
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
/** apps/mcp/{src,dist} → the repo root. */
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/**
 * Read the config the way a person runs it: `FIBRE_ENV_FILE` names a file
 * (relative to apps/api, like the API's own scripts), default `.env.staging`.
 * A missing file is not an error by itself — everything may be in the shell.
 */
export function readConfig(processEnv: NodeJS.ProcessEnv = process.env): Config {
  const name = processEnv.FIBRE_ENV_FILE ?? '.env.staging';
  const file = resolve(REPO_ROOT, 'apps', 'api', name);
  let fromFile: Record<string, string> = {};
  let envFile: string | null = null;
  try {
    fromFile = parseEnvFile(readFileSync(file, 'utf-8'));
    envFile = file;
  } catch {
    // fall through: the shell may carry everything
  }
  const merged: Record<string, string | undefined> = { ...fromFile };
  for (const [k, v] of Object.entries(processEnv)) {
    if (v !== undefined && v !== '') merged[k] = v;
  }
  return resolveConfig(merged, envFile);
}
