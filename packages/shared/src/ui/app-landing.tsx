// The signed-out landing page shared by the app frontends (Meet, Thread,
// Flow, Pulse, Membership). The chrome converges here; the voice stays per
// app — headline, intro and the four feature cards are props, written in
// each app's own page.tsx. The Fibre's own landing (apps/web) is bespoke
// (pricing, trial chip, app family) and deliberately not this component.
//
// Server component. The auth redirect ("already signed in → dashboard")
// stays in the app's page, as does its SignInButton (app-local Supabase) —
// injected via `signIn`. Shared has no next/node dependency (house rule),
// so the page computes fibreUrl itself — `appUrl('fibre-platform',
// process.env)`, exactly as the old copies did — and passes it in; the
// footer link is a plain <a> (cross-origin anyway).

import type { ReactNode } from 'react';
import { APPS, ENTITY } from '../branding.js';
import type { AppId } from '../index.js';

export type AppLandingFeature = { title: string; body: string };

export function AppLanding({
  appSlug,
  headline,
  intro,
  features,
  signIn,
  fibreUrl,
}: {
  appSlug: AppId;
  headline: string;
  intro: ReactNode;
  features: AppLandingFeature[];
  signIn: ReactNode;
  /** appUrl('fibre-platform', process.env), computed in the app's page. */
  fibreUrl: string;
}) {
  const app = APPS[appSlug];
  const fibre = APPS['fibre-platform'];

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {app.name}
        </div>
        <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
          {headline}
        </h1>
        <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
          {intro}
        </p>

        <div className="mt-10">{signIn}</div>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="text-base font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(app.url).host} · part of{' '}
          <a href={fibreUrl} className="underline">
            {fibre.name}
          </a>{' '}
          · {ENTITY.name} · {ENTITY.hostedLine}
        </footer>
      </div>
    </main>
  );
}
