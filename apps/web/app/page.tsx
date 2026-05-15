import Link from 'next/link';
import { SignInLink } from './sign-in-button';
import { APPS, ENTITY } from '@thefibre/shared';

const FIBRE = APPS['fibre-platform'];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <header>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{FIBRE.name}</div>
          <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
            Relationships, kept honestly.
          </h1>
          <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
            A platform for the people, organisations and programmes behind
            purpose-driven work. EU-hosted, GDPR-native, cooperative-owned.
            One place for the relationships your work depends on — without
            the surveillance most software adds.
          </p>

          <div className="mt-10 flex items-center gap-5">
            <Link
              href="/request-access"
              className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
            >
              Request access
            </Link>
            <SignInLink />
          </div>
        </header>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="One profile per person"
            body="The same contact across meetings, journeys, sales and learning — one identity, kept in the EU, owned by you."
          />
          <Feature
            title="Apps that earn their data"
            body="Every field stored on a person exists because a specific app needs it. No “might be useful later”. GDPR Article 5(1)(c) by construction."
          />
          <Feature
            title="The data wall"
            body="Each app keeps its own content. Only short event records (“meeting attended”, “session completed”) cross the wall. Sensitive notes never leave."
          />
          <Feature
            title="Independently owned"
            body={`${ENTITY.name} — built to last, not to flip. No advertising, no profiling, no third-party trackers.`}
          />
        </section>

        <section className="mt-20">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            What it currently does
          </div>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700 leading-relaxed">
            <li>· Identity, contact graph, organisations and programmes</li>
            <li>· Per-app profile tabs that appear only when an app has data on the person</li>
            <li>· Activity timeline across all installed apps</li>
            <li>· Privacy dashboard — consents, erasure, full transparency</li>
            <li>· Fibre Meet (formerly Suite) and The Thread coming as first-party apps</li>
          </ul>
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(FIBRE.url).host} · {ENTITY.name} · {ENTITY.hostedLine}
          <br />
          No advertising. No profiling. No data sold.{' '}
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
