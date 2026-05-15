import { apiFetch, ApiError } from '@/lib/api';
import { SettingsForm } from './form';

type Host = {
  id: string;
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  timezone: string;
  photo_url: string | null;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export default async function SettingsPage() {
  let host: Host | null = null;
  let error: string | null = null;
  try {
    host = await apiFetch<Host>('/api/v1/meet/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-ink-subtle">
        How you appear on your public booking page.
      </p>

      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Couldn&apos;t load: {error}
        </div>
      )}

      {host && (
        <div className="mt-10">
          <SettingsForm initial={host} />
        </div>
      )}
    </div>
  );
}
