'use client';

import { useRouter } from 'next/navigation';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { t, type Locale } from '@/lib/i18n-ui';
import { startTeamsAuth, disconnectTeams } from '../actions';

// Microsoft Teams in Meet — the same shared card as Zoom beside it.
//
// Inert until the secrets exist: with no TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET
// on the server, `configured` is false and Connect is disabled with the reason
// in words, never a button that fails when pressed.
export function TeamsConnect({
  connected,
  accountEmail,
  configured,
  statusParam,
  reasonParam,
  locale,
}: {
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no Teams app credentials — connecting can't work. */
  configured: boolean;
  statusParam: string | null;
  reasonParam: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <ProviderConnectionCard
      name="Microsoft Teams"
      connected={connected}
      accountEmail={accountEmail}
      configured={configured}
      statusParam={statusParam}
      reasonParam={reasonParam}
      labels={{
        description: t(locale, 'ms_teams_desc'),
        account: (email) => t(locale, 'ms_teams_account', { email }),
        connectedMessage: t(locale, 'ms_teams_connected_msg'),
        errorMessage: (reason) => t(locale, 'ms_teams_error_msg', { reason }),
        notConfigured: t(locale, 'ms_teams_not_configured'),
        startFailed: t(locale, 'ms_teams_start_failed'),
        connect: t(locale, 'connect_ms_teams'),
        disconnect: t(locale, 'disconnect'),
        working: t(locale, 'redirecting'),
      }}
      onStart={startTeamsAuth}
      onDisconnect={async () => {
        const r = await disconnectTeams();
        return { ok: !!r.ok, error: r.error };
      }}
      onDisconnected={() => router.refresh()}
    />
  );
}
