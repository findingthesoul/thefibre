const apps = [
  { slug: 'fibre-suite', name: 'Fibre Suite', desc: 'Meeting platform — agenda, facilitation, outcomes.', status: 'Active' },
  { slug: 'the-thread', name: 'The Thread', desc: 'Events and journeys — conferences and personal arcs.', status: 'Active' },
  { slug: 'fibre-sales', name: 'Fibre Sales', desc: 'Sales pipeline and account management.', status: 'Building' },
  { slug: 'fibre-learn', name: 'Fibre Learn', desc: 'Self-paced content — modules and assessments.', status: 'Planned' },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-medium tracking-tight">The Fibre</h1>
      <p className="mt-3 text-ink-500 text-lg">
        Relationship intelligence for purpose-driven work. EU-hosted. GDPR-native. Cooperative-owned.
      </p>

      <section className="mt-16">
        <h2 className="text-sm uppercase tracking-wider text-ink-500">Apps</h2>
        <ul className="mt-4 divide-y divide-ink-700/10">
          {apps.map((app) => (
            <li key={app.slug} className="py-4 flex items-baseline justify-between gap-6">
              <div>
                <div className="font-medium">{app.name}</div>
                <div className="text-sm text-ink-500">{app.desc}</div>
              </div>
              <span className="text-xs text-ink-500">{app.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 border-t border-ink-700/10 pt-6 text-xs text-ink-500">
        thefibre.app · One Soul Community Coöperatief U.A. · Hosted in the EU
      </footer>
    </main>
  );
}
