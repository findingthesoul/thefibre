import Link from 'next/link';
import { Award, CalendarRange, ChevronRight, type LucideIcon } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/ui/page';

// Templates hub (Sjoerd 2026-07-02): one place for both template kinds.
// Certificate templates live under /certificates (the builder);
// thread templates arrive with save-as / create-from.
export default function TemplatesPage() {
  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Templates"
        description="Reusable designs — for whole threads and for certificates."
      />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          href="/certificates"
          Icon={Award}
          title="Certificate templates"
          desc="Design certificates in the visual builder — threads pick one and issue it on completion."
        />
        <Card
          href="/templates/threads"
          Icon={CalendarRange}
          title="Thread templates"
          desc="Save a thread as a template and start new ones from it — dates rebase automatically."
        />
      </div>
    </PageContainer>
  );
}

function Card({
  href,
  Icon,
  title,
  desc,
  disabled,
}: {
  href?: string;
  Icon: LucideIcon;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={`flex items-start gap-3.5 rounded-lg border border-line bg-surface-raised p-5 transition-colors ${
        disabled ? 'opacity-50' : 'hover:border-line-strong'
      }`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
        <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-xs text-ink-subtle leading-relaxed">{desc}</p>
      </div>
      {!disabled && (
        <ChevronRight size={16} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
      )}
    </div>
  );
  if (disabled || !href) return inner;
  return <Link href={href}>{inner}</Link>;
}
