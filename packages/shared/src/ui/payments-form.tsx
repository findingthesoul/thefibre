'use client';

// THE payments settings form — one implementation, four apps.
//
// Extracted 2026-09-24 from FOUR copies (thread, meet, membership, pulse)
// that had drifted: Thread had `workspaceName`, so its accounts were labelled
// with the workspace's real name rather than "Workspace account", and had the
// descriptions behind an ⓘ. The other three were older ports that lost both.
// This is Thread's version, which CLAUDE.md names design-leading, plus the
// Stripe Connect flow below — which is why the extraction happened now rather
// than later: without it Connect would have been written four times.
//
// App-bound pieces are injected, the `ui/invoices.tsx` pattern: `t` stays
// each app's own so no translation catalog has to move, and the save calls
// are the app's server actions.
//
// ---------------------------------------------------------------------------
// THE BADGE MEANS SOMETHING NOW
// ---------------------------------------------------------------------------
// It used to read `initialAccount ? 'Connected' : 'Not connected'` — i.e. the
// text box is not empty. It never asked Stripe anything. So soul.com's join
// page answered "could not start checkout" for two weeks while this screen
// showed green, because typing an account id grants no permission and nothing
// had ever asked for any (Sjoerd, 2026-09-24: "If I have to manually add every
// workspace to my account in order to let them receive payments, then that is
// not a platform").
//
// Three states now, and the middle one is the whole point:
//   connected   — we asked Stripe and can reach the account
//   unreachable — an id is saved and we CANNOT act on it; says why
//   none        — nothing set

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { Button } from './button.js';
import { FIELD_TEXT } from './fields.js';
import { Tabs } from './tabs.js';
import { InfoHint } from './info-hint.js';

export type InvoiceDetails = {
  legal_name?: string;
  address?: string;
  tax_no?: string;
  /** Printed under the seller's address on the invoice PDF. */
  website?: string;
  vat_registered?: boolean;
  vat_rate_pct?: number | null;
};

export type PaymentMethod = 'stripe' | 'invoice';

export type StripeStatus =
  | { state: 'none'; connect_available?: boolean }
  | {
      state: 'connected';
      chargesEnabled?: boolean;
      detail?: string | null;
      connect_available?: boolean;
      /** Whose account, in Stripe's words — so "connected" says connected to
       *  WHAT. Sjoerd, 2026-09-24. */
      accountName?: string | null;
      accountEmail?: string | null;
      accountCountry?: string | null;
    }
  | { state: 'unreachable'; detail: string; connect_available?: boolean };

/**
 * Every string this form needs, as a typed object rather than a key lookup.
 *
 * The four apps had DIFFERENT key names for the same strings — Thread's
 * `legal_name_on_invoices` is Membership's `legal_name_label`,
 * `methods_hint_workspace` is `methods_hint_ws`, `err_acct_prefix` is
 * `acct_error`. A `(key: string) => string` would have compiled against all
 * four and silently returned the key itself in three of them.
 *
 * So each app builds this object from its own catalog and a missing field is
 * a compile error — the same rule the i18n catalogs already follow. No
 * translations move and nothing is lost.
 */
export type PaymentsStrings = {
  /** Tabs. `tabWorkspaceOf` may contain {name}; without a name the plain
   *  `tabWorkspace` is used instead. */
  tabPersonal: string;
  tabWorkspace: string;
  tabWorkspaceOf: string;
  /** The rehearsal — a real charge on the connected account. */
  testPaymentTitle: string;
  testPaymentNote: string;
  testPaymentAmount: string;
  testPayment: string;
  testPaymentOpening: string;
  errTestPayment: string;
  personalAccount: string;
  personalAccountDesc: string;
  workspaceAccount: string;
  workspaceAccountDesc: string;
  methodsHintWorkspace: string;
  methodsHintPersonal: string;
  managedByAdmins: string;
  stripeNote1: string;
  stripeNote2: string;
  whatIsThis: string;
  connected: string;
  notConnected: string;
  stripeAccountId: string;
  legalName: string;
  taxNumber: string;
  website: string;
  address: string;
  vatOnSales: string;
  vatRegistered: string;
  rate: string;
  vatIncludedNote: string;
  defaultPaymentOptions: string;
  payOnlineCard: string;
  payPerInvoice: string;
  saving: string;
  save: string;
  saved: string;
  errAcctPrefix: string;
  errKeepOneMethod: string;
  errVatRate: string;
  /** New with Connect — see the note at the top of this file. */
  connectStripe: string;
  /** Same button, different job, once an account is already connected. */
  connectStripeChange: string;
  connectStripeNote: string;
  opening: string;
  stripeUnreachable: string;
  stripeUnreachableNote: string;
  stripeChargesDisabled: string;
  errConnectFailed: string;
};

