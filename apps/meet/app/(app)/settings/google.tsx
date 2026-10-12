'use client';

// The shared provider card with Google's strings and server actions injected
// — the same arrangement the Zoom and Teams cards in this app already use.
//
// This was one of three hand-written copies (Meet, Thread, The Fibre) that
// predated `ProviderConnectionCard`. They differed only in import paths and
// i18n key names, which is what `labels` is for. v1.153.2 made the point: the
// stacking fix went into the shared card, and the Google card on the same
// screen still crushed its text at phone width, because it was not that
// component.
//
// No `accountEmail` (the connection is a yes/no) and no `configured` gate
// (Google is configured wherever these apps run), both expressed by passing
// nothing rather than inventing strings nobody reads.

import { useRouter } from 'next/navigation';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { t, type Locale } from '@/lib/i18n-ui';
import { startGoogleAuth, disconnectGoogle } from './actions';

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
        description: t(locale, 'google_desc'),
        connectedMessage: t(locale, 'google_connected_msg'),
        // This app's key takes the reason as a parameter, so the suffix goes
        // straight through rather than being concatenated here.
        errorMessage: (reasonSuffix) => t(locale, 'google_error_msg', { reason: reasonSuffix }),
        startFailed: t(locale, 'google_start_failed'),
        connect: t(locale, 'connect_google'),
        // This app says "Redirecting…" where the others say "Working…".
        working: t(locale, 'redirecting'),
        disconnect: t(locale, 'disconnect'),
      }}
      onStart={startGoogleAuth}
      // SaveResult has `ok` optional; the card wants a definite boolean. Same
      // two-line adapter the Zoom card next door uses.
      onDisconnect={async () => {
        const r = await disconnectGoogle();
        return { ok: !!r.ok, error: r.error };
      }}
      onDisconnected={() => router.refresh()}
    />
  );
}
