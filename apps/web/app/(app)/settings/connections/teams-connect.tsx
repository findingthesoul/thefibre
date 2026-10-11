'use client';

import { useRouter } from 'next/navigation';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { t, type Locale } from '@/lib/i18n-ui';
import { startTeamsAuth, disconnectTeams } from './actions';

// The shared provider card with this app's strings and server actions
// injected — the same shape as ZoomConnect beside it.
//
// Microsoft Teams had a complete backend and no UI anywhere: the connection
// columns, the token refresh with Microsoft's rotation handling, the meeting
// creation and the OAuth routes all existed, `teams` was already in
// `MintableProvider`, and `/api/v1/meet/connections` already reported
// `teams_connected` / `teams_account_email` / `teams_configured`. There was
// simply no card, so nobody could connect an account and the whole path was
// dark. This is the card.
//
// Dark until the secrets exist: with no TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET
// on the server, `configured` is false and Connect is disabled with the
// reason in words — never a button that fails when pressed.
export function TeamsConnect({
  locale,
  connected,
  accountEmail,
  configured,
  statusParam,
  reasonParam,
}: {
  locale: Locale;
  connected: boolean;
  accountEmail: string | null;
  configured: boolean;
  statusParam: string | null;
  reasonParam: string | null;
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
        description: t(locale, 'teams_desc'),
        account: (email) => t(locale, 'teams_account', { email }),
        connectedMessage: t(locale, 'teams_connected_msg'),
        errorMessage: (reason) => t(locale, 'teams_error_msg', { reason }),
        notConfigured: t(locale, 'teams_not_configured'),
        startFailed: t(locale, 'teams_start_failed'),
        connect: t(locale, 'connect_teams'),
        disconnect: t(locale, 'disconnect'),
        working: t(locale, 'working'),
      }}
      onStart={startTeamsAuth}
      onDisconnect={disconnectTeams}
      onDisconnected={() => router.refresh()}
    />
  );
}
