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

type HostMtResp = { host: Host; meeting_type: MeetingType };

type TeamMtResp = MeetingType & {
  team: { id: string; slug: string; name: string; description: string | null };
  host: { slug: string; user: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null } | null;
};

// Resolve as host meeting type first; fall back to team meeting type. The
// route segment is named `hostSlug` for historical reasons but now carries
// either a host or a team slug.
export default async function MeetingTypePage({
  params,
}: {
  params: Promise<{ hostSlug: string; mtSlug: string }>;
}) {
  const { hostSlug, mtSlug } = await params;

  // Try host-owned.
  let asHost: HostMtResp | null = null;
  try {
    asHost = await publicFetch<HostMtResp>(
      `/api/v1/meet/public/host/${encodeURIComponent(hostSlug)}/mt/${encodeURIComponent(mtSlug)}`,
    );
  } catch (e) {
    if (!(e instanceof PublicApiError) || e.status !== 404) throw e;
  }
  if (asHost) {
    return (
      <Page
        ownerSlug={asHost.host.slug}
        ownerKind="host"
        title={asHost.meeting_type.name}
        ownerLabel={asHost.host.full_name ?? asHost.host.slug}
        backHref={`/${asHost.host.slug}`}
        hostTimezone={asHost.host.timezone}
        meetingType={asHost.meeting_type}
      />
    );
  }

  // Fall back to team-owned.
  let asTeam: TeamMtResp | null = null;
  try {
    asTeam = await publicFetch<TeamMtResp>(
      `/api/v1/meet/public/team/${encodeURIComponent(hostSlug)}/mt/${encodeURIComponent(mtSlug)}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }
  if (!asTeam) notFound();

  // The team booking flow uses the host's timezone (the assigned facilitator).
  // For now we fall back to UTC when the lookup didn't include a timezone.
  return (
    <Page
      ownerSlug={asTeam.team.slug}
      ownerKind="team"
      title={asTeam.name}
      ownerLabel={asTeam.team.name}
      backHref={`/${asTeam.team.slug}`}
      hostTimezone={'UTC'}
      meetingType={asTeam}
    />
  );
}

function Page({
  ownerSlug,
  ownerKind,
  title,
  ownerLabel,
  backHref,
  hostTimezone,
  meetingType,
}: {
  ownerSlug: string;
  ownerKind: 'host' | 'team';
  title: string;
  ownerLabel: string;
  backHref: string;
  hostTimezone: string;
  meetingType: MeetingType;
}) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href={backHref}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← {ownerLabel}
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
          <div className="mt-2 text-sm text-neutral-500">
            {meetingType.duration_minutes} minutes ·{' '}
            {formatProvider(meetingType.conferencing_provider)}
          </div>
          {meetingType.description && (
            <p className="mt-5 text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {meetingType.description}
            </p>
          )}
        </header>

        <div className="mt-12">
          <BookingFlow
            ownerSlug={ownerSlug}
            ownerKind={ownerKind}
            hostTimezone={hostTimezone}
            meetingType={meetingType}
          />
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
