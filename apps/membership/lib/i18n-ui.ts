// Membership — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string a signed-in user can see in Membership's interface
// lives HERE, in all locales. The locale list itself lives in
// @thefibre/shared/i18n (one definition for the whole platform); the catalog
// stays per-surface, next to its consumers. The catalog is typed so a key
// missing a translation fails `pnpm typecheck` — that is how the list stays
// complete as the product grows. Default locale: en.
//
// The PUBLIC surfaces (join page, embeds, /my) have their own catalog in
// lib/i18n.ts — this file follows its vocabulary (tier = nivel/nível/
// formule, member = lid/miembro/membro, membership = lidmaatschap/membresía/
// associação/adhésion) so an admin switching between both never meets two
// words for one thing.
//
// Register is informal (je / du / tú / você / tu). Dutch entries are native
// quality; es / pt / de / fr are machine-drafted (marked // MT) pending
// native review. Portuguese leans BRAZILIAN (você, Configurações, gerunds).
//
// Chrome only: user CONTENT — tier names, product names, member names,
// notes, headlines — is never translated. Product/brand terms (Circle,
// Thread, Meet, Stripe, Fibre, Google Workspace) stay as-is everywhere.

import { makeT, type I18nEntry } from '@thefibre/shared/i18n';

export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  INTL_LOCALES,
  isLocale,
  toLocale,
  type Locale,
} from '@thefibre/shared/i18n';

