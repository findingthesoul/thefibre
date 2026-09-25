import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import type { ModelRow } from '../actions';
import { ModelView } from '@/components/models/model-view';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const m = await apiFetch<ModelRow>(`/api/v1/models/${id}`);
    return { title: `${m.name} — Business models` };
  } catch {
    return { title: 'Business models' };
  }
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await uiLocale();
  let model: ModelRow;
  try {
    model = await apiFetch<ModelRow>(`/api/v1/models/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  return <ModelView model={model} locale={locale} />;
}
