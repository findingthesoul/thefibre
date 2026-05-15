import Link from 'next/link';
import { MeetingTypeForm } from '../form';

export default function NewMeetingTypePage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <Link
        href="/meeting-types"
        className="text-sm text-ink-subtle hover:text-ink"
      >
        ← Meeting types
      </Link>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">
        New meeting type
      </h1>
      <p className="mt-1 text-sm text-ink-subtle">
        What can people book you for?
      </p>

      <div className="mt-10">
        <MeetingTypeForm initial={{}} />
      </div>
    </div>
  );
}
