// The Fibre platform web — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string a signed-in user can see in the Fibre web interface
// lives HERE, in all locales. The locale list itself lives in
// @thefibre/shared/i18n (one definition for the whole platform); the catalog
// stays per-surface, next to its consumers. The catalog is typed so a key
// missing a translation fails `pnpm typecheck` — that is how the list stays
// complete as the product grows. Default locale: en.
//
// Register is informal (je / du / tú / você / tu). Dutch entries are native
// quality; es / pt / de / fr are machine-drafted (marked // MT) pending
// native review. Portuguese leans Brazilian (você, gerunds).
//
// Chrome only: page titles, field LABELS, buttons, empty states, dialogs and
// toasts ARE translated; user CONTENT (names, notes, org data, curator field
// VALUES) is never translated. Product/brand terms stay untranslated
// everywhere: "The Fibre", app names (Meet, Thread, Flow, Pulse, Membership),
// role names (Super Admin, Admin, Organiser) and technical identifiers.
// /admin/** (super-admin surfaces) deliberately stays English —
// "Internal/admin UI stays English until a paying non-EN workspace asks"
// (packages/shared/src/i18n.ts).

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
  save_changes: {
    en: 'Save changes',
    nl: 'Wijzigingen opslaan',
    es: 'Guardar cambios', // MT
    pt: 'Salvar alterações', // MT
    de: 'Änderungen speichern', // MT
    fr: 'Enregistrer les modifications', // MT
  },
  saving: {
    en: 'Saving…',
    nl: 'Opslaan…',
    es: 'Guardando…', // MT
    pt: 'Salvando…', // MT
    de: 'Wird gespeichert…', // MT
    fr: 'Enregistrement…', // MT
  },
  saved_notice: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
  },
  could_not_save: {
    en: 'Could not save',
    nl: 'Opslaan is niet gelukt',
    es: 'No se pudo guardar', // MT
    pt: 'Não foi possível salvar', // MT
    de: 'Speichern fehlgeschlagen', // MT
    fr: "Impossible d'enregistrer", // MT
  },
  edit: {
    en: 'Edit',
    nl: 'Bewerken',
    es: 'Editar', // MT
    pt: 'Editar', // MT
    de: 'Bearbeiten', // MT
    fr: 'Modifier', // MT
  },
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
  working: {
    en: 'Working…',
    nl: 'Bezig…',
    es: 'Procesando…', // MT
    pt: 'Processando…', // MT
    de: 'Wird ausgeführt…', // MT
    fr: 'En cours…', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  optional: {
    en: 'Optional',
    nl: 'Optioneel',
    es: 'Opcional', // MT
    pt: 'Opcional', // MT
    de: 'Optional', // MT
    fr: 'Facultatif', // MT
  },
  yes: {
    en: 'Yes',
    nl: 'Ja',
    es: 'Sí', // MT
    pt: 'Sim', // MT
    de: 'Ja', // MT
    fr: 'Oui', // MT
  },
  no: {
    en: 'No',
    nl: 'Nee',
    es: 'No', // MT
    pt: 'Não', // MT
    de: 'Nein', // MT
    fr: 'Non', // MT
  },
  none: {
    en: 'None.',
    nl: 'Geen.',
    es: 'Ninguna.', // MT
    pt: 'Nenhuma.', // MT
    de: 'Keine.', // MT
    fr: 'Aucune.', // MT
  },
  or: {
    en: 'or',
    nl: 'of',
    es: 'o', // MT
    pt: 'ou', // MT
    de: 'oder', // MT
    fr: 'ou', // MT
  },
  with: {
    en: 'with',
    nl: 'met',
    es: 'con', // MT
    pt: 'com', // MT
    de: 'mit', // MT
    fr: 'avec', // MT
  },
  from: {
    en: 'from',
    nl: 'vanaf',
    es: 'desde', // MT
    pt: 'a partir de', // MT
    de: 'ab', // MT
    fr: 'à partir du', // MT
  },
  until: {
    en: 'until',
    nl: 'tot',
    es: 'hasta', // MT
    pt: 'até', // MT
    de: 'bis', // MT
    fr: "jusqu'au", // MT
  },
  open: {
    en: 'Open',
    nl: 'Openen',
    es: 'Abrir', // MT
    pt: 'Abrir', // MT
    de: 'Öffnen', // MT
    fr: 'Ouvrir', // MT
  },
  view: {
    en: 'View',
    nl: 'Bekijken',
    es: 'Ver', // MT
    pt: 'Ver', // MT
    de: 'Ansehen', // MT
    fr: 'Voir', // MT
  },
  manage: {
    en: 'Manage',
    nl: 'Beheren',
    es: 'Gestionar', // MT
    pt: 'Gerenciar', // MT
    de: 'Verwalten', // MT
    fr: 'Gérer', // MT
  },
  see_all: {
    en: 'See all',
    nl: 'Alles bekijken',
    es: 'Ver todo', // MT
    pt: 'Ver tudo', // MT
    de: 'Alle ansehen', // MT
    fr: 'Tout voir', // MT
  },
  apply: {
    en: 'Apply',
    nl: 'Toepassen',
    es: 'Aplicar', // MT
    pt: 'Aplicar', // MT
    de: 'Anwenden', // MT
    fr: 'Appliquer', // MT
  },
  clear: {
    en: 'Clear',
    nl: 'Wissen',
    es: 'Limpiar', // MT
    pt: 'Limpar', // MT
    de: 'Zurücksetzen', // MT
    fr: 'Effacer', // MT
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
    en: 'Copied!',
    nl: 'Gekopieerd!',
    es: '¡Copiado!', // MT
    pt: 'Copiado!', // MT
    de: 'Kopiert!', // MT
    fr: 'Copié !', // MT
  },
  try_again: {
    en: 'Try again.',
    nl: 'Probeer het opnieuw.',
    es: 'Inténtalo de nuevo.', // MT
    pt: 'Tente de novo.', // MT
    de: 'Versuch es noch einmal.', // MT
    fr: 'Réessaie.', // MT
  },
  load_failed: {
    en: "Couldn't load:",
    nl: 'Kon niet laden:',
    es: 'No se pudo cargar:', // MT
    pt: 'Não foi possível carregar:', // MT
    de: 'Konnte nicht geladen werden:', // MT
    fr: 'Chargement impossible :', // MT
  },
  nothing_yet: {
    en: 'Nothing yet.',
    nl: 'Nog niets.',
    es: 'Aún nada.', // MT
    pt: 'Nada ainda.', // MT
    de: 'Noch nichts.', // MT
    fr: 'Rien pour le moment.', // MT
  },
  nothing_recorded_yet: {
    en: 'Nothing recorded yet. Click Edit to fill it in.',
    nl: 'Nog niets vastgelegd. Klik op Bewerken om het in te vullen.',
    es: 'Aún no hay nada registrado. Haz clic en Editar para completarlo.', // MT
    pt: 'Nada registrado ainda. Clique em Editar para preencher.', // MT
    de: 'Noch nichts erfasst. Klicke auf Bearbeiten, um es auszufüllen.', // MT
    fr: 'Rien de saisi pour le moment. Clique sur Modifier pour compléter.', // MT
  },
  comma_separated: {
    en: 'Comma-separated',
    nl: 'Kommagescheiden',
    es: 'Separado por comas', // MT
    pt: 'Separado por vírgulas', // MT
    de: 'Kommagetrennt', // MT
    fr: 'Séparé par des virgules', // MT
  },
  unnamed: {
    en: 'Unnamed',
    nl: 'Naamloos',
    es: 'Sin nombre', // MT
    pt: 'Sem nome', // MT
    de: 'Ohne Namen', // MT
    fr: 'Sans nom', // MT
  },
  overview: {
    en: 'Overview',
    nl: 'Overzicht',
    es: 'Resumen', // MT
    pt: 'Visão geral', // MT
    de: 'Übersicht', // MT
    fr: "Vue d'ensemble", // MT
  },
  timeline: {
    en: 'Timeline',
    nl: 'Tijdlijn',
    es: 'Cronología', // MT
    pt: 'Linha do tempo', // MT
    de: 'Zeitleiste', // MT
    fr: 'Chronologie', // MT
  },
  status: {
    en: 'Status',
    nl: 'Status',
    es: 'Estado', // MT
    pt: 'Status', // MT
    de: 'Status', // MT
    fr: 'Statut', // MT
  },
  type: {
    en: 'Type',
    nl: 'Type',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Typ', // MT
    fr: 'Type', // MT
  },
  notes: {
    en: 'Notes',
    nl: 'Notities',
    es: 'Notas', // MT
    pt: 'Notas', // MT
    de: 'Notizen', // MT
    fr: 'Notes', // MT
  },
  notes_optional: {
    en: 'Notes (optional)',
    nl: 'Notities (optioneel)',
    es: 'Notas (opcional)', // MT
    pt: 'Notas (opcional)', // MT
    de: 'Notizen (optional)', // MT
    fr: 'Notes (facultatif)', // MT
  },
  sensitive: {
    en: 'Sensitive',
    nl: 'Gevoelig',
    es: 'Sensible', // MT
    pt: 'Sensível', // MT
    de: 'Sensibel', // MT
    fr: 'Sensible', // MT
  },
  created: {
    en: 'Created',
    nl: 'Aangemaakt',
    es: 'Creado', // MT
    pt: 'Criado', // MT
    de: 'Erstellt', // MT
    fr: 'Créé', // MT
  },
  creating: {
    en: 'Creating…',
    nl: 'Aanmaken…',
    es: 'Creando…', // MT
    pt: 'Criando…', // MT
    de: 'Wird erstellt…', // MT
    fr: 'Création…', // MT
  },
  cancelled: {
    en: 'Cancelled',
    nl: 'Geannuleerd',
    es: 'Cancelado', // MT
    pt: 'Cancelado', // MT
    de: 'Storniert', // MT
    fr: 'Annulé', // MT
  },
  pending: {
    en: 'Pending',
    nl: 'In afwachting',
    es: 'Pendiente', // MT
    pt: 'Pendente', // MT
    de: 'Ausstehend', // MT
    fr: 'En attente', // MT
  },
  confirmed: {
    en: 'Confirmed',
    nl: 'Bevestigd',
    es: 'Confirmado', // MT
    pt: 'Confirmado', // MT
    de: 'Bestätigt', // MT
    fr: 'Confirmé', // MT
  },
  present: {
    en: 'present',
    nl: 'heden',
    es: 'actualidad', // MT
    pt: 'presente', // MT
    de: 'heute', // MT
    fr: "aujourd'hui", // MT
  },

  // ── nav (mirrors components/shell/sidebar.tsx NAV + admin sections) ───
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  nav_contacts: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contatos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  nav_organisations: {
    en: 'Organisations',
    nl: 'Organisaties',
    es: 'Organizaciones', // MT
    pt: 'Organizações', // MT
    de: 'Organisationen', // MT
    fr: 'Organisations', // MT
  },
  nav_contact_graph: {
    en: 'Contact graph',
    nl: 'Contactennetwerk',
    es: 'Red de contactos', // MT
    pt: 'Rede de contatos', // MT
    de: 'Kontaktgraph', // MT
    fr: 'Réseau de contacts', // MT
  },
  nav_programmes: {
    en: 'Programmes',
    nl: "Programma's",
    es: 'Programas', // MT
    pt: 'Programas', // MT
    de: 'Programme', // MT
    fr: 'Programmes', // MT
  },
  nav_activity: {
    en: 'Activity',
    nl: 'Activiteit',
    es: 'Actividad', // MT
    pt: 'Atividade', // MT
    de: 'Aktivität', // MT
    fr: 'Activité', // MT
  },
  nav_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  nav_privacy: {
    en: 'Privacy',
    nl: 'Privacy',
    es: 'Privacidad', // MT
    pt: 'Privacidade', // MT
    de: 'Datenschutz', // MT
    fr: 'Confidentialité', // MT
  },
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  nav_apps: {
    en: 'Apps',
    nl: 'Apps',
    es: 'Apps', // MT
    pt: 'Apps', // MT
    de: 'Apps', // MT
    fr: 'Apps', // MT
  },
  nav_admin: {
    en: 'Admin',
    nl: 'Beheer',
    es: 'Administración', // MT
    pt: 'Administração', // MT
    de: 'Verwaltung', // MT
    fr: 'Administration', // MT
  },
  nav_access_requests: {
    en: 'Access requests',
    nl: 'Toegangsverzoeken',
    es: 'Solicitudes de acceso', // MT
    pt: 'Solicitações de acesso', // MT
    de: 'Zugriffsanfragen', // MT
    fr: "Demandes d'accès", // MT
  },
  nav_workspaces: {
    en: 'Workspaces',
    nl: 'Werkruimtes',
    es: 'Espacios de trabajo', // MT
    pt: 'Espaços de trabalho', // MT
    de: 'Workspaces', // MT
    fr: 'Espaces de travail', // MT
  },
  nav_plans: {
    en: 'Plans',
    nl: 'Abonnementen',
    es: 'Planes', // MT
    pt: 'Planos', // MT
    de: 'Tarife', // MT
    fr: 'Formules', // MT
  },
  nav_economics: {
    en: 'Economics',
    nl: 'Economie',
    es: 'Economía', // MT
    pt: 'Economia', // MT
    de: 'Ökonomie', // MT
    fr: 'Économie', // MT
  },
  nav_invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  nav_vat: {
    en: 'VAT',
    nl: 'Btw',
    es: 'IVA', // MT
    pt: 'IVA', // MT
    de: 'MwSt.', // MT
    fr: 'TVA', // MT
  },
  nav_app_registry: {
    en: 'App registry',
    nl: 'App-register',
    es: 'Registro de apps', // MT
    pt: 'Registro de apps', // MT
    de: 'App-Register', // MT
    fr: "Registre d'apps", // MT
  },
  // ── settings hub + workspace ──────────────────────────────────────────
  settings_blurb: {
    en: 'You, the workspace, and the platform. The same sections in every Fibre app.',
    nl: 'Jij, de werkruimte en het platform. Dezelfde secties in elke Fibre-app.',
    es: 'Tú, el espacio de trabajo y la plataforma. Las mismas secciones en cada app de Fibre.', // MT
    pt: 'Você, o espaço de trabalho e a plataforma. As mesmas seções em cada app do Fibre.', // MT
    de: 'Du, der Workspace und die Plattform. Dieselben Abschnitte in jeder Fibre-App.', // MT
    fr: "Toi, l'espace de travail et la plateforme. Les mêmes sections dans chaque app Fibre.", // MT
  },
  workspace_page_blurb: {
    en: 'Its name, its logo, the details on its invoices, and who its email comes from.',
    nl: 'De naam, het logo, de gegevens op de facturen en van wie de e-mail komt.',
    es: 'Su nombre, su logo, los datos de sus facturas y de quién viene su correo.', // MT
    pt: 'O nome, o logo, os dados das faturas e de quem vem o e-mail.', // MT
    de: 'Name, Logo, die Angaben auf den Rechnungen und von wem die E-Mails kommen.', // MT
    fr: "Son nom, son logo, les informations de ses factures et l'expéditeur de ses e-mails.", // MT
  },
  workspace_load_failed: {
    en: "Couldn't load the workspace:",
    nl: 'Kon de werkruimte niet laden:',
    es: 'No se pudo cargar el espacio de trabajo:', // MT
    pt: 'Não foi possível carregar o espaço de trabalho:', // MT
    de: 'Workspace konnte nicht geladen werden:', // MT
    fr: "Impossible de charger l'espace de travail :", // MT
  },
  workspace_needs_name: {
    en: 'A workspace needs a name.',
    nl: 'Een werkruimte heeft een naam nodig.',
    es: 'Un espacio de trabajo necesita un nombre.', // MT
    pt: 'Um espaço de trabalho precisa de um nome.', // MT
    de: 'Ein Workspace braucht einen Namen.', // MT
    fr: "Un espace de travail a besoin d'un nom.", // MT
  },
  address_label: {
    en: 'Address',
    nl: 'Adres',
    es: 'Dirección', // MT
    pt: 'Endereço', // MT
    de: 'Adresse', // MT
    fr: 'Adresse', // MT
  },
  logo: {
    en: 'Logo',
    nl: 'Logo',
    es: 'Logo', // MT
    pt: 'Logo', // MT
    de: 'Logo', // MT
    fr: 'Logo', // MT
  },
  logo_hint: {
    en: "Shown at the top of email this workspace sends, in place of The Fibre's.",
    nl: 'Staat bovenaan de e-mail die deze werkruimte verstuurt, in plaats van die van The Fibre.',
    es: 'Se muestra arriba de los correos que envía este espacio de trabajo, en lugar del de The Fibre.', // MT
    pt: 'Aparece no topo dos e-mails que este espaço de trabalho envia, no lugar do The Fibre.', // MT
    de: 'Erscheint oben in den E-Mails dieses Workspaces, anstelle des Fibre-Logos.', // MT
    fr: "Affiché en haut des e-mails envoyés par cet espace de travail, à la place de celui de The Fibre.", // MT
  },
  on_your_invoices: {
    en: 'On your invoices',
    nl: 'Op je facturen',
    es: 'En tus facturas', // MT
    pt: 'Nas suas faturas', // MT
    de: 'Auf deinen Rechnungen', // MT
    fr: 'Sur tes factures', // MT
  },
  legal_name: {
    en: 'Legal name',
    nl: 'Juridische naam',
    es: 'Razón social', // MT
    pt: 'Razão social', // MT
    de: 'Firmenname', // MT
    fr: 'Raison sociale', // MT
  },
  legal_name_ph: {
    en: 'Your organisation B.V.',
    nl: 'Jouw organisatie B.V.',
    es: 'Tu organización S.L.', // MT
    pt: 'Sua organização Ltda.', // MT
    de: 'Deine Organisation GmbH', // MT
    fr: 'Ton organisation SARL', // MT
  },
  legal_name_hint: {
    en: 'The entity that sells, if it differs from the name above.',
    nl: 'De entiteit die verkoopt, als die afwijkt van de naam hierboven.',
    es: 'La entidad que vende, si difiere del nombre de arriba.', // MT
    pt: 'A entidade que vende, se for diferente do nome acima.', // MT
    de: 'Die verkaufende Entität, falls sie vom obigen Namen abweicht.', // MT
    fr: "L'entité qui vend, si elle diffère du nom ci-dessus.", // MT
  },
  tax_number: {
    en: 'Tax number',
    nl: 'Btw-nummer',
    es: 'Número fiscal', // MT
    pt: 'Número fiscal', // MT
    de: 'Steuernummer', // MT
    fr: 'Numéro fiscal', // MT
  },
  email_label: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  sender_name: {
    en: 'Sender name',
    nl: 'Naam afzender',
    es: 'Nombre del remitente', // MT
    pt: 'Nome do remetente', // MT
    de: 'Absendername', // MT
    fr: "Nom de l'expéditeur", // MT
  },
  sender_name_hint: {
    en: 'What an inbox shows. Free — the address behind it can stay ours.',
    nl: 'Wat een inbox laat zien. Gratis — het adres erachter mag het onze blijven.',
    es: 'Lo que muestra una bandeja de entrada. Gratis: la dirección detrás puede seguir siendo la nuestra.', // MT
    pt: 'O que a caixa de entrada mostra. Grátis — o endereço por trás pode continuar sendo o nosso.', // MT
    de: 'Was ein Posteingang anzeigt. Kostenlos — die Adresse dahinter kann unsere bleiben.', // MT
    fr: "Ce qu'affiche une boîte de réception. Gratuit — l'adresse derrière peut rester la nôtre.", // MT
  },
  replies_go_to: {
    en: 'Replies go to',
    nl: 'Antwoorden gaan naar',
    es: 'Las respuestas van a', // MT
    pt: 'As respostas vão para', // MT
    de: 'Antworten gehen an', // MT
    fr: 'Les réponses vont à', // MT
  },
  sender_address: {
    en: 'Sender address',
    nl: 'Afzenderadres',
    es: 'Dirección del remitente', // MT
    pt: 'Endereço do remetente', // MT
    de: 'Absenderadresse', // MT
    fr: "Adresse de l'expéditeur", // MT
  },
  sender_address_hint: {
    en: 'Your own domain needs SPF and DKIM records on it. Until they are verified, email still goes out — from our address, with your name.',
    nl: 'Je eigen domein heeft SPF- en DKIM-records nodig. Tot die geverifieerd zijn, gaat e-mail gewoon uit — vanaf ons adres, met jouw naam.',
    es: 'Tu propio dominio necesita registros SPF y DKIM. Hasta que se verifiquen, el correo sigue saliendo, desde nuestra dirección y con tu nombre.', // MT
    pt: 'Seu próprio domínio precisa de registros SPF e DKIM. Até serem verificados, o e-mail continua saindo — do nosso endereço, com o seu nome.', // MT
    de: 'Deine eigene Domain braucht SPF- und DKIM-Einträge. Bis sie verifiziert sind, gehen E-Mails trotzdem raus — von unserer Adresse, mit deinem Namen.', // MT
    fr: "Ton propre domaine a besoin d'enregistrements SPF et DKIM. En attendant leur vérification, les e-mails partent quand même — depuis notre adresse, avec ton nom.", // MT
  },
  enrolment_note_label: {
    en: 'Your words in the enrolment emails',
    nl: 'Jouw woorden in de inschrijfmails',
    es: 'Tus palabras en los correos de inscripción', // MT
    pt: 'Suas palavras nos e-mails de inscrição', // MT
    de: 'Deine Worte in den Anmelde-E-Mails', // MT
    fr: "Tes mots dans les e-mails d'inscription", // MT
  },
  enrolment_note_hint: {
    en: 'Shown inside the emails Thread sends when someone registers. A single event can override it.',
    nl: 'Staat in de e-mails die Thread verstuurt als iemand zich aanmeldt. Eén los evenement kan het overschrijven.',
    es: 'Aparece en los correos que envía Thread cuando alguien se registra. Un evento concreto puede sustituirlo.', // MT
    pt: 'Aparece nos e-mails que o Thread envia quando alguém se registra. Um evento específico pode substituí-lo.', // MT
    de: 'Erscheint in den E-Mails, die Thread bei einer Anmeldung verschickt. Ein einzelnes Event kann es überschreiben.', // MT
    fr: "Affiché dans les e-mails que Thread envoie lors d'une inscription. Un événement précis peut le remplacer.", // MT
  },
  admin_only_change: {
    en: 'Only a workspace admin can change this.',
    nl: 'Alleen een werkruimtebeheerder kan dit wijzigen.',
    es: 'Solo un admin del espacio de trabajo puede cambiar esto.', // MT
    pt: 'Só um admin do espaço de trabalho pode mudar isto.', // MT
    de: 'Nur ein Workspace-Admin kann das ändern.', // MT
    fr: "Seul un admin de l'espace de travail peut modifier ça.", // MT
  },
  admins_only: {
    en: 'Workspace admins only.',
    nl: 'Alleen voor werkruimtebeheerders.',
    es: 'Solo para admins del espacio de trabajo.', // MT
    pt: 'Só para admins do espaço de trabalho.', // MT
    de: 'Nur für Workspace-Admins.', // MT
    fr: "Réservé aux admins de l'espace de travail.", // MT
  },

  // ── members ───────────────────────────────────────────────────────────
  members_title: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  members_blurb: {
    en: "The single place to manage who's in the workspace and which apps they can use. The apps show this — they don't edit it.",
    nl: 'Dé plek om te beheren wie er in de werkruimte zit en welke apps ze mogen gebruiken. De apps tonen dit — ze bewerken het niet.',
    es: 'El único lugar para gestionar quién está en el espacio de trabajo y qué apps puede usar. Las apps lo muestran, no lo editan.', // MT
    pt: 'O único lugar para gerenciar quem está no espaço de trabalho e quais apps pode usar. Os apps mostram isso — não editam.', // MT
    de: 'Der eine Ort, um zu verwalten, wer im Workspace ist und welche Apps er nutzen darf. Die Apps zeigen das nur an — sie bearbeiten es nicht.', // MT
    fr: "L'endroit unique pour gérer qui est dans l'espace de travail et quelles apps il peut utiliser. Les apps l'affichent — elles ne le modifient pas.", // MT
  },
  members_load_failed: {
    en: "Couldn't load members:",
    nl: 'Kon de leden niet laden:',
    es: 'No se pudieron cargar los miembros:', // MT
    pt: 'Não foi possível carregar os membros:', // MT
    de: 'Mitglieder konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les membres :', // MT
  },
  workspace_members: {
    en: 'Workspace members',
    nl: 'Leden van de werkruimte',
    es: 'Miembros del espacio de trabajo', // MT
    pt: 'Membros do espaço de trabalho', // MT
    de: 'Workspace-Mitglieder', // MT
    fr: "Membres de l'espace de travail", // MT
  },
  add_member: {
    en: 'Add member',
    nl: 'Lid toevoegen',
    es: 'Añadir miembro', // MT
    pt: 'Adicionar membro', // MT
    de: 'Mitglied hinzufügen', // MT
    fr: 'Ajouter un membre', // MT
  },
  no_members_yet: {
    en: 'No members yet.',
    nl: 'Nog geen leden.',
    es: 'Aún no hay miembros.', // MT
    pt: 'Ainda não há membros.', // MT
    de: 'Noch keine Mitglieder.', // MT
    fr: 'Pas encore de membres.', // MT
  },
  role: {
    en: 'Role',
    nl: 'Rol',
    es: 'Rol', // MT
    pt: 'Papel', // MT
    de: 'Rolle', // MT
    fr: 'Rôle', // MT
  },
  relationship: {
    en: 'Relationship',
    nl: 'Relatie',
    es: 'Relación', // MT
    pt: 'Relação', // MT
    de: 'Beziehung', // MT
    fr: 'Relation', // MT
  },
  joined: {
    en: 'Joined',
    nl: 'Lid sinds',
    es: 'Se unió', // MT
    pt: 'Entrou em', // MT
    de: 'Beigetreten', // MT
    fr: 'A rejoint', // MT
  },
  internal: {
    en: 'Internal',
    nl: 'Intern',
    es: 'Interno', // MT
    pt: 'Interno', // MT
    de: 'Intern', // MT
    fr: 'Interne', // MT
  },
  external: {
    en: 'External',
    nl: 'Extern',
    es: 'Externo', // MT
    pt: 'Externo', // MT
    de: 'Extern', // MT
    fr: 'Externe', // MT
  },
  invite_blurb: {
    en: 'Invite someone into the workspace and grant only the apps they need.',
    nl: 'Nodig iemand uit in de werkruimte en geef alleen de apps die diegene nodig heeft.',
    es: 'Invita a alguien al espacio de trabajo y concédele solo las apps que necesita.', // MT
    pt: 'Convide alguém para o espaço de trabalho e conceda só os apps de que precisa.', // MT
    de: 'Lade jemanden in den Workspace ein und gib nur die Apps frei, die er braucht.', // MT
    fr: "Invite quelqu'un dans l'espace de travail et accorde-lui uniquement les apps nécessaires.", // MT
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird gesendet…', // MT
    fr: 'Envoi…', // MT
  },
  send_invite: {
    en: 'Send invite',
    nl: 'Uitnodiging versturen',
    es: 'Enviar invitación', // MT
    pt: 'Enviar convite', // MT
    de: 'Einladung senden', // MT
    fr: "Envoyer l'invitation", // MT
  },
  confirm_send_invite: {
    en: 'Confirm and send invite',
    nl: 'Bevestigen en uitnodiging versturen',
    es: 'Confirmar y enviar invitación', // MT
    pt: 'Confirmar e enviar convite', // MT
    de: 'Bestätigen und Einladung senden', // MT
    fr: "Confirmer et envoyer l'invitation", // MT
  },
  role_member: {
    en: 'Member',
    nl: 'Lid',
    es: 'Miembro', // MT
    pt: 'Membro', // MT
    de: 'Mitglied', // MT
    fr: 'Membre', // MT
  },
  role_admin: {
    en: 'Admin',
    nl: 'Beheerder',
    es: 'Admin', // MT
    pt: 'Admin', // MT
    de: 'Admin', // MT
    fr: 'Admin', // MT
  },
  no_access_by_default: {
    en: 'No access by default — grant only what they need.',
    nl: 'Standaard geen toegang — geef alleen wat nodig is.',
    es: 'Sin acceso por defecto: concede solo lo necesario.', // MT
    pt: 'Sem acesso por padrão — conceda só o necessário.', // MT
    de: 'Standardmäßig kein Zugriff — gib nur frei, was nötig ist.', // MT
    fr: "Aucun accès par défaut — accorde uniquement le nécessaire.", // MT
  },
  seat_confirm_suffix: {
    en: 'Sending the invite confirms the extra monthly cost.',
    nl: 'Met het versturen van de uitnodiging bevestig je de extra maandelijkse kosten.',
    es: 'Al enviar la invitación confirmas el coste mensual extra.', // MT
    pt: 'Ao enviar o convite você confirma o custo mensal extra.', // MT
    de: 'Mit dem Senden der Einladung bestätigst du die monatlichen Zusatzkosten.', // MT
    fr: "L'envoi de l'invitation confirme le coût mensuel supplémentaire.", // MT
  },
  remove_ellipsis: {
    en: 'Remove…',
    nl: 'Verwijderen…',
    es: 'Quitar…', // MT
    pt: 'Remover…', // MT
    de: 'Entfernen…', // MT
    fr: 'Retirer…', // MT
  },
  remove_member: {
    en: 'Remove member',
    nl: 'Lid verwijderen',
    es: 'Quitar miembro', // MT
    pt: 'Remover membro', // MT
    de: 'Mitglied entfernen', // MT
    fr: 'Retirer le membre', // MT
  },
  remove_member_msg: {
    en: 'Remove {name} from this workspace? They lose access to the workspace and its apps; they stay in your contacts. If this seat is billed, it stops billing from the next period — the paid month runs out, with no mid-month credit.',
    nl: '{name} uit deze werkruimte verwijderen? Diegene verliest toegang tot de werkruimte en de apps, maar blijft in je contacten. Als deze plek betaald is, stopt de facturering vanaf de volgende periode — de betaalde maand loopt af, zonder tussentijdse creditering.',
    es: '¿Quitar a {name} de este espacio de trabajo? Perderá el acceso al espacio y a sus apps; seguirá en tus contactos. Si este puesto se factura, deja de facturarse desde el próximo periodo: el mes pagado se agota, sin abono a mitad de mes.', // MT
    pt: 'Remover {name} deste espaço de trabalho? A pessoa perde o acesso ao espaço e aos apps, mas continua nos seus contatos. Se este assento é cobrado, a cobrança para no próximo período — o mês pago se esgota, sem crédito no meio do mês.', // MT
    de: '{name} aus diesem Workspace entfernen? Die Person verliert den Zugriff auf den Workspace und seine Apps, bleibt aber in deinen Kontakten. Wenn dieser Platz abgerechnet wird, endet die Abrechnung zur nächsten Periode — der bezahlte Monat läuft aus, ohne anteilige Gutschrift.', // MT
    fr: "Retirer {name} de cet espace de travail ? La personne perd l'accès à l'espace et à ses apps, mais reste dans tes contacts. Si ce siège est facturé, la facturation s'arrête à la prochaine période — le mois payé s'écoule, sans avoir en cours de mois.", // MT
  },
  organiser_default: {
    en: 'Organiser (default)',
    nl: 'Organiser (standaard)',
    es: 'Organiser (predeterminado)', // MT
    pt: 'Organiser (padrão)', // MT
    de: 'Organiser (Standard)', // MT
    fr: 'Organiser (par défaut)', // MT
  },
  changes_save_immediately: {
    en: 'Changes save immediately.',
    nl: 'Wijzigingen worden direct opgeslagen.',
    es: 'Los cambios se guardan al instante.', // MT
    pt: 'As alterações são salvas na hora.', // MT
    de: 'Änderungen werden sofort gespeichert.', // MT
    fr: 'Les modifications sont enregistrées immédiatement.', // MT
  },
  // ── settings → apps ───────────────────────────────────────────────────
  apps_page_blurb: {
    en: 'Turn apps on for this workspace. Each app brings its own pages, fields and activity events.',
    nl: 'Zet apps aan voor deze werkruimte. Elke app brengt zijn eigen pagina’s, velden en activiteitsgebeurtenissen mee.',
    es: 'Activa apps para este espacio de trabajo. Cada app trae sus propias páginas, campos y eventos de actividad.', // MT
    pt: 'Ative apps para este espaço de trabalho. Cada app traz suas próprias páginas, campos e eventos de atividade.', // MT
    de: 'Schalte Apps für diesen Workspace frei. Jede App bringt eigene Seiten, Felder und Aktivitätsereignisse mit.', // MT
    fr: "Active des apps pour cet espace de travail. Chaque app apporte ses propres pages, champs et événements d'activité.", // MT
  },
  apps_load_failed: {
    en: "Couldn't load apps:",
    nl: 'Kon de apps niet laden:',
    es: 'No se pudieron cargar las apps:', // MT
    pt: 'Não foi possível carregar os apps:', // MT
    de: 'Apps konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les apps :', // MT
  },
  available: {
    en: 'Available',
    nl: 'Beschikbaar',
    es: 'Disponibles', // MT
    pt: 'Disponíveis', // MT
    de: 'Verfügbar', // MT
    fr: 'Disponibles', // MT
  },
  third_party: {
    en: 'Third party',
    nl: 'Van derden',
    es: 'De terceros', // MT
    pt: 'De terceiros', // MT
    de: 'Drittanbieter', // MT
    fr: 'Tierce partie', // MT
  },
  third_party_app: {
    en: 'Third-party app',
    nl: 'App van derden',
    es: 'App de terceros', // MT
    pt: 'App de terceiros', // MT
    de: 'Drittanbieter-App', // MT
    fr: 'App tierce', // MT
  },
  no_description: {
    en: 'No description supplied.',
    nl: 'Geen beschrijving opgegeven.',
    es: 'Sin descripción.', // MT
    pt: 'Sem descrição.', // MT
    de: 'Keine Beschreibung angegeben.', // MT
    fr: 'Aucune description fournie.', // MT
  },
  not_built_yet: {
    en: 'Not built yet',
    nl: 'Nog niet gebouwd',
    es: 'Aún no construida', // MT
    pt: 'Ainda não construído', // MT
    de: 'Noch nicht gebaut', // MT
    fr: 'Pas encore construite', // MT
  },
  not_active: {
    en: 'Not active',
    nl: 'Niet actief',
    es: 'No activa', // MT
    pt: 'Não ativo', // MT
    de: 'Nicht aktiv', // MT
    fr: 'Non active', // MT
  },
  app_status_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activa', // MT
    pt: 'Ativo', // MT
    de: 'Aktiv', // MT
    fr: 'Active', // MT
  },
  app_status_building: {
    en: 'Building',
    nl: 'In aanbouw',
    es: 'En construcción', // MT
    pt: 'Em construção', // MT
    de: 'Im Bau', // MT
    fr: 'En construction', // MT
  },
  app_status_planned: {
    en: 'Planned',
    nl: 'Gepland',
    es: 'Planificada', // MT
    pt: 'Planejado', // MT
    de: 'Geplant', // MT
    fr: 'Prévue', // MT
  },
  manage_api_keys: {
    en: 'Manage API keys',
    nl: 'API-sleutels beheren',
    es: 'Gestionar claves API', // MT
    pt: 'Gerenciar chaves de API', // MT
    de: 'API-Schlüssel verwalten', // MT
    fr: 'Gérer les clés API', // MT
  },
  app_body_meet: {
    en: 'Run gatherings end-to-end: design the agenda, facilitate live, capture outcomes and action items. Curator data (change context, system context) lives in The Fibre, gated to Meet members.',
    nl: 'Organiseer bijeenkomsten van begin tot eind: ontwerp de agenda, faciliteer live, leg uitkomsten en actiepunten vast. Curatordata (verandercontext, systeemcontext) staat in The Fibre, alleen zichtbaar voor Meet-leden.',
    es: 'Organiza encuentros de principio a fin: diseña la agenda, facilita en vivo, registra resultados y acciones. Los datos de curador (contexto de cambio, contexto de sistema) viven en The Fibre, restringidos a miembros de Meet.', // MT
    pt: 'Conduza encontros de ponta a ponta: desenhe a agenda, facilite ao vivo, registre resultados e ações. Os dados de curador (contexto de mudança, contexto de sistema) ficam no The Fibre, restritos a membros do Meet.', // MT
    de: 'Führe Zusammenkünfte von Anfang bis Ende durch: Agenda gestalten, live moderieren, Ergebnisse und Aufgaben festhalten. Kuratordaten (Veränderungskontext, Systemkontext) liegen in The Fibre, nur für Meet-Mitglieder sichtbar.', // MT
    fr: "Anime des rencontres de bout en bout : conçois l'ordre du jour, facilite en direct, capture résultats et actions. Les données de curateur (contexte de changement, contexte système) vivent dans The Fibre, réservées aux membres de Meet.", // MT
  },
  app_body_thread: {
    en: 'Multi-session programmes, conferences, post-event journeys. Writes enrolment + attendance events back to The Fibre.',
    nl: "Meerdaagse programma's, conferenties, trajecten na een evenement. Schrijft inschrijvings- en aanwezigheidsgebeurtenissen terug naar The Fibre.",
    es: 'Programas de varias sesiones, conferencias, itinerarios posteriores a eventos. Escribe eventos de inscripción y asistencia en The Fibre.', // MT
    pt: 'Programas de várias sessões, conferências, jornadas pós-evento. Grava eventos de inscrição e presença de volta no The Fibre.', // MT
    de: 'Mehrteilige Programme, Konferenzen, Journeys nach Events. Schreibt Anmelde- und Anwesenheitsereignisse zurück an The Fibre.', // MT
    fr: "Programmes multi-sessions, conférences, parcours post-événement. Écrit les événements d'inscription et de présence dans The Fibre.", // MT
  },
  app_body_flow: {
    en: 'People-flow state machines: design a journey as a visual graph, move contacts through it, gate transitions on tasks. Writes step events back to The Fibre.',
    nl: 'Stappenplannen voor mensen: ontwerp een traject als visueel schema, beweeg contacten erdoorheen, bewaak overgangen met taken. Schrijft stapgebeurtenissen terug naar The Fibre.',
    es: 'Máquinas de estados para personas: diseña un recorrido como grafo visual, mueve contactos por él, condiciona transiciones a tareas. Escribe eventos de paso en The Fibre.', // MT
    pt: 'Máquinas de estados para pessoas: desenhe uma jornada como grafo visual, mova contatos por ela, condicione transições a tarefas. Grava eventos de passo de volta no The Fibre.', // MT
    de: 'Zustandsmaschinen für Menschen: gestalte eine Journey als visuellen Graphen, bewege Kontakte hindurch, sichere Übergänge mit Aufgaben. Schreibt Schrittereignisse zurück an The Fibre.', // MT
    fr: "Machines à états pour les personnes : conçois un parcours en graphe visuel, fais-y avancer des contacts, conditionne les transitions à des tâches. Écrit les événements d'étape dans The Fibre.", // MT
  },
  app_body_pulse: {
    en: 'Business planner — cashflow projection and budgeting on contacts and offerings. Opportunities, invoices and a pipeline that reads as a Flow; reads the purchase ledger for actuals.',
    nl: 'Bedrijfsplanner — cashflowprognose en budgettering op contacten en aanbod. Kansen, facturen en een pipeline die leest als een Flow; leest het aankoopgrootboek voor werkelijke cijfers.',
    es: 'Planificador de negocio: proyección de flujo de caja y presupuestos sobre contactos y ofertas. Oportunidades, facturas y un pipeline que se lee como un Flow; lee el libro de compras para los datos reales.', // MT
    pt: 'Planejador de negócios — projeção de fluxo de caixa e orçamento sobre contatos e ofertas. Oportunidades, faturas e um pipeline que se lê como um Flow; lê o livro de compras para os números reais.', // MT
    de: 'Businessplaner — Cashflow-Projektion und Budgetierung auf Kontakten und Angeboten. Chancen, Rechnungen und eine Pipeline, die sich wie ein Flow liest; liest das Kaufbuch für Ist-Zahlen.', // MT
    fr: "Planificateur d'activité — projection de trésorerie et budgets sur les contacts et les offres. Opportunités, factures et un pipeline qui se lit comme un Flow ; lit le registre d'achats pour les chiffres réels.", // MT
  },
  app_body_sales: {
    en: 'Sovereign app — gated behind its own app membership. Curates commercial relationship + billing fields on organisations.',
    nl: 'Soevereine app — afgeschermd achter een eigen app-lidmaatschap. Beheert commerciële-relatie- en factuurvelden op organisaties.',
    es: 'App soberana, protegida por su propia membresía de app. Cura campos de relación comercial y facturación en organizaciones.', // MT
    pt: 'App soberano — protegido pela sua própria associação de app. Cura campos de relação comercial e faturamento nas organizações.', // MT
    de: 'Souveräne App — hinter eigener App-Mitgliedschaft. Kuratiert Felder für Geschäftsbeziehung und Abrechnung auf Organisationen.', // MT
    fr: "App souveraine — protégée par sa propre adhésion d'app. Cure les champs de relation commerciale et de facturation des organisations.", // MT
  },
  app_body_learn: {
    en: 'Asynchronous content + reflections. Curates learning profile fields on persons.',
    nl: 'Asynchrone content + reflecties. Beheert leerprofielvelden op personen.',
    es: 'Contenido asíncrono + reflexiones. Cura campos del perfil de aprendizaje en personas.', // MT
    pt: 'Conteúdo assíncrono + reflexões. Cura campos do perfil de aprendizagem nas pessoas.', // MT
    de: 'Asynchrone Inhalte + Reflexionen. Kuratiert Lernprofilfelder auf Personen.', // MT
    fr: "Contenu asynchrone + réflexions. Cure les champs du profil d'apprentissage des personnes.", // MT
  },

  // ── settings → apps → API keys ────────────────────────────────────────
  api_keys: {
    en: 'API keys',
    nl: 'API-sleutels',
    es: 'Claves API', // MT
    pt: 'Chaves de API', // MT
    de: 'API-Schlüssel', // MT
    fr: 'Clés API', // MT
  },
  api_keys_blurb: {
    en: 'Server-to-server credentials for this app in this workspace. An app key needs no signed-in browser, and can only do what its scopes allow.',
    nl: 'Server-naar-server-inloggegevens voor deze app in deze werkruimte. Een app-sleutel heeft geen ingelogde browser nodig en kan alleen wat de scopes toestaan.',
    es: 'Credenciales servidor a servidor para esta app en este espacio de trabajo. Una clave de app no necesita un navegador con sesión y solo puede hacer lo que sus scopes permiten.', // MT
    pt: 'Credenciais servidor a servidor para este app neste espaço de trabalho. Uma chave de app não precisa de navegador logado e só pode fazer o que os escopos permitem.', // MT
    de: 'Server-zu-Server-Zugangsdaten für diese App in diesem Workspace. Ein App-Schlüssel braucht keinen angemeldeten Browser und kann nur, was seine Scopes erlauben.', // MT
    fr: "Identifiants serveur à serveur pour cette app dans cet espace de travail. Une clé d'app n'a pas besoin de navigateur connecté et ne peut faire que ce que ses scopes autorisent.", // MT
  },
  keys_load_failed: {
    en: "Couldn't load keys:",
    nl: 'Kon de sleutels niet laden:',
    es: 'No se pudieron cargar las claves:', // MT
    pt: 'Não foi possível carregar as chaves:', // MT
    de: 'Schlüssel konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les clés :', // MT
  },
  copy_token_now: {
    en: 'Copy this token now',
    nl: 'Kopieer dit token nu',
    es: 'Copia este token ahora', // MT
    pt: 'Copie este token agora', // MT
    de: 'Kopiere dieses Token jetzt', // MT
    fr: 'Copie ce jeton maintenant', // MT
  },
  copy_token_msg_pre: {
    en: 'It is shown once and never again — only its hash is stored. Send it as',
    nl: 'Het wordt één keer getoond en daarna nooit meer — alleen de hash wordt bewaard. Stuur het mee als',
    es: 'Se muestra una vez y nunca más: solo se guarda su hash. Envíalo como', // MT
    pt: 'É mostrado uma vez e nunca mais — só o hash é guardado. Envie como', // MT
    de: 'Es wird einmal angezeigt und nie wieder — nur der Hash wird gespeichert. Sende es als', // MT
    fr: "Il n'est affiché qu'une seule fois — seul son hash est conservé. Envoie-le comme", // MT
  },
  copy_token_msg_post: {
    en: '; no X-App-ID header is needed, the key identifies the app.',
    nl: '; een X-App-ID-header is niet nodig, de sleutel identificeert de app.',
    es: '; no hace falta la cabecera X-App-ID, la clave identifica la app.', // MT
    pt: '; não precisa do cabeçalho X-App-ID, a chave identifica o app.', // MT
    de: '; ein X-App-ID-Header ist nicht nötig, der Schlüssel identifiziert die App.', // MT
    fr: "; pas besoin d'en-tête X-App-ID, la clé identifie l'app.", // MT
  },
  new_key: {
    en: 'New key',
    nl: 'Nieuwe sleutel',
    es: 'Nueva clave', // MT
    pt: 'Nova chave', // MT
    de: 'Neuer Schlüssel', // MT
    fr: 'Nouvelle clé', // MT
  },
  new_key_blurb: {
    en: 'A key acts for this app in this workspace only, and only within the scopes you tick. It carries none of your own authority — that is the point of it.',
    nl: 'Een sleutel werkt alleen voor deze app in deze werkruimte, en alleen binnen de scopes die je aanvinkt. Hij draagt niets van jouw eigen bevoegdheid — dat is precies de bedoeling.',
    es: 'Una clave actúa solo para esta app en este espacio de trabajo, y solo dentro de los scopes que marques. No lleva nada de tu propia autoridad: esa es la gracia.', // MT
    pt: 'Uma chave age só para este app neste espaço de trabalho, e só dentro dos escopos que você marcar. Não carrega nada da sua própria autoridade — esse é o ponto.', // MT
    de: 'Ein Schlüssel wirkt nur für diese App in diesem Workspace und nur innerhalb der Scopes, die du ankreuzt. Er trägt nichts von deiner eigenen Berechtigung — genau das ist der Sinn.', // MT
    fr: "Une clé n'agit que pour cette app dans cet espace de travail, et uniquement dans les scopes cochés. Elle ne porte rien de ta propre autorité — c'est justement le but.", // MT
  },
  label_optional: {
    en: 'Label (optional)',
    nl: 'Label (optioneel)',
    es: 'Etiqueta (opcional)', // MT
    pt: 'Rótulo (opcional)', // MT
    de: 'Label (optional)', // MT
    fr: 'Libellé (facultatif)', // MT
  },
  scopes: {
    en: 'Scopes',
    nl: 'Scopes',
    es: 'Scopes', // MT
    pt: 'Escopos', // MT
    de: 'Scopes', // MT
    fr: 'Scopes', // MT
  },
  no_scopes_msg: {
    en: "This app's manifest requested no recognised scopes, so there is nothing a key could be allowed to do. Ask the developer to declare",
    nl: 'Het manifest van deze app heeft geen herkende scopes aangevraagd, dus een sleutel zou niets mogen doen. Vraag de ontwikkelaar om',
    es: 'El manifiesto de esta app no solicitó scopes reconocidos, así que una clave no podría hacer nada. Pide al desarrollador que declare', // MT
    pt: 'O manifesto deste app não solicitou escopos reconhecidos, então uma chave não poderia fazer nada. Peça ao desenvolvedor para declarar', // MT
    de: 'Das Manifest dieser App hat keine bekannten Scopes angefordert, ein Schlüssel dürfte also nichts tun. Bitte den Entwickler,', // MT
    fr: "Le manifeste de cette app n'a demandé aucun scope reconnu, une clé ne pourrait donc rien faire. Demande au développeur de déclarer", // MT
  },
  no_scopes_msg_post: {
    en: 'and re-register.',
    nl: 'te declareren en opnieuw te registreren.',
    es: 'y vuelva a registrarla.', // MT
    pt: 'e registrar de novo.', // MT
    de: 'zu deklarieren und neu zu registrieren.', // MT
    fr: 'et de réenregistrer.', // MT
  },
  mint_key: {
    en: 'Mint key',
    nl: 'Sleutel aanmaken',
    es: 'Generar clave', // MT
    pt: 'Gerar chave', // MT
    de: 'Schlüssel erzeugen', // MT
    fr: 'Générer la clé', // MT
  },
  active_keys: {
    en: 'Active keys',
    nl: 'Actieve sleutels',
    es: 'Claves activas', // MT
    pt: 'Chaves ativas', // MT
    de: 'Aktive Schlüssel', // MT
    fr: 'Clés actives', // MT
  },
  unnamed_key: {
    en: 'Unnamed key',
    nl: 'Naamloze sleutel',
    es: 'Clave sin nombre', // MT
    pt: 'Chave sem nome', // MT
    de: 'Unbenannter Schlüssel', // MT
    fr: 'Clé sans nom', // MT
  },
  last_used: {
    en: 'last used',
    nl: 'laatst gebruikt',
    es: 'último uso', // MT
    pt: 'último uso', // MT
    de: 'zuletzt benutzt', // MT
    fr: 'dernière utilisation', // MT
  },
  never_used: {
    en: 'never used',
    nl: 'nooit gebruikt',
    es: 'nunca usada', // MT
    pt: 'nunca usada', // MT
    de: 'nie benutzt', // MT
    fr: 'jamais utilisée', // MT
  },
  revoke: {
    en: 'Revoke',
    nl: 'Intrekken',
    es: 'Revocar', // MT
    pt: 'Revogar', // MT
    de: 'Widerrufen', // MT
    fr: 'Révoquer', // MT
  },
  revoked: {
    en: 'Revoked',
    nl: 'Ingetrokken',
    es: 'Revocadas', // MT
    pt: 'Revogadas', // MT
    de: 'Widerrufen', // MT
    fr: 'Révoquées', // MT
  },
  revoked_at: {
    en: 'revoked',
    nl: 'ingetrokken',
    es: 'revocada', // MT
    pt: 'revogada', // MT
    de: 'widerrufen', // MT
    fr: 'révoquée', // MT
  },
  // ── settings → plan ───────────────────────────────────────────────────
  plan_title: {
    en: 'Plan',
    nl: 'Abonnement',
    es: 'Plan', // MT
    pt: 'Plano', // MT
    de: 'Tarif', // MT
    fr: 'Formule', // MT
  },
  plan_blurb: {
    en: 'What this workspace is on, what it is using, and what the other packages offer.',
    nl: 'Waar deze werkruimte op zit, wat hij gebruikt en wat de andere pakketten bieden.',
    es: 'En qué plan está este espacio de trabajo, qué está usando y qué ofrecen los otros paquetes.', // MT
    pt: 'Em que plano este espaço de trabalho está, o que está usando e o que os outros pacotes oferecem.', // MT
    de: 'Auf welchem Tarif dieser Workspace ist, was er nutzt und was die anderen Pakete bieten.', // MT
    fr: "Sur quelle formule est cet espace de travail, ce qu'il utilise et ce qu'offrent les autres forfaits.", // MT
  },
  plan_load_failed: {
    en: 'Could not load your plan. Try again in a moment.',
    nl: 'Kon je abonnement niet laden. Probeer het zo weer.',
    es: 'No se pudo cargar tu plan. Inténtalo en un momento.', // MT
    pt: 'Não foi possível carregar seu plano. Tente de novo em instantes.', // MT
    de: 'Dein Tarif konnte nicht geladen werden. Versuch es gleich noch einmal.', // MT
    fr: 'Impossible de charger ta formule. Réessaie dans un instant.', // MT
  },
  welcome_ready: {
    en: 'Welcome — your workspace is ready.',
    nl: 'Welkom — je werkruimte staat klaar.',
    es: 'Bienvenido: tu espacio de trabajo está listo.', // MT
    pt: 'Bem-vindo — seu espaço de trabalho está pronto.', // MT
    de: 'Willkommen — dein Workspace ist bereit.', // MT
    fr: 'Bienvenue — ton espace de travail est prêt.', // MT
  },
  welcome_picked_pre: {
    en: 'You picked',
    nl: 'Je koos',
    es: 'Elegiste', // MT
    pt: 'Você escolheu', // MT
    de: 'Du hast', // MT
    fr: 'Tu as choisi', // MT
  },
  welcome_picked_post: {
    en: "when signing up: activate it below whenever you're ready, or just start on Free — nothing is charged until you do.",
    nl: 'bij het aanmelden: activeer het hieronder wanneer je er klaar voor bent, of begin gewoon op Free — er wordt niets afgeschreven tot je dat doet.',
    es: 'al registrarte: actívalo abajo cuando quieras, o empieza en Free; no se cobra nada hasta que lo hagas.', // MT
    pt: 'ao se cadastrar: ative abaixo quando quiser, ou comece no Free — nada é cobrado até você ativar.', // MT
    de: 'bei der Anmeldung gewählt: aktiviere es unten, wann immer du bereit bist, oder starte einfach auf Free — bis dahin wird nichts berechnet.', // MT
    fr: "à l'inscription : active-la ci-dessous quand tu veux, ou commence sur Free — rien n'est facturé avant.", // MT
  },
  payment_received: {
    en: 'Payment received',
    nl: 'Betaling ontvangen',
    es: 'Pago recibido', // MT
    pt: 'Pagamento recebido', // MT
    de: 'Zahlung erhalten', // MT
    fr: 'Paiement reçu', // MT
  },
  payment_received_post: {
    en: "— your plan updates here within a few moments (refresh if it hasn't).",
    nl: '— je abonnement wordt hier binnen enkele ogenblikken bijgewerkt (ververs als dat niet gebeurt).',
    es: '— tu plan se actualiza aquí en unos momentos (recarga si no).', // MT
    pt: '— seu plano é atualizado aqui em instantes (recarregue se não for).', // MT
    de: '— dein Tarif wird hier in wenigen Augenblicken aktualisiert (lade neu, falls nicht).', // MT
    fr: "— ta formule se met à jour ici sous peu (actualise si ce n'est pas le cas).", // MT
  },
  subscription_ends: {
    en: 'Your subscription ends',
    nl: 'Je abonnement eindigt op',
    es: 'Tu suscripción termina el', // MT
    pt: 'Sua assinatura termina em', // MT
    de: 'Dein Abo endet am', // MT
    fr: 'Ton abonnement se termine le', // MT
  },
  subscription_ends_post: {
    en: '— the workspace drops to Free then. Everything you built stays; picking a plan back up is one click in "Manage billing".',
    nl: '— de werkruimte valt dan terug op Free. Alles wat je bouwde blijft; een abonnement weer oppakken is één klik in "Facturering beheren".',
    es: '— el espacio de trabajo pasa entonces a Free. Todo lo que construiste se queda; retomar un plan es un clic en «Gestionar facturación».', // MT
    pt: '— o espaço de trabalho cai então para o Free. Tudo o que você construiu fica; retomar um plano é um clique em "Gerenciar cobrança".', // MT
    de: '— der Workspace fällt dann auf Free zurück. Alles, was du gebaut hast, bleibt; ein Tarif ist mit einem Klick in „Abrechnung verwalten" wieder aktiv.', // MT
    fr: "— l'espace de travail repasse alors sur Free. Tout ce que tu as construit reste ; reprendre une formule tient en un clic dans « Gérer la facturation ».", // MT
  },
  on_the_house: {
    en: 'On the house',
    nl: 'Van het huis',
    es: 'Por cuenta de la casa', // MT
    pt: 'Por conta da casa', // MT
    de: 'Aufs Haus', // MT
    fr: 'Offert', // MT
  },
  tailored_price: {
    en: 'Tailored price',
    nl: 'Maatwerkprijs',
    es: 'Precio a medida', // MT
    pt: 'Preço sob medida', // MT
    de: 'Individueller Preis', // MT
    fr: 'Prix sur mesure', // MT
  },
  comped_msg: {
    en: 'This workspace pays nothing — the plan was granted by The Fibre.',
    nl: 'Deze werkruimte betaalt niets — het abonnement is toegekend door The Fibre.',
    es: 'Este espacio de trabajo no paga nada: el plan lo concedió The Fibre.', // MT
    pt: 'Este espaço de trabalho não paga nada — o plano foi concedido pelo The Fibre.', // MT
    de: 'Dieser Workspace zahlt nichts — der Tarif wurde von The Fibre gewährt.', // MT
    fr: "Cet espace de travail ne paie rien — la formule a été offerte par The Fibre.", // MT
  },
  free_as_long_as_fits: {
    en: 'Free, for as long as it fits.',
    nl: 'Gratis, zolang het past.',
    es: 'Gratis, mientras te sirva.', // MT
    pt: 'Grátis, enquanto servir.', // MT
    de: 'Kostenlos, solange es passt.', // MT
    fr: 'Gratuit, tant que ça convient.', // MT
  },
  per_month_ex_vat: {
    en: '{price} per month ex-VAT',
    nl: '{price} per maand excl. btw',
    es: '{price} al mes sin IVA', // MT
    pt: '{price} por mês sem IVA', // MT
    de: '{price} pro Monat zzgl. MwSt.', // MT
    fr: '{price} par mois HT', // MT
  },
  per_year_two_free: {
    en: '{price} per year (two months free)',
    nl: '{price} per jaar (twee maanden gratis)',
    es: '{price} al año (dos meses gratis)', // MT
    pt: '{price} por ano (dois meses grátis)', // MT
    de: '{price} pro Jahr (zwei Monate gratis)', // MT
    fr: '{price} par an (deux mois offerts)', // MT
  },
  ends: {
    en: 'Ends',
    nl: 'Eindigt',
    es: 'Termina', // MT
    pt: 'Termina', // MT
    de: 'Endet', // MT
    fr: 'Se termine', // MT
  },
  renews: {
    en: 'Renews',
    nl: 'Verlengt',
    es: 'Se renueva', // MT
    pt: 'Renova', // MT
    de: 'Verlängert sich', // MT
    fr: 'Se renouvelle', // MT
  },
  billed_monthly: {
    en: 'billed monthly',
    nl: 'maandelijks gefactureerd',
    es: 'facturación mensual', // MT
    pt: 'cobrado mensalmente', // MT
    de: 'monatlich abgerechnet', // MT
    fr: 'facturé mensuellement', // MT
  },
  billed_yearly: {
    en: 'billed yearly',
    nl: 'jaarlijks gefactureerd',
    es: 'facturación anual', // MT
    pt: 'cobrado anualmente', // MT
    de: 'jährlich abgerechnet', // MT
    fr: 'facturé annuellement', // MT
  },
  talk_to_us: {
    en: 'Talk to us',
    nl: 'Praat met ons',
    es: 'Habla con nosotros', // MT
    pt: 'Fale com a gente', // MT
    de: 'Sprich mit uns', // MT
    fr: 'Parle-nous', // MT
  },
  seats: {
    en: 'Seats',
    nl: 'Plekken',
    es: 'Puestos', // MT
    pt: 'Assentos', // MT
    de: 'Plätze', // MT
    fr: 'Sièges', // MT
  },
  extra_seats_line: {
    en: '{n} extra × {each} = {total}/month',
    nl: '{n} extra × {each} = {total}/maand',
    es: '{n} extra × {each} = {total}/mes', // MT
    pt: '{n} extra × {each} = {total}/mês', // MT
    de: '{n} extra × {each} = {total}/Monat', // MT
    fr: '{n} en plus × {each} = {total}/mois', // MT
  },
  on_your_subscription: {
    en: ', on your subscription',
    nl: ', op je abonnement',
    es: ', en tu suscripción', // MT
    pt: ', na sua assinatura', // MT
    de: ', auf deinem Abo', // MT
    fr: ', sur ton abonnement', // MT
  },
  extra_seats_price: {
    en: 'Extra seats {price}/month',
    nl: 'Extra plekken {price}/maand',
    es: 'Puestos extra {price}/mes', // MT
    pt: 'Assentos extras {price}/mês', // MT
    de: 'Zusätzliche Plätze {price}/Monat', // MT
    fr: 'Sièges supplémentaires {price}/mois', // MT
  },
  email_this_month: {
    en: 'Email this month',
    nl: 'E-mail deze maand',
    es: 'Correo este mes', // MT
    pt: 'E-mails este mês', // MT
    de: 'E-Mails diesen Monat', // MT
    fr: 'E-mails ce mois-ci', // MT
  },
  overage_so_far: {
    en: "{price} overage so far, on next month's invoice",
    nl: '{price} overschrijding tot nu toe, op de factuur van volgende maand',
    es: '{price} de exceso hasta ahora, en la factura del próximo mes', // MT
    pt: '{price} de excedente até agora, na fatura do próximo mês', // MT
    de: '{price} Mehrverbrauch bisher, auf der Rechnung nächsten Monat', // MT
    fr: '{price} de dépassement pour l’instant, sur la facture du mois prochain', // MT
  },
  over_allowance_emails: {
    en: 'Over the allowance: {price}/1,000 emails',
    nl: 'Boven de bundel: {price}/1.000 e-mails',
    es: 'Por encima del límite: {price}/1.000 correos', // MT
    pt: 'Acima da franquia: {price}/1.000 e-mails', // MT
    de: 'Über dem Kontingent: {price}/1.000 E-Mails', // MT
    fr: 'Au-delà du forfait : {price}/1 000 e-mails', // MT
  },
  storage: {
    en: 'Storage',
    nl: 'Opslag',
    es: 'Almacenamiento', // MT
    pt: 'Armazenamento', // MT
    de: 'Speicher', // MT
    fr: 'Stockage', // MT
  },
  overage_storage: {
    en: "{price} overage, on next month's invoice",
    nl: '{price} overschrijding, op de factuur van volgende maand',
    es: '{price} de exceso, en la factura del próximo mes', // MT
    pt: '{price} de excedente, na fatura do próximo mês', // MT
    de: '{price} Mehrverbrauch, auf der Rechnung nächsten Monat', // MT
    fr: '{price} de dépassement, sur la facture du mois prochain', // MT
  },
  over_allowance_gb: {
    en: 'Over the allowance: {price}/GB',
    nl: 'Boven de bundel: {price}/GB',
    es: 'Por encima del límite: {price}/GB', // MT
    pt: 'Acima da franquia: {price}/GB', // MT
    de: 'Über dem Kontingent: {price}/GB', // MT
    fr: 'Au-delà du forfait : {price}/Go', // MT
  },
  data_kept: {
    en: 'Data kept',
    nl: 'Data bewaard',
    es: 'Datos conservados', // MT
    pt: 'Dados mantidos', // MT
    de: 'Daten aufbewahrt', // MT
    fr: 'Données conservées', // MT
  },
  n_months: {
    en: '{n} months',
    nl: '{n} maanden',
    es: '{n} meses', // MT
    pt: '{n} meses', // MT
    de: '{n} Monate', // MT
    fr: '{n} mois', // MT
  },
  as_long_as_you_pay: {
    en: 'For as long as you pay',
    nl: 'Zolang je betaalt',
    es: 'Mientras pagues', // MT
    pt: 'Enquanto você pagar', // MT
    de: 'Solange du zahlst', // MT
    fr: 'Tant que tu paies', // MT
  },
  pct_of_allowance: {
    en: '{pct}% of allowance used',
    nl: '{pct}% van de bundel gebruikt',
    es: '{pct}% del límite usado', // MT
    pt: '{pct}% da franquia usada', // MT
    de: '{pct}% des Kontingents genutzt', // MT
    fr: '{pct}% du forfait utilisé', // MT
  },
  your_fibre_invoices: {
    en: 'Your Fibre invoices',
    nl: 'Je Fibre-facturen',
    es: 'Tus facturas de Fibre', // MT
    pt: 'Suas faturas do Fibre', // MT
    de: 'Deine Fibre-Rechnungen', // MT
    fr: 'Tes factures Fibre', // MT
  },
  all_packages: {
    en: 'All packages',
    nl: 'Alle pakketten',
    es: 'Todos los paquetes', // MT
    pt: 'Todos os pacotes', // MT
    de: 'Alle Pakete', // MT
    fr: 'Tous les forfaits', // MT
  },
  yours: {
    en: 'Yours',
    nl: 'Die van jou',
    es: 'El tuyo', // MT
    pt: 'O seu', // MT
    de: 'Deiner', // MT
    fr: 'Le tien', // MT
  },
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis', // MT
    pt: 'Grátis', // MT
    de: 'Kostenlos', // MT
    fr: 'Gratuit', // MT
  },
  per_mo: {
    en: '/mo',
    nl: '/mnd',
    es: '/mes', // MT
    pt: '/mês', // MT
    de: '/Mon.', // MT
    fr: '/mois', // MT
  },
  per_yr: {
    en: '/yr',
    nl: '/jr',
    es: '/año', // MT
    pt: '/ano', // MT
    de: '/Jahr', // MT
    fr: '/an', // MT
  },
  seats_included: {
    en: 'Seats included',
    nl: 'Plekken inbegrepen',
    es: 'Puestos incluidos', // MT
    pt: 'Assentos incluídos', // MT
    de: 'Plätze inklusive', // MT
    fr: 'Sièges inclus', // MT
  },
  email_per_month: {
    en: 'Email / month',
    nl: 'E-mail / maand',
    es: 'Correos / mes', // MT
    pt: 'E-mails / mês', // MT
    de: 'E-Mails / Monat', // MT
    fr: 'E-mails / mois', // MT
  },
  fee_paid_enrolments: {
    en: 'Fee on paid enrolments',
    nl: 'Fee op betaalde inschrijvingen',
    es: 'Comisión sobre inscripciones de pago', // MT
    pt: 'Taxa sobre inscrições pagas', // MT
    de: 'Gebühr auf bezahlte Anmeldungen', // MT
    fr: 'Frais sur les inscriptions payantes', // MT
  },
  unlimited: {
    en: 'Unlimited',
    nl: 'Onbeperkt',
    es: 'Ilimitado', // MT
    pt: 'Ilimitado', // MT
    de: 'Unbegrenzt', // MT
    fr: 'Illimité', // MT
  },
  negotiated: {
    en: 'Negotiated',
    nl: 'In overleg',
    es: 'A negociar', // MT
    pt: 'Negociado', // MT
    de: 'Verhandelbar', // MT
    fr: 'Négocié', // MT
  },
  packages_footnote: {
    en: 'Prices ex-VAT, per workspace per month. Meet is in every package. Downgrading never deletes anything — what a smaller plan lacks becomes read-only, not gone.',
    nl: 'Prijzen excl. btw, per werkruimte per maand. Meet zit in elk pakket. Downgraden verwijdert nooit iets — wat een kleiner pakket mist wordt alleen-lezen, niet weg.',
    es: 'Precios sin IVA, por espacio de trabajo al mes. Meet está en todos los paquetes. Bajar de plan nunca borra nada: lo que falta en un plan menor pasa a solo lectura, no desaparece.', // MT
    pt: 'Preços sem IVA, por espaço de trabalho por mês. O Meet está em todos os pacotes. Fazer downgrade nunca apaga nada — o que falta num plano menor vira somente leitura, não some.', // MT
    de: 'Preise zzgl. MwSt., pro Workspace pro Monat. Meet ist in jedem Paket. Ein Downgrade löscht nie etwas — was ein kleinerer Tarif nicht hat, wird schreibgeschützt, nicht gelöscht.', // MT
    fr: "Prix HT, par espace de travail et par mois. Meet est dans chaque forfait. Rétrograder ne supprime jamais rien — ce que la formule inférieure n'a pas devient en lecture seule, pas perdu.", // MT
  },
  monthly: {
    en: 'Monthly',
    nl: 'Maandelijks',
    es: 'Mensual', // MT
    pt: 'Mensal', // MT
    de: 'Monatlich', // MT
    fr: 'Mensuel', // MT
  },
  yearly_two_free: {
    en: 'Yearly — 2 months free',
    nl: 'Jaarlijks — 2 maanden gratis',
    es: 'Anual: 2 meses gratis', // MT
    pt: 'Anual — 2 meses grátis', // MT
    de: 'Jährlich — 2 Monate gratis', // MT
    fr: 'Annuel — 2 mois offerts', // MT
  },
  keep_my_plan: {
    en: 'Keep my plan',
    nl: 'Mijn abonnement houden',
    es: 'Mantener mi plan', // MT
    pt: 'Manter meu plano', // MT
    de: 'Meinen Tarif behalten', // MT
    fr: 'Garder ma formule', // MT
  },
  current_plan: {
    en: 'current plan',
    nl: 'huidig abonnement',
    es: 'plan actual', // MT
    pt: 'plano atual', // MT
    de: 'aktueller Tarif', // MT
    fr: 'formule actuelle', // MT
  },
  downgrade_to_free: {
    en: 'Downgrade to Free',
    nl: 'Terug naar Free',
    es: 'Bajar a Free', // MT
    pt: 'Voltar para o Free', // MT
    de: 'Auf Free wechseln', // MT
    fr: 'Passer sur Free', // MT
  },
  payment_method: {
    en: 'Payment method',
    nl: 'Betaalmethode',
    es: 'Método de pago', // MT
    pt: 'Forma de pagamento', // MT
    de: 'Zahlungsmethode', // MT
    fr: 'Moyen de paiement', // MT
  },
  billing_country: {
    en: 'Billing country',
    nl: 'Factuurland',
    es: 'País de facturación', // MT
    pt: 'País de cobrança', // MT
    de: 'Rechnungsland', // MT
    fr: 'Pays de facturation', // MT
  },
  portal_open_failed: {
    en: 'could not open the billing portal',
    nl: 'kon het factureringsportaal niet openen',
    es: 'no se pudo abrir el portal de facturación', // MT
    pt: 'não foi possível abrir o portal de cobrança', // MT
    de: 'Abrechnungsportal konnte nicht geöffnet werden', // MT
    fr: "impossible d'ouvrir le portail de facturation", // MT
  },
  checkout_stripe_note: {
    en: "Checkout and card details run on Stripe — we never see the number. VAT is added at your country's rate. Yearly is two months free.",
    nl: 'Afrekenen en kaartgegevens lopen via Stripe — wij zien het nummer nooit. Btw komt erbij tegen het tarief van jouw land. Jaarlijks is twee maanden gratis.',
    es: 'El pago y los datos de la tarjeta van por Stripe: nunca vemos el número. El IVA se añade según el tipo de tu país. El plan anual son dos meses gratis.', // MT
    pt: 'O checkout e os dados do cartão rodam no Stripe — nunca vemos o número. O IVA é adicionado à taxa do seu país. O anual são dois meses grátis.', // MT
    de: 'Checkout und Kartendaten laufen über Stripe — wir sehen die Nummer nie. MwSt. kommt zum Satz deines Landes dazu. Jährlich heißt zwei Monate gratis.', // MT
    fr: 'Le paiement et les données de carte passent par Stripe — nous ne voyons jamais le numéro. La TVA est ajoutée au taux de ton pays. L’annuel offre deux mois.', // MT
  },
  switch_note: {
    en: 'Switching charges or credits the difference immediately, on the card on file, with an invoice below. Downgrading to Free takes effect at the period end — everything you built stays.',
    nl: 'Wisselen brengt het verschil direct in rekening of crediteert het, op de kaart die bekend is, met een factuur hieronder. Terug naar Free gaat in aan het einde van de periode — alles wat je bouwde blijft.',
    es: 'Cambiar cobra o abona la diferencia al instante, en la tarjeta guardada, con una factura abajo. Bajar a Free surte efecto al final del periodo: todo lo que construiste se queda.', // MT
    pt: 'Trocar cobra ou credita a diferença na hora, no cartão salvo, com uma fatura abaixo. Voltar para o Free vale no fim do período — tudo o que você construiu fica.', // MT
    de: 'Beim Wechsel wird die Differenz sofort berechnet oder gutgeschrieben, auf die hinterlegte Karte, mit Rechnung unten. Der Wechsel auf Free gilt zum Periodenende — alles bleibt erhalten.', // MT
    fr: "Changer facture ou crédite la différence immédiatement, sur la carte enregistrée, avec une facture ci-dessous. Passer sur Free prend effet en fin de période — tout ce que tu as construit reste.", // MT
  },
  switch_to_q: {
    en: 'Switch to {label}?',
    nl: 'Wisselen naar {label}?',
    es: '¿Cambiar a {label}?', // MT
    pt: 'Trocar para {label}?', // MT
    de: 'Zu {label} wechseln?', // MT
    fr: 'Passer à {label} ?', // MT
  },
  switch_msg: {
    en: 'The difference is prorated and invoiced immediately on your card on file. Your allowances change right away.',
    nl: 'Het verschil wordt naar rato berekend en direct gefactureerd op je bekende kaart. Je bundels veranderen meteen.',
    es: 'La diferencia se prorratea y se factura al instante en tu tarjeta guardada. Tus límites cambian de inmediato.', // MT
    pt: 'A diferença é rateada e cobrada na hora no seu cartão salvo. Suas franquias mudam imediatamente.', // MT
    de: 'Die Differenz wird anteilig berechnet und sofort über die hinterlegte Karte abgerechnet. Deine Kontingente ändern sich sofort.', // MT
    fr: 'La différence est calculée au prorata et facturée immédiatement sur ta carte enregistrée. Tes quotas changent tout de suite.', // MT
  },
  switch_msg_cancelling: {
    en: 'This also removes the pending cancellation. The difference is prorated and invoiced immediately on your card on file.',
    nl: 'Dit haalt ook de geplande opzegging weg. Het verschil wordt naar rato berekend en direct gefactureerd op je bekende kaart.',
    es: 'Esto también elimina la cancelación pendiente. La diferencia se prorratea y se factura al instante en tu tarjeta guardada.', // MT
    pt: 'Isto também remove o cancelamento pendente. A diferença é rateada e cobrada na hora no seu cartão salvo.', // MT
    de: 'Das hebt auch die anstehende Kündigung auf. Die Differenz wird anteilig berechnet und sofort über die hinterlegte Karte abgerechnet.', // MT
    fr: "Cela retire aussi l'annulation en attente. La différence est calculée au prorata et facturée immédiatement sur ta carte enregistrée.", // MT
  },
  switch_now: {
    en: 'Switch now',
    nl: 'Nu wisselen',
    es: 'Cambiar ahora', // MT
    pt: 'Trocar agora', // MT
    de: 'Jetzt wechseln', // MT
    fr: 'Changer maintenant', // MT
  },
  downgrade_to_free_q: {
    en: 'Downgrade to Free?',
    nl: 'Terug naar Free?',
    es: '¿Bajar a Free?', // MT
    pt: 'Voltar para o Free?', // MT
    de: 'Auf Free wechseln?', // MT
    fr: 'Passer sur Free ?', // MT
  },
  downgrade_msg: {
    en: 'Your plan stays active until the end of the paid period, then the workspace drops to Free. Nothing is deleted, and coming back is one click.',
    nl: 'Je abonnement blijft actief tot het einde van de betaalde periode, daarna valt de werkruimte terug op Free. Er wordt niets verwijderd en terugkomen is één klik.',
    es: 'Tu plan sigue activo hasta el final del periodo pagado; luego el espacio pasa a Free. No se borra nada y volver es un clic.', // MT
    pt: 'Seu plano continua ativo até o fim do período pago, depois o espaço cai para o Free. Nada é apagado, e voltar é um clique.', // MT
    de: 'Dein Tarif bleibt bis zum Ende des bezahlten Zeitraums aktiv, dann fällt der Workspace auf Free zurück. Nichts wird gelöscht, und zurückkommen ist ein Klick.', // MT
    fr: "Ta formule reste active jusqu'à la fin de la période payée, puis l'espace repasse sur Free. Rien n'est supprimé, et revenir tient en un clic.", // MT
  },
  downgrade_at_period_end: {
    en: 'Downgrade at period end',
    nl: 'Downgraden aan einde periode',
    es: 'Bajar al final del periodo', // MT
    pt: 'Fazer downgrade no fim do período', // MT
    de: 'Zum Periodenende wechseln', // MT
    fr: 'Rétrograder en fin de période', // MT
  },
  archived_on: {
    en: 'This workspace was archived on {date}',
    nl: 'Deze werkruimte is gearchiveerd op {date}',
    es: 'Este espacio de trabajo se archivó el {date}', // MT
    pt: 'Este espaço de trabalho foi arquivado em {date}', // MT
    de: 'Dieser Workspace wurde am {date} archiviert', // MT
    fr: 'Cet espace de travail a été archivé le {date}', // MT
  },
  archived_msg: {
    en: 'after 13 months without sign-ins or activity. Nothing was deleted — everything is exactly where you left it, waiting behind this one button.',
    nl: 'na 13 maanden zonder aanmeldingen of activiteit. Er is niets verwijderd — alles staat precies waar je het achterliet, achter deze ene knop.',
    es: 'tras 13 meses sin inicios de sesión ni actividad. No se borró nada: todo está exactamente donde lo dejaste, esperando detrás de este botón.', // MT
    pt: 'após 13 meses sem logins ou atividade. Nada foi apagado — tudo está exatamente onde você deixou, esperando atrás deste botão.', // MT
    de: 'nach 13 Monaten ohne Anmeldungen oder Aktivität. Nichts wurde gelöscht — alles ist genau dort, wo du es gelassen hast, hinter diesem einen Knopf.', // MT
    fr: "après 13 mois sans connexion ni activité. Rien n'a été supprimé — tout est exactement là où tu l'as laissé, derrière ce seul bouton.", // MT
  },
  reactivating: {
    en: 'Reactivating…',
    nl: 'Reactiveren…',
    es: 'Reactivando…', // MT
    pt: 'Reativando…', // MT
    de: 'Wird reaktiviert…', // MT
    fr: 'Réactivation…', // MT
  },
  reactivate_workspace: {
    en: 'Reactivate workspace',
    nl: 'Werkruimte reactiveren',
    es: 'Reactivar el espacio de trabajo', // MT
    pt: 'Reativar espaço de trabalho', // MT
    de: 'Workspace reaktivieren', // MT
    fr: "Réactiver l'espace de travail", // MT
  },
  print_for_pdf: {
    en: "Use your browser's Print for a PDF",
    nl: 'Gebruik Afdrukken in je browser voor een pdf',
    es: 'Usa Imprimir de tu navegador para un PDF', // MT
    pt: 'Use o Imprimir do navegador para um PDF', // MT
    de: 'Nutze Drucken im Browser für ein PDF', // MT
    fr: "Utilise l'impression du navigateur pour un PDF", // MT
  },
  // ── currencies + connections ──────────────────────────────────────────
  currencies_title: {
    en: 'Currencies',
    nl: "Valuta's",
    es: 'Monedas', // MT
    pt: 'Moedas', // MT
    de: 'Währungen', // MT
    fr: 'Devises', // MT
  },
  currencies_blurb: {
    en: 'Which currencies this workspace sells in — one list for everything priced, in every app.',
    nl: "In welke valuta's deze werkruimte verkoopt — één lijst voor alles met een prijs, in elke app.",
    es: 'En qué monedas vende este espacio de trabajo: una lista para todo lo que tiene precio, en cada app.', // MT
    pt: 'Em quais moedas este espaço de trabalho vende — uma lista para tudo o que tem preço, em cada app.', // MT
    de: 'In welchen Währungen dieser Workspace verkauft — eine Liste für alles mit Preis, in jeder App.', // MT
    fr: 'Dans quelles devises cet espace de travail vend — une seule liste pour tout ce qui a un prix, dans chaque app.', // MT
  },
  connections_title: {
    en: 'Connections',
    nl: 'Koppelingen',
    es: 'Conexiones', // MT
    pt: 'Conexões', // MT
    de: 'Verbindungen', // MT
    fr: 'Connexions', // MT
  },
  connections_blurb: {
    en: 'External services connected to your account — one connection per person, shared across Meet and Thread.',
    nl: 'Externe diensten gekoppeld aan je account — één koppeling per persoon, gedeeld tussen Meet en Thread.',
    es: 'Servicios externos conectados a tu cuenta: una conexión por persona, compartida entre Meet y Thread.', // MT
    pt: 'Serviços externos conectados à sua conta — uma conexão por pessoa, compartilhada entre Meet e Thread.', // MT
    de: 'Externe Dienste, die mit deinem Konto verbunden sind — eine Verbindung pro Person, geteilt zwischen Meet und Thread.', // MT
    fr: 'Services externes connectés à ton compte — une connexion par personne, partagée entre Meet et Thread.', // MT
  },
  calendars: {
    en: 'Calendars',
    nl: 'Agenda’s',
    es: 'Calendarios', // MT
    pt: 'Calendários', // MT
    de: 'Kalender', // MT
    fr: 'Calendriers', // MT
  },
  google_calendar_blurb: {
    en: 'One connection for all Fibre apps: Meet reads your free/busy and creates calendar events (with a Meet link) when someone books.',
    nl: 'Eén koppeling voor alle Fibre-apps: Meet leest je beschikbaarheid en zet agenda-items (met Meet-link) als iemand boekt.',
    es: 'Una conexión para todas las apps de Fibre: Meet lee tu disponibilidad y crea eventos de calendario (con enlace de Meet) cuando alguien reserva.', // MT
    pt: 'Uma conexão para todos os apps do Fibre: o Meet lê sua disponibilidade e cria eventos de calendário (com link do Meet) quando alguém agenda.', // MT
    de: 'Eine Verbindung für alle Fibre-Apps: Meet liest deine Verfügbarkeit und legt Kalendereinträge (mit Meet-Link) an, wenn jemand bucht.', // MT
    fr: 'Une seule connexion pour toutes les apps Fibre : Meet lit tes disponibilités et crée des événements de calendrier (avec lien Meet) quand quelqu’un réserve.', // MT
  },
  google_connected: {
    en: 'Connected. Calendars synced.',
    nl: 'Gekoppeld. Agenda’s gesynchroniseerd.',
    es: 'Conectado. Calendarios sincronizados.', // MT
    pt: 'Conectado. Calendários sincronizados.', // MT
    de: 'Verbunden. Kalender synchronisiert.', // MT
    fr: 'Connecté. Calendriers synchronisés.', // MT
  },
  google_connect_failed: {
    en: "Couldn't connect",
    nl: 'Koppelen is niet gelukt',
    es: 'No se pudo conectar', // MT
    pt: 'Não foi possível conectar', // MT
    de: 'Verbindung fehlgeschlagen', // MT
    fr: 'Connexion impossible', // MT
  },
  google_start_failed: {
    en: 'Could not start Google connect.',
    nl: 'Kon de Google-koppeling niet starten.',
    es: 'No se pudo iniciar la conexión con Google.', // MT
    pt: 'Não foi possível iniciar a conexão com o Google.', // MT
    de: 'Google-Verbindung konnte nicht gestartet werden.', // MT
    fr: 'Impossible de démarrer la connexion Google.', // MT
  },
  disconnect: {
    en: 'Disconnect',
    nl: 'Ontkoppelen',
    es: 'Desconectar', // MT
    pt: 'Desconectar', // MT
    de: 'Trennen', // MT
    fr: 'Déconnecter', // MT
  },
  starting: {
    en: 'Starting…',
    nl: 'Starten…',
    es: 'Iniciando…', // MT
    pt: 'Iniciando…', // MT
    de: 'Wird gestartet…', // MT
    fr: 'Démarrage…', // MT
  },
  connect_google: {
    en: 'Connect Google',
    nl: 'Google koppelen',
    es: 'Conectar Google', // MT
    pt: 'Conectar Google', // MT
    de: 'Google verbinden', // MT
    fr: 'Connecter Google', // MT
  },
  personal_room: {
    en: 'Personal meeting room',
    nl: 'Persoonlijke vergaderruimte',
    es: 'Sala de reuniones personal', // MT
    pt: 'Sala de reunião pessoal', // MT
    de: 'Persönlicher Meetingraum', // MT
    fr: 'Salle de réunion personnelle', // MT
  },
  personal_room_blurb: {
    en: 'Used by activities set to Personal room — a static Zoom Personal Meeting Room URL, your Whereby link, anything that lives at a fixed URL.',
    nl: 'Gebruikt door activiteiten die op Persoonlijke ruimte staan — een vaste Zoom Personal Meeting Room-URL, je Whereby-link, alles met een vast adres.',
    es: 'Lo usan las actividades con Sala personal: una URL fija de Zoom Personal Meeting Room, tu enlace de Whereby, cualquier cosa con URL fija.', // MT
    pt: 'Usada por atividades definidas como Sala pessoal — uma URL fixa de Zoom Personal Meeting Room, seu link do Whereby, qualquer coisa num endereço fixo.', // MT
    de: 'Genutzt von Aktivitäten mit „Persönlicher Raum" — eine feste Zoom-Personal-Meeting-Room-URL, dein Whereby-Link, alles mit fester URL.', // MT
    fr: 'Utilisée par les activités en Salle personnelle — une URL fixe de Zoom Personal Meeting Room, ton lien Whereby, tout ce qui vit à une URL fixe.', // MT
  },
  personal_room_url: {
    en: 'Personal meeting room URL',
    nl: 'URL persoonlijke vergaderruimte',
    es: 'URL de la sala de reuniones personal', // MT
    pt: 'URL da sala de reunião pessoal', // MT
    de: 'URL des persönlichen Meetingraums', // MT
    fr: 'URL de la salle de réunion personnelle', // MT
  },

  // ── profile + language ────────────────────────────────────────────────
  profile_title: {
    en: 'Profile',
    nl: 'Profiel',
    es: 'Perfil', // MT
    pt: 'Perfil', // MT
    de: 'Profil', // MT
    fr: 'Profil', // MT
  },
  profile_blurb: {
    en: 'Who you are on The Fibre. Every app inherits this.',
    nl: 'Wie je bent op The Fibre. Elke app erft dit.',
    es: 'Quién eres en The Fibre. Cada app lo hereda.', // MT
    pt: 'Quem você é no The Fibre. Cada app herda isto.', // MT
    de: 'Wer du auf The Fibre bist. Jede App erbt das.', // MT
    fr: "Qui tu es sur The Fibre. Chaque app en hérite.", // MT
  },
  profile_load_failed: {
    en: "Couldn't load your profile:",
    nl: 'Kon je profiel niet laden:',
    es: 'No se pudo cargar tu perfil:', // MT
    pt: 'Não foi possível carregar seu perfil:', // MT
    de: 'Dein Profil konnte nicht geladen werden:', // MT
    fr: 'Impossible de charger ton profil :', // MT
  },
  photo_hint: {
    en: 'Shown wherever the apps show you.',
    nl: 'Te zien overal waar de apps jou laten zien.',
    es: 'Se muestra donde las apps te muestran.', // MT
    pt: 'Aparece onde os apps mostram você.', // MT
    de: 'Wird überall dort gezeigt, wo die Apps dich zeigen.', // MT
    fr: "Affichée partout où les apps te montrent.", // MT
  },
  bio_hint: {
    en: 'Shown on your public pages in the apps that have them.',
    nl: 'Te zien op je publieke pagina’s in de apps die die hebben.',
    es: 'Se muestra en tus páginas públicas en las apps que las tienen.', // MT
    pt: 'Aparece nas suas páginas públicas nos apps que as têm.', // MT
    de: 'Erscheint auf deinen öffentlichen Seiten in den Apps, die welche haben.', // MT
    fr: 'Affichée sur tes pages publiques dans les apps qui en ont.', // MT
  },
  signed_in_as: {
    en: 'Signed in as {email}.',
    nl: 'Ingelogd als {email}.',
    es: 'Sesión iniciada como {email}.', // MT
    pt: 'Conectado como {email}.', // MT
    de: 'Angemeldet als {email}.', // MT
    fr: 'Connecté en tant que {email}.', // MT
  },
  profile_inherit_note: {
    en: 'Every app inherits this profile — Thread and Meet can override the name and photo on their own public pages.',
    nl: 'Elke app erft dit profiel — Thread en Meet kunnen naam en foto overschrijven op hun eigen publieke pagina’s.',
    es: 'Cada app hereda este perfil; Thread y Meet pueden cambiar el nombre y la foto en sus propias páginas públicas.', // MT
    pt: 'Cada app herda este perfil — Thread e Meet podem sobrescrever o nome e a foto nas suas próprias páginas públicas.', // MT
    de: 'Jede App erbt dieses Profil — Thread und Meet können Name und Foto auf ihren eigenen öffentlichen Seiten überschreiben.', // MT
    fr: 'Chaque app hérite de ce profil — Thread et Meet peuvent remplacer le nom et la photo sur leurs propres pages publiques.', // MT
  },
  signing_in: {
    en: 'Signing in',
    nl: 'Inloggen',
    es: 'Inicio de sesión', // MT
    pt: 'Login', // MT
    de: 'Anmeldung', // MT
    fr: 'Connexion', // MT
  },
  method: {
    en: 'Method',
    nl: 'Methode',
    es: 'Método', // MT
    pt: 'Método', // MT
    de: 'Methode', // MT
    fr: 'Méthode', // MT
  },
  emailed_code: {
    en: 'Emailed code',
    nl: 'Code per e-mail',
    es: 'Código por correo', // MT
    pt: 'Código por e-mail', // MT
    de: 'Code per E-Mail', // MT
    fr: 'Code par e-mail', // MT
  },
  last_sign_in: {
    en: 'Last sign-in',
    nl: 'Laatste aanmelding',
    es: 'Último inicio de sesión', // MT
    pt: 'Último login', // MT
    de: 'Letzte Anmeldung', // MT
    fr: 'Dernière connexion', // MT
  },
  email_identity_note: {
    en: 'Your email is your identity here: it is how the platform finds every workspace you belong to, so it cannot be changed from this screen yet. Ask and we will move it. There is no password to manage — you sign in with Google, or with a code sent to this address.',
    nl: 'Je e-mailadres is hier je identiteit: zo vindt het platform elke werkruimte waar je bij hoort, dus je kunt het nog niet vanaf dit scherm wijzigen. Vraag het ons en we verhuizen het. Er is geen wachtwoord om te beheren — je logt in met Google of met een code naar dit adres.',
    es: 'Tu correo es tu identidad aquí: así encuentra la plataforma cada espacio de trabajo al que perteneces, por eso aún no se puede cambiar desde esta pantalla. Pídelo y lo movemos. No hay contraseña que gestionar: entras con Google o con un código enviado a esta dirección.', // MT
    pt: 'Seu e-mail é sua identidade aqui: é assim que a plataforma encontra cada espaço de trabalho a que você pertence, então ainda não dá para mudá-lo nesta tela. Peça e nós movemos. Não há senha para gerenciar — você entra com o Google ou com um código enviado a este endereço.', // MT
    de: 'Deine E-Mail ist hier deine Identität: darüber findet die Plattform jeden Workspace, zu dem du gehörst, deshalb kannst du sie hier noch nicht ändern. Frag uns, wir ziehen sie um. Es gibt kein Passwort zu verwalten — du meldest dich mit Google an oder mit einem Code an diese Adresse.', // MT
    fr: "Ton e-mail est ton identité ici : c'est ainsi que la plateforme retrouve chaque espace de travail auquel tu appartiens, il ne peut donc pas encore être changé depuis cet écran. Demande-nous et nous le déplacerons. Pas de mot de passe à gérer — tu te connectes avec Google ou avec un code envoyé à cette adresse.", // MT
  },
  language: {
    en: 'Language',
    nl: 'Taal',
    es: 'Idioma', // MT
    pt: 'Idioma', // MT
    de: 'Sprache', // MT
    fr: 'Langue', // MT
  },
  preferred_language: {
    en: 'Preferred language',
    nl: 'Voorkeurstaal',
    es: 'Idioma preferido', // MT
    pt: 'Idioma preferido', // MT
    de: 'Bevorzugte Sprache', // MT
    fr: 'Langue préférée', // MT
  },
  no_preference_english: {
    en: 'No preference (English)',
    nl: 'Geen voorkeur (Engels)',
    es: 'Sin preferencia (inglés)', // MT
    pt: 'Sem preferência (inglês)', // MT
    de: 'Keine Präferenz (Englisch)', // MT
    fr: 'Aucune préférence (anglais)', // MT
  },
  language_note: {
    en: "One setting for all of The Fibre's apps: the language of the emails the platform sends you and of the signed-in screens.",
    nl: 'Eén instelling voor alle apps van The Fibre: de taal van de e-mails die het platform je stuurt en van de ingelogde schermen.',
    es: 'Un solo ajuste para todas las apps de The Fibre: el idioma de los correos que te envía la plataforma y de las pantallas con sesión.', // MT
    pt: 'Uma única configuração para todos os apps do The Fibre: o idioma dos e-mails que a plataforma envia para você e das telas logadas.', // MT
    de: 'Eine Einstellung für alle Apps von The Fibre: die Sprache der E-Mails, die die Plattform dir schickt, und der angemeldeten Ansichten.', // MT
    fr: "Un seul réglage pour toutes les apps de The Fibre : la langue des e-mails que la plateforme t'envoie et des écrans connectés.", // MT
  },

  // ── privacy ───────────────────────────────────────────────────────────
  privacy_blurb: {
    en: 'Your data, your consents, your rights. EU-hosted, GDPR-native.',
    nl: 'Jouw data, jouw toestemmingen, jouw rechten. Gehost in de EU, AVG vanaf de basis.',
    es: 'Tus datos, tus consentimientos, tus derechos. Alojado en la UE, RGPD de origen.', // MT
    pt: 'Seus dados, seus consentimentos, seus direitos. Hospedado na UE, GDPR de nascença.', // MT
    de: 'Deine Daten, deine Einwilligungen, deine Rechte. In der EU gehostet, DSGVO von Grund auf.', // MT
    fr: "Tes données, tes consentements, tes droits. Hébergé dans l'UE, RGPD natif.", // MT
  },
  privacy_load_failed: {
    en: "Couldn't load privacy data:",
    nl: 'Kon de privacygegevens niet laden:',
    es: 'No se pudieron cargar los datos de privacidad:', // MT
    pt: 'Não foi possível carregar os dados de privacidade:', // MT
    de: 'Datenschutzdaten konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les données de confidentialité :', // MT
  },
  active_consents: {
    en: 'Active consents',
    nl: 'Actieve toestemmingen',
    es: 'Consentimientos activos', // MT
    pt: 'Consentimentos ativos', // MT
    de: 'Aktive Einwilligungen', // MT
    fr: 'Consentements actifs', // MT
  },
  no_consents_yet: {
    en: 'No consent records yet. Consents are recorded when you grant permissions during sign-up or in app flows.',
    nl: 'Nog geen toestemmingsrecords. Toestemmingen worden vastgelegd als je rechten verleent bij het aanmelden of in app-flows.',
    es: 'Aún no hay registros de consentimiento. Se registran cuando concedes permisos al registrarte o en los flujos de las apps.', // MT
    pt: 'Ainda não há registros de consentimento. Eles são gravados quando você concede permissões no cadastro ou nos fluxos dos apps.', // MT
    de: 'Noch keine Einwilligungen erfasst. Sie werden festgehalten, wenn du bei der Anmeldung oder in App-Abläufen Berechtigungen erteilst.', // MT
    fr: "Aucun consentement enregistré pour l'instant. Ils sont enregistrés quand tu accordes des autorisations à l'inscription ou dans les parcours des apps.", // MT
  },
  consent_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activo', // MT
    pt: 'Ativo', // MT
    de: 'Aktiv', // MT
    fr: 'Actif', // MT
  },
  consent_basis_note_pre: {
    en: 'Consents granted under',
    nl: 'Toestemmingen op grond van',
    es: 'Los consentimientos concedidos bajo', // MT
    pt: 'Consentimentos concedidos sob', // MT
    de: 'Einwilligungen auf Basis von', // MT
    fr: 'Les consentements accordés sous', // MT
  },
  consent_basis_note_post: {
    en: 'can be objected to but not revoked unilaterally — the underlying record stays.',
    nl: 'kun je bezwaar tegen maken, maar niet eenzijdig intrekken — het onderliggende record blijft.',
    es: 'admiten objeción pero no revocación unilateral: el registro subyacente permanece.', // MT
    pt: 'podem ser contestados mas não revogados unilateralmente — o registro subjacente permanece.', // MT
    de: 'kann widersprochen, aber nicht einseitig widerrufen werden — der zugrunde liegende Eintrag bleibt.', // MT
    fr: "peuvent faire l'objet d'une opposition mais pas d'une révocation unilatérale — l'enregistrement sous-jacent demeure.", // MT
  },
  data_subject_requests: {
    en: 'Data subject requests',
    nl: 'Verzoeken van betrokkenen',
    es: 'Solicitudes del interesado', // MT
    pt: 'Solicitações do titular dos dados', // MT
    de: 'Betroffenenanfragen', // MT
    fr: 'Demandes de la personne concernée', // MT
  },
  no_requests_filed: {
    en: 'No requests filed. Use the actions below to file one.',
    nl: 'Geen verzoeken ingediend. Gebruik de acties hieronder om er een in te dienen.',
    es: 'No hay solicitudes presentadas. Usa las acciones de abajo para presentar una.', // MT
    pt: 'Nenhuma solicitação registrada. Use as ações abaixo para registrar uma.', // MT
    de: 'Keine Anfragen eingereicht. Nutze die Aktionen unten, um eine zu stellen.', // MT
    fr: 'Aucune demande déposée. Utilise les actions ci-dessous pour en déposer une.', // MT
  },
  filed: {
    en: 'Filed',
    nl: 'Ingediend',
    es: 'Presentada', // MT
    pt: 'Registrada', // MT
    de: 'Eingereicht', // MT
    fr: 'Déposée', // MT
  },
  due: {
    en: 'Due',
    nl: 'Uiterlijk',
    es: 'Vence', // MT
    pt: 'Prazo', // MT
    de: 'Fällig', // MT
    fr: 'Échéance', // MT
  },
  actions: {
    en: 'Actions',
    nl: 'Acties',
    es: 'Acciones', // MT
    pt: 'Ações', // MT
    de: 'Aktionen', // MT
    fr: 'Actions', // MT
  },
  status_received: {
    en: 'Received',
    nl: 'Ontvangen',
    es: 'Recibida', // MT
    pt: 'Recebida', // MT
    de: 'Eingegangen', // MT
    fr: 'Reçue', // MT
  },
  status_in_progress: {
    en: 'In progress',
    nl: 'In behandeling',
    es: 'En curso', // MT
    pt: 'Em andamento', // MT
    de: 'In Bearbeitung', // MT
    fr: 'En cours', // MT
  },
  status_request_completed: {
    en: 'Completed',
    nl: 'Afgerond',
    es: 'Completada', // MT
    pt: 'Concluída', // MT
    de: 'Abgeschlossen', // MT
    fr: 'Terminée', // MT
  },
  status_rejected: {
    en: 'Rejected',
    nl: 'Afgewezen',
    es: 'Rechazada', // MT
    pt: 'Rejeitada', // MT
    de: 'Abgelehnt', // MT
    fr: 'Rejetée', // MT
  },
  export_my_data: {
    en: 'Export my data',
    nl: 'Mijn data exporteren',
    es: 'Exportar mis datos', // MT
    pt: 'Exportar meus dados', // MT
    de: 'Meine Daten exportieren', // MT
    fr: 'Exporter mes données', // MT
  },
  export_my_data_desc: {
    en: 'GDPR Article 15. Download everything we hold about you as JSON — identity, profile, org memberships, activity, bookings, per-app curator data, consents and cross-app links.',
    nl: 'AVG artikel 15. Download alles wat we over je hebben als JSON — identiteit, profiel, organisatielidmaatschappen, activiteit, boekingen, curatordata per app, toestemmingen en koppelingen tussen apps.',
    es: 'Artículo 15 del RGPD. Descarga todo lo que tenemos sobre ti como JSON: identidad, perfil, membresías de organizaciones, actividad, reservas, datos de curador por app, consentimientos y enlaces entre apps.', // MT
    pt: 'Artigo 15 do GDPR. Baixe tudo o que temos sobre você em JSON — identidade, perfil, vínculos com organizações, atividade, reservas, dados de curador por app, consentimentos e ligações entre apps.', // MT
    de: 'DSGVO Artikel 15. Lade alles, was wir über dich haben, als JSON herunter — Identität, Profil, Organisationszugehörigkeiten, Aktivität, Buchungen, Kuratordaten pro App, Einwilligungen und App-übergreifende Verknüpfungen.', // MT
    fr: "Article 15 du RGPD. Télécharge tout ce que nous détenons sur toi en JSON — identité, profil, appartenances aux organisations, activité, réservations, données de curateur par app, consentements et liens inter-apps.", // MT
  },
  request_erasure: {
    en: 'Request erasure',
    nl: 'Verwijdering aanvragen',
    es: 'Solicitar supresión', // MT
    pt: 'Solicitar apagamento', // MT
    de: 'Löschung beantragen', // MT
    fr: "Demander l'effacement", // MT
  },
  request_erasure_desc: {
    en: 'GDPR Article 17. We zero personal content fields across every app within 30 days.',
    nl: 'AVG artikel 17. We wissen persoonlijke inhoudsvelden in elke app binnen 30 dagen.',
    es: 'Artículo 17 del RGPD. Vaciamos los campos de contenido personal en todas las apps en 30 días.', // MT
    pt: 'Artigo 17 do GDPR. Zeramos os campos de conteúdo pessoal em todos os apps em 30 dias.', // MT
    de: 'DSGVO Artikel 17. Wir leeren persönliche Inhaltsfelder in jeder App binnen 30 Tagen.', // MT
    fr: "Article 17 du RGPD. Nous vidons les champs de contenu personnel dans chaque app sous 30 jours.", // MT
  },
  erasure_dialog_desc: {
    en: "GDPR Article 17. We'll respond within 30 days. Some structural records may be retained for referential integrity — content fields are zeroed.",
    nl: 'AVG artikel 17. We reageren binnen 30 dagen. Sommige structurele records kunnen blijven voor referentiële integriteit — inhoudsvelden worden gewist.',
    es: 'Artículo 17 del RGPD. Responderemos en 30 días. Algunos registros estructurales pueden conservarse por integridad referencial; los campos de contenido se vacían.', // MT
    pt: 'Artigo 17 do GDPR. Responderemos em 30 dias. Alguns registros estruturais podem ser mantidos por integridade referencial — os campos de conteúdo são zerados.', // MT
    de: 'DSGVO Artikel 17. Wir antworten binnen 30 Tagen. Einige strukturelle Einträge können für referenzielle Integrität erhalten bleiben — Inhaltsfelder werden geleert.', // MT
    fr: "Article 17 du RGPD. Nous répondrons sous 30 jours. Certains enregistrements structurels peuvent être conservés pour l'intégrité référentielle — les champs de contenu sont vidés.", // MT
  },
  erasure_notes_ph: {
    en: 'Anything you want us to know about this request.',
    nl: 'Alles wat je ons over dit verzoek wilt laten weten.',
    es: 'Cualquier cosa que quieras que sepamos sobre esta solicitud.', // MT
    pt: 'Qualquer coisa que você queira que a gente saiba sobre esta solicitação.', // MT
    de: 'Alles, was wir zu dieser Anfrage wissen sollten.', // MT
    fr: 'Tout ce que tu veux nous dire sur cette demande.', // MT
  },
  revoke_consent: {
    en: 'Revoke consent',
    nl: 'Toestemming intrekken',
    es: 'Revocar consentimiento', // MT
    pt: 'Revogar consentimento', // MT
    de: 'Einwilligung widerrufen', // MT
    fr: 'Révoquer le consentement', // MT
  },
  revoke_consent_msg: {
    en: 'Stop allowing {label}? You can grant it again later.',
    nl: '{label} niet langer toestaan? Je kunt het later weer verlenen.',
    es: '¿Dejar de permitir {label}? Puedes concederlo de nuevo más tarde.', // MT
    pt: 'Parar de permitir {label}? Você pode conceder de novo depois.', // MT
    de: '{label} nicht mehr erlauben? Du kannst es später wieder erteilen.', // MT
    fr: 'Ne plus autoriser {label} ? Tu pourras le réaccorder plus tard.', // MT
  },
  preparing: {
    en: 'Preparing…',
    nl: 'Voorbereiden…',
    es: 'Preparando…', // MT
    pt: 'Preparando…', // MT
    de: 'Wird vorbereitet…', // MT
    fr: 'Préparation…', // MT
  },
  download_my_data: {
    en: 'Download my data',
    nl: 'Mijn data downloaden',
    es: 'Descargar mis datos', // MT
    pt: 'Baixar meus dados', // MT
    de: 'Meine Daten herunterladen', // MT
    fr: 'Télécharger mes données', // MT
  },
  export_failed: {
    en: 'Export failed ({status}). Try again or contact support.',
    nl: 'Export mislukt ({status}). Probeer het opnieuw of neem contact op met support.',
    es: 'La exportación falló ({status}). Inténtalo de nuevo o contacta con soporte.', // MT
    pt: 'A exportação falhou ({status}). Tente de novo ou fale com o suporte.', // MT
    de: 'Export fehlgeschlagen ({status}). Versuch es erneut oder wende dich an den Support.', // MT
    fr: "L'export a échoué ({status}). Réessaie ou contacte le support.", // MT
  },
  filing: {
    en: 'Filing…',
    nl: 'Indienen…',
    es: 'Presentando…', // MT
    pt: 'Registrando…', // MT
    de: 'Wird eingereicht…', // MT
    fr: 'Dépôt…', // MT
  },
  file_request: {
    en: 'File request',
    nl: 'Verzoek indienen',
    es: 'Presentar solicitud', // MT
    pt: 'Registrar solicitação', // MT
    de: 'Anfrage einreichen', // MT
    fr: 'Déposer la demande', // MT
  },
  purpose_transactional_email: {
    en: 'Transactional email',
    nl: 'Transactionele e-mail',
    es: 'Correo transaccional', // MT
    pt: 'E-mail transacional', // MT
    de: 'Transaktionale E-Mail', // MT
    fr: 'E-mail transactionnel', // MT
  },
  purpose_transactional_email_desc: {
    en: 'Sign-in links, invitations, and notifications. Required for the platform to work.',
    nl: 'Inloglinks, uitnodigingen en meldingen. Nodig om het platform te laten werken.',
    es: 'Enlaces de acceso, invitaciones y notificaciones. Necesario para que la plataforma funcione.', // MT
    pt: 'Links de login, convites e notificações. Necessário para a plataforma funcionar.', // MT
    de: 'Anmeldelinks, Einladungen und Benachrichtigungen. Nötig, damit die Plattform funktioniert.', // MT
    fr: 'Liens de connexion, invitations et notifications. Nécessaire au fonctionnement de la plateforme.', // MT
  },
  purpose_marketing_email: {
    en: 'Marketing email',
    nl: 'Marketing-e-mail',
    es: 'Correo de marketing', // MT
    pt: 'E-mail de marketing', // MT
    de: 'Marketing-E-Mail', // MT
    fr: 'E-mail marketing', // MT
  },
  purpose_marketing_email_desc: {
    en: 'Newsletters and programme announcements.',
    nl: 'Nieuwsbrieven en programma-aankondigingen.',
    es: 'Boletines y anuncios de programas.', // MT
    pt: 'Newsletters e anúncios de programas.', // MT
    de: 'Newsletter und Programmankündigungen.', // MT
    fr: 'Newsletters et annonces de programmes.', // MT
  },
  purpose_learning_analytics: {
    en: 'Learning analytics',
    nl: 'Leeranalyse',
    es: 'Analítica de aprendizaje', // MT
    pt: 'Análise de aprendizagem', // MT
    de: 'Lernanalysen', // MT
    fr: "Analyse d'apprentissage", // MT
  },
  purpose_learning_analytics_desc: {
    en: 'Progress tracking and completion data inside learning programmes.',
    nl: 'Voortgang en afrondingsdata binnen leerprogramma’s.',
    es: 'Seguimiento del progreso y datos de finalización dentro de los programas de aprendizaje.', // MT
    pt: 'Acompanhamento de progresso e dados de conclusão dentro dos programas de aprendizagem.', // MT
    de: 'Fortschritts- und Abschlussdaten innerhalb von Lernprogrammen.', // MT
    fr: "Suivi de progression et données d'achèvement dans les programmes d'apprentissage.", // MT
  },
  purpose_cohort_directory: {
    en: 'Cohort directory visibility',
    nl: 'Zichtbaarheid in de cohortlijst',
    es: 'Visibilidad en el directorio de la cohorte', // MT
    pt: 'Visibilidade no diretório da turma', // MT
    de: 'Sichtbarkeit im Kohortenverzeichnis', // MT
    fr: "Visibilité dans l'annuaire de cohorte", // MT
  },
  purpose_cohort_directory_desc: {
    en: 'Showing your name to other participants inside cohort views.',
    nl: 'Je naam tonen aan andere deelnemers in cohortweergaven.',
    es: 'Mostrar tu nombre a otros participantes en las vistas de cohorte.', // MT
    pt: 'Mostrar seu nome a outros participantes nas visões da turma.', // MT
    de: 'Deinen Namen anderen Teilnehmenden in Kohortenansichten zeigen.', // MT
    fr: 'Afficher ton nom aux autres participants dans les vues de cohorte.', // MT
  },
  purpose_facilitation_data: {
    en: 'Facilitation data',
    nl: 'Facilitatiedata',
    es: 'Datos de facilitación', // MT
    pt: 'Dados de facilitação', // MT
    de: 'Moderationsdaten', // MT
    fr: 'Données de facilitation', // MT
  },
  purpose_facilitation_data_desc: {
    en: 'Recording attendance and session notes during programmes.',
    nl: 'Aanwezigheid en sessienotities vastleggen tijdens programma’s.',
    es: 'Registrar asistencia y notas de sesión durante los programas.', // MT
    pt: 'Registrar presença e notas de sessão durante os programas.', // MT
    de: 'Anwesenheit und Sitzungsnotizen während Programmen erfassen.', // MT
    fr: 'Enregistrement des présences et des notes de séance pendant les programmes.', // MT
  },
  purpose_sales_contact: {
    en: 'Sales contact',
    nl: 'Salescontact',
    es: 'Contacto comercial', // MT
    pt: 'Contato comercial', // MT
    de: 'Vertriebskontakt', // MT
    fr: 'Contact commercial', // MT
  },
  purpose_sales_contact_desc: {
    en: 'Outreach and pipeline communication.',
    nl: 'Outreach en pipelinecommunicatie.',
    es: 'Comunicación de prospección y pipeline.', // MT
    pt: 'Comunicação de prospecção e pipeline.', // MT
    de: 'Ansprache und Pipeline-Kommunikation.', // MT
    fr: 'Prospection et communication de pipeline.', // MT
  },
  // ── help blurbs ───────────────────────────────────────────────────────
  help_home_blurb: {
    en: 'Your apps, and what has moved recently across them.',
    nl: 'Je apps, en wat er onlangs in beweging kwam.',
    es: 'Tus apps, y lo que se ha movido recientemente en ellas.', // MT
    pt: 'Seus apps, e o que se moveu recentemente entre eles.', // MT
    de: 'Deine Apps und was sich zuletzt darin bewegt hat.', // MT
    fr: 'Tes apps, et ce qui a bougé récemment entre elles.', // MT
  },
  help_contacts_blurb: {
    en: 'Every person the workspace knows. Identity lives here; each app that holds something about them adds its own tab to their profile.',
    nl: 'Iedereen die de werkruimte kent. Identiteit staat hier; elke app die iets over hen bijhoudt voegt een eigen tabblad toe aan hun profiel.',
    es: 'Cada persona que conoce el espacio de trabajo. La identidad vive aquí; cada app que guarda algo sobre ella añade su propia pestaña a su perfil.', // MT
    pt: 'Cada pessoa que o espaço de trabalho conhece. A identidade mora aqui; cada app que guarda algo sobre ela adiciona sua própria aba ao perfil.', // MT
    de: 'Jede Person, die der Workspace kennt. Die Identität liegt hier; jede App, die etwas über sie hält, fügt ihrem Profil einen eigenen Tab hinzu.', // MT
    fr: "Chaque personne que connaît l'espace de travail. L'identité vit ici ; chaque app qui détient quelque chose sur elle ajoute son propre onglet à son profil.", // MT
  },
  help_organisations_blurb: {
    en: 'Organisations, who belongs to them, and the same per-app tabs as a person.',
    nl: 'Organisaties, wie erbij hoort, en dezelfde tabbladen per app als bij een persoon.',
    es: 'Organizaciones, quién pertenece a ellas y las mismas pestañas por app que una persona.', // MT
    pt: 'Organizações, quem pertence a elas e as mesmas abas por app que uma pessoa.', // MT
    de: 'Organisationen, wer dazugehört, und dieselben App-Tabs wie bei einer Person.', // MT
    fr: "Les organisations, qui en fait partie, et les mêmes onglets par app qu'une personne.", // MT
  },
  help_programmes_blurb: {
    en: 'Events, journeys, meetings, courses. Each programme belongs to the app that delivers it.',
    nl: 'Evenementen, trajecten, meetings, cursussen. Elk programma hoort bij de app die het levert.',
    es: 'Eventos, itinerarios, reuniones, cursos. Cada programa pertenece a la app que lo entrega.', // MT
    pt: 'Eventos, jornadas, reuniões, cursos. Cada programa pertence ao app que o entrega.', // MT
    de: 'Events, Journeys, Meetings, Kurse. Jedes Programm gehört zur App, die es liefert.', // MT
    fr: "Événements, parcours, réunions, cours. Chaque programme appartient à l'app qui le délivre.", // MT
  },
  help_activity_blurb: {
    en: 'The accumulated record of every meaningful interaction across every app. Add-only: a mistake is corrected by a new line, never by rewriting the old one.',
    nl: 'Het opgebouwde verslag van elke betekenisvolle interactie in elke app. Alleen toevoegen: een fout wordt hersteld met een nieuwe regel, nooit door de oude te herschrijven.',
    es: 'El registro acumulado de cada interacción significativa en cada app. Solo se añade: un error se corrige con una línea nueva, nunca reescribiendo la antigua.', // MT
    pt: 'O registro acumulado de cada interação significativa em cada app. Só adiciona: um erro se corrige com uma linha nova, nunca reescrevendo a antiga.', // MT
    de: 'Das gesammelte Protokoll jeder bedeutsamen Interaktion in jeder App. Nur hinzufügen: ein Fehler wird mit einer neuen Zeile korrigiert, nie durch Umschreiben der alten.', // MT
    fr: "Le registre accumulé de chaque interaction significative dans chaque app. Ajout seul : une erreur se corrige par une nouvelle ligne, jamais en réécrivant l'ancienne.", // MT
  },
  help_settings_blurb: {
    en: 'Your profile, your workspace, your access — and which apps are switched on.',
    nl: 'Je profiel, je werkruimte, je toegang — en welke apps aanstaan.',
    es: 'Tu perfil, tu espacio de trabajo, tu acceso, y qué apps están activadas.', // MT
    pt: 'Seu perfil, seu espaço de trabalho, seu acesso — e quais apps estão ligados.', // MT
    de: 'Dein Profil, dein Workspace, dein Zugriff — und welche Apps eingeschaltet sind.', // MT
    fr: 'Ton profil, ton espace de travail, ton accès — et quelles apps sont activées.', // MT
  },

  // ── dashboard ─────────────────────────────────────────────────────────
  welcome_name: {
    en: 'Welcome, {name}',
    nl: 'Welkom, {name}',
    es: 'Bienvenido, {name}', // MT
    pt: 'Bem-vindo, {name}', // MT
    de: 'Willkommen, {name}', // MT
    fr: 'Bienvenue, {name}', // MT
  },
  recent_activity: {
    en: 'Recent activity',
    nl: 'Recente activiteit',
    es: 'Actividad reciente', // MT
    pt: 'Atividade recente', // MT
    de: 'Neueste Aktivität', // MT
    fr: 'Activité récente', // MT
  },
  active_programmes: {
    en: 'Active programmes',
    nl: "Actieve programma's",
    es: 'Programas activos', // MT
    pt: 'Programas ativos', // MT
    de: 'Aktive Programme', // MT
    fr: 'Programmes actifs', // MT
  },
  no_active_programmes: {
    en: 'No active programmes.',
    nl: "Geen actieve programma's.",
    es: 'No hay programas activos.', // MT
    pt: 'Nenhum programa ativo.', // MT
    de: 'Keine aktiven Programme.', // MT
    fr: 'Aucun programme actif.', // MT
  },
  starts: {
    en: 'starts',
    nl: 'start',
    es: 'empieza', // MT
    pt: 'começa', // MT
    de: 'startet', // MT
    fr: 'commence', // MT
  },
  your_apps: {
    en: 'Your apps',
    nl: 'Je apps',
    es: 'Tus apps', // MT
    pt: 'Seus apps', // MT
    de: 'Deine Apps', // MT
    fr: 'Tes apps', // MT
  },
  no_apps_activated: {
    en: 'No apps activated yet for this workspace.',
    nl: 'Nog geen apps geactiveerd voor deze werkruimte.',
    es: 'Aún no hay apps activadas para este espacio de trabajo.', // MT
    pt: 'Ainda não há apps ativados para este espaço de trabalho.', // MT
    de: 'Noch keine Apps für diesen Workspace aktiviert.', // MT
    fr: 'Aucune app activée pour cet espace de travail.', // MT
  },
  turn_on_an_app: {
    en: 'Turn on an app',
    nl: 'Zet een app aan',
    es: 'Activa una app', // MT
    pt: 'Ligue um app', // MT
    de: 'Schalte eine App ein', // MT
    fr: 'Active une app', // MT
  },
  to_get_started: {
    en: 'to get started.',
    nl: 'om te beginnen.',
    es: 'para empezar.', // MT
    pt: 'para começar.', // MT
    de: 'um loszulegen.', // MT
    fr: 'pour commencer.', // MT
  },

  // ── contacts ──────────────────────────────────────────────────────────
  add_person: {
    en: 'Add person',
    nl: 'Persoon toevoegen',
    es: 'Añadir persona', // MT
    pt: 'Adicionar pessoa', // MT
    de: 'Person hinzufügen', // MT
    fr: 'Ajouter une personne', // MT
  },
  add_person_blurb: {
    en: 'Adds a contact to your workspace. Identity is platform-owned — every app sees the same record.',
    nl: 'Voegt een contact toe aan je werkruimte. Identiteit is van het platform — elke app ziet hetzelfde record.',
    es: 'Añade un contacto a tu espacio de trabajo. La identidad es de la plataforma: cada app ve el mismo registro.', // MT
    pt: 'Adiciona um contato ao seu espaço de trabalho. A identidade é da plataforma — cada app vê o mesmo registro.', // MT
    de: 'Fügt deinem Workspace einen Kontakt hinzu. Die Identität gehört der Plattform — jede App sieht denselben Datensatz.', // MT
    fr: "Ajoute un contact à ton espace de travail. L'identité appartient à la plateforme — chaque app voit le même enregistrement.", // MT
  },
  search_name_email: {
    en: 'Search name or email…',
    nl: 'Zoek op naam of e-mail…',
    es: 'Busca por nombre o correo…', // MT
    pt: 'Busque por nome ou e-mail…', // MT
    de: 'Nach Name oder E-Mail suchen…', // MT
    fr: 'Cherche un nom ou un e-mail…', // MT
  },
  contacts_load_failed: {
    en: "Couldn't load contacts:",
    nl: 'Kon de contacten niet laden:',
    es: 'No se pudieron cargar los contactos:', // MT
    pt: 'Não foi possível carregar os contatos:', // MT
    de: 'Kontakte konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les contacts :', // MT
  },
  no_contacts_yet: {
    en: 'No contacts yet.',
    nl: 'Nog geen contacten.',
    es: 'Aún no hay contactos.', // MT
    pt: 'Ainda não há contatos.', // MT
    de: 'Noch keine Kontakte.', // MT
    fr: 'Pas encore de contacts.', // MT
  },
  add_first_one: {
    en: 'Add the first one',
    nl: 'Voeg de eerste toe',
    es: 'Añade el primero', // MT
    pt: 'Adicione o primeiro', // MT
    de: 'Füge den ersten hinzu', // MT
    fr: 'Ajoute le premier', // MT
  },
  first_name: {
    en: 'First name',
    nl: 'Voornaam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Vorname', // MT
    fr: 'Prénom', // MT
  },
  last_name: {
    en: 'Last name',
    nl: 'Achternaam',
    es: 'Apellidos', // MT
    pt: 'Sobrenome', // MT
    de: 'Nachname', // MT
    fr: 'Nom', // MT
  },
  preferred_name: {
    en: 'Preferred name',
    nl: 'Roepnaam',
    es: 'Nombre preferido', // MT
    pt: 'Nome preferido', // MT
    de: 'Rufname', // MT
    fr: 'Nom préféré', // MT
  },
  country_iso: {
    en: 'Country (ISO 2-letter)',
    nl: 'Land (ISO, 2 letters)',
    es: 'País (ISO, 2 letras)', // MT
    pt: 'País (ISO, 2 letras)', // MT
    de: 'Land (ISO, 2 Buchstaben)', // MT
    fr: 'Pays (ISO, 2 lettres)', // MT
  },
  country: {
    en: 'Country',
    nl: 'Land',
    es: 'País', // MT
    pt: 'País', // MT
    de: 'Land', // MT
    fr: 'Pays', // MT
  },
  goes_by: {
    en: 'Goes by {name}',
    nl: 'Wordt {name} genoemd',
    es: 'Se hace llamar {name}', // MT
    pt: 'Conhecido como {name}', // MT
    de: 'Wird {name} genannt', // MT
    fr: 'Se fait appeler {name}', // MT
  },
  phone: {
    en: 'Phone',
    nl: 'Telefoon',
    es: 'Teléfono', // MT
    pt: 'Telefone', // MT
    de: 'Telefon', // MT
    fr: 'Téléphone', // MT
  },
  location: {
    en: 'Location',
    nl: 'Locatie',
    es: 'Ubicación', // MT
    pt: 'Localização', // MT
    de: 'Ort', // MT
    fr: 'Lieu', // MT
  },
  pronouns: {
    en: 'Pronouns',
    nl: 'Voornaamwoorden',
    es: 'Pronombres', // MT
    pt: 'Pronomes', // MT
    de: 'Pronomen', // MT
    fr: 'Pronoms', // MT
  },
  street: {
    en: 'Street',
    nl: 'Straat',
    es: 'Calle', // MT
    pt: 'Rua', // MT
    de: 'Straße', // MT
    fr: 'Rue', // MT
  },
  postal_code: {
    en: 'Postal code',
    nl: 'Postcode',
    es: 'Código postal', // MT
    pt: 'CEP', // MT
    de: 'Postleitzahl', // MT
    fr: 'Code postal', // MT
  },
  city: {
    en: 'City',
    nl: 'Plaats',
    es: 'Ciudad', // MT
    pt: 'Cidade', // MT
    de: 'Stadt', // MT
    fr: 'Ville', // MT
  },
  region: {
    en: 'Region',
    nl: 'Regio',
    es: 'Región', // MT
    pt: 'Região', // MT
    de: 'Region', // MT
    fr: 'Région', // MT
  },
  iso_639_hint: {
    en: 'ISO 639 code, e.g. nl or en-GB',
    nl: 'ISO 639-code, bijv. nl of en-GB',
    es: 'Código ISO 639, p. ej. nl o en-GB', // MT
    pt: 'Código ISO 639, p. ex. nl ou en-GB', // MT
    de: 'ISO-639-Code, z. B. nl oder en-GB', // MT
    fr: 'Code ISO 639, p. ex. nl ou en-GB', // MT
  },
  edit_contact: {
    en: 'Edit contact',
    nl: 'Contact bewerken',
    es: 'Editar contacto', // MT
    pt: 'Editar contato', // MT
    de: 'Kontakt bearbeiten', // MT
    fr: 'Modifier le contact', // MT
  },
  delete_contact: {
    en: 'Delete contact',
    nl: 'Contact verwijderen',
    es: 'Eliminar contacto', // MT
    pt: 'Excluir contato', // MT
    de: 'Kontakt löschen', // MT
    fr: 'Supprimer le contact', // MT
  },
  delete_contact_msg: {
    en: 'Soft-delete {name}? Personal data stays in the database (deleted_at flag) — only a GDPR erasure removes it.',
    nl: '{name} soft-deleten? Persoonlijke data blijft in de database (deleted_at-vlag) — alleen een AVG-verwijdering haalt ze weg.',
    es: '¿Borrado suave de {name}? Los datos personales se quedan en la base de datos (marca deleted_at); solo una supresión RGPD los elimina.', // MT
    pt: 'Soft delete de {name}? Os dados pessoais ficam no banco (flag deleted_at) — só um apagamento GDPR os remove.', // MT
    de: '{name} soft-löschen? Persönliche Daten bleiben in der Datenbank (deleted_at-Flag) — nur eine DSGVO-Löschung entfernt sie.', // MT
    fr: 'Suppression douce de {name} ? Les données personnelles restent en base (drapeau deleted_at) — seul un effacement RGPD les retire.', // MT
  },
  no_orgs_linked: {
    en: 'No organisations linked yet.',
    nl: 'Nog geen organisaties gekoppeld.',
    es: 'Aún no hay organizaciones vinculadas.', // MT
    pt: 'Ainda não há organizações vinculadas.', // MT
    de: 'Noch keine Organisationen verknüpft.', // MT
    fr: 'Aucune organisation liée pour le moment.', // MT
  },
  unknown_org: {
    en: 'Unknown org',
    nl: 'Onbekende organisatie',
    es: 'Organización desconocida', // MT
    pt: 'Organização desconhecida', // MT
    de: 'Unbekannte Organisation', // MT
    fr: 'Organisation inconnue', // MT
  },
  primary: {
    en: 'Primary',
    nl: 'Primair',
    es: 'Principal', // MT
    pt: 'Principal', // MT
    de: 'Primär', // MT
    fr: 'Principal', // MT
  },
  ended: {
    en: 'Ended',
    nl: 'Beëindigd',
    es: 'Finalizada', // MT
    pt: 'Encerrada', // MT
    de: 'Beendet', // MT
    fr: 'Terminée', // MT
  },
  decision_maker: {
    en: 'Decision maker',
    nl: 'Beslisser',
    es: 'Decisor', // MT
    pt: 'Decisor', // MT
    de: 'Entscheider', // MT
    fr: 'Décideur', // MT
  },
  budget_holder: {
    en: 'Budget holder',
    nl: 'Budgethouder',
    es: 'Responsable de presupuesto', // MT
    pt: 'Dono do orçamento', // MT
    de: 'Budgetverantwortlich', // MT
    fr: 'Détenteur du budget', // MT
  },
  champion: {
    en: 'Champion',
    nl: 'Voorvechter',
    es: 'Impulsor', // MT
    pt: 'Defensor', // MT
    de: 'Fürsprecher', // MT
    fr: 'Ambassadeur', // MT
  },
  workspace_access: {
    en: 'Workspace access',
    nl: 'Toegang tot de werkruimte',
    es: 'Acceso al espacio de trabajo', // MT
    pt: 'Acesso ao espaço de trabalho', // MT
    de: 'Workspace-Zugriff', // MT
    fr: "Accès à l'espace de travail", // MT
  },
  apps_access_to: {
    en: 'Apps they have access to',
    nl: 'Apps waar ze toegang toe hebben',
    es: 'Apps a las que tiene acceso', // MT
    pt: 'Apps a que tem acesso', // MT
    de: 'Apps mit Zugriff', // MT
    fr: 'Apps auxquelles la personne a accès', // MT
  },
  no_activity_yet: {
    en: 'No activity yet. Events written by apps will appear here.',
    nl: 'Nog geen activiteit. Gebeurtenissen die apps schrijven verschijnen hier.',
    es: 'Aún no hay actividad. Los eventos que escriban las apps aparecerán aquí.', // MT
    pt: 'Ainda não há atividade. Os eventos gravados pelos apps aparecerão aqui.', // MT
    de: 'Noch keine Aktivität. Von Apps geschriebene Ereignisse erscheinen hier.', // MT
    fr: "Pas encore d'activité. Les événements écrits par les apps apparaîtront ici.", // MT
  },
  identity: {
    en: 'Identity',
    nl: 'Identiteit',
    es: 'Identidad', // MT
    pt: 'Identidade', // MT
    de: 'Identität', // MT
    fr: 'Identité', // MT
  },
  professional: {
    en: 'Professional',
    nl: 'Professioneel',
    es: 'Profesional', // MT
    pt: 'Profissional', // MT
    de: 'Beruflich', // MT
    fr: 'Professionnel', // MT
  },
  edit_professional_profile: {
    en: 'Edit professional profile',
    nl: 'Professioneel profiel bewerken',
    es: 'Editar perfil profesional', // MT
    pt: 'Editar perfil profissional', // MT
    de: 'Berufsprofil bearbeiten', // MT
    fr: 'Modifier le profil professionnel', // MT
  },
  current_title: {
    en: 'Current title',
    nl: 'Huidige functie',
    es: 'Cargo actual', // MT
    pt: 'Cargo atual', // MT
    de: 'Aktueller Titel', // MT
    fr: 'Poste actuel', // MT
  },
  current_department: {
    en: 'Current department',
    nl: 'Huidige afdeling',
    es: 'Departamento actual', // MT
    pt: 'Departamento atual', // MT
    de: 'Aktuelle Abteilung', // MT
    fr: 'Service actuel', // MT
  },
  seniority_level: {
    en: 'Seniority level',
    nl: 'Senioriteitsniveau',
    es: 'Nivel de seniority', // MT
    pt: 'Nível de senioridade', // MT
    de: 'Senioritätsstufe', // MT
    fr: 'Niveau de séniorité', // MT
  },
  seniority_junior: {
    en: 'Junior',
    nl: 'Junior',
    es: 'Júnior', // MT
    pt: 'Júnior', // MT
    de: 'Junior', // MT
    fr: 'Junior', // MT
  },
  seniority_mid: {
    en: 'Mid',
    nl: 'Medior',
    es: 'Intermedio', // MT
    pt: 'Pleno', // MT
    de: 'Mittel', // MT
    fr: 'Intermédiaire', // MT
  },
  seniority_senior: {
    en: 'Senior',
    nl: 'Senior',
    es: 'Sénior', // MT
    pt: 'Sênior', // MT
    de: 'Senior', // MT
    fr: 'Senior', // MT
  },
  seniority_lead: {
    en: 'Lead',
    nl: 'Lead',
    es: 'Líder', // MT
    pt: 'Líder', // MT
    de: 'Lead', // MT
    fr: 'Lead', // MT
  },
  seniority_executive: {
    en: 'Executive',
    nl: 'Directie',
    es: 'Ejecutivo', // MT
    pt: 'Executivo', // MT
    de: 'Geschäftsleitung', // MT
    fr: 'Direction', // MT
  },
  seniority_board: {
    en: 'Board',
    nl: 'Bestuur',
    es: 'Consejo', // MT
    pt: 'Conselho', // MT
    de: 'Vorstand', // MT
    fr: 'Conseil', // MT
  },
  sector: {
    en: 'Sector',
    nl: 'Sector',
    es: 'Sector', // MT
    pt: 'Setor', // MT
    de: 'Sektor', // MT
    fr: 'Secteur', // MT
  },
  career_stage: {
    en: 'Career stage',
    nl: 'Loopbaanfase',
    es: 'Etapa profesional', // MT
    pt: 'Fase da carreira', // MT
    de: 'Karrierephase', // MT
    fr: 'Étape de carrière', // MT
  },
  career_early: {
    en: 'Early',
    nl: 'Vroeg',
    es: 'Inicial', // MT
    pt: 'Inicial', // MT
    de: 'Früh', // MT
    fr: 'Débutante', // MT
  },
  career_established: {
    en: 'Established',
    nl: 'Gevestigd',
    es: 'Consolidada', // MT
    pt: 'Consolidada', // MT
    de: 'Etabliert', // MT
    fr: 'Établie', // MT
  },
  career_senior: {
    en: 'Senior',
    nl: 'Senior',
    es: 'Sénior', // MT
    pt: 'Sênior', // MT
    de: 'Senior', // MT
    fr: 'Senior', // MT
  },
  career_transitioning: {
    en: 'Transitioning',
    nl: 'In transitie',
    es: 'En transición', // MT
    pt: 'Em transição', // MT
    de: 'Im Übergang', // MT
    fr: 'En transition', // MT
  },
  career_portfolio: {
    en: 'Portfolio',
    nl: 'Portfolio',
    es: 'Portafolio', // MT
    pt: 'Portfólio', // MT
    de: 'Portfolio', // MT
    fr: 'Portfolio', // MT
  },
  years_of_experience: {
    en: 'Years of experience',
    nl: 'Jaren ervaring',
    es: 'Años de experiencia', // MT
    pt: 'Anos de experiência', // MT
    de: 'Jahre Erfahrung', // MT
    fr: "Années d'expérience", // MT
  },
  independent: {
    en: 'Independent',
    nl: 'Zelfstandig',
    es: 'Independiente', // MT
    pt: 'Independente', // MT
    de: 'Selbstständig', // MT
    fr: 'Indépendant', // MT
  },
  expertise_areas: {
    en: 'Expertise areas',
    nl: 'Expertisegebieden',
    es: 'Áreas de experiencia', // MT
    pt: 'Áreas de especialidade', // MT
    de: 'Fachgebiete', // MT
    fr: "Domaines d'expertise", // MT
  },
  industries_worked_in: {
    en: 'Industries worked in',
    nl: 'Sectoren waarin gewerkt',
    es: 'Industrias en las que ha trabajado', // MT
    pt: 'Indústrias em que trabalhou', // MT
    de: 'Branchenerfahrung', // MT
    fr: 'Industries pratiquées', // MT
  },
  certifications: {
    en: 'Certifications',
    nl: 'Certificeringen',
    es: 'Certificaciones', // MT
    pt: 'Certificações', // MT
    de: 'Zertifizierungen', // MT
    fr: 'Certifications', // MT
  },
  spoken_at_events: {
    en: 'Spoken at events',
    nl: 'Gesproken op evenementen',
    es: 'Ha hablado en eventos', // MT
    pt: 'Palestrou em eventos', // MT
    de: 'Auftritte bei Events', // MT
    fr: 'Interventions en événements', // MT
  },
  // ── per-app curator tabs (person) ─────────────────────────────────────
  curator_owned_pre: {
    en: 'Curator fields below are owned by',
    nl: 'De curatorvelden hieronder zijn eigendom van',
    es: 'Los campos de curador de abajo pertenecen a', // MT
    pt: 'Os campos de curador abaixo pertencem a', // MT
    de: 'Die Kuratorfelder unten gehören', // MT
    fr: 'Les champs de curateur ci-dessous appartiennent à', // MT
  },
  curator_owned_post: {
    en: "— they only exist because this app justifies them. Workspace members without access to {app} don't see them.",
    nl: '— ze bestaan alleen omdat deze app ze rechtvaardigt. Werkruimteleden zonder toegang tot {app} zien ze niet.',
    es: '— solo existen porque esta app los justifica. Los miembros del espacio sin acceso a {app} no los ven.', // MT
    pt: '— eles só existem porque este app os justifica. Membros do espaço sem acesso ao {app} não os veem.', // MT
    de: '— sie existieren nur, weil diese App sie rechtfertigt. Workspace-Mitglieder ohne Zugriff auf {app} sehen sie nicht.', // MT
    fr: "— ils n'existent que parce que cette app les justifie. Les membres de l'espace sans accès à {app} ne les voient pas.", // MT
  },
  no_curator_fields: {
    en: 'No curator fields yet for {app}. Activity from this app will appear below.',
    nl: 'Nog geen curatorvelden voor {app}. Activiteit van deze app verschijnt hieronder.',
    es: 'Aún no hay campos de curador para {app}. La actividad de esta app aparecerá abajo.', // MT
    pt: 'Ainda não há campos de curador para {app}. A atividade deste app aparecerá abaixo.', // MT
    de: 'Noch keine Kuratorfelder für {app}. Aktivität dieser App erscheint unten.', // MT
    fr: "Pas encore de champs de curateur pour {app}. L'activité de cette app apparaîtra ci-dessous.", // MT
  },
  activity_from: {
    en: 'Activity from {app}',
    nl: 'Activiteit van {app}',
    es: 'Actividad de {app}', // MT
    pt: 'Atividade de {app}', // MT
    de: 'Aktivität von {app}', // MT
    fr: 'Activité de {app}', // MT
  },
  no_activity_from: {
    en: 'No activity yet from {app}.',
    nl: 'Nog geen activiteit van {app}.',
    es: 'Aún no hay actividad de {app}.', // MT
    pt: 'Ainda não há atividade de {app}.', // MT
    de: 'Noch keine Aktivität von {app}.', // MT
    fr: "Pas encore d'activité de {app}.", // MT
  },
  invoicing: {
    en: 'Invoicing',
    nl: 'Facturering',
    es: 'Facturación', // MT
    pt: 'Faturamento', // MT
    de: 'Rechnungsstellung', // MT
    fr: 'Facturation', // MT
  },
  tax_vat_id: {
    en: 'Tax / VAT ID',
    nl: 'Btw-nummer',
    es: 'NIF / IVA', // MT
    pt: 'CNPJ / IVA', // MT
    de: 'Steuer-/USt-ID', // MT
    fr: 'N° fiscal / TVA', // MT
  },
  billing_email: {
    en: 'Billing email',
    nl: 'Factuur-e-mail',
    es: 'Correo de facturación', // MT
    pt: 'E-mail de cobrança', // MT
    de: 'Rechnungs-E-Mail', // MT
    fr: 'E-mail de facturation', // MT
  },
  currency: {
    en: 'Currency',
    nl: 'Valuta',
    es: 'Moneda', // MT
    pt: 'Moeda', // MT
    de: 'Währung', // MT
    fr: 'Devise', // MT
  },
  currency_iso: {
    en: 'Currency (ISO 3-letter)',
    nl: 'Valuta (ISO, 3 letters)',
    es: 'Moneda (ISO, 3 letras)', // MT
    pt: 'Moeda (ISO, 3 letras)', // MT
    de: 'Währung (ISO, 3 Buchstaben)', // MT
    fr: 'Devise (ISO, 3 lettres)', // MT
  },
  payment_terms: {
    en: 'Payment terms',
    nl: 'Betaaltermijn',
    es: 'Condiciones de pago', // MT
    pt: 'Condições de pagamento', // MT
    de: 'Zahlungsziel', // MT
    fr: 'Conditions de paiement', // MT
  },
  payment_terms_days: {
    en: 'Payment terms (days)',
    nl: 'Betaaltermijn (dagen)',
    es: 'Condiciones de pago (días)', // MT
    pt: 'Condições de pagamento (dias)', // MT
    de: 'Zahlungsziel (Tage)', // MT
    fr: 'Conditions de paiement (jours)', // MT
  },
  n_days: {
    en: '{n} days',
    nl: '{n} dagen',
    es: '{n} días', // MT
    pt: '{n} dias', // MT
    de: '{n} Tage', // MT
    fr: '{n} jours', // MT
  },
  po_required: {
    en: 'PO required',
    nl: 'Inkooporder vereist',
    es: 'Requiere orden de compra', // MT
    pt: 'Exige ordem de compra', // MT
    de: 'Bestellnummer nötig', // MT
    fr: 'Bon de commande requis', // MT
  },
  po_required_label: {
    en: 'Purchase order required',
    nl: 'Inkooporder vereist',
    es: 'Se requiere orden de compra', // MT
    pt: 'Ordem de compra obrigatória', // MT
    de: 'Bestellung (PO) erforderlich', // MT
    fr: 'Bon de commande requis', // MT
  },
  billing_address: {
    en: 'Billing address',
    nl: 'Factuuradres',
    es: 'Dirección de facturación', // MT
    pt: 'Endereço de cobrança', // MT
    de: 'Rechnungsadresse', // MT
    fr: 'Adresse de facturation', // MT
  },
  billing_location: {
    en: 'Billing location',
    nl: 'Factuurlocatie',
    es: 'Ubicación de facturación', // MT
    pt: 'Localização de cobrança', // MT
    de: 'Rechnungsort', // MT
    fr: 'Lieu de facturation', // MT
  },
  billing_street: {
    en: 'Billing street',
    nl: 'Factuurstraat',
    es: 'Calle de facturación', // MT
    pt: 'Rua de cobrança', // MT
    de: 'Rechnungsstraße', // MT
    fr: 'Rue de facturation', // MT
  },
  if_different_display_name: {
    en: 'If different from display name',
    nl: 'Indien anders dan de weergavenaam',
    es: 'Si difiere del nombre visible', // MT
    pt: 'Se diferente do nome de exibição', // MT
    de: 'Falls abweichend vom Anzeigenamen', // MT
    fr: "Si différent du nom affiché", // MT
  },
  edit_invoicing_details: {
    en: 'Edit invoicing details — Sales',
    nl: 'Factuurgegevens bewerken — Sales',
    es: 'Editar datos de facturación — Sales', // MT
    pt: 'Editar dados de faturamento — Sales', // MT
    de: 'Rechnungsdaten bearbeiten — Sales', // MT
    fr: 'Modifier les données de facturation — Sales', // MT
  },
  change_context: {
    en: 'Change context',
    nl: 'Verandercontext',
    es: 'Contexto de cambio', // MT
    pt: 'Contexto de mudança', // MT
    de: 'Veränderungskontext', // MT
    fr: 'Contexte de changement', // MT
  },
  edit_change_context: {
    en: 'Edit change context — Meet',
    nl: 'Verandercontext bewerken — Meet',
    es: 'Editar contexto de cambio — Meet', // MT
    pt: 'Editar contexto de mudança — Meet', // MT
    de: 'Veränderungskontext bearbeiten — Meet', // MT
    fr: 'Modifier le contexte de changement — Meet', // MT
  },
  role_in_change: {
    en: 'Role in change',
    nl: 'Rol in de verandering',
    es: 'Rol en el cambio', // MT
    pt: 'Papel na mudança', // MT
    de: 'Rolle im Wandel', // MT
    fr: 'Rôle dans le changement', // MT
  },
  change_role_sponsor: {
    en: 'Sponsor',
    nl: 'Sponsor',
    es: 'Patrocinador', // MT
    pt: 'Patrocinador', // MT
    de: 'Sponsor', // MT
    fr: 'Sponsor', // MT
  },
  change_role_implementer: {
    en: 'Implementer',
    nl: 'Uitvoerder',
    es: 'Implementador', // MT
    pt: 'Implementador', // MT
    de: 'Umsetzer', // MT
    fr: 'Exécutant', // MT
  },
  change_role_sceptic: {
    en: 'Sceptic',
    nl: 'Scepticus',
    es: 'Escéptico', // MT
    pt: 'Cético', // MT
    de: 'Skeptiker', // MT
    fr: 'Sceptique', // MT
  },
  change_role_bystander: {
    en: 'Bystander',
    nl: 'Toeschouwer',
    es: 'Espectador', // MT
    pt: 'Espectador', // MT
    de: 'Zuschauer', // MT
    fr: 'Spectateur', // MT
  },
  change_role_gatekeeper: {
    en: 'Gatekeeper',
    nl: 'Poortwachter',
    es: 'Guardián', // MT
    pt: 'Guardião', // MT
    de: 'Torwächter', // MT
    fr: 'Gardien', // MT
  },
  stance: {
    en: 'Stance',
    nl: 'Houding',
    es: 'Postura', // MT
    pt: 'Postura', // MT
    de: 'Haltung', // MT
    fr: 'Position', // MT
  },
  stance_on_change: {
    en: 'Stance on change',
    nl: 'Houding tegenover verandering',
    es: 'Postura ante el cambio', // MT
    pt: 'Postura diante da mudança', // MT
    de: 'Haltung zum Wandel', // MT
    fr: 'Position face au changement', // MT
  },
  stance_driving: {
    en: 'Driving',
    nl: 'Drijvend',
    es: 'Impulsora', // MT
    pt: 'Impulsionadora', // MT
    de: 'Treibend', // MT
    fr: 'Motrice', // MT
  },
  stance_supporting: {
    en: 'Supporting',
    nl: 'Ondersteunend',
    es: 'De apoyo', // MT
    pt: 'De apoio', // MT
    de: 'Unterstützend', // MT
    fr: 'De soutien', // MT
  },
  stance_ambivalent: {
    en: 'Ambivalent',
    nl: 'Ambivalent',
    es: 'Ambivalente', // MT
    pt: 'Ambivalente', // MT
    de: 'Ambivalent', // MT
    fr: 'Ambivalente', // MT
  },
  stance_resistant: {
    en: 'Resistant',
    nl: 'Weerstand',
    es: 'Resistente', // MT
    pt: 'Resistente', // MT
    de: 'Ablehnend', // MT
    fr: 'Résistante', // MT
  },
  readiness: {
    en: 'Readiness',
    nl: 'Gereedheid',
    es: 'Preparación', // MT
    pt: 'Prontidão', // MT
    de: 'Bereitschaft', // MT
    fr: 'Préparation', // MT
  },
  readiness_level: {
    en: 'Readiness level',
    nl: 'Gereedheidsniveau',
    es: 'Nivel de preparación', // MT
    pt: 'Nível de prontidão', // MT
    de: 'Bereitschaftsgrad', // MT
    fr: 'Niveau de préparation', // MT
  },
  readiness_not_ready: {
    en: 'Not ready',
    nl: 'Niet klaar',
    es: 'No preparado', // MT
    pt: 'Não pronto', // MT
    de: 'Nicht bereit', // MT
    fr: 'Pas prêt', // MT
  },
  readiness_cautious: {
    en: 'Cautious',
    nl: 'Voorzichtig',
    es: 'Cauteloso', // MT
    pt: 'Cauteloso', // MT
    de: 'Vorsichtig', // MT
    fr: 'Prudent', // MT
  },
  readiness_open: {
    en: 'Open',
    nl: 'Open',
    es: 'Abierto', // MT
    pt: 'Aberto', // MT
    de: 'Offen', // MT
    fr: 'Ouvert', // MT
  },
  readiness_ready: {
    en: 'Ready',
    nl: 'Klaar',
    es: 'Preparado', // MT
    pt: 'Pronto', // MT
    de: 'Bereit', // MT
    fr: 'Prêt', // MT
  },
  leadership_style: {
    en: 'Leadership style',
    nl: 'Leiderschapsstijl',
    es: 'Estilo de liderazgo', // MT
    pt: 'Estilo de liderança', // MT
    de: 'Führungsstil', // MT
    fr: 'Style de leadership', // MT
  },
  change_themes: {
    en: 'Change themes',
    nl: 'Veranderthema’s',
    es: 'Temas de cambio', // MT
    pt: 'Temas de mudança', // MT
    de: 'Veränderungsthemen', // MT
    fr: 'Thèmes de changement', // MT
  },
  blockers: {
    en: 'Blockers',
    nl: 'Blokkades',
    es: 'Bloqueos', // MT
    pt: 'Bloqueios', // MT
    de: 'Blockaden', // MT
    fr: 'Blocages', // MT
  },
  motivators: {
    en: 'Motivators',
    nl: 'Drijfveren',
    es: 'Motivadores', // MT
    pt: 'Motivadores', // MT
    de: 'Motivatoren', // MT
    fr: 'Motivations', // MT
  },
  current_challenge: {
    en: 'Current challenge',
    nl: 'Huidige uitdaging',
    es: 'Reto actual', // MT
    pt: 'Desafio atual', // MT
    de: 'Aktuelle Herausforderung', // MT
    fr: 'Défi actuel', // MT
  },
  facilitator_notes: {
    en: 'Facilitator notes',
    nl: 'Facilitatornotities',
    es: 'Notas del facilitador', // MT
    pt: 'Notas do facilitador', // MT
    de: 'Moderatorennotizen', // MT
    fr: 'Notes du facilitateur', // MT
  },
  facilitator_notes_hint: {
    en: 'Only you and workspace admins see this. Per brief §5.D2.',
    nl: 'Alleen jij en werkruimtebeheerders zien dit. Volgens brief §5.D2.',
    es: 'Solo tú y los admins del espacio lo ven. Según el brief §5.D2.', // MT
    pt: 'Só você e os admins do espaço veem isto. Conforme o brief §5.D2.', // MT
    de: 'Nur du und Workspace-Admins sehen das. Gemäß Brief §5.D2.', // MT
    fr: "Seuls toi et les admins de l'espace le voient. Selon le brief §5.D2.", // MT
  },
  relationship_context: {
    en: 'Relationship context',
    nl: 'Relatiecontext',
    es: 'Contexto de la relación', // MT
    pt: 'Contexto da relação', // MT
    de: 'Beziehungskontext', // MT
    fr: 'Contexte de la relation', // MT
  },
  edit_relationship_context: {
    en: 'Edit relationship context — Sales',
    nl: 'Relatiecontext bewerken — Sales',
    es: 'Editar contexto de la relación — Sales', // MT
    pt: 'Editar contexto da relação — Sales', // MT
    de: 'Beziehungskontext bearbeiten — Sales', // MT
    fr: 'Modifier le contexte de la relation — Sales', // MT
  },
  source: {
    en: 'Source',
    nl: 'Bron',
    es: 'Origen', // MT
    pt: 'Origem', // MT
    de: 'Quelle', // MT
    fr: 'Source', // MT
  },
  source_detail: {
    en: 'Source detail',
    nl: 'Brondetail',
    es: 'Detalle del origen', // MT
    pt: 'Detalhe da origem', // MT
    de: 'Quellendetail', // MT
    fr: 'Détail de la source', // MT
  },
  source_event_attendee: {
    en: 'Event attendee',
    nl: 'Evenementbezoeker',
    es: 'Asistente a evento', // MT
    pt: 'Participante de evento', // MT
    de: 'Event-Teilnehmer', // MT
    fr: "Participant d'événement", // MT
  },
  source_referral: {
    en: 'Referral',
    nl: 'Doorverwijzing',
    es: 'Recomendación', // MT
    pt: 'Indicação', // MT
    de: 'Empfehlung', // MT
    fr: 'Recommandation', // MT
  },
  source_cold_outreach: {
    en: 'Cold outreach',
    nl: 'Koude benadering',
    es: 'Contacto en frío', // MT
    pt: 'Contato frio', // MT
    de: 'Kaltakquise', // MT
    fr: 'Prospection à froid', // MT
  },
  source_client_contact: {
    en: 'Client contact',
    nl: 'Klantcontact',
    es: 'Contacto de cliente', // MT
    pt: 'Contato de cliente', // MT
    de: 'Kundenkontakt', // MT
    fr: 'Contact client', // MT
  },
  source_inbound: {
    en: 'Inbound',
    nl: 'Inkomend',
    es: 'Entrante', // MT
    pt: 'Entrada espontânea', // MT
    de: 'Eingehend', // MT
    fr: 'Entrant', // MT
  },
  introduced_by: {
    en: 'Introduced by',
    nl: 'Geïntroduceerd door',
    es: 'Presentado por', // MT
    pt: 'Apresentado por', // MT
    de: 'Vorgestellt von', // MT
    fr: 'Présenté par', // MT
  },
  person_uuid_optional: {
    en: 'Person UUID, optional',
    nl: 'Persoons-UUID, optioneel',
    es: 'UUID de persona, opcional', // MT
    pt: 'UUID da pessoa, opcional', // MT
    de: 'Personen-UUID, optional', // MT
    fr: 'UUID de personne, facultatif', // MT
  },
  strength: {
    en: 'Strength',
    nl: 'Sterkte',
    es: 'Fuerza', // MT
    pt: 'Força', // MT
    de: 'Stärke', // MT
    fr: 'Force', // MT
  },
  relationship_strength: {
    en: 'Relationship strength',
    nl: 'Sterkte van de relatie',
    es: 'Fuerza de la relación', // MT
    pt: 'Força da relação', // MT
    de: 'Beziehungsstärke', // MT
    fr: 'Force de la relation', // MT
  },
  strength_weak: {
    en: 'Weak',
    nl: 'Zwak',
    es: 'Débil', // MT
    pt: 'Fraca', // MT
    de: 'Schwach', // MT
    fr: 'Faible', // MT
  },
  strength_warm: {
    en: 'Warm',
    nl: 'Warm',
    es: 'Cálida', // MT
    pt: 'Morna', // MT
    de: 'Warm', // MT
    fr: 'Chaleureuse', // MT
  },
  strength_strong: {
    en: 'Strong',
    nl: 'Sterk',
    es: 'Fuerte', // MT
    pt: 'Forte', // MT
    de: 'Stark', // MT
    fr: 'Forte', // MT
  },
  strength_advocate: {
    en: 'Advocate',
    nl: 'Ambassadeur',
    es: 'Promotor', // MT
    pt: 'Promotor', // MT
    de: 'Fürsprecher', // MT
    fr: 'Prescripteur', // MT
  },
  communication_preference: {
    en: 'Communication preference',
    nl: 'Communicatievoorkeur',
    es: 'Preferencia de comunicación', // MT
    pt: 'Preferência de comunicação', // MT
    de: 'Kommunikationspräferenz', // MT
    fr: 'Préférence de communication', // MT
  },
  comm_linkedin: {
    en: 'LinkedIn',
    nl: 'LinkedIn',
    es: 'LinkedIn', // MT
    pt: 'LinkedIn', // MT
    de: 'LinkedIn', // MT
    fr: 'LinkedIn', // MT
  },
  comm_in_person: {
    en: 'In person',
    nl: 'In persoon',
    es: 'En persona', // MT
    pt: 'Pessoalmente', // MT
    de: 'Persönlich', // MT
    fr: 'En personne', // MT
  },
  best_time_to_reach: {
    en: 'Best time to reach',
    nl: 'Beste moment om te bereiken',
    es: 'Mejor momento para contactar', // MT
    pt: 'Melhor horário para contato', // MT
    de: 'Beste Erreichbarkeit', // MT
    fr: 'Meilleur moment pour joindre', // MT
  },
  best_time_ph: {
    en: 'Tuesday afternoons',
    nl: 'Dinsdagmiddagen',
    es: 'Los martes por la tarde', // MT
    pt: 'Terças à tarde', // MT
    de: 'Dienstagnachmittage', // MT
    fr: 'Le mardi après-midi', // MT
  },
  key_contact: {
    en: 'Key contact',
    nl: 'Sleutelcontact',
    es: 'Contacto clave', // MT
    pt: 'Contato-chave', // MT
    de: 'Schlüsselkontakt', // MT
    fr: 'Contact clé', // MT
  },
  ambassador: {
    en: 'Ambassador',
    nl: 'Ambassadeur',
    es: 'Embajador', // MT
    pt: 'Embaixador', // MT
    de: 'Botschafter', // MT
    fr: 'Ambassadeur', // MT
  },
  first_contact: {
    en: 'First contact',
    nl: 'Eerste contact',
    es: 'Primer contacto', // MT
    pt: 'Primeiro contato', // MT
    de: 'Erstkontakt', // MT
    fr: 'Premier contact', // MT
  },
  first_contact_at: {
    en: 'First contact at',
    nl: 'Eerste contact op',
    es: 'Primer contacto el', // MT
    pt: 'Primeiro contato em', // MT
    de: 'Erstkontakt am', // MT
    fr: 'Premier contact le', // MT
  },
  first_contact_notes: {
    en: 'First contact notes',
    nl: 'Notities eerste contact',
    es: 'Notas del primer contacto', // MT
    pt: 'Notas do primeiro contato', // MT
    de: 'Notizen zum Erstkontakt', // MT
    fr: 'Notes du premier contact', // MT
  },
  learning_profile: {
    en: 'Learning profile',
    nl: 'Leerprofiel',
    es: 'Perfil de aprendizaje', // MT
    pt: 'Perfil de aprendizagem', // MT
    de: 'Lernprofil', // MT
    fr: "Profil d'apprentissage", // MT
  },
  edit_learning_profile: {
    en: 'Edit learning profile — Learn',
    nl: 'Leerprofiel bewerken — Learn',
    es: 'Editar perfil de aprendizaje — Learn', // MT
    pt: 'Editar perfil de aprendizagem — Learn', // MT
    de: 'Lernprofil bearbeiten — Learn', // MT
    fr: "Modifier le profil d'apprentissage — Learn", // MT
  },
  learning_style: {
    en: 'Learning style',
    nl: 'Leerstijl',
    es: 'Estilo de aprendizaje', // MT
    pt: 'Estilo de aprendizagem', // MT
    de: 'Lernstil', // MT
    fr: "Style d'apprentissage", // MT
  },
  learning_visual: {
    en: 'Visual',
    nl: 'Visueel',
    es: 'Visual', // MT
    pt: 'Visual', // MT
    de: 'Visuell', // MT
    fr: 'Visuel', // MT
  },
  learning_auditory: {
    en: 'Auditory',
    nl: 'Auditief',
    es: 'Auditivo', // MT
    pt: 'Auditivo', // MT
    de: 'Auditiv', // MT
    fr: 'Auditif', // MT
  },
  learning_reading: {
    en: 'Reading',
    nl: 'Lezend',
    es: 'Lector', // MT
    pt: 'Leitura', // MT
    de: 'Lesend', // MT
    fr: 'Lecture', // MT
  },
  learning_kinaesthetic: {
    en: 'Kinaesthetic',
    nl: 'Kinesthetisch',
    es: 'Kinestésico', // MT
    pt: 'Cinestésico', // MT
    de: 'Kinästhetisch', // MT
    fr: 'Kinesthésique', // MT
  },
  learning_reflective: {
    en: 'Reflective',
    nl: 'Reflectief',
    es: 'Reflexivo', // MT
    pt: 'Reflexivo', // MT
    de: 'Reflektierend', // MT
    fr: 'Réflexif', // MT
  },
  group_role_tendency: {
    en: 'Group role tendency',
    nl: 'Groepsrolneiging',
    es: 'Tendencia de rol en grupo', // MT
    pt: 'Tendência de papel em grupo', // MT
    de: 'Gruppenrollen-Tendenz', // MT
    fr: 'Tendance de rôle en groupe', // MT
  },
  group_connector: {
    en: 'Connector',
    nl: 'Verbinder',
    es: 'Conector', // MT
    pt: 'Conector', // MT
    de: 'Verbinder', // MT
    fr: 'Connecteur', // MT
  },
  group_challenger: {
    en: 'Challenger',
    nl: 'Uitdager',
    es: 'Retador', // MT
    pt: 'Desafiador', // MT
    de: 'Herausforderer', // MT
    fr: 'Challenger', // MT
  },
  group_synthesiser: {
    en: 'Synthesiser',
    nl: 'Synthesemaker',
    es: 'Sintetizador', // MT
    pt: 'Sintetizador', // MT
    de: 'Synthetisierer', // MT
    fr: 'Synthétiseur', // MT
  },
  group_anchor: {
    en: 'Anchor',
    nl: 'Anker',
    es: 'Ancla', // MT
    pt: 'Âncora', // MT
    de: 'Anker', // MT
    fr: 'Ancre', // MT
  },
  group_observer: {
    en: 'Observer',
    nl: 'Waarnemer',
    es: 'Observador', // MT
    pt: 'Observador', // MT
    de: 'Beobachter', // MT
    fr: 'Observateur', // MT
  },
  open_to_coaching: {
    en: 'Open to coaching',
    nl: 'Open voor coaching',
    es: 'Abierto al coaching', // MT
    pt: 'Aberto a coaching', // MT
    de: 'Offen für Coaching', // MT
    fr: 'Ouvert au coaching', // MT
  },
  open_to_peer_exchange: {
    en: 'Open to peer exchange',
    nl: 'Open voor uitwisseling met peers',
    es: 'Abierto al intercambio entre pares', // MT
    pt: 'Aberto à troca entre pares', // MT
    de: 'Offen für Peer-Austausch', // MT
    fr: "Ouvert à l'échange entre pairs", // MT
  },
  learning_interests: {
    en: 'Learning interests',
    nl: 'Leerinteresses',
    es: 'Intereses de aprendizaje', // MT
    pt: 'Interesses de aprendizagem', // MT
    de: 'Lerninteressen', // MT
    fr: "Intérêts d'apprentissage", // MT
  },
  prior_programmes: {
    en: 'Prior programmes',
    nl: "Eerdere programma's",
    es: 'Programas previos', // MT
    pt: 'Programas anteriores', // MT
    de: 'Frühere Programme', // MT
    fr: 'Programmes précédents', // MT
  },
  development_goals: {
    en: 'Development goals',
    nl: 'Ontwikkeldoelen',
    es: 'Objetivos de desarrollo', // MT
    pt: 'Metas de desenvolvimento', // MT
    de: 'Entwicklungsziele', // MT
    fr: 'Objectifs de développement', // MT
  },
  post_programme_reflection: {
    en: 'Post-programme reflection',
    nl: 'Reflectie na het programma',
    es: 'Reflexión posprograma', // MT
    pt: 'Reflexão pós-programa', // MT
    de: 'Reflexion nach dem Programm', // MT
    fr: 'Réflexion post-programme', // MT
  },
  participant_owned: {
    en: 'Participant-owned',
    nl: 'Van de deelnemer',
    es: 'Del participante', // MT
    pt: 'Do participante', // MT
    de: 'Gehört dem Teilnehmenden', // MT
    fr: 'Appartient au participant', // MT
  },
  reflection_hint: {
    en: "Per brief §5.D2 the participant writes this themselves. Don't paste observations here.",
    nl: 'Volgens brief §5.D2 schrijft de deelnemer dit zelf. Plak hier geen observaties.',
    es: 'Según el brief §5.D2 lo escribe el propio participante. No pegues observaciones aquí.', // MT
    pt: 'Conforme o brief §5.D2, o próprio participante escreve isto. Não cole observações aqui.', // MT
    de: 'Gemäß Brief §5.D2 schreibt das der Teilnehmende selbst. Füge hier keine Beobachtungen ein.', // MT
    fr: "Selon le brief §5.D2, le participant l'écrit lui-même. Ne colle pas d'observations ici.", // MT
  },
  // ── Meet + Membership person tabs ─────────────────────────────────────
  meet_tab_blurb: {
    en: "What Meet knows about this person: meetings booked + the host's private notes. Identity (name, email) is owned by the platform.",
    nl: 'Wat Meet over deze persoon weet: geboekte meetings + de privénotities van de host. Identiteit (naam, e-mail) is van het platform.',
    es: 'Lo que Meet sabe de esta persona: reuniones reservadas + las notas privadas del anfitrión. La identidad (nombre, correo) es de la plataforma.', // MT
    pt: 'O que o Meet sabe sobre esta pessoa: reuniões agendadas + as notas privadas do anfitrião. A identidade (nome, e-mail) é da plataforma.', // MT
    de: 'Was Meet über diese Person weiß: gebuchte Meetings + die privaten Notizen des Hosts. Identität (Name, E-Mail) gehört der Plattform.', // MT
    fr: "Ce que Meet sait de cette personne : réunions réservées + les notes privées de l'hôte. L'identité (nom, e-mail) appartient à la plateforme.", // MT
  },
  meet_profile: {
    en: 'Meet profile',
    nl: 'Meet-profiel',
    es: 'Perfil de Meet', // MT
    pt: 'Perfil do Meet', // MT
    de: 'Meet-Profil', // MT
    fr: 'Profil Meet', // MT
  },
  edit_meet_profile: {
    en: 'Edit Meet profile — Meet',
    nl: 'Meet-profiel bewerken — Meet',
    es: 'Editar perfil de Meet — Meet', // MT
    pt: 'Editar perfil do Meet — Meet', // MT
    de: 'Meet-Profil bearbeiten — Meet', // MT
    fr: 'Modifier le profil Meet — Meet', // MT
  },
  blocked: {
    en: 'Blocked',
    nl: 'Geblokkeerd',
    es: 'Bloqueado', // MT
    pt: 'Bloqueado', // MT
    de: 'Blockiert', // MT
    fr: 'Bloqué', // MT
  },
  vip_hint: {
    en: 'Flag so the host treats requests from this person with priority — e.g. auto-approve.',
    nl: 'Vlag zodat de host verzoeken van deze persoon met voorrang behandelt — bijv. automatisch goedkeuren.',
    es: 'Marca para que el anfitrión trate sus solicitudes con prioridad, p. ej. aprobación automática.', // MT
    pt: 'Sinalize para o anfitrião tratar os pedidos desta pessoa com prioridade — p. ex. aprovação automática.', // MT
    de: 'Markierung, damit der Host Anfragen dieser Person mit Priorität behandelt — z. B. automatisch genehmigt.', // MT
    fr: "Marqueur pour que l'hôte traite ses demandes en priorité — p. ex. approbation automatique.", // MT
  },
  blocked_hint: {
    en: "Don't auto-confirm bookings from this email; review manually first.",
    nl: 'Boekingen van dit e-mailadres niet automatisch bevestigen; eerst handmatig beoordelen.',
    es: 'No confirmes automáticamente reservas de este correo; revísalas antes a mano.', // MT
    pt: 'Não confirme automaticamente agendamentos deste e-mail; revise manualmente antes.', // MT
    de: 'Buchungen von dieser E-Mail nicht automatisch bestätigen; erst manuell prüfen.', // MT
    fr: "Ne confirme pas automatiquement les réservations de cet e-mail ; vérifie d'abord à la main.", // MT
  },
  preferred_timezone: {
    en: 'Preferred timezone',
    nl: 'Voorkeurstijdzone',
    es: 'Zona horaria preferida', // MT
    pt: 'Fuso horário preferido', // MT
    de: 'Bevorzugte Zeitzone', // MT
    fr: 'Fuseau horaire préféré', // MT
  },
  timezone_hint: {
    en: 'IANA tz. Used when emailing them slot suggestions.',
    nl: 'IANA-tijdzone. Gebruikt bij het mailen van tijdvoorstellen.',
    es: 'Zona IANA. Se usa al enviarle sugerencias de horarios por correo.', // MT
    pt: 'Fuso IANA. Usado ao enviar sugestões de horários por e-mail.', // MT
    de: 'IANA-Zeitzone. Wird für gemailte Terminvorschläge genutzt.', // MT
    fr: "Fuseau IANA. Utilisé pour l'envoi de créneaux par e-mail.", // MT
  },
  host_notes: {
    en: 'Host notes',
    nl: 'Hostnotities',
    es: 'Notas del anfitrión', // MT
    pt: 'Notas do anfitrião', // MT
    de: 'Host-Notizen', // MT
    fr: "Notes de l'hôte", // MT
  },
  host_notes_hint: {
    en: 'Private. Only workspace members with Meet access see this.',
    nl: 'Privé. Alleen werkruimteleden met Meet-toegang zien dit.',
    es: 'Privado. Solo los miembros del espacio con acceso a Meet lo ven.', // MT
    pt: 'Privado. Só membros do espaço com acesso ao Meet veem isto.', // MT
    de: 'Privat. Nur Workspace-Mitglieder mit Meet-Zugriff sehen das.', // MT
    fr: "Privé. Seuls les membres de l'espace avec accès à Meet le voient.", // MT
  },
  total_meetings: {
    en: 'Total meetings',
    nl: 'Totaal aantal meetings',
    es: 'Reuniones en total', // MT
    pt: 'Total de reuniões', // MT
    de: 'Meetings insgesamt', // MT
    fr: 'Réunions au total', // MT
  },
  upcoming_meetings: {
    en: 'Upcoming meetings',
    nl: 'Komende meetings',
    es: 'Próximas reuniones', // MT
    pt: 'Próximas reuniões', // MT
    de: 'Kommende Meetings', // MT
    fr: 'Réunions à venir', // MT
  },
  no_upcoming_meetings: {
    en: 'No upcoming meetings with this person.',
    nl: 'Geen komende meetings met deze persoon.',
    es: 'No hay próximas reuniones con esta persona.', // MT
    pt: 'Nenhuma reunião futura com esta pessoa.', // MT
    de: 'Keine kommenden Meetings mit dieser Person.', // MT
    fr: 'Aucune réunion à venir avec cette personne.', // MT
  },
  past_meetings: {
    en: 'Past meetings',
    nl: 'Eerdere meetings',
    es: 'Reuniones pasadas', // MT
    pt: 'Reuniões passadas', // MT
    de: 'Vergangene Meetings', // MT
    fr: 'Réunions passées', // MT
  },
  no_past_meetings: {
    en: 'No past meetings with this person.',
    nl: 'Geen eerdere meetings met deze persoon.',
    es: 'No hay reuniones pasadas con esta persona.', // MT
    pt: 'Nenhuma reunião passada com esta pessoa.', // MT
    de: 'Keine vergangenen Meetings mit dieser Person.', // MT
    fr: 'Aucune réunion passée avec cette personne.', // MT
  },
  meeting: {
    en: 'Meeting',
    nl: 'Meeting',
    es: 'Reunión', // MT
    pt: 'Reunião', // MT
    de: 'Meeting', // MT
    fr: 'Réunion', // MT
  },
  membership_tab_blurb: {
    en: 'What Membership knows about this person: tier, status and renewal. Identity (name, email) is owned by the platform.',
    nl: 'Wat Membership over deze persoon weet: tier, status en verlenging. Identiteit (naam, e-mail) is van het platform.',
    es: 'Lo que Membership sabe de esta persona: nivel, estado y renovación. La identidad (nombre, correo) es de la plataforma.', // MT
    pt: 'O que o Membership sabe sobre esta pessoa: nível, status e renovação. A identidade (nome, e-mail) é da plataforma.', // MT
    de: 'Was Membership über diese Person weiß: Stufe, Status und Verlängerung. Identität (Name, E-Mail) gehört der Plattform.', // MT
    fr: "Ce que Membership sait de cette personne : niveau, statut et renouvellement. L'identité (nom, e-mail) appartient à la plateforme.", // MT
  },
  no_membership_data: {
    en: 'No membership data.',
    nl: 'Geen lidmaatschapsgegevens.',
    es: 'Sin datos de membresía.', // MT
    pt: 'Sem dados de associação.', // MT
    de: 'Keine Mitgliedschaftsdaten.', // MT
    fr: "Pas de données d'adhésion.", // MT
  },
  manage_in_membership: {
    en: 'Manage in Membership',
    nl: 'Beheren in Membership',
    es: 'Gestionar en Membership', // MT
    pt: 'Gerenciar no Membership', // MT
    de: 'In Membership verwalten', // MT
    fr: 'Gérer dans Membership', // MT
  },
  tier: {
    en: 'Tier',
    nl: 'Tier',
    es: 'Nivel', // MT
    pt: 'Nível', // MT
    de: 'Stufe', // MT
    fr: 'Niveau', // MT
  },
  member_since: {
    en: 'Member since',
    nl: 'Lid sinds',
    es: 'Miembro desde', // MT
    pt: 'Membro desde', // MT
    de: 'Mitglied seit', // MT
    fr: 'Membre depuis', // MT
  },
  renews_on: {
    en: 'Renews on',
    nl: 'Verlengt op',
    es: 'Se renueva el', // MT
    pt: 'Renova em', // MT
    de: 'Verlängert sich am', // MT
    fr: 'Se renouvelle le', // MT
  },
  lapsed_on: {
    en: 'Lapsed on',
    nl: 'Verlopen op',
    es: 'Caducó el', // MT
    pt: 'Expirou em', // MT
    de: 'Abgelaufen am', // MT
    fr: 'Expirée le', // MT
  },
  member_grace: {
    en: 'Grace',
    nl: 'Coulance',
    es: 'Gracia', // MT
    pt: 'Carência', // MT
    de: 'Kulanz', // MT
    fr: 'Grâce', // MT
  },
  member_lapsed: {
    en: 'Lapsed',
    nl: 'Verlopen',
    es: 'Caducada', // MT
    pt: 'Expirada', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expirée', // MT
  },
  per_year_short: {
    en: '/year',
    nl: '/jaar',
    es: '/año', // MT
    pt: '/ano', // MT
    de: '/Jahr', // MT
    fr: '/an', // MT
  },
  per_month_short: {
    en: '/month',
    nl: '/maand',
    es: '/mes', // MT
    pt: '/mês', // MT
    de: '/Monat', // MT
    fr: '/mois', // MT
  },

  // ── organisations ─────────────────────────────────────────────────────
  add_organisation: {
    en: 'Add organisation',
    nl: 'Organisatie toevoegen',
    es: 'Añadir organización', // MT
    pt: 'Adicionar organização', // MT
    de: 'Organisation hinzufügen', // MT
    fr: 'Ajouter une organisation', // MT
  },
  add_organisation_blurb: {
    en: 'Adds an organisation to your workspace.',
    nl: 'Voegt een organisatie toe aan je werkruimte.',
    es: 'Añade una organización a tu espacio de trabajo.', // MT
    pt: 'Adiciona uma organização ao seu espaço de trabalho.', // MT
    de: 'Fügt deinem Workspace eine Organisation hinzu.', // MT
    fr: 'Ajoute une organisation à ton espace de travail.', // MT
  },
  search_name_domain: {
    en: 'Search name or domain…',
    nl: 'Zoek op naam of domein…',
    es: 'Busca por nombre o dominio…', // MT
    pt: 'Busque por nome ou domínio…', // MT
    de: 'Nach Name oder Domain suchen…', // MT
    fr: 'Cherche un nom ou un domaine…', // MT
  },
  orgs_load_failed: {
    en: "Couldn't load organisations:",
    nl: 'Kon de organisaties niet laden:',
    es: 'No se pudieron cargar las organizaciones:', // MT
    pt: 'Não foi possível carregar as organizações:', // MT
    de: 'Organisationen konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les organisations :', // MT
  },
  no_orgs_yet: {
    en: 'No organisations yet.',
    nl: 'Nog geen organisaties.',
    es: 'Aún no hay organizaciones.', // MT
    pt: 'Ainda não há organizações.', // MT
    de: 'Noch keine Organisationen.', // MT
    fr: "Pas encore d'organisations.", // MT
  },
  domain: {
    en: 'Domain',
    nl: 'Domein',
    es: 'Dominio', // MT
    pt: 'Domínio', // MT
    de: 'Domain', // MT
    fr: 'Domaine', // MT
  },
  website: {
    en: 'Website',
    nl: 'Website',
    es: 'Sitio web', // MT
    pt: 'Site', // MT
    de: 'Website', // MT
    fr: 'Site web', // MT
  },
  size: {
    en: 'Size',
    nl: 'Omvang',
    es: 'Tamaño', // MT
    pt: 'Tamanho', // MT
    de: 'Größe', // MT
    fr: 'Taille', // MT
  },
  industry: {
    en: 'Industry',
    nl: 'Branche',
    es: 'Industria', // MT
    pt: 'Indústria', // MT
    de: 'Branche', // MT
    fr: 'Industrie', // MT
  },
  sector_ph: {
    en: 'Education, government, …',
    nl: 'Onderwijs, overheid, …',
    es: 'Educación, gobierno, …', // MT
    pt: 'Educação, governo, …', // MT
    de: 'Bildung, Verwaltung, …', // MT
    fr: 'Éducation, administration, …', // MT
  },
  org_type_private: {
    en: 'Private',
    nl: 'Privaat',
    es: 'Privada', // MT
    pt: 'Privada', // MT
    de: 'Privat', // MT
    fr: 'Privée', // MT
  },
  org_type_public: {
    en: 'Public',
    nl: 'Publiek',
    es: 'Pública', // MT
    pt: 'Pública', // MT
    de: 'Öffentlich', // MT
    fr: 'Publique', // MT
  },
  org_type_ngo: {
    en: 'NGO',
    nl: 'Ngo',
    es: 'ONG', // MT
    pt: 'ONG', // MT
    de: 'NGO', // MT
    fr: 'ONG', // MT
  },
  org_type_cooperative: {
    en: 'Cooperative',
    nl: 'Coöperatie',
    es: 'Cooperativa', // MT
    pt: 'Cooperativa', // MT
    de: 'Genossenschaft', // MT
    fr: 'Coopérative', // MT
  },
  org_type_government: {
    en: 'Government',
    nl: 'Overheid',
    es: 'Gobierno', // MT
    pt: 'Governo', // MT
    de: 'Behörde', // MT
    fr: 'Gouvernement', // MT
  },
  org_type_education: {
    en: 'Education',
    nl: 'Onderwijs',
    es: 'Educación', // MT
    pt: 'Educação', // MT
    de: 'Bildung', // MT
    fr: 'Éducation', // MT
  },
  edit_organisation: {
    en: 'Edit organisation',
    nl: 'Organisatie bewerken',
    es: 'Editar organización', // MT
    pt: 'Editar organização', // MT
    de: 'Organisation bearbeiten', // MT
    fr: "Modifier l'organisation", // MT
  },
  delete_organisation: {
    en: 'Delete organisation',
    nl: 'Organisatie verwijderen',
    es: 'Eliminar organización', // MT
    pt: 'Excluir organização', // MT
    de: 'Organisation löschen', // MT
    fr: "Supprimer l'organisation", // MT
  },
  delete_organisation_msg: {
    en: 'Soft-delete {name}? Records stay in the database (deleted_at flag) — only a GDPR erasure removes them.',
    nl: '{name} soft-deleten? Records blijven in de database (deleted_at-vlag) — alleen een AVG-verwijdering haalt ze weg.',
    es: '¿Borrado suave de {name}? Los registros se quedan en la base de datos (marca deleted_at); solo una supresión RGPD los elimina.', // MT
    pt: 'Soft delete de {name}? Os registros ficam no banco (flag deleted_at) — só um apagamento GDPR os remove.', // MT
    de: '{name} soft-löschen? Einträge bleiben in der Datenbank (deleted_at-Flag) — nur eine DSGVO-Löschung entfernt sie.', // MT
    fr: 'Suppression douce de {name} ? Les enregistrements restent en base (drapeau deleted_at) — seul un effacement RGPD les retire.', // MT
  },
  logo_url: {
    en: 'Logo URL',
    nl: 'Logo-URL',
    es: 'URL del logo', // MT
    pt: 'URL do logo', // MT
    de: 'Logo-URL', // MT
    fr: 'URL du logo', // MT
  },
  logo_url_hint: {
    en: "Public URL of the org's logo. Hosted externally for now — file upload coming later.",
    nl: 'Publieke URL van het logo van de organisatie. Voorlopig extern gehost — bestandsupload komt later.',
    es: 'URL pública del logo de la organización. Alojado externamente por ahora; la subida de archivos llegará más adelante.', // MT
    pt: 'URL pública do logo da organização. Hospedado externamente por enquanto — upload de arquivo vem depois.', // MT
    de: 'Öffentliche URL des Organisationslogos. Vorerst extern gehostet — Datei-Upload kommt später.', // MT
    fr: "URL publique du logo de l'organisation. Hébergé en externe pour l'instant — l'upload de fichier viendra plus tard.", // MT
  },
  domain_verification: {
    en: 'Domain verification',
    nl: 'Domeinverificatie',
    es: 'Verificación de dominio', // MT
    pt: 'Verificação de domínio', // MT
    de: 'Domain-Verifizierung', // MT
    fr: 'Vérification de domaine', // MT
  },
  add_domain_first: {
    en: 'Add a domain in the org edit dialog to enable DNS verification.',
    nl: 'Voeg een domein toe in het bewerkvenster van de organisatie om DNS-verificatie aan te zetten.',
    es: 'Añade un dominio en el diálogo de edición de la organización para activar la verificación DNS.', // MT
    pt: 'Adicione um domínio no diálogo de edição da organização para habilitar a verificação DNS.', // MT
    de: 'Füge im Bearbeitungsdialog der Organisation eine Domain hinzu, um die DNS-Verifizierung zu aktivieren.', // MT
    fr: "Ajoute un domaine dans la boîte de dialogue d'édition de l'organisation pour activer la vérification DNS.", // MT
  },
  verified: {
    en: 'Verified',
    nl: 'Geverifieerd',
    es: 'Verificado', // MT
    pt: 'Verificado', // MT
    de: 'Verifiziert', // MT
    fr: 'Vérifié', // MT
  },
  not_verified: {
    en: 'Not verified',
    nl: 'Niet geverifieerd',
    es: 'No verificado', // MT
    pt: 'Não verificado', // MT
    de: 'Nicht verifiziert', // MT
    fr: 'Non vérifié', // MT
  },
  on_date: {
    en: 'on',
    nl: 'op',
    es: 'el', // MT
    pt: 'em', // MT
    de: 'am', // MT
    fr: 'le', // MT
  },
  generating_challenge: {
    en: 'Generating challenge…',
    nl: 'Challenge genereren…',
    es: 'Generando desafío…', // MT
    pt: 'Gerando desafio…', // MT
    de: 'Challenge wird erzeugt…', // MT
    fr: 'Génération du défi…', // MT
  },
  start_dns_verification: {
    en: 'Start DNS verification',
    nl: 'DNS-verificatie starten',
    es: 'Iniciar verificación DNS', // MT
    pt: 'Iniciar verificação DNS', // MT
    de: 'DNS-Verifizierung starten', // MT
    fr: 'Démarrer la vérification DNS', // MT
  },
  dns_challenge_blurb: {
    en: "We'll generate a one-time challenge value. You publish it as a TXT record on your DNS, then click Check.",
    nl: 'We genereren een eenmalige challengewaarde. Jij publiceert die als TXT-record in je DNS en klikt daarna op Controleren.',
    es: 'Generamos un valor de desafío de un solo uso. Lo publicas como registro TXT en tu DNS y luego haces clic en Comprobar.', // MT
    pt: 'Geramos um valor de desafio de uso único. Você o publica como registro TXT no seu DNS e depois clica em Verificar.', // MT
    de: 'Wir erzeugen einen einmaligen Challenge-Wert. Du veröffentlichst ihn als TXT-Eintrag in deinem DNS und klickst dann auf Prüfen.', // MT
    fr: "Nous générons une valeur de défi à usage unique. Tu la publies en enregistrement TXT dans ton DNS, puis tu cliques sur Vérifier.", // MT
  },
  step1_txt_record: {
    en: 'Step 1 — add this TXT record',
    nl: 'Stap 1 — voeg dit TXT-record toe',
    es: 'Paso 1: añade este registro TXT', // MT
    pt: 'Passo 1 — adicione este registro TXT', // MT
    de: 'Schritt 1 — füge diesen TXT-Eintrag hinzu', // MT
    fr: 'Étape 1 — ajoute cet enregistrement TXT', // MT
  },
  step2_check: {
    en: 'Step 2 — check',
    nl: 'Stap 2 — controleren',
    es: 'Paso 2: comprobar', // MT
    pt: 'Passo 2 — verificar', // MT
    de: 'Schritt 2 — prüfen', // MT
    fr: 'Étape 2 — vérifier', // MT
  },
  name_host: {
    en: 'Name / Host',
    nl: 'Naam / host',
    es: 'Nombre / host', // MT
    pt: 'Nome / host', // MT
    de: 'Name / Host', // MT
    fr: 'Nom / hôte', // MT
  },
  value: {
    en: 'Value',
    nl: 'Waarde',
    es: 'Valor', // MT
    pt: 'Valor', // MT
    de: 'Wert', // MT
    fr: 'Valeur', // MT
  },
  ttl_default: {
    en: '300 (or your default)',
    nl: '300 (of je standaard)',
    es: '300 (o tu valor por defecto)', // MT
    pt: '300 (ou seu padrão)', // MT
    de: '300 (oder dein Standard)', // MT
    fr: '300 (ou ta valeur par défaut)', // MT
  },
  dns_propagation_note: {
    en: 'DNS propagation usually takes a few minutes. If it fails, wait and try again.',
    nl: 'DNS-propagatie duurt meestal een paar minuten. Mislukt het, wacht dan even en probeer opnieuw.',
    es: 'La propagación DNS suele tardar unos minutos. Si falla, espera y vuelve a intentarlo.', // MT
    pt: 'A propagação DNS costuma levar alguns minutos. Se falhar, espere e tente de novo.', // MT
    de: 'DNS-Propagierung dauert meist ein paar Minuten. Schlägt es fehl, warte und versuch es erneut.', // MT
    fr: 'La propagation DNS prend en général quelques minutes. En cas d’échec, attends et réessaie.', // MT
  },
  checking: {
    en: 'Checking…',
    nl: 'Controleren…',
    es: 'Comprobando…', // MT
    pt: 'Verificando…', // MT
    de: 'Wird geprüft…', // MT
    fr: 'Vérification…', // MT
  },
  check_dns: {
    en: 'Check DNS',
    nl: 'DNS controleren',
    es: 'Comprobar DNS', // MT
    pt: 'Verificar DNS', // MT
    de: 'DNS prüfen', // MT
    fr: 'Vérifier le DNS', // MT
  },
  generate_new_challenge: {
    en: 'Generate a new challenge',
    nl: 'Nieuwe challenge genereren',
    es: 'Generar un nuevo desafío', // MT
    pt: 'Gerar um novo desafio', // MT
    de: 'Neue Challenge erzeugen', // MT
    fr: 'Générer un nouveau défi', // MT
  },
  reissuing: {
    en: 'Re-issuing…',
    nl: 'Opnieuw uitgeven…',
    es: 'Reemitiendo…', // MT
    pt: 'Reemitindo…', // MT
    de: 'Wird neu ausgestellt…', // MT
    fr: 'Réémission…', // MT
  },
  reverify: {
    en: 'Re-verify (issues a new challenge)',
    nl: 'Opnieuw verifiëren (geeft een nieuwe challenge uit)',
    es: 'Volver a verificar (emite un nuevo desafío)', // MT
    pt: 'Verificar de novo (emite um novo desafio)', // MT
    de: 'Neu verifizieren (erzeugt eine neue Challenge)', // MT
    fr: 'Revérifier (émet un nouveau défi)', // MT
  },
  scanning_contacts: {
    en: 'Scanning contacts…',
    nl: 'Contacten scannen…',
    es: 'Escaneando contactos…', // MT
    pt: 'Escaneando contatos…', // MT
    de: 'Kontakte werden durchsucht…', // MT
    fr: 'Analyse des contacts…', // MT
  },
  link_existing_contacts: {
    en: 'Link existing contacts on this domain',
    nl: 'Bestaande contacten op dit domein koppelen',
    es: 'Vincular contactos existentes de este dominio', // MT
    pt: 'Vincular contatos existentes deste domínio', // MT
    de: 'Bestehende Kontakte dieser Domain verknüpfen', // MT
    fr: 'Lier les contacts existants de ce domaine', // MT
  },
  no_matching_contacts: {
    en: 'No matching contacts to link.',
    nl: 'Geen passende contacten om te koppelen.',
    es: 'No hay contactos que coincidan para vincular.', // MT
    pt: 'Nenhum contato correspondente para vincular.', // MT
    de: 'Keine passenden Kontakte zum Verknüpfen.', // MT
    fr: 'Aucun contact correspondant à lier.', // MT
  },
  no_new_links: {
    en: 'No new links — {n} already linked.',
    nl: 'Geen nieuwe koppelingen — {n} al gekoppeld.',
    es: 'Sin enlaces nuevos: {n} ya vinculados.', // MT
    pt: 'Nenhum vínculo novo — {n} já vinculados.', // MT
    de: 'Keine neuen Verknüpfungen — {n} bereits verknüpft.', // MT
    fr: 'Aucun nouveau lien — {n} déjà liés.', // MT
  },
  linked_one_contact: {
    en: 'Linked 1 contact.',
    nl: '1 contact gekoppeld.',
    es: '1 contacto vinculado.', // MT
    pt: '1 contato vinculado.', // MT
    de: '1 Kontakt verknüpft.', // MT
    fr: '1 contact lié.', // MT
  },
  linked_n_contacts: {
    en: 'Linked {n} contacts.',
    nl: '{n} contacten gekoppeld.',
    es: '{n} contactos vinculados.', // MT
    pt: '{n} contatos vinculados.', // MT
    de: '{n} Kontakte verknüpft.', // MT
    fr: '{n} contacts liés.', // MT
  },
  no_members_linked: {
    en: 'No members linked yet. Click Add member to link a contact.',
    nl: 'Nog geen leden gekoppeld. Klik op Lid toevoegen om een contact te koppelen.',
    es: 'Aún no hay miembros vinculados. Haz clic en Añadir miembro para vincular un contacto.', // MT
    pt: 'Ainda não há membros vinculados. Clique em Adicionar membro para vincular um contato.', // MT
    de: 'Noch keine Mitglieder verknüpft. Klicke auf Mitglied hinzufügen, um einen Kontakt zu verknüpfen.', // MT
    fr: 'Aucun membre lié pour le moment. Clique sur Ajouter un membre pour lier un contact.', // MT
  },
  add_member_blurb: {
    en: 'Link a person to this organisation with their role and dates.',
    nl: 'Koppel een persoon aan deze organisatie met rol en data.',
    es: 'Vincula una persona a esta organización con su rol y fechas.', // MT
    pt: 'Vincule uma pessoa a esta organização com papel e datas.', // MT
    de: 'Verknüpfe eine Person mit Rolle und Daten mit dieser Organisation.', // MT
    fr: 'Lie une personne à cette organisation avec son rôle et ses dates.', // MT
  },
  adding: {
    en: 'Adding…',
    nl: 'Toevoegen…',
    es: 'Añadiendo…', // MT
    pt: 'Adicionando…', // MT
    de: 'Wird hinzugefügt…', // MT
    fr: 'Ajout…', // MT
  },
  person: {
    en: 'Person',
    nl: 'Persoon',
    es: 'Persona', // MT
    pt: 'Pessoa', // MT
    de: 'Person', // MT
    fr: 'Personne', // MT
  },
  title_label: {
    en: 'Title',
    nl: 'Functie',
    es: 'Cargo', // MT
    pt: 'Cargo', // MT
    de: 'Titel', // MT
    fr: 'Intitulé', // MT
  },
  department: {
    en: 'Department',
    nl: 'Afdeling',
    es: 'Departamento', // MT
    pt: 'Departamento', // MT
    de: 'Abteilung', // MT
    fr: 'Service', // MT
  },
  employment_type: {
    en: 'Employment type',
    nl: 'Dienstverband',
    es: 'Tipo de empleo', // MT
    pt: 'Tipo de vínculo', // MT
    de: 'Beschäftigungsart', // MT
    fr: "Type d'emploi", // MT
  },
  employment_permanent: {
    en: 'Permanent',
    nl: 'Vast',
    es: 'Fijo', // MT
    pt: 'Efetivo', // MT
    de: 'Festangestellt', // MT
    fr: 'Permanent', // MT
  },
  employment_interim: {
    en: 'Interim',
    nl: 'Interim',
    es: 'Interino', // MT
    pt: 'Interino', // MT
    de: 'Interim', // MT
    fr: 'Intérim', // MT
  },
  employment_consultant: {
    en: 'Consultant',
    nl: 'Consultant',
    es: 'Consultor', // MT
    pt: 'Consultor', // MT
    de: 'Berater', // MT
    fr: 'Consultant', // MT
  },
  employment_volunteer: {
    en: 'Volunteer',
    nl: 'Vrijwilliger',
    es: 'Voluntario', // MT
    pt: 'Voluntário', // MT
    de: 'Ehrenamtlich', // MT
    fr: 'Bénévole', // MT
  },
  influence: {
    en: 'Influence',
    nl: 'Invloed',
    es: 'Influencia', // MT
    pt: 'Influência', // MT
    de: 'Einfluss', // MT
    fr: 'Influence', // MT
  },
  influence_formal: {
    en: 'Formal',
    nl: 'Formeel',
    es: 'Formal', // MT
    pt: 'Formal', // MT
    de: 'Formell', // MT
    fr: 'Formelle', // MT
  },
  influence_informal: {
    en: 'Informal',
    nl: 'Informeel',
    es: 'Informal', // MT
    pt: 'Informal', // MT
    de: 'Informell', // MT
    fr: 'Informelle', // MT
  },
  influence_both: {
    en: 'Both',
    nl: 'Beide',
    es: 'Ambas', // MT
    pt: 'Ambas', // MT
    de: 'Beides', // MT
    fr: 'Les deux', // MT
  },
  started: {
    en: 'Started',
    nl: 'Gestart',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Begonnen', // MT
    fr: 'Début', // MT
  },
  primary_contact_org: {
    en: 'Primary contact for this org',
    nl: 'Primair contact voor deze organisatie',
    es: 'Contacto principal de esta organización', // MT
    pt: 'Contato principal desta organização', // MT
    de: 'Hauptkontakt für diese Organisation', // MT
    fr: 'Contact principal pour cette organisation', // MT
  },
  end: {
    en: 'End',
    nl: 'Beëindigen',
    es: 'Finalizar', // MT
    pt: 'Encerrar', // MT
    de: 'Beenden', // MT
    fr: 'Terminer', // MT
  },
  end_membership: {
    en: 'End membership',
    nl: 'Lidmaatschap beëindigen',
    es: 'Finalizar la membresía', // MT
    pt: 'Encerrar vínculo', // MT
    de: 'Mitgliedschaft beenden', // MT
    fr: "Mettre fin à l'appartenance", // MT
  },
  end_membership_msg: {
    en: 'Mark {name} as no longer affiliated with this organisation? The historical link stays — only the active flag changes.',
    nl: '{name} markeren als niet langer verbonden aan deze organisatie? De historische koppeling blijft — alleen de actieve vlag verandert.',
    es: '¿Marcar a {name} como ya no afiliado a esta organización? El vínculo histórico se conserva; solo cambia la marca de activo.', // MT
    pt: 'Marcar {name} como não mais vinculado a esta organização? O vínculo histórico fica — só a flag de ativo muda.', // MT
    de: '{name} als nicht mehr mit dieser Organisation verbunden markieren? Die historische Verknüpfung bleibt — nur das Aktiv-Flag ändert sich.', // MT
    fr: "Marquer {name} comme n'étant plus affilié à cette organisation ? Le lien historique reste — seul le drapeau actif change.", // MT
  },
  // ── org profile (identity curator fields) ─────────────────────────────
  edit_identity: {
    en: 'Edit identity',
    nl: 'Identiteit bewerken',
    es: 'Editar identidad', // MT
    pt: 'Editar identidade', // MT
    de: 'Identität bearbeiten', // MT
    fr: "Modifier l'identité", // MT
  },
  governance_model: {
    en: 'Governance model',
    nl: 'Bestuursmodel',
    es: 'Modelo de gobernanza', // MT
    pt: 'Modelo de governança', // MT
    de: 'Governance-Modell', // MT
    fr: 'Modèle de gouvernance', // MT
  },
  gov_hierarchical: {
    en: 'Hierarchical',
    nl: 'Hiërarchisch',
    es: 'Jerárquico', // MT
    pt: 'Hierárquico', // MT
    de: 'Hierarchisch', // MT
    fr: 'Hiérarchique', // MT
  },
  gov_flat: {
    en: 'Flat',
    nl: 'Plat',
    es: 'Plano', // MT
    pt: 'Horizontal', // MT
    de: 'Flach', // MT
    fr: 'Horizontal', // MT
  },
  gov_matrix: {
    en: 'Matrix',
    nl: 'Matrix',
    es: 'Matricial', // MT
    pt: 'Matricial', // MT
    de: 'Matrix', // MT
    fr: 'Matriciel', // MT
  },
  gov_holacracy: {
    en: 'Holacracy',
    nl: 'Holacratie',
    es: 'Holocracia', // MT
    pt: 'Holacracia', // MT
    de: 'Holakratie', // MT
    fr: 'Holacratie', // MT
  },
  ownership_type: {
    en: 'Ownership type',
    nl: 'Eigendomsvorm',
    es: 'Tipo de propiedad', // MT
    pt: 'Tipo de propriedade', // MT
    de: 'Eigentumsform', // MT
    fr: 'Type de propriété', // MT
  },
  ownership_family: {
    en: 'Family',
    nl: 'Familie',
    es: 'Familiar', // MT
    pt: 'Familiar', // MT
    de: 'Familie', // MT
    fr: 'Familiale', // MT
  },
  ownership_employee: {
    en: 'Employee',
    nl: 'Medewerkers',
    es: 'De los empleados', // MT
    pt: 'Dos funcionários', // MT
    de: 'Mitarbeiter', // MT
    fr: 'Salariale', // MT
  },
  ownership_state: {
    en: 'State',
    nl: 'Staat',
    es: 'Estatal', // MT
    pt: 'Estatal', // MT
    de: 'Staatlich', // MT
    fr: 'Étatique', // MT
  },
  decision_making_style: {
    en: 'Decision-making style',
    nl: 'Besluitvormingsstijl',
    es: 'Estilo de toma de decisiones', // MT
    pt: 'Estilo de tomada de decisão', // MT
    de: 'Entscheidungsstil', // MT
    fr: 'Style de prise de décision', // MT
  },
  decision_top_down: {
    en: 'Top-down',
    nl: 'Top-down',
    es: 'De arriba abajo', // MT
    pt: 'De cima para baixo', // MT
    de: 'Top-down', // MT
    fr: 'Descendant', // MT
  },
  decision_consultative: {
    en: 'Consultative',
    nl: 'Consultatief',
    es: 'Consultivo', // MT
    pt: 'Consultivo', // MT
    de: 'Konsultativ', // MT
    fr: 'Consultatif', // MT
  },
  decision_consensus: {
    en: 'Consensus',
    nl: 'Consensus',
    es: 'Por consenso', // MT
    pt: 'Por consenso', // MT
    de: 'Konsens', // MT
    fr: 'Par consensus', // MT
  },
  decision_delegated: {
    en: 'Delegated',
    nl: 'Gedelegeerd',
    es: 'Delegado', // MT
    pt: 'Delegado', // MT
    de: 'Delegiert', // MT
    fr: 'Délégué', // MT
  },
  maturity_stage: {
    en: 'Maturity stage',
    nl: 'Volwassenheidsfase',
    es: 'Etapa de madurez', // MT
    pt: 'Estágio de maturidade', // MT
    de: 'Reifephase', // MT
    fr: 'Stade de maturité', // MT
  },
  maturity_startup: {
    en: 'Startup',
    nl: 'Startup',
    es: 'Startup', // MT
    pt: 'Startup', // MT
    de: 'Startup', // MT
    fr: 'Startup', // MT
  },
  maturity_growth: {
    en: 'Growth',
    nl: 'Groei',
    es: 'Crecimiento', // MT
    pt: 'Crescimento', // MT
    de: 'Wachstum', // MT
    fr: 'Croissance', // MT
  },
  maturity_legacy: {
    en: 'Legacy',
    nl: 'Gevestigd erfgoed',
    es: 'Legado', // MT
    pt: 'Legado', // MT
    de: 'Etabliert (Legacy)', // MT
    fr: 'Héritage', // MT
  },
  stated_values: {
    en: 'Stated values',
    nl: 'Uitgesproken waarden',
    es: 'Valores declarados', // MT
    pt: 'Valores declarados', // MT
    de: 'Erklärte Werte', // MT
    fr: 'Valeurs déclarées', // MT
  },
  cultural_descriptors: {
    en: 'Cultural descriptors',
    nl: 'Cultuurkenmerken',
    es: 'Descriptores culturales', // MT
    pt: 'Descritores culturais', // MT
    de: 'Kulturmerkmale', // MT
    fr: 'Descripteurs culturels', // MT
  },
  languages_of_operation: {
    en: 'Languages of operation',
    nl: 'Werktalen',
    es: 'Idiomas de trabajo', // MT
    pt: 'Idiomas de trabalho', // MT
    de: 'Arbeitssprachen', // MT
    fr: 'Langues de travail', // MT
  },
  mission: {
    en: 'Mission',
    nl: 'Missie',
    es: 'Misión', // MT
    pt: 'Missão', // MT
    de: 'Mission', // MT
    fr: 'Mission', // MT
  },
  mission_statement: {
    en: 'Mission statement',
    nl: 'Missieverklaring',
    es: 'Declaración de misión', // MT
    pt: 'Declaração de missão', // MT
    de: 'Missionserklärung', // MT
    fr: 'Déclaration de mission', // MT
  },
  vision: {
    en: 'Vision',
    nl: 'Visie',
    es: 'Visión', // MT
    pt: 'Visão', // MT
    de: 'Vision', // MT
    fr: 'Vision', // MT
  },
  vision_statement: {
    en: 'Vision statement',
    nl: 'Visieverklaring',
    es: 'Declaración de visión', // MT
    pt: 'Declaração de visão', // MT
    de: 'Visionserklärung', // MT
    fr: 'Déclaration de vision', // MT
  },

  // ── org app tabs (system context, commercial relationship) ────────────
  system_context: {
    en: 'System context',
    nl: 'Systeemcontext',
    es: 'Contexto de sistema', // MT
    pt: 'Contexto de sistema', // MT
    de: 'Systemkontext', // MT
    fr: 'Contexte système', // MT
  },
  edit_system_context: {
    en: 'Edit system context — Meet',
    nl: 'Systeemcontext bewerken — Meet',
    es: 'Editar contexto de sistema — Meet', // MT
    pt: 'Editar contexto de sistema — Meet', // MT
    de: 'Systemkontext bearbeiten — Meet', // MT
    fr: 'Modifier le contexte système — Meet', // MT
  },
  transformation_stage: {
    en: 'Transformation stage',
    nl: 'Transformatiefase',
    es: 'Etapa de transformación', // MT
    pt: 'Estágio de transformação', // MT
    de: 'Transformationsphase', // MT
    fr: 'Étape de transformation', // MT
  },
  stage_pre_awareness: {
    en: 'Pre-awareness',
    nl: 'Vóór bewustwording',
    es: 'Preconciencia', // MT
    pt: 'Pré-consciência', // MT
    de: 'Vor-Bewusstsein', // MT
    fr: 'Pré-conscience', // MT
  },
  stage_exploring: {
    en: 'Exploring',
    nl: 'Verkennend',
    es: 'Explorando', // MT
    pt: 'Explorando', // MT
    de: 'Erkundend', // MT
    fr: 'En exploration', // MT
  },
  stage_committed: {
    en: 'Committed',
    nl: 'Gecommitteerd',
    es: 'Comprometida', // MT
    pt: 'Comprometida', // MT
    de: 'Verpflichtet', // MT
    fr: 'Engagée', // MT
  },
  stage_in_programme: {
    en: 'In programme',
    nl: 'In programma',
    es: 'En programa', // MT
    pt: 'Em programa', // MT
    de: 'Im Programm', // MT
    fr: 'En programme', // MT
  },
  stage_sustaining: {
    en: 'Sustaining',
    nl: 'Bestendigend',
    es: 'Sosteniendo', // MT
    pt: 'Sustentando', // MT
    de: 'Verstetigend', // MT
    fr: 'En consolidation', // MT
  },
  stage_alumni: {
    en: 'Alumni',
    nl: 'Alumni',
    es: 'Alumni', // MT
    pt: 'Alumni', // MT
    de: 'Alumni', // MT
    fr: 'Alumni', // MT
  },
  leadership_stability: {
    en: 'Leadership stability',
    nl: 'Stabiliteit van het leiderschap',
    es: 'Estabilidad del liderazgo', // MT
    pt: 'Estabilidade da liderança', // MT
    de: 'Führungsstabilität', // MT
    fr: 'Stabilité du leadership', // MT
  },
  stability_stable: {
    en: 'Stable',
    nl: 'Stabiel',
    es: 'Estable', // MT
    pt: 'Estável', // MT
    de: 'Stabil', // MT
    fr: 'Stable', // MT
  },
  stability_turbulent: {
    en: 'Turbulent',
    nl: 'Turbulent',
    es: 'Turbulenta', // MT
    pt: 'Turbulenta', // MT
    de: 'Turbulent', // MT
    fr: 'Turbulente', // MT
  },
  change_readiness: {
    en: 'Change readiness',
    nl: 'Verandergereedheid',
    es: 'Preparación para el cambio', // MT
    pt: 'Prontidão para a mudança', // MT
    de: 'Veränderungsbereitschaft', // MT
    fr: 'Préparation au changement', // MT
  },
  active_change_themes: {
    en: 'Active change themes',
    nl: 'Actieve veranderthema’s',
    es: 'Temas de cambio activos', // MT
    pt: 'Temas de mudança ativos', // MT
    de: 'Aktive Veränderungsthemen', // MT
    fr: 'Thèmes de changement actifs', // MT
  },
  structural_tensions: {
    en: 'Structural tensions',
    nl: 'Structurele spanningen',
    es: 'Tensiones estructurales', // MT
    pt: 'Tensões estruturais', // MT
    de: 'Strukturelle Spannungen', // MT
    fr: 'Tensions structurelles', // MT
  },
  previous_interventions: {
    en: 'Previous interventions',
    nl: 'Eerdere interventies',
    es: 'Intervenciones previas', // MT
    pt: 'Intervenções anteriores', // MT
    de: 'Frühere Interventionen', // MT
    fr: 'Interventions précédentes', // MT
  },
  enablers: {
    en: 'Enablers',
    nl: 'Versnellers',
    es: 'Facilitadores', // MT
    pt: 'Facilitadores', // MT
    de: 'Ermöglicher', // MT
    fr: 'Facilitateurs', // MT
  },
  strategic_priorities: {
    en: 'Strategic priorities',
    nl: 'Strategische prioriteiten',
    es: 'Prioridades estratégicas', // MT
    pt: 'Prioridades estratégicas', // MT
    de: 'Strategische Prioritäten', // MT
    fr: 'Priorités stratégiques', // MT
  },
  current_challenges: {
    en: 'Current challenges',
    nl: 'Huidige uitdagingen',
    es: 'Retos actuales', // MT
    pt: 'Desafios atuais', // MT
    de: 'Aktuelle Herausforderungen', // MT
    fr: 'Défis actuels', // MT
  },
  lessons_previous_work: {
    en: 'Lessons from previous work',
    nl: 'Lessen uit eerder werk',
    es: 'Lecciones de trabajos anteriores', // MT
    pt: 'Lições de trabalhos anteriores', // MT
    de: 'Lehren aus früherer Arbeit', // MT
    fr: 'Leçons des travaux précédents', // MT
  },
  political_landscape: {
    en: 'Political landscape',
    nl: 'Politiek landschap',
    es: 'Panorama político', // MT
    pt: 'Cenário político', // MT
    de: 'Politische Landschaft', // MT
    fr: 'Paysage politique', // MT
  },
  political_landscape_hint: {
    en: 'Workspace admins and the person who wrote it. Per brief §5.D3.',
    nl: 'Werkruimtebeheerders en degene die het schreef. Volgens brief §5.D3.',
    es: 'Los admins del espacio y quien lo escribió. Según el brief §5.D3.', // MT
    pt: 'Admins do espaço e quem escreveu. Conforme o brief §5.D3.', // MT
    de: 'Workspace-Admins und die Person, die es geschrieben hat. Gemäß Brief §5.D3.', // MT
    fr: "Les admins de l'espace et la personne qui l'a écrit. Selon le brief §5.D3.", // MT
  },
  commercial_relationship: {
    en: 'Commercial relationship',
    nl: 'Commerciële relatie',
    es: 'Relación comercial', // MT
    pt: 'Relação comercial', // MT
    de: 'Geschäftsbeziehung', // MT
    fr: 'Relation commerciale', // MT
  },
  edit_commercial_relationship: {
    en: 'Edit commercial relationship — Sales',
    nl: 'Commerciële relatie bewerken — Sales',
    es: 'Editar relación comercial — Sales', // MT
    pt: 'Editar relação comercial — Sales', // MT
    de: 'Geschäftsbeziehung bearbeiten — Sales', // MT
    fr: 'Modifier la relation commerciale — Sales', // MT
  },
  relationship_stage: {
    en: 'Relationship stage',
    nl: 'Relatiefase',
    es: 'Etapa de la relación', // MT
    pt: 'Estágio da relação', // MT
    de: 'Beziehungsphase', // MT
    fr: 'Étape de la relation', // MT
  },
  rel_stage_prospect: {
    en: 'Prospect',
    nl: 'Prospect',
    es: 'Prospecto', // MT
    pt: 'Prospect', // MT
    de: 'Prospect', // MT
    fr: 'Prospect', // MT
  },
  rel_stage_engaged: {
    en: 'Engaged',
    nl: 'In gesprek',
    es: 'En contacto', // MT
    pt: 'Engajada', // MT
    de: 'Im Austausch', // MT
    fr: 'Engagée', // MT
  },
  rel_stage_active_client: {
    en: 'Active client',
    nl: 'Actieve klant',
    es: 'Cliente activo', // MT
    pt: 'Cliente ativo', // MT
    de: 'Aktiver Kunde', // MT
    fr: 'Client actif', // MT
  },
  rel_stage_dormant: {
    en: 'Dormant',
    nl: 'Slapend',
    es: 'Inactiva', // MT
    pt: 'Dormente', // MT
    de: 'Ruhend', // MT
    fr: 'Dormante', // MT
  },
  rel_stage_lost: {
    en: 'Lost',
    nl: 'Verloren',
    es: 'Perdida', // MT
    pt: 'Perdida', // MT
    de: 'Verloren', // MT
    fr: 'Perdue', // MT
  },
  health_status: {
    en: 'Health status',
    nl: 'Gezondheidsstatus',
    es: 'Estado de salud', // MT
    pt: 'Estado de saúde', // MT
    de: 'Gesundheitsstatus', // MT
    fr: 'État de santé', // MT
  },
  health_at_risk: {
    en: 'At risk',
    nl: 'In gevaar',
    es: 'En riesgo', // MT
    pt: 'Em risco', // MT
    de: 'Gefährdet', // MT
    fr: 'À risque', // MT
  },
  health_never_converted: {
    en: 'Never converted',
    nl: 'Nooit geconverteerd',
    es: 'Nunca convertida', // MT
    pt: 'Nunca convertida', // MT
    de: 'Nie konvertiert', // MT
    fr: 'Jamais convertie', // MT
  },
  engagement_type: {
    en: 'Engagement type',
    nl: 'Type samenwerking',
    es: 'Tipo de colaboración', // MT
    pt: 'Tipo de engajamento', // MT
    de: 'Art des Engagements', // MT
    fr: "Type d'engagement", // MT
  },
  engagement_facilitation: {
    en: 'Facilitation',
    nl: 'Facilitatie',
    es: 'Facilitación', // MT
    pt: 'Facilitação', // MT
    de: 'Moderation', // MT
    fr: 'Facilitation', // MT
  },
  engagement_learning: {
    en: 'Learning',
    nl: 'Leren',
    es: 'Aprendizaje', // MT
    pt: 'Aprendizagem', // MT
    de: 'Lernen', // MT
    fr: 'Apprentissage', // MT
  },
  engagement_advisory: {
    en: 'Advisory',
    nl: 'Advies',
    es: 'Asesoría', // MT
    pt: 'Consultoria', // MT
    de: 'Beratung', // MT
    fr: 'Conseil', // MT
  },
  engagement_speaking: {
    en: 'Speaking',
    nl: 'Spreken',
    es: 'Ponencias', // MT
    pt: 'Palestras', // MT
    de: 'Vorträge', // MT
    fr: 'Conférences', // MT
  },
  engagement_mixed: {
    en: 'Mixed',
    nl: 'Gemengd',
    es: 'Mixto', // MT
    pt: 'Misto', // MT
    de: 'Gemischt', // MT
    fr: 'Mixte', // MT
  },
  total_participants_reached: {
    en: 'Total participants reached',
    nl: 'Totaal bereikte deelnemers',
    es: 'Total de participantes alcanzados', // MT
    pt: 'Total de participantes alcançados', // MT
    de: 'Erreichte Teilnehmende insgesamt', // MT
    fr: 'Total de participants touchés', // MT
  },
  touchpoints: {
    en: 'Touchpoints',
    nl: 'Contactmomenten',
    es: 'Puntos de contacto', // MT
    pt: 'Pontos de contato', // MT
    de: 'Kontaktpunkte', // MT
    fr: 'Points de contact', // MT
  },
  touchpoints_count: {
    en: 'Touchpoints count',
    nl: 'Aantal contactmomenten',
    es: 'Número de puntos de contacto', // MT
    pt: 'Número de pontos de contato', // MT
    de: 'Anzahl Kontaktpunkte', // MT
    fr: 'Nombre de points de contact', // MT
  },
  last_touchpoint: {
    en: 'Last touchpoint',
    nl: 'Laatste contactmoment',
    es: 'Último punto de contacto', // MT
    pt: 'Último ponto de contato', // MT
    de: 'Letzter Kontaktpunkt', // MT
    fr: 'Dernier point de contact', // MT
  },
  next_planned_contact: {
    en: 'Next planned contact',
    nl: 'Volgend gepland contact',
    es: 'Próximo contacto previsto', // MT
    pt: 'Próximo contato planejado', // MT
    de: 'Nächster geplanter Kontakt', // MT
    fr: 'Prochain contact prévu', // MT
  },
  programmes_completed: {
    en: 'Programmes completed',
    nl: "Afgeronde programma's",
    es: 'Programas completados', // MT
    pt: 'Programas concluídos', // MT
    de: 'Abgeschlossene Programme', // MT
    fr: 'Programmes terminés', // MT
  },
  primary_owner: {
    en: 'Primary owner',
    nl: 'Primaire eigenaar',
    es: 'Responsable principal', // MT
    pt: 'Responsável principal', // MT
    de: 'Hauptverantwortlich', // MT
    fr: 'Responsable principal', // MT
  },
  secondary_owner: {
    en: 'Secondary owner',
    nl: 'Secundaire eigenaar',
    es: 'Responsable secundario', // MT
    pt: 'Responsável secundário', // MT
    de: 'Zweitverantwortlich', // MT
    fr: 'Responsable secondaire', // MT
  },
  next_opportunity: {
    en: 'Next opportunity',
    nl: 'Volgende kans',
    es: 'Próxima oportunidad', // MT
    pt: 'Próxima oportunidade', // MT
    de: 'Nächste Gelegenheit', // MT
    fr: 'Prochaine opportunité', // MT
  },
  relationship_history: {
    en: 'Relationship history',
    nl: 'Relatiegeschiedenis',
    es: 'Historial de la relación', // MT
    pt: 'Histórico da relação', // MT
    de: 'Beziehungshistorie', // MT
    fr: 'Historique de la relation', // MT
  },
  no_org_curator_fields: {
    en: "{app} doesn't curate dedicated fields on organisations. Activity from {app} will appear on this tab once written.",
    nl: '{app} beheert geen eigen velden op organisaties. Activiteit van {app} verschijnt op dit tabblad zodra die geschreven is.',
    es: '{app} no cura campos propios en organizaciones. La actividad de {app} aparecerá en esta pestaña cuando se escriba.', // MT
    pt: '{app} não cura campos próprios em organizações. A atividade do {app} aparecerá nesta aba quando for gravada.', // MT
    de: '{app} kuratiert keine eigenen Felder auf Organisationen. Aktivität von {app} erscheint auf diesem Tab, sobald sie geschrieben wird.', // MT
    fr: "{app} ne cure pas de champs dédiés sur les organisations. L'activité de {app} apparaîtra dans cet onglet une fois écrite.", // MT
  },
  no_org_activity_yet: {
    en: 'No activity yet. Events from current members of this organisation written by this app will appear here.',
    nl: 'Nog geen activiteit. Gebeurtenissen van huidige leden van deze organisatie, geschreven door deze app, verschijnen hier.',
    es: 'Aún no hay actividad. Los eventos de los miembros actuales de esta organización escritos por esta app aparecerán aquí.', // MT
    pt: 'Ainda não há atividade. Eventos dos membros atuais desta organização gravados por este app aparecerão aqui.', // MT
    de: 'Noch keine Aktivität. Ereignisse aktueller Mitglieder dieser Organisation, von dieser App geschrieben, erscheinen hier.', // MT
    fr: "Pas encore d'activité. Les événements des membres actuels de cette organisation écrits par cette app apparaîtront ici.", // MT
  },

  // ── programmes ────────────────────────────────────────────────────────
  new_programme: {
    en: 'New programme',
    nl: 'Nieuw programma',
    es: 'Nuevo programa', // MT
    pt: 'Novo programa', // MT
    de: 'Neues Programm', // MT
    fr: 'Nouveau programme', // MT
  },
  new_programme_blurb: {
    en: 'A programme is an event, journey, meeting, or course. The format determines which app delivers it.',
    nl: 'Een programma is een evenement, traject, meeting of cursus. Het format bepaalt welke app het levert.',
    es: 'Un programa es un evento, itinerario, reunión o curso. El formato determina qué app lo entrega.', // MT
    pt: 'Um programa é um evento, jornada, reunião ou curso. O formato determina qual app o entrega.', // MT
    de: 'Ein Programm ist ein Event, eine Journey, ein Meeting oder ein Kurs. Das Format bestimmt, welche App es liefert.', // MT
    fr: "Un programme est un événement, un parcours, une réunion ou un cours. Le format détermine quelle app le délivre.", // MT
  },
  programmes_load_failed: {
    en: "Couldn't load programmes:",
    nl: "Kon de programma's niet laden:",
    es: 'No se pudieron cargar los programas:', // MT
    pt: 'Não foi possível carregar os programas:', // MT
    de: 'Programme konnten nicht geladen werden:', // MT
    fr: 'Impossible de charger les programmes :', // MT
  },
  no_programmes_yet: {
    en: 'No programmes yet.',
    nl: "Nog geen programma's.",
    es: 'Aún no hay programas.', // MT
    pt: 'Ainda não há programas.', // MT
    de: 'Noch keine Programme.', // MT
    fr: 'Pas encore de programmes.', // MT
  },
  create_first_one: {
    en: 'Create the first one',
    nl: 'Maak het eerste aan',
    es: 'Crea el primero', // MT
    pt: 'Crie o primeiro', // MT
    de: 'Erstelle das erste', // MT
    fr: 'Crée le premier', // MT
  },
  create_programme: {
    en: 'Create programme',
    nl: 'Programma aanmaken',
    es: 'Crear programa', // MT
    pt: 'Criar programa', // MT
    de: 'Programm erstellen', // MT
    fr: 'Créer le programme', // MT
  },
  format: {
    en: 'Format',
    nl: 'Format',
    es: 'Formato', // MT
    pt: 'Formato', // MT
    de: 'Format', // MT
    fr: 'Format', // MT
  },
  format_hint: {
    en: 'The format determines which app delivers this programme.',
    nl: 'Het format bepaalt welke app dit programma levert.',
    es: 'El formato determina qué app entrega este programa.', // MT
    pt: 'O formato determina qual app entrega este programa.', // MT
    de: 'Das Format bestimmt, welche App dieses Programm liefert.', // MT
    fr: 'Le format détermine quelle app délivre ce programme.', // MT
  },
  format_meeting: {
    en: 'Meeting',
    nl: 'Meeting',
    es: 'Reunión', // MT
    pt: 'Reunião', // MT
    de: 'Meeting', // MT
    fr: 'Réunion', // MT
  },
  format_event: {
    en: 'Event',
    nl: 'Evenement',
    es: 'Evento', // MT
    pt: 'Evento', // MT
    de: 'Event', // MT
    fr: 'Événement', // MT
  },
  format_journey: {
    en: 'Journey',
    nl: 'Traject',
    es: 'Itinerario', // MT
    pt: 'Jornada', // MT
    de: 'Journey', // MT
    fr: 'Parcours', // MT
  },
  format_self_paced: {
    en: 'Self-paced',
    nl: 'Eigen tempo',
    es: 'A tu ritmo', // MT
    pt: 'No seu ritmo', // MT
    de: 'Im eigenen Tempo', // MT
    fr: 'À son rythme', // MT
  },
  format_blended: {
    en: 'Blended',
    nl: 'Blended',
    es: 'Mixto', // MT
    pt: 'Híbrido', // MT
    de: 'Blended', // MT
    fr: 'Mixte', // MT
  },
  status_draft: {
    en: 'Draft',
    nl: 'Concept',
    es: 'Borrador', // MT
    pt: 'Rascunho', // MT
    de: 'Entwurf', // MT
    fr: 'Brouillon', // MT
  },
  status_prog_completed: {
    en: 'Completed',
    nl: 'Afgerond',
    es: 'Completado', // MT
    pt: 'Concluído', // MT
    de: 'Abgeschlossen', // MT
    fr: 'Terminé', // MT
  },
  status_archived: {
    en: 'Archived',
    nl: 'Gearchiveerd',
    es: 'Archivado', // MT
    pt: 'Arquivado', // MT
    de: 'Archiviert', // MT
    fr: 'Archivé', // MT
  },
  status_invited: {
    en: 'Invited',
    nl: 'Uitgenodigd',
    es: 'Invitado', // MT
    pt: 'Convidado', // MT
    de: 'Eingeladen', // MT
    fr: 'Invité', // MT
  },
  status_enrolled: {
    en: 'Enrolled',
    nl: 'Ingeschreven',
    es: 'Inscrito', // MT
    pt: 'Inscrito', // MT
    de: 'Angemeldet', // MT
    fr: 'Inscrit', // MT
  },
  status_dropped: {
    en: 'Dropped',
    nl: 'Gestopt',
    es: 'Abandonó', // MT
    pt: 'Desistiu', // MT
    de: 'Ausgestiegen', // MT
    fr: 'Abandonné', // MT
  },
  delivered_by: {
    en: 'Delivered by',
    nl: 'Geleverd door',
    es: 'Entregado por', // MT
    pt: 'Entregue por', // MT
    de: 'Geliefert von', // MT
    fr: 'Délivré par', // MT
  },
  starts_label: {
    en: 'Starts',
    nl: 'Start',
    es: 'Empieza', // MT
    pt: 'Começa', // MT
    de: 'Beginnt', // MT
    fr: 'Commence', // MT
  },
  ends_label: {
    en: 'Ends',
    nl: 'Eindigt',
    es: 'Termina', // MT
    pt: 'Termina', // MT
    de: 'Endet', // MT
    fr: 'Se termine', // MT
  },
  start_date: {
    en: 'Start date',
    nl: 'Startdatum',
    es: 'Fecha de inicio', // MT
    pt: 'Data de início', // MT
    de: 'Startdatum', // MT
    fr: 'Date de début', // MT
  },
  end_date: {
    en: 'End date',
    nl: 'Einddatum',
    es: 'Fecha de fin', // MT
    pt: 'Data de término', // MT
    de: 'Enddatum', // MT
    fr: 'Date de fin', // MT
  },
  enrolments: {
    en: 'Enrolments',
    nl: 'Inschrijvingen',
    es: 'Inscripciones', // MT
    pt: 'Inscrições', // MT
    de: 'Anmeldungen', // MT
    fr: 'Inscriptions', // MT
  },
  no_enrolments_yet: {
    en: 'No enrolments yet. Click Enrol person to add the first one.',
    nl: 'Nog geen inschrijvingen. Klik op Persoon inschrijven om de eerste toe te voegen.',
    es: 'Aún no hay inscripciones. Haz clic en Inscribir persona para añadir la primera.', // MT
    pt: 'Ainda não há inscrições. Clique em Inscrever pessoa para adicionar a primeira.', // MT
    de: 'Noch keine Anmeldungen. Klicke auf Person anmelden, um die erste hinzuzufügen.', // MT
    fr: "Pas encore d'inscriptions. Clique sur Inscrire une personne pour ajouter la première.", // MT
  },
  enrol_person: {
    en: 'Enrol person',
    nl: 'Persoon inschrijven',
    es: 'Inscribir persona', // MT
    pt: 'Inscrever pessoa', // MT
    de: 'Person anmelden', // MT
    fr: 'Inscrire une personne', // MT
  },
  enrol_a_person: {
    en: 'Enrol a person',
    nl: 'Een persoon inschrijven',
    es: 'Inscribir a una persona', // MT
    pt: 'Inscrever uma pessoa', // MT
    de: 'Eine Person anmelden', // MT
    fr: 'Inscrire une personne', // MT
  },
  enrol_blurb: {
    en: 'Adds an enrolment record. The person can be moved through invited → enrolled → active → completed.',
    nl: 'Voegt een inschrijvingsrecord toe. De persoon kan door uitgenodigd → ingeschreven → actief → afgerond bewegen.',
    es: 'Añade un registro de inscripción. La persona puede pasar por invitado → inscrito → activo → completado.', // MT
    pt: 'Adiciona um registro de inscrição. A pessoa pode passar por convidado → inscrito → ativo → concluído.', // MT
    de: 'Fügt einen Anmeldedatensatz hinzu. Die Person kann durch eingeladen → angemeldet → aktiv → abgeschlossen bewegt werden.', // MT
    fr: "Ajoute un enregistrement d'inscription. La personne peut passer par invité → inscrit → actif → terminé.", // MT
  },
  enrolling: {
    en: 'Enrolling…',
    nl: 'Inschrijven…',
    es: 'Inscribiendo…', // MT
    pt: 'Inscrevendo…', // MT
    de: 'Wird angemeldet…', // MT
    fr: 'Inscription…', // MT
  },
  enrol: {
    en: 'Enrol',
    nl: 'Inschrijven',
    es: 'Inscribir', // MT
    pt: 'Inscrever', // MT
    de: 'Anmelden', // MT
    fr: 'Inscrire', // MT
  },
  pick_a_person: {
    en: 'Pick a person.',
    nl: 'Kies een persoon.',
    es: 'Elige una persona.', // MT
    pt: 'Escolha uma pessoa.', // MT
    de: 'Wähle eine Person.', // MT
    fr: 'Choisis une personne.', // MT
  },
  initial_status: {
    en: 'Initial status',
    nl: 'Beginstatus',
    es: 'Estado inicial', // MT
    pt: 'Status inicial', // MT
    de: 'Anfangsstatus', // MT
    fr: 'Statut initial', // MT
  },

  // ── activity ──────────────────────────────────────────────────────────
  activity_blurb: {
    en: 'The accumulated record of every meaningful interaction across every app.',
    nl: 'Het opgebouwde verslag van elke betekenisvolle interactie in elke app.',
    es: 'El registro acumulado de cada interacción significativa en cada app.', // MT
    pt: 'O registro acumulado de cada interação significativa em cada app.', // MT
    de: 'Das gesammelte Protokoll jeder bedeutsamen Interaktion in jeder App.', // MT
    fr: 'Le registre accumulé de chaque interaction significative dans chaque app.', // MT
  },
  activity_load_failed: {
    en: "Couldn't load activity:",
    nl: 'Kon de activiteit niet laden:',
    es: 'No se pudo cargar la actividad:', // MT
    pt: 'Não foi possível carregar a atividade:', // MT
    de: 'Aktivität konnte nicht geladen werden:', // MT
    fr: "Impossible de charger l'activité :", // MT
  },
  all_types: {
    en: 'All types',
    nl: 'Alle types',
    es: 'Todos los tipos', // MT
    pt: 'Todos os tipos', // MT
    de: 'Alle Typen', // MT
    fr: 'Tous les types', // MT
  },
  all_apps: {
    en: 'All apps',
    nl: 'Alle apps',
    es: 'Todas las apps', // MT
    pt: 'Todos os apps', // MT
    de: 'Alle Apps', // MT
    fr: 'Toutes les apps', // MT
  },
  unknown_app: {
    en: 'Unknown app',
    nl: 'Onbekende app',
    es: 'App desconocida', // MT
    pt: 'App desconhecido', // MT
    de: 'Unbekannte App', // MT
    fr: 'App inconnue', // MT
  },
  load_older: {
    en: 'Load older',
    nl: 'Ouder laden',
    es: 'Cargar más antiguos', // MT
    pt: 'Carregar mais antigos', // MT
    de: 'Ältere laden', // MT
    fr: 'Charger les plus anciens', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
