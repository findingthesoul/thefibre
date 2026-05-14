import Link from 'next/link';
import { SignInButton } from './sign-in-button';

const apps = [
  { slug: 'fibre-meet', name: 'Fibre Meet', desc: 'Meeting platform — agenda, facilitation, outcomes.', status: 'Active' },
  { slug: 'the-thread', name: 'The Thread', desc: 'Events and journeys — conferences and personal arcs.', status: 'Active' },
  { slug: 'fibre-sales', name: 'Fibre Sales', desc: 'Sales pipeline and account management.', status: 'Building' },
  { slug: 'fibre-learn', name: 'Fibre Learn', desc: 'Self-paced content — modules and assessments.', status: 'Planned' },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-medium tracking-tight">The Fibre</h1>
      <p className="mt-3 text-ink-subtle text-lg">
        Relationship intelligence for purpose-driven work. EU-hosted. GDPR-native. Cooperative-owned.
      </p>

      <div className="mt-10 flex items-center gap-3">
        <SignInButton />
        <Link href="/dashboard" className="text-sm text-ink-subtle hover:text-ink">
          Already signed in? Open dashboard →
        </Link>
      </div>

      <section className="mt-16">
        <h2 className="text-[10px] uppercase tracking-wider text-ink-muted">Apps</h2>
        <ul className="mt-4 divide-y divide-line">
          {apps.map((app) => (
            <li key={app.slug} className="py-4 flex items-baseline justify-between gap-6">
              <div>
                <div className="font-medium">{app.name}</div>
                <div className="text-sm text-ink-subtle">{app.desc}</div>
              </div>
              <span className="text-xs text-ink-muted">{app.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 border-t border-line pt-6 text-xs text-ink-muted leading-relaxed">
        thefibre.app · One Soul Community Coöperatief U.A. · Hosted in the EU
        <br />
        No advertising. No profiling. No data sold. <Link className="underline" href="/privacy">Privacy</Link>.
      </footer>
    </main>
  );
}
