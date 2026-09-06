'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoField } from '@thefibre/shared/ui/photo-field';
import { TextField, TextAreaField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import { uploadAsset } from '@/lib/upload';
import { saveWorkspace } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type Workspace = {
  name: string | null;
  slug: string | null;
  brand_logo_url: string | null;
  invoice_details: { legal_name?: string; address?: string; tax_no?: string } | null;
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  enrolment_note: string | null;
  editable: boolean;
};

/**
 * Four things that all answer "who is this workspace": what it is called, what
 * it looks like, what it says on an invoice, and who its email comes from.
 *
 * They were in three different places and one of them was nowhere. Grouped
 * rather than merged — an address is not a logo — but on one page, saved by
 * one button, because a person changing their organisation's name has usually
 * just changed its address too.
 */
export function WorkspaceForm({ workspace, locale }: { workspace: Workspace; locale: Locale }) {
  const router = useRouter();
  const [logo, setLogo] = useState<string | null>(workspace.brand_logo_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const inv = workspace.invoice_details ?? {};

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '').trim();
    const name = str('name');
    if (!name) return setError(t(locale, 'workspace_needs_name'));
    const details = {
      legal_name: str('legal_name'),
      address: str('address'),
      tax_no: str('tax_no'),
    };
    const anyDetail = Object.values(details).some(Boolean);
    start(async () => {
      const r = await saveWorkspace({
        name,
        brand_logo_url: logo,
        // All three empty means "we have no invoice details", not three empty
        // strings printed on an invoice.
        invoice_details: anyDetail ? details : null,
        email_from_name: str('email_from_name') || null,
        email_reply_to: str('email_reply_to') || null,
        email_from_address: str('email_from_address') || null,
        enrolment_note: str('enrolment_note') || null,
      });
      if (!r.ok) return setError(r.error ?? t(locale, 'could_not_save'));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-10 max-w-xl">
      <section className="space-y-6">
        <TextField
          label={t(locale, 'name')}
          name="name"
          defaultValue={workspace.name ?? ''}
          hint={workspace.slug ? `${t(locale, 'address_label')}: ${workspace.slug}` : undefined}
        />
        <PhotoField
          label={t(locale, 'logo')}
          shape="square"
          value={logo}
          onChange={(url) => {
            setLogo(url);
            setSaved(false);
          }}
          upload={uploadAsset}
          onError={setError}
          hint={t(locale, 'logo_hint')}
        />
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <SectionLabel>{t(locale, 'on_your_invoices')}</SectionLabel>
        <TextField
          label={t(locale, 'legal_name')}
          name="legal_name"
          defaultValue={inv.legal_name ?? ''}
          placeholder={workspace.name ?? t(locale, 'legal_name_ph')}
          hint={t(locale, 'legal_name_hint')}
        />
        <TextAreaField
          label={t(locale, 'address_label')}
          name="address"
          rows={3}
          defaultValue={inv.address ?? ''}
          placeholder={'Street 1\n1234 AB City\nNetherlands'}
        />
        <TextField label={t(locale, 'tax_number')} name="tax_no" defaultValue={inv.tax_no ?? ''} />
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <SectionLabel>{t(locale, 'email_label')}</SectionLabel>
        <TextField
          label={t(locale, 'sender_name')}
          name="email_from_name"
          defaultValue={workspace.email_from_name ?? ''}
          placeholder={workspace.name ?? ''}
          hint={t(locale, 'sender_name_hint')}
        />
        <TextField
          label={t(locale, 'replies_go_to')}
          name="email_reply_to"
          defaultValue={workspace.email_reply_to ?? ''}
          placeholder="hello@yourdomain.com"
        />
        <TextField
          label={t(locale, 'sender_address')}
          name="email_from_address"
          defaultValue={workspace.email_from_address ?? ''}
          placeholder="hello@yourdomain.com"
          hint={t(locale, 'sender_address_hint')}
        />
        <TextAreaField
          label={t(locale, 'enrolment_note_label')}
          name="enrolment_note"
          rows={5}
          defaultValue={workspace.enrolment_note ?? ''}
          hint={t(locale, 'enrolment_note_hint')}
        />
      </section>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !workspace.editable}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">{t(locale, 'saved_notice')}</span>}
        {!workspace.editable && (
          <span className="text-sm text-ink-subtle">{t(locale, 'admin_only_change')}</span>
        )}
      </div>
    </form>
  );
}
