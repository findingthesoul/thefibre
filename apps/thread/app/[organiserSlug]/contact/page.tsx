// /{owner}/contact — the site's contact page.
//
// Sjoerd asked for "contact page (with basic form)" among the ingredients.
// Basic is the specification: a name, an address to reply to, a message.
//
// It is a STATIC segment under the owner, which means it shadows a thread
// slugged 'contact' — Next resolves 'contact' before [threadSlug]. That is
// why 'contact' and 'about' became reserved thread slugs in the same
// release; nothing in production held either.
//
// English, like the rest of the public listing pages it belongs to. A
// workspace site has no per-visitor locale to read — only a thread carries a
// language — and a form translated into a language the surrounding page is
// not in would be worse than one that matches its neighbours.

import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { siteOf, type PublicSite } from '@/lib/public-site';
import type { PublicOrganiser } from '../organiser-listing';
import { SiteNav, SiteFooter } from '../site-chrome';
import { ContactForm } from './contact-form';

export default async function ContactPage({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}) {
  const { organiserSlug } = await params;

  let data: { organiser: PublicOrganiser; site?: PublicSite };
  try {
    data = await publicFetch(`/api/v1/thread/public/organiser/${organiserSlug}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }
  const site = siteOf(data);
  // No form, no page. A contact route that renders a dead form would be the
  // worst of both — it looks like a way to reach somebody and is not one.
  if (!site.contact_enabled) notFound();

  const name = site.name ?? data.organiser.display_name ?? organiserSlug;

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      <SiteNav site={site} ownerSlug={organiserSlug} ownerName={name} />
      {/* The container matches the navbar's, so the heading starts under the
          logo rather than floating in from the left. The form itself stays
          narrow — a text field the width of the page is unpleasant to read
          back. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-20">
        <div className="max-w-xl">
          <h1 className="text-3xl font-medium tracking-tight">Contact</h1>
          {site.contact_intro && (
            <p className="mt-3 text-base leading-relaxed text-ink-subtle whitespace-pre-line">
              {site.contact_intro}
            </p>
          )}
          <ContactForm ownerSlug={organiserSlug} />
        </div>
      </main>
      <SiteFooter site={site} ownerSlug={organiserSlug} ownerName={name} />
    </div>
  );
}
