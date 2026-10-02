'use client';

import { useRouter } from 'next/navigation';
import { ZoomConnectionCard } from '@thefibre/shared/ui/zoom-connection';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { startZoomAuth, disconnectZoom } from '../actions';

// The shared Zoom card with this app's strings and server actions injected.
export function ZoomConnect({
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
    <ZoomConnectionCard
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
        working: t(locale, 'working'),
      }}
      onStart={startZoomAuth}
      onDisconnect={disconnectZoom}
      onDisconnected={() => router.refresh()}
    />
  );
}
