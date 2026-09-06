import Link from 'next/link';
import { appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

// Flow had no settings page at all — the sidebar's gear went nowhere, which
// is its own kind of mystery meat. It has no settings of its own yet, and
// that is fine: what it needs is the same four sections as everywhere else,
// so the gear lands somewhere recognisable.

export default async function SettingsPage() {
  const locale = await uiLocale();
  const sections = platformSettings({
    locale,
    fibreUrl: appUrl('fibre-platform', process.env),
    omit: ['payments', 'connections'],
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t(locale, 'settings')}</h1>
      <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'settings_blurb')}</p>
      <SettingsCards sections={sections} link={Link} locale={locale} />
    </div>
  );
}
