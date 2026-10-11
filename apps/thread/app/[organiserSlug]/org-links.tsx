// Who a person runs their threads with.
//
// The one thing a person's page GAINS in the split. Before this, their page
// wore the organisation's logo and headline and said nothing honest about the
// relationship (Sjoerd, 2026-10-04: "half me the person, half me the
// organiser, confusing"). A link saying *I run these with soul.com* is the
// honest version — it names the relationship instead of implying the page
// belongs to them.
//
// A LIST, not a field (Q5). A person can run threads for two organisations,
// and the data has always supported it: one organiser row per person, and
// each thread carrying its own workspace.
//
// `linked` mirrors the people section pointed the other way: an organisation
// whose own page is switched off is NAMED but not linked. That somebody works
// with them is not the secret; their page being off is a separate choice.

import Link from 'next/link';

export type OrgLink = { slug: string; name: string | null; linked: boolean };

export function OrgLinks({ organisations, label }: { organisations: OrgLink[]; label: string }) {
  if (organisations.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">{label}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {organisations.map((o) => (
          <li key={o.slug}>
            {o.linked ? (
              <Link href={`/${o.slug}`} className="underline underline-offset-4 hover:opacity-70">
                {o.name ?? o.slug}
              </Link>
            ) : (
              <span>{o.name ?? o.slug}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
