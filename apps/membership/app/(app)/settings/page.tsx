import Link from 'next/link';
import { Globe, Plug, Code2, Percent } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from './page-chrome';

// Same four sections, same order, same words as every other app — see
// packages/shared/src/ui/settings.tsx for why that matters. (Sjoerd,
// 2026-09-05: "why does it have to be different… please use one way of
// working" — this page started as bespoke cards and got the Thread shape.)

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default function SettingsPage() {
  const fibre = appUrl('fibre-platform', process.env);
  const sections = platformSettings({
    fibreUrl: fibre,
    // Membership serves your payments (the Stripe account subscriptions
    // charge on); everything else about you and the workspace is edited
    // once, in The Fibre.
    hosted: ['payments'],
    appSection: {
      label: 'Membership',
      entries: [
        {
          href: '/settings/join-page',
          icon: <Globe {...ICON} />,
          title: 'Join page',
          desc: 'The public page where people become members — headline, intro, address.',
        },
        {
          href: '/settings/integrations',
          icon: <Plug {...ICON} />,
          title: 'Integrations',
          desc: 'The tools membership unlocks for members — Circle.so today, more to come.',
        },
        {
          href: '/settings/pricing',
          icon: <Percent {...ICON} />,
          title: 'Pricing rules',
          desc: 'Price logic — purchasing-power pricing by country, first matching rule wins.',
        },
        {
          href: '/settings/embeds',
          icon: <Code2 {...ICON} />,
          title: 'Website embeds',
          desc: 'Copy-paste snippets to show tiers and take joins on any website.',
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="You, the workspace, and Membership. The same four sections in every Fibre app."
      />
      <div className="mt-8">
        <SettingsCards sections={sections} link={Link} />
      </div>
    </PageContainer>
  );
}
