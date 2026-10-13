// The labels on the invoicing fields — one copy for every form that asks for
// them.
//
// The FIELDS have been shared since they were written (`InvoiceBillingFields`
// and `readBillingFields` in ui/payment-methods.tsx, used by Thread's enrol
// form and Meet's booking flow), and so, since 2026-10-13, is the schema that
// receives them (apps/api/src/lib/billing-fields.ts). The words above the
// inputs were the one part still living in a single app's catalogue — so when
// the membership join needed the same eight labels the choice was to copy
// them or to lift them. Copied, they drift: "Tax / VAT number (optional)"
// says optional in one app and not in another, and nobody notices because
// each app's catalogue is internally consistent.
//
// Copy is the Thread's, which is design-leading and where these were written.
// All six locales per key or the typecheck fails.
//
// Consume either way:
//   - spread `...INVOICE_FIELDS` into an app catalog so the app's own typed
//     `t()` serves these keys, or
//   - call `invoiceFieldsT(locale, key)` directly.

import { makeT, type I18nEntry } from './i18n.js';

export const INVOICE_FIELDS = {
  who_pays: {
    en: 'Who pays?',
    nl: 'Wie betaalt?',
    es: '¿Quién paga?', // MT
    pt: 'Quem paga?', // MT
    de: 'Wer zahlt?', // MT
    fr: 'Qui paie ?', // MT
  },
  who_pays_myself: {
    en: 'Myself',
    nl: 'Ikzelf',
    es: 'Yo', // MT
    pt: 'Eu', // MT
    de: 'Ich selbst', // MT
    fr: 'Moi-même', // MT
  },
  who_pays_organisation: {
    en: 'An organisation',
    nl: 'Een organisatie',
    es: 'Una organización', // MT
    pt: 'Uma organização', // MT
    de: 'Eine Organisation', // MT
    fr: 'Une organisation', // MT
  },
  company_name: {
    en: 'Company / organisation (for the invoice)',
    nl: 'Bedrijf / organisatie (voor de factuur)',
    es: 'Empresa / organización (para la factura)',
    pt: 'Empresa / organização (para a fatura)',
    de: 'Firma / Organisation (für die Rechnung)',
    fr: 'Entreprise / organisation (pour la facture)', // MT
  },
  billing_address: {
    en: 'Billing address',
    nl: 'Factuuradres',
    es: 'Dirección de facturación',
    pt: 'Endereço de faturamento',
    de: 'Rechnungsadresse',
    fr: 'Adresse de facturation', // MT
  },
  postal_code: {
    en: 'Postal code',
    nl: 'Postcode',
    es: 'Código postal',
    pt: 'Código postal',
    de: 'Postleitzahl',
    fr: 'Code postal', // MT
  },
  city: {
    en: 'City',
    nl: 'Plaats',
    es: 'Ciudad',
    pt: 'Cidade',
    de: 'Ort',
    fr: 'Ville', // MT
  },
  country: {
    en: 'Country',
    nl: 'Land',
    es: 'País',
    pt: 'País',
    de: 'Land',
    fr: 'Pays', // MT
  },
  // Inside the empty country picker. It became a picker on 2026-10-14 — it
  // was free text asking for a value that had to come from a fixed list,
  // which is why "Nederland" quietly lost the country off an invoice.
  country_placeholder: {
    en: 'Pick your country\u2026',
    nl: 'Kies je land\u2026',
    es: 'Elige tu pa\u00eds\u2026', // MT
    pt: 'Escolhe o teu pa\u00eds\u2026', // MT
    de: 'W\u00e4hle dein Land\u2026', // MT
    fr: 'Choisis ton pays\u2026', // MT
  },
  tax_number: {
    en: 'Tax / VAT number (optional)',
    nl: 'Btw-nummer (optioneel)',
    es: 'NIF / número de IVA (opcional)',
    pt: 'NIF / número de IVA (opcional)',
    de: 'USt-IdNr. (optional)',
    fr: 'Numéro de TVA (facultatif)', // MT
  },
} satisfies Record<string, I18nEntry>;

export type InvoiceFieldsKey = keyof typeof INVOICE_FIELDS;

export const invoiceFieldsT = makeT(INVOICE_FIELDS);
