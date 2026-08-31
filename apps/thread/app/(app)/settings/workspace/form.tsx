'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkspaceBrand } from '../actions';
import { TextField, TextAreaField } from '@/components/ui/field';
import { ImageUpload } from '@/components/ui/image-upload';
import { Button } from '@/components/ui/button';
import type { WorkspaceBrand } from './page';

/**
 * Two things live here, and they are not the same kind of thing.
 *
 * The NOTE is content: your words, inside the two emails the platform sends at
 * enrolment ("request received", and "you're enrolled" with the ticket). Those
 * are written and translated by us and cannot be rewritten — but they can
 * carry what you want to say, which is what removes the need for a separate
 * welcome email.
 *
 * The rest is identity: the logo, the name in the inbox, where replies go.
 *
 * The sender address is the one field with a cost outside this screen, and it
 * says so rather than failing quietly later.
 */
export function WorkspaceForm({ brand }: { brand: WorkspaceBrand }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  // The logo is uploaded, not typed. Most organisers have a PNG on their
  // machine, not a public URL — asking for a URL meant finding somewhere to
  // host it first (Sjoerd 2026-09-01). Pasting one still works.
  const [logoUrl, setLogoUrl] = useState(brand.brand_logo_url ?? '');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '').trim() || null;
    startTransition(async () => {
      const r = await updateWorkspaceBrand({
        brand_logo_url: logoUrl.trim() || null,
        email_from_name: str('email_from_name'),
        email_from_address: str('email_from_address'),
        email_reply_to: str('email_reply_to'),
        enrolment_note: str('enrolment_note'),
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <section className="space-y-6">
        <TextAreaField
          label="Your words in the enrolment emails"
          name="enrolment_note"
          rows={6}
          defaultValue={brand.enrolment_note ?? ''}
          hint="Shown inside both — the one confirming we received the request, and the one with the ticket. A thread can override it. Leave empty and the emails stay as they are."
        />
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <div>
          <span className="text-sm text-ink-subtle">Logo</span>
          <div className="mt-1 max-w-sm">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              buttonLabel="Upload a logo"
              hint="Shown at the top of every email from this workspace, in place of The Fibre's. About 280px wide."
            />
          </div>
        </div>
        <TextField
          label="Sender name"
          name="email_from_name"
          defaultValue={brand.email_from_name ?? ''}
          placeholder={brand.workspace_name ?? 'Festival of Trust'}
          hint="What the inbox shows. This is free — nothing to set up, and the address behind it can stay ours."
        />
        <TextField
          label="Replies go to"
          name="email_reply_to"
          defaultValue={brand.email_reply_to ?? ''}
          placeholder="hello@yourdomain.com"
          hint="Also free. Your own address, without any DNS work."
        />
        <div>
          <TextField
            label="Sender address"
            name="email_from_address"
            defaultValue={brand.email_from_address ?? ''}
            placeholder="hello@yourdomain.com"
            hint="Sending as your own domain needs SPF and DKIM records on it, verified with our mail provider."
          />
          <p className="mt-2 text-sm text-ink-subtle">
            Until that domain is verified, mail still arrives — it goes out from our address
            instead, keeping your sender name. Nothing is lost while you sort out the DNS.
          </p>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !brand.editable}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
        {!brand.editable && (
          <span className="text-sm text-ink-subtle">Only a workspace admin can change this.</span>
        )}
      </div>
    </form>
  );
}
