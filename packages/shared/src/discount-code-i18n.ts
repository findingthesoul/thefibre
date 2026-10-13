// The words around a discount-code field — one copy for every form that has
// one.
//
// Written in The Thread's catalogue, where the field was built. The membership
// join panel needed the same four, which is the moment to lift them rather
// than copy them: the same reasoning as the invoicing-field labels, and the
// same day. A string that says "Apply" in one app and "Redeem" in another is
// two products.
//
// All six locales per key or the typecheck fails.

import { makeT, type I18nEntry } from './i18n.js';

export const DISCOUNT_CODE_FIELD = {
  discount_code: {
    en: 'Discount code',
    nl: 'Kortingscode',
    es: 'Código de descuento',
    pt: 'Código de desconto',
    de: 'Rabattcode',
    fr: 'Code de réduction', // MT
  },
  apply: {
    en: 'Apply',
    nl: 'Toepassen',
    es: 'Aplicar',
    pt: 'Aplicar',
    de: 'Einlösen',
    fr: 'Appliquer', // MT
  },
  code_applied: {
    en: 'Code {code} applied.',
    nl: 'Code {code} toegepast.',
    es: 'Código {code} aplicado.',
    pt: 'Código {code} aplicado.',
    de: 'Code {code} eingelöst.',
    fr: 'Code {code} appliqué.', // MT
  },
  // SUBSCRIPTIONS ONLY, and the reason this key exists at all: a code
  // discounts the FIRST period and the membership renews at full price
  // (decided 2026-10-13). Somebody who is told only "€150" will believe that
  // is what a membership costs, and will find out otherwise a year later.
  // Threads are bought once and never show this.
  code_first_period_only: {
    en: 'The code applies to your first payment. It renews at the full price.',
    nl: 'De code geldt voor je eerste betaling. Daarna verlengt het tegen de volle prijs.',
    es: 'El código se aplica a tu primer pago. Se renueva al precio completo.', // MT
    pt: 'O código aplica-se ao teu primeiro pagamento. Renova ao preço total.', // MT
    de: 'Der Code gilt für deine erste Zahlung. Die Verlängerung erfolgt zum vollen Preis.', // MT
    fr: 'Le code s’applique à ton premier paiement. Le renouvellement se fait au prix normal.', // MT
  },
} satisfies Record<string, I18nEntry>;

export type DiscountCodeFieldKey = keyof typeof DISCOUNT_CODE_FIELD;

export const discountCodeT = makeT(DISCOUNT_CODE_FIELD);
