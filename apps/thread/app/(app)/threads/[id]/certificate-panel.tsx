'use client';

// Certificate tab in thread settings — enable + pick from the template
// list (designed under /certificates) + criteria text.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { updateThread } from '../actions';
import type { ThreadRow } from '@/lib/thread-types';
import { TextField, SelectField } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/switch';

export function CertificatePanel({
  locale,
  thread,
  certTemplates,
  onSaved,
}: {
  locale: Locale;
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
    // Saved from the shared dialog footer (submits by form id).
    <form id="thread-certificate-form" onSubmit={onSubmit} className="space-y-5">
      <SwitchField
        label={t(locale, 'award_certificate')}
        checked={enabled}
        onChange={setEnabled}
      />

      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label={t(locale, 'template')}
            name="certificate_template_id"
            defaultValue={thread.certificate_template_id ?? ''}
            options={[
              {
                value: '',
                label: certTemplates.length
                  ? t(locale, 'choose_template')
                  : t(locale, 'no_templates_yet'),
              },
              ...certTemplates.map((t) => ({ value: t.id, label: t.name })),
            ]}
            hint={
              <>
                {t(locale, 'designed_under')}{' '}
                <a href="/certificates" className="underline underline-offset-2 hover:text-ink">
                  {t(locale, 'certificates')}
                </a>
                .
              </>
            }
          />
          <TextField
            label={t(locale, 'criteria_label')}
            name="certificate_criteria"
            defaultValue={thread.certificate_criteria ?? ''}
            placeholder={t(locale, 'criteria_placeholder')}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {(pending || saved) && (
        <p className="text-sm text-ink-subtle">
          {pending ? t(locale, 'saving') : t(locale, 'saved')}
        </p>
      )}
    </form>
  );
}
