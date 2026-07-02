import Link from 'next/link';
import { User, Building2, CreditCard, Cable, Code2, ChevronRight, type LucideIcon } from 'lucide-react';
import { PageContainer, PageHeader, SectionLabel } from '@/components/ui/page';

export default function SettingsPage() {
  return (
    <PageContainer max="4xl">
      <PageHeader title="Settings" description="Your organiser profile and workspace defaults." />

      <section className="mt-10">
        <SectionLabel>Personal</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            href="/settings/profile"
            Icon={User}
            title="Profile"
            desc="Your public organiser page — slug, name, bio, photo, timezone."
          />
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Workspace</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            href="/settings/workspace"
            Icon={Building2}
            title="Emails & defaults"
            desc="Sender name, email footer, default organiser revenue share."
          />
          <Card
            href="https://meet.thefibre.app/settings/payments"
            Icon={CreditCard}
            title="Payments"
            desc="Your Stripe account — shared with Fibre Meet (one connection for all apps). Checkout lands with the payments phase."
            external
          />
          <Card
            href="https://meet.thefibre.app/settings"
            Icon={Cable}
            title="Connections"
            desc="Google Calendar, personal meeting room — shared across the Fibre apps, managed in Fibre Meet."
            external
          />
          <Card
            href="/settings/embeds"
            Icon={Code2}
            title="Website embeds"
            desc="Copy-paste snippets to show your threads and take enrolments on any website — Webflow included."
          />
        </div>
      </section>
    </PageContainer>
  );
}

function Card({
  href,
  Icon,
  title,
  desc,
  disabled,
  external,
}: {
  href?: string;
  Icon: LucideIcon;
  title: string;
  desc: string;
  disabled?: boolean;
  external?: boolean;
}) {
  const inner = (
    <div
      className={`flex items-start gap-3.5 rounded-lg border border-line bg-surface-raised p-4 transition-colors ${
        disabled ? 'opacity-50' : 'hover:border-line-strong'
      }`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
        <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-0.5 text-xs text-ink-subtle leading-relaxed">{desc}</p>
      </div>
      {!disabled && (
        <ChevronRight size={16} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
      )}
    </div>
  );
  if (disabled || !href) return inner;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}
