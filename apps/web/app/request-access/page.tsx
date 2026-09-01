import { RequestAccessForm, type PackageOption } from './form';
import Link from 'next/link';

// The form asks WHICH product — arriving from a /pricing card preselects it
// (?plan=starter). The catalogue comes from the same public endpoint the
// pricing page renders, so the names and prices here can't drift.

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

async function loadPackages(): Promise<PackageOption[]> {
  try {
    const r = await fetch(`${apiBase}/api/v1/public/plans`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      plans: { id: string; name: string; price_cents_month: number }[];
    };
    return data.plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceLabel:
        p.id === 'org'
          ? 'talk to us'
          : p.price_cents_month === 0
            ? 'free'
            : `€${Math.round(p.price_cents_month / 100)}/mo`,
    }));
  } catch {
    return [];
  }
}

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const packages = await loadPackages();
  const preselected = packages.some((p) => p.id === plan) ? plan! : null;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← The Fibre
        </Link>

        <h1 className="mt-8 text-3xl font-medium tracking-tight">Request access</h1>
        <p className="mt-3 text-neutral-600 leading-relaxed">
          The Fibre is invitation-only while we onboard partners and pilot
          organisations. Tell us a little about yourself; we&apos;ll be in touch
          once your account is ready.
        </p>

        <div className="mt-10">
          <RequestAccessForm packages={packages} preselected={preselected} />
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          Already invited?{' '}
          <Link href="/" className="underline">
            Go back and sign in
          </Link>
          {' '}· Wondering what it costs?{' '}
          <Link href="/pricing" className="underline">
            See pricing
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
