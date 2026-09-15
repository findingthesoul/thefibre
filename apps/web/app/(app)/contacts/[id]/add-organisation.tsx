'use client';

// Add organisation, from the PERSON (Sjoerd, 2026-09-14 and again 2026-09-15:
// "Why can't I add an organisation from a person?"). The mirror of Add member
// on the organisation page: search, pick — or keep typing and add a new
// organisation in the same dialog — then the same role fields, saved by the
// same action (organisations/[id]/member-actions.ts addMember).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { SearchSelect, type SearchSelectOption } from '@thefibre/shared/ui/search-select';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { MembershipRoleFields } from '../../organisations/[id]/add-member';
import { addMember, type ActionResult } from '../../organisations/[id]/member-actions';
import {
  searchOrganisations,
  createOrganisationFromPicker,
  type OrganisationOption,
} from '@/lib/person-actions';
import { t, type Locale } from '@/lib/i18n-ui';

type OrgDraft = { name: string; domain: string; country: string };

const toOption = (o: OrganisationOption): SearchSelectOption => ({
  value: o.id,
  label: o.name,
  ...(o.domain ? { hint: o.domain } : {}),
});

export function AddOrganisationButton({
  personId,
  exclude = [],
  locale,
}: {
  personId: string;
  /** Organisations the person already belongs to — not offered again. */
  exclude?: string[];
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});
  const [orgId, setOrgId] = useState('');
  const [created, setCreated] = useState<OrganisationOption[]>([]);
  const [draft, setDraft] = useState<OrgDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const hidden = new Set(exclude);

  function close() {
    if (pending) return;
    setOpen(false);
    setDraft(null);
    setDraftError(null);
    setState({});
  }

  async function load(term: string) {
    const rows = await searchOrganisations(term);
    return [...created, ...rows]
      .filter((o, i, all) => !hidden.has(o.id) && all.findIndex((x) => x.id === o.id) === i)
      .map(toOption);
  }

  function saveDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    start(async () => {
      const res = await createOrganisationFromPicker(draft);
      if (!res.ok) {
        setDraftError(res.error);
        return;
      }
      setCreated((list) => [res.organisation, ...list]);
      setOrgId(res.organisation.id);
      setDraft(null);
      setDraftError(null);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) {
      setState({ error: t(locale, 'pick_organisation_first') });
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set('person_id', personId);
    start(async () => {
      const res = await addMember(orgId, {}, fd);
      setState(res);
      if (res.ok) {
        setOrgId('');
        close();
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" leading={<Building2 size={14} strokeWidth={1.75} />} onClick={() => setOpen(true)}>
        {t(locale, 'add_organisation_to_person')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={draft ? t(locale, 'add_organisation') : t(locale, 'add_organisation_to_person')}
        description={draft ? t(locale, 'new_org_blurb') : t(locale, 'add_organisation_to_person_blurb')}
        size="lg"
        footer={
          draft ? (
            <>
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={pending}>
                {t(locale, 'cancel')}
              </Button>
              <Button type="submit" form="new-org-form" disabled={pending}>
                {pending ? t(locale, 'saving') : t(locale, 'add_organisation')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close} disabled={pending}>
                {t(locale, 'cancel')}
              </Button>
              <Button type="submit" form="add-organisation-form" disabled={pending}>
                {pending ? t(locale, 'adding') : t(locale, 'add_organisation_to_person')}
              </Button>
            </>
          )
        }
      >
        {draft && (
          <form id="new-org-form" onSubmit={saveDraft} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextField label={t(locale, 'name')} value={draft.name} required autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <TextField label={t(locale, 'domain')} value={draft.domain} placeholder="example.org"
              onChange={(e) => setDraft({ ...draft, domain: e.target.value })} />
            <CountryCombobox label={t(locale, 'country')}
              onChange={(code) => setDraft((d) => (d ? { ...d, country: code } : d))} />
            {draftError && (
              <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
                {draftError}
              </div>
            )}
          </form>
        )}
        {/* Stays mounted while the new-organisation step is open, so typed
            role fields survive it. The class decides visibility: Tailwind's
            `grid` outranks the hidden attribute (v0.75.22). */}
        <form id="add-organisation-form" onSubmit={onSubmit} className={`${draft ? 'hidden' : 'grid'} grid-cols-1 md:grid-cols-2 gap-4`}>
          <div className="md:col-span-2 block">
            <span className="text-sm text-ink-subtle">
              {t(locale, 'organisation')}
              <span className="text-red-600"> *</span>
            </span>
            <SearchSelect
              className="mt-1"
              value={orgId}
              onChange={setOrgId}
              options={created.map(toOption)}
              loadOptions={load}
              placeholder={t(locale, 'search_or_add_organisation')}
              onCreate={(typed) => setDraft({ name: typed, domain: typed.includes('.') ? typed : '', country: '' })}
              createLabel={(typed) => t(locale, 'add_as_new_organisation', { name: typed })}
            />
          </div>
          <MembershipRoleFields locale={locale} />
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
