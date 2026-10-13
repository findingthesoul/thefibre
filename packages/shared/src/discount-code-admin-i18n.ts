// The discount-code editor's words — one copy for every app that has one.
//
// Written in The Thread's signed-in catalogue, where the editor was built,
// and lifted here when Members needed the same dialog. The strings are
// COPIED FROM that catalogue by a script rather than retyped: thirty-one keys
// in six languages is where a transcription error gets in, and a
// mistranslated "Active — redeemable at checkout" is a switch nobody dares
// touch.
//
// What stayed behind: the words that belong to a whole interface rather than
// to this dialog — Save, Cancel, Delete, Saving…, "Edit {title}". A shared
// fragment owning the word "Save" would collide with every app's own, so the
// component takes those as props instead.
//
// Thread still has its own copies; it adopts these in its own commit, which
// is a change to a live page and not something to fold into the lift.

import { makeT, type I18nEntry } from './i18n.js';

export const DISCOUNT_CODE_ADMIN = {
  active_redeemable: {
    en: 'Active — redeemable at checkout',
    nl: 'Actief — inwisselbaar bij het afrekenen',
    es: 'Activo — canjeable al pagar', // MT
    pt: 'Ativo — resgatável no checkout', // MT
    de: 'Aktiv — beim Checkout einlösbar', // MT
    fr: 'Actif — utilisable au paiement', // MT
  },
  add_code: {
    en: 'Add code',
    nl: 'Code toevoegen',
    es: 'Añadir código', // MT
    pt: 'Adicionar código', // MT
    de: 'Code hinzufügen', // MT
    fr: 'Ajouter un code', // MT
  },
  add_discount_code: {
    en: 'Add discount code',
    nl: 'Kortingscode toevoegen',
    es: 'Añadir código de descuento', // MT
    pt: 'Adicionar código de desconto', // MT
    de: 'Rabattcode hinzufügen', // MT
    fr: 'Ajouter un code de réduction', // MT
  },
  all_tickets: {
    en: 'All tickets',
    nl: 'Alle tickets',
    es: 'Todas las entradas', // MT
    pt: 'Todos os ingressos', // MT
    de: 'Alle Tickets', // MT
    fr: 'Tous les billets', // MT
  },
  amount_hint: {
    en: "Fixed amount off, in the ticket's currency.",
    nl: 'Vast bedrag korting, in de valuta van het ticket.',
    es: 'Importe fijo de descuento, en la moneda de la entrada.', // MT
    pt: 'Valor fixo de desconto, na moeda do ingresso.', // MT
    de: 'Fester Rabattbetrag in der Währung des Tickets.', // MT
    fr: 'Montant fixe de réduction, dans la devise du billet.', // MT
  },
  amount_label: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Valor', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  applies_to: {
    en: 'Applies to',
    nl: 'Geldt voor',
    es: 'Se aplica a', // MT
    pt: 'Aplica-se a', // MT
    de: 'Gilt für', // MT
    fr: 'S’applique à', // MT
  },
  code: {
    en: 'Code',
    nl: 'Code',
    es: 'Código', // MT
    pt: 'Código', // MT
    de: 'Code', // MT
    fr: 'Code', // MT
  },
  delete_discount_code: {
    en: 'Delete discount code',
    nl: 'Kortingscode verwijderen',
    es: 'Eliminar código de descuento', // MT
    pt: 'Excluir código de desconto', // MT
    de: 'Rabattcode löschen', // MT
    fr: 'Supprimer le code de réduction', // MT
  },
  delete_q_1: {
    en: 'Delete',
    nl: 'Verwijder',
    es: '¿Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Lösche', // MT
    fr: 'Supprimer', // MT
  },
  delete_q_2: {
    en: "? This can't be undone.",
    nl: '? Dit kan niet ongedaan worden gemaakt.',
    es: '? No se puede deshacer.', // MT
    pt: '? Isso não pode ser desfeito.', // MT
    de: '? Das kann nicht rückgängig gemacht werden.', // MT
    fr: ' ? Impossible d’annuler.', // MT
  },
  discount: {
    en: 'Discount',
    nl: 'Korting',
    es: 'Descuento', // MT
    pt: 'Desconto', // MT
    de: 'Rabatt', // MT
    fr: 'Réduction', // MT
  },
  discount_amount: {
    en: 'Discount amount',
    nl: 'Kortingsbedrag',
    es: 'Importe del descuento', // MT
    pt: 'Valor do desconto', // MT
    de: 'Rabattbetrag', // MT
    fr: 'Montant de la réduction', // MT
  },
  early_bird: {
    en: 'Early bird',
    nl: 'Vroegboeker',
    es: 'Madrugador', // MT
    pt: 'Antecipado', // MT
    de: 'Frühbucher', // MT
    fr: 'Lève-tôt', // MT
  },
  early_bird_deadline: {
    en: 'Early-bird deadline',
    nl: 'Vroegboekdeadline',
    es: 'Fecha límite del madrugador', // MT
    pt: 'Prazo do antecipado', // MT
    de: 'Frühbucher-Frist', // MT
    fr: 'Date limite lève-tôt', // MT
  },
  early_bird_switch: {
    en: 'Early bird — only valid until a deadline',
    nl: 'Vroegboeker — alleen geldig tot een deadline',
    es: 'Madrugador — solo válido hasta una fecha límite', // MT
    pt: 'Antecipado — válido apenas até um prazo', // MT
    de: 'Frühbucher — nur bis zu einer Frist gültig', // MT
    fr: 'Lève-tôt — valable seulement jusqu’à une date limite', // MT
  },
  err_code_value: {
    en: 'Give the code a value.',
    nl: 'Geef de code een waarde.',
    es: 'Dale un valor al código.', // MT
    pt: 'Dê um valor ao código.', // MT
    de: 'Gib dem Code einen Wert.', // MT
    fr: 'Donne une valeur au code.', // MT
  },
  err_discount_amount: {
    en: 'Set a discount amount.',
    nl: 'Stel een kortingsbedrag in.',
    es: 'Define un importe de descuento.', // MT
    pt: 'Defina um valor de desconto.', // MT
    de: 'Lege einen Rabattbetrag fest.', // MT
    fr: 'Définis un montant de réduction.', // MT
  },
  err_percentage: {
    en: 'Percentage must be between 1 and 100.',
    nl: 'Het percentage moet tussen 1 en 100 liggen.',
    es: 'El porcentaje debe estar entre 1 y 100.', // MT
    pt: 'A porcentagem deve estar entre 1 e 100.', // MT
    de: 'Der Prozentsatz muss zwischen 1 und 100 liegen.', // MT
    fr: 'Le pourcentage doit être compris entre 1 et 100.', // MT
  },
  expires: {
    en: 'Expires',
    nl: 'Verloopt',
    es: 'Caduca', // MT
    pt: 'Expira', // MT
    de: 'Läuft ab', // MT
    fr: 'Expire', // MT
  },
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis', // MT
    pt: 'Gratuito', // MT
    de: 'Kostenlos', // MT
    fr: 'Gratuit', // MT
  },
  free_code_note: {
    en: 'The code makes enrolment free — no charge at checkout.',
    nl: 'De code maakt inschrijven gratis — er wordt niets afgerekend.',
    es: 'El código hace la inscripción gratis — sin cobro al pagar.', // MT
    pt: 'O código torna a inscrição grátis — sem cobrança no checkout.', // MT
    de: 'Der Code macht die Anmeldung kostenlos — keine Abbuchung beim Checkout.', // MT
    fr: 'Le code rend l’inscription gratuite — aucun débit au paiement.', // MT
  },
  n_uses: {
    en: '{n} uses',
    nl: '{n} keer te gebruiken',
    es: '{n} usos', // MT
    pt: '{n} usos', // MT
    de: '{n} Verwendungen', // MT
    fr: '{n} utilisations', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  percent_hint: {
    en: 'Percent off, 1–100.',
    nl: 'Procent korting, 1–100.',
    es: 'Por ciento de descuento, 1–100.', // MT
    pt: 'Percentual de desconto, 1–100.', // MT
    de: 'Prozent Rabatt, 1–100.', // MT
    fr: 'Pourcentage de réduction, 1–100.', // MT
  },
  percentage: {
    en: 'Percentage',
    nl: 'Percentage',
    es: 'Porcentaje', // MT
    pt: 'Porcentagem', // MT
    de: 'Prozentsatz', // MT
    fr: 'Pourcentage', // MT
  },
  scope_hint: {
    en: 'Scope the code to one ticket, or leave it valid for all.',
    nl: 'Beperk de code tot één ticket, of laat hem voor alle gelden.',
    es: 'Limita el código a una entrada, o déjalo válido para todas.', // MT
    pt: 'Limite o código a um ingresso, ou deixe válido para todos.', // MT
    de: 'Beschränke den Code auf ein Ticket oder lass ihn für alle gelten.', // MT
    fr: 'Restreins le code à un billet, ou laisse-le valable pour tous.', // MT
  },
  type: {
    en: 'Type',
    nl: 'Type',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Typ', // MT
    fr: 'Type', // MT
  },
  unlimited: {
    en: 'Unlimited',
    nl: 'Onbeperkt',
    es: 'Ilimitado', // MT
    pt: 'Ilimitado', // MT
    de: 'Unbegrenzt', // MT
    fr: 'Illimité', // MT
  },
  uppercased_hint: {
    en: 'Uppercased automatically.',
    nl: 'Wordt automatisch in hoofdletters gezet.',
    es: 'Se pasa a mayúsculas automáticamente.', // MT
    pt: 'Convertido em maiúsculas automaticamente.', // MT
    de: 'Wird automatisch großgeschrieben.', // MT
    fr: 'Mis en majuscules automatiquement.', // MT
  },
  usage_limit: {
    en: 'Usage limit',
    nl: 'Gebruikslimiet',
    es: 'Límite de usos', // MT
    pt: 'Limite de usos', // MT
    de: 'Nutzungslimit', // MT
    fr: 'Limite d’utilisation', // MT
  },
} satisfies Record<string, I18nEntry>;

export type DiscountCodeAdminKey = keyof typeof DISCOUNT_CODE_ADMIN;

export const discountAdminT = makeT(DISCOUNT_CODE_ADMIN);
