import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Video, MapPin, Users } from 'lucide-react';
import { APPS } from '@thefibre/shared';
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
  event_type?: string;
  capacity?: number | null;
  fixed_starts_at?: string | null;
  fixed_ends_at?: string | null;
  poll_slots?: { starts_at: string; ends_at: string }[];
};

type HostMtResp = { host: Host; meeting_type: MeetingType };
type TeamMtResp = MeetingType & {
  team: { id: string; slug: string; name: string; description: string | null };
  host: {
    slug: string;
    user:
      | { full_name: string | null; avatar_url: string | null }
      | { full_name: string | null; avatar_url: string | null }[]
      | null;
  } | null;
};

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
      <Card
        ownerSlug={asHost.host.slug}
        ownerKind="host"
        ownerName={asHost.host.full_name ?? asHost.host.slug}
        ownerAvatar={asHost.host.photo_url ?? asHost.host.avatar_url}
        ownerLocation={asHost.host.location}
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

  return (
    <Card
      ownerSlug={asTeam.team.slug}
      ownerKind="team"
      ownerName={asTeam.team.name}
      ownerAvatar={null}
      ownerLocation={null}
      backHref={`/${asTeam.team.slug}`}
      hostTimezone={'UTC'}
      meetingType={asTeam}
    />
  );
}

function Card({
  ownerSlug,
  ownerKind,
  ownerName,
  ownerAvatar,
  ownerLocation,
  backHref,
  hostTimezone,
  meetingType,
}: {
  ownerSlug: string;
  ownerKind: 'host' | 'team';
  ownerName: string;
  ownerAvatar: string | null;
  ownerLocation: string | null;
  backHref: string;
  hostTimezone: string;
  meetingType: MeetingType;
}) {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
            <aside className="border-b md:border-b-0 md:border-r border-neutral-200 p-8 bg-white">
              <Link
                href={backHref}
                className="text-xs text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
              >
                ←{' '}
                {ownerKind === 'team' ? 'All meetings' : 'Back to ' + ownerName}
              </Link>

              <div className="mt-6 flex items-center gap-3">
                {ownerAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ownerAvatar}
                    alt={ownerName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
                    {ownerName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="mt-4 text-sm text-neutral-500">{ownerName}</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight leading-tight">
                {meetingType.name}
              </h1>

              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                <li className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
                  <span>{meetingType.duration_minutes} minutes</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Video className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
                  <span>{formatProvider(meetingType.conferencing_provider)}</span>
                </li>
                {meetingType.event_type === 'group' && meetingType.capacity ? (
                  <li className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
                    <span>Up to {meetingType.capacity} invitees per slot</span>
                  </li>
                ) : null}
                {(meetingType.default_location || ownerLocation) && (
                  <li className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
                    <span>
                      {meetingType.default_location ?? ownerLocation}
                    </span>
                  </li>
                )}
              </ul>

              {meetingType.description && (
                <p className="mt-6 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap border-t border-neutral-200 pt-6">
                  {meetingType.description}
                </p>
              )}
            </aside>

            <section className="p-8">
              <BookingFlow
                ownerSlug={ownerSlug}
                ownerKind={ownerKind}
                hostTimezone={hostTimezone}
                meetingType={meetingType}
              />
            </section>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-neutral-400">
          Powered by{' '}
          <Link href="https://meet.thefibre.app" className="underline">
            {APPS['fibre-meet'].name}
          </Link>
        </footer>
      </div>
    </main>
  );
}

function formatProvider(p: string): string {
  switch (p) {
    case 'google_meet':
      return 'Google Meet — link in invite';
    case 'zoom':
      return 'Zoom — link in invite';
    case 'teams':
      return 'Microsoft Teams — link in invite';
    case 'in_person':
      return 'In person';
    case 'personal_room':
      return 'Personal meeting room';
    case 'none':
      return 'No conferencing';
    default:
      return p;
  }
}
