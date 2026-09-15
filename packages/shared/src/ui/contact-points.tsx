'use client';

// A person's addresses, labelled like a phone's address book (Sjoerd,
// 2026-09-15: "multiple addresses (email, phone) with indication (work,
// private…) like in an Apple phone"). docs/people-in-two-capacities-proposal.md.
//
// Born shared: the contact dialog in The Fibre is the first consumer, and the
// member dialogs in Membership and Connections' people are the next. What is
// app-bound (saving) stays with the caller — this edits a value and reports it.
//
//   ContactPointsEditor  the list editor (labels, primary, organisation for a
//                        work address, + add)
//   PhoneInput           country code (searchable) + number → "+31 612345678"
//   ContactPointsView    the read-only rendering for a contact card

import { useState } from 'react';
import { X, BadgeCheck } from 'lucide-react';
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { COUNTRIES } from '../countries.js';
import { SearchSelect } from './search-select.js';
import { FieldSelect, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from './fields.js';
import { chromeT, useLocale } from './i18n-ui.js';

export type ContactPointLabel = 'work' | 'private' | 'other';

export type ContactPointValue = {
  kind: 'email' | 'phone';
  value: string;
  label: ContactPointLabel | null;
  org_id: string | null;
  is_primary: boolean;
  verified_at?: string | null;
  organisation?: { id: string; name: string } | null;
};

type OrgOption = { id: string; name: string };

// Country → calling code, for the prefix picker. Codes libphonenumber does
// not know (e.g. Antarctica) are simply not offered.
const PREFIXES = COUNTRIES.flatMap((c) => {
  try {
    const dial = getCountryCallingCode(c.code as CountryCode);
    return [{ value: c.code, label: `${c.code} +${dial}`, hint: c.name, dial }];
  } catch {
    return [];
  }
});

/** Split a stored number into (country, national) for the two controls. */
function splitPhone(value: string, fallbackCountry: string): { country: string; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  if (parsed?.countryCallingCode) {
    const hit = PREFIXES.find((p) => p.dial === parsed.countryCallingCode);
    if (hit) return { country: hit.value, national: parsed.nationalNumber };
  }
  return { country: fallbackCountry, national: value.replace(/^\+\d*\s?/, '') };
}

/** Join back: "+31 612345678". A leading 0 on the national part is dropped. */
function joinPhone(country: string, national: string): string {
  const digits = national.replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (!digits) return '';
  const p = PREFIXES.find((x) => x.value === country);
  return p ? `+${p.dial} ${digits}` : digits;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'NL',
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Used when the number carries no country yet — the person's country is best. */
  defaultCountry?: string;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const parsed = splitPhone(value, defaultCountry);
  // The chosen code is kept here, not re-derived from the value alone: with
  // no number typed yet the value is empty, and deriving from it snapped the
  // picker back to the default country on every choice — Martijn lives on
  // Curaçao but has a Dutch number, and the prefix could not be changed
  // (Sjoerd, 2026-09-15). A number that carries its own country still wins.
  const [picked, setPicked] = useState(parsed.country);
  const country = value && parsed.country ? parsed.country : picked;
  const national = parsed.national;
  return (
    <div className="flex gap-2 min-w-0 flex-1">
      <div className="w-28 shrink-0">
        <SearchSelect
          value={country}
          onChange={(c) => {
            setPicked(c);
            onChange(joinPhone(c, national));
          }}
          options={PREFIXES}
          placeholder={chromeT(locale, 'cp_prefix')}
        />
      </div>
      <input
        type="tel"
        inputMode="tel"
        aria-label={ariaLabel ?? chromeT(locale, 'cp_phone')}
        className={`${FIELD_INPUT_CLASS} min-w-0`}
        value={national}
        onChange={(e) => onChange(joinPhone(country, e.target.value))}
      />
    </div>
  );
}

export function ContactPointsEditor({
  value,
  onChange,
  organisations = [],
  defaultCountry,
}: {
  value: ContactPointValue[];
  onChange: (next: ContactPointValue[]) => void;
  /** The person's organisations — a work address can say which one it is for. */
  organisations?: OrgOption[];
  defaultCountry?: string;
}) {
  const locale = useLocale();
  const labelOptions = [
    { value: '', label: chromeT(locale, 'cp_label_none') },
    { value: 'work', label: chromeT(locale, 'cp_label_work') },
    { value: 'private', label: chromeT(locale, 'cp_label_private') },
    { value: 'other', label: chromeT(locale, 'cp_label_other') },
  ];

  function update(index: number, patch: Partial<ContactPointValue>) {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function makePrimary(index: number) {
    const kind = value[index]!.kind;
    onChange(value.map((p, i) => (p.kind === kind ? { ...p, is_primary: i === index } : p)));
  }
  function remove(index: number) {
    const gone = value[index]!;
    const rest = value.filter((_, i) => i !== index);
    // Removing the primary hands it to the next address of that kind.
    if (gone.is_primary) {
      const next = rest.findIndex((p) => p.kind === gone.kind);
      if (next >= 0) rest[next] = { ...rest[next]!, is_primary: true };
    }
    onChange(rest);
  }
  function add(kind: 'email' | 'phone') {
    const first = !value.some((p) => p.kind === kind);
    onChange([...value, { kind, value: '', label: null, org_id: null, is_primary: first }]);
  }

  const section = (kind: 'email' | 'phone') => (
    <div className="space-y-2">
      <span className={FIELD_LABEL_CLASS}>{chromeT(locale, kind === 'email' ? 'cp_email' : 'cp_phone')}</span>
      {value.map((p, i) =>
        p.kind !== kind ? null : (
          <div key={i} className="rounded-md border border-line p-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-32 shrink-0">
                <FieldSelect
                  aria-label="Label"
                  value={p.label ?? ''}
                  onChange={(e) =>
                    update(i, {
                      label: (e.target.value || null) as ContactPointLabel | null,
                      ...(e.target.value === 'work' ? {} : { org_id: null }),
                    })
                  }
                  options={labelOptions}
                />
              </div>
              {kind === 'email' ? (
                <input
                  type="email"
                  aria-label={chromeT(locale, 'cp_email')}
                  className={`${FIELD_INPUT_CLASS} min-w-0 flex-1`}
                  value={p.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                />
              ) : (
                <PhoneInput
                  value={p.value}
                  onChange={(v) => update(i, { value: v })}
                  {...(defaultCountry ? { defaultCountry } : {})}
                />
              )}
              <button
                type="button"
                aria-label={chromeT(locale, 'remove')}
                onClick={() => remove(i)}
                className="p-1.5 text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {p.is_primary ? (
                <span className="font-medium text-ink">{chromeT(locale, 'cp_primary')}</span>
              ) : (
                <button type="button" onClick={() => makePrimary(i)} className="text-ink-subtle underline">
                  {chromeT(locale, 'cp_make_primary')}
                </button>
              )}
              {p.verified_at && (
                <span className="inline-flex items-center gap-1 text-ink-muted">
                  <BadgeCheck size={13} /> {chromeT(locale, 'cp_verified')}
                </span>
              )}
              {p.label === 'work' && organisations.length > 0 && (
                <div className="w-56">
                  <FieldSelect
                    aria-label={chromeT(locale, 'cp_for_org')}
                    value={p.org_id ?? ''}
                    onChange={(e) => update(i, { org_id: e.target.value || null })}
                    options={[
                      { value: '', label: chromeT(locale, 'cp_no_org') },
                      ...organisations.map((o) => ({ value: o.id, label: o.name })),
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        ),
      )}
      <button type="button" onClick={() => add(kind)} className="text-sm text-ink-subtle underline">
        {chromeT(locale, kind === 'email' ? 'cp_add_email' : 'cp_add_phone')}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {section('email')}
      {section('phone')}
    </div>
  );
}

/** A phone as people read it: "+31 6 15080345". Falls back to the stored text. */
export function formatPhone(value: string): string {
  const parsed = parsePhoneNumberFromString(value);
  return parsed ? parsed.formatInternational() : value;
}

/** Read-only, for a contact card: one line per address, label first. */
export function ContactPointsView({
  points,
  kind,
}: {
  points: ContactPointValue[];
  kind: 'email' | 'phone';
}) {
  const locale = useLocale();
  const rows = points.filter((p) => p.kind === kind);
  if (!rows.length) return <span>—</span>;
  return (
    <ul className="space-y-1">
      {rows.map((p) => (
        <li key={p.value} className="min-w-0">
          {kind === 'email' ? (
            <a href={`mailto:${p.value}`} className="break-all hover:underline">{p.value}</a>
          ) : (
            <a href={`tel:${p.value.replace(/\s/g, '')}`} className="hover:underline">{formatPhone(p.value)}</a>
          )}
          {(p.label || p.organisation || (rows.length > 1 && p.is_primary)) && (
            <span className="block text-xs text-ink-muted">
              {[
                p.label ? chromeT(locale, `cp_label_${p.label}`) : null,
                p.organisation?.name ?? null,
                rows.length > 1 && p.is_primary ? chromeT(locale, 'cp_primary') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
