// Where a user-level connection flow (Zoom, and Google by the same shape)
// sends the browser back to. Connections are a user SPoT surfaced in more than
// one app, so the app that STARTED the flow rides in the signed state as
// `return_to` and the callback returns there.

import { appUrl } from '@thefibre/shared';

export type ConnectionsReturnTo = 'meet' | 'thread' | 'fibre';

/** The `?return=` an auth-start accepts. Anything unknown is Meet — the
 *  original home of the flow — rather than an error, so an old client keeps
 *  working. */
export function parseReturnTo(q: string | null | undefined): ConnectionsReturnTo {
  return q === 'thread' || q === 'fibre' ? q : 'meet';
}

/** The settings page in the app that started the flow. `return_to` comes out
 *  of a verified JWT, but is still treated as untrusted: anything that is not
 *  exactly 'thread' or 'fibre' lands on Meet's integrations page. */
export function connectionsSettingsUrl(
  returnTo: unknown,
  env: Record<string, string | undefined>,
): string {
  if (returnTo === 'fibre') return `${appUrl('fibre-platform', env)}/settings/connections`;
  if (returnTo === 'thread') return `${appUrl('the-thread', env)}/settings/connections`;
  return `${appUrl('fibre-meet', env)}/settings/integrations`;
}
