// The people on an organisation's page.
//
// This is the genuinely new thing in the split: a workspace page used to be
// a logo and a list of threads, with no sense that an organisation is people.
//
// TWO RULES, both decided in docs/person-and-organisation-pages.md and both
// easy to lose in a refactor:
//
//  1. Only those who said yes. The API sends nobody else, and it sends an
//     empty array rather than nothing, so "nobody opted in" and "this is not
//     an organisation page" are different on the wire, not guessed here.
//  2. Somebody whose own page is switched off appears as TEXT, not a link
//     (Q2). A link to a deliberate 404 is worse than no link — the API
//     decides that and sends `linked`, so this file never re-derives it from
//     a published flag it should not be able to see.

import Link from 'next/link';

export type OrgPerson = {
  slug: string;
  display_name: string | null;
  short_bio: string | null;
  photo_url: string | null;
  /** Whether their own page is there to go to. Decided by the API. */
  linked: boolean;
};

function Face({ person }: { person: OrgPerson }) {
  const name = person.display_name ?? person.slug;
  return (
    <>
      {person.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-current/10 text-sm opacity-70"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{name}</span>
        {person.short_bio && (
          <span className="mt-0.5 block text-xs opacity-70">{person.short_bio}</span>
        )}
      </span>
    </>
  );
}

export function OrgPeople({ people, title }: { people: OrgPerson[]; title: string }) {
  if (people.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">{title}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <li key={person.slug}>
            {person.linked ? (
              <Link
                href={`/${person.slug}`}
                className="flex items-center gap-3 rounded-xl p-2 -m-2 transition-colors hover:bg-current/5"
              >
                <Face person={person} />
              </Link>
            ) : (
              // Listed, but with no page of their own to open. Same row, no
              // link, no explanation — a visitor does not need to be told
              // that somebody chose not to have a page.
              <span className="flex items-center gap-3 p-2 -m-2">
                <Face person={person} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
