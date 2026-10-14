// The page the email's "Stop these emails" opens. Works signed out. One
// press, because the link alone must not do it: mail scanners open every link
// in a message, and an unsubscribe on arrival would unsubscribe people who
// never clicked.

import { PageShell } from '../../page-shell';
import { StopButton } from './stop-button';

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PageShell title="Stop these emails">
      <p className="mt-6 max-w-prose text-sm text-ink-subtle">
        You will stop getting emails about new and changed threads on this community’s calendars.
        They still show under Notifications when you sign in, and you can turn the emails back on
        under You.
      </p>
      <StopButton token={token} />
    </PageShell>
  );
}