// `FIELD_TEXT` is 16px on a phone and 14px from `sm` up. Anything smaller
// makes iOS zoom the page on focus, which is why `ui/fields.test.ts` fails a
// hand-rolled control under 16px — it caught the VAT-rate box below the
// moment this form moved into the package (2026-09-24). The app copies had
// carried plain `text-sm` for months, unscanned.
const INPUT = `mt-1 w-full max-w-md rounded-md border border-line bg-surface-raised px-3 py-2 ${FIELD_TEXT} focus:border-line-strong focus:outline-none placeholder:text-ink-muted`;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{children}</span>
  );
}

export function PaymentsForm({
  s,
  personalAccount,
  personalDetails,
  personalMethods,
  workspaceAccount,
  workspaceDetails,
  workspaceMethods,
  isAdmin,
  workspaceName = null,
  onSaved,
  savePersonal,
  saveWorkspace,
  loadWorkspaceStripeStatus,
  startWorkspaceStripeConnect,
  startWorkspaceTestPayment,
  loadPersonalStripeStatus,
  startPersonalStripeConnect,
  startPersonalTestPayment,
}: {
  s: PaymentsStrings;
  personalAccount: string | null;
  personalDetails: InvoiceDetails | null;
  personalMethods: PaymentMethod[] | null;
  workspaceAccount: string | null;
  workspaceDetails: InvoiceDetails | null;
  workspaceMethods: PaymentMethod[] | null;
  isAdmin: boolean;
  /** The workspace's own name. Null falls back to the generic label. */
  workspaceName?: string | null | undefined;
  /** Usually `router.refresh()`. */
  onSaved: () => void;
  savePersonal: Save;
  saveWorkspace: Save;
  /** Both optional: an app that has not wired Connect yet still renders, it
   *  just shows the old saved/not-saved pair instead of the real state. */
  loadWorkspaceStripeStatus?: (() => Promise<StripeStatus>) | undefined;
  startWorkspaceStripeConnect?: (() => Promise<{ url?: string; error?: string }>) | undefined;
  startWorkspaceTestPayment?: TestPayment | undefined;
  /** The personal (organiser) account needs the same grant the workspace
   *  does — a pasted `acct_` gives the platform no permission there either.
   *  Optional so an app that has not wired it yet still renders. */
  loadPersonalStripeStatus?: (() => Promise<StripeStatus>) | undefined;
  startPersonalStripeConnect?: (() => Promise<{ url?: string; error?: string }>) | undefined;
  startPersonalTestPayment?: TestPayment | undefined;
}) {
  // Both panels stay MOUNTED and are hidden when inactive (ui/tabs.tsx says
  // why): each carries its own unsaved edits and its own Save, and switching
  // tabs must not throw away what you typed in the other one.
  const [tab, setTab] = useState<'personal' | 'workspace'>('personal');
  const showWorkspace = isAdmin || workspaceAccount !== null || workspaceDetails !== null;
  const workspaceTabLabel = workspaceName
    ? s.tabWorkspaceOf.replace('{name}', workspaceName)
    : s.tabWorkspace;

  return (
    <div className="mt-8">
      {showWorkspace && (
        <Tabs
          tabs={[
            { value: 'personal' as const, label: s.tabPersonal },
            { value: 'workspace' as const, label: workspaceTabLabel },
          ]}
          value={tab}
          onChange={setTab}
          className="mb-6"
        />
      )}
      <div hidden={showWorkspace && tab !== 'personal'}>
        <AccountSection
          s={s}
          label={s.personalAccount}
          description={s.personalAccountDesc}
          initialAccount={personalAccount}
          initialDetails={personalDetails}
          initialMethods={personalMethods}
          showMethods
          save={savePersonal}
          onSaved={onSaved}
          loadStatus={loadPersonalStripeStatus}
          startConnect={startPersonalStripeConnect}
          startTestPayment={startPersonalTestPayment}
        />
      </div>
      {showWorkspace && (
        <div hidden={tab !== 'workspace'}>
          <AccountSection
            s={s}
            label={workspaceName ?? s.workspaceAccount}
            description={s.workspaceAccountDesc}
            initialAccount={workspaceAccount}
            initialDetails={workspaceDetails}
            initialMethods={workspaceMethods}
            showMethods
            methodsHint={s.methodsHintWorkspace}
            save={saveWorkspace}
            onSaved={onSaved}
            disabled={!isAdmin}
            disabledNote={s.managedByAdmins}
            loadStatus={loadWorkspaceStripeStatus}
            startConnect={startWorkspaceStripeConnect}
            startTestPayment={startWorkspaceTestPayment}
          />
        </div>
      )}
      <p className="mt-8 text-xs text-ink-muted max-w-xl leading-relaxed">
        {/* One sentence in three pieces: the prose, the literal prefix, the
            rest. The extraction kept only the first piece, so every app has
            been ending on "The Stripe account id starts with" — a sentence
            that stops mid-thought (Sjoerd, 2026-09-24: "What's the unfinished
            text at the bottom?"). Restored as it was written. */}
        {s.stripeNote1} <code className="font-mono">acct_</code>{' '}
        {s.stripeNote2}
      </p>
    </div>
  );
}

