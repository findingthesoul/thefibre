'use client';

// Certificate tab in thread settings — enable + pick from the template
// list (designed under /certificates) + criteria text.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateThread } from '../actions';
import type { ThreadRow } from '@/lib/thread-types';
import { TextField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export function CertificatePanel({
  thread,
  certTemplates,
  onSaved,
}: {
  thread: ThreadRow;
  certTemplates: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(thread.certificate_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateThread(thread.id, {
        certificate_enabled: enabled,
        certificate_template_id: String(fd.get('certificate_template_id') ?? '') || null,
        certificate_criteria: String(fd.get('certificate_criteria') ?? '').trim() || null,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-ink-subtle">Award a certificate on completion</span>
      </label>

      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Template"
            name="certificate_template_id"
            defaultValue={thread.certificate_template_id ?? ''}
            options={[
              {
                value: '',
                label: certTemplates.length ? 'Choose a template…' : 'No templates yet',
              },
              ...certTemplates.map((t) => ({ value: t.id, label: t.name })),
            ]}
            hint={
              <>
                Designed under{' '}
                <a href="/certificates" className="underline underline-offset-2 hover:text-ink">
                  Certificates
                </a>
                .
              </>
            }
          />
          <TextField
            label="Criteria / awarded for"
            name="certificate_criteria"
            defaultValue={thread.certificate_criteria ?? ''}
            placeholder="Completed all sessions"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save certificate'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </form>
  );
}
