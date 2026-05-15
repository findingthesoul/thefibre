import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { BookingFlow } from './flow';
import type { IntakeField } from '@/lib/intake';

type Host = {
  id: string;
  slug: string;
  full_name: string | null;
  bio: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  location: string | null;
  timezone: string;
};

type IntakeForm = { id: string; name: string; fields: IntakeField[] };

type MeetingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  conferencing_provider: string;
  default_location: string | null;
  price_cents: number | null;
  price_currency: string | null;
  intake_form: IntakeForm | null;
};

type Resp = { host: Host; meeting_type: MeetingType };

export default async function MeetingTypePage({
  params,
}: {
  params: Promise<{ hostSlug: string; mtSlug: string }>;
}) {
  const { hostSlug, mtSlug } = await params;
  let data: Resp;
  try {
    data = await publicFetch<Resp>(
      `/api/v1/meet/public/host/${encodeURIComponent(hostSlug)}/mt/${encodeURIComponent(mtSlug)}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href={`/${hostSlug}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← {data.host.full_name ?? data.host.slug}
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-medium tracking-tight">
            {data.meeting_type.name}
          </h1>
          <div className="mt-2 text-sm text-neutral-500">
            {data.meeting_type.duration_minutes} minutes ·{' '}
            {formatProvider(data.meeting_type.conferencing_provider)}
          </div>
          {data.meeting_type.description && (
            <p className="mt-5 text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {data.meeting_type.description}
            </p>
          )}
        </header>

        <div className="mt-12">
          <BookingFlow host={data.host} meetingType={data.meeting_type} />
        </div>
      </div>
    </main>
  );
}

function formatProvider(p: string) {
  switch (p) {
    case 'google_meet':
      return 'Google Meet';
    case 'zoom':
      return 'Zoom';
    case 'teams':
      return 'Microsoft Teams';
    case 'in_person':
      return 'In person';
    case 'personal_room':
      return 'Personal meeting room';
    case 'none':
      return '';
    default:
      return p;
  }
}
