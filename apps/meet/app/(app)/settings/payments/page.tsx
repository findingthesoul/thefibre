import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  ErrorBanner,
} from '@/components/ui/page';
import { PaymentsForm } from './form';

type Host = {
  stripe_account_id: string | null;
};

export default async function PaymentsPage() {
  let host: Host | null = null;
  let error: string | null = null;
  try {
    host = await apiFetch<Host>('/api/v1/meet/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Payments"
        description="Connect your Stripe account so paid meeting types can collect payment. Money flows direct to your Stripe — we never touch it."
      />
      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}
      {host && (
        <div className="mt-10">
          <PaymentsForm initial={host} />
        </div>
      )}
    </PageContainer>
  );
}
