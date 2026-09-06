'use client';

// The shared chrome's i18n (i18n P3, Sjoerd 2026-09-06: "P3 for all 6
// languages"). Two things live here:
//
// 1. LocaleProvider / useLocale — how CLIENT components learn the signed-in
//    user's interface language. Each app's (app)/layout.tsx reads the
//    thefibre.locale cookie server-side (lib/locale.ts → uiLocale()) and
//    wraps the shell in <LocaleProvider locale={…}>. Components outside a
//    provider (public pages) fall back to English — a public page that
//    wants localized shared chrome may wrap its own provider with the
//    CONTENT language.
//
// 2. The CHROME catalog — every user-facing string inside the shared
//    components (user-menu, sidebar, bottom-nav, dialogs, invoices area,
//    profile form, …), in ALL six locales. Same rule as every catalog: a
//    missing locale fails typecheck; es/pt/de/fr machine-drafted lines
//    carry `// MT` for native review, NL is written to native quality and
//    reviewed by Sjoerd.
//
// App-specific strings do NOT belong here — they live in the app's own
// lib/i18n-ui.ts. This catalog is only for strings rendered by
// packages/shared/src/ui components.

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, makeT, type I18nEntry, type Locale } from '../i18n.js';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The signed-in interface language; DEFAULT_LOCALE outside a provider. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

