// One member's page, inside My Thread.
//
// Sjoerd, 2026-10-04: *"Would be nice to click on the member and see his/her
// personal page inside my.thread with a back button."*
//
// ---------------------------------------------------------------------------
// It asks the LIST, and shows one row of it. That is the whole design.
// ---------------------------------------------------------------------------
// Who may see whom here is not a simple rule — it is eleven of them, in
// order: you are signed in, you are a member of that community, the community
// has a directory, YOUR OWN membership is active or in grace, they are
// listed, their membership is active or in grace (never lapsed), they are not
// soft-deleted, they are not you, and — where the directory is
// category-scoped — you share a category.
//
// The fourth used to be "YOU are listed in it". It became "your membership is
// current" on 2026-10-14, when consent stopped deciding whether somebody may
// LOOK and went back to deciding only whether they are SHOWN.
// Then contact details appear only if that member chose to show them, and
// categories only if the community shows them.
//
// A detail page with its own query would have to repeat all of that, and the
// day one of them drifts is the day this page shows somebody a person the
// list would have hidden. So it does not have its own query. It fetches the
// same list the previous page fetched, through the same loader, and renders
// the row whose person_id matches. Being more generous than the list is not
// prevented here by care; it is impossible.
//
// The cost is honest and small: a directory of 300 people is fetched to show
// one of them. These are communities, not social networks, and the call is
// the one the list page already makes. If a community ever grows to the size
// where that matters, the fix is a server-side single-member resolver that
// the LIST also uses — never a second copy of the rules.
//
// NOT FOUND IS ONE ANSWER, deliberately. Lapsed, unlisted, in another
// category, soft-deleted, or never existed all render the same sentence. A
// page that distinguished them would answer questions about people the
// viewer is not allowed to ask about — "is this person still a member here?"
// is exactly the thing a lapsed member's absence is supposed to withhold.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Mail, Phone, Globe, Linkedin } from 'lucide-react';
import { bioToHtml } from '@thefibre/shared';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { loadDirectoryChoices, loadDirectoryMembers, loadFrame } from '@/lib/session';
import { pickMember } from '@/lib/directory-member';
import { SignedOut } from '../../../signed-out';
import { PageShell } from '../../../page-shell';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export default async function MemberPage({
  params,
}: {
  params: Promise<{ workspaceId: string; personId: string }>;
}) {
  const { workspaceId, personId } = await params;
  // Side by side, as on the list page: the session only decides signed-out.
  const [session, list, choices] = await Promise.all([
    loadFrame(),
    loadDirectoryMembers(workspaceId),
    loadDirectoryChoices(),
  ]);
  if (!session) return <SignedOut />;
  const locale = await pageLocale();
  const community = (choices ?? []).find((c) => c.workspace_id === workspaceId);
  const backHref = `/members/${workspaceId}`;
  const back = (
    <Link
      href={backHref}
      className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
    >
      <ArrowLeft size={15} strokeWidth={1.75} />
      {community ? t(locale, 'back_to_members_of', { name: community.workspace_name }) : t(locale, 'back_to_members')}
    </Link>
  );

  // The decision lives in lib/directory-member.ts, where it has tests: it is
  // a privacy decision, and one inside a server component cannot be
  // exercised. It keeps a failed load apart from an absent member, because
  // our outage must not read as a statement about somebody's membership.
  const view = pickMember(list, personId);

  if (view.kind !== 'member') {
    return (
      <PageShell title={t(locale, 'member')}>
        {back}
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {view.kind === 'failed'
            ? t(locale, 'members_failed_private')
            : t(locale, 'member_unavailable')}
        </p>
      </PageShell>
    );
  }

  const m = view.member;
  const place = [m.city, m.country].filter(Boolean).join(', ');
  const hasContact = !!(m.email || m.phone || m.linkedin_url || m.website_url);

  return (
    <PageShell title={m.display_name}>
      {back}

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-4">
          {m.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.photo_url}
              alt={m.display_name}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-line"
            />
          ) : (
            <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xl font-medium text-ink-subtle ring-1 ring-line">
              {m.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {/* The name is NOT repeated here: PageShell's title is already
                this person's name, and on a phone the two sat four lines
                apart saying the same thing. Seen in the render check, which
                is the only thing that would have shown it — every assertion
                about the name passed with both of them on screen. */}
            {place && <p className="text-sm text-ink-muted">{place}</p>}
            {(m.categories.length > 0 || m.tags.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.categories.map((c) => (
                  <span
                    key={`c-${c}`}
                    className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-subtle"
                  >
                    {c}
                  </span>
                ))}
                {m.tags.map((tg) => (
                  <span
                    key={`t-${tg}`}
                    className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted"
                  >
                    {tg}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* THE FULL BIO, rendered (Sjoerd, 2026-10-12: "Click on user - full
            bio"). It used to be printed as text, and every stored bio is HTML
            now — both on production — so his own page showed him
            "<p>Zierikzee, Netherlands…</p><p><br></p><h3>About me</h3>", a
            wall of tags.

            Through `bioToHtml`, which is the transitional reader the rest of
            the family already uses: HTML passes through (it was sanitised at
            the API boundary on the way in), and a bio that is still plain
            text is ESCAPED and its line breaks become paragraphs, so neither
            kind renders wrong during the conversion. `RichText` carries the
            typography — headings included, which Tailwind's preflight would
            otherwise flatten into paragraphs. */}
        {bioToHtml(m.bio) && (
          <RichText
            html={bioToHtml(m.bio)!}
            className="mt-5 text-sm leading-relaxed text-ink-subtle [&_p]:mb-3 [&_p:last-child]:mb-0"
          />
        )}

        {/* Null unless that member chose to show them — the server decided,
            and this page does not know the rule any more than the card does. */}
        {hasContact && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {m.email && (
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
                >
                  <Mail size={14} strokeWidth={1.75} />
                  {m.email}
                </a>
              )}
              {m.phone && (
                <a
                  href={`tel:${m.phone}`}
                  className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
                >
                  <Phone size={14} strokeWidth={1.75} />
                  {m.phone}
                </a>
              )}
              {m.linkedin_url && (
                <a
                  href={m.linkedin_url}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
                >
                  <Linkedin size={14} strokeWidth={1.75} />
                  LinkedIn
                </a>
              )}
              {m.website_url && (
                <a
                  href={m.website_url}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
                >
                  <Globe size={14} strokeWidth={1.75} />
                  {t(locale, 'website')}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
