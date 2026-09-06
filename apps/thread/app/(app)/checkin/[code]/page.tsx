// The scan landing. The QR in every confirmation email (and wallet pass)
// encodes /checkin/<code>; a door volunteer scans it with the phone camera
// and lands here, signed in, one tap from done. A guest scanning their own
// ticket hits the API's authority check and sees the polite refusal below.

import { apiFetch, ApiError } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { CheckinCard } from './checkin-card';

export type ScannedTicket = {
  id: string;
  thread_id: string;
  person_name: string;
  email: string | null;
  thread_title: string;
  status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
};

export default async function CheckinScanPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const locale = await uiLocale();
  const { code } = await params;

  let ticket: ScannedTicket | null = null;
  let refusal: string | null = null;
  try {
    ticket = await apiFetch<ScannedTicket>(`/api/v1/thread/checkin/${code}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      refusal = t(locale, 'ticket_no_match');
    } else if (e instanceof ApiError && e.status === 403) {
      refusal = t(locale, 'door_ticket_refusal');
    } else {
      throw e;
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      {refusal ? (
        <p className="text-center text-sm text-ink-subtle leading-relaxed">{refusal}</p>
      ) : (
        <CheckinCard locale={locale} ticket={ticket!} />
      )}
    </main>
  );
}
