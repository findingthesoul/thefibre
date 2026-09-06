import { Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ContactsList, type Run } from './contacts-list';

export const metadata = { title: 'Contacts — Flow' };

export default async function ContactsPage() {
  const locale = await uiLocale();
  let runs: Run[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: Run[] }>('/api/v1/flow/runs?status=active');
    runs = r.items;
  } catch {
    loadError = t(locale, 'load_contacts_failed');
  }

  return (
    <div className="px-6 py-10 max-w-3xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">
        {t(locale, 'contacts_in_motion')}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{t(locale, 'contacts_page_blurb')}</p>

      {loadError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && runs.length === 0 && (
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Users size={22} strokeWidth={1.5} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{t(locale, 'nobody_in_flow')}</h2>
          <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto">
            {t(locale, 'nobody_in_flow_blurb')}
          </p>
        </div>
      )}

      {runs.length > 0 && <ContactsList runs={runs} locale={locale} />}
    </div>
  );
}
