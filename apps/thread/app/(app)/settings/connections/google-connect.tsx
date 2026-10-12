'use client';

// The shared provider card with Google's strings and server actions injected
// — the same arrangement the Zoom card beside it already uses.
//
// This was one of three hand-written copies (Meet, Thread, The Fibre) that
// predated `ProviderConnectionCard`. They differed only in import paths and
// i18n key names, which is what `labels` is for. v1.153.2 made the point:
// the stacking fix went into the shared card and the Google card on the same
// screen still crushed its text, because it was not that component.
//
// No `accountEmail` (the connection is a yes/no) and no `configured` gate
// (Google is configured wherever these apps run), both expressed by passing
// nothing rather than inventing strings nobody reads.

import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { t } from '@/lib/i18n-ui';
import { startGoogleAuth, disconnectGoogle } from '../actions';

export function GoogleConnect({
  locale,
  connected,
  statusParam,
  reasonParam,
}: {
  locale: Locale;
  connected: boolean;
  statusParam: string | null;
  reasonParam: string | null;
}) {
  const router = useRouter();
  return (
    <ProviderConnectionCard
      name={t(locale, 'google_calendar')}
      connected={connected}
      accountEmail={null}
      configured
      statusParam={statusParam}
      reasonParam={reasonParam}
      labels={{
        description: t(locale, 'google_connect_desc'),
        // Both null, and stated rather than omitted: Google's connection is a
        // yes/no that never reports which account was linked, and Google is
        // configured wherever these apps run. The fields are required so that
        // a future card cannot forget them and silently render nothing where
        // a sentence belonged.
        account: null,
        notConfigured: null,
        connectedMessage: t(locale, 'google_connected_msg'),
        // This app's key already takes the reason as a parameter, so the
        // suffix goes straight through instead of being concatenated here.
        errorMessage: (reasonSuffix) => t(locale, 'google_connect_failed', { reason: reasonSuffix }),
        startFailed: t(locale, 'google_connect_start_failed'),
        connect: t(locale, 'connect_google'),
        disconnect: t(locale, 'disconnect'),
        working: t(locale, 'working'),
      }}
      onStart={startGoogleAuth}
      onDisconnect={disconnectGoogle}
      onDisconnected={() => router.refresh()}
    />
  );
}
