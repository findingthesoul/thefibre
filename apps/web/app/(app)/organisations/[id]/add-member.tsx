'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { PersonCombobox } from '@/components/ui/person-combobox';
import { DateField } from '@/components/ui/date-field';
import { addMember, type ActionResult } from './member-actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const employmentTypeOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'permanent', label: t(locale, 'employment_permanent') },
  { value: 'interim', label: t(locale, 'employment_interim') },
  { value: 'consultant', label: t(locale, 'employment_consultant') },
  { value: 'board', label: t(locale, 'seniority_board') },
  { value: 'volunteer', label: t(locale, 'employment_volunteer') },
];

const influenceOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'formal', label: t(locale, 'influence_formal') },
  { value: 'informal', label: t(locale, 'influence_informal') },
  { value: 'both', label: t(locale, 'influence_both') },
];

export function AddMemberButton({
  orgId,
  people,
  exclude = [],
  locale,
}: {
  orgId: string;
  people: PersonOption[];
  /** Already members — not offered again, seeded or searched. */
  exclude?: string[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addMember(orgId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        setOpen(false);
        setState({});
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        leading={<UserPlus size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        {t(locale, 'add_member')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t(locale, 'add_member')}
        description={t(locale, 'add_member_blurb')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="submit" form="add-member-form" disabled={pending}>
              {pending ? t(locale, 'adding') : t(locale, 'add_member')}
            </Button>
          </>
        }
      >
        <form id="add-member-form" onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <PersonCombobox
              label={t(locale, 'person')}
              name="person_id"
              required
              people={people}
              exclude={exclude}
              errors={state.fieldErrors?.person_id}
            />
          </div>
          <TextField label={t(locale, 'title_label')} name="title" placeholder="Head of Programmes" />
          <TextField label={t(locale, 'department')} name="department" />
          <SelectField label={t(locale, 'employment_type')} name="employment_type" options={employmentTypeOptions(locale)} />
          <SelectField label={t(locale, 'influence')} name="influence_level" options={influenceOptions(locale)} />
          <DateField label={t(locale, 'started')} name="started_at" />

          <fieldset className="md:col-span-2 mt-2 space-y-2 text-sm">
            <Checkbox name="is_primary" label={t(locale, 'primary_contact_org')} />
            <Checkbox name="is_decision_maker" label={t(locale, 'decision_maker')} />
            <Checkbox name="is_budget_holder" label={t(locale, 'budget_holder')} />
            <Checkbox name="is_champion" label={t(locale, 'champion')} />
          </fieldset>

          {state.error && (
            <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
              {state.error}
            </div>
          )}
        </form>
      </Dialog>
    </>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" name={name} className="rounded border-line" />
      <span>{label}</span>
    </label>
  );
}
