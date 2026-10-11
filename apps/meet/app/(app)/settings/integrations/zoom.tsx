'use client';

import { useRouter } from 'next/navigation';
import { ProviderConnectionCard } from '@thefibre/shared/ui/provider-connection';
import { t, type Locale } from '@/lib/i18n-ui';
import { startZoomAuth, disconnectZoom } from '../actions';

// Meet's Zoom card, now the SHARED card with Meet's strings and actions
// injected. This file was an 88-line copy that predated the shared one — the
// note on packages/shared/src/ui/zoom-connection.tsx said "port it to this
// when next touched", and adding a Teams card beside it was that touch.
// Porting rather than copying is the whole point: a second provider here was
// about to become a second copy of the same card.
export function ZoomConnect({
  connected,
  accountEmail,
  configured,
  statusParam,
  reasonParam,
  locale,
}: {
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no Zoom app credentials — connecting can't work. */
  configured: boolean;
  statusParam: string | null;
  reasonParam: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <ProviderConnectionCard
      name="Zoom"
      connected={connected}
      accountEmail={accountEmail}
      configured={configured}
      statusParam={statusParam}
      reasonParam={reasonParam}
      labels={{
        description: t(locale, 'zoom_desc'),
        account: (email) => t(locale, 'zoom_account', { email }),
        connectedMessage: t(locale, 'zoom_connected_msg'),
        errorMessage: (reason) => t(locale, 'zoom_error_msg', { reason }),
        notConfigured: t(locale, 'zoom_not_configured'),
        startFailed: t(locale, 'zoom_start_failed'),
        connect: t(locale, 'connect_zoom'),
        disconnect: t(locale, 'disconnect'),
        // Meet says "Redirecting…" where the platform says "Working…". Kept
        // as Meet's own word rather than quietly unified: the shared card
        // takes the label, it does not own it.
        working: t(locale, 'redirecting'),
      }}
      onStart={startZoomAuth}
      // Meet's action returns SaveResult (`ok?: true`); the card wants a
      // definite boolean. Narrowed here rather than loosening the card.
      onDisconnect={async () => {
        const r = await disconnectZoom();
        return { ok: !!r.ok, error: r.error };
      }}
      onDisconnected={() => router.refresh()}
    />
  );
}
