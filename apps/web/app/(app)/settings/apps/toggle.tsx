'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { activateApp, deactivateApp } from './actions';

export function AppToggle({ slug, active }: { slug: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    setError(null);
    start(async () => {
      const r = active ? await deactivateApp(slug) : await activateApp(slug);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex items-center gap-3">
        <span
          className={`text-[10px] uppercase tracking-wider ${
            active ? 'text-emerald-700' : 'text-ink-muted'
          }`}
        >
          {active ? 'Active' : 'Not active'}
        </span>
        <Button
          variant={active ? 'secondary' : 'primary'}
          size="sm"
          onClick={toggle}
          disabled={pending}
        >
          {pending ? 'Working…' : active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
