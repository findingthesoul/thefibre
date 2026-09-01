// /developers — the published read API, written for someone outside this
// repo. A static segment, so it wins over the [organiserSlug] catch-all; no
// organiser can ever claim the slug (it is in RESERVED_SLUGS).
//
// Kept honest deliberately: it says what is NOT available and why, because a
// developer who discovers the limit by hitting it has already wasted an hour.
// Contract discipline lives in scripts/verify-public-api.mjs — if you change
// a field here, that script should have failed first.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developers — Thread',
  description:
    'The public read API for threads, agendas and listings, plus the embeddable widgets.',
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';
const HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

type Field = { name: string; type: string; note?: string };

function Fields({ rows }: { rows: Field[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-2 pr-4 font-normal">Field</th>
            <th className="py-2 pr-4 font-normal">Type</th>
            <th className="py-2 font-normal">Notes</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {rows.map((f) => (
            <tr key={f.name} className="border-b border-line/60">
              <td className="py-2 pr-4 font-mono text-xs">{f.name}</td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-subtle">{f.type}</td>
              <td className="py-2 text-xs text-ink-subtle leading-relaxed">{f.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-raised p-4 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

function Route({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h3 className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-subtle ring-1 ring-line">
          {method}
        </span>
        <span className="font-mono text-sm break-all">{path}</span>
      </h3>
      {children}
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header>
          <h1 className="text-2xl font-medium tracking-tight">Developers</h1>
          <p className="mt-2 text-sm text-ink-subtle leading-relaxed">
            Everything an organiser has published — threads, agendas, prices — is readable
            without a key, from any website. Two ways in: fetch the JSON and render it
            yourself, or drop in a widget and let us render it.
          </p>
        </header>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">The read API</h2>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            Base URL <code className="font-mono text-xs">{API}</code>. No key, no header, no
            sign-up. <code className="font-mono text-xs">GET</code> only, CORS open to every
            origin, so browser JavaScript can call these directly.
          </p>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            Only threads an organiser has actually made public appear. A draft or archived
            thread returns <code className="font-mono text-xs">404</code> even by direct link,
            and a thread that is public-by-link but not listed is reachable by its own URL and
            absent from the listing.
          </p>
        </section>

        <Route method="GET" path="/api/v1/thread/public/embed/threads">
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            A listing. Pass exactly one of <code className="font-mono text-xs">?organiser=</code>{' '}
            (slug), <code className="font-mono text-xs">?team=</code>,{' '}
            <code className="font-mono text-xs">?org=</code> or{' '}
            <code className="font-mono text-xs">?workspace=</code> (UUIDs); optionally{' '}
            <code className="font-mono text-xs">?format=event|journey</code> and/or{' '}
            <code className="font-mono text-xs">?category=&lt;slug&gt;</code> (the organiser's
            categories, from Settings) to narrow it. Sorted by start date, soonest first. Returns{' '}
            <code className="font-mono text-xs">{'{ items: [...] }'}</code>.
          </p>
          <Fields
            rows={[
              { name: 'id', type: 'uuid' },
              { name: 'slug', type: 'string' },
              {
                name: 'organiser_slug',
                type: 'string',
                note: 'The slug the public URL lives under — a team thread resolves under the TEAM, not the person.',
              },
              { name: 'organiser_name', type: 'string | null' },
              { name: 'title', type: 'string' },
              { name: 'format', type: "'event' | 'journey'" },
              { name: 'status', type: "'active' | 'completed'" },
              { name: 'starts_on', type: 'date | null', note: 'YYYY-MM-DD' },
              { name: 'ends_on', type: 'date | null' },
              { name: 'intention', type: 'string | null', note: 'Short description.' },
              { name: 'cover_url', type: 'string | null' },
              {
                name: 'price_cents',
                type: 'integer | null',
                note: 'Lowest active ticket if any exist, else the thread price. null means free.',
              },
              { name: 'price_currency', type: 'string | null', note: 'ISO 4217, e.g. EUR.' },
              { name: 'language', type: "'en' | 'nl' | 'es' | 'pt' | 'de'" },
              {
                name: 'public_interaction',
                type: "'page' | 'popup'",
                note: 'How the organiser wants this opened from a listing.',
              },
              {
                name: 'categories',
                type: '{name, slug}[]',
                note: 'The organiser-curated categories this thread belongs to.',
              },
              { name: 'url', type: 'string', note: 'Canonical public page.' },
            ]}
          />
        </Route>

        <Route method="GET" path="/api/v1/thread/public/organiser/:slug">
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            One organiser or team, plus their listed threads. Returns{' '}
            <code className="font-mono text-xs">
              {'{ organiser, threads, owner_kind }'}
            </code>
            , where <code className="font-mono text-xs">owner_kind</code> is{' '}
            <code className="font-mono text-xs">&apos;organiser&apos;</code> or{' '}
            <code className="font-mono text-xs">&apos;team&apos;</code> — the same slug
            namespace serves both.
          </p>
          <Fields
            rows={[
              { name: 'organiser.id', type: 'uuid' },
              { name: 'organiser.slug', type: 'string' },
              { name: 'organiser.display_name', type: 'string | null' },
              { name: 'organiser.bio', type: 'string | null' },
              { name: 'organiser.photo_url', type: 'string | null' },
              { name: 'organiser.timezone', type: 'IANA tz', note: 'e.g. Europe/Amsterdam' },
              {
                name: 'threads[]',
                type: 'object',
                note: 'id, slug, intention, cover_url, capacity, price_cents, price_currency, public_interaction, program',
              },
            ]}
          />
        </Route>

        <Route method="GET" path="/api/v1/thread/public/organiser/:slug/thread/:threadSlug">
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            One thread in full. Returns{' '}
            <code className="font-mono text-xs">{'{ organiser, thread }'}</code>.
          </p>
          <Fields
            rows={[
              { name: 'id', type: 'uuid' },
              { name: 'slug', type: 'string' },
              { name: 'intention', type: 'string | null' },
              { name: 'timezone', type: 'IANA tz', note: 'Agenda times are absolute; render in this zone.' },
              { name: 'language', type: "'en' | 'nl' | 'es' | 'pt' | 'de'" },
              { name: 'cover_url', type: 'string | null' },
              { name: 'capacity', type: 'integer | null', note: 'null means uncapped.' },
              {
                name: 'requires_approval',
                type: 'boolean',
                note: 'A place is requested, not taken. Say so before someone registers.',
              },
              { name: 'certificate_enabled', type: 'boolean' },
              { name: 'share_participants_public', type: 'boolean' },
              {
                name: 'categories',
                type: '{name, slug}[]',
                note: 'The organiser-curated categories this thread belongs to.',
              },
              {
                name: 'public_agenda',
                type: 'boolean',
                note: 'Whether this thread shows an agenda at all. When false, agenda is always [].',
              },
              {
                name: 'registration_fields',
                type: 'object[]',
                note: 'What the enrol form asks for. Read-only here — see below on registering.',
              },
              { name: 'price_cents', type: 'integer | null' },
              { name: 'price_currency', type: 'string | null' },
              { name: 'payment_methods', type: "('stripe' | 'invoice')[]", note: 'Already filtered to what can actually work for this thread.' },
              { name: 'program', type: 'object | null', note: 'title, format, status, starts_on, ends_on' },
              { name: 'tickets', type: 'object[]', note: 'id, name, description, price_cents, price_currency, payment_methods, sold_out' },
              { name: 'agenda', type: 'object[]', note: 'Published, agenda-visible sessions only.' },
              { name: 'agenda[].is_online', type: 'boolean', note: 'The join link itself is never returned.' },
              { name: 'enrolled_count', type: 'integer' },
              { name: 'enrolment_open', type: 'boolean' },
              {
                name: 'participants',
                type: 'string[]',
                note: 'First names only, and only for people who opted into the cohort directory. Usually empty.',
              },
            ]}
          />
        </Route>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-14">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">
            Registration is not part of this API
          </h2>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            You can read everything about a thread and you cannot register anyone into it.
            That is deliberate, not a gap we mean to close.
          </p>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            Registering collects someone&apos;s name and email. We are not willing for that to
            happen in a form living in another site&apos;s page, where every script on that
            page can read the keystrokes. So the enrol form stays on our origin — either the
            hosted thread page, or the popup the <code className="font-mono text-xs">enrol</code>{' '}
            widget opens over your site. Both take the registration without the visitor leaving
            what they were reading.
          </p>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            If you are building an app that needs to create and manage threads rather than
            display them, that is a different surface: register the app and hold a scoped key.
            Even there, no scope grants writing an enrolment — registration only ever comes from
            the person registering.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-14">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">Limits</h2>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            60 requests per minute per IP, for browser traffic from origins that aren&apos;t
            ours. Responses carry{' '}
            <code className="font-mono text-xs">X-RateLimit-Remaining</code> and{' '}
            <code className="font-mono text-xs">X-RateLimit-Reset</code> (seconds); over the
            limit you get <code className="font-mono text-xs">429</code> and a{' '}
            <code className="font-mono text-xs">Retry-After</code>. If you are rendering server
            side, cache — nothing here changes by the second.
          </p>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            <strong className="font-medium text-ink">These fields are stable.</strong> We add to
            these responses; we do not rename, remove, retype or quietly re-mean what is already
            here. A breaking change would arrive as a new versioned path beside this one, not as
            a change to it.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-14">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">Widgets</h2>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            If you would rather not render it yourself. One script, then a div wherever you want
            something. Each widget is an auto-sizing frame; the enrol one is a button that opens
            the registration form in an overlay.
          </p>
          <Code>{`<script src="${HOST}/embed.js" defer></script>

<!-- an organiser's public threads -->
<div data-thread-embed="list" data-organiser="your-slug"></div>

<!-- one thread, chosen sections -->
<div data-thread-embed="thread" data-organiser="your-slug"
     data-thread="your-thread" data-elements="cover,intention,agenda,price,enrol"></div>

<!-- one thread as a compact card: image, title, date, price, button -->
<div data-thread-embed="card" data-organiser="your-slug" data-thread="your-thread"></div>

<!-- same card with the registration form already open inside it -->
<div data-thread-embed="card" data-organiser="your-slug" data-thread="your-thread"
     data-form="1"></div>

<!-- registration from any button -->
<a href="#" data-thread-embed="enrol" data-organiser="your-slug"
   data-thread="your-thread">Register</a>`}</Code>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            <code className="font-mono text-xs">data-lang</code> forces a language (
            <code className="font-mono text-xs">en nl es pt de</code>); without it a thread
            widget follows the thread&apos;s own. Swap{' '}
            <code className="font-mono text-xs">data-organiser</code> for{' '}
            <code className="font-mono text-xs">data-team</code>,{' '}
            <code className="font-mono text-xs">data-org</code> or{' '}
            <code className="font-mono text-xs">data-workspace</code> to widen a listing, and add{' '}
            <code className="font-mono text-xs">data-format=&quot;event|journey&quot;</code> to
            narrow it to one kind, <code className="font-mono text-xs">data-category</code> to one
            category. Every
            element inside carries a <code className="font-mono text-xs">te-</code> class: put a{' '}
            <code className="font-mono text-xs">&lt;style&gt;</code> block inside the div and it
            is lifted into the frame. Organisers get the full class reference, pre-filled with
            their own slugs, under Settings → Website embeds.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-14">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">
            One thing worth knowing
          </h2>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            A widget&apos;s content lives in a frame, so search engines attribute it to us, not
            to your page. If you want a programme to rank on your own domain, fetch the JSON and
            render it server-side — that is the case the read API is for.
          </p>
        </section>

        <footer className="mt-16 border-t border-line pt-6 text-xs text-ink-muted">
          Questions, or something here is wrong? <span className="font-medium">Thread</span>{' '}
          · The Fibre
        </footer>
      </main>
    </div>
  );
}
