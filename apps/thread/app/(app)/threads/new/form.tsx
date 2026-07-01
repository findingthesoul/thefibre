'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Route, type LucideIcon } from 'lucide-react';
import { createThread } from '../actions';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextAreaField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function NewThreadForm({ organiserSlug }: { organiserSlug: string }) {
  const router = useRouter();
  const [format, setFormat] = useState<'event' | 'journey'>('event');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('name') ?? '').trim();
    const slug = String(fd.get('slug') ?? '').trim();
    const intention = String(fd.get('intention') ?? '').trim();
    const startsOn = String(fd.get('starts_on') ?? '');
    const endsOn = String(fd.get('ends_on') ?? '');
    if (!title) return setError('Give the thread a name.');
    if (!slug) return setError('Pick a URL slug.');

    startTransition(async () => {
      const r = await createThread({
        title,
        format,
        slug,
        intention: intention || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/threads/${r.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <div>
        <SectionLabel>Kind</SectionLabel>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KindCard
            Icon={CalendarRange}
            title="Event"
            desc="A gathering with a schedule — sessions, workshops, conversations at set times."
            active={format === 'event'}
            onClick={() => setFormat('event')}
          />
          <KindCard
            Icon={Route}
            title="Journey"
            desc="A personal arc over time — reflections, practices and messages, at each participant's own pace."
            active={format === 'journey'}
            onClick={() => setFormat('journey')}
          />
        </div>
      </div>

      <NameAndSlugFields
        nameLabel="Name"
        prefix={`${THREAD_HOST}/${organiserSlug}/`}
        slugHint="Lowercase letters, digits and hyphens."
      />

      <TextAreaField
        label="Intention"
        name="intention"
        rows={3}
        hint="Why this thread exists — shown on the public page."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField label="Starts on" name="starts_on" />
        <DateField label="Ends on" name="ends_on" />
      </div>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create thread'}
        </Button>
      </div>
    </form>
  );
}

function KindCard({
  Icon,
  title,
  desc,
  active,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition-colors ${
        active
          ? 'border-ink bg-surface-sunken'
          : 'border-line bg-surface hover:bg-surface-sunken'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">{desc}</p>
    </button>
  );
}
