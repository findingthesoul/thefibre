'use client';

// The shared provider card with Google's strings and server actions injected
// — the same arrangement Zoom and Teams already use here.
//
// This was a hand-written copy that predated `ProviderConnectionCard`, one of
// three identical ones across Meet, Thread and The Fibre. They differed only
// in their import paths and their i18n key names, which is exactly what the
// card's `labels` prop is for. The giveaway was v1.153.2: the stacking fix
// went into the shared card, and the Google card beside it on the same screen
// still crushed its text, because it was not that component.
//
// Google needs no `accountEmail` (the connection is a yes/no — we never
// report which account) and no `configured` gate (it is configured wherever
// these apps run). Both are expressed by passing nothing, which the card
// supports rather than requiring invented strings.

import { useRouter } from 'next/navigation';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { startGoogleAuth, disconnectGoogle } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function GoogleConnect({
  connected,
  statusParam,
  reasonParam,
  locale,
}: {
  connected: boolean;
  statusParam: string | null;
  reasonParam: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <ProviderConnectionCard
      name="Google Calendar"
      connected={connected}
      accountEmail={null}
      configured
      statusParam={statusParam}
      reasonParam={reasonParam}
      labels={{
        description: t(locale, 'google_calendar_blurb'),
        // Both null, and stated rather than omitted: Google's connection is a
        // yes/no that never reports which account was linked, and Google is
        // configured wherever these apps run. The fields are required so that
        // a future card cannot forget them and silently render nothing where
        // a sentence belonged.
        account: null,
        notConfigured: null,
        // The tick was part of this card's own markup before the port; it
        // moves into the string so the shared card stays provider-agnostic.
        connectedMessage: `✓ ${t(locale, 'google_connected')}`,
        errorMessage: (reasonSuffix) =>
          `${t(locale, 'google_connect_failed')}${reasonSuffix}. ${t(locale, 'try_again')}`,
        startFailed: t(locale, 'google_start_failed'),
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
