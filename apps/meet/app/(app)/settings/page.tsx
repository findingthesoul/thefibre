import Link from 'next/link';
import {
  User,
  Clock,
  Calendar,
  Video,
  CreditCard,
  Users,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
} from '@/components/ui/page';

type Card = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  available?: boolean;
};

const PERSONAL: Card[] = [
  {
    href: '/settings/profile',
    title: 'Profile',
    description: 'Slug, bio, location, photo, personal meeting room.',
    Icon: User,
    available: true,
  },
  {
    href: '/settings/availability',
    title: 'Availability',
    description: 'Timezone and weekly working hours.',
    Icon: Clock,
    available: true,
  },
  {
    href: '/settings/calendars',
    title: 'Calendars',
    description: 'Conflict-source calendars and the write target for new bookings.',
    Icon: Calendar,
    available: true,
  },
  {
    href: '/settings/integrations',
    title: 'Connections',
    description: 'Connect Google Calendar today; Zoom and Teams coming next.',
    Icon: Video,
    available: true,
  },
  {
    href: '/settings/payments',
    title: 'Payments',
    description: 'Connect Stripe so paid meeting types can collect payment.',
    Icon: CreditCard,
    available: true,
  },
];

const WORKSPACE: Card[] = [
  {
    href: '/teams',
    title: 'Teams',
    description: 'Shared groups with their own booking links and meeting types.',
    Icon: Users,
    available: true,
  },
];

export default function SettingsIndex() {
  return (
    <PageContainer max="3xl">
      <PageHeader
        title="Settings"
        description="Personal and workspace configuration."
      />

      <section className="mt-10">
        <SectionLabel>Personal</SectionLabel>
        <div className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
          {PERSONAL.map((c) => (
            <SettingCard key={c.href} card={c} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionLabel>Workspace</SectionLabel>
        <div className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
          {WORKSPACE.map((c) => (
            <SettingCard key={c.href} card={c} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function SettingCard({ card }: { card: Card }) {
  const muted = card.available === false;
  const inner = (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="h-9 w-9 rounded-md border border-line bg-surface flex items-center justify-center shrink-0">
        <card.Icon className="h-4 w-4 text-ink-subtle" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium flex items-center gap-2">
          {card.title}
          {muted && (
            <span className="text-[10px] uppercase tracking-wider text-ink-muted border border-line rounded px-1.5 py-0.5">
              Soon
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-ink-subtle">{card.description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-muted shrink-0" strokeWidth={1.5} />
    </div>
  );
  return muted ? (
    <div className="opacity-60">{inner}</div>
  ) : (
    <Link
      href={card.href}
      className="block hover:bg-surface-sunken transition-colors"
    >
      {inner}
    </Link>
  );
}
