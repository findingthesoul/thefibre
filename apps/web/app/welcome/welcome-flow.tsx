'use client';

// The first-login settings sequence (Sjoerd 2026-09-07: "when you login for
// the first time, you go through a sequence of settings"). Two steps, both
// of them the EXISTING settings surfaces — the sequence is presentation,
// not new configuration screens (onboarding proposal's rule). Each step
// saves through its own form; Continue only advances. Skippable at every
// point: the flow must never trap anyone.

import { useState, useTransition } from 'react';
import { ProfileForm, type PublicProfile } from '../(app)/settings/profile/profile-form';
import { LanguagePicker } from '../(app)/settings/profile/language-picker';
import { t, type Locale } from '@/lib/i18n-ui';
import { finishWelcome } from './actions';

export function WelcomeFlow({
  profile,
  email,
  locale,
}: {
  profile: PublicProfile;
  email: string;
  locale: Locale;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const done = () => startTransition(async () => void (await finishWelcome()));

  const steps = [
    {
      title: t(locale, 'welcome_step_profile'),
      desc: t(locale, 'welcome_step_profile_desc'),
      body: <ProfileForm profile={profile} email={email} locale={locale} />,
    },
    {
      title: t(locale, 'welcome_step_language'),
      desc: t(locale, 'welcome_step_language_desc'),
      body: <LanguagePicker initial={profile.locale ?? null} locale={locale} />,
    },
  ];
  // step is clamped by construction (only ever set to step + 1 below last).
  const current = steps[step] ?? steps[0]!;
  const last = step === steps.length - 1;

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {t(locale, 'step_of', { n: step + 1, total: steps.length })}
      </div>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">
        {t(locale, 'welcome_headline')}
      </h1>
      <p className="mt-2 text-sm text-ink-subtle">{t(locale, 'welcome_intro')}</p>

      <section className="mt-10 rounded-xl border border-line bg-surface-raised p-6">
        <h2 className="text-lg font-medium">{current.title}</h2>
        <p className="mt-1 text-sm text-ink-subtle">{current.desc}</p>
        <div className="mt-6">{current.body}</div>
      </section>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={done}
          disabled={pending}
          className="text-sm text-ink-muted hover:text-ink underline underline-offset-2 disabled:opacity-50"
        >
          {t(locale, 'skip_for_now')}
        </button>
        <button
          type="button"
          onClick={() => (last ? done() : setStep(step + 1))}
          disabled={pending}
          className="rounded-md bg-ink text-surface px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {last ? t(locale, 'to_my_apps') : t(locale, 'continue_label')}
        </button>
      </div>
    </div>
  );
}
