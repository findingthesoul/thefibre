// The page the email's "Stop these emails" opens. Works signed out. One
// press, because the link alone must not do it: mail scanners open every link
// in a message, and an unsubscribe on arrival would unsubscribe people who
// never clicked.

import { PageShell } from '../../page-shell';
import { StopButton } from './stop-button';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await pageLocale();
  return (
    <PageShell title={t(locale, 'unsub_title')}>
      <p className="mt-6 max-w-prose text-sm text-ink-subtle">
        {t(locale, 'unsub_body')}
      </p>
      <StopButton token={token} />
    </PageShell>
  );
}
