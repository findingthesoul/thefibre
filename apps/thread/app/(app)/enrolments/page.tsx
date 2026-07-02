import Link from 'next/link';
import { X } from 'lucide-react';
import { IssueCertButton, BulkIssueButton } from './certificate-actions';
import { apiFetch, ApiError } from '@/lib/api';
import { one } from '@/lib/thread-types';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';

type EnrolmentItem = {
  id: string;
  thread_id: string;
  payment_status: string;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
  person:
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
  enrolment:
    | { status: string; progress_pct: number; enrolled_at: string | null }
    | { status: string; progress_pct: number; enrolled_at: string | null }[]
    | null;
  certificate:
    | { certificate_number: string }
    | { certificate_number: string }[]
    | null;
  thread:
    | {
        id: string;
        slug: string;
        certificate_enabled?: boolean;
        program: { title: string } | { title: string }[] | null;
      }
    | {
        id: string;
        slug: string;
        certificate_enabled?: boolean;
        program: { title: string } | { title: string }[] | null;
      }[]
    | null;
};

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-surface-sunken text-ink-subtle ring-line',
  enrolled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  dropped: 'bg-surface-sunken text-ink-muted ring-line',
};

const PAYMENT_LABELS: Record<string, string> = {
  not_required: 'Free',
  pending: 'Payment pending',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

export default async function EnrolmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadFilter } = await searchParams;
  let items: EnrolmentItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: EnrolmentItem[] }>(
      threadFilter
        ? `/api/v1/thread/enrolments?thread_id=${encodeURIComponent(threadFilter)}`
        : '/api/v1/thread/enrolments',
    );
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Title of the filtered thread, resolved from the first item's join.
  const filteredTitle = threadFilter
    ? (one(one(items[0]?.thread ?? null)?.program ?? null)?.title ?? null)
    : null;

  return (
    <PageContainer>
      <PageHeader
        title="Enrolments"
        description="Everyone enrolled across your threads."
      />

      {error && <ErrorBanner>Couldn&apos;t load enrolments: {error}</ErrorBanner>}

      {threadFilter && filteredTitle && (
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-subtle">
            Filtered: {filteredTitle}
            <Link
              href="/enrolments"
              aria-label="Clear thread filter"
              className="text-ink-muted hover:text-ink"
            >
              <X size={12} strokeWidth={1.75} />
            </Link>
          </span>
          {one(items[0]?.thread ?? null)?.certificate_enabled && (
            <BulkIssueButton threadId={threadFilter} />
          )}
        </div>
      )}

      {!error && items.length === 0 && (
        <EmptyState>
          No enrolments yet. Publish a thread and share its public page —
          sign-ups land here.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const person = one(it.person);
            const enr = one(it.enrolment);
            const thread = one(it.thread);
            const program = thread ? one(thread.program) : null;
            const name =
              [person?.first_name, person?.last_name].filter(Boolean).join(' ') ||
              person?.email ||
              'Unknown';
            const status = enr?.status ?? 'enrolled';
            return (
              <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-ink-subtle mt-0.5 truncate">
                    {person?.email}
                    {program?.title ? (
                      <>
                        {' · '}
                        <Link
                          href={`/threads/${thread?.id}`}
                          className="hover:text-ink underline-offset-2 hover:underline"
                        >
                          {program.title}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                {thread?.certificate_enabled && (
                  <IssueCertButton
                    enrolmentId={it.id}
                    certificateNumber={one(it.certificate)?.certificate_number ?? null}
                  />
                )}
                <span className="text-xs text-ink-muted shrink-0">
                  {PAYMENT_LABELS[it.payment_status] ?? it.payment_status}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                    STATUS_STYLES[status] ?? STATUS_STYLES.enrolled
                  }`}
                >
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
