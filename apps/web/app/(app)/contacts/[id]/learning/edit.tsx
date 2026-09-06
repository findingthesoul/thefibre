'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateLearning, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type LearningRow = {
  learning_interests: string[] | null;
  prior_programmes: string[] | null;
  learning_style: string | null;
  group_role_tendency: string | null;
  development_goals: string | null;
  post_programme_reflection: string | null;
  open_to_coaching: boolean | null;
  open_to_peer_exchange: boolean | null;
};

const learningStyleOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'visual', label: t(locale, 'learning_visual') },
  { value: 'auditory', label: t(locale, 'learning_auditory') },
  { value: 'reading', label: t(locale, 'learning_reading') },
  { value: 'kinaesthetic', label: t(locale, 'learning_kinaesthetic') },
  { value: 'reflective', label: t(locale, 'learning_reflective') },
];

const groupRoleOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'connector', label: t(locale, 'group_connector') },
  { value: 'challenger', label: t(locale, 'group_challenger') },
  { value: 'synthesiser', label: t(locale, 'group_synthesiser') },
  { value: 'anchor', label: t(locale, 'group_anchor') },
  { value: 'observer', label: t(locale, 'group_observer') },
];

const yesNoOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'true', label: t(locale, 'yes') },
  { value: 'false', label: t(locale, 'no') },
];

function boolToSelect(v: boolean | null): string {
  if (v === true) return 'true';
  if (v === false) return 'false';
  return '';
}

export function LearningEdit({
  personId,
  initial,
  locale,
}: {
  personId: string;
  initial: LearningRow | null;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leading={<Pencil size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        {t(locale, 'edit')}
      </Button>
      <EditDialog
        open={open}
        onClose={() => setOpen(false)}
        personId={personId}
        initial={initial}
        locale={locale}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  personId,
  initial,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  initial: LearningRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateLearning(personId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'edit_learning_profile')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="learning-profile-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="learning-profile-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'learning_style')}
          name="learning_style"
          defaultValue={initial?.learning_style ?? ''}
          options={learningStyleOptions(locale)}
          errors={state.fieldErrors?.learning_style}
        />
        <SelectField
          label={t(locale, 'group_role_tendency')}
          name="group_role_tendency"
          defaultValue={initial?.group_role_tendency ?? ''}
          options={groupRoleOptions(locale)}
          errors={state.fieldErrors?.group_role_tendency}
        />
        <SelectField
          label={t(locale, 'open_to_coaching')}
          name="open_to_coaching"
          defaultValue={boolToSelect(initial?.open_to_coaching ?? null)}
          options={yesNoOptions(locale)}
          errors={state.fieldErrors?.open_to_coaching}
        />
        <SelectField
          label={t(locale, 'open_to_peer_exchange')}
          name="open_to_peer_exchange"
          defaultValue={boolToSelect(initial?.open_to_peer_exchange ?? null)}
          options={yesNoOptions(locale)}
          errors={state.fieldErrors?.open_to_peer_exchange}
        />
        <TextField
          label={t(locale, 'learning_interests')}
          name="learning_interests"
          defaultValue={(initial?.learning_interests ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.learning_interests}
        />
        <TextField
          label={t(locale, 'prior_programmes')}
          name="prior_programmes"
          defaultValue={(initial?.prior_programmes ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.prior_programmes}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'development_goals')}
            name="development_goals"
            defaultValue={initial?.development_goals ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.development_goals}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={
              <>
                {t(locale, 'post_programme_reflection')}
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'participant_owned')}
                </span>
              </>
            }
            name="post_programme_reflection"
            defaultValue={initial?.post_programme_reflection ?? ''}
            maxLength={5000}
            hint={t(locale, 'reflection_hint')}
            errors={state.fieldErrors?.post_programme_reflection}
          />
        </div>

        {state.error && (
          <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {state.error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