const CATALOG = {
  // ── shared ────────────────────────────────────────────────────────────
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren',
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Abbrechen', // MT
    fr: 'Annuler', // MT
  },
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
    en: 'Saved',
    nl: 'Opgeslagen',
    es: 'Guardado', // MT
    pt: 'Salvo', // MT
    de: 'Gespeichert', // MT
    fr: 'Enregistré', // MT
  },
  saved_dot: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
  },
  loading: {
    en: 'Loading…',
    nl: 'Laden…',
    es: 'Cargando…', // MT
    pt: 'Carregando…', // MT
    de: 'Wird geladen…', // MT
    fr: 'Chargement…', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  description: {
    en: 'Description',
    nl: 'Beschrijving',
    es: 'Descripción', // MT
    pt: 'Descrição', // MT
    de: 'Beschreibung', // MT
    fr: 'Description', // MT
  },
  optional_ph: {
    en: 'Optional',
    nl: 'Optioneel',
    es: 'Opcional', // MT
    pt: 'Opcional', // MT
    de: 'Optional', // MT
    fr: 'Facultatif', // MT
  },
  change: {
    en: 'Change',
    nl: 'Wijzigen',
    es: 'Cambiar', // MT
    pt: 'Alterar', // MT
    de: 'Ändern', // MT
    fr: 'Modifier', // MT
  },
  remove: {
    en: 'Remove',
    nl: 'Verwijderen',
    es: 'Quitar', // MT
    pt: 'Remover', // MT
    de: 'Entfernen', // MT
    fr: 'Retirer', // MT
  },
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },
  really_delete_q: {
    en: 'Really delete?',
    nl: 'Echt verwijderen?',
    es: '¿Eliminar de verdad?', // MT
    pt: 'Excluir mesmo?', // MT
    de: 'Wirklich löschen?', // MT
    fr: 'Vraiment supprimer ?', // MT
  },
  archive: {
    en: 'Archive',
    nl: 'Archiveren',
    es: 'Archivar', // MT
    pt: 'Arquivar', // MT
    de: 'Archivieren', // MT
    fr: 'Archiver', // MT
  },
  unarchive: {
    en: 'Unarchive',
    nl: 'Uit archief halen',
    es: 'Desarchivar', // MT
    pt: 'Desarquivar', // MT
    de: 'Aus dem Archiv holen', // MT
    fr: 'Désarchiver', // MT
  },
  really_archive_q: {
    en: 'Really archive?',
    nl: 'Echt archiveren?',
    es: '¿Archivar de verdad?', // MT
    pt: 'Arquivar mesmo?', // MT
    de: 'Wirklich archivieren?', // MT
    fr: 'Vraiment archiver ?', // MT
  },
  archived: {
    en: 'Archived',
    nl: 'Gearchiveerd',
    es: 'Archivado', // MT
    pt: 'Arquivado', // MT
    de: 'Archiviert', // MT
    fr: 'Archivé', // MT
  },
  archived_suffix: {
    en: '(archived)',
    nl: '(gearchiveerd)',
    es: '(archivado)', // MT
    pt: '(arquivado)', // MT
    de: '(archiviert)', // MT
    fr: '(archivé)', // MT
  },
  show_archived: {
    en: 'Show archived ({n})',
    nl: 'Gearchiveerde tonen ({n})',
    es: 'Mostrar archivados ({n})', // MT
    pt: 'Mostrar arquivados ({n})', // MT
    de: 'Archivierte anzeigen ({n})', // MT
    fr: 'Afficher les archivés ({n})', // MT
  },
  hide_archived: {
    en: 'Hide archived',
    nl: 'Gearchiveerde verbergen',
    es: 'Ocultar archivados', // MT
    pt: 'Ocultar arquivados', // MT
    de: 'Archivierte ausblenden', // MT
    fr: 'Masquer les archivés', // MT
  },
  name_required: {
    en: 'Name is required.',
    nl: 'Een naam is verplicht.',
    es: 'El nombre es obligatorio.', // MT
    pt: 'O nome é obrigatório.', // MT
    de: 'Ein Name ist erforderlich.', // MT
    fr: 'Le nom est obligatoire.', // MT
  },
  unknown_error: {
    en: 'unknown error',
    nl: 'onbekende fout',
    es: 'error desconocido', // MT
    pt: 'erro desconhecido', // MT
    de: 'unbekannter Fehler', // MT
    fr: 'erreur inconnue', // MT
  },
  tab_personal_organiser: {
    en: 'Personal (organiser)',
    nl: 'Persoonlijk (organisator)',
    es: 'Personal (organizador)', // MT
    pt: 'Pessoal (organizador)', // MT
    de: 'Persönlich (Organisator)', // MT
    fr: 'Personnel (organisateur)', // MT
  },
  tab_workspace_of: {
    en: 'Workspace of {name}',
    nl: 'Werkruimte van {name}',
    es: 'Espacio de trabajo de {name}', // MT
    pt: 'Espaço de trabalho de {name}', // MT
    de: 'Arbeitsbereich von {name}', // MT
    fr: 'Espace de travail de {name}', // MT
  },
  test_payment_title: {
    en: 'Test this account',
    nl: 'Deze rekening testen',
    es: 'Probar esta cuenta', // MT
    pt: 'Testar esta conta', // MT
    de: 'Dieses Konto testen', // MT
    fr: 'Tester ce compte', // MT
  },
  test_payment_note: {
    en: 'A real payment to this account, so you can see the money arrive. Refund it in Stripe afterwards.',
    nl: 'Een echte betaling naar deze rekening, zodat je het geld ziet binnenkomen. Je kunt het daarna in Stripe terugstorten.',
    es: 'Un pago real a esta cuenta, para que veas llegar el dinero. Devuélvelo después en Stripe.', // MT
    pt: 'Um pagamento real para esta conta, para veres o dinheiro chegar. Reembolsa-o depois no Stripe.', // MT
    de: 'Eine echte Zahlung auf dieses Konto, damit du das Geld ankommen siehst. Erstatte sie danach in Stripe.', // MT
    fr: 'Un vrai paiement vers ce compte, pour voir l’argent arriver. Remboursez-le ensuite dans Stripe.', // MT
  },
  test_payment_amount: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Montante', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  test_payment: {
    en: 'Test payment',
    nl: 'Testbetaling',
    es: 'Pago de prueba', // MT
    pt: 'Pagamento de teste', // MT
    de: 'Testzahlung', // MT
    fr: 'Paiement test', // MT
  },
  test_payment_opening: {
    en: 'Opening…',
    nl: 'Openen…',
    es: 'Abriendo…', // MT
    pt: 'A abrir…', // MT
    de: 'Wird geöffnet…', // MT
    fr: 'Ouverture…', // MT
  },
  err_test_payment: {
    en: 'That test payment could not be started. Use an amount of 0.50 or more.',
    nl: 'Die testbetaling kon niet worden gestart. Gebruik een bedrag van 0,50 of hoger.',
    es: 'No se pudo iniciar ese pago de prueba. Usa un importe de 0,50 o más.', // MT
    pt: 'Não foi possível iniciar esse pagamento de teste. Usa um montante de 0,50 ou mais.', // MT
    de: 'Diese Testzahlung konnte nicht gestartet werden. Verwende einen Betrag ab 0,50.', // MT
    fr: 'Ce paiement test n’a pas pu démarrer. Utilisez un montant de 0,50 ou plus.', // MT
  },
  website_on_invoices: {
    en: 'Website (on invoices)',
    nl: 'Website (op facturen)',
    es: 'Sitio web (en las facturas)', // MT
    pt: 'Site (nas faturas)', // MT
    de: 'Website (auf Rechnungen)', // MT
    fr: 'Site web (sur les factures)', // MT
  },
  connect_stripe_change: {
    en: 'Connect a different account',
    nl: 'Een andere rekening koppelen',
    es: 'Conectar otra cuenta', // MT
    pt: 'Ligar outra conta', // MT
    de: 'Ein anderes Konto verbinden', // MT
    fr: 'Connecter un autre compte', // MT
  },
  connect_stripe: {
    en: 'Connect Stripe',
    nl: 'Stripe koppelen',
    es: 'Conectar Stripe', // MT
    pt: 'Conectar o Stripe', // MT
    de: 'Stripe verbinden', // MT
    fr: 'Connecter Stripe', // MT
  },
  connect_stripe_note: {
    en: 'Opens Stripe so the account holder can approve. Money still goes to their own account — we only get permission to take the payment.',
    nl: 'Opent Stripe zodat de rekeninghouder toestemming kan geven. Het geld gaat nog steeds naar hun eigen rekening — wij krijgen alleen toestemming om de betaling aan te nemen.',
    es: 'Abre Stripe para que el titular apruebe. El dinero sigue yendo a su propia cuenta; solo obtenemos permiso para cobrar.', // MT
    pt: 'Abre o Stripe para o titular aprovar. O dinheiro continua a ir para a conta dele — só recebemos permissão para cobrar.', // MT
    de: 'Öffnet Stripe, damit der Kontoinhaber zustimmen kann. Das Geld geht weiterhin auf sein eigenes Konto — wir erhalten nur die Erlaubnis, die Zahlung anzunehmen.', // MT
    fr: 'Ouvre Stripe pour que le titulaire approuve. L’argent va toujours sur son propre compte : nous obtenons seulement l’autorisation d’encaisser.', // MT
  },
  opening: {
    en: 'Opening…',
    nl: 'Openen…',
    es: 'Abriendo…', // MT
    pt: 'A abrir…', // MT
    de: 'Wird geöffnet…', // MT
    fr: 'Ouverture…', // MT
  },
  stripe_unreachable: {
    en: 'Saved, not connected',
    nl: 'Opgeslagen, niet verbonden',
    es: 'Guardado, no conectado', // MT
    pt: 'Guardado, não ligado', // MT
    de: 'Gespeichert, nicht verbunden', // MT
    fr: 'Enregistré, non connecté', // MT
  },
  stripe_unreachable_note: {
    en: 'An account id is saved, but we cannot act on it — no payment can be taken. The account holder has to approve the connection from their own Stripe.',
    nl: 'Er is een rekeningnummer opgeslagen, maar we kunnen er niets mee — er kan geen betaling worden aangenomen. De rekeninghouder moet de koppeling vanuit zijn eigen Stripe goedkeuren.',
    es: 'Hay un identificador guardado, pero no podemos usarlo: no se puede cobrar. El titular debe aprobar la conexión desde su propio Stripe.', // MT
    pt: 'Há um identificador guardado, mas não podemos usá-lo: não é possível cobrar. O titular tem de aprovar a ligação a partir do seu próprio Stripe.', // MT
    de: 'Eine Konto-ID ist gespeichert, aber wir können sie nicht nutzen — es kann keine Zahlung angenommen werden. Der Kontoinhaber muss die Verbindung in seinem eigenen Stripe bestätigen.', // MT
    fr: 'Un identifiant de compte est enregistré, mais nous ne pouvons pas l’utiliser : aucun paiement n’est possible. Le titulaire doit approuver la connexion depuis son propre Stripe.', // MT
  },
  stripe_charges_disabled: {
    en: 'Connected, but Stripe is not letting this account take payments yet.',
    nl: 'Verbonden, maar Stripe laat deze rekening nog geen betalingen aannemen.',
    es: 'Conectado, pero Stripe aún no permite que esta cuenta cobre.', // MT
    pt: 'Ligado, mas o Stripe ainda não permite que esta conta receba pagamentos.', // MT
    de: 'Verbunden, aber Stripe lässt dieses Konto noch keine Zahlungen annehmen.', // MT
    fr: 'Connecté, mais Stripe n’autorise pas encore ce compte à encaisser.', // MT
  },
  err_connect_failed: {
    en: 'Could not open Stripe. Try again in a moment.',
    nl: 'Kon Stripe niet openen. Probeer het zo nog eens.',
    es: 'No se pudo abrir Stripe. Inténtalo de nuevo en un momento.', // MT
    pt: 'Não foi possível abrir o Stripe. Tente novamente daqui a pouco.', // MT
    de: 'Stripe konnte nicht geöffnet werden. Versuche es gleich noch einmal.', // MT
    fr: 'Impossible d’ouvrir Stripe. Réessayez dans un instant.', // MT
  },
  stripe_note_2: {
    en: '(Stripe → Settings → Account details). Leaving it empty disconnects. Payment options inherit downward: account default → thread → ticket, each level can override.',
    nl: '(Stripe → Settings → Account details). Leeg laten ontkoppelt. Betaalopties erven naar beneden: accountstandaard → thread → ticket, elk niveau kan afwijken.',
    es: '(Stripe → Settings → Account details). Dejarlo vacío desconecta. Las opciones de pago se heredan hacia abajo: cuenta → thread → entrada, cada nivel puede sobrescribir.', // MT
    pt: '(Stripe → Settings → Account details). Deixar vazio desconecta. As opções de pagamento herdam para baixo: padrão da conta → thread → ingresso, cada nível pode sobrescrever.', // MT
    de: '(Stripe → Settings → Account details). Leer lassen trennt die Verbindung. Zahlungsoptionen vererben sich nach unten: Konto-Standard → Thread → Ticket, jede Ebene kann abweichen.', // MT
    fr: '(Stripe → Settings → Account details). Laisser vide déconnecte. Les options de paiement s’héritent vers le bas : défaut du compte → thread → billet, chaque niveau peut surcharger.', // MT
  },
  what_is_this: {
    en: 'What is this?',
    nl: 'Wat is dit?',
    es: '¿Qué es esto?', // MT
    pt: 'O que é isto?', // MT
    de: 'Was ist das?', // MT
    fr: 'Qu’est-ce que c’est ?', // MT
  },
  vat_on_sales: {
    en: 'VAT on sales',
    nl: 'Btw op verkopen',
    es: 'IVA en las ventas', // MT
    pt: 'IVA nas vendas', // MT
    de: 'USt auf Verkäufe', // MT
    fr: 'TVA sur les ventes', // MT
  },
  vat_registered_label: {
    en: 'VAT registered — show VAT on invoices',
    nl: 'Btw-plichtig — toon btw op facturen',
    es: 'Registrado a efectos de IVA — mostrar IVA en facturas', // MT
    pt: 'Registrado para IVA — mostrar IVA nas faturas', // MT
    de: 'Umsatzsteuerpflichtig — USt auf Rechnungen zeigen', // MT
    fr: 'Assujetti à la TVA — afficher la TVA sur les factures', // MT
  },
  rate: {
    en: 'Rate',
    nl: 'Tarief',
    es: 'Tipo', // MT
    pt: 'Alíquota', // MT
    de: 'Satz', // MT
    fr: 'Taux', // MT
  },
  vat_included_note: {
    en: 'Prices stay what buyers see — the invoice splits out the included VAT (“incl. VAT 21%”). Personal settings override the workspace’s.',
    nl: 'Prijzen blijven wat kopers zien — de factuur splitst de inbegrepen btw uit („incl. 21% btw”). Persoonlijke instellingen gaan vóór die van de werkruimte.',
    es: 'Los precios siguen siendo los que ve el comprador — la factura desglosa el IVA incluido («IVA 21% incl.»). La configuración personal prevalece sobre la del espacio.', // MT
    pt: 'Os preços continuam sendo o que o comprador vê — a fatura destaca o IVA incluído (“IVA 21% incl.”). As configurações pessoais prevalecem sobre as do espaço.', // MT
    de: 'Preise bleiben, was Käufer sehen — die Rechnung weist die enthaltene USt aus („inkl. 21 % USt“). Persönliche Einstellungen gehen vor denen des Workspace.', // MT
    fr: 'Les prix restent ce que voit l’acheteur — la facture détaille la TVA incluse (« TVA 21 % incl. »). Les réglages personnels priment sur ceux de l’espace.', // MT
  },
  err_vat_rate: {
    en: 'VAT rate must be between 0 and 100.',
    nl: 'Het btw-tarief moet tussen 0 en 100 liggen.',
    es: 'El tipo de IVA debe estar entre 0 y 100.', // MT
    pt: 'A alíquota de IVA deve estar entre 0 e 100.', // MT
    de: 'Der USt-Satz muss zwischen 0 und 100 liegen.', // MT
    fr: 'Le taux de TVA doit être compris entre 0 et 100.', // MT
  },
  connected: {
    en: 'Connected',
    nl: 'Verbonden',
    es: 'Conectado', // MT
    pt: 'Conectado', // MT
    de: 'Verbunden', // MT
    fr: 'Connecté', // MT
  },
  not_connected: {
    en: 'Not connected',
    nl: 'Niet verbonden',
    es: 'Sin conectar', // MT
    pt: 'Não conectado', // MT
    de: 'Nicht verbunden', // MT
    fr: 'Non connecté', // MT
  },
  workspace_admins_only: {
    en: 'Workspace admins only.',
    nl: 'Alleen voor werkruimtebeheerders.',
    es: 'Solo para administradores del espacio de trabajo.', // MT
    pt: 'Somente administradores do workspace.', // MT
    de: 'Nur für Workspace-Admins.', // MT
    fr: "Réservé aux admins de l'espace de travail.", // MT
  },
  tier: {
    en: 'Tier',
    nl: 'Niveau',
    es: 'Nivel', // MT
    pt: 'Nível', // MT
    de: 'Stufe', // MT
    fr: 'Formule', // MT
  },
  status: {
    en: 'Status',
    nl: 'Status',
    es: 'Estado', // MT
    pt: 'Status', // MT
    de: 'Status', // MT
    fr: 'Statut', // MT
  },
  notes: {
    en: 'Notes',
    nl: 'Notities',
    es: 'Notas', // MT
    pt: 'Notas', // MT
    de: 'Notizen', // MT
    fr: 'Notes', // MT
  },
  country: {
    en: 'Country',
    nl: 'Land',
    es: 'País', // MT
    pt: 'País', // MT
    de: 'Land', // MT
    fr: 'Pays', // MT
  },
  currency: {
    en: 'Currency',
    nl: 'Valuta',
    es: 'Moneda', // MT
    pt: 'Moeda', // MT
    de: 'Währung', // MT
    fr: 'Devise', // MT
  },
  yearly: {
    en: 'Yearly',
    nl: 'Jaarlijks',
    es: 'Anual', // MT
    pt: 'Anual', // MT
    de: 'Jährlich', // MT
    fr: 'Annuel', // MT
  },
  monthly: {
    en: 'Monthly',
    nl: 'Maandelijks',
    es: 'Mensual', // MT
    pt: 'Mensal', // MT
    de: 'Monatlich', // MT
    fr: 'Mensuel', // MT
  },
  per_year: {
    en: '/ year',
    nl: '/ jaar',
    es: '/ año', // MT
    pt: '/ ano', // MT
    de: '/ Jahr', // MT
    fr: '/ an', // MT
  },
  per_month: {
    en: '/ month',
    nl: '/ maand',
    es: '/ mes', // MT
    pt: '/ mês', // MT
    de: '/ Monat', // MT
    fr: '/ mois', // MT
  },
  renews_on: {
    en: 'Renews on',
    nl: 'Verlengt op',
    es: 'Se renueva el', // MT
    pt: 'Renova em', // MT
    de: 'Verlängert sich am', // MT
    fr: 'Se renouvelle le', // MT
  },
  unknown_person: {
    en: 'Unknown person',
    nl: 'Onbekende persoon',
    es: 'Persona desconocida', // MT
    pt: 'Pessoa desconhecida', // MT
    de: 'Unbekannte Person', // MT
    fr: 'Personne inconnue', // MT
  },
  unknown_organisation: {
    en: 'Unknown organisation',
    nl: 'Onbekende organisatie',
    es: 'Organización desconocida', // MT
    pt: 'Organização desconhecida', // MT
    de: 'Unbekannte Organisation', // MT
    fr: 'Organisation inconnue', // MT
  },

  // ── nav (sidebar labels live in components/shell/sidebar.tsx) ─────────
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  nav_membership: {
    en: 'Members',
    nl: 'Members',
    es: 'Membresía', // MT
    pt: 'Members', // MT
    de: 'Members', // MT
    fr: 'Members', // MT
  },
  nav_community: {
    en: 'Community',
    nl: 'Community',
    es: 'Comunidad', // MT
    pt: 'Comunidade', // MT
    de: 'Community', // MT
    fr: 'Communauté', // MT
  },
  nav_members: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  nav_tiers: {
    en: 'Tiers',
    nl: 'Niveaus',
    es: 'Niveles', // MT
    pt: 'Níveis', // MT
    de: 'Stufen', // MT
    fr: 'Formules', // MT
  },
  nav_products: {
    en: 'Products',
    nl: 'Producten',
    es: 'Productos', // MT
    pt: 'Produtos', // MT
    de: 'Produkte', // MT
    fr: 'Produits', // MT
  },
  nav_money: {
    en: 'Money',
    nl: 'Geld',
    es: 'Dinero', // MT
    pt: 'Dinheiro', // MT
    de: 'Geld', // MT
    fr: 'Argent', // MT
  },
  nav_invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  nav_setup: {
    en: 'Setup',
    nl: 'Inrichting',
    es: 'Configuración', // MT
    pt: 'Configuração', // MT
    de: 'Einrichtung', // MT
    fr: 'Configuration', // MT
  },
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  nav_access: {
    en: 'Access',
    nl: 'Toegang',
    es: 'Acceso', // MT
    pt: 'Acesso', // MT
    de: 'Zugriff', // MT
    fr: 'Accès', // MT
  },
  nav_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },

  // ── member / access status vocab ──────────────────────────────────────
  status_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activo', // MT
    pt: 'Ativo', // MT
    de: 'Aktiv', // MT
    fr: 'Actif', // MT
  },
  status_grace: {
    en: 'Grace',
    nl: 'Respijt',
    es: 'Gracia', // MT
    pt: 'Carência', // MT
    de: 'Nachfrist', // MT
    fr: 'Grâce', // MT
  },
  status_lapsed: {
    en: 'Lapsed',
    nl: 'Verlopen',
    es: 'Vencido', // MT
    pt: 'Expirado', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expiré', // MT
  },
  status_cancelled: {
    en: 'Cancelled',
    nl: 'Opgezegd',
    es: 'Cancelado', // MT
    pt: 'Cancelado', // MT
    de: 'Gekündigt', // MT
    fr: 'Annulé', // MT
  },
  access_granted: {
    en: 'granted',
    nl: 'toegekend',
    es: 'concedido', // MT
    pt: 'concedido', // MT
    de: 'gewährt', // MT
    fr: 'accordé', // MT
  },
  access_pending: {
    en: 'pending',
    nl: 'in behandeling',
    es: 'pendiente', // MT
    pt: 'pendente', // MT
    de: 'ausstehend', // MT
    fr: 'en attente', // MT
  },
  access_awaiting_approval: {
    en: 'awaiting approval',
    nl: 'wacht op goedkeuring',
    es: 'esperando aprobación', // MT
    pt: 'aguardando aprovação', // MT
    de: 'wartet auf Freigabe', // MT
    fr: "en attente d'approbation", // MT
  },
  access_revoke_pending: {
    en: 'revoke pending',
    nl: 'intrekking in behandeling',
    es: 'revocación pendiente', // MT
    pt: 'revogação pendente', // MT
    de: 'Entzug ausstehend', // MT
    fr: 'révocation en attente', // MT
  },
  access_revoked: {
    en: 'revoked',
    nl: 'ingetrokken',
    es: 'revocado', // MT
    pt: 'revogado', // MT
    de: 'entzogen', // MT
    fr: 'révoqué', // MT
  },
  access_error: {
    en: 'error',
    nl: 'fout',
    es: 'error', // MT
    pt: 'erro', // MT
    de: 'Fehler', // MT
    fr: 'erreur', // MT
  },

  // ── dashboard ─────────────────────────────────────────────────────────
  dash_blurb: {
    en: "Your community's memberships at a glance.",
    nl: 'De lidmaatschappen van je community in één oogopslag.',
    es: 'Las membresías de tu comunidad de un vistazo.', // MT
    pt: 'As associações da sua comunidade em um relance.', // MT
    de: 'Die Mitgliedschaften deiner Community auf einen Blick.', // MT
    fr: "Les adhésions de ta communauté en un coup d'œil.", // MT
  },
  active_members: {
    en: 'Active members',
    nl: 'Actieve leden',
    es: 'Miembros activos', // MT
    pt: 'Membros ativos', // MT
    de: 'Aktive Mitglieder', // MT
    fr: 'Membres actifs', // MT
  },
  in_grace: {
    en: 'In grace',
    nl: 'In respijt',
    es: 'En gracia', // MT
    pt: 'Em carência', // MT
    de: 'In Nachfrist', // MT
    fr: 'En période de grâce', // MT
  },
  lapsed_label: {
    en: 'Lapsed',
    nl: 'Verlopen',
    es: 'Vencidos', // MT
    pt: 'Expirados', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expirés', // MT
  },
  annual_value: {
    en: 'Annual value',
    nl: 'Jaarwaarde',
    es: 'Valor anual', // MT
    pt: 'Valor anual', // MT
    de: 'Jahreswert', // MT
    fr: 'Valeur annuelle', // MT
  },
  annual_value_sub: {
    en: 'active members, yearly rate',
    nl: 'actieve leden, jaartarief',
    es: 'miembros activos, tarifa anual', // MT
    pt: 'membros ativos, valor anual', // MT
    de: 'aktive Mitglieder, Jahrestarif', // MT
    fr: 'membres actifs, tarif annuel', // MT
  },
  dash_empty_before: {
    en: 'No members yet. Add one on the',
    nl: 'Nog geen leden. Voeg er een toe op de pagina',
    es: 'Aún no hay miembros. Añade uno en la página', // MT
    pt: 'Ainda não há membros. Adicione um na página', // MT
    de: 'Noch keine Mitglieder. Füge eins auf der Seite', // MT
    fr: 'Pas encore de membres. Ajoutes-en un sur la page', // MT
  },
  dash_empty_after: {
    en: 'page, or share your join page once tiers are set up.',
    nl: '— of deel je aanmeldpagina zodra de niveaus klaarstaan.',
    es: '— o comparte tu página de inscripción cuando los niveles estén listos.', // MT
    pt: '— ou compartilhe sua página de adesão assim que os níveis estiverem prontos.', // MT
    de: 'hinzu — oder teile deine Beitrittsseite, sobald die Stufen eingerichtet sind.', // MT
    fr: "— ou partage ta page d'adhésion une fois les formules prêtes.", // MT
  },
  renewing_soon: {
    en: 'Renewing soon',
    nl: 'Verlengt binnenkort',
    es: 'Se renuevan pronto', // MT
    pt: 'Renovam em breve', // MT
    de: 'Verlängert sich bald', // MT
    fr: 'Renouvellements à venir', // MT
  },
  next_30_days: {
    en: 'next 30 days',
    nl: 'komende 30 dagen',
    es: 'próximos 30 días', // MT
    pt: 'próximos 30 dias', // MT
    de: 'nächste 30 Tage', // MT
    fr: '30 prochains jours', // MT
  },
  no_renewals_30: {
    en: 'No renewals in the next 30 days.',
    nl: 'Geen verlengingen in de komende 30 dagen.',
    es: 'No hay renovaciones en los próximos 30 días.', // MT
    pt: 'Nenhuma renovação nos próximos 30 dias.', // MT
    de: 'Keine Verlängerungen in den nächsten 30 Tagen.', // MT
    fr: 'Aucun renouvellement dans les 30 prochains jours.', // MT
  },
  recent_joins: {
    en: 'Recent joins',
    nl: 'Recent lid geworden',
    es: 'Altas recientes', // MT
    pt: 'Adesões recentes', // MT
    de: 'Neue Mitglieder', // MT
    fr: 'Adhésions récentes', // MT
  },
  latest_5: {
    en: 'latest 5',
    nl: 'laatste 5',
    es: 'últimas 5', // MT
    pt: 'últimas 5', // MT
    de: 'letzte 5', // MT
    fr: '5 dernières', // MT
  },
  no_joins_yet: {
    en: 'No joins recorded yet.',
    nl: 'Nog geen aanmeldingen geregistreerd.',
    es: 'Aún no hay altas registradas.', // MT
    pt: 'Nenhuma adesão registrada ainda.', // MT
    de: 'Noch keine Beitritte erfasst.', // MT
    fr: 'Aucune adhésion enregistrée pour le moment.', // MT
  },

  // ── members list ──────────────────────────────────────────────────────
  members_blurb: {
    en: 'Everyone with a membership — paid joins land here automatically.',
    nl: 'Iedereen met een lidmaatschap — betaalde aanmeldingen komen hier vanzelf terecht.',
    es: 'Todos los que tienen una membresía — las altas pagadas llegan aquí automáticamente.', // MT
    pt: 'Todos que têm uma associação — adesões pagas chegam aqui automaticamente.', // MT
    de: 'Alle mit einer Mitgliedschaft — bezahlte Beitritte landen automatisch hier.', // MT
    fr: 'Tous ceux qui ont une adhésion — les adhésions payées arrivent ici automatiquement.', // MT
  },
  add_member: {
    en: 'Add member',
    nl: 'Lid toevoegen',
    es: 'Añadir miembro', // MT
    pt: 'Adicionar membro', // MT
    de: 'Mitglied hinzufügen', // MT
    fr: 'Ajouter un membre', // MT
  },
  chip_all: {
    en: 'All',
    nl: 'Alle',
    es: 'Todos', // MT
    pt: 'Todos', // MT
    de: 'Alle', // MT
    fr: 'Tous', // MT
  },
  all_tiers: {
    en: 'All tiers',
    nl: 'Alle niveaus',
    es: 'Todos los niveles', // MT
    pt: 'Todos os níveis', // MT
    de: 'Alle Stufen', // MT
    fr: 'Toutes les formules', // MT
  },
  search_name_email_ph: {
    en: 'Search name or email…',
    nl: 'Zoek op naam of e-mail…',
    es: 'Busca por nombre o correo…', // MT
    pt: 'Busque por nome ou e-mail…', // MT
    de: 'Nach Name oder E-Mail suchen…', // MT
    fr: 'Rechercher un nom ou un e-mail…', // MT
  },
  no_members_filtered: {
    en: 'No members match these filters.',
    nl: 'Geen leden die aan deze filters voldoen.',
    es: 'Ningún miembro coincide con estos filtros.', // MT
    pt: 'Nenhum membro corresponde a esses filtros.', // MT
    de: 'Keine Mitglieder entsprechen diesen Filtern.', // MT
    fr: 'Aucun membre ne correspond à ces filtres.', // MT
  },
  no_members_yet: {
    en: 'No members yet.',
    nl: 'Nog geen leden.',
    es: 'Aún no hay miembros.', // MT
    pt: 'Ainda não há membros.', // MT
    de: 'Noch keine Mitglieder.', // MT
    fr: 'Pas encore de membres.', // MT
  },
  th_email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  organisation: {
    en: 'Organisation',
    nl: 'Organisatie',
    es: 'Organización', // MT
    pt: 'Organização', // MT
    de: 'Organisation', // MT
    fr: 'Organisation', // MT
  },
  seat_word: {
    en: 'Seat',
    nl: 'Plek',
    es: 'Plaza', // MT
    pt: 'Assento', // MT
    de: 'Platz', // MT
    fr: 'Place', // MT
  },
  one_seat: {
    en: '1 seat',
    nl: '1 plek',
    es: '1 plaza', // MT
    pt: '1 assento', // MT
    de: '1 Platz', // MT
    fr: '1 place', // MT
  },
  n_seats: {
    en: '{n} seats',
    nl: '{n} plekken',
    es: '{n} plazas', // MT
    pt: '{n} assentos', // MT
    de: '{n} Plätze', // MT
    fr: '{n} places', // MT
  },

  // ── add-member dialog ─────────────────────────────────────────────────
  add_member_desc: {
    en: 'Manual add — invoiced by email, or comped. Paid card joins come through the join page.',
    nl: 'Handmatig toevoegen — gefactureerd per e-mail, of gratis. Betaalde aanmeldingen met kaart lopen via de aanmeldpagina.',
    es: 'Alta manual — facturada por correo, o de cortesía. Las altas pagadas con tarjeta llegan por la página de inscripción.', // MT
    pt: 'Adição manual — faturada por e-mail, ou cortesia. Adesões pagas com cartão vêm pela página de adesão.', // MT
    de: 'Manuell hinzufügen — per E-Mail in Rechnung gestellt, oder kostenlos. Bezahlte Kartenbeitritte laufen über die Beitrittsseite.', // MT
    fr: "Ajout manuel — facturé par e-mail, ou offert. Les adhésions payées par carte passent par la page d'adhésion.", // MT
  },
  kind_person: {
    en: 'Person',
    nl: 'Persoon',
    es: 'Persona', // MT
    pt: 'Pessoa', // MT
    de: 'Person', // MT
    fr: 'Personne', // MT
  },
  kind_organisation: {
    en: 'Organisation',
    nl: 'Organisatie',
    es: 'Organización', // MT
    pt: 'Organização', // MT
    de: 'Organisation', // MT
    fr: 'Organisation', // MT
  },
  unnamed_organisation: {
    en: 'Unnamed organisation',
    nl: 'Naamloze organisatie',
    es: 'Organización sin nombre', // MT
    pt: 'Organização sem nome', // MT
    de: 'Unbenannte Organisation', // MT
    fr: 'Organisation sans nom', // MT
  },
  search_orgs_ph: {
    en: 'Search organisations by name or domain…',
    nl: 'Zoek organisaties op naam of domein…',
    es: 'Busca organizaciones por nombre o dominio…', // MT
    pt: 'Busque organizações por nome ou domínio…', // MT
    de: 'Organisationen nach Name oder Domain suchen…', // MT
    fr: 'Rechercher des organisations par nom ou domaine…', // MT
  },
  seat_allowance: {
    en: 'Seat allowance',
    nl: 'Aantal plekken',
    es: 'Cupo de plazas', // MT
    pt: 'Cota de assentos', // MT
    de: 'Platzkontingent', // MT
    fr: 'Quota de places', // MT
  },
  seat_allowance_hint: {
    en: 'How many people may occupy seats. The invoice is the tier price × seats; seats are assigned from the member afterwards.',
    nl: 'Hoeveel mensen een plek mogen innemen. De factuur is de niveauprijs × plekken; plekken wijs je daarna toe vanuit het lid.',
    es: 'Cuántas personas pueden ocupar plazas. La factura es el precio del nivel × plazas; las plazas se asignan después desde el miembro.', // MT
    pt: 'Quantas pessoas podem ocupar assentos. A fatura é o preço do nível × assentos; os assentos são atribuídos depois a partir do membro.', // MT
    de: 'Wie viele Personen Plätze belegen dürfen. Die Rechnung ist Stufenpreis × Plätze; Plätze werden danach am Mitglied zugewiesen.', // MT
    fr: "Combien de personnes peuvent occuper des places. La facture est le prix de la formule × places ; les places s'attribuent ensuite depuis le membre.", // MT
  },
  new_contact: {
    en: 'New contact',
    nl: 'Nieuw contact',
    es: 'Nuevo contacto', // MT
    pt: 'Novo contato', // MT
    de: 'Neuer Kontakt', // MT
    fr: 'Nouveau contact', // MT
  },
  search_instead: {
    en: 'Search instead',
    nl: 'Toch zoeken',
    es: 'Buscar en su lugar', // MT
    pt: 'Buscar em vez disso', // MT
    de: 'Doch lieber suchen', // MT
    fr: 'Rechercher plutôt', // MT
  },
  full_name_ph: {
    en: 'Full name',
    nl: 'Volledige naam',
    es: 'Nombre completo', // MT
    pt: 'Nome completo', // MT
    de: 'Vollständiger Name', // MT
    fr: 'Nom complet', // MT
  },
  email_address_ph: {
    en: 'Email address',
    nl: 'E-mailadres',
    es: 'Correo electrónico', // MT
    pt: 'Endereço de e-mail', // MT
    de: 'E-Mail-Adresse', // MT
    fr: 'Adresse e-mail', // MT
  },
  phone_optional_ph: {
    en: 'Phone (optional)',
    nl: 'Telefoon (optioneel)',
    es: 'Teléfono (opcional)', // MT
    pt: 'Telefone (opcional)', // MT
    de: 'Telefon (optional)', // MT
    fr: 'Téléphone (facultatif)', // MT
  },
  street_ph: {
    en: 'Street and number',
    nl: 'Straat en huisnummer',
    es: 'Calle y número', // MT
    pt: 'Rua e número', // MT
    de: 'Straße und Hausnummer', // MT
    fr: 'Rue et numéro', // MT
  },
  postal_ph: {
    en: 'Postal code',
    nl: 'Postcode',
    es: 'Código postal', // MT
    pt: 'CEP', // MT
    de: 'PLZ', // MT
    fr: 'Code postal', // MT
  },
  city_ph: {
    en: 'City',
    nl: 'Plaats',
    es: 'Ciudad', // MT
    pt: 'Cidade', // MT
    de: 'Ort', // MT
    fr: 'Ville', // MT
  },
  creates_contact_hint: {
    en: 'Creates the contact in The Fibre, then adds the membership.',
    nl: 'Maakt het contact aan in The Fibre en voegt daarna het lidmaatschap toe.',
    es: 'Crea el contacto en The Fibre y luego añade la membresía.', // MT
    pt: 'Cria o contato no The Fibre e depois adiciona a associação.', // MT
    de: 'Legt den Kontakt in The Fibre an und fügt dann die Mitgliedschaft hinzu.', // MT
    fr: "Crée le contact dans The Fibre, puis ajoute l'adhésion.", // MT
  },
  search_contacts_ph: {
    en: 'Search contacts by name or email…',
    nl: 'Zoek contacten op naam of e-mail…',
    es: 'Busca contactos por nombre o correo…', // MT
    pt: 'Busque contatos por nome ou e-mail…', // MT
    de: 'Kontakte nach Name oder E-Mail suchen…', // MT
    fr: 'Rechercher des contacts par nom ou e-mail…', // MT
  },
  create_as_new_contact: {
    en: '＋ Create “{name}” as a new contact',
    nl: '＋ Maak “{name}” aan als nieuw contact',
    es: '＋ Crear “{name}” como contacto nuevo', // MT
    pt: '＋ Criar “{name}” como novo contato', // MT
    de: '＋ „{name}“ als neuen Kontakt anlegen', // MT
    fr: '＋ Créer « {name} » comme nouveau contact', // MT
  },
  pick_country_ph: {
    en: 'Pick a country…',
    nl: 'Kies een land…',
    es: 'Elige un país…', // MT
    pt: 'Escolha um país…', // MT
    de: 'Wähle ein Land…', // MT
    fr: 'Choisis un pays…', // MT
  },
  search_countries_ph: {
    en: 'Search countries…',
    nl: 'Zoek landen…',
    es: 'Busca países…', // MT
    pt: 'Busque países…', // MT
    de: 'Länder suchen…', // MT
    fr: 'Rechercher des pays…', // MT
  },
  pricing_rules_use_this: {
    en: 'Pricing rules use this.',
    nl: 'De prijsregels gebruiken dit.',
    es: 'Las reglas de precios usan esto.', // MT
    pt: 'As regras de preço usam isto.', // MT
    de: 'Die Preisregeln nutzen das.', // MT
    fr: "Les règles de prix s'en servent.", // MT
  },
  vat_number: {
    en: 'VAT number',
    nl: 'Btw-nummer',
    es: 'Número de IVA', // MT
    pt: 'Número de IVA', // MT
    de: 'USt-IdNr.', // MT
    fr: 'Numéro de TVA', // MT
  },
  if_applicable_ph: {
    en: 'If applicable',
    nl: 'Indien van toepassing',
    es: 'Si aplica', // MT
    pt: 'Se aplicável', // MT
    de: 'Falls zutreffend', // MT
    fr: 'Le cas échéant', // MT
  },
  shown_on_their_invoices: {
    en: 'Shown on their invoices.',
    nl: 'Staat op hun facturen.',
    es: 'Aparece en sus facturas.', // MT
    pt: 'Aparece nas faturas deles.', // MT
    de: 'Erscheint auf ihren Rechnungen.', // MT
    fr: 'Figure sur leurs factures.', // MT
  },
  billing_invoice_desc: {
    en: 'Creates a pending invoice and emails it — pay by transfer or payment link.',
    nl: 'Maakt een openstaande factuur aan en mailt die — betalen per overschrijving of betaallink.',
    es: 'Crea una factura pendiente y la envía por correo — pago por transferencia o enlace de pago.', // MT
    pt: 'Cria uma fatura pendente e a envia por e-mail — pague por transferência ou link de pagamento.', // MT
    de: 'Erstellt eine offene Rechnung und mailt sie — Zahlung per Überweisung oder Zahlungslink.', // MT
    fr: 'Crée une facture en attente et l’envoie par e-mail — paiement par virement ou lien de paiement.', // MT
  },
  billing_no_price_desc: {
    en: 'This tier has no price — only comped is possible.',
    nl: 'Dit niveau heeft geen prijs — alleen gratis is mogelijk.',
    es: 'Este nivel no tiene precio — solo es posible de cortesía.', // MT
    pt: 'Este nível não tem preço — só cortesia é possível.', // MT
    de: 'Diese Stufe hat keinen Preis — nur kostenlos ist möglich.', // MT
    fr: 'Cette formule n’a pas de prix — seul l’offert est possible.', // MT
  },
  billing_comped_desc: {
    en: 'Free — no invoice.',
    nl: 'Gratis — geen factuur.',
    es: 'Gratis — sin factura.', // MT
    pt: 'Grátis — sem fatura.', // MT
    de: 'Kostenlos — keine Rechnung.', // MT
    fr: 'Gratuit — pas de facture.', // MT
  },
  pricing_rules_may_adjust: {
    en: 'Pricing rules may adjust this.',
    nl: 'De prijsregels kunnen dit aanpassen.',
    es: 'Las reglas de precios pueden ajustar esto.', // MT
    pt: 'As regras de preço podem ajustar isto.', // MT
    de: 'Die Preisregeln können das anpassen.', // MT
    fr: 'Les règles de prix peuvent ajuster ce montant.', // MT
  },
  send_invite: {
    en: 'Send an invitation email',
    nl: 'Stuur een uitnodigingsmail',
    es: 'Enviar un correo de invitación', // MT
    pt: 'Enviar um e-mail de convite', // MT
    de: 'Eine Einladungs-E-Mail senden', // MT
    fr: "Envoyer un e-mail d'invitation", // MT
  },
  send_invite_hint: {
    en: 'Welcomes them and links their member page (membership, invoices, payment details).',
    nl: 'Heet ze welkom en linkt naar hun ledenpagina (lidmaatschap, facturen, betaalgegevens).',
    es: 'Les da la bienvenida y enlaza su página de miembro (membresía, facturas, datos de pago).', // MT
    pt: 'Dá as boas-vindas e leva à página de membro (associação, faturas, dados de pagamento).', // MT
    de: 'Begrüßt sie und verlinkt ihre Mitgliederseite (Mitgliedschaft, Rechnungen, Zahlungsdaten).', // MT
    fr: "Leur souhaite la bienvenue et renvoie vers leur page membre (adhésion, factures, moyens de paiement).", // MT
  },
  renews_hint: {
    en: 'Leave blank for one period from today. Overdue manual members move to grace, then lapsed.',
    nl: 'Laat leeg voor één periode vanaf vandaag. Handmatige leden die over tijd zijn gaan naar respijt, dan verlopen.',
    es: 'Déjalo en blanco para un periodo desde hoy. Los miembros manuales vencidos pasan a gracia y luego a vencido.', // MT
    pt: 'Deixe em branco para um período a partir de hoje. Membros manuais em atraso passam a carência e depois a expirado.', // MT
    de: 'Leer lassen für eine Periode ab heute. Überfällige manuelle Mitglieder gehen auf Nachfrist, dann abgelaufen.', // MT
    fr: "Laissez vide pour une période à partir d'aujourd'hui. Les membres manuels en retard passent en grâce, puis en expiré.", // MT
  },
  pick_a_tier: {
    en: 'Pick a tier.',
    nl: 'Kies een niveau.',
    es: 'Elige un nivel.', // MT
    pt: 'Escolha um nível.', // MT
    de: 'Wähle eine Stufe.', // MT
    fr: 'Choisis une formule.', // MT
  },
  pick_an_organisation: {
    en: 'Pick an organisation.',
    nl: 'Kies een organisatie.',
    es: 'Elige una organización.', // MT
    pt: 'Escolha uma organização.', // MT
    de: 'Wähle eine Organisation.', // MT
    fr: 'Choisis une organisation.', // MT
  },
  pick_person_or_new: {
    en: 'Pick a person, or create a new contact.',
    nl: 'Kies een persoon, of maak een nieuw contact aan.',
    es: 'Elige una persona o crea un contacto nuevo.', // MT
    pt: 'Escolha uma pessoa ou crie um novo contato.', // MT
    de: 'Wähle eine Person oder lege einen neuen Kontakt an.', // MT
    fr: 'Choisis une personne, ou crée un nouveau contact.', // MT
  },
  new_contact_needs: {
    en: 'A new contact needs a name and an email address.',
    nl: 'Een nieuw contact heeft een naam en een e-mailadres nodig.',
    es: 'Un contacto nuevo necesita un nombre y un correo electrónico.', // MT
    pt: 'Um novo contato precisa de um nome e um endereço de e-mail.', // MT
    de: 'Ein neuer Kontakt braucht einen Namen und eine E-Mail-Adresse.', // MT
    fr: 'Un nouveau contact a besoin d’un nom et d’une adresse e-mail.', // MT
  },
  could_not_create_contact: {
    en: 'could not create the contact',
    nl: 'kon het contact niet aanmaken',
    es: 'no se pudo crear el contacto', // MT
    pt: 'não foi possível criar o contato', // MT
    de: 'Kontakt konnte nicht angelegt werden', // MT
    fr: 'impossible de créer le contact', // MT
  },
  vat_save_failed: {
    en: 'Could not save the VAT number: {error}',
    nl: 'Kon het btw-nummer niet opslaan: {error}',
    es: 'No se pudo guardar el número de IVA: {error}', // MT
    pt: 'Não foi possível salvar o número de IVA: {error}', // MT
    de: 'USt-IdNr. konnte nicht gespeichert werden: {error}', // MT
    fr: "Impossible d'enregistrer le numéro de TVA : {error}", // MT
  },
  member_added_but: {
    en: 'Member added, but: {error}',
    nl: 'Lid toegevoegd, maar: {error}',
    es: 'Miembro añadido, pero: {error}', // MT
    pt: 'Membro adicionado, mas: {error}', // MT
    de: 'Mitglied hinzugefügt, aber: {error}', // MT
    fr: 'Membre ajouté, mais : {error}', // MT
  },
  membership_added_but: {
    en: 'Membership added, but: {error}',
    nl: 'Lidmaatschap toegevoegd, maar: {error}',
    es: 'Membresía añadida, pero: {error}', // MT
    pt: 'Associação adicionada, mas: {error}', // MT
    de: 'Mitgliedschaft hinzugefügt, aber: {error}', // MT
    fr: 'Adhésion ajoutée, mais : {error}', // MT
  },

  // ── member dialog ─────────────────────────────────────────────────────
  org_membership: {
    en: 'Organisation membership',
    nl: 'Organisatielidmaatschap',
    es: 'Membresía de organización', // MT
    pt: 'Associação de organização', // MT
    de: 'Organisations-Mitgliedschaft', // MT
    fr: "Adhésion d'organisation", // MT
  },
  seat_allowance_edit_hint: {
    en: 'How many people may occupy seats. Lowering it never removes anyone — it only blocks new seats.',
    nl: 'Hoeveel mensen een plek mogen innemen. Verlagen verwijdert nooit iemand — het blokkeert alleen nieuwe plekken.',
    es: 'Cuántas personas pueden ocupar plazas. Bajarlo nunca quita a nadie — solo bloquea plazas nuevas.', // MT
    pt: 'Quantas pessoas podem ocupar assentos. Reduzir nunca remove ninguém — só bloqueia novos assentos.', // MT
    de: 'Wie viele Personen Plätze belegen dürfen. Senken entfernt nie jemanden — es blockiert nur neue Plätze.', // MT
    fr: "Combien de personnes peuvent occuper des places. Réduire n'enlève jamais personne — cela bloque seulement les nouvelles places.", // MT
  },
  country_not_declared: {
    en: 'Not declared',
    nl: 'Niet opgegeven',
    es: 'No declarado', // MT
    pt: 'Não declarado', // MT
    de: 'Nicht angegeben', // MT
    fr: 'Non déclaré', // MT
  },
  country_edit_hint: {
    en: 'Self-declared — drives the pricing rules. Changing it reprices a live subscription from the NEXT renewal (never mid-cycle).',
    nl: 'Zelf opgegeven — stuurt de prijsregels. Wijzigen herprijst een lopend abonnement pas vanaf de VOLGENDE verlenging (nooit halverwege).',
    es: 'Autodeclarado — alimenta las reglas de precios. Cambiarlo reprecia una suscripción activa desde la PRÓXIMA renovación (nunca a mitad de ciclo).', // MT
    pt: 'Autodeclarado — alimenta as regras de preço. Alterá-lo reprecifica uma assinatura ativa a partir da PRÓXIMA renovação (nunca no meio do ciclo).', // MT
    de: 'Selbst angegeben — steuert die Preisregeln. Eine Änderung bepreist ein laufendes Abo erst ab der NÄCHSTEN Verlängerung neu (nie mitten im Zyklus).', // MT
    fr: "Auto-déclaré — alimente les règles de prix. Le changer retarife un abonnement en cours à partir du PROCHAIN renouvellement (jamais en cours de cycle).", // MT
  },
  access_sync: {
    en: 'Access sync',
    nl: 'Toegangssynchronisatie',
    es: 'Sincronización de acceso', // MT
    pt: 'Sincronização de acesso', // MT
    de: 'Zugriffs-Sync', // MT
    fr: 'Synchronisation des accès', // MT
  },
  no_access_grants: {
    en: 'No access grants on this tier.',
    nl: 'Geen toegangsrechten op dit niveau.',
    es: 'No hay concesiones de acceso en este nivel.', // MT
    pt: 'Nenhuma concessão de acesso neste nível.', // MT
    de: 'Keine Zugriffsberechtigungen auf dieser Stufe.', // MT
    fr: "Aucun droit d'accès sur cette formule.", // MT
  },
  synced_on: {
    en: 'synced {date}',
    nl: 'gesynchroniseerd {date}',
    es: 'sincronizado {date}', // MT
    pt: 'sincronizado {date}', // MT
    de: 'synchronisiert {date}', // MT
    fr: 'synchronisé le {date}', // MT
  },
  approve_seat: {
    en: 'Approve seat',
    nl: 'Plek goedkeuren',
    es: 'Aprobar plaza', // MT
    pt: 'Aprovar assento', // MT
    de: 'Platz freigeben', // MT
    fr: 'Approuver la place', // MT
  },

  // ── org seats ─────────────────────────────────────────────────────────
  seats: {
    en: 'Seats',
    nl: 'Plekken',
    es: 'Plazas', // MT
    pt: 'Assentos', // MT
    de: 'Plätze', // MT
    fr: 'Places', // MT
  },
  seats_occupancy: {
    en: '{occupied} of {allowance} seats',
    nl: '{occupied} van {allowance} plekken',
    es: '{occupied} de {allowance} plazas', // MT
    pt: '{occupied} de {allowance} assentos', // MT
    de: '{occupied} von {allowance} Plätzen', // MT
    fr: '{occupied} places sur {allowance}', // MT
  },
  seats_occupancy_one: {
    en: '{occupied} of 1 seat',
    nl: '{occupied} van 1 plek',
    es: '{occupied} de 1 plaza', // MT
    pt: '{occupied} de 1 assento', // MT
    de: '{occupied} von 1 Platz', // MT
    fr: '{occupied} place sur 1', // MT
  },
  no_seat_occupied: {
    en: 'No one occupies a seat yet.',
    nl: 'Nog niemand neemt een plek in.',
    es: 'Nadie ocupa una plaza todavía.', // MT
    pt: 'Ninguém ocupa um assento ainda.', // MT
    de: 'Noch niemand belegt einen Platz.', // MT
    fr: 'Personne n’occupe encore de place.', // MT
  },
  seats_full_ph: {
    en: 'All seats occupied — raise the allowance to add',
    nl: 'Alle plekken bezet — verhoog het aantal om toe te voegen',
    es: 'Todas las plazas ocupadas — sube el cupo para añadir', // MT
    pt: 'Todos os assentos ocupados — aumente a cota para adicionar', // MT
    de: 'Alle Plätze belegt — erhöhe das Kontingent zum Hinzufügen', // MT
    fr: 'Toutes les places sont prises — augmente le quota pour ajouter', // MT
  },
  add_person_search_ph: {
    en: 'Add a person — search contacts…',
    nl: 'Voeg iemand toe — zoek contacten…',
    es: 'Añade a alguien — busca contactos…', // MT
    pt: 'Adicione alguém — busque contatos…', // MT
    de: 'Person hinzufügen — Kontakte suchen…', // MT
    fr: 'Ajoute quelqu’un — recherche des contacts…', // MT
  },

  // ── tiers ─────────────────────────────────────────────────────────────
  tiers_blurb: {
    en: 'The membership levels your community can join at. Each tier bundles products and unlocks access (see Access).',
    nl: 'De lidmaatschapsniveaus waarop je community lid kan worden. Elk niveau bundelt producten en geeft toegang (zie Toegang).',
    es: 'Los niveles de membresía a los que tu comunidad puede unirse. Cada nivel agrupa productos y desbloquea acceso (ver Acceso).', // MT
    pt: 'Os níveis de associação que sua comunidade pode escolher. Cada nível agrupa produtos e desbloqueia acesso (veja Acesso).', // MT
    de: 'Die Mitgliedschaftsstufen deiner Community. Jede Stufe bündelt Produkte und schaltet Zugriff frei (siehe Zugriff).', // MT
    fr: "Les formules d'adhésion de ta communauté. Chaque formule regroupe des produits et débloque des accès (voir Accès).", // MT
  },
  new_tier: {
    en: 'New tier',
    nl: 'Nieuw niveau',
    es: 'Nuevo nivel', // MT
    pt: 'Novo nível', // MT
    de: 'Neue Stufe', // MT
    fr: 'Nouvelle formule', // MT
  },
  edit_tier: {
    en: 'Edit tier',
    nl: 'Niveau bewerken',
    es: 'Editar nivel', // MT
    pt: 'Editar nível', // MT
    de: 'Stufe bearbeiten', // MT
    fr: 'Modifier la formule', // MT
  },
  tiers_empty: {
    en: 'No tiers yet. Create your first tier — e.g. Supporter, Member, Patron — and set what each one costs per year.',
    nl: 'Nog geen niveaus. Maak je eerste niveau — bijv. Supporter, Lid, Patroon — en bepaal wat elk per jaar kost.',
    es: 'Aún no hay niveles. Crea tu primer nivel — p. ej. Colaborador, Miembro, Mecenas — y define cuánto cuesta cada uno al año.', // MT
    pt: 'Ainda não há níveis. Crie seu primeiro nível — p. ex. Apoiador, Membro, Patrono — e defina quanto cada um custa por ano.', // MT
    de: 'Noch keine Stufen. Erstelle deine erste Stufe — z. B. Unterstützer, Mitglied, Förderer — und lege fest, was jede pro Jahr kostet.', // MT
    fr: 'Pas encore de formules. Crée ta première formule — p. ex. Soutien, Membre, Mécène — et fixe le prix annuel de chacune.', // MT
  },
  no_price_set: {
    en: 'No price set',
    nl: 'Geen prijs ingesteld',
    es: 'Sin precio', // MT
    pt: 'Sem preço definido', // MT
    de: 'Kein Preis festgelegt', // MT
    fr: 'Aucun prix défini', // MT
  },
  one_product_included: {
    en: '1 product included',
    nl: '1 product inbegrepen',
    es: '1 producto incluido', // MT
    pt: '1 produto incluído', // MT
    de: '1 Produkt enthalten', // MT
    fr: '1 produit inclus', // MT
  },
  n_products_included: {
    en: '{n} products included',
    nl: '{n} producten inbegrepen',
    es: '{n} productos incluidos', // MT
    pt: '{n} produtos incluídos', // MT
    de: '{n} Produkte enthalten', // MT
    fr: '{n} produits inclus', // MT
  },
  tier_name_ph: {
    en: 'e.g. Supporter',
    nl: 'bijv. Supporter',
    es: 'p. ej. Colaborador', // MT
    pt: 'p. ex. Apoiador', // MT
    de: 'z. B. Unterstützer', // MT
    fr: 'p. ex. Soutien', // MT
  },
  yearly_price: {
    en: 'Yearly price ({currency})',
    nl: 'Jaarprijs ({currency})',
    es: 'Precio anual ({currency})', // MT
    pt: 'Preço anual ({currency})', // MT
    de: 'Jahrespreis ({currency})', // MT
    fr: 'Prix annuel ({currency})', // MT
  },
  monthly_price: {
    en: 'Monthly price ({currency})',
    nl: 'Maandprijs ({currency})',
    es: 'Precio mensual ({currency})', // MT
    pt: 'Preço mensal ({currency})', // MT
    de: 'Monatspreis ({currency})', // MT
    fr: 'Prix mensuel ({currency})', // MT
  },
  price_year_ph: {
    en: 'e.g. 120',
    nl: 'bijv. 120',
    es: 'p. ej. 120', // MT
    pt: 'p. ex. 120', // MT
    de: 'z. B. 120', // MT
    fr: 'p. ex. 120', // MT
  },
  currency_hint: {
    en: "The workspace's currencies — manage the list in Settings.",
    nl: 'De valuta van de werkruimte — beheer de lijst in Instellingen.',
    es: 'Las monedas del espacio de trabajo — gestiona la lista en Ajustes.', // MT
    pt: 'As moedas do workspace — gerencie a lista em Configurações.', // MT
    de: 'Die Währungen des Workspace — verwalte die Liste in den Einstellungen.', // MT
    fr: "Les devises de l'espace de travail — gère la liste dans les Paramètres.", // MT
  },
  characteristics: {
    en: 'Characteristics',
    nl: 'Kenmerken',
    es: 'Características', // MT
    pt: 'Características', // MT
    de: 'Merkmale', // MT
    fr: 'Caractéristiques', // MT
  },
  tier_characteristics_ph: {
    en: 'One per line, e.g.\nMonthly community calls\nMember directory',
    nl: 'Eén per regel, bijv.\nMaandelijkse community-calls\nLedenoverzicht',
    es: 'Una por línea, p. ej.\nLlamadas comunitarias mensuales\nDirectorio de miembros', // MT
    pt: 'Uma por linha, p. ex.\nChamadas mensais da comunidade\nDiretório de membros', // MT
    de: 'Eine pro Zeile, z. B.\nMonatliche Community-Calls\nMitgliederverzeichnis', // MT
    fr: 'Une par ligne, p. ex.\nAppels communautaires mensuels\nAnnuaire des membres', // MT
  },
  characteristics_hint: {
    en: 'One per line — shown as bullet points on the join page.',
    nl: 'Eén per regel — als opsomming op de aanmeldpagina.',
    es: 'Una por línea — se muestran como viñetas en la página de inscripción.', // MT
    pt: 'Uma por linha — exibidas como marcadores na página de adesão.', // MT
    de: 'Eine pro Zeile — als Aufzählung auf der Beitrittsseite.', // MT
    fr: "Une par ligne — affichées en liste à puces sur la page d'adhésion.", // MT
  },
  included_products: {
    en: 'Included products',
    nl: 'Inbegrepen producten',
    es: 'Productos incluidos', // MT
    pt: 'Produtos incluídos', // MT
    de: 'Enthaltene Produkte', // MT
    fr: 'Produits inclus', // MT
  },
  no_products_create_first: {
    en: 'No products yet — create them under Products.',
    nl: 'Nog geen producten — maak ze aan onder Producten.',
    es: 'Aún no hay productos — créalos en Productos.', // MT
    pt: 'Ainda não há produtos — crie-os em Produtos.', // MT
    de: 'Noch keine Produkte — lege sie unter Produkte an.', // MT
    fr: 'Pas encore de produits — crée-les sous Produits.', // MT
  },
  state_off: {
    en: 'Off',
    nl: 'Uit',
    es: 'No', // MT
    pt: 'Não', // MT
    de: 'Aus', // MT
    fr: 'Non', // MT
  },
  state_included: {
    en: 'Included',
    nl: 'Inbegrepen',
    es: 'Incluido', // MT
    pt: 'Incluído', // MT
    de: 'Enthalten', // MT
    fr: 'Inclus', // MT
  },
  state_optional: {
    en: 'Optional',
    nl: 'Optioneel',
    es: 'Opcional', // MT
    pt: 'Opcional', // MT
    de: 'Optional', // MT
    fr: 'En option', // MT
  },
  tier_saved_products_failed: {
    en: 'Tier saved, but products failed: {error}',
    nl: 'Niveau opgeslagen, maar de producten niet: {error}',
    es: 'Nivel guardado, pero los productos fallaron: {error}', // MT
    pt: 'Nível salvo, mas os produtos falharam: {error}', // MT
    de: 'Stufe gespeichert, aber Produkte fehlgeschlagen: {error}', // MT
    fr: 'Formule enregistrée, mais les produits ont échoué : {error}', // MT
  },

  // ── products ──────────────────────────────────────────────────────────
  products_blurb: {
    en: 'The things a membership is made of — a Circle space, a Thread, a call series. Bundle them into tiers under Tiers.',
    nl: 'De bouwstenen van een lidmaatschap — een Circle-space, een Thread, een reeks calls. Bundel ze in niveaus onder Niveaus.',
    es: 'Aquello de lo que se compone una membresía — un espacio de Circle, un Thread, una serie de llamadas. Agrúpalos en niveles en Niveles.', // MT
    pt: 'As coisas que compõem uma associação — um espaço do Circle, um Thread, uma série de chamadas. Agrupe-os em níveis em Níveis.', // MT
    de: 'Die Bausteine einer Mitgliedschaft — ein Circle-Space, ein Thread, eine Call-Reihe. Bündle sie unter Stufen.', // MT
    fr: "Ce qui compose une adhésion — un espace Circle, un Thread, une série d'appels. Regroupe-les en formules sous Formules.", // MT
  },
  access_status: {
    en: 'Access status',
    nl: 'Toegangsstatus',
    es: 'Estado de acceso', // MT
    pt: 'Status de acesso', // MT
    de: 'Zugriffsstatus', // MT
    fr: 'État des accès', // MT
  },
  sync_overview: {
    en: 'Sync overview',
    nl: 'Sync-overzicht',
    es: 'Vista de sincronización', // MT
    pt: 'Visão de sincronização', // MT
    de: 'Sync-Übersicht', // MT
    fr: 'Vue de synchronisation', // MT
  },
  new_product: {
    en: 'New product',
    nl: 'Nieuw product',
    es: 'Nuevo producto', // MT
    pt: 'Novo produto', // MT
    de: 'Neues Produkt', // MT
    fr: 'Nouveau produit', // MT
  },
  edit_product: {
    en: 'Edit product',
    nl: 'Product bewerken',
    es: 'Editar producto', // MT
    pt: 'Editar produto', // MT
    de: 'Produkt bearbeiten', // MT
    fr: 'Modifier le produit', // MT
  },
  products_empty: {
    en: 'No products yet. Create the building blocks of your membership here, then include them in tiers.',
    nl: 'Nog geen producten. Maak hier de bouwstenen van je lidmaatschap en neem ze daarna op in niveaus.',
    es: 'Aún no hay productos. Crea aquí los bloques de tu membresía y luego inclúyelos en niveles.', // MT
    pt: 'Ainda não há produtos. Crie aqui os blocos da sua associação e depois inclua-os em níveis.', // MT
    de: 'Noch keine Produkte. Erstelle hier die Bausteine deiner Mitgliedschaft und nimm sie dann in Stufen auf.', // MT
    fr: 'Pas encore de produits. Crée ici les briques de ton adhésion, puis inclus-les dans des formules.', // MT
  },
  buyable: {
    en: 'Buyable',
    nl: 'Los te koop',
    es: 'Comprable', // MT
    pt: 'Comprável', // MT
    de: 'Einzeln kaufbar', // MT
    fr: 'Achetable', // MT
  },
  included_in_tier: {
    en: 'Included in tier',
    nl: 'Inbegrepen in niveau',
    es: 'Incluido en el nivel', // MT
    pt: 'Incluído no nível', // MT
    de: 'In Stufe enthalten', // MT
    fr: 'Inclus dans la formule', // MT
  },
  unlocks_prefix: {
    en: 'Unlocks: {list}',
    nl: 'Geeft toegang tot: {list}',
    es: 'Desbloquea: {list}', // MT
    pt: 'Desbloqueia: {list}', // MT
    de: 'Schaltet frei: {list}', // MT
    fr: 'Débloque : {list}', // MT
  },
  product_name_ph: {
    en: 'e.g. Community space',
    nl: 'bijv. Communityruimte',
    es: 'p. ej. Espacio comunitario', // MT
    pt: 'p. ex. Espaço da comunidade', // MT
    de: 'z. B. Community-Bereich', // MT
    fr: 'p. ex. Espace communautaire', // MT
  },
  price_with_currency: {
    en: 'Price ({currency})',
    nl: 'Prijs ({currency})',
    es: 'Precio ({currency})', // MT
    pt: 'Preço ({currency})', // MT
    de: 'Preis ({currency})', // MT
    fr: 'Prix ({currency})', // MT
  },
  price_included_ph: {
    en: 'Leave empty when included in a tier',
    nl: 'Laat leeg als het in een niveau zit',
    es: 'Déjalo vacío si va incluido en un nivel', // MT
    pt: 'Deixe vazio quando incluído em um nível', // MT
    de: 'Leer lassen, wenn in einer Stufe enthalten', // MT
    fr: 'Laisse vide si inclus dans une formule', // MT
  },
  purchasable_label: {
    en: 'Can be bought on its own',
    nl: 'Los te koop',
    es: 'Se puede comprar por separado', // MT
    pt: 'Pode ser comprado separadamente', // MT
    de: 'Einzeln kaufbar', // MT
    fr: 'Peut être acheté seul', // MT
  },
  purchasable_hint: {
    en: "Shows a Buy button on your public membership page (needs a price). Buyers get the product's links and access without needing a membership.",
    nl: 'Toont een koopknop op je openbare lidmaatschapspagina (prijs vereist). Kopers krijgen de links en toegang van het product zonder lidmaatschap.',
    es: 'Muestra un botón de compra en tu página pública de membresía (necesita precio). Los compradores reciben los enlaces y el acceso del producto sin necesitar membresía.', // MT
    pt: 'Mostra um botão Comprar na sua página pública de associação (precisa de preço). Compradores recebem os links e o acesso do produto sem precisar de associação.', // MT
    de: 'Zeigt einen Kaufen-Button auf deiner öffentlichen Mitgliedschaftsseite (Preis nötig). Käufer erhalten Links und Zugriff des Produkts ohne Mitgliedschaft.', // MT
    fr: "Affiche un bouton Acheter sur ta page publique d'adhésion (prix requis). Les acheteurs reçoivent les liens et accès du produit sans adhésion.", // MT
  },
  product_characteristics_ph: {
    en: 'One per line, e.g.\nWeekly office hours\nRecordings archive',
    nl: 'Eén per regel, bijv.\nWekelijks spreekuur\nArchief met opnames',
    es: 'Una por línea, p. ej.\nHorario de consultas semanal\nArchivo de grabaciones', // MT
    pt: 'Uma por linha, p. ex.\nPlantão semanal\nArquivo de gravações', // MT
    de: 'Eine pro Zeile, z. B.\nWöchentliche Sprechstunde\nAufzeichnungsarchiv', // MT
    fr: 'Une par ligne, p. ex.\nPermanence hebdomadaire\nArchive des enregistrements', // MT
  },
  links: {
    en: 'Links',
    nl: 'Links',
    es: 'Enlaces', // MT
    pt: 'Links', // MT
    de: 'Links', // MT
    fr: 'Liens', // MT
  },
  links_blurb: {
    en: 'What this product points at — a Thread, a Meet, a Circle space or a plain URL.',
    nl: 'Waar dit product naar verwijst — een Thread, een Meet, een Circle-space of gewoon een URL.',
    es: 'A qué apunta este producto — un Thread, un Meet, un espacio de Circle o una URL.', // MT
    pt: 'Para onde este produto aponta — um Thread, um Meet, um espaço do Circle ou uma URL.', // MT
    de: 'Worauf dieses Produkt zeigt — ein Thread, ein Meet, ein Circle-Space oder eine URL.', // MT
    fr: 'Ce vers quoi ce produit pointe — un Thread, un Meet, un espace Circle ou une simple URL.', // MT
  },
  link_kind_thread: {
    en: 'Thread',
    nl: 'Thread',
    es: 'Thread', // MT
    pt: 'Thread', // MT
    de: 'Thread', // MT
    fr: 'Thread', // MT
  },
  link_kind_meet: {
    en: 'Meet',
    nl: 'Meet',
    es: 'Meet', // MT
    pt: 'Meet', // MT
    de: 'Meet', // MT
    fr: 'Meet', // MT
  },
  link_kind_circle_space: {
    en: 'Circle space',
    nl: 'Circle-space',
    es: 'Espacio de Circle', // MT
    pt: 'Espaço do Circle', // MT
    de: 'Circle-Space', // MT
    fr: 'Espace Circle', // MT
  },
  link_kind_url: {
    en: 'URL',
    nl: 'URL',
    es: 'URL', // MT
    pt: 'URL', // MT
    de: 'URL', // MT
    fr: 'URL', // MT
  },
  thread_slug_ph: {
    en: 'Thread slug',
    nl: 'Thread-slug',
    es: 'Slug del Thread', // MT
    pt: 'Slug do Thread', // MT
    de: 'Thread-Slug', // MT
    fr: 'Slug du Thread', // MT
  },
  meet_ref_ph: {
    en: 'Meet ref',
    nl: 'Meet-referentie',
    es: 'Referencia de Meet', // MT
    pt: 'Referência do Meet', // MT
    de: 'Meet-Referenz', // MT
    fr: 'Référence Meet', // MT
  },
  space_id_ph: {
    en: 'Space ID',
    nl: 'Space-ID',
    es: 'ID del espacio', // MT
    pt: 'ID do espaço', // MT
    de: 'Space-ID', // MT
    fr: "ID de l'espace", // MT
  },
  view_join_page: {
    en: 'View join page',
    nl: 'Bekijk aanmeldpagina',
    es: 'Ver página de alta', // MT
    pt: 'Ver página de adesão', // MT
    de: 'Beitrittsseite ansehen', // MT
    fr: "Voir la page d'adhésion", // MT
  },
  pick_thread_ph: {
    en: 'Pick a thread…',
    nl: 'Kies een thread…',
    es: 'Elige un thread…', // MT
    pt: 'Escolha um thread…', // MT
    de: 'Wähle einen Thread…', // MT
    fr: 'Choisis un thread…', // MT
  },
  label_optional_ph: {
    en: 'Label (optional)',
    nl: 'Label (optioneel)',
    es: 'Etiqueta (opcional)', // MT
    pt: 'Rótulo (opcional)', // MT
    de: 'Label (optional)', // MT
    fr: 'Libellé (facultatif)', // MT
  },
  remove_link: {
    en: 'Remove link',
    nl: 'Link verwijderen',
    es: 'Quitar enlace', // MT
    pt: 'Remover link', // MT
    de: 'Link entfernen', // MT
    fr: 'Retirer le lien', // MT
  },
  add_link: {
    en: 'Add link',
    nl: 'Link toevoegen',
    es: 'Añadir enlace', // MT
    pt: 'Adicionar link', // MT
    de: 'Link hinzufügen', // MT
    fr: 'Ajouter un lien', // MT
  },
  link_row_missing_ref: {
    en: 'A link row is missing its middle field — the slug, ID or URL it points at. Fill it in or remove the row (trash icon).',
    nl: 'Bij een linkregel ontbreekt het middelste veld — de slug, ID of URL waar hij naar verwijst. Vul het in of verwijder de regel (prullenbak-icoon).',
    es: 'A una fila de enlace le falta el campo del medio — el slug, ID o URL al que apunta. Rellénalo o elimina la fila (icono de papelera).', // MT
    pt: 'Uma linha de link está sem o campo do meio — o slug, ID ou URL para onde aponta. Preencha-o ou remova a linha (ícone de lixeira).', // MT
    de: 'Einer Link-Zeile fehlt das mittlere Feld — der Slug, die ID oder URL, auf die sie zeigt. Fülle es aus oder entferne die Zeile (Papierkorb-Symbol).', // MT
    fr: "Il manque le champ du milieu à une ligne de lien — le slug, l'ID ou l'URL visé. Remplis-le ou supprime la ligne (icône corbeille).", // MT
  },
  access_label: {
    en: 'Access',
    nl: 'Toegang',
    es: 'Acceso', // MT
    pt: 'Acesso', // MT
    de: 'Zugriff', // MT
    fr: 'Accès', // MT
  },
  product_access_blurb: {
    en: 'What this product actually unlocks — synced automatically as members join and lapse. A tier that includes this product grants all of it.',
    nl: 'Wat dit product daadwerkelijk ontgrendelt — automatisch gesynchroniseerd als leden komen en gaan. Een niveau met dit product geeft dit allemaal.',
    es: 'Lo que este producto realmente desbloquea — sincronizado automáticamente cuando los miembros se unen o vencen. Un nivel que incluye este producto lo concede todo.', // MT
    pt: 'O que este produto realmente desbloqueia — sincronizado automaticamente conforme membros entram e saem. Um nível que inclui este produto concede tudo isso.', // MT
    de: 'Was dieses Produkt tatsächlich freischaltet — automatisch synchronisiert, wenn Mitglieder kommen und gehen. Eine Stufe mit diesem Produkt gewährt alles davon.', // MT
    fr: "Ce que ce produit débloque réellement — synchronisé automatiquement quand les membres arrivent ou expirent. Une formule qui inclut ce produit accorde tout cela.", // MT
  },
  save_product_first: {
    en: 'Save the product first, then add access.',
    nl: 'Sla het product eerst op en voeg daarna toegang toe.',
    es: 'Guarda primero el producto y luego añade el acceso.', // MT
    pt: 'Salve o produto primeiro, depois adicione o acesso.', // MT
    de: 'Speichere zuerst das Produkt, füge dann Zugriff hinzu.', // MT
    fr: "Enregistre d'abord le produit, puis ajoute l'accès.", // MT
  },
  remove_access: {
    en: 'Remove access',
    nl: 'Toegang verwijderen',
    es: 'Quitar acceso', // MT
    pt: 'Remover acesso', // MT
    de: 'Zugriff entfernen', // MT
    fr: "Retirer l'accès", // MT
  },
  grant_kind_circle: {
    en: 'Circle space',
    nl: 'Circle-space',
    es: 'Espacio de Circle', // MT
    pt: 'Espaço do Circle', // MT
    de: 'Circle-Space', // MT
    fr: 'Espace Circle', // MT
  },
  grant_kind_thread: {
    en: 'Thread',
    nl: 'Thread',
    es: 'Thread', // MT
    pt: 'Thread', // MT
    de: 'Thread', // MT
    fr: 'Thread', // MT
  },
  grant_kind_fibre_seat: {
    en: 'Fibre seat',
    nl: 'Fibre-plek',
    es: 'Plaza de Fibre', // MT
    pt: 'Assento Fibre', // MT
    de: 'Fibre-Platz', // MT
    fr: 'Place Fibre', // MT
  },
  grant_kind_google_user: {
    en: 'Google account',
    nl: 'Google-account',
    es: 'Cuenta de Google', // MT
    pt: 'Conta Google', // MT
    de: 'Google-Konto', // MT
    fr: 'Compte Google', // MT
  },
  organiser_seat: {
    en: 'Organiser seat',
    nl: 'Organisator-plek',
    es: 'Plaza de organizador', // MT
    pt: 'Assento de organizador', // MT
    de: 'Organisator-Platz', // MT
    fr: "Place d'organisateur", // MT
  },
  admin_seat: {
    en: 'Admin seat',
    nl: 'Beheerder-plek',
    es: 'Plaza de administrador', // MT
    pt: 'Assento de administrador', // MT
    de: 'Admin-Platz', // MT
    fr: "Place d'admin", // MT
  },
  add_access: {
    en: 'Add access',
    nl: 'Toegang toevoegen',
    es: 'Añadir acceso', // MT
    pt: 'Adicionar acesso', // MT
    de: 'Zugriff hinzufügen', // MT
    fr: 'Ajouter un accès', // MT
  },
  fibre_seat_billing_warning: {
    en: 'Fibre seats are billed on your workspace subscription — each member this activates adds a seat.',
    nl: 'Fibre-plekken worden gefactureerd op je werkruimte-abonnement — elk lid dat dit activeert, voegt een plek toe.',
    es: 'Las plazas de Fibre se facturan en la suscripción de tu espacio de trabajo — cada miembro que esto activa añade una plaza.', // MT
    pt: 'Assentos Fibre são cobrados na assinatura do seu workspace — cada membro que isto ativa adiciona um assento.', // MT
    de: 'Fibre-Plätze werden über dein Workspace-Abo abgerechnet — jedes Mitglied, das dies aktiviert, fügt einen Platz hinzu.', // MT
    fr: "Les places Fibre sont facturées sur l'abonnement de ton espace de travail — chaque membre activé ajoute une place.", // MT
  },
  circle_space_target: {
    en: 'Circle space {ref}',
    nl: 'Circle-space {ref}',
    es: 'Espacio de Circle {ref}', // MT
    pt: 'Espaço do Circle {ref}', // MT
    de: 'Circle-Space {ref}', // MT
    fr: 'Espace Circle {ref}', // MT
  },
  fibre_seat_target: {
    en: 'Fibre seat ({role})',
    nl: 'Fibre-plek ({role})',
    es: 'Plaza de Fibre ({role})', // MT
    pt: 'Assento Fibre ({role})', // MT
    de: 'Fibre-Platz ({role})', // MT
    fr: 'Place Fibre ({role})', // MT
  },
  google_account_target: {
    en: 'Google account (active while member)',
    nl: 'Google-account (actief zolang lid)',
    es: 'Cuenta de Google (activa mientras sea miembro)', // MT
    pt: 'Conta Google (ativa enquanto for membro)', // MT
    de: 'Google-Konto (aktiv solange Mitglied)', // MT
    fr: "Compte Google (actif tant que membre)", // MT
  },
  thread_target: {
    en: 'Thread {ref}',
    nl: 'Thread {ref}',
    es: 'Thread {ref}', // MT
    pt: 'Thread {ref}', // MT
    de: 'Thread {ref}', // MT
    fr: 'Thread {ref}', // MT
  },
  space_id_required: {
    en: 'Space ID is required.',
    nl: 'Een space-ID is verplicht.',
    es: 'El ID del espacio es obligatorio.', // MT
    pt: 'O ID do espaço é obrigatório.', // MT
    de: 'Eine Space-ID ist erforderlich.', // MT
    fr: "L'ID de l'espace est obligatoire.", // MT
  },
  thread_slug_required: {
    en: 'Thread slug is required.',
    nl: 'Een thread-slug is verplicht.',
    es: 'El slug del thread es obligatorio.', // MT
    pt: 'O slug do thread é obrigatório.', // MT
    de: 'Ein Thread-Slug ist erforderlich.', // MT
    fr: 'Le slug du thread est obligatoire.', // MT
  },
  could_not_add_access: {
    en: 'could not add access',
    nl: 'kon de toegang niet toevoegen',
    es: 'no se pudo añadir el acceso', // MT
    pt: 'não foi possível adicionar o acesso', // MT
    de: 'Zugriff konnte nicht hinzugefügt werden', // MT
    fr: "impossible d'ajouter l'accès", // MT
  },

  // ── access page ───────────────────────────────────────────────────────
  access_blurb: {
    en: 'The overview of everything membership unlocks — granted when a member joins, revoked when they lapse. Access is configured on PRODUCTS (each product carries what it unlocks); tiers grant it by including the product.',
    nl: 'Het overzicht van alles wat het lidmaatschap ontgrendelt — toegekend als een lid zich aanmeldt, ingetrokken als het verloopt. Toegang stel je in op PRODUCTEN (elk product draagt wat het ontgrendelt); niveaus geven het door het product op te nemen.',
    es: 'La vista de todo lo que la membresía desbloquea — concedido al unirse un miembro, revocado al vencer. El acceso se configura en los PRODUCTOS (cada producto lleva lo que desbloquea); los niveles lo conceden al incluir el producto.', // MT
    pt: 'A visão de tudo que a associação desbloqueia — concedido quando um membro entra, revogado quando expira. O acesso é configurado nos PRODUTOS (cada produto carrega o que desbloqueia); os níveis o concedem ao incluir o produto.', // MT
    de: 'Die Übersicht über alles, was die Mitgliedschaft freischaltet — gewährt beim Beitritt, entzogen beim Ablauf. Zugriff wird auf PRODUKTEN konfiguriert (jedes Produkt trägt, was es freischaltet); Stufen gewähren ihn, indem sie das Produkt enthalten.', // MT
    fr: "La vue de tout ce que l'adhésion débloque — accordé quand un membre arrive, révoqué quand il expire. L'accès se configure sur les PRODUITS (chaque produit porte ce qu'il débloque) ; les formules l'accordent en incluant le produit.", // MT
  },
  circle_token_warning: {
    en: 'Add your Circle API token in Settings for this grant to sync.',
    nl: 'Voeg je Circle-API-token toe in Instellingen om deze toekenning te synchroniseren.',
    es: 'Añade tu token de la API de Circle en Ajustes para que esta concesión se sincronice.', // MT
    pt: 'Adicione seu token da API do Circle em Configurações para esta concessão sincronizar.', // MT
    de: 'Füge deinen Circle-API-Token in den Einstellungen hinzu, damit diese Berechtigung synchronisiert.', // MT
    fr: "Ajoute ton token d'API Circle dans les Paramètres pour que ce droit se synchronise.", // MT
  },
  access_empty: {
    en: 'Nothing granted yet — open a product and add what it unlocks under Access.',
    nl: 'Nog niets toegekend — open een product en voeg onder Toegang toe wat het ontgrendelt.',
    es: 'Aún no hay nada concedido — abre un producto y añade lo que desbloquea en Acceso.', // MT
    pt: 'Nada concedido ainda — abra um produto e adicione o que ele desbloqueia em Acesso.', // MT
    de: 'Noch nichts gewährt — öffne ein Produkt und füge unter Zugriff hinzu, was es freischaltet.', // MT
    fr: "Rien d'accordé pour l'instant — ouvre un produit et ajoute ce qu'il débloque sous Accès.", // MT
  },
  tier_level_legacy: {
    en: '{name} — tier-level (legacy: move onto a product)',
    nl: '{name} — op niveauniveau (verouderd: verplaats naar een product)',
    es: '{name} — a nivel de nivel (heredado: muévelo a un producto)', // MT
    pt: '{name} — no nível do nível (legado: mova para um produto)', // MT
    de: '{name} — auf Stufenebene (Altbestand: auf ein Produkt verschieben)', // MT
    fr: '{name} — au niveau de la formule (hérité : à déplacer sur un produit)', // MT
  },
  group_unlocks: {
    en: '{title} unlocks:',
    nl: '{title} ontgrendelt:',
    es: '{title} desbloquea:', // MT
    pt: '{title} desbloqueia:', // MT
    de: '{title} schaltet frei:', // MT
    fr: '{title} débloque :', // MT
  },
  unknown_tier: {
    en: 'Unknown tier',
    nl: 'Onbekend niveau',
    es: 'Nivel desconocido', // MT
    pt: 'Nível desconhecido', // MT
    de: 'Unbekannte Stufe', // MT
    fr: 'Formule inconnue', // MT
  },

  // ── grant dialog ──────────────────────────────────────────────────────
  access_grant: {
    en: 'Access grant',
    nl: 'Toegangsrecht',
    es: 'Concesión de acceso', // MT
    pt: 'Concessão de acesso', // MT
    de: 'Zugriffsberechtigung', // MT
    fr: "Droit d'accès", // MT
  },
  new_grant: {
    en: 'New grant',
    nl: 'Nieuw toegangsrecht',
    es: 'Nueva concesión', // MT
    pt: 'Nova concessão', // MT
    de: 'Neue Berechtigung', // MT
    fr: 'Nouveau droit', // MT
  },
  kind: {
    en: 'Kind',
    nl: 'Soort',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Art', // MT
    fr: 'Type', // MT
  },
  workspace_role: {
    en: 'Workspace role',
    nl: 'Werkruimterol',
    es: 'Rol en el espacio de trabajo', // MT
    pt: 'Papel no workspace', // MT
    de: 'Workspace-Rolle', // MT
    fr: "Rôle dans l'espace de travail", // MT
  },
  organiser: {
    en: 'Organiser',
    nl: 'Organisator',
    es: 'Organizador', // MT
    pt: 'Organizador', // MT
    de: 'Organisator', // MT
    fr: 'Organisateur', // MT
  },
  admin: {
    en: 'Admin',
    nl: 'Beheerder',
    es: 'Administrador', // MT
    pt: 'Administrador', // MT
    de: 'Admin', // MT
    fr: 'Admin', // MT
  },
  space_id: {
    en: 'Space ID',
    nl: 'Space-ID',
    es: 'ID del espacio', // MT
    pt: 'ID do espaço', // MT
    de: 'Space-ID', // MT
    fr: "ID de l'espace", // MT
  },
  thread_slug: {
    en: 'Thread slug',
    nl: 'Thread-slug',
    es: 'Slug del thread', // MT
    pt: 'Slug do thread', // MT
    de: 'Thread-Slug', // MT
    fr: 'Slug du thread', // MT
  },
  space_id_eg: {
    en: 'e.g. 123456',
    nl: 'bijv. 123456',
    es: 'p. ej. 123456', // MT
    pt: 'p. ex. 123456', // MT
    de: 'z. B. 123456', // MT
    fr: 'p. ex. 123456', // MT
  },
  thread_slug_eg: {
    en: 'e.g. post-athens-journey',
    nl: 'bijv. post-athens-journey',
    es: 'p. ej. post-athens-journey', // MT
    pt: 'p. ex. post-athens-journey', // MT
    de: 'z. B. post-athens-journey', // MT
    fr: 'p. ex. post-athens-journey', // MT
  },
  billed_seat_warn_before: {
    en: 'Each member this grant activates becomes a',
    nl: 'Elk lid dat dit recht activeert, wordt een',
    es: 'Cada miembro que esta concesión activa se convierte en una', // MT
    pt: 'Cada membro que esta concessão ativa se torna um', // MT
    de: 'Jedes Mitglied, das diese Berechtigung aktiviert, wird ein', // MT
    fr: 'Chaque membre activé par ce droit devient une', // MT
  },
  billed_seat_strong: {
    en: 'billed seat',
    nl: 'gefactureerde plek',
    es: 'plaza facturada', // MT
    pt: 'assento cobrado', // MT
    de: 'abgerechneter Platz', // MT
    fr: 'place facturée', // MT
  },
  billed_seat_warn_after: {
    en: "on your workspace's Fibre subscription (prorated when added; a lapsed member's seat stops billing from the next period).",
    nl: 'op het Fibre-abonnement van je werkruimte (naar rato bij toevoegen; de plek van een verlopen lid stopt met factureren vanaf de volgende periode).',
    es: 'en la suscripción Fibre de tu espacio de trabajo (prorrateada al añadirse; la plaza de un miembro vencido deja de facturarse desde el siguiente período).', // MT
    pt: 'na assinatura Fibre do seu workspace (proporcional ao adicionar; o assento de um membro expirado para de ser cobrado no próximo período).', // MT
    de: 'im Fibre-Abo deines Workspace (anteilig beim Hinzufügen; der Platz eines abgelaufenen Mitglieds wird ab der nächsten Periode nicht mehr berechnet).', // MT
    fr: "sur l'abonnement Fibre de ton espace de travail (au prorata à l'ajout ; la place d'un membre expiré cesse d'être facturée à la période suivante).", // MT
  },
  grants_not_editable: {
    en: "Grants can't be edited — delete this one and create a new grant to change it.",
    nl: 'Toegangsrechten zijn niet te bewerken — verwijder dit recht en maak een nieuw aan om het te wijzigen.',
    es: 'Las concesiones no se pueden editar — elimina esta y crea una nueva para cambiarla.', // MT
    pt: 'Concessões não podem ser editadas — exclua esta e crie uma nova para alterá-la.', // MT
    de: 'Berechtigungen lassen sich nicht bearbeiten — lösche diese und lege eine neue an, um sie zu ändern.', // MT
    fr: "Les droits ne se modifient pas — supprime celui-ci et crées-en un nouveau pour le changer.", // MT
  },

  // ── settings hub ──────────────────────────────────────────────────────
  settings_blurb: {
    en: 'You, the workspace, and Membership. The same four sections in every Fibre app.',
    nl: 'Jij, de werkruimte en Lidmaatschap. Dezelfde vier secties in elke Fibre-app.',
    es: 'Tú, el espacio de trabajo y Membresía. Las mismas cuatro secciones en cada app de Fibre.', // MT
    pt: 'Você, o workspace e Associação. As mesmas quatro seções em todo app Fibre.', // MT
    de: 'Du, der Workspace und Mitgliedschaft. Dieselben vier Bereiche in jeder Fibre-App.', // MT
    fr: "Toi, l'espace de travail et Adhésion. Les quatre mêmes sections dans chaque app Fibre.", // MT
  },
  st_join_title: {
    en: 'Join page',
    nl: 'Aanmeldpagina',
    es: 'Página de inscripción', // MT
    pt: 'Página de adesão', // MT
    de: 'Beitrittsseite', // MT
    fr: "Page d'adhésion", // MT
  },
  st_join_desc: {
    en: 'The public page where people become members — headline, intro, address.',
    nl: 'De openbare pagina waar mensen lid worden — kop, intro, adres.',
    es: 'La página pública donde la gente se hace miembro — titular, intro, dirección.', // MT
    pt: 'A página pública onde as pessoas se tornam membros — título, introdução, endereço.', // MT
    de: 'Die öffentliche Seite, auf der Menschen Mitglied werden — Überschrift, Intro, Adresse.', // MT
    fr: "La page publique où l'on devient membre — titre, intro, adresse.", // MT
  },
  st_integrations_title: {
    en: 'Integrations',
    nl: 'Integraties',
    es: 'Integraciones', // MT
    pt: 'Integrações', // MT
    de: 'Integrationen', // MT
    fr: 'Intégrations', // MT
  },
  st_integrations_desc: {
    en: 'The tools membership unlocks for members — Circle.so today, more to come.',
    nl: 'De tools die het lidmaatschap voor leden ontgrendelt — vandaag Circle.so, meer volgt.',
    es: 'Las herramientas que la membresía desbloquea para los miembros — hoy Circle.so, más por venir.', // MT
    pt: 'As ferramentas que a associação desbloqueia para os membros — Circle.so hoje, mais por vir.', // MT
    de: 'Die Tools, die die Mitgliedschaft für Mitglieder freischaltet — heute Circle.so, mehr folgt.', // MT
    fr: "Les outils que l'adhésion débloque pour les membres — Circle.so aujourd'hui, d'autres à venir.", // MT
  },
  st_pricing_title: {
    en: 'Pricing rules',
    nl: 'Prijsregels',
    es: 'Reglas de precios', // MT
    pt: 'Regras de preço', // MT
    de: 'Preisregeln', // MT
    fr: 'Règles de prix', // MT
  },
  st_pricing_desc: {
    en: 'Price logic — purchasing-power pricing by country, first matching rule wins.',
    nl: 'Prijslogica — koopkrachtprijzen per land, de eerste regel die past wint.',
    es: 'Lógica de precios — precios según poder adquisitivo por país, gana la primera regla que coincide.', // MT
    pt: 'Lógica de preços — preços por poder de compra por país, a primeira regra que combinar vence.', // MT
    de: 'Preislogik — Kaufkraftpreise nach Land, die erste passende Regel gewinnt.', // MT
    fr: "Logique de prix — tarifs selon le pouvoir d'achat par pays, la première règle qui correspond gagne.", // MT
  },
  st_embeds_title: {
    en: 'Website embeds',
    nl: 'Website-embeds',
    es: 'Embeds para tu web', // MT
    pt: 'Embeds para seu site', // MT
    de: 'Website-Embeds', // MT
    fr: 'Intégrations web', // MT
  },
  st_embeds_desc: {
    en: 'Copy-paste snippets to show tiers and take joins on any website.',
    nl: 'Copy-paste-snippets om niveaus te tonen en aanmeldingen te ontvangen op elke website.',
    es: 'Fragmentos para copiar y pegar que muestran niveles y aceptan altas en cualquier web.', // MT
    pt: 'Trechos de copiar e colar para mostrar níveis e receber adesões em qualquer site.', // MT
    de: 'Copy-Paste-Snippets, um Stufen zu zeigen und Beitritte auf jeder Website anzunehmen.', // MT
    fr: "Des extraits à copier-coller pour afficher les formules et recevoir des adhésions sur n'importe quel site.", // MT
  },

  // ── join page settings ────────────────────────────────────────────────
  join_page_desc: {
    en: 'The public page where people become members.',
    nl: 'De openbare pagina waar mensen lid worden.',
    es: 'La página pública donde la gente se hace miembro.', // MT
    pt: 'A página pública onde as pessoas se tornam membros.', // MT
    de: 'Die öffentliche Seite, auf der Menschen Mitglied werden.', // MT
    fr: "La page publique où l'on devient membre.", // MT
  },
  join_page_lives_at_before: {
    en: 'The public page where people become members. It lives at',
    nl: 'De openbare pagina waar mensen lid worden. Hij staat op',
    es: 'La página pública donde la gente se hace miembro. Vive en', // MT
    pt: 'A página pública onde as pessoas se tornam membros. Ela fica em', // MT
    de: 'Die öffentliche Seite, auf der Menschen Mitglied werden. Sie liegt unter', // MT
    fr: "La page publique où l'on devient membre. Elle se trouve à", // MT
  },
  headline: {
    en: 'Headline',
    nl: 'Kop',
    es: 'Titular', // MT
    pt: 'Título', // MT
    de: 'Überschrift', // MT
    fr: 'Titre', // MT
  },
  headline_ph: {
    en: 'Join our community',
    nl: 'Word lid van onze community',
    es: 'Únete a nuestra comunidad', // MT
    pt: 'Junte-se à nossa comunidade', // MT
    de: 'Werde Teil unserer Community', // MT
    fr: 'Rejoins notre communauté', // MT
  },
  intro: {
    en: 'Intro',
    nl: 'Intro',
    es: 'Introducción', // MT
    pt: 'Introdução', // MT
    de: 'Intro', // MT
    fr: 'Intro', // MT
  },
  intro_ph: {
    en: 'A few sentences about what membership means here.',
    nl: 'Een paar zinnen over wat het lidmaatschap hier betekent.',
    es: 'Unas frases sobre lo que significa la membresía aquí.', // MT
    pt: 'Algumas frases sobre o que a associação significa aqui.', // MT
    de: 'Ein paar Sätze dazu, was die Mitgliedschaft hier bedeutet.', // MT
    fr: "Quelques phrases sur ce que l'adhésion signifie ici.", // MT
  },
  public_page_language: {
    en: 'Public page language',
    nl: 'Taal van de openbare pagina',
    es: 'Idioma de la página pública', // MT
    pt: 'Idioma da página pública', // MT
    de: 'Sprache der öffentlichen Seite', // MT
    fr: 'Langue de la page publique', // MT
  },
  public_lang_hint: {
    en: 'The language of the join page, embeds and member emails. Your own headline and intro are shown as written.',
    nl: 'De taal van de aanmeldpagina, embeds en ledenmails. Je eigen kop en intro worden getoond zoals je ze schreef.',
    es: 'El idioma de la página de inscripción, los embeds y los correos a miembros. Tu titular e intro se muestran tal como los escribiste.', // MT
    pt: 'O idioma da página de adesão, dos embeds e dos e-mails a membros. Seu título e introdução aparecem como você os escreveu.', // MT
    de: 'Die Sprache der Beitrittsseite, Embeds und Mitglieder-E-Mails. Deine eigene Überschrift und Intro erscheinen wie geschrieben.', // MT
    fr: "La langue de la page d'adhésion, des intégrations et des e-mails aux membres. Ton titre et ton intro s'affichent tels quels.", // MT
  },

  // ── integrations ──────────────────────────────────────────────────────
  integrations_desc: {
    en: 'The tools membership unlocks for members. Access grants (per tier) decide who gets in; integrations hold the connection.',
    nl: 'De tools die het lidmaatschap voor leden ontgrendelt. Toegangsrechten (per niveau) bepalen wie erin komt; integraties bewaren de verbinding.',
    es: 'Las herramientas que la membresía desbloquea para los miembros. Las concesiones de acceso (por nivel) deciden quién entra; las integraciones guardan la conexión.', // MT
    pt: 'As ferramentas que a associação desbloqueia para os membros. Concessões de acesso (por nível) decidem quem entra; as integrações guardam a conexão.', // MT
    de: 'Die Tools, die die Mitgliedschaft freischaltet. Zugriffsberechtigungen (pro Stufe) entscheiden, wer hineinkommt; Integrationen halten die Verbindung.', // MT
    fr: "Les outils que l'adhésion débloque. Les droits d'accès (par formule) décident qui entre ; les intégrations portent la connexion.", // MT
  },
  community_platform: {
    en: 'community platform',
    nl: 'communityplatform',
    es: 'plataforma comunitaria', // MT
    pt: 'plataforma de comunidade', // MT
    de: 'Community-Plattform', // MT
    fr: 'plateforme communautaire', // MT
  },
  google_suspension_sub: {
    en: 'account suspension on lapse',
    nl: 'accountopschorting bij verlopen',
    es: 'suspensión de cuenta al vencer', // MT
    pt: 'suspensão de conta ao expirar', // MT
    de: 'Kontosperrung bei Ablauf', // MT
    fr: "suspension du compte à l'expiration", // MT
  },
  fibre_seats_sub: {
    en: 'workspace seats — built in',
    nl: 'werkruimteplekken — ingebouwd',
    es: 'plazas del espacio de trabajo — integrado', // MT
    pt: 'assentos do workspace — nativo', // MT
    de: 'Workspace-Plätze — eingebaut', // MT
    fr: "places de l'espace de travail — intégré", // MT
  },
  always_connected: {
    en: 'Always connected',
    nl: 'Altijd verbonden',
    es: 'Siempre conectado', // MT
    pt: 'Sempre conectado', // MT
    de: 'Immer verbunden', // MT
    fr: 'Toujours connecté', // MT
  },
  more_integrations_note: {
    en: "More integrations land here as they're built — Slack, Discord, email tools. Each one becomes available as an access grant on your tiers' products.",
    nl: 'Meer integraties landen hier zodra ze gebouwd zijn — Slack, Discord, e-mailtools. Elke integratie wordt beschikbaar als toegangsrecht op de producten van je niveaus.',
    es: 'Más integraciones llegarán aquí a medida que se construyan — Slack, Discord, herramientas de correo. Cada una estará disponible como concesión de acceso en los productos de tus niveles.', // MT
    pt: 'Mais integrações chegam aqui conforme forem construídas — Slack, Discord, ferramentas de e-mail. Cada uma fica disponível como concessão de acesso nos produtos dos seus níveis.', // MT
    de: 'Weitere Integrationen landen hier, sobald sie gebaut sind — Slack, Discord, E-Mail-Tools. Jede wird als Zugriffsberechtigung auf den Produkten deiner Stufen verfügbar.', // MT
    fr: "D'autres intégrations arriveront ici au fur et à mesure — Slack, Discord, outils d'e-mail. Chacune devient disponible comme droit d'accès sur les produits de tes formules.", // MT
  },

  // ── circle card ───────────────────────────────────────────────────────
  circle_blurb: {
    en: 'Connect your Circle community so tiers can grant space access automatically. The API token is stored server-side and never shown again.',
    nl: 'Verbind je Circle-community zodat niveaus automatisch toegang tot spaces kunnen geven. Het API-token wordt server-side bewaard en nooit meer getoond.',
    es: 'Conecta tu comunidad de Circle para que los niveles concedan acceso a los espacios automáticamente. El token de la API se guarda en el servidor y no vuelve a mostrarse.', // MT
    pt: 'Conecte sua comunidade do Circle para que os níveis concedam acesso aos espaços automaticamente. O token da API fica guardado no servidor e nunca mais é mostrado.', // MT
    de: 'Verbinde deine Circle-Community, damit Stufen automatisch Space-Zugriff gewähren können. Der API-Token wird serverseitig gespeichert und nie wieder angezeigt.', // MT
    fr: "Connecte ta communauté Circle pour que les formules accordent l'accès aux espaces automatiquement. Le token d'API est stocké côté serveur et jamais réaffiché.", // MT
  },
  community_url: {
    en: 'Community URL',
    nl: 'Community-URL',
    es: 'URL de la comunidad', // MT
    pt: 'URL da comunidade', // MT
    de: 'Community-URL', // MT
    fr: 'URL de la communauté', // MT
  },
  api_token: {
    en: 'API token',
    nl: 'API-token',
    es: 'Token de API', // MT
    pt: 'Token de API', // MT
    de: 'API-Token', // MT
    fr: "Token d'API", // MT
  },
  token_saved_ph: {
    en: '••••• saved',
    nl: '••••• opgeslagen',
    es: '••••• guardado', // MT
    pt: '••••• salvo', // MT
    de: '••••• gespeichert', // MT
    fr: '••••• enregistré', // MT
  },
  paste_token_ph: {
    en: 'Paste a Circle API token',
    nl: 'Plak een Circle-API-token',
    es: 'Pega un token de la API de Circle', // MT
    pt: 'Cole um token da API do Circle', // MT
    de: 'Circle-API-Token einfügen', // MT
    fr: "Colle un token d'API Circle", // MT
  },
  remove_token: {
    en: 'Remove token',
    nl: 'Token verwijderen',
    es: 'Quitar token', // MT
    pt: 'Remover token', // MT
    de: 'Token entfernen', // MT
    fr: 'Retirer le token', // MT
  },

  // ── google card ───────────────────────────────────────────────────────
  google_blurb: {
    en: "Pause members' Google accounts when their membership lapses, and reactivate them when they rejoin — never creates or deletes accounts. Needs a service account with domain-wide delegation; the key is stored server-side and never shown again.",
    nl: 'Pauzeert de Google-accounts van leden als hun lidmaatschap verloopt en heractiveert ze als ze opnieuw lid worden — maakt of verwijdert nooit accounts. Vereist een serviceaccount met domeinbrede delegatie; de sleutel wordt server-side bewaard en nooit meer getoond.',
    es: 'Pausa las cuentas de Google de los miembros cuando su membresía vence y las reactiva cuando vuelven — nunca crea ni elimina cuentas. Necesita una cuenta de servicio con delegación en todo el dominio; la clave se guarda en el servidor y no vuelve a mostrarse.', // MT
    pt: 'Pausa as contas Google dos membros quando a associação expira e as reativa quando voltam — nunca cria nem exclui contas. Precisa de uma conta de serviço com delegação em todo o domínio; a chave fica no servidor e nunca mais é mostrada.', // MT
    de: 'Pausiert die Google-Konten von Mitgliedern bei Ablauf und reaktiviert sie beim Wiederbeitritt — legt nie Konten an und löscht keine. Braucht ein Dienstkonto mit domänenweiter Delegation; der Schlüssel wird serverseitig gespeichert und nie wieder angezeigt.', // MT
    fr: "Met en pause les comptes Google des membres quand leur adhésion expire et les réactive à leur retour — ne crée ni ne supprime jamais de comptes. Nécessite un compte de service avec délégation au niveau du domaine ; la clé est stockée côté serveur et jamais réaffichée.", // MT
  },
  google_admin_email_label: {
    en: 'Workspace admin email (impersonated)',
    nl: 'E-mail van de workspacebeheerder (geïmpersoneerd)',
    es: 'Correo del administrador del Workspace (suplantado)', // MT
    pt: 'E-mail do administrador do Workspace (impersonado)', // MT
    de: 'Workspace-Admin-E-Mail (impersoniert)', // MT
    fr: "E-mail de l'admin Workspace (usurpé)", // MT
  },
  sa_key_label: {
    en: 'Service-account key (JSON)',
    nl: 'Serviceaccount-sleutel (JSON)',
    es: 'Clave de la cuenta de servicio (JSON)', // MT
    pt: 'Chave da conta de serviço (JSON)', // MT
    de: 'Dienstkonto-Schlüssel (JSON)', // MT
    fr: 'Clé du compte de service (JSON)', // MT
  },
  sa_key_stored_suffix: {
    en: ' — a key is stored; paste to replace',
    nl: ' — er is een sleutel opgeslagen; plak om te vervangen',
    es: ' — hay una clave guardada; pega para reemplazar', // MT
    pt: ' — há uma chave salva; cole para substituir', // MT
    de: ' — ein Schlüssel ist gespeichert; zum Ersetzen einfügen', // MT
    fr: ' — une clé est enregistrée ; colle pour remplacer', // MT
  },
  stored_ph: {
    en: '••••••••  (stored)',
    nl: '••••••••  (opgeslagen)',
    es: '••••••••  (guardada)', // MT
    pt: '••••••••  (salva)', // MT
    de: '••••••••  (gespeichert)', // MT
    fr: '••••••••  (enregistrée)', // MT
  },
  disconnect: {
    en: 'Disconnect',
    nl: 'Verbinding verbreken',
    es: 'Desconectar', // MT
    pt: 'Desconectar', // MT
    de: 'Trennen', // MT
    fr: 'Déconnecter', // MT
  },

  // ── seat policy card ──────────────────────────────────────────────────
  when_tier_grants_seat: {
    en: 'When a tier grants a seat',
    nl: 'Als een niveau een plek toekent',
    es: 'Cuando un nivel concede una plaza', // MT
    pt: 'Quando um nível concede um assento', // MT
    de: 'Wenn eine Stufe einen Platz gewährt', // MT
    fr: 'Quand une formule accorde une place', // MT
  },
  seat_mode_approve: {
    en: 'Wait for approval — each seat needs an Approve click on the member',
    nl: 'Wachten op goedkeuring — elke plek vraagt een klik op Goedkeuren bij het lid',
    es: 'Esperar aprobación — cada plaza necesita un clic en Aprobar en el miembro', // MT
    pt: 'Aguardar aprovação — cada assento precisa de um clique em Aprovar no membro', // MT
    de: 'Auf Freigabe warten — jeder Platz braucht einen Klick auf Freigeben beim Mitglied', // MT
    fr: "Attendre l'approbation — chaque place demande un clic sur Approuver sur le membre", // MT
  },
  seat_mode_auto: {
    en: 'Automatic — seats within the plan allowance provision on their own',
    nl: 'Automatisch — plekken binnen het planlimiet regelen zichzelf',
    es: 'Automático — las plazas dentro del cupo del plan se aprovisionan solas', // MT
    pt: 'Automático — assentos dentro da cota do plano se provisionam sozinhos', // MT
    de: 'Automatisch — Plätze innerhalb des Plan-Kontingents richten sich selbst ein', // MT
    fr: "Automatique — les places dans le quota du plan se créent d'elles-mêmes", // MT
  },
  allow_billed_label: {
    en: 'Seats above the plan allowance may be billed',
    nl: 'Plekken boven het planlimiet mogen worden gefactureerd',
    es: 'Las plazas por encima del cupo del plan pueden facturarse', // MT
    pt: 'Assentos acima da cota do plano podem ser cobrados', // MT
    de: 'Plätze über dem Plan-Kontingent dürfen berechnet werden', // MT
    fr: 'Les places au-delà du quota du plan peuvent être facturées', // MT
  },
  allow_billed_hint: {
    en: "Standing consent: extra seats are charged on your Fibre subscription (prorated when added; a lapsed member's seat stops billing from the next period). Without this, a seat that would cost money always waits for approval.",
    nl: 'Doorlopende toestemming: extra plekken worden op je Fibre-abonnement in rekening gebracht (naar rato bij toevoegen; de plek van een verlopen lid stopt met factureren vanaf de volgende periode). Zonder dit wacht een plek die geld kost altijd op goedkeuring.',
    es: 'Consentimiento permanente: las plazas extra se cargan a tu suscripción de Fibre (prorrateadas al añadirse; la plaza de un miembro vencido deja de facturarse desde el siguiente período). Sin esto, una plaza que costaría dinero siempre espera aprobación.', // MT
    pt: 'Consentimento permanente: assentos extras são cobrados na sua assinatura Fibre (proporcional ao adicionar; o assento de um membro expirado para de ser cobrado no próximo período). Sem isso, um assento que custaria dinheiro sempre aguarda aprovação.', // MT
    de: 'Dauerhafte Zustimmung: Zusatzplätze werden über dein Fibre-Abo berechnet (anteilig beim Hinzufügen; der Platz eines abgelaufenen Mitglieds wird ab der nächsten Periode nicht mehr berechnet). Ohne dies wartet ein kostenpflichtiger Platz immer auf Freigabe.', // MT
    fr: "Consentement permanent : les places supplémentaires sont facturées sur ton abonnement Fibre (au prorata à l'ajout ; la place d'un membre expiré cesse d'être facturée à la période suivante). Sans cela, une place payante attend toujours une approbation.", // MT
  },
  save_seat_policy: {
    en: 'Save seat policy',
    nl: 'Plekkenbeleid opslaan',
    es: 'Guardar política de plazas', // MT
    pt: 'Salvar política de assentos', // MT
    de: 'Platzrichtlinie speichern', // MT
    fr: 'Enregistrer la politique de places', // MT
  },

  // ── embeds ────────────────────────────────────────────────────────────
  embeds_desc: {
    en: 'Copy-paste snippets to show your tiers and take joins on any website.',
    nl: 'Copy-paste-snippets om je niveaus te tonen en aanmeldingen te ontvangen op elke website.',
    es: 'Fragmentos para copiar y pegar que muestran tus niveles y aceptan altas en cualquier web.', // MT
    pt: 'Trechos de copiar e colar para mostrar seus níveis e receber adesões em qualquer site.', // MT
    de: 'Copy-Paste-Snippets, um deine Stufen zu zeigen und Beitritte auf jeder Website anzunehmen.', // MT
    fr: "Des extraits à copier-coller pour afficher tes formules et recevoir des adhésions sur n'importe quel site.", // MT
  },
  embeds_blurb_1: {
    en: 'Show your tiers and take memberships on any website — auto-sizing, copy-paste. Every element inside the embed carries a stable',
    nl: 'Toon je niveaus en ontvang lidmaatschappen op elke website — zelfschalend, copy-paste. Elk element in de embed draagt een stabiele',
    es: 'Muestra tus niveles y acepta membresías en cualquier web — se ajusta solo, copiar y pegar. Cada elemento del embed lleva una clase estable', // MT
    pt: 'Mostre seus níveis e receba associações em qualquer site — auto-ajustável, copiar e colar. Cada elemento do embed carrega uma classe estável', // MT
    de: 'Zeige deine Stufen und nimm Mitgliedschaften auf jeder Website an — selbstskalierend, Copy-Paste. Jedes Element im Embed trägt eine stabile', // MT
    fr: "Affiche tes formules et reçois des adhésions sur n'importe quel site — auto-ajustable, copier-coller. Chaque élément de l'embed porte une classe stable", // MT
  },
  embeds_blurb_2: {
    en: 'class (me-card, me-title, me-price, me-btn, …); to restyle it, put a',
    nl: '-klasse (me-card, me-title, me-price, me-btn, …); om de stijl aan te passen zet je een',
    es: '(me-card, me-title, me-price, me-btn, …); para cambiar el estilo, pon un bloque', // MT
    pt: '(me-card, me-title, me-price, me-btn, …); para reestilizar, coloque um bloco', // MT
    de: '-Klasse (me-card, me-title, me-price, me-btn, …); zum Umstylen setze einen', // MT
    fr: '(me-card, me-title, me-price, me-btn, …) ; pour changer le style, place un bloc', // MT
  },
  embeds_blurb_3: {
    en: 'block INSIDE the embed div — it is lifted into the embed and never touches your page.',
    nl: '-blok BINNEN de embed-div — het wordt in de embed getild en raakt je pagina nooit.',
    es: 'DENTRO del div del embed — se traslada al embed y nunca toca tu página.', // MT
    pt: 'DENTRO da div do embed — ele é levado para o embed e nunca toca sua página.', // MT
    de: '-Block IN das Embed-Div — er wird ins Embed gehoben und berührt deine Seite nie.', // MT
    fr: "À L'INTÉRIEUR du div de l'embed — il est transféré dans l'embed et ne touche jamais ta page.", // MT
  },
  what_to_embed: {
    en: 'What do you want to embed?',
    nl: 'Wat wil je embedden?',
    es: '¿Qué quieres incrustar?', // MT
    pt: 'O que você quer incorporar?', // MT
    de: 'Was möchtest du einbetten?', // MT
    fr: 'Que veux-tu intégrer ?', // MT
  },
  whole_page: {
    en: 'Whole page',
    nl: 'Hele pagina',
    es: 'Página completa', // MT
    pt: 'Página inteira', // MT
    de: 'Ganze Seite', // MT
    fr: 'Page entière', // MT
  },
  join_popup: {
    en: 'Popup',
    nl: 'Pop-up',
    es: 'Ventana emergente', // MT
    pt: 'Janela pop-up', // MT
    de: 'Pop-up', // MT
    fr: 'Fenêtre pop-up', // MT
  },
  tier_cards: {
    en: 'Tier cards',
    nl: 'Niveaukaarten',
    es: 'Tarjetas de niveles', // MT
    pt: 'Cartões de níveis', // MT
    de: 'Stufenkarten', // MT
    fr: 'Cartes de formules', // MT
  },
  join_button: {
    en: 'Join button',
    nl: 'Aanmeldknop',
    es: 'Botón de alta', // MT
    pt: 'Botão de adesão', // MT
    de: 'Beitrittsbutton', // MT
    fr: "Bouton d'adhésion", // MT
  },
  language: {
    en: 'Language',
    nl: 'Taal',
    es: 'Idioma', // MT
    pt: 'Idioma', // MT
    de: 'Sprache', // MT
    fr: 'Langue', // MT
  },
  lang_auto: {
    en: "Automatic — the workspace's",
    nl: 'Automatisch — die van de werkruimte',
    es: 'Automático — el del espacio de trabajo', // MT
    pt: 'Automático — o do workspace', // MT
    de: 'Automatisch — die des Workspace', // MT
    fr: "Automatique — celle de l'espace de travail", // MT
  },
  button_text: {
    en: 'Button text',
    nl: 'Knoptekst',
    es: 'Texto del botón', // MT
    pt: 'Texto do botão', // MT
    de: 'Button-Text', // MT
    fr: 'Texte du bouton', // MT
  },
  embed_step1: {
    en: '1 · Once per site, in the <head> (or before </body>)',
    nl: '1 · Eén keer per site, in de <head> (of vóór </body>)',
    es: '1 · Una vez por sitio, en el <head> (o antes de </body>)', // MT
    pt: '1 · Uma vez por site, no <head> (ou antes de </body>)', // MT
    de: '1 · Einmal pro Website, im <head> (oder vor </body>)', // MT
    fr: '1 · Une fois par site, dans le <head> (ou avant </body>)', // MT
  },
  embed_step2: {
    en: '2 · Where the embed should appear',
    nl: '2 · Waar de embed moet verschijnen',
    es: '2 · Donde debe aparecer el embed', // MT
    pt: '2 · Onde o embed deve aparecer', // MT
    de: '2 · Wo das Embed erscheinen soll', // MT
    fr: "2 · Là où l'embed doit apparaître", // MT
  },
  embed_all_in_one: {
    en: 'Or all-in-one — script and embed in a single paste',
    nl: 'Of alles-in-één — script en embed in één keer plakken',
    es: 'O todo en uno — script y embed en un solo pegado', // MT
    pt: 'Ou tudo em um — script e embed em uma só colagem', // MT
    de: 'Oder alles in einem — Script und Embed in einem Einfügen', // MT
    fr: "Ou tout-en-un — script et embed en un seul collage", // MT
  },
  copy: {
    en: 'Copy',
    nl: 'Kopiëren',
    es: 'Copiar', // MT
    pt: 'Copiar', // MT
    de: 'Kopieren', // MT
    fr: 'Copier', // MT
  },
  copied: {
    en: 'Copied',
    nl: 'Gekopieerd',
    es: 'Copiado', // MT
    pt: 'Copiado', // MT
    de: 'Kopiert', // MT
    fr: 'Copié', // MT
  },
  embeds_need_slug: {
    en: 'Embed snippets need the workspace slug — it could not be loaded right now.',
    nl: 'Embed-snippets hebben de werkruimte-slug nodig — die kon nu niet worden geladen.',
    es: 'Los fragmentos de embed necesitan el slug del espacio de trabajo — ahora mismo no se pudo cargar.', // MT
    pt: 'Os trechos de embed precisam do slug do workspace — não foi possível carregá-lo agora.', // MT
    de: 'Embed-Snippets brauchen den Workspace-Slug — er konnte gerade nicht geladen werden.', // MT
    fr: "Les extraits d'embed ont besoin du slug de l'espace de travail — impossible de le charger pour l'instant.", // MT
  },

  // ── payments ──────────────────────────────────────────────────────────
  payments_title: {
    en: 'Payments',
    nl: 'Betalingen',
    es: 'Pagos', // MT
    pt: 'Pagamentos', // MT
    de: 'Zahlungen', // MT
    fr: 'Paiements', // MT
  },
  payments_desc: {
    en: "One set of payment settings for all Fibre apps — your personal account and the workspace's, plus your default payment options.",
    nl: 'Eén set betaalinstellingen voor alle Fibre-apps — je persoonlijke account en dat van de werkruimte, plus je standaard betaalopties.',
    es: 'Un solo conjunto de ajustes de pago para todas las apps de Fibre — tu cuenta personal y la del espacio de trabajo, más tus opciones de pago por defecto.', // MT
    pt: 'Um único conjunto de configurações de pagamento para todos os apps Fibre — sua conta pessoal e a do workspace, mais suas opções de pagamento padrão.', // MT
    de: 'Ein Satz Zahlungseinstellungen für alle Fibre-Apps — dein persönliches Konto und das des Workspace, plus deine Standard-Zahlungsoptionen.', // MT
    fr: "Un seul jeu de paramètres de paiement pour toutes les apps Fibre — ton compte personnel et celui de l'espace de travail, plus tes options de paiement par défaut.", // MT
  },
  my_account: {
    en: 'My account',
    nl: 'Mijn account',
    es: 'Mi cuenta', // MT
    pt: 'Minha conta', // MT
    de: 'Mein Konto', // MT
    fr: 'Mon compte', // MT
  },
  my_account_desc: {
    en: 'Payouts for your personal sales — one connection, every Fibre app uses it. The invoice details appear as the seller on receipts for your personal sales.',
    nl: 'Uitbetalingen voor je persoonlijke verkopen — één verbinding, elke Fibre-app gebruikt hem. De factuurgegevens verschijnen als verkoper op bonnen van je persoonlijke verkopen.',
    es: 'Pagos por tus ventas personales — una conexión, todas las apps de Fibre la usan. Los datos de factura aparecen como vendedor en los recibos de tus ventas personales.', // MT
    pt: 'Repasses das suas vendas pessoais — uma conexão, todo app Fibre a usa. Os dados de fatura aparecem como vendedor nos recibos das suas vendas pessoais.', // MT
    de: 'Auszahlungen für deine persönlichen Verkäufe — eine Verbindung, jede Fibre-App nutzt sie. Die Rechnungsdaten erscheinen als Verkäufer auf Belegen deiner persönlichen Verkäufe.', // MT
    fr: 'Les versements de tes ventes personnelles — une connexion, chaque app Fibre l’utilise. Les coordonnées de facturation apparaissent comme vendeur sur les reçus de tes ventes personnelles.', // MT
  },
  workspace_account: {
    en: 'Workspace account',
    nl: 'Werkruimte-account',
    es: 'Cuenta del espacio de trabajo', // MT
    pt: 'Conta do workspace', // MT
    de: 'Workspace-Konto', // MT
    fr: "Compte de l'espace de travail", // MT
  },
  workspace_account_desc: {
    en: "Payouts for team sales and anything routed to the workspace. Teams don't hold their own accounts — team sales land here, with these invoice details as the seller.",
    nl: 'Uitbetalingen voor teamverkopen en alles wat naar de werkruimte gaat. Teams hebben geen eigen accounts — teamverkopen landen hier, met deze factuurgegevens als verkoper.',
    es: 'Pagos por ventas de equipo y todo lo dirigido al espacio de trabajo. Los equipos no tienen cuentas propias — sus ventas llegan aquí, con estos datos de factura como vendedor.', // MT
    pt: 'Repasses de vendas de equipe e tudo que vai para o workspace. Equipes não têm contas próprias — as vendas de equipe caem aqui, com estes dados de fatura como vendedor.', // MT
    de: 'Auszahlungen für Team-Verkäufe und alles, was an den Workspace geht. Teams haben keine eigenen Konten — Team-Verkäufe landen hier, mit diesen Rechnungsdaten als Verkäufer.', // MT
    fr: "Les versements des ventes d'équipe et de tout ce qui va à l'espace de travail. Les équipes n'ont pas de comptes propres — leurs ventes atterrissent ici, avec ces coordonnées comme vendeur.", // MT
  },
  methods_hint_ws: {
    en: 'team & workspace sales inherit these',
    nl: 'team- en werkruimteverkopen erven deze',
    es: 'las ventas de equipo y del espacio de trabajo heredan esto', // MT
    pt: 'vendas de equipe e do workspace herdam isto', // MT
    de: 'Team- & Workspace-Verkäufe erben diese', // MT
    fr: "les ventes d'équipe et de l'espace de travail en héritent", // MT
  },
  methods_hint_personal: {
    en: 'your personal sales inherit these',
    nl: 'je persoonlijke verkopen erven deze',
    es: 'tus ventas personales heredan esto', // MT
    pt: 'suas vendas pessoais herdam isto', // MT
    de: 'deine persönlichen Verkäufe erben diese', // MT
    fr: 'tes ventes personnelles en héritent', // MT
  },
  managed_by_admins: {
    en: 'Managed by workspace admins.',
    nl: 'Beheerd door werkruimtebeheerders.',
    es: 'Gestionado por los administradores del espacio de trabajo.', // MT
    pt: 'Gerenciado pelos administradores do workspace.', // MT
    de: 'Wird von Workspace-Admins verwaltet.', // MT
    fr: "Géré par les admins de l'espace de travail.", // MT
  },
  stripe_account_id: {
    en: 'Stripe account id',
    nl: 'Stripe-account-id',
    es: 'ID de cuenta de Stripe', // MT
    pt: 'ID da conta Stripe', // MT
    de: 'Stripe-Konto-ID', // MT
    fr: 'ID du compte Stripe', // MT
  },
  legal_name_label: {
    en: 'Legal name (on invoices)',
    nl: 'Juridische naam (op facturen)',
    es: 'Razón social (en las facturas)', // MT
    pt: 'Razão social (nas faturas)', // MT
    de: 'Rechtlicher Name (auf Rechnungen)', // MT
    fr: 'Raison sociale (sur les factures)', // MT
  },
  tax_vat_label: {
    en: 'Tax / VAT number',
    nl: 'Btw-nummer',
    es: 'Número fiscal / IVA', // MT
    pt: 'Número fiscal / IVA', // MT
    de: 'Steuer-/USt-Nummer', // MT
    fr: 'Numéro fiscal / TVA', // MT
  },
  address_label: {
    en: 'Address (on invoices)',
    nl: 'Adres (op facturen)',
    es: 'Dirección (en las facturas)', // MT
    pt: 'Endereço (nas faturas)', // MT
    de: 'Adresse (auf Rechnungen)', // MT
    fr: 'Adresse (sur les factures)', // MT
  },
  default_payment_options: {
    en: 'Default payment options',
    nl: 'Standaard betaalopties',
    es: 'Opciones de pago por defecto', // MT
    pt: 'Opções de pagamento padrão', // MT
    de: 'Standard-Zahlungsoptionen', // MT
    fr: 'Options de paiement par défaut', // MT
  },
  pay_online_card: {
    en: 'Pay online (card)',
    nl: 'Online betalen (kaart)',
    es: 'Pago en línea (tarjeta)', // MT
    pt: 'Pagar online (cartão)', // MT
    de: 'Online zahlen (Karte)', // MT
    fr: 'Payer en ligne (carte)', // MT
  },
  pay_per_invoice: {
    en: 'Pay per invoice',
    nl: 'Betalen per factuur',
    es: 'Pago por factura', // MT
    pt: 'Pagar por fatura', // MT
    de: 'Auf Rechnung zahlen', // MT
    fr: 'Payer sur facture', // MT
  },
  acct_error: {
    en: 'A Stripe account id starts with acct_',
    nl: 'Een Stripe-account-id begint met acct_',
    es: 'Un ID de cuenta de Stripe empieza por acct_', // MT
    pt: 'Um ID de conta Stripe começa com acct_', // MT
    de: 'Eine Stripe-Konto-ID beginnt mit acct_', // MT
    fr: 'Un ID de compte Stripe commence par acct_', // MT
  },
  keep_one_method: {
    en: 'Keep at least one payment option on.',
    nl: 'Houd minstens één betaaloptie aan.',
    es: 'Mantén al menos una opción de pago activada.', // MT
    pt: 'Mantenha pelo menos uma opção de pagamento ativa.', // MT
    de: 'Lass mindestens eine Zahlungsoption aktiv.', // MT
    fr: 'Garde au moins une option de paiement active.', // MT
  },
  stripe_footnote: {
    en: 'The Stripe account id starts with acct_ (Stripe → Settings → Account details). Leaving it empty disconnects. Payment options inherit downward: account default first, each app can override per item.',
    nl: 'De Stripe-account-id begint met acct_ (Stripe → Settings → Account details). Leeg laten verbreekt de verbinding. Betaalopties erven naar beneden: eerst het accountstandaard, elke app kan per item afwijken.',
    es: 'El ID de cuenta de Stripe empieza por acct_ (Stripe → Settings → Account details). Dejarlo vacío desconecta. Las opciones de pago se heredan hacia abajo: primero el valor por defecto de la cuenta, cada app puede anularlo por elemento.', // MT
    pt: 'O ID da conta Stripe começa com acct_ (Stripe → Settings → Account details). Deixar vazio desconecta. Opções de pagamento herdam para baixo: padrão da conta primeiro, cada app pode sobrescrever por item.', // MT
    de: 'Die Stripe-Konto-ID beginnt mit acct_ (Stripe → Settings → Account details). Leer lassen trennt die Verbindung. Zahlungsoptionen vererben sich nach unten: erst der Konto-Standard, jede App kann pro Element abweichen.', // MT
    fr: "L'ID du compte Stripe commence par acct_ (Stripe → Settings → Account details). Le laisser vide déconnecte. Les options de paiement s'héritent vers le bas : défaut du compte d'abord, chaque app peut surcharger par élément.", // MT
  },

  // ── pricing rules ─────────────────────────────────────────────────────
  pricing_desc: {
    en: 'Adjust prices by rules — purchasing-power pricing by country, or whatever logic your community needs. First matching rule wins; checkout always computes server-side.',
    nl: 'Pas prijzen aan met regels — koopkrachtprijzen per land, of welke logica je community ook nodig heeft. De eerste regel die past wint; de checkout rekent altijd server-side.',
    es: 'Ajusta los precios con reglas — precios según poder adquisitivo por país, o la lógica que tu comunidad necesite. Gana la primera regla que coincide; el pago siempre se calcula en el servidor.', // MT
    pt: 'Ajuste preços por regras — preços por poder de compra por país, ou a lógica que sua comunidade precisar. A primeira regra que combinar vence; o checkout sempre calcula no servidor.', // MT
    de: 'Passe Preise per Regeln an — Kaufkraftpreise nach Land oder welche Logik deine Community braucht. Die erste passende Regel gewinnt; der Checkout rechnet immer serverseitig.', // MT
    fr: "Ajuste les prix par règles — tarifs selon le pouvoir d'achat par pays, ou la logique dont ta communauté a besoin. La première règle qui correspond gagne ; le paiement se calcule toujours côté serveur.", // MT
  },
  pricing_empty_before: {
    en: 'No rules yet. Example:',
    nl: 'Nog geen regels. Voorbeeld:',
    es: 'Aún no hay reglas. Ejemplo:', // MT
    pt: 'Ainda não há regras. Exemplo:', // MT
    de: 'Noch keine Regeln. Beispiel:', // MT
    fr: 'Pas encore de règles. Exemple :', // MT
  },
  pricing_empty_example: {
    en: 'when country is one of South Africa → price 75%',
    nl: 'als land een van Zuid-Afrika is → prijs 75%',
    es: 'cuando país es uno de Sudáfrica → precio 75%', // MT
    pt: 'quando país é um de África do Sul → preço 75%', // MT
    de: 'wenn Land eines von Südafrika ist → Preis 75%', // MT
    fr: "quand pays est l'un de Afrique du Sud → prix 75%", // MT
  },
  pricing_empty_after: {
    en: 'Members declare their country on the join page; the matching rule sets their price.',
    nl: 'Leden geven hun land op op de aanmeldpagina; de regel die past bepaalt hun prijs.',
    es: 'Los miembros declaran su país en la página de inscripción; la regla que coincide fija su precio.', // MT
    pt: 'Os membros declaram seu país na página de adesão; a regra que combinar define seu preço.', // MT
    de: 'Mitglieder geben ihr Land auf der Beitrittsseite an; die passende Regel bestimmt ihren Preis.', // MT
    fr: "Les membres déclarent leur pays sur la page d'adhésion ; la règle correspondante fixe leur prix.", // MT
  },
  when_word: {
    en: 'when',
    nl: 'als',
    es: 'cuando', // MT
    pt: 'quando', // MT
    de: 'wenn', // MT
    fr: 'quand', // MT
  },
  attr_country: {
    en: 'country',
    nl: 'land',
    es: 'país', // MT
    pt: 'país', // MT
    de: 'Land', // MT
    fr: 'pays', // MT
  },
  attr_interval: {
    en: 'billing interval',
    nl: 'factureringsinterval',
    es: 'intervalo de facturación', // MT
    pt: 'intervalo de cobrança', // MT
    de: 'Abrechnungsintervall', // MT
    fr: 'intervalle de facturation', // MT
  },
  op_in: {
    en: 'is one of',
    nl: 'is een van',
    es: 'es uno de', // MT
    pt: 'é um de', // MT
    de: 'ist eines von', // MT
    fr: "est l'un de", // MT
  },
  op_not_in: {
    en: 'is not one of',
    nl: 'is niet een van',
    es: 'no es uno de', // MT
    pt: 'não é um de', // MT
    de: 'ist keines von', // MT
    fr: "n'est pas l'un de", // MT
  },
  arrow_price: {
    en: '→ price',
    nl: '→ prijs',
    es: '→ precio', // MT
    pt: '→ preço', // MT
    de: '→ Preis', // MT
    fr: '→ prix', // MT
  },
  remove_rule: {
    en: 'Remove rule',
    nl: 'Regel verwijderen',
    es: 'Quitar regla', // MT
    pt: 'Remover regra', // MT
    de: 'Regel entfernen', // MT
    fr: 'Retirer la règle', // MT
  },
  add_a_country_ph: {
    en: 'Add a country…',
    nl: 'Voeg een land toe…',
    es: 'Añade un país…', // MT
    pt: 'Adicione um país…', // MT
    de: 'Land hinzufügen…', // MT
    fr: 'Ajouter un pays…', // MT
  },
  add_rule: {
    en: 'Add rule',
    nl: 'Regel toevoegen',
    es: 'Añadir regla', // MT
    pt: 'Adicionar regra', // MT
    de: 'Regel hinzufügen', // MT
    fr: 'Ajouter une règle', // MT
  },
  no_rule_matches: {
    en: 'When no rule matches → price',
    nl: 'Als geen regel past → prijs',
    es: 'Cuando ninguna regla coincide → precio', // MT
    pt: 'Quando nenhuma regra combina → preço', // MT
    de: 'Wenn keine Regel passt → Preis', // MT
    fr: 'Quand aucune règle ne correspond → prix', // MT
  },
  pricing_footnote: {
    en: "Country is self-declared on the join page — never guessed from an IP. A member's country change reprices from their next renewal. A card issued in a different country than declared sends the admins a heads-up, never blocks.",
    nl: 'Het land wordt zelf opgegeven op de aanmeldpagina — nooit geraden via een IP. Een landwijziging herprijst vanaf de volgende verlenging. Een kaart uit een ander land dan opgegeven stuurt de beheerders een seintje, blokkeert nooit.',
    es: 'El país se declara en la página de inscripción — nunca se adivina por IP. Un cambio de país reprecia desde la siguiente renovación. Una tarjeta emitida en un país distinto al declarado avisa a los administradores, nunca bloquea.', // MT
    pt: 'O país é autodeclarado na página de adesão — nunca adivinhado pelo IP. Uma mudança de país reprecifica a partir da próxima renovação. Um cartão emitido em país diferente do declarado avisa os administradores, nunca bloqueia.', // MT
    de: 'Das Land wird auf der Beitrittsseite selbst angegeben — nie per IP geraten. Eine Länderänderung bepreist ab der nächsten Verlängerung neu. Eine Karte aus einem anderen Land als angegeben schickt den Admins einen Hinweis, blockiert nie.', // MT
    fr: "Le pays est auto-déclaré sur la page d'adhésion — jamais deviné par IP. Un changement de pays retarife au prochain renouvellement. Une carte émise dans un autre pays que celui déclaré alerte les admins, sans jamais bloquer.", // MT
  },
  every_rule_needs_value: {
    en: 'Every rule needs at least one value — pick countries (or remove the row).',
    nl: 'Elke regel heeft minstens één waarde nodig — kies landen (of verwijder de regel).',
    es: 'Cada regla necesita al menos un valor — elige países (o elimina la fila).', // MT
    pt: 'Cada regra precisa de pelo menos um valor — escolha países (ou remova a linha).', // MT
    de: 'Jede Regel braucht mindestens einen Wert — wähle Länder (oder entferne die Zeile).', // MT
    fr: 'Chaque règle a besoin d’au moins une valeur — choisis des pays (ou supprime la ligne).', // MT
  },
  save_pricing_rules: {
    en: 'Save pricing rules',
    nl: 'Prijsregels opslaan',
    es: 'Guardar reglas de precios', // MT
    pt: 'Salvar regras de preço', // MT
    de: 'Preisregeln speichern', // MT
    fr: 'Enregistrer les règles de prix', // MT
  },

  // ── invoices ──────────────────────────────────────────────────────────
  invoices_desc: {
    en: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
    nl: 'Elke aankoop in al je Fibre-apps — zoeken, facturen opnieuw versturen, terugbetalen.',
    es: 'Cada compra en todas tus apps de Fibre — busca, reenvía facturas, reembolsa.', // MT
    pt: 'Cada compra em todos os seus apps Fibre — busque, reenvie faturas, reembolse.', // MT
    de: 'Jeder Kauf über alle deine Fibre-Apps — suchen, Rechnungen erneut senden, erstatten.', // MT
    fr: 'Chaque achat dans toutes tes apps Fibre — rechercher, renvoyer des factures, rembourser.', // MT
  },

  // ── help ──────────────────────────────────────────────────────────────
  help_dash_blurb: {
    en: 'Your community at a glance — active members, renewals coming up, recent joins.',
    nl: 'Je community in één oogopslag — actieve leden, aankomende verlengingen, recente aanmeldingen.',
    es: 'Tu comunidad de un vistazo — miembros activos, próximas renovaciones, altas recientes.', // MT
    pt: 'Sua comunidade em um relance — membros ativos, renovações a caminho, adesões recentes.', // MT
    de: 'Deine Community auf einen Blick — aktive Mitglieder, anstehende Verlängerungen, neue Beitritte.', // MT
    fr: "Ta communauté en un coup d'œil — membres actifs, renouvellements à venir, adhésions récentes.", // MT
  },
  help_members_blurb: {
    en: 'Everyone who holds (or held) a membership: tier, status, renewal date. Add someone manually or let the join page do it.',
    nl: 'Iedereen die een lidmaatschap heeft (of had): niveau, status, verlengdatum. Voeg iemand handmatig toe of laat de aanmeldpagina het doen.',
    es: 'Todos los que tienen (o tuvieron) una membresía: nivel, estado, fecha de renovación. Añade a alguien a mano o deja que lo haga la página de inscripción.', // MT
    pt: 'Todos que têm (ou tiveram) uma associação: nível, status, data de renovação. Adicione alguém manualmente ou deixe a página de adesão fazer isso.', // MT
    de: 'Alle, die eine Mitgliedschaft haben (oder hatten): Stufe, Status, Verlängerungsdatum. Füge jemanden manuell hinzu oder lass es die Beitrittsseite tun.', // MT
    fr: "Tous ceux qui ont (ou ont eu) une adhésion : formule, statut, date de renouvellement. Ajoute quelqu'un à la main ou laisse faire la page d'adhésion.", // MT
  },
  help_tiers_blurb: {
    en: 'What you sell: yearly (and optionally monthly) prices, what each tier includes, in the order the join page shows them.',
    nl: 'Wat je verkoopt: jaarprijzen (en optioneel maandprijzen), wat elk niveau bevat, in de volgorde waarin de aanmeldpagina ze toont.',
    es: 'Lo que vendes: precios anuales (y opcionalmente mensuales), lo que incluye cada nivel, en el orden en que los muestra la página de inscripción.', // MT
    pt: 'O que você vende: preços anuais (e opcionalmente mensais), o que cada nível inclui, na ordem em que a página de adesão os mostra.', // MT
    de: 'Was du verkaufst: Jahres- (und optional Monats-)Preise, was jede Stufe enthält, in der Reihenfolge, in der die Beitrittsseite sie zeigt.', // MT
    fr: "Ce que tu vends : prix annuels (et éventuellement mensuels), ce que chaque formule inclut, dans l'ordre où la page d'adhésion les affiche.", // MT
  },
  help_products_blurb: {
    en: 'The catalogue tiers draw from — spaces, programmes, perks — each with links to the thing itself.',
    nl: 'De catalogus waaruit niveaus putten — spaces, programma’s, extra’s — elk met links naar het ding zelf.',
    es: 'El catálogo del que se nutren los niveles — espacios, programas, ventajas — cada uno con enlaces a la cosa misma.', // MT
    pt: 'O catálogo de onde os níveis tiram — espaços, programas, benefícios — cada um com links para a coisa em si.', // MT
    de: 'Der Katalog, aus dem Stufen schöpfen — Spaces, Programme, Extras — jedes mit Links zum Ding selbst.', // MT
    fr: "Le catalogue où puisent les formules — espaces, programmes, avantages — chacun avec des liens vers la chose elle-même.", // MT
  },
  help_access_label: {
    en: 'Access (on products)',
    nl: 'Toegang (op producten)',
    es: 'Acceso (en productos)', // MT
    pt: 'Acesso (em produtos)', // MT
    de: 'Zugriff (auf Produkten)', // MT
    fr: 'Accès (sur les produits)', // MT
  },
  help_access_blurb: {
    en: 'Each product carries what it unlocks (a Circle space, a Fibre seat, a thread) — synced automatically as members come and go. Access status lives under Members.',
    nl: 'Elk product draagt wat het ontgrendelt (een Circle-space, een Fibre-plek, een thread) — automatisch gesynchroniseerd als leden komen en gaan. Toegangsstatus vind je onder Leden.',
    es: 'Cada producto lleva lo que desbloquea (un espacio de Circle, una plaza de Fibre, un thread) — sincronizado automáticamente cuando los miembros van y vienen. El estado de acceso está en Miembros.', // MT
    pt: 'Cada produto carrega o que desbloqueia (um espaço do Circle, um assento Fibre, um thread) — sincronizado automaticamente conforme membros vêm e vão. O status de acesso fica em Membros.', // MT
    de: 'Jedes Produkt trägt, was es freischaltet (ein Circle-Space, ein Fibre-Platz, ein Thread) — automatisch synchronisiert, wenn Mitglieder kommen und gehen. Den Zugriffsstatus findest du unter Mitglieder.', // MT
    fr: "Chaque produit porte ce qu'il débloque (un espace Circle, une place Fibre, un thread) — synchronisé automatiquement au gré des allées et venues des membres. L'état des accès se trouve sous Membres.", // MT
  },
  help_settings_blurb: {
    en: 'The join page, the Circle connection, and your Fibre profile.',
    nl: 'De aanmeldpagina, de Circle-verbinding en je Fibre-profiel.',
    es: 'La página de inscripción, la conexión con Circle y tu perfil de Fibre.', // MT
    pt: 'A página de adesão, a conexão com o Circle e seu perfil Fibre.', // MT
    de: 'Die Beitrittsseite, die Circle-Verbindung und dein Fibre-Profil.', // MT
    fr: "La page d'adhésion, la connexion Circle et ton profil Fibre.", // MT
  },

  // ── product pricing intervals ────────────────────────────────────────
  interval_once: {
    en: 'One-time',
    nl: 'Eenmalig',
    es: 'Pago único', // MT
    pt: 'Uma vez', // MT
    de: 'Einmalig', // MT
    fr: 'Une fois', // MT
  },
  interval_month: {
    en: 'Per month',
    nl: 'Per maand',
    es: 'Al mes', // MT
    pt: 'Por mês', // MT
    de: 'Pro Monat', // MT
    fr: 'Par mois', // MT
  },
  interval_year: {
    en: 'Per year',
    nl: 'Per jaar',
    es: 'Al año', // MT
    pt: 'Por ano', // MT
    de: 'Pro Jahr', // MT
    fr: 'Par an', // MT
  },
  interval_note: {
    en: 'A recurring product joins the member’s subscription — it is only offered when the membership is billed on the same rhythm (a monthly add-on with a monthly membership).',
    nl: 'Een terugkerend product loopt mee in het abonnement van het lid — het wordt alleen aangeboden als het lidmaatschap hetzelfde ritme heeft (een maandelijkse add-on bij een maandelijks lidmaatschap).',
    es: 'Un producto recurrente se suma a la suscripción del miembro — solo se ofrece cuando la membresía se cobra al mismo ritmo (un extra mensual con una membresía mensual).', // MT
    pt: 'Um produto recorrente entra na assinatura do membro — só é oferecido quando a associação é cobrada no mesmo ritmo (um extra mensal com uma associação mensal).', // MT
    de: 'Ein wiederkehrendes Produkt läuft im Abo des Mitglieds mit — es wird nur angeboten, wenn die Mitgliedschaft im selben Rhythmus abgerechnet wird (ein monatliches Extra zur monatlichen Mitgliedschaft).', // MT
    fr: 'Un produit récurrent rejoint l’abonnement du membre — il n’est proposé que si l’adhésion est facturée au même rythme (un extra mensuel avec une adhésion mensuelle).', // MT
  },
  // ── help: how-to guides ───────────────────────────────────────────────
  // The Help page's manual (2026-09-27). Two keys per guide: the title and
  // ONE steps string, newline-separated — the page splits it with
  // guideSteps(). The settings blurb below replaces help_settings_blurb,
  // which named three things when Settings had grown to five.
  help_settings_blurb_2: {
    en: 'The join page, integrations (Circle, Google Workspace, Fibre seats), pricing rules and website embeds — plus the payment settings every Fibre app shares.',
    nl: 'De aanmeldpagina, integraties (Circle, Google Workspace, Fibre-plekken), prijsregels en website-embeds — plus de betaalinstellingen die elke Fibre-app deelt.',
    es: 'La página de inscripción, integraciones (Circle, Google Workspace, plazas de Fibre), reglas de precios y embeds para tu web — más los ajustes de pago que comparten todas las apps Fibre.', // MT
    pt: 'A página de adesão, integrações (Circle, Google Workspace, assentos Fibre), regras de preço e embeds para seu site — mais as configurações de pagamento que todos os apps Fibre compartilham.', // MT
    de: 'Die Beitrittsseite, Integrationen (Circle, Google Workspace, Fibre-Plätze), Preisregeln und Website-Embeds — plus die Zahlungseinstellungen, die alle Fibre-Apps teilen.', // MT
    fr: 'La page d’adhésion, les intégrations (Circle, Google Workspace, places Fibre), les règles de prix et les intégrations web — plus les paramètres de paiement partagés par toutes les apps Fibre.', // MT
  },
  help_g_tier_title: {
    en: 'Create your first tier',
    nl: 'Maak je eerste niveau',
    es: 'Crea tu primer nivel', // MT
    pt: 'Crie seu primeiro nível', // MT
    de: 'Erstelle deine erste Stufe', // MT
    fr: 'Créer ta première formule', // MT
  },
  help_g_tier_steps: {
    en: 'Open Tiers and click New tier.\nGive it a Name and, if you like, a Description.\nEnter the Yearly price. Add a Monthly price to offer both rhythms. Leave both empty for a tier you only grant by hand — the join page shows “Price on request” and its Join button stays off.\nUnder Characteristics write one line per point — they become the bullets on the join page.\nUnder Included products set each product to Off, Included or Optional. An optional product is a tick-box extra at the door.\nSave. Drag the cards to change the order the join page shows them in. There is no delete: Archive hides a tier from the join page, Unarchive brings it back.',
    nl: 'Open Niveaus en klik op Nieuw niveau.\nGeef het een Naam en, als je wilt, een Beschrijving.\nVul de Jaarprijs in. Voeg een Maandprijs toe om beide ritmes aan te bieden. Laat beide leeg voor een niveau dat je alleen handmatig toekent — de aanmeldpagina toont dan “Prijs op aanvraag” en de aanmeldknop blijft uit.\nSchrijf onder Kenmerken één regel per punt — dat worden de opsommingstekens op de aanmeldpagina.\nZet onder Inbegrepen producten elk product op Uit, Inbegrepen of Optioneel. Een optioneel product is een aanvinkbare extra bij het aanmelden.\nOpslaan. Sleep de kaarten om de volgorde op de aanmeldpagina te veranderen. Verwijderen kan niet: Archiveren haalt een niveau van de aanmeldpagina, Uit archief halen zet het terug.',
    es: 'Abre Niveles y haz clic en Nuevo nivel.\nDale un Nombre y, si quieres, una Descripción.\nIntroduce el Precio anual. Añade un Precio mensual para ofrecer ambos ritmos. Deja los dos vacíos para un nivel que solo concedes a mano — la página de inscripción muestra “Precio a consultar” y su botón de alta queda desactivado.\nEn Características escribe una línea por punto — se convierten en las viñetas de la página de inscripción.\nEn Productos incluidos pon cada producto en No, Incluido u Opcional. Un producto opcional es un extra marcable al inscribirse.\nGuarda. Arrastra las tarjetas para cambiar el orden en que las muestra la página de inscripción. No se puede eliminar: Archivar quita un nivel de la página de inscripción, Desarchivar lo devuelve.', // MT
    pt: 'Abra Níveis e clique em Novo nível.\nDê um Nome e, se quiser, uma Descrição.\nInforme o Preço anual. Adicione um Preço mensal para oferecer os dois ritmos. Deixe ambos vazios para um nível que você só concede manualmente — a página de adesão mostra “Preço sob consulta” e o botão de adesão fica desativado.\nEm Características escreva uma linha por ponto — elas viram os marcadores na página de adesão.\nEm Produtos incluídos defina cada produto como Não, Incluído ou Opcional. Um produto opcional é um extra marcável na adesão.\nSalve. Arraste os cartões para mudar a ordem em que a página de adesão os mostra. Não há exclusão: Arquivar tira um nível da página de adesão, Desarquivar o traz de volta.', // MT
    de: 'Öffne Stufen und klicke auf Neue Stufe.\nGib ihr einen Namen und, wenn du willst, eine Beschreibung.\nTrage den Jahrespreis ein. Ergänze einen Monatspreis, um beide Rhythmen anzubieten. Lass beide leer für eine Stufe, die du nur von Hand vergibst — die Beitrittsseite zeigt dann „Preis auf Anfrage“ und der Beitritts-Button bleibt aus.\nSchreibe unter Merkmale eine Zeile pro Punkt — sie werden die Aufzählungspunkte auf der Beitrittsseite.\nSetze unter Enthaltene Produkte jedes Produkt auf Aus, Enthalten oder Optional. Ein optionales Produkt ist ein ankreuzbares Extra beim Beitritt.\nSpeichern. Ziehe die Karten, um die Reihenfolge auf der Beitrittsseite zu ändern. Löschen gibt es nicht: Archivieren nimmt eine Stufe von der Beitrittsseite, Aus dem Archiv holen bringt sie zurück.', // MT
    fr: 'Ouvre Formules et clique sur Nouvelle formule.\nDonne-lui un Nom et, si tu veux, une Description.\nSaisis le Prix annuel. Ajoute un Prix mensuel pour proposer les deux rythmes. Laisse les deux vides pour une formule que tu accordes seulement à la main — la page d’adhésion affiche « Prix sur demande » et son bouton d’adhésion reste inactif.\nSous Caractéristiques, écris une ligne par point — elles deviennent les puces de la page d’adhésion.\nSous Produits inclus, mets chaque produit sur Non, Inclus ou En option. Un produit en option est un extra à cocher à l’adhésion.\nEnregistre. Fais glisser les cartes pour changer l’ordre d’affichage sur la page d’adhésion. Pas de suppression : Archiver retire une formule de la page d’adhésion, Désarchiver la remet.', // MT
  },
  help_g_product_title: {
    en: 'Build a product and say what it unlocks',
    nl: 'Maak een product en zeg wat het ontgrendelt',
    es: 'Crea un producto y define lo que desbloquea', // MT
    pt: 'Crie um produto e defina o que ele desbloqueia', // MT
    de: 'Lege ein Produkt an und sag, was es freischaltet', // MT
    fr: 'Créer un produit et dire ce qu’il débloque', // MT
  },
  help_g_product_steps: {
    en: 'Open Products and click New product. Give it a Name; leave the Price empty when it is only ever included in a tier.\nSet a price and its rhythm (One-time, Per month, Per year) when it is sold separately, and tick “Can be bought on its own” to put a Buy button on the join page.\nUnder Links click Add link and pick what the product points at: a Thread (chosen from your list), a Meet, a Circle space or a URL. Every link needs its middle field — an empty one stops the save.\nSave, then open the product again: Access appears once the product exists.\nUnder Access choose the kind — Circle space (paste the Space ID), Thread (pick it from the list), Fibre seat (Organiser or Admin) or Google account — and click Add access. Each access row saves at once.\nA tier that includes this product grants everything listed under Access. Fibre seats are billed on your workspace subscription.',
    nl: 'Open Producten en klik op Nieuw product. Geef het een Naam; laat de Prijs leeg als het alleen inbegrepen zit in een niveau.\nZet een prijs en het ritme (Eenmalig, Per maand, Per jaar) als het los verkocht wordt, en vink “Los te koop” aan voor een koopknop op de aanmeldpagina.\nKlik onder Links op Link toevoegen en kies waar het product naar wijst: een Thread (uit je lijst), een Meet, een Circle-space of een URL. Elke link heeft zijn middelste veld nodig — een leeg veld houdt het opslaan tegen.\nOpslaan, en open het product opnieuw: Toegang verschijnt zodra het product bestaat.\nKies onder Toegang de soort — Circle-space (plak de Space-ID), Thread (kies uit de lijst), Fibre-plek (Organisator of Beheerder) of Google-account — en klik op Toegang toevoegen. Elke toegangsregel wordt direct opgeslagen.\nEen niveau dat dit product bevat, kent alles toe wat onder Toegang staat. Fibre-plekken worden gefactureerd op je werkruimte-abonnement.',
    es: 'Abre Productos y haz clic en Nuevo producto. Dale un Nombre; deja el Precio vacío cuando solo va incluido en un nivel.\nPon un precio y su ritmo (Una vez, Al mes, Al año) cuando se venda por separado, y marca “Se puede comprar por separado” para mostrar un botón de compra en la página de inscripción.\nEn Enlaces haz clic en Añadir enlace y elige a qué apunta el producto: un Thread (elegido de tu lista), un Meet, un espacio de Circle o una URL. Cada enlace necesita su campo central — uno vacío detiene el guardado.\nGuarda y vuelve a abrir el producto: Acceso aparece cuando el producto ya existe.\nEn Acceso elige el tipo — espacio de Circle (pega el ID del espacio), Thread (elígelo de la lista), plaza de Fibre (organizador o administrador) o cuenta de Google — y haz clic en Añadir acceso. Cada fila de acceso se guarda al instante.\nUn nivel que incluye este producto concede todo lo que aparece en Acceso. Las plazas de Fibre se facturan en la suscripción de tu espacio de trabajo.', // MT
    pt: 'Abra Produtos e clique em Novo produto. Dê um Nome; deixe o Preço vazio quando ele só vem incluído em um nível.\nDefina um preço e seu ritmo (Uma vez, Por mês, Por ano) quando for vendido separadamente, e marque “Pode ser comprado separadamente” para mostrar um botão de compra na página de adesão.\nEm Links clique em Adicionar link e escolha para onde o produto aponta: um Thread (escolhido da sua lista), um Meet, um espaço do Circle ou uma URL. Todo link precisa do campo do meio — um vazio impede o salvamento.\nSalve e abra o produto de novo: Acesso aparece quando o produto já existe.\nEm Acesso escolha o tipo — espaço do Circle (cole o ID do espaço), Thread (escolha da lista), assento Fibre (organizador ou administrador) ou conta Google — e clique em Adicionar acesso. Cada linha de acesso é salva na hora.\nUm nível que inclui este produto concede tudo o que está em Acesso. Assentos Fibre são cobrados na assinatura do seu workspace.', // MT
    de: 'Öffne Produkte und klicke auf Neues Produkt. Gib ihm einen Namen; lass den Preis leer, wenn es nur in einer Stufe enthalten ist.\nSetze einen Preis und seinen Rhythmus (Einmalig, Pro Monat, Pro Jahr), wenn es einzeln verkauft wird, und hake „Einzeln kaufbar“ an für einen Kaufen-Button auf der Beitrittsseite.\nKlicke unter Links auf Link hinzufügen und wähle, worauf das Produkt zeigt: einen Thread (aus deiner Liste), ein Meet, einen Circle-Space oder eine URL. Jeder Link braucht sein mittleres Feld — ein leeres stoppt das Speichern.\nSpeichern, dann das Produkt erneut öffnen: Zugriff erscheint, sobald das Produkt existiert.\nWähle unter Zugriff die Art — Circle-Space (Space-ID einfügen), Thread (aus der Liste wählen), Fibre-Platz (Organisator oder Admin) oder Google-Konto — und klicke auf Zugriff hinzufügen. Jede Zugriffszeile wird sofort gespeichert.\nEine Stufe, die dieses Produkt enthält, gewährt alles unter Zugriff. Fibre-Plätze werden über dein Workspace-Abo abgerechnet.', // MT
    fr: 'Ouvre Produits et clique sur Nouveau produit. Donne-lui un Nom ; laisse le Prix vide s’il est seulement inclus dans une formule.\nFixe un prix et son rythme (Une fois, Par mois, Par an) s’il est vendu séparément, et coche « Peut être acheté seul » pour afficher un bouton d’achat sur la page d’adhésion.\nSous Liens, clique sur Ajouter un lien et choisis ce que le produit désigne : un Thread (choisi dans ta liste), un Meet, un espace Circle ou une URL. Chaque lien a besoin de son champ central — un champ vide bloque l’enregistrement.\nEnregistre, puis rouvre le produit : Accès apparaît une fois que le produit existe.\nSous Accès, choisis le type — espace Circle (colle l’ID de l’espace), Thread (choisi dans la liste), place Fibre (organisateur ou admin) ou compte Google — et clique sur Ajouter un accès. Chaque ligne d’accès s’enregistre aussitôt.\nUne formule qui inclut ce produit accorde tout ce qui figure sous Accès. Les places Fibre sont facturées sur l’abonnement de ton espace de travail.', // MT
  },
  help_g_integrations_title: {
    en: 'Connect Circle, Google Workspace and Fibre seats',
    nl: 'Verbind Circle, Google Workspace en Fibre-plekken',
    es: 'Conecta Circle, Google Workspace y las plazas de Fibre', // MT
    pt: 'Conecte Circle, Google Workspace e assentos Fibre', // MT
    de: 'Circle, Google Workspace und Fibre-Plätze verbinden', // MT
    fr: 'Connecter Circle, Google Workspace et les places Fibre', // MT
  },
  help_g_integrations_steps: {
    en: 'Open Settings from your avatar menu, then Integrations. This page is for workspace admins.\nCircle: enter the Community URL, paste an API token and Save. The token is stored server-side and never shown again; Remove token disconnects.\nGoogle Workspace: enter the admin email that is impersonated, paste the service-account key (JSON) and Save. Membership only pauses and reactivates accounts — it never creates or deletes them.\nThe Fibre: under “When a tier grants a seat” choose Wait for approval or Automatic, decide whether seats above your plan allowance may be billed, and click Save seat policy.\nWithout a Circle token, Circle access stays pending — Access status shows a warning until you add one.',
    nl: 'Open Instellingen via je avatarmenu, dan Integraties. Deze pagina is voor werkruimte-beheerders.\nCircle: vul de Community-URL in, plak een API-token en klik op Opslaan. Het token wordt op de server bewaard en nooit meer getoond; Token verwijderen koppelt los.\nGoogle Workspace: vul het beheerders-e-mailadres in dat wordt nagedaan, plak de service-accountsleutel (JSON) en klik op Opslaan. Lidmaatschap pauzeert en heractiveert alleen accounts — het maakt of verwijdert ze nooit.\nThe Fibre: kies onder “Als een niveau een plek toekent” voor Wachten op goedkeuring of Automatisch, bepaal of plekken boven je planlimiet gefactureerd mogen worden en klik op Plekkenbeleid opslaan.\nZonder Circle-token blijft Circle-toegang in afwachting — Toegangsstatus toont een waarschuwing tot je er een toevoegt.',
    es: 'Abre Ajustes desde el menú de tu avatar y luego Integraciones. Esta página es para administradores del espacio de trabajo.\nCircle: introduce la URL de la comunidad, pega un token de API y Guarda. El token se guarda en el servidor y no vuelve a mostrarse; Quitar token desconecta.\nGoogle Workspace: introduce el correo del administrador que se suplanta, pega la clave de la cuenta de servicio (JSON) y Guarda. La membresía solo pausa y reactiva cuentas — nunca las crea ni las elimina.\nThe Fibre: en “Cuando un nivel concede una plaza” elige Esperar aprobación o Automático, decide si las plazas por encima del cupo del plan pueden facturarse y haz clic en Guardar política de plazas.\nSin token de Circle, el acceso a Circle queda pendiente — Estado de acceso muestra un aviso hasta que añadas uno.', // MT
    pt: 'Abra Configurações no menu do seu avatar e depois Integrações. Esta página é para administradores do workspace.\nCircle: informe a URL da comunidade, cole um token de API e Salve. O token fica guardado no servidor e nunca mais é mostrado; Remover token desconecta.\nGoogle Workspace: informe o e-mail do administrador que é personificado, cole a chave da conta de serviço (JSON) e Salve. A associação só pausa e reativa contas — nunca as cria nem exclui.\nThe Fibre: em “Quando um nível concede um assento” escolha Aguardar aprovação ou Automático, decida se assentos acima da cota do plano podem ser cobrados e clique em Salvar política de assentos.\nSem token do Circle, o acesso ao Circle fica pendente — Status de acesso mostra um aviso até você adicionar um.', // MT
    de: 'Öffne Einstellungen über dein Avatar-Menü, dann Integrationen. Diese Seite ist für Workspace-Admins.\nCircle: Community-URL eintragen, API-Token einfügen, Speichern. Das Token liegt serverseitig und wird nie wieder angezeigt; Token entfernen trennt die Verbindung.\nGoogle Workspace: die Admin-E-Mail eintragen, die impersoniert wird, den Service-Account-Schlüssel (JSON) einfügen, Speichern. Die Mitgliedschaft pausiert und reaktiviert Konten nur — sie erstellt oder löscht nie welche.\nThe Fibre: unter „Wenn eine Stufe einen Platz gewährt“ Auf Freigabe warten oder Automatisch wählen, festlegen, ob Plätze über dem Plan-Kontingent abgerechnet werden dürfen, und auf Platzrichtlinie speichern klicken.\nOhne Circle-Token bleibt Circle-Zugriff ausstehend — der Zugriffsstatus zeigt eine Warnung, bis du eines hinzufügst.', // MT
    fr: 'Ouvre Paramètres depuis le menu de ton avatar, puis Intégrations. Cette page est réservée aux admins de l’espace de travail.\nCircle : saisis l’URL de la communauté, colle un token d’API et Enregistre. Le token est stocké côté serveur et jamais réaffiché ; Retirer le token déconnecte.\nGoogle Workspace : saisis l’e-mail admin qui est emprunté, colle la clé du compte de service (JSON) et Enregistre. L’adhésion ne fait que suspendre et réactiver des comptes — elle n’en crée ni n’en supprime jamais.\nThe Fibre : sous « Quand une formule accorde une place », choisis Attendre l’approbation ou Automatique, décide si les places au-delà du quota du plan peuvent être facturées, puis clique sur Enregistrer la politique de places.\nSans token Circle, l’accès Circle reste en attente — l’État des accès affiche un avertissement jusqu’à ce que tu en ajoutes un.', // MT
  },
  help_g_join_title: {
    en: 'Set up the join page and share it',
    nl: 'Richt de aanmeldpagina in en deel haar',
    es: 'Configura la página de inscripción y compártela', // MT
    pt: 'Configure a página de adesão e compartilhe', // MT
    de: 'Die Beitrittsseite einrichten und teilen', // MT
    fr: 'Préparer la page d’adhésion et la partager', // MT
  },
  help_g_join_steps: {
    en: 'Open Settings → Join page. Write the Headline and Intro, pick the Public page language (the language of the join page, embeds and member emails) and Save.\nCard payments need the workspace’s Stripe account: Settings → Payments, in the workspace section. A membership is sold by the community, not by a person.\nAdd at least one priced tier — the join page lists every tier that is not archived.\nFind the link under View join page on the Members home screen and send it around.\nA visitor picks a tier, Yearly or Monthly when both exist, ticks optional extras, enters name and email and pays in Stripe Checkout. They become an Active member and their access is granted automatically.',
    nl: 'Open Instellingen → Aanmeldpagina. Schrijf de Kop en Intro, kies de Taal van de openbare pagina (de taal van de aanmeldpagina, embeds en e-mails aan leden) en klik op Opslaan.\nKaartbetalingen hebben het Stripe-account van de werkruimte nodig: Instellingen → Betalingen, in het werkruimte-deel. Een lidmaatschap wordt verkocht door de community, niet door een persoon.\nVoeg minstens één niveau met prijs toe — de aanmeldpagina toont elk niveau dat niet gearchiveerd is.\nJe vindt de link onder Bekijk aanmeldpagina op het startscherm van Leden. Stuur hem rond.\nEen bezoeker kiest een niveau, Jaarlijks of Maandelijks als beide bestaan, vinkt optionele extra’s aan, vult naam en e-mail in en betaalt in Stripe Checkout. Hij of zij wordt een Actief lid en de toegang wordt automatisch toegekend.',
    es: 'Abre Ajustes → Página de inscripción. Escribe el Titular y la Introducción, elige el Idioma de la página pública (el idioma de la página de inscripción, los embeds y los correos a miembros) y Guarda.\nLos pagos con tarjeta necesitan la cuenta de Stripe del espacio de trabajo: Ajustes → Pagos, en la sección del espacio de trabajo. Una membresía la vende la comunidad, no una persona.\nAñade al menos un nivel con precio — la página de inscripción muestra todos los niveles no archivados.\nEncuentra el enlace en Ver página de alta en la pantalla de inicio de Miembros y compártelo.\nUn visitante elige un nivel, Anual o Mensual cuando existen ambos, marca los extras opcionales, introduce nombre y correo y paga en Stripe Checkout. Pasa a ser miembro Activo y su acceso se concede automáticamente.', // MT
    pt: 'Abra Configurações → Página de adesão. Escreva o Título e a Introdução, escolha o Idioma da página pública (o idioma da página de adesão, dos embeds e dos e-mails aos membros) e Salve.\nPagamentos com cartão precisam da conta Stripe do workspace: Configurações → Pagamentos, na seção do workspace. Uma associação é vendida pela comunidade, não por uma pessoa.\nAdicione pelo menos um nível com preço — a página de adesão lista todos os níveis não arquivados.\nEncontre o link em Ver página de adesão na tela inicial de Membros e compartilhe.\nUm visitante escolhe um nível, Anual ou Mensal quando os dois existem, marca extras opcionais, informa nome e e-mail e paga no Stripe Checkout. Ele vira membro Ativo e seu acesso é concedido automaticamente.', // MT
    de: 'Öffne Einstellungen → Beitrittsseite. Schreibe Überschrift und Intro, wähle die Sprache der öffentlichen Seite (die Sprache der Beitrittsseite, der Embeds und der Mitglieder-E-Mails) und Speichern.\nKartenzahlungen brauchen das Stripe-Konto des Workspace: Einstellungen → Zahlungen, im Workspace-Bereich. Eine Mitgliedschaft verkauft die Community, nicht eine Person.\nLege mindestens eine Stufe mit Preis an — die Beitrittsseite zeigt jede nicht archivierte Stufe.\nDen Link findest du unter Beitrittsseite ansehen auf dem Startbildschirm von Mitglieder. Verschicke ihn.\nEin Besucher wählt eine Stufe, Jährlich oder Monatlich, wenn es beides gibt, hakt optionale Extras an, gibt Name und E-Mail ein und zahlt im Stripe Checkout. Er wird aktives Mitglied und sein Zugriff wird automatisch gewährt.', // MT
    fr: 'Ouvre Paramètres → Page d’adhésion. Rédige le Titre et l’Intro, choisis la Langue de la page publique (celle de la page d’adhésion, des intégrations web et des e-mails aux membres) et Enregistre.\nLes paiements par carte ont besoin du compte Stripe de l’espace de travail : Paramètres → Paiements, dans la section de l’espace de travail. Une adhésion est vendue par la communauté, pas par une personne.\nAjoute au moins une formule avec un prix — la page d’adhésion affiche toutes les formules non archivées.\nTrouve le lien sous Voir la page d’adhésion sur l’écran d’accueil de Membres et diffuse-le.\nUn visiteur choisit une formule, Annuel ou Mensuel quand les deux existent, coche les extras en option, saisit nom et e-mail et paie dans Stripe Checkout. Il devient membre Actif et ses accès sont accordés automatiquement.', // MT
  },
  help_g_add_member_title: {
    en: 'Add a member by hand (invoice or comped)',
    nl: 'Voeg handmatig een lid toe (factuur of gratis)',
    es: 'Añade un miembro a mano (factura o gratis)', // MT
    pt: 'Adicione um membro manualmente (fatura ou cortesia)', // MT
    de: 'Ein Mitglied von Hand hinzufügen (Rechnung oder kostenlos)', // MT
    fr: 'Ajouter un membre à la main (facture ou offert)', // MT
  },
  help_g_add_member_steps: {
    en: 'Open Members and click Add member. Choose Person or Organisation.\nSearch your contacts by name or email, or click “Create … as a new contact” and fill in the name and email address (phone and address are optional).\nPick the Country if you use pricing rules, and a VAT number if the member has one.\nChoose the Tier, then the billing: Invoice creates a pending invoice and emails it — with a Pay button when payments are configured; Comped is free, no invoice. A tier without a price can only be comped.\nChoose Yearly or Monthly when the tier has both prices. Leave “Send an invitation email” on to welcome them with a link to their member page.\nLeave Renews on blank for one period from today — a tier without a price renews yearly. Save. For an organisation set the Seat allowance: the invoice is the tier price × seats, and you add people to the seats from the member afterwards.',
    nl: 'Open Leden en klik op Lid toevoegen. Kies Persoon of Organisatie.\nZoek je contacten op naam of e-mail, of klik op “Maak … aan als nieuw contact” en vul naam en e-mailadres in (telefoon en adres zijn optioneel).\nKies het Land als je prijsregels gebruikt, en een btw-nummer als het lid er een heeft.\nKies het Niveau en dan de facturering: Invoice maakt een openstaande factuur en mailt die — met een betaalknop als betalingen zijn ingesteld; Comped is gratis, zonder factuur. Een niveau zonder prijs kan alleen gratis.\nKies Jaarlijks of Maandelijks als het niveau beide prijzen heeft. Laat “Stuur een uitnodigingsmail” aan om ze te verwelkomen met een link naar hun ledenpagina.\nLaat Verlengt op leeg voor één periode vanaf vandaag — een niveau zonder prijs verlengt jaarlijks. Opslaan. Stel voor een organisatie het Aantal plekken in: de factuur is de niveauprijs × plekken, en je zet daarna mensen op de plekken vanuit het lid.',
    es: 'Abre Miembros y haz clic en Añadir miembro. Elige Persona u Organización.\nBusca en tus contactos por nombre o correo, o haz clic en “Crear … como nuevo contacto” y rellena el nombre y el correo (teléfono y dirección son opcionales).\nElige el País si usas reglas de precios, y un número de IVA si el miembro lo tiene.\nElige el Nivel y luego la facturación: Invoice crea una factura pendiente y la envía por correo — con un botón de pago cuando los pagos están configurados; Comped es gratis, sin factura. Un nivel sin precio solo puede ser gratis.\nElige Anual o Mensual cuando el nivel tenga ambos precios. Deja activado “Enviar un correo de invitación” para darles la bienvenida con un enlace a su página de miembro.\nDeja “Se renueva el” vacío para un periodo desde hoy — un nivel sin precio se renueva cada año. Guarda. Para una organización fija el Cupo de plazas: la factura es el precio del nivel × plazas, y luego asignas personas a las plazas desde el miembro.', // MT
    pt: 'Abra Membros e clique em Adicionar membro. Escolha Pessoa ou Organização.\nBusque seus contatos por nome ou e-mail, ou clique em “Criar … como novo contato” e preencha nome e e-mail (telefone e endereço são opcionais).\nEscolha o País se você usa regras de preço, e um número de IVA se o membro tiver.\nEscolha o Nível e depois a cobrança: Invoice cria uma fatura pendente e a envia por e-mail — com um botão de pagamento quando os pagamentos estão configurados; Comped é grátis, sem fatura. Um nível sem preço só pode ser cortesia.\nEscolha Anual ou Mensal quando o nível tiver os dois preços. Deixe “Enviar um e-mail de convite” ligado para dar as boas-vindas com um link para a página do membro.\nDeixe “Renova em” vazio para um período a partir de hoje — um nível sem preço renova anualmente. Salve. Para uma organização defina a Cota de assentos: a fatura é o preço do nível × assentos, e depois você coloca pessoas nos assentos a partir do membro.', // MT
    de: 'Öffne Mitglieder und klicke auf Mitglied hinzufügen. Wähle Person oder Organisation.\nSuche deine Kontakte nach Name oder E-Mail, oder klicke auf „… als neuen Kontakt anlegen“ und trage Name und E-Mail-Adresse ein (Telefon und Adresse sind optional).\nWähle das Land, wenn du Preisregeln nutzt, und eine USt-IdNr., wenn das Mitglied eine hat.\nWähle die Stufe, dann die Abrechnung: Invoice erstellt eine offene Rechnung und mailt sie — mit Bezahlen-Button, wenn Zahlungen eingerichtet sind; Comped ist kostenlos, ohne Rechnung. Eine Stufe ohne Preis geht nur kostenlos.\nWähle Jährlich oder Monatlich, wenn die Stufe beide Preise hat. Lass „Eine Einladungs-E-Mail senden“ an, um sie mit einem Link zu ihrer Mitgliederseite zu begrüßen.\nLass „Verlängert sich am“ leer für eine Periode ab heute — eine Stufe ohne Preis verlängert sich jährlich. Speichern. Für eine Organisation setzt du das Platzkontingent: die Rechnung ist Stufenpreis × Plätze, und die Personen setzt du danach vom Mitglied aus auf die Plätze.', // MT
    fr: 'Ouvre Membres et clique sur Ajouter un membre. Choisis Personne ou Organisation.\nCherche dans tes contacts par nom ou e-mail, ou clique sur « Créer … comme nouveau contact » et renseigne le nom et l’adresse e-mail (téléphone et adresse sont facultatifs).\nChoisis le Pays si tu utilises des règles de prix, et un numéro de TVA si le membre en a un.\nChoisis la Formule, puis la facturation : Invoice crée une facture en attente et l’envoie par e-mail — avec un bouton Payer quand les paiements sont configurés ; Comped est gratuit, sans facture. Une formule sans prix ne peut être qu’offerte.\nChoisis Annuel ou Mensuel quand la formule a les deux prix. Laisse « Envoyer un e-mail d’invitation » activé pour les accueillir avec un lien vers leur page de membre.\nLaisse « Se renouvelle le » vide pour une période à partir d’aujourd’hui — une formule sans prix se renouvelle chaque année. Enregistre. Pour une organisation, fixe le Quota de places : la facture est le prix de la formule × places, et tu places ensuite les personnes depuis le membre.', // MT
  },
  help_g_manage_member_title: {
    en: 'Change a member’s tier, status, renewal or seats',
    nl: 'Wijzig niveau, status, verlenging of plekken van een lid',
    es: 'Cambia el nivel, estado, renovación o plazas de un miembro', // MT
    pt: 'Altere nível, status, renovação ou assentos de um membro', // MT
    de: 'Stufe, Status, Verlängerung oder Plätze eines Mitglieds ändern', // MT
    fr: 'Modifier la formule, le statut, le renouvellement ou les places d’un membre', // MT
  },
  help_g_manage_member_steps: {
    en: 'Open Members. Filter with All, Active, Grace, Lapsed and Cancelled, the tier list or the search box, then click the row.\nChange the Tier, the Status or the Renews on date and Save. Notes are for you only.\nCountry is self-declared and drives the pricing rules; changing it reprices a card subscription from the next renewal, never mid-cycle.\nFor an organisation raise the Seat allowance and add people under Seats by searching their name; Remove frees a seat. Lowering the allowance never removes anyone — it only blocks new seats.\nAccess sync at the bottom shows each grant as granted, pending, awaiting approval, revoked or error. Click Approve seat to let a waiting Fibre seat through.\nMembers you added by hand move to Grace when their renewal date passes and to Lapsed 14 days later, which revokes their access. Active members get a reminder email 14 days before renewal.',
    nl: 'Open Leden. Filter met Alle, Actief, Respijt, Verlopen en Opgezegd, de niveaulijst of het zoekveld, en klik op de rij.\nWijzig het Niveau, de Status of de datum Verlengt op en klik op Opslaan. Notities zijn alleen voor jou.\nLand is zelf opgegeven en stuurt de prijsregels; een wijziging herprijst een kaartabonnement vanaf de volgende verlenging, nooit halverwege.\nVerhoog voor een organisatie het Aantal plekken en voeg onder Plekken mensen toe door hun naam te zoeken; Verwijderen maakt een plek vrij. Het aantal verlagen verwijdert niemand — het blokkeert alleen nieuwe plekken.\nToegangssynchronisatie onderaan toont elke toekenning als toegekend, in afwachting, wacht op goedkeuring, ingetrokken of fout. Klik op Plek goedkeuren om een wachtende Fibre-plek door te laten.\nHandmatig toegevoegde leden gaan naar Respijt als hun verlengdatum voorbij is en 14 dagen later naar Verlopen, wat hun toegang intrekt. Actieve leden krijgen 14 dagen vóór de verlenging een herinneringsmail.',
    es: 'Abre Miembros. Filtra con Todos, Activo, Gracia, Vencido y Cancelado, la lista de niveles o el buscador, y haz clic en la fila.\nCambia el Nivel, el Estado o la fecha “Se renueva el” y Guarda. Las Notas son solo para ti.\nEl País lo declara el propio miembro y determina las reglas de precios; cambiarlo vuelve a calcular una suscripción con tarjeta desde la próxima renovación, nunca a mitad de ciclo.\nPara una organización, sube el Cupo de plazas y añade personas en Plazas buscando su nombre; Quitar libera una plaza. Bajar el cupo no quita a nadie — solo bloquea plazas nuevas.\nSincronización de acceso, al final, muestra cada concesión como concedida, pendiente, esperando aprobación, revocada o error. Haz clic en Aprobar plaza para dejar pasar una plaza de Fibre en espera.\nLos miembros añadidos a mano pasan a Gracia cuando vence su fecha de renovación y a Vencido 14 días después, lo que revoca su acceso. Los miembros activos reciben un recordatorio por correo 14 días antes de la renovación.', // MT
    pt: 'Abra Membros. Filtre com Todos, Ativo, Carência, Expirado e Cancelado, a lista de níveis ou a busca, e clique na linha.\nAltere o Nível, o Status ou a data “Renova em” e Salve. Notas são só para você.\nO País é declarado pelo próprio membro e comanda as regras de preço; mudá-lo reprecifica uma assinatura com cartão a partir da próxima renovação, nunca no meio do ciclo.\nPara uma organização, aumente a Cota de assentos e adicione pessoas em Assentos buscando o nome; Remover libera um assento. Baixar a cota não remove ninguém — só bloqueia novos assentos.\nSincronização de acesso, no fim, mostra cada concessão como concedida, pendente, aguardando aprovação, revogada ou erro. Clique em Aprovar assento para liberar um assento Fibre em espera.\nMembros adicionados manualmente passam a Carência quando a data de renovação passa e a Expirado 14 dias depois, o que revoga o acesso. Membros ativos recebem um lembrete por e-mail 14 dias antes da renovação.', // MT
    de: 'Öffne Mitglieder. Filtere mit Alle, Aktiv, Nachfrist, Abgelaufen und Gekündigt, der Stufenliste oder dem Suchfeld, und klicke auf die Zeile.\nÄndere Stufe, Status oder das Datum „Verlängert sich am“ und Speichern. Notizen sind nur für dich.\nDas Land ist selbst angegeben und steuert die Preisregeln; eine Änderung bepreist ein Karten-Abo ab der nächsten Verlängerung neu, nie mitten im Zyklus.\nFür eine Organisation erhöhst du das Platzkontingent und fügst unter Plätze Personen per Namenssuche hinzu; Entfernen gibt einen Platz frei. Ein kleineres Kontingent entfernt niemanden — es blockiert nur neue Plätze.\nZugriffs-Sync ganz unten zeigt jede Gewährung als gewährt, ausstehend, wartet auf Freigabe, entzogen oder Fehler. Klicke auf Platz freigeben, um einen wartenden Fibre-Platz durchzulassen.\nVon Hand hinzugefügte Mitglieder wechseln nach dem Verlängerungsdatum in die Nachfrist und 14 Tage später auf Abgelaufen, was ihren Zugriff entzieht. Aktive Mitglieder bekommen 14 Tage vor der Verlängerung eine Erinnerungs-E-Mail.', // MT
    fr: 'Ouvre Membres. Filtre avec Tous, Actif, Grâce, Expiré et Annulé, la liste des formules ou la recherche, puis clique sur la ligne.\nModifie la Formule, le Statut ou la date « Se renouvelle le » et Enregistre. Les Notes ne sont que pour toi.\nLe Pays est déclaré par le membre et pilote les règles de prix ; le changer recalcule un abonnement par carte à partir du prochain renouvellement, jamais en cours de cycle.\nPour une organisation, augmente le Quota de places et ajoute des personnes sous Places en cherchant leur nom ; Retirer libère une place. Baisser le quota ne retire personne — cela bloque seulement de nouvelles places.\nLa Synchronisation des accès, en bas, montre chaque accès comme accordé, en attente, en attente d’approbation, révoqué ou en erreur. Clique sur Approuver la place pour laisser passer une place Fibre en attente.\nLes membres ajoutés à la main passent en Grâce quand leur date de renouvellement est dépassée et en Expiré 14 jours plus tard, ce qui révoque leurs accès. Les membres actifs reçoivent un rappel par e-mail 14 jours avant le renouvellement.', // MT
  },
  help_g_access_title: {
    en: 'Check that access really went through',
    nl: 'Controleer of de toegang echt is doorgekomen',
    es: 'Comprueba que el acceso realmente se aplicó', // MT
    pt: 'Confira se o acesso realmente foi aplicado', // MT
    de: 'Prüfen, ob der Zugriff wirklich angekommen ist', // MT
    fr: 'Vérifier que l’accès a bien été appliqué', // MT
  },
  help_g_access_steps: {
    en: 'Open Members and click Access status.\nThe page lists every grant grouped by what it unlocks. Access lives on products; tier-level rows are legacy — move them onto a product.\nAccess syncs on a five-minute tick: Circle invitations, Fibre seats, Google accounts and Thread enrolments. A Thread grant enrols the member in that thread; when they lapse the enrolment is marked dropped, never deleted.\nCircle grants need the API token from Settings → Integrations — the page warns while it is missing.\nA grant cannot be edited: open it, Delete, and add a new one on the product.\nSomeone who bought a product on its own keeps that product’s access when their membership lapses.',
    nl: 'Open Leden en klik op Toegangsstatus.\nDe pagina toont elke toekenning, gegroepeerd per wat ze ontgrendelt. Toegang hoort bij producten; regels op niveau-niveau zijn verouderd — verplaats ze naar een product.\nToegang synchroniseert elke vijf minuten: Circle-uitnodigingen, Fibre-plekken, Google-accounts en Thread-inschrijvingen. Een Thread-toekenning schrijft het lid in voor die thread; bij verlopen wordt de inschrijving als afgehaakt gemarkeerd, nooit verwijderd.\nCircle-toekenningen hebben het API-token uit Instellingen → Integraties nodig — de pagina waarschuwt zolang het ontbreekt.\nEen toekenning kun je niet bewerken: open haar, klik op Verwijderen en voeg een nieuwe toe op het product.\nWie een product los heeft gekocht, houdt de toegang van dat product als het lidmaatschap verloopt.',
    es: 'Abre Miembros y haz clic en Estado de acceso.\nLa página lista cada concesión agrupada por lo que desbloquea. El acceso vive en los productos; las filas a nivel de nivel son antiguas — muévelas a un producto.\nEl acceso se sincroniza cada cinco minutos: invitaciones de Circle, plazas de Fibre, cuentas de Google e inscripciones en Threads. Una concesión de Thread inscribe al miembro en ese thread; cuando vence, la inscripción se marca como abandonada, nunca se borra.\nLas concesiones de Circle necesitan el token de API de Ajustes → Integraciones — la página avisa mientras falte.\nUna concesión no se puede editar: ábrela, Eliminar, y añade una nueva en el producto.\nQuien compró un producto por separado conserva el acceso de ese producto cuando vence su membresía.', // MT
    pt: 'Abra Membros e clique em Status de acesso.\nA página lista cada concessão agrupada pelo que desbloqueia. O acesso mora nos produtos; linhas no nível do nível são antigas — mova-as para um produto.\nO acesso sincroniza a cada cinco minutos: convites do Circle, assentos Fibre, contas Google e inscrições em Threads. Uma concessão de Thread inscreve o membro naquele thread; quando expira, a inscrição é marcada como desistente, nunca excluída.\nConcessões do Circle precisam do token de API em Configurações → Integrações — a página avisa enquanto ele faltar.\nUma concessão não pode ser editada: abra-a, Excluir, e adicione uma nova no produto.\nQuem comprou um produto separadamente mantém o acesso desse produto quando a associação expira.', // MT
    de: 'Öffne Mitglieder und klicke auf Zugriffsstatus.\nDie Seite listet jede Gewährung, gruppiert nach dem, was sie freischaltet. Zugriff gehört zu Produkten; Zeilen auf Stufenebene sind Altbestand — verschiebe sie auf ein Produkt.\nZugriff synchronisiert im Fünf-Minuten-Takt: Circle-Einladungen, Fibre-Plätze, Google-Konten und Thread-Anmeldungen. Eine Thread-Gewährung meldet das Mitglied für diesen Thread an; läuft es ab, wird die Anmeldung als ausgestiegen markiert, nie gelöscht.\nCircle-Gewährungen brauchen das API-Token aus Einstellungen → Integrationen — die Seite warnt, solange es fehlt.\nEine Gewährung lässt sich nicht bearbeiten: öffnen, Löschen, und eine neue am Produkt hinzufügen.\nWer ein Produkt einzeln gekauft hat, behält den Zugriff dieses Produkts, wenn die Mitgliedschaft abläuft.', // MT
    fr: 'Ouvre Membres et clique sur État des accès.\nLa page liste chaque accès groupé par ce qu’il débloque. L’accès vit sur les produits ; les lignes au niveau des formules sont anciennes — déplace-les sur un produit.\nLes accès se synchronisent toutes les cinq minutes : invitations Circle, places Fibre, comptes Google et inscriptions aux Threads. Un accès Thread inscrit le membre à ce thread ; à l’expiration, l’inscription est marquée abandonnée, jamais supprimée.\nLes accès Circle ont besoin du token d’API de Paramètres → Intégrations — la page avertit tant qu’il manque.\nUn accès ne se modifie pas : ouvre-le, Supprimer, et ajoute-en un nouveau sur le produit.\nQuelqu’un qui a acheté un produit seul garde l’accès de ce produit quand son adhésion expire.', // MT
  },
  help_g_invoices_title: {
    en: 'Follow up invoices and payments',
    nl: 'Volg facturen en betalingen op',
    es: 'Haz seguimiento de facturas y pagos', // MT
    pt: 'Acompanhe faturas e pagamentos', // MT
    de: 'Rechnungen und Zahlungen nachhalten', // MT
    fr: 'Suivre les factures et les paiements', // MT
  },
  help_g_invoices_steps: {
    en: 'Open Invoices. Admins see the whole Workspace; use the app chips and the search box to find a purchase.\nOpen a purchase to act on it: Mark paid when a bank transfer arrived, Send payment link to let them pay by card, Resend invoice, or Reimburse.\nMembers find their own invoices on their member page (the link in the invitation email), with Download for the PDF and Manage payment for a card subscription. Comped and invoiced members see that payment is managed by the community.\nMembership invoices are issued by the workspace — check the legal name, address and VAT settings under Settings → Payments.',
    nl: 'Open Facturen. Beheerders zien de hele Werkruimte; gebruik de app-chips en het zoekveld om een aankoop te vinden.\nOpen een aankoop om iets te doen: Markeer als betaald als een overschrijving is binnengekomen, Betaallink versturen om met kaart te laten betalen, Factuur opnieuw versturen, of Terugbetalen.\nLeden vinden hun eigen facturen op hun ledenpagina (de link in de uitnodigingsmail), met Downloaden voor de pdf en Betaling beheren voor een kaartabonnement. Gratis en gefactureerde leden zien dat de betaling door de community wordt geregeld.\nLidmaatschapsfacturen worden uitgegeven door de werkruimte — controleer de juridische naam, het adres en de btw-instellingen onder Instellingen → Betalingen.',
    es: 'Abre Facturas. Los administradores ven todo el Espacio de trabajo; usa las fichas de app y el buscador para encontrar una compra.\nAbre una compra para actuar: Marcar como pagado cuando llegó una transferencia, Enviar enlace de pago para que paguen con tarjeta, Reenviar factura, o Reembolsar.\nLos miembros encuentran sus propias facturas en su página de miembro (el enlace del correo de invitación), con Descargar para el PDF y Gestionar pago para una suscripción con tarjeta. Los miembros gratis y facturados ven que el pago lo gestiona la comunidad.\nLas facturas de membresía las emite el espacio de trabajo — revisa el nombre legal, la dirección y los ajustes de IVA en Ajustes → Pagos.', // MT
    pt: 'Abra Faturas. Administradores veem todo o Workspace; use os chips de app e a busca para achar uma compra.\nAbra uma compra para agir: Marcar como pago quando uma transferência chegou, Enviar link de pagamento para pagarem com cartão, Reenviar fatura, ou Reembolsar.\nMembros encontram as próprias faturas na página do membro (o link do e-mail de convite), com Baixar para o PDF e Gerenciar pagamento para uma assinatura com cartão. Membros de cortesia e faturados veem que o pagamento é gerido pela comunidade.\nFaturas de associação são emitidas pelo workspace — confira nome legal, endereço e configurações de IVA em Configurações → Pagamentos.', // MT
    de: 'Öffne Rechnungen. Admins sehen den ganzen Workspace; nutze die App-Chips und das Suchfeld, um einen Kauf zu finden.\nÖffne einen Kauf, um zu handeln: Als bezahlt markieren, wenn eine Überweisung eingegangen ist, Zahlungslink senden für Kartenzahlung, Rechnung erneut senden, oder Erstatten.\nMitglieder finden ihre Rechnungen auf ihrer Mitgliederseite (der Link in der Einladungs-E-Mail), mit Herunterladen für das PDF und Zahlung verwalten für ein Karten-Abo. Kostenlose und per Rechnung abgerechnete Mitglieder sehen, dass die Zahlung von der Community verwaltet wird.\nMitgliedschaftsrechnungen stellt der Workspace aus — prüfe rechtlichen Namen, Adresse und USt-Einstellungen unter Einstellungen → Zahlungen.', // MT
    fr: 'Ouvre Factures. Les admins voient tout l’Espace de travail ; utilise les puces d’app et la recherche pour trouver un achat.\nOuvre un achat pour agir : Marquer comme payé quand un virement est arrivé, Envoyer le lien de paiement pour un paiement par carte, Renvoyer la facture, ou Rembourser.\nLes membres trouvent leurs propres factures sur leur page de membre (le lien de l’e-mail d’invitation), avec Télécharger pour le PDF et Gérer le paiement pour un abonnement par carte. Les membres offerts et facturés voient que le paiement est géré par la communauté.\nLes factures d’adhésion sont émises par l’espace de travail — vérifie le nom légal, l’adresse et les réglages de TVA sous Paramètres → Paiements.', // MT
  },
  help_g_pricing_title: {
    en: 'Adjust prices by country or billing rhythm',
    nl: 'Pas prijzen aan per land of betaalritme',
    es: 'Ajusta los precios por país o ritmo de facturación', // MT
    pt: 'Ajuste preços por país ou ritmo de cobrança', // MT
    de: 'Preise nach Land oder Zahlungsrhythmus anpassen', // MT
    fr: 'Ajuster les prix par pays ou rythme de facturation', // MT
  },
  help_g_pricing_steps: {
    en: 'Open Settings → Pricing rules and click Add rule.\nSet the condition — when country is one of (add countries) or when billing interval is one of Yearly / Monthly — and the price as a percentage of the tier price (75 means 75%).\nOrder matters: the first matching rule wins. Set “When no rule matches → price” for everyone else, then Save pricing rules.\nThe join page asks visitors for their country only when a country rule exists. The country is self-declared, never guessed from an IP address.\nCheckout recomputes the price server-side. A card issued in another country than declared sends the admins a heads-up and never blocks the join.\nPricing rules apply to tiers; products bought on their own keep their flat price.',
    nl: 'Open Instellingen → Prijsregels en klik op Regel toevoegen.\nStel de voorwaarde in — als land een van (voeg landen toe) of als betaalinterval een van Jaarlijks / Maandelijks is — en de prijs als percentage van de niveauprijs (75 betekent 75%).\nVolgorde telt: de eerste passende regel wint. Stel “Als geen regel past → prijs” in voor de rest en klik op Prijsregels opslaan.\nDe aanmeldpagina vraagt bezoekers alleen om hun land als er een landregel bestaat. Het land is zelf opgegeven, nooit geraden uit een IP-adres.\nDe kassa herberekent de prijs op de server. Een kaart uit een ander land dan opgegeven stuurt de beheerders een seintje en blokkeert de aanmelding nooit.\nPrijsregels gelden voor niveaus; los gekochte producten houden hun vaste prijs.',
    es: 'Abre Ajustes → Reglas de precios y haz clic en Añadir regla.\nDefine la condición — cuando país es uno de (añade países) o cuando intervalo de facturación es uno de Anual / Mensual — y el precio como porcentaje del precio del nivel (75 significa 75%).\nEl orden importa: gana la primera regla que coincide. Fija “Cuando ninguna regla coincide → precio” para el resto y haz clic en Guardar reglas de precios.\nLa página de inscripción solo pregunta el país cuando existe una regla por país. El país lo declara el visitante, nunca se adivina por la IP.\nEl pago recalcula el precio en el servidor. Una tarjeta emitida en otro país que el declarado avisa a los administradores y nunca bloquea la inscripción.\nLas reglas de precios se aplican a los niveles; los productos comprados por separado mantienen su precio fijo.', // MT
    pt: 'Abra Configurações → Regras de preço e clique em Adicionar regra.\nDefina a condição — quando país é um de (adicione países) ou quando intervalo de cobrança é um de Anual / Mensal — e o preço como porcentagem do preço do nível (75 significa 75%).\nA ordem importa: a primeira regra que combina vence. Defina “Quando nenhuma regra combina → preço” para os demais e clique em Salvar regras de preço.\nA página de adesão só pergunta o país quando existe uma regra por país. O país é declarado pelo visitante, nunca adivinhado pelo IP.\nO checkout recalcula o preço no servidor. Um cartão emitido em outro país que o declarado avisa os administradores e nunca bloqueia a adesão.\nRegras de preço valem para níveis; produtos comprados separadamente mantêm o preço fixo.', // MT
    de: 'Öffne Einstellungen → Preisregeln und klicke auf Regel hinzufügen.\nSetze die Bedingung — wenn Land eines von (Länder hinzufügen) oder wenn Abrechnungsintervall eines von Jährlich / Monatlich ist — und den Preis als Prozent des Stufenpreises (75 heißt 75 %).\nDie Reihenfolge zählt: die erste passende Regel gewinnt. Setze „Wenn keine Regel passt → Preis“ für alle anderen und klicke auf Preisregeln speichern.\nDie Beitrittsseite fragt Besucher nur nach dem Land, wenn eine Länderregel existiert. Das Land ist selbst angegeben, nie aus einer IP-Adresse geraten.\nDer Checkout berechnet den Preis serverseitig neu. Eine Karte aus einem anderen Land als angegeben schickt den Admins einen Hinweis und blockiert den Beitritt nie.\nPreisregeln gelten für Stufen; einzeln gekaufte Produkte behalten ihren festen Preis.', // MT
    fr: 'Ouvre Paramètres → Règles de prix et clique sur Ajouter une règle.\nDéfinis la condition — quand pays est l’un de (ajoute des pays) ou quand intervalle de facturation est l’un de Annuel / Mensuel — et le prix en pourcentage du prix de la formule (75 signifie 75 %).\nL’ordre compte : la première règle qui correspond gagne. Règle « Quand aucune règle ne correspond → prix » pour tous les autres, puis Enregistrer les règles de prix.\nLa page d’adhésion ne demande le pays aux visiteurs que si une règle par pays existe. Le pays est déclaré, jamais deviné depuis une adresse IP.\nLe paiement recalcule le prix côté serveur. Une carte émise dans un autre pays que celui déclaré envoie un signal aux admins et ne bloque jamais l’adhésion.\nLes règles de prix s’appliquent aux formules ; les produits achetés seuls gardent leur prix fixe.', // MT
  },
  help_g_embeds_title: {
    en: 'Put the membership on your own website',
    nl: 'Zet het lidmaatschap op je eigen website',
    es: 'Pon la membresía en tu propia web', // MT
    pt: 'Coloque a associação no seu próprio site', // MT
    de: 'Die Mitgliedschaft auf deine eigene Website bringen', // MT
    fr: 'Mettre l’adhésion sur ton propre site', // MT
  },
  help_g_embeds_steps: {
    en: 'Open Settings → Website embeds.\nChoose what to embed: Whole page, Tier cards, Popup (joining opens in an overlay above your page) or Join button.\nPick the Language — Automatic follows the workspace’s — and, for the popup and the button, the Button text.\nCopy step 1 once per site into the <head> (or before </body>) and step 2 where the embed should appear — or take the all-in-one snippet.\nTo restyle, put a <style> block inside the embed div and target the me-* classes (me-card, me-title, me-price, me-btn). It is lifted into the embed and never touches your page.\nCheckout always opens outside the frame — Stripe refuses to be embedded.',
    nl: 'Open Instellingen → Website-embeds.\nKies wat je wilt insluiten: Hele pagina, Niveaukaarten, Pop-up (aanmelden opent in een laag boven je pagina) of Aanmeldknop.\nKies de Taal — Automatisch volgt die van de werkruimte — en voor de pop-up en de knop de Knoptekst.\nKopieer stap 1 één keer per site in de <head> (of vóór </body>) en stap 2 waar de embed moet verschijnen — of neem de alles-in-één-snippet.\nOm te restylen zet je een <style>-blok in de embed-div en richt je je op de me-*-klassen (me-card, me-title, me-price, me-btn). Het wordt in de embed getild en raakt je pagina nooit.\nDe kassa opent altijd buiten het frame — Stripe laat zich niet insluiten.',
    es: 'Abre Ajustes → Embeds para tu web.\nElige qué incrustar: Página completa, Tarjetas de niveles, Ventana emergente (la inscripción se abre en una capa sobre tu página) o Botón de alta.\nElige el Idioma — Automático sigue el del espacio de trabajo — y, para la ventana y el botón, el Texto del botón.\nCopia el paso 1 una vez por sitio en el <head> (o antes de </body>) y el paso 2 donde deba aparecer el embed — o toma el fragmento todo en uno.\nPara cambiar el estilo, pon un bloque <style> dentro del div del embed y apunta a las clases me-* (me-card, me-title, me-price, me-btn). Se traslada al embed y nunca toca tu página.\nEl pago siempre se abre fuera del marco — Stripe no permite incrustarse.', // MT
    pt: 'Abra Configurações → Embeds para seu site.\nEscolha o que incorporar: Página inteira, Cartões de níveis, Janela pop-up (a adesão abre numa camada sobre a sua página) ou Botão de adesão.\nEscolha o Idioma — Automático segue o do workspace — e, para o pop-up e o botão, o Texto do botão.\nCopie o passo 1 uma vez por site no <head> (ou antes de </body>) e o passo 2 onde o embed deve aparecer — ou pegue o trecho tudo-em-um.\nPara reestilizar, coloque um bloco <style> dentro da div do embed e mire nas classes me-* (me-card, me-title, me-price, me-btn). Ele é levado para dentro do embed e nunca toca a sua página.\nO checkout sempre abre fora do frame — o Stripe se recusa a ser incorporado.', // MT
    de: 'Öffne Einstellungen → Website-Embeds.\nWähle, was du einbetten willst: Ganze Seite, Stufenkarten, Pop-up (der Beitritt öffnet sich in einer Ebene über deiner Seite) oder Beitrittsbutton.\nWähle die Sprache — Automatisch folgt der des Workspace — und für Pop-up und Button den Button-Text.\nKopiere Schritt 1 einmal pro Site in den <head> (oder vor </body>) und Schritt 2 dorthin, wo das Embed erscheinen soll — oder nimm das Alles-in-einem-Snippet.\nZum Umgestalten setzt du einen <style>-Block in das Embed-Div und sprichst die me-*-Klassen an (me-card, me-title, me-price, me-btn). Er wird ins Embed gehoben und berührt deine Seite nie.\nDer Checkout öffnet sich immer außerhalb des Frames — Stripe lässt sich nicht einbetten.', // MT
    fr: 'Ouvre Paramètres → Intégrations web.\nChoisis quoi intégrer : Page entière, Cartes de formules, Fenêtre pop-up (l’adhésion s’ouvre dans un calque au-dessus de ta page) ou Bouton d’adhésion.\nChoisis la Langue — Automatique suit celle de l’espace de travail — et, pour le pop-up et le bouton, le Texte du bouton.\nCopie l’étape 1 une fois par site dans le <head> (ou avant </body>) et l’étape 2 là où l’intégration doit apparaître — ou prends l’extrait tout-en-un.\nPour changer le style, place un bloc <style> dans la div d’intégration et cible les classes me-* (me-card, me-title, me-price, me-btn). Il est déplacé dans l’intégration et ne touche jamais ta page.\nLe paiement s’ouvre toujours hors du cadre — Stripe refuse d’être intégré.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