const CHROME = {
  // ── shell ────────────────────────────────────────────────────────────
  help: {
    en: 'Help',
    nl: 'Help',
    es: 'Ayuda', // MT
    pt: 'Ajuda', // MT
    de: 'Hilfe', // MT
    fr: 'Aide', // MT
  },
  more: {
    en: 'More',
    nl: 'Meer',
    es: 'Más', // MT
    pt: 'Mais', // MT
    de: 'Mehr', // MT
    fr: 'Plus', // MT
  },
  menu: {
    en: 'Menu',
    nl: 'Menu',
    es: 'Menú', // MT
    pt: 'Menu', // MT
    de: 'Menü', // MT
    fr: 'Menu', // MT
  },
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },

  // ── shared verbs & states (one key per word, reused everywhere) ──────
  save: {
    en: 'Save',
    nl: 'Opslaan',
    es: 'Guardar', // MT
    pt: 'Salvar', // MT
    de: 'Speichern', // MT
    fr: 'Enregistrer', // MT
  },
  saving: {
    en: 'Saving…',
    nl: 'Opslaan…',
    es: 'Guardando…', // MT
    pt: 'Salvando…', // MT
    de: 'Wird gespeichert…', // MT
    fr: 'Enregistrement…', // MT
  },
  saved: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
  },
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren',
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Abbrechen', // MT
    fr: 'Annuler', // MT
  },
  confirm: {
    en: 'Confirm',
    nl: 'Bevestigen',
    es: 'Confirmar', // MT
    pt: 'Confirmar', // MT
    de: 'Bestätigen', // MT
    fr: 'Confirmer', // MT
  },
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },
  deleting: {
    en: 'Deleting…',
    nl: 'Verwijderen…',
    es: 'Eliminando…', // MT
    pt: 'Excluindo…', // MT
    de: 'Wird gelöscht…', // MT
    fr: 'Suppression…', // MT
  },
  working: {
    en: 'Working…',
    nl: 'Bezig…',
    es: 'Procesando…', // MT
    pt: 'Processando…', // MT
    de: 'Wird ausgeführt…', // MT
    fr: 'En cours…', // MT
  },
  add: {
    en: 'Add',
    nl: 'Toevoegen',
    es: 'Añadir', // MT
    pt: 'Adicionar', // MT
    de: 'Hinzufügen', // MT
    fr: 'Ajouter', // MT
  },
  remove: {
    en: 'Remove',
    nl: 'Verwijderen',
    es: 'Quitar', // MT
    pt: 'Remover', // MT
    de: 'Entfernen', // MT
    fr: 'Retirer', // MT
  },
  replace: {
    en: 'Replace',
    nl: 'Vervangen',
    es: 'Reemplazar', // MT
    pt: 'Substituir', // MT
    de: 'Ersetzen', // MT
    fr: 'Remplacer', // MT
  },
  search: {
    en: 'Search…',
    nl: 'Zoeken…',
    es: 'Buscar…', // MT
    pt: 'Buscar…', // MT
    de: 'Suchen…', // MT
    fr: 'Rechercher…', // MT
  },
  searching: {
    en: 'Searching…',
    nl: 'Zoeken…',
    es: 'Buscando…', // MT
    pt: 'Buscando…', // MT
    de: 'Suche läuft…', // MT
    fr: 'Recherche…', // MT
  },
  no_matches: {
    en: 'No matches.',
    nl: 'Geen resultaten.',
    es: 'Sin resultados.', // MT
    pt: 'Sem resultados.', // MT
    de: 'Keine Treffer.', // MT
    fr: 'Aucun résultat.', // MT
  },
  pick: {
    en: 'Pick…',
    nl: 'Kies…',
    es: 'Elige…', // MT
    pt: 'Escolha…', // MT
    de: 'Auswählen…', // MT
    fr: 'Choisir…', // MT
  },
  loading: {
    en: 'Loading…',
    nl: 'Laden…',
    es: 'Cargando…', // MT
    pt: 'Carregando…', // MT
    de: 'Wird geladen…', // MT
    fr: 'Chargement…', // MT
  },
  load_more: {
    en: 'Load more',
    nl: 'Meer laden',
    es: 'Cargar más', // MT
    pt: 'Carregar mais', // MT
    de: 'Mehr laden', // MT
    fr: 'Charger plus', // MT
  },
  today: {
    en: 'Today',
    nl: 'Vandaag',
    es: 'Hoy', // MT
    pt: 'Hoje', // MT
    de: 'Heute', // MT
    fr: "Aujourd'hui", // MT
  },
  clear: {
    en: 'Clear',
    nl: 'Wissen',
    es: 'Borrar', // MT
    pt: 'Limpar', // MT
    de: 'Leeren', // MT
    fr: 'Effacer', // MT
  },
  send: {
    en: 'Send',
    nl: 'Versturen',
    es: 'Enviar', // MT
    pt: 'Enviar', // MT
    de: 'Senden', // MT
    fr: 'Envoyer', // MT
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird gesendet…', // MT
    fr: 'Envoi…', // MT
  },
  sent: {
    en: 'Sent ✓',
    nl: 'Verstuurd ✓',
    es: 'Enviado ✓', // MT
    pt: 'Enviado ✓', // MT
    de: 'Gesendet ✓', // MT
    fr: 'Envoyé ✓', // MT
  },
  dismiss: {
    en: 'Dismiss',
    nl: 'Sluiten',
    es: 'Descartar', // MT
    pt: 'Dispensar', // MT
    de: 'Ausblenden', // MT
    fr: 'Fermer', // MT
  },
  generic_error: {
    en: 'That did not work — try again.',
    nl: 'Dat lukte niet — probeer het opnieuw.',
    es: 'No ha funcionado — inténtalo de nuevo.', // MT
    pt: 'Não funcionou — tente novamente.', // MT
    de: 'Das hat nicht geklappt — versuch es noch einmal.', // MT
    fr: "Ça n'a pas fonctionné — réessaie.", // MT
  },

  // ── user-menu ────────────────────────────────────────────────────────
  signed_in: {
    en: 'Signed in',
    nl: 'Ingelogd',
    es: 'Sesión iniciada', // MT
    pt: 'Sessão iniciada', // MT
    de: 'Angemeldet', // MT
    fr: 'Connecté·e', // MT
  },
  profile: {
    en: 'Profile',
    nl: 'Profiel',
    es: 'Perfil', // MT
    pt: 'Perfil', // MT
    de: 'Profil', // MT
    fr: 'Profil', // MT
  },
  settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  take_tour: {
    en: 'Take a tour',
    nl: 'Rondleiding',
    es: 'Hacer un recorrido', // MT
    pt: 'Fazer um tour', // MT
    de: 'Rundgang starten', // MT
    fr: 'Faire le tour', // MT
  },
  workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  switching: {
    en: 'Switching…',
    nl: 'Wisselen…',
    es: 'Cambiando…', // MT
    pt: 'Trocando…', // MT
    de: 'Wechsel läuft…', // MT
    fr: 'Changement…', // MT
  },
  untitled_workspace: {
    en: 'Untitled workspace',
    nl: 'Naamloze werkruimte',
    es: 'Espacio sin nombre', // MT
    pt: 'Espaço sem nome', // MT
    de: 'Unbenannter Workspace', // MT
    fr: 'Espace sans nom', // MT
  },
  sidebar: {
    en: 'Sidebar',
    nl: 'Zijbalk',
    es: 'Barra lateral', // MT
    pt: 'Barra lateral', // MT
    de: 'Seitenleiste', // MT
    fr: 'Barre latérale', // MT
  },
  sidebar_expanded: {
    en: 'Expanded',
    nl: 'Uitgeklapt',
    es: 'Expandida', // MT
    pt: 'Expandida', // MT
    de: 'Ausgeklappt', // MT
    fr: 'Déployée', // MT
  },
  sidebar_collapsed: {
    en: 'Collapsed',
    nl: 'Ingeklapt',
    es: 'Contraída', // MT
    pt: 'Recolhida', // MT
    de: 'Eingeklappt', // MT
    fr: 'Réduite', // MT
  },
  sidebar_hover: {
    en: 'Expand on hover',
    nl: 'Uitklappen bij aanwijzen',
    es: 'Expandir al pasar el cursor', // MT
    pt: 'Expandir ao passar o cursor', // MT
    de: 'Bei Hover ausklappen', // MT
    fr: 'Déployer au survol', // MT
  },
  theme: {
    en: 'Theme',
    nl: 'Thema',
    es: 'Tema', // MT
    pt: 'Tema', // MT
    de: 'Design', // MT
    fr: 'Thème', // MT
  },
  theme_light: {
    en: 'Light',
    nl: 'Licht',
    es: 'Claro', // MT
    pt: 'Claro', // MT
    de: 'Hell', // MT
    fr: 'Clair', // MT
  },
  theme_dark: {
    en: 'Dark',
    nl: 'Donker',
    es: 'Oscuro', // MT
    pt: 'Escuro', // MT
    de: 'Dunkel', // MT
    fr: 'Sombre', // MT
  },
  theme_system: {
    en: 'System',
    nl: 'Systeem',
    es: 'Sistema', // MT
    pt: 'Sistema', // MT
    de: 'System', // MT
    fr: 'Système', // MT
  },
  sign_out: {
    en: 'Sign out',
    nl: 'Uitloggen',
    es: 'Cerrar sesión', // MT
    pt: 'Sair', // MT
    de: 'Abmelden', // MT
    fr: 'Se déconnecter', // MT
  },

  // ── app-switcher ─────────────────────────────────────────────────────
  switch_app: {
    en: 'Switch app',
    nl: 'Wissel van app',
    es: 'Cambiar de app', // MT
    pt: 'Mudar de app', // MT
    de: 'App wechseln', // MT
    fr: "Changer d'app", // MT
  },

  // ── danger-confirm ({word} stays literal: the typed keyword) ─────────
  danger_type_to_confirm: {
    en: 'Type {word} to confirm',
    nl: 'Typ {word} om te bevestigen',
    es: 'Escribe {word} para confirmar', // MT
    pt: 'Digite {word} para confirmar', // MT
    de: 'Gib {word} ein, um zu bestätigen', // MT
    fr: 'Saisis {word} pour confirmer', // MT
  },

  // ── invoices area ────────────────────────────────────────────────────
  scope_me: {
    en: 'Me',
    nl: 'Ik',
    es: 'Yo', // MT
    pt: 'Eu', // MT
    de: 'Ich', // MT
    fr: 'Moi', // MT
  },
  scope_team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipe', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  workspace_scope_needs_admin: {
    en: 'Workspace-wide invoices need an Admin role',
    nl: 'Facturen van de hele werkruimte vereisen een Admin-rol',
    es: 'Las facturas de todo el espacio requieren un rol de Admin', // MT
    pt: 'As faturas de todo o espaço exigem uma função de Admin', // MT
    de: 'Workspace-weite Rechnungen erfordern eine Admin-Rolle', // MT
    fr: "Les factures de tout l'espace nécessitent un rôle Admin", // MT
  },
  all_apps: {
    en: 'All apps',
    nl: 'Alle apps',
    es: 'Todas las apps', // MT
    pt: 'Todos os apps', // MT
    de: 'Alle Apps', // MT
    fr: 'Toutes les apps', // MT
  },
  search_invoices: {
    en: 'Search payer, email or item…',
    nl: 'Zoek op betaler, e-mail of item…',
    es: 'Busca por pagador, correo o concepto…', // MT
    pt: 'Busque por pagador, e-mail ou item…', // MT
    de: 'Nach Zahler, E-Mail oder Posten suchen…', // MT
    fr: 'Rechercher par payeur, e-mail ou élément…', // MT
  },
  status_paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'Pagado', // MT
    pt: 'Pago', // MT
    de: 'Bezahlt', // MT
    fr: 'Payé', // MT
  },
  status_pending: {
    en: 'Pending',
    nl: 'Openstaand',
    es: 'Pendiente', // MT
    pt: 'Pendente', // MT
    de: 'Ausstehend', // MT
    fr: 'En attente', // MT
  },
  status_refunded: {
    en: 'Refunded',
    nl: 'Terugbetaald',
    es: 'Reembolsado', // MT
    pt: 'Reembolsado', // MT
    de: 'Erstattet', // MT
    fr: 'Remboursé', // MT
  },
  status_failed: {
    en: 'Failed',
    nl: 'Mislukt',
    es: 'Fallido', // MT
    pt: 'Falhado', // MT
    de: 'Fehlgeschlagen', // MT
    fr: 'Échoué', // MT
  },
  platform_fees: {
    en: 'Platform fees',
    nl: 'Platformkosten',
    es: 'Comisiones de la plataforma', // MT
    pt: 'Taxas da plataforma', // MT
    de: 'Plattformgebühren', // MT
    fr: 'Frais de plateforme', // MT
  },
  purchase_count_one: {
    en: '{n} purchase',
    nl: '{n} aankoop',
    es: '{n} compra', // MT
    pt: '{n} compra', // MT
    de: '{n} Kauf', // MT
    fr: '{n} achat', // MT
  },
  purchase_count_other: {
    en: '{n} purchases',
    nl: '{n} aankopen',
    es: '{n} compras', // MT
    pt: '{n} compras', // MT
    de: '{n} Käufe', // MT
    fr: '{n} achats', // MT
  },
  first_2000: {
    en: ' (first 2000)',
    nl: ' (eerste 2000)',
    es: ' (primeras 2000)', // MT
    pt: ' (primeiras 2000)', // MT
    de: ' (erste 2000)', // MT
    fr: ' (2000 premiers)', // MT
  },
  no_purchases: {
    en: 'No purchases in this view yet.',
    nl: 'Nog geen aankopen in deze weergave.',
    es: 'Aún no hay compras en esta vista.', // MT
    pt: 'Ainda não há compras nesta visualização.', // MT
    de: 'Noch keine Käufe in dieser Ansicht.', // MT
    fr: "Pas encore d'achats dans cette vue.", // MT
  },
  method_free: {
    en: 'Free (code)',
    nl: 'Gratis (code)',
    es: 'Gratis (código)', // MT
    pt: 'Gratuito (código)', // MT
    de: 'Kostenlos (Code)', // MT
    fr: 'Gratuit (code)', // MT
  },
  method_card: {
    en: 'Card',
    nl: 'Kaart',
    es: 'Tarjeta', // MT
    pt: 'Cartão', // MT
    de: 'Karte', // MT
    fr: 'Carte', // MT
  },
  reimburse: {
    en: 'Reimburse',
    nl: 'Terugbetalen',
    es: 'Reembolsar', // MT
    pt: 'Reembolsar', // MT
    de: 'Erstatten', // MT
    fr: 'Rembourser', // MT
  },
  mark_paid: {
    en: 'Mark paid',
    nl: 'Markeer als betaald',
    es: 'Marcar como pagado', // MT
    pt: 'Marcar como pago', // MT
    de: 'Als bezahlt markieren', // MT
    fr: 'Marquer comme payé', // MT
  },
  send_payment_link: {
    en: 'Send payment link',
    nl: 'Betaallink versturen',
    es: 'Enviar enlace de pago', // MT
    pt: 'Enviar link de pagamento', // MT
    de: 'Zahlungslink senden', // MT
    fr: 'Envoyer le lien de paiement', // MT
  },
  resend_invoice: {
    en: 'Resend invoice',
    nl: 'Factuur opnieuw versturen',
    es: 'Reenviar factura', // MT
    pt: 'Reenviar fatura', // MT
    de: 'Rechnung erneut senden', // MT
    fr: 'Renvoyer la facture', // MT
  },
  marked_paid_ok: {
    en: 'Marked as paid.',
    nl: 'Gemarkeerd als betaald.',
    es: 'Marcado como pagado.', // MT
    pt: 'Marcado como pago.', // MT
    de: 'Als bezahlt markiert.', // MT
    fr: 'Marqué comme payé.', // MT
  },
  payment_link_sent_ok: {
    en: 'Payment link sent to the payer.',
    nl: 'Betaallink verstuurd naar de betaler.',
    es: 'Enlace de pago enviado al pagador.', // MT
    pt: 'Link de pagamento enviado ao pagador.', // MT
    de: 'Zahlungslink an den Zahler gesendet.', // MT
    fr: 'Lien de paiement envoyé au payeur.', // MT
  },
  invoice_sent_ok: {
    en: 'Invoice sent to the payer.',
    nl: 'Factuur verstuurd naar de betaler.',
    es: 'Factura enviada al pagador.', // MT
    pt: 'Fatura enviada ao pagador.', // MT
    de: 'Rechnung an den Zahler gesendet.', // MT
    fr: 'Facture envoyée au payeur.', // MT
  },
  reimbursed_ok: {
    en: 'Reimbursed in full.',
    nl: 'Volledig terugbetaald.',
    es: 'Reembolsado en su totalidad.', // MT
    pt: 'Reembolsado integralmente.', // MT
    de: 'Vollständig erstattet.', // MT
    fr: 'Remboursé intégralement.', // MT
  },
  split_line: {
    en: 'Split: fee {fee} · organiser {organiser} · workspace {workspace}',
    nl: 'Verdeling: kosten {fee} · organisator {organiser} · werkruimte {workspace}',
    es: 'Reparto: comisión {fee} · organizador {organiser} · espacio {workspace}', // MT
    pt: 'Divisão: taxa {fee} · organizador {organiser} · espaço {workspace}', // MT
    de: 'Aufteilung: Gebühr {fee} · Organisator {organiser} · Workspace {workspace}', // MT
    fr: 'Répartition : frais {fee} · organisateur {organiser} · espace {workspace}', // MT
  },
  refunded_on: {
    en: 'Refunded {date}',
    nl: 'Terugbetaald op {date}',
    es: 'Reembolsado el {date}', // MT
    pt: 'Reembolsado em {date}', // MT
    de: 'Erstattet am {date}', // MT
    fr: 'Remboursé le {date}', // MT
  },
  refund_title: {
    en: 'Reimburse this purchase?',
    nl: 'Deze aankoop terugbetalen?',
    es: '¿Reembolsar esta compra?', // MT
    pt: 'Reembolsar esta compra?', // MT
    de: 'Diesen Kauf erstatten?', // MT
    fr: 'Rembourser cet achat ?', // MT
  },
  refund_body_stripe: {
    en: '{name} gets {amount} back in full via Stripe (the platform fee is returned too). There is no partial refund.',
    nl: '{name} krijgt {amount} volledig terug via Stripe (ook de platformkosten gaan terug). Gedeeltelijk terugbetalen kan niet.',
    es: '{name} recibe {amount} de vuelta en su totalidad a través de Stripe (la comisión de la plataforma también se devuelve). No hay reembolso parcial.', // MT
    pt: '{name} recebe {amount} de volta integralmente via Stripe (a taxa da plataforma também é devolvida). Não há reembolso parcial.', // MT
    de: '{name} erhält {amount} vollständig über Stripe zurück (auch die Plattformgebühr wird erstattet). Eine Teilerstattung gibt es nicht.', // MT
    fr: "{name} récupère {amount} intégralement via Stripe (les frais de plateforme sont aussi remboursés). Il n'y a pas de remboursement partiel.", // MT
  },
  refund_body_offline: {
    en: '{name} gets {amount} back in full — recorded here; the money moves outside Stripe. There is no partial refund.',
    nl: '{name} krijgt {amount} volledig terug — hier vastgelegd; het geld gaat buiten Stripe om. Gedeeltelijk terugbetalen kan niet.',
    es: '{name} recibe {amount} de vuelta en su totalidad — se registra aquí; el dinero se mueve fuera de Stripe. No hay reembolso parcial.', // MT
    pt: '{name} recebe {amount} de volta integralmente — registrado aqui; o dinheiro se move fora da Stripe. Não há reembolso parcial.', // MT
    de: '{name} erhält {amount} vollständig zurück — hier festgehalten; das Geld fließt außerhalb von Stripe. Eine Teilerstattung gibt es nicht.', // MT
    fr: "{name} récupère {amount} intégralement — enregistré ici ; l'argent circule en dehors de Stripe. Il n'y a pas de remboursement partiel.", // MT
  },

  // ── invoice dialog ───────────────────────────────────────────────────
  receipt: {
    en: 'Receipt',
    nl: 'Betaalbewijs',
    es: 'Recibo', // MT
    pt: 'Recibo', // MT
    de: 'Quittung', // MT
    fr: 'Reçu', // MT
  },
  invoice: {
    en: 'Invoice',
    nl: 'Factuur',
    es: 'Factura', // MT
    pt: 'Fatura', // MT
    de: 'Rechnung', // MT
    fr: 'Facture', // MT
  },
  share_link: {
    en: 'Share link',
    nl: 'Link delen',
    es: 'Compartir enlace', // MT
    pt: 'Partilhar link', // MT
    de: 'Link teilen', // MT
    fr: 'Partager le lien', // MT
  },
  link_copied: {
    en: 'Link copied ✓',
    nl: 'Link gekopieerd ✓',
    es: 'Enlace copiado ✓', // MT
    pt: 'Link copiado ✓', // MT
    de: 'Link kopiert ✓', // MT
    fr: 'Lien copié ✓', // MT
  },
  download_pdf: {
    en: 'Download PDF',
    nl: 'PDF downloaden',
    es: 'Descargar PDF', // MT
    pt: 'Baixar PDF', // MT
    de: 'PDF herunterladen', // MT
    fr: 'Télécharger le PDF', // MT
  },
  email_to: {
    en: 'Email to…',
    nl: 'E-mailen naar…',
    es: 'Enviar por correo a…', // MT
    pt: 'Enviar por e-mail para…', // MT
    de: 'Per E-Mail an…', // MT
    fr: 'Envoyer par e-mail à…', // MT
  },
  print: {
    en: 'Print',
    nl: 'Afdrukken',
    es: 'Imprimir', // MT
    pt: 'Imprimir', // MT
    de: 'Drucken', // MT
    fr: 'Imprimer', // MT
  },
  enter_valid_email: {
    en: 'Enter a valid email address.',
    nl: 'Vul een geldig e-mailadres in.',
    es: 'Introduce una dirección de correo válida.', // MT
    pt: 'Digite um endereço de e-mail válido.', // MT
    de: 'Gib eine gültige E-Mail-Adresse ein.', // MT
    fr: 'Saisis une adresse e-mail valide.', // MT
  },
  from: {
    en: 'From',
    nl: 'Van',
    es: 'De', // MT
    pt: 'De', // MT
    de: 'Von', // MT
    fr: 'De', // MT
  },
  billed_to: {
    en: 'Billed to',
    nl: 'Gefactureerd aan',
    es: 'Facturado a', // MT
    pt: 'Faturado para', // MT
    de: 'Rechnung an', // MT
    fr: 'Facturé à', // MT
  },
  vat: {
    en: 'VAT',
    nl: 'Btw',
    es: 'IVA', // MT
    pt: 'IVA', // MT
    de: 'USt.', // MT
    fr: 'TVA', // MT
  },
  total_currency: {
    en: 'Total ({currency})',
    nl: 'Totaal ({currency})',
    es: 'Total ({currency})', // MT
    pt: 'Total ({currency})', // MT
    de: 'Gesamt ({currency})', // MT
    fr: 'Total ({currency})', // MT
  },
  by_invoice: {
    en: 'By invoice',
    nl: 'Op factuur',
    es: 'Por factura', // MT
    pt: 'Por fatura', // MT
    de: 'Auf Rechnung', // MT
    fr: 'Par facture', // MT
  },
  service_until: {
    en: 'service until {date}',
    nl: 'dienst tot {date}',
    es: 'servicio hasta {date}', // MT
    pt: 'serviço até {date}', // MT
    de: 'Leistung bis {date}', // MT
    fr: "service jusqu'au {date}", // MT
  },

  // ── profile form ─────────────────────────────────────────────────────
  display_name: {
    en: 'Display name',
    nl: 'Weergavenaam',
    es: 'Nombre visible', // MT
    pt: 'Nome de exibição', // MT
    de: 'Anzeigename', // MT
    fr: 'Nom affiché', // MT
  },
  public_url: {
    en: 'Public URL',
    nl: 'Openbare URL',
    es: 'URL pública', // MT
    pt: 'URL pública', // MT
    de: 'Öffentliche URL', // MT
    fr: 'URL publique', // MT
  },
  pick_public_url: {
    en: 'Pick a public URL.',
    nl: 'Kies een openbare URL.',
    es: 'Elige una URL pública.', // MT
    pt: 'Escolha uma URL pública.', // MT
    de: 'Wähle eine öffentliche URL.', // MT
    fr: 'Choisis une URL publique.', // MT
  },
  bio: {
    en: 'Bio',
    nl: 'Bio',
    es: 'Bio', // MT
    pt: 'Bio', // MT
    de: 'Bio', // MT
    fr: 'Bio', // MT
  },
  photo: {
    en: 'Photo',
    nl: 'Foto',
    es: 'Foto', // MT
    pt: 'Foto', // MT
    de: 'Foto', // MT
    fr: 'Photo', // MT
  },
  timezone: {
    en: 'Timezone',
    nl: 'Tijdzone',
    es: 'Zona horaria', // MT
    pt: 'Fuso horário', // MT
    de: 'Zeitzone', // MT
    fr: 'Fuseau horaire', // MT
  },
  pick_timezone: {
    en: 'Pick a timezone…',
    nl: 'Kies een tijdzone…',
    es: 'Elige una zona horaria…', // MT
    pt: 'Escolha um fuso horário…', // MT
    de: 'Zeitzone auswählen…', // MT
    fr: 'Choisis un fuseau horaire…', // MT
  },
  search_timezones: {
    en: 'Search timezones…',
    nl: 'Zoek tijdzones…',
    es: 'Buscar zonas horarias…', // MT
    pt: 'Buscar fusos horários…', // MT
    de: 'Zeitzonen suchen…', // MT
    fr: 'Rechercher un fuseau horaire…', // MT
  },
  timezone_hint: {
    en: 'IANA name, e.g. Europe/Amsterdam.',
    nl: 'IANA-naam, bijv. Europe/Amsterdam.',
    es: 'Nombre IANA, p. ej. Europe/Amsterdam.', // MT
    pt: 'Nome IANA, p. ex. Europe/Amsterdam.', // MT
    de: 'IANA-Name, z. B. Europe/Amsterdam.', // MT
    fr: 'Nom IANA, p. ex. Europe/Amsterdam.', // MT
  },
  could_not_save: {
    en: 'could not save',
    nl: 'opslaan is niet gelukt',
    es: 'no se pudo guardar', // MT
    pt: 'não foi possível salvar', // MT
    de: 'Speichern fehlgeschlagen', // MT
    fr: 'enregistrement impossible', // MT
  },

  // ── photo field ──────────────────────────────────────────────────────
  uploading: {
    en: 'Uploading…',
    nl: 'Uploaden…',
    es: 'Subiendo…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird hochgeladen…', // MT
    fr: 'Envoi…', // MT
  },
  upload_label: {
    en: 'Upload {label}',
    nl: '{label} uploaden',
    es: 'Subir {label}', // MT
    pt: 'Enviar {label}', // MT
    de: '{label} hochladen', // MT
    fr: 'Importer {label}', // MT
  },
  upload_failed: {
    en: 'upload failed',
    nl: 'uploaden is mislukt',
    es: 'error al subir', // MT
    pt: 'falha no envio', // MT
    de: 'Upload fehlgeschlagen', // MT
    fr: "échec de l'envoi", // MT
  },

  // ── currency editor ──────────────────────────────────────────────────
  currencies_intro: {
    en: 'The currencies this workspace sells in — one list for the whole workspace, used by every app that prices things. Each priced item picks one of them; existing prices keep their currency when the list changes.',
    nl: 'De valuta waarin deze werkruimte verkoopt — één lijst voor de hele werkruimte, gebruikt door elke app die prijzen hanteert. Elk geprijsd item kiest er één; bestaande prijzen houden hun valuta als de lijst verandert.',
    es: 'Las monedas en las que vende este espacio de trabajo — una sola lista para todo el espacio, usada por cada app que pone precios. Cada elemento con precio elige una; los precios existentes conservan su moneda cuando la lista cambia.', // MT
    pt: 'As moedas em que este espaço de trabalho vende — uma lista para todo o espaço, usada por todos os apps que definem preços. Cada item com preço escolhe uma; os preços existentes mantêm sua moeda quando a lista muda.', // MT
    de: 'Die Währungen, in denen dieser Workspace verkauft — eine Liste für den ganzen Workspace, genutzt von jeder App, die Preise führt. Jeder bepreiste Posten wählt eine davon; bestehende Preise behalten ihre Währung, wenn sich die Liste ändert.', // MT
    fr: "Les devises dans lesquelles cet espace de travail vend — une seule liste pour tout l'espace, utilisée par chaque app qui fixe des prix. Chaque élément tarifé en choisit une ; les prix existants gardent leur devise quand la liste change.", // MT
  },
  currency_code_error: {
    en: 'A currency is a 3-letter code, e.g. USD.',
    nl: 'Een valuta is een code van 3 letters, bijv. USD.',
    es: 'Una moneda es un código de 3 letras, p. ej. USD.', // MT
    pt: 'Uma moeda é um código de 3 letras, p. ex. USD.', // MT
    de: 'Eine Währung ist ein 3-Buchstaben-Code, z. B. USD.', // MT
    fr: 'Une devise est un code à 3 lettres, p. ex. USD.', // MT
  },
  add_currency_placeholder: {
    en: 'Add (e.g. USD)',
    nl: 'Toevoegen (bijv. USD)',
    es: 'Añadir (p. ej. USD)', // MT
    pt: 'Adicionar (p. ex. USD)', // MT
    de: 'Hinzufügen (z. B. USD)', // MT
    fr: 'Ajouter (p. ex. USD)', // MT
  },
  remove_item: {
    en: 'Remove {name}',
    nl: '{name} verwijderen',
    es: 'Quitar {name}', // MT
    pt: 'Remover {name}', // MT
    de: '{name} entfernen', // MT
    fr: 'Retirer {name}', // MT
  },
  default_currency: {
    en: 'Default currency',
    nl: 'Standaardvaluta',
    es: 'Moneda predeterminada', // MT
    pt: 'Moeda padrão', // MT
    de: 'Standardwährung', // MT
    fr: 'Devise par défaut', // MT
  },
  ecb_rates: {
    en: 'ECB reference rates',
    nl: 'ECB-referentiekoersen',
    es: 'Tipos de referencia del BCE', // MT
    pt: 'Taxas de referência do BCE', // MT
    de: 'EZB-Referenzkurse', // MT
    fr: 'Taux de référence de la BCE', // MT
  },
  indicative_only: {
    en: 'Indicative only — nothing is ever charged in a converted currency.',
    nl: 'Alleen indicatief — er wordt nooit iets afgerekend in een omgerekende valuta.',
    es: 'Solo orientativo — nunca se cobra nada en una moneda convertida.', // MT
    pt: 'Apenas indicativo — nada é cobrado em uma moeda convertida.', // MT
    de: 'Nur zur Orientierung — abgerechnet wird nie in einer umgerechneten Währung.', // MT
    fr: "À titre indicatif — rien n'est jamais facturé dans une devise convertie.", // MT
  },
  save_currencies: {
    en: 'Save currencies',
    nl: 'Valuta opslaan',
    es: 'Guardar monedas', // MT
    pt: 'Salvar moedas', // MT
    de: 'Währungen speichern', // MT
    fr: 'Enregistrer les devises', // MT
  },

  // ── date field ───────────────────────────────────────────────────────
  prev_month: {
    en: 'Previous month',
    nl: 'Vorige maand',
    es: 'Mes anterior', // MT
    pt: 'Mês anterior', // MT
    de: 'Voriger Monat', // MT
    fr: 'Mois précédent', // MT
  },
  next_month: {
    en: 'Next month',
    nl: 'Volgende maand',
    es: 'Mes siguiente', // MT
    pt: 'Mês seguinte', // MT
    de: 'Nächster Monat', // MT
    fr: 'Mois suivant', // MT
  },
  pick_date: {
    en: 'Pick a date',
    nl: 'Kies een datum',
    es: 'Elige una fecha', // MT
    pt: 'Escolha uma data', // MT
    de: 'Datum auswählen', // MT
    fr: 'Choisis une date', // MT
  },
  pick_datetime: {
    en: 'Pick date & time',
    nl: 'Kies datum en tijd',
    es: 'Elige fecha y hora', // MT
    pt: 'Escolha data e hora', // MT
    de: 'Datum und Uhrzeit auswählen', // MT
    fr: "Choisis la date et l'heure", // MT
  },

  // ── fields ───────────────────────────────────────────────────────────
  coming_soon_suffix: {
    en: ' — coming soon',
    nl: ' — binnenkort',
    es: ' — próximamente', // MT
    pt: ' — em breve', // MT
    de: ' — bald verfügbar', // MT
    fr: ' — bientôt', // MT
  },
} satisfies Record<string, I18nEntry>;

export const chromeT = makeT(CHROME);
export type ChromeKey = keyof typeof CHROME;
