'use client';

import { useState, useTransition } from 'react';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { createPersonFromPicker } from '@/lib/person-actions';
import { PhoneInput } from '@thefibre/shared/ui/contact-points';
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
  defaultOpen = false,
}: {
  /** Open on arrival — the step after Add organisation. */
  defaultOpen?: boolean;
  orgId: string;
  people: PersonOption[];
  /** Already members — not offered again, seeded or searched. */
  exclude?: string[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});
  // Search → pick, or keep typing → "Add … as a new person" → the same dialog
  // asks for their details, creates the contact, and comes back with them
  // selected (Sjoerd, 2026-09-15).
  const [personId, setPersonId] = useState('');
  const [created, setCreated] = useState<PersonOption[]>([]);
  const [draft, setDraft] = useState<NewPersonDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<ActionResult>({});

  function close() {
    if (pending) return;
    setOpen(false);
    setDraft(null);
    setDraftErrors({});
    // Drop ?add=member so a refresh does not reopen it.
    if (defaultOpen) router.replace(`/organisations/${orgId}`, { scroll: false });
  }

  function saveDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    start(async () => {
      const res = await createPersonFromPicker(draft);
      if (!res.ok) {
        setDraftErrors({ error: res.error, fieldErrors: res.fieldErrors });
        return;
      }
      setCreated((list) => [res.person, ...list]);
      setPersonId(res.person.id);
      setDraft(null);
      setDraftErrors({});
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addMember(orgId, {}, fd);
      setState(res);
      if (res.ok) {
        setState({});
        setPersonId('');
        close();
        router.refresh();
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
        onClose={close}
        title={draft ? t(locale, 'add_person') : t(locale, 'add_member')}
        description={draft ? t(locale, 'new_person_blurb') : t(locale, 'add_member_blurb')}
        size="lg"
        footer={
          draft ? (
            <>
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={pending}>
                {t(locale, 'cancel')}
              </Button>
              <Button type="submit" form="new-person-form" disabled={pending}>
                {pending ? t(locale, 'saving') : t(locale, 'add_person')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close} disabled={pending}>
                {t(locale, 'cancel')}
              </Button>
              <Button type="submit" form="add-member-form" disabled={pending}>
                {pending ? t(locale, 'adding') : t(locale, 'add_member')}
              </Button>
            </>
          )
        }
      >
        {draft && (
          <form id="new-person-form" onSubmit={saveDraft} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label={t(locale, 'first_name')} value={draft.first_name} required autoFocus
              onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
              errors={draftErrors.fieldErrors?.first_name} />
            <TextField label={t(locale, 'last_name')} value={draft.last_name} required
              onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
              errors={draftErrors.fieldErrors?.last_name} />
            <TextField label={t(locale, 'email_label')} type="email" value={draft.email} required
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              errors={draftErrors.fieldErrors?.email} />
            <SelectField label={t(locale, 'contact_label')} value={draft.email_label}
              onChange={(e) => setDraft({ ...draft, email_label: e.target.value })}
              options={labelOptions(locale)} />
            <div className="block">
              <span className="text-sm text-ink-subtle">{t(locale, 'phone')}</span>
              <div className="mt-1">
                <PhoneInput value={draft.phone} defaultCountry={draft.country || 'NL'}
                  onChange={(v) => setDraft((d) => (d ? { ...d, phone: v } : d))} />
              </div>
            </div>
            <SelectField label={t(locale, 'contact_label')} value={draft.phone_label}
              onChange={(e) => setDraft({ ...draft, phone_label: e.target.value })}
              options={labelOptions(locale)} />
            <CountryCombobox label={t(locale, 'country')}
              onChange={(code) => setDraft((d) => (d ? { ...d, country: code } : d))}
              errors={draftErrors.fieldErrors?.country} />
            {draftErrors.error && (
              <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
                {draftErrors.error}
              </div>
            )}
          </form>
        )}
        <form id="add-member-form" onSubmit={onSubmit} className={`${draft ? 'hidden' : 'grid'} grid-cols-1 md:grid-cols-2 gap-4`}>
          <div className="md:col-span-2">
            <PersonCombobox
              label={t(locale, 'person')}
              name="person_id"
              required
              people={[...created, ...people]}
              exclude={exclude}
              value={personId}
              onChange={setPersonId}
              placeholder={t(locale, 'search_or_add_person')}
              onCreate={(typed) => setDraft(draftFromTyped(typed))}
              createLabel={(typed) => t(locale, 'add_as_new_person', { name: typed })}
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

type NewPersonDraft = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  email_label: string;
  phone_label: string;
};

// Added to a member of an organisation, so their address is most likely
// the work one — the default, easy to change.
const labelOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'work', label: t(locale, 'label_work') },
  { value: 'private', label: t(locale, 'label_private') },
  { value: 'other', label: t(locale, 'label_other') },
];

/** What was typed becomes a head start: an address fills the email, a name
 *  splits on its first space ("Marja van den Berg" → Marja / van den Berg). */
function draftFromTyped(typed: string): NewPersonDraft {
  const v = typed.trim();
  const labels = { email_label: 'work', phone_label: 'work' };
  if (v.includes('@')) return { first_name: '', last_name: '', email: v, phone: '', country: '', ...labels };
  const i = v.indexOf(' ');
  return {
    first_name: i < 0 ? v : v.slice(0, i),
    last_name: i < 0 ? '' : v.slice(i + 1).trim(),
    email: '',
    phone: '',
    country: '',
    ...labels,
  };
}