export type TestPayment = (
  amountCents: number,
) => Promise<{ url?: string; error?: string }>;

type Save = (
  accountId: string | null,
  details: InvoiceDetails | null,
  methods: PaymentMethod[] | null,
) => Promise<{ ok: true } | { ok: false; error: string }>;

function AccountSection({
  s,
  label,
  description,
  initialAccount,
  initialDetails,
  initialMethods,
  showMethods = false,
  methodsHint,
  save,
  onSaved,
  disabled = false,
  disabledNote,
  loadStatus,
  startConnect,
  startTestPayment,
}: {
  s: PaymentsStrings;
  label: string;
  description: string;
  initialAccount: string | null;
  initialDetails: InvoiceDetails | null;
  initialMethods: PaymentMethod[] | null;
  showMethods?: boolean;
  methodsHint?: string | undefined;
  save: Save;
  onSaved: () => void;
  disabled?: boolean | undefined;
  disabledNote?: string | undefined;
  loadStatus?: (() => Promise<StripeStatus>) | undefined;
  startConnect?: (() => Promise<{ url?: string; error?: string }>) | undefined;
  startTestPayment?: TestPayment | undefined;
}) {
  const [account, setAccount] = useState(initialAccount ?? '');
  const [testAmount, setTestAmount] = useState('1.00');
  const [testing, setTesting] = useState(false);
  const [legalName, setLegalName] = useState(initialDetails?.legal_name ?? '');
  const [address, setAddress] = useState(initialDetails?.address ?? '');
  const [taxNo, setTaxNo] = useState(initialDetails?.tax_no ?? '');
  const [website, setWebsite] = useState(initialDetails?.website ?? '');
  const [vatOn, setVatOn] = useState(initialDetails?.vat_registered ?? false);
  const [vatRate, setVatRate] = useState(
    initialDetails?.vat_rate_pct != null ? String(initialDetails.vat_rate_pct) : '21',
  );
  const [stripeOn, setStripeOn] = useState(initialMethods ? initialMethods.includes('stripe') : true);
  const [invoiceOn, setInvoiceOn] = useState(
    initialMethods ? initialMethods.includes('invoice') : false,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // Ask Stripe, once, rather than inferring from a non-empty string.
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    if (!loadStatus || disabled) return;
    let alive = true;
    void loadStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [loadStatus, disabled, initialAccount]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const acct = account.trim();
    if (acct && !acct.startsWith('acct_')) {
      setError(s.errAcctPrefix);
      return;
    }
    if (showMethods && !stripeOn && !invoiceOn) {
      setError(s.errKeepOneMethod);
      return;
    }
    const details: InvoiceDetails = {};
    if (legalName.trim()) details.legal_name = legalName.trim();
    if (address.trim()) details.address = address.trim();
    if (taxNo.trim()) details.tax_no = taxNo.trim();
    if (website.trim()) details.website = website.trim();
    const rate = Number(vatRate.replace(',', '.'));
    if (vatOn && (!Number.isFinite(rate) || rate <= 0 || rate > 100)) {
      setError(s.errVatRate);
      return;
    }
    details.vat_registered = vatOn;
    details.vat_rate_pct = vatOn ? rate : null;
    const methods: PaymentMethod[] = [
      ...(stripeOn ? (['stripe'] as const) : []),
      ...(invoiceOn ? (['invoice'] as const) : []),
    ];
    startTransition(async () => {
      const r = await save(
        acct || null,
        Object.keys(details).length ? details : null,
        showMethods ? methods : null,
      );
      if (!r.ok) return setError(r.error);
      setSaved(true);
      onSaved();
    });
  }

  // Without a status check the badge can only report what it always did.
  const badge = !status
    ? initialAccount
      ? { tone: 'saved' as const, text: s.connected }
      : { tone: 'none' as const, text: s.notConnected }
    : status.state === 'connected'
      ? { tone: 'good' as const, text: s.connected }
      : status.state === 'unreachable'
        ? { tone: 'bad' as const, text: s.stripeUnreachable }
        : { tone: 'none' as const, text: s.notConnected };

  const TONES = {
    good: 'ring-emerald-200 bg-emerald-50 text-emerald-700',
    saved: 'ring-emerald-200 bg-emerald-50 text-emerald-700',
    bad: 'ring-amber-200 bg-amber-50 text-amber-800',
    none: 'ring-line bg-surface-sunken text-ink-muted',
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        <SectionLabel>{label}</SectionLabel>
        <InfoHint label={s.whatIsThis}>{description}</InfoHint>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${TONES[badge.tone]}`}>
          {badge.text}
        </span>
      </div>

      {/* The reason, in the member's words, not Stripe's error code alone.
          This is the state soul.com was in and could not see. */}
      {status?.state === 'unreachable' && (
        <p className="mt-2 text-xs text-amber-800 max-w-xl leading-relaxed">
          {s.stripeUnreachableNote} <span className="text-ink-muted">({status.detail})</span>
        </p>
      )}
      {status?.state === 'connected' && (status.accountName || status.accountEmail) && (
        // The name Stripe holds for the account, not one we stored. A person
        // connecting the wrong company sees it immediately, which is the whole
        // point of showing it rather than only "Connected".
        <p className="mt-2 text-xs text-ink-subtle max-w-xl leading-relaxed">
          {status.accountName ?? status.accountEmail}
          {status.accountName && status.accountEmail ? (
            <span className="text-ink-muted"> · {status.accountEmail}</span>
          ) : null}
          {status.accountCountry ? (
            <span className="text-ink-muted"> · {status.accountCountry.toUpperCase()}</span>
          ) : null}
        </p>
      )}
      {status?.state === 'connected' && status.chargesEnabled === false && (
        <p className="mt-2 text-xs text-amber-800 max-w-xl leading-relaxed">
          {s.stripeChargesDisabled}
          {status.detail ? <span className="text-ink-muted"> ({status.detail})</span> : null}
        </p>
      )}

      {disabled ? (
        <p className="mt-2 text-xs text-ink-muted">{disabledNote}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {/* The button that makes this a platform: the account holder
              approves from their OWN Stripe, and nobody is added by hand. */}
          {/* Shown whenever the platform is registered, connected or not.
              Hiding it once connected left no way to switch accounts and no
              way to see the button at all if an id was already saved — which
              is exactly what Sjoerd hit on the first run (2026-09-24). The
              LABEL carries the difference instead. */}
          {startConnect && status?.connect_available && (
            <div>
              <Button
                type="button"
                size="sm"
                disabled={connecting}
                onClick={() => {
                  setConnecting(true);
                  setError(null);
                  void startConnect()
                    .then((r) => {
                      if (r.url) window.location.href = r.url;
                      else {
                        setError(r.error ?? s.errConnectFailed);
                        setConnecting(false);
                      }
                    })
                    .catch(() => {
                      setError(s.errConnectFailed);
                      setConnecting(false);
                    });
                }}
              >
                {connecting
                  ? s.opening
                  : status.state === 'connected'
                    ? s.connectStripeChange
                    : s.connectStripe}
              </Button>
              <p className="mt-1 text-[11px] text-ink-muted max-w-xl leading-relaxed">
                {s.connectStripeNote}
              </p>
            </div>
          )}

          {/* The rehearsal. `accountStatus` proves the account is REACHABLE,
              which is not the same as chargeable — soul.com's screen was
              green while every checkout failed. This runs the same call a
              real sale makes, so a success here means a real one works.
              Sjoerd asked for it on the day the connect flow shipped:
              "I would like to test it myself." */}
          {startTestPayment && status?.state === 'connected' && (
            <div className="rounded-md border border-line bg-surface-sunken p-3 max-w-md">
              <SectionLabel>{s.testPaymentTitle}</SectionLabel>
              <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">
                {s.testPaymentNote}
              </p>
              <div className="mt-2 flex items-end gap-2">
                <label className="block">
                  <span className="text-xs text-ink-subtle">{s.testPaymentAmount}</span>
                  <input
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    inputMode="decimal"
                    className={`${INPUT} w-28`}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={testing}
                  onClick={() => {
                    // Parse HERE rather than sending the raw string: the API
                    // takes cents, and "1,50" is what a Dutch keyboard gives.
                    const cents = Math.round(
                      Number(testAmount.replace(',', '.').trim()) * 100,
                    );
                    if (!Number.isFinite(cents) || cents < 50) {
                      setError(s.errTestPayment);
                      return;
                    }
                    setTesting(true);
                    setError(null);
                    void startTestPayment(cents)
                      .then((r) => {
                        if (r.url) window.location.href = r.url;
                        else {
                          setError(r.error ?? s.errTestPayment);
                          setTesting(false);
                        }
                      })
                      .catch(() => {
                        setError(s.errTestPayment);
                        setTesting(false);
                      });
                  }}
                >
                  {testing ? s.testPaymentOpening : s.testPayment}
                </Button>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-ink-subtle">{s.stripeAccountId}</span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="acct_…"
              className={`${INPUT} font-mono`}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <label className="block">
              <span className="text-xs text-ink-subtle">{s.legalName}</span>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Solidarity Lab B.V."
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink-subtle">{s.taxNumber}</span>
              <input
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                placeholder="NL123456789B01"
                className={INPUT}
              />
            </label>
          </div>
          <label className="block max-w-md">
            <span className="text-xs text-ink-subtle">{s.website}</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="soul.com"
              className={INPUT}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block max-w-2xl">
            <span className="text-xs text-ink-subtle">{s.address}</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={`${INPUT} max-w-none`}
            />
          </label>

          <div>
            <span className="text-xs text-ink-subtle">{s.vatOnSales}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-5">
              <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                <input type="checkbox" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} />
                {s.vatRegistered}
              </label>
              {vatOn && (
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle">
                  {s.rate}
                  <input
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    inputMode="decimal"
                    className={`w-16 rounded-md border border-line bg-surface-raised px-2 py-1 ${FIELD_TEXT} text-right focus:border-line-strong focus:outline-none`}
                  />
                  %
                </label>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-muted max-w-xl">{s.vatIncludedNote}</p>
          </div>

          {showMethods && (
            <div>
              <span className="text-xs text-ink-subtle">
                {s.defaultPaymentOptions} — {methodsHint ?? s.methodsHintPersonal}
              </span>
              <div className="mt-1.5 flex items-center gap-5">
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stripeOn}
                    onChange={(e) => setStripeOn(e.target.checked)}
                  />
                  {s.payOnlineCard}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invoiceOn}
                    onChange={(e) => setInvoiceOn(e.target.checked)}
                  />
                  {s.payPerInvoice}
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? s.saving : s.save}
            </Button>
            {saved && <span className="text-xs text-ink-subtle">{s.saved}</span>}
          </div>
        </div>
      )}
    </form>
  );
}
