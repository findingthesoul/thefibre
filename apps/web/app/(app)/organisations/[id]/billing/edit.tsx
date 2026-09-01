'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, TextAreaField } from '@/components/ui/field';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { updateOrgBilling, type ActionResult } from './actions';

export type OrgBillingRow = {
  legal_name: string | null;
  tax_id: string | null;
  billing_email: string | null;
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_region: string | null;
  billing_country: string | null;
  payment_terms_days: number | null;
  currency: string | null;
  po_required: boolean | null;
  notes: string | null;
};

export function OrgBillingEdit({
  orgId,
  initial,
}: {
  orgId: string;
  initial: OrgBillingRow | null;
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
        Edit
      </Button>
      <EditDialog open={open} onClose={() => setOpen(false)} orgId={orgId} initial={initial} />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  orgId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  initial: OrgBillingRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startSave(async () => {
      const res = await updateOrgBilling(orgId, {}, fd);
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
      title="Edit invoicing details — Sales"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form="org-billing-form" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="org-billing-form"
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); doSave(); }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <TextField label="Legal name" name="legal_name" defaultValue={initial?.legal_name ?? ''} placeholder="If different from display name" errors={state.fieldErrors?.legal_name} />
        <TextField label="Tax / VAT ID" name="tax_id" defaultValue={initial?.tax_id ?? ''} errors={state.fieldErrors?.tax_id} />
        <TextField label="Billing email" name="billing_email" type="email" defaultValue={initial?.billing_email ?? ''} errors={state.fieldErrors?.billing_email} />
        <TextField label="Currency (ISO 3-letter)" name="currency" maxLength={3} defaultValue={initial?.currency ?? ''} placeholder="EUR" errors={state.fieldErrors?.currency} />
        <TextField label="Payment terms (days)" name="payment_terms_days" type="number" min={0} max={365} defaultValue={initial?.payment_terms_days ?? ''} errors={state.fieldErrors?.payment_terms_days} />
        <label className="flex items-center gap-2 text-sm mt-7">
          <input type="checkbox" name="po_required" defaultChecked={initial?.po_required ?? false} />
          <span>Purchase order required</span>
        </label>
        <TextField label="Billing street" name="billing_street" defaultValue={initial?.billing_street ?? ''} errors={state.fieldErrors?.billing_street} />
        <TextField label="Postal code" name="billing_postal_code" defaultValue={initial?.billing_postal_code ?? ''} errors={state.fieldErrors?.billing_postal_code} />
        <TextField label="City" name="billing_city" defaultValue={initial?.billing_city ?? ''} errors={state.fieldErrors?.billing_city} />
        <TextField label="Region" name="billing_region" defaultValue={initial?.billing_region ?? ''} errors={state.fieldErrors?.billing_region} />
        <CountryCombobox label="Country" name="billing_country" defaultValue={initial?.billing_country} errors={state.fieldErrors?.billing_country} />
        <div className="md:col-span-2">
          <TextAreaField label="Notes" name="notes" defaultValue={initial?.notes ?? ''} maxLength={2000} errors={state.fieldErrors?.notes} />
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
