'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoField } from '@thefibre/shared/ui/photo-field';
import { TextField, TextAreaField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import { uploadAsset } from '@/lib/upload';
import { saveWorkspace } from '../actions';

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
export function WorkspaceForm({ workspace }: { workspace: Workspace }) {
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
    if (!name) return setError('A workspace needs a name.');
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
      if (!r.ok) return setError(r.error ?? 'could not save');
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-10 max-w-xl">
      <section className="space-y-6">
        <TextField
          label="Name"
          name="name"
          defaultValue={workspace.name ?? ''}
          hint={workspace.slug ? `Address: ${workspace.slug}` : undefined}
        />
        <PhotoField
          label="Logo"
          shape="square"
          value={logo}
          onChange={(url) => {
            setLogo(url);
            setSaved(false);
          }}
          upload={uploadAsset}
          onError={setError}
          hint="Shown at the top of email this workspace sends, in place of The Fibre's."
        />
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <SectionLabel>On your invoices</SectionLabel>
        <TextField
          label="Legal name"
          name="legal_name"
          defaultValue={inv.legal_name ?? ''}
          placeholder={workspace.name ?? 'Your organisation B.V.'}
          hint="The entity that sells, if it differs from the name above."
        />
        <TextAreaField
          label="Address"
          name="address"
          rows={3}
          defaultValue={inv.address ?? ''}
          placeholder={'Street 1\n1234 AB City\nNetherlands'}
        />
        <TextField label="Tax number" name="tax_no" defaultValue={inv.tax_no ?? ''} />
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <SectionLabel>Email</SectionLabel>
        <TextField
          label="Sender name"
          name="email_from_name"
          defaultValue={workspace.email_from_name ?? ''}
          placeholder={workspace.name ?? ''}
          hint="What an inbox shows. Free — the address behind it can stay ours."
        />
        <TextField
          label="Replies go to"
          name="email_reply_to"
          defaultValue={workspace.email_reply_to ?? ''}
          placeholder="hello@yourdomain.com"
        />
        <TextField
          label="Sender address"
          name="email_from_address"
          defaultValue={workspace.email_from_address ?? ''}
          placeholder="hello@yourdomain.com"
          hint="Your own domain needs SPF and DKIM records on it. Until they are verified, email still goes out — from our address, with your name."
        />
        <TextAreaField
          label="Your words in the enrolment emails"
          name="enrolment_note"
          rows={5}
          defaultValue={workspace.enrolment_note ?? ''}
          hint="Shown inside the emails The Thread sends when someone registers. A single event can override it."
        />
      </section>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !workspace.editable}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
        {!workspace.editable && (
          <span className="text-sm text-ink-subtle">Only a workspace admin can change this.</span>
        )}
      </div>
    </form>
  );
}
