import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  createBreadcrumb,
} from '@thefibre/shared/ui/page';
import { appUrl } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Notes, type Note } from './notes';

const Breadcrumb = createBreadcrumb(Link);

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

// One person: who they are, what has been said, and the box to say the next
// thing. Connections owns no person data — the identity shown here is the
// platform's, and the full profile lives there. What this page adds is the
// only thing in the app that cannot be derived: a note somebody typed.
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await uiLocale();

  let person: Person | null = null;
  let personError: string | null = null;
  let notes: Note[] = [];
  let notesError: string | null = null;

  const [p, n] = await Promise.allSettled([
    apiFetch<Person>(`/api/v1/persons/${id}`),
    apiFetch<{ items: Note[] }>(`/api/v1/notes?person_id=${id}&limit=100`),
  ]);

  if (p.status === 'fulfilled') person = p.value;
  else personError = p.reason instanceof ApiError ? `API ${p.reason.status}` : 'unknown error';

  if (n.status === 'fulfilled') notes = n.value.items;
  else notesError = n.reason instanceof ApiError ? `API ${n.reason.status}` : 'unknown error';

  const name =
    person &&
    ([person.first_name, person.last_name].filter(Boolean).join(' ').trim() ||
      person.email ||
      person.id.slice(0, 8));

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/people" label={t(locale, 'nav_people')} />

      {personError && <ErrorBanner>{t(locale, 'person_load_failed')} {personError}</ErrorBanner>}

      {person && (
        <>
          <PageHeader title={name} description={person.email ?? undefined} />
          <a
            href={`${appUrl('fibre-platform', process.env)}/contacts/${person.id}`}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
          >
            {t(locale, 'person_open_in_fibre')}
            <ExternalLink size={12} strokeWidth={1.75} />
          </a>

          {notesError && <ErrorBanner>{t(locale, 'notes_load_failed')} {notesError}</ErrorBanner>}

          <Notes personId={person.id} personName={name ?? ''} notes={notes} locale={locale} />
        </>
      )}
    </PageContainer>
  );
}
