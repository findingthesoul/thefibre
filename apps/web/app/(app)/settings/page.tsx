import Link from 'next/link';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@/components/ui/page';

// The Fibre hosts nearly all of it — this is the platform, so "in The Fibre"
// is here. Same four sections, same order, same words as Thread, Meet, Flow
// and Pulse (packages/shared/src/ui/settings.tsx).
//
// What used to be here and is not any more: a read-only block repeating the
// workspace's name, slug, plan and creation date, and a list of your app
// memberships. Both were facts on a settings page you could not act on. The
// name is now editable at Settings → Workspace and the apps at Settings →
// Apps, which is what a person came here to do.

export const metadata = { title: 'Settings · The Fibre' };

export default function SettingsPage() {
  const sections = platformSettings({
    fibreUrl: '',
    hosted: ['profile', 'workspace', 'members', 'apps', 'plan', 'about', 'privacy'],
    // Payments and connections are set up inside the apps that use them —
    // Meet and The Thread — and both write platform values.
    omit: ['payments', 'connections'],
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="You, the workspace, and the platform. The same sections in every Fibre app."
      />
      <SettingsCards sections={sections} link={Link} />
    </PageContainer>
  );
}
