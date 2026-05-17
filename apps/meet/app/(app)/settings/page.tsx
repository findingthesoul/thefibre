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
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSONAL.map((c) => (
            <SettingCard key={c.href} card={c} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionLabel>Workspace</SectionLabel>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    <div className="flex items-start gap-4 p-5 h-full">
      <div className="h-10 w-10 rounded-md border border-line bg-surface flex items-center justify-center shrink-0">
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
        <div className="mt-1 text-xs text-ink-subtle leading-relaxed">{card.description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-muted shrink-0 mt-1" strokeWidth={1.5} />
    </div>
  );
  const baseClass =
    'block rounded-lg border border-line bg-surface-raised overflow-hidden';
  return muted ? (
    <div className={`${baseClass} opacity-60`}>{inner}</div>
  ) : (
    <Link href={card.href} className={`${baseClass} hover:bg-surface-sunken transition-colors`}>
      {inner}
    </Link>
  );
}
