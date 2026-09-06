// The Thread — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string the signed-in UI shows lives HERE, in all six
// locales. The locale is the USER's — read server-side via uiLocale()
// (lib/locale.ts) and passed DOWN AS PROPS; no context, no provider.
// The public/participant catalog stays in lib/i18n.ts — reuse its
// vocabulary (threads, enrolments, invoices…) so admin and public agree.
// A key missing a locale fails `pnpm typecheck` — that keeps it complete.
//
// Register is informal (je/du/tu/tú/você). "Thread" stays untranslated —
// it is the product word. User content (titles, names, notes) is never
// translated. es/pt/de/fr lines are machine-drafted (// MT).

import { makeT, type I18nEntry, type Locale } from '@thefibre/shared/i18n';

const CATALOG = {
  // ── shared verbs & states ─────────────────────────────────────────────
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
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },
  duplicate: {
    en: 'Duplicate',
    nl: 'Dupliceren',
    es: 'Duplicar', // MT
    pt: 'Duplicar', // MT
    de: 'Duplizieren', // MT
    fr: 'Dupliquer', // MT
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
  edit: {
    en: 'Edit',
    nl: 'Bewerken',
    es: 'Editar', // MT
    pt: 'Editar', // MT
    de: 'Bearbeiten', // MT
    fr: 'Modifier', // MT
  },
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
  done: {
    en: 'Done',
    nl: 'Klaar',
    es: 'Listo', // MT
    pt: 'Concluído', // MT
    de: 'Fertig', // MT
    fr: 'Terminé', // MT
  },
  working: {
    en: 'Working…',
    nl: 'Bezig…',
    es: 'Procesando…', // MT
    pt: 'Processando…', // MT
    de: 'Wird ausgeführt…', // MT
    fr: 'En cours…', // MT
  },
  loading: {
    en: 'Loading…',
    nl: 'Laden…',
    es: 'Cargando…', // MT
    pt: 'Carregando…', // MT
    de: 'Wird geladen…', // MT
    fr: 'Chargement…', // MT
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird gesendet…', // MT
    fr: 'Envoi en cours…', // MT
  },
  search: {
    en: 'Search',
    nl: 'Zoeken',
    es: 'Buscar', // MT
    pt: 'Pesquisar', // MT
    de: 'Suchen', // MT
    fr: 'Rechercher', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo electrónico', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  status: {
    en: 'Status',
    nl: 'Status',
    es: 'Estado', // MT
    pt: 'Status', // MT
    de: 'Status', // MT
    fr: 'Statut', // MT
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
    en: 'Copied.',
    nl: 'Gekopieerd.',
    es: 'Copiado.', // MT
    pt: 'Copiado.', // MT
    de: 'Kopiert.', // MT
    fr: 'Copié.', // MT
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
    es: 'No conectado', // MT
    pt: 'Não conectado', // MT
    de: 'Nicht verbunden', // MT
    fr: 'Non connecté', // MT
  },
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis', // MT
    pt: 'Gratuito', // MT
    de: 'Kostenlos', // MT
    fr: 'Gratuit', // MT
  },
  settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Configuración', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  threads: {
    en: 'Threads',
    nl: 'Threads',
    es: 'Threads', // MT
    pt: 'Threads', // MT
    de: 'Threads', // MT
    fr: 'Threads', // MT
  },
  enrolments: {
    en: 'Enrolments',
    nl: 'Inschrijvingen',
    es: 'Inscripciones', // MT
    pt: 'Inscrições', // MT
    de: 'Anmeldungen', // MT
    fr: 'Inscriptions', // MT
  },
  contacts: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contatos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  teams: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipes', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
  },
  templates: {
    en: 'Templates',
    nl: 'Sjablonen',
    es: 'Plantillas', // MT
    pt: 'Modelos', // MT
    de: 'Vorlagen', // MT
    fr: 'Modèles', // MT
  },
  certificates: {
    en: 'Certificates',
    nl: 'Certificaten',
    es: 'Certificados', // MT
    pt: 'Certificados', // MT
    de: 'Zertifikate', // MT
    fr: 'Certificats', // MT
  },
  invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  event: {
    en: 'Event',
    nl: 'Evenement',
    es: 'Evento', // MT
    pt: 'Evento', // MT
    de: 'Veranstaltung', // MT
    fr: 'Événement', // MT
  },
  journey: {
    en: 'Journey',
    nl: 'Reis',
    es: 'Recorrido', // MT
    pt: 'Jornada', // MT
    de: 'Reise', // MT
    fr: 'Parcours', // MT
  },
  online: {
    en: 'Online',
    nl: 'Online',
    es: 'En línea', // MT
    pt: 'Online', // MT
    de: 'Online', // MT
    fr: 'En ligne', // MT
  },
  optional: {
    en: 'optional',
    nl: 'optioneel',
    es: 'opcional', // MT
    pt: 'opcional', // MT
    de: 'optional', // MT
    fr: 'facultatif', // MT
  },

  // ── settings hub ──────────────────────────────────────────────────────
  settings_desc: {
    en: 'You, the workspace, and Thread. The same four sections in every Fibre app.',
    nl: 'Jij, de werkruimte en Thread. Dezelfde vier secties in elke Fibre-app.',
    es: 'Tú, el espacio de trabajo y Thread. Las mismas cuatro secciones en cada app de Fibre.', // MT
    pt: 'Você, o espaço de trabalho e o Thread. As mesmas quatro seções em todos os apps Fibre.', // MT
    de: 'Du, der Workspace und Thread. Dieselben vier Bereiche in jeder Fibre-App.', // MT
    fr: 'Toi, l’espace de travail et Thread. Les quatre mêmes sections dans chaque app Fibre.', // MT
  },
  settings_public_page: {
    en: 'Public page',
    nl: 'Openbare pagina',
    es: 'Página pública', // MT
    pt: 'Página pública', // MT
    de: 'Öffentliche Seite', // MT
    fr: 'Page publique', // MT
  },
  settings_public_page_desc: {
    en: 'The address your organiser page lives at, and what it shows.',
    nl: 'Het adres waar je organisatorpagina staat, en wat erop te zien is.',
    es: 'La dirección donde vive tu página de organizador y lo que muestra.', // MT
    pt: 'O endereço onde fica a sua página de organizador e o que ela mostra.', // MT
    de: 'Die Adresse deiner Veranstalterseite und was sie zeigt.', // MT
    fr: 'L’adresse de ta page organisateur et ce qu’elle affiche.', // MT
  },
  settings_embeds: {
    en: 'Website embeds',
    nl: 'Website-embeds',
    es: 'Embeds para tu web', // MT
    pt: 'Embeds para o site', // MT
    de: 'Website-Embeds', // MT
    fr: 'Intégrations web', // MT
  },
  settings_embeds_desc: {
    en: 'Copy-paste snippets to show your threads and take enrolments on any website.',
    nl: 'Knip-en-plak-snippets om je threads te tonen en inschrijvingen te ontvangen op elke website.',
    es: 'Fragmentos de copiar y pegar para mostrar tus threads y recibir inscripciones en cualquier web.', // MT
    pt: 'Trechos de copiar e colar para mostrar seus threads e receber inscrições em qualquer site.', // MT
    de: 'Copy-paste-Snippets, um deine Threads zu zeigen und Anmeldungen auf jeder Website anzunehmen.', // MT
    fr: 'Des extraits à copier-coller pour afficher tes threads et recevoir des inscriptions sur n’importe quel site.', // MT
  },
  settings_categories_desc: {
    en: 'The labels threads can be filed under, workspace-wide or your own.',
    nl: 'De labels waaronder threads vallen, voor de hele werkruimte of alleen van jou.',
    es: 'Las etiquetas bajo las que se archivan los threads, para todo el espacio o solo tuyas.', // MT
    pt: 'Os rótulos sob os quais os threads são organizados, do espaço inteiro ou só seus.', // MT
    de: 'Die Labels, unter denen Threads einsortiert werden — workspace-weit oder nur deine.', // MT
    fr: 'Les étiquettes sous lesquelles ranger les threads, pour tout l’espace ou juste les tiennes.', // MT
  },
  categories: {
    en: 'Categories',
    nl: 'Categorieën',
    es: 'Categorías', // MT
    pt: 'Categorias', // MT
    de: 'Kategorien', // MT
    fr: 'Catégories', // MT
  },

  // ── settings → public page ────────────────────────────────────────────
  public_page_desc: {
    en: 'Where your organiser page lives, and what it shows.',
    nl: 'Waar je organisatorpagina staat, en wat erop te zien is.',
    es: 'Dónde vive tu página de organizador y qué muestra.', // MT
    pt: 'Onde fica a sua página de organizador e o que ela mostra.', // MT
    de: 'Wo deine Veranstalterseite liegt und was sie zeigt.', // MT
    fr: 'Où vit ta page organisateur et ce qu’elle affiche.', // MT
  },
  public_url: {
    en: 'Public URL',
    nl: 'Openbare URL',
    es: 'URL pública', // MT
    pt: 'URL pública', // MT
    de: 'Öffentliche URL', // MT
    fr: 'URL publique', // MT
  },
  public_url_hint: {
    en: 'Every thread you publish lives under this address.',
    nl: 'Elke thread die je publiceert staat onder dit adres.',
    es: 'Cada thread que publiques vive bajo esta dirección.', // MT
    pt: 'Todo thread que você publicar fica sob este endereço.', // MT
    de: 'Jeder Thread, den du veröffentlichst, liegt unter dieser Adresse.', // MT
    fr: 'Chaque thread que tu publies vit sous cette adresse.', // MT
  },
  pick_public_url: {
    en: 'Pick a public URL.',
    nl: 'Kies een openbare URL.',
    es: 'Elige una URL pública.', // MT
    pt: 'Escolha uma URL pública.', // MT
    de: 'Wähle eine öffentliche URL.', // MT
    fr: 'Choisis une URL publique.', // MT
  },
  what_it_shows: {
    en: 'What it shows',
    nl: 'Wat erop staat',
    es: 'Qué muestra', // MT
    pt: 'O que ela mostra', // MT
    de: 'Was sie zeigt', // MT
    fr: 'Ce qu’elle affiche', // MT
  },
  no_bio_yet: {
    en: 'No bio yet.',
    nl: 'Nog geen bio.',
    es: 'Aún sin bio.', // MT
    pt: 'Ainda sem bio.', // MT
    de: 'Noch keine Bio.', // MT
    fr: 'Pas encore de bio.', // MT
  },
  edit_profile_in_fibre: {
    en: 'Edit your profile in The Fibre',
    nl: 'Bewerk je profiel in The Fibre',
    es: 'Edita tu perfil en The Fibre', // MT
    pt: 'Edite seu perfil no The Fibre', // MT
    de: 'Bearbeite dein Profil in The Fibre', // MT
    fr: 'Modifie ton profil dans The Fibre', // MT
  },
  one_profile_note: {
    en: 'One profile, used by every app — so it is edited in one place.',
    nl: 'Eén profiel, gebruikt door elke app — dus je bewerkt het op één plek.',
    es: 'Un solo perfil, usado por todas las apps — por eso se edita en un solo lugar.', // MT
    pt: 'Um único perfil, usado por todos os apps — por isso é editado num só lugar.', // MT
    de: 'Ein Profil, genutzt von jeder App — deshalb wird es an einem Ort bearbeitet.', // MT
    fr: 'Un seul profil, utilisé par toutes les apps — il se modifie donc à un seul endroit.', // MT
  },

  // ── settings → categories ─────────────────────────────────────────────
  categories_desc: {
    en: 'The list threads choose from — on public listings and website embeds, visitors can filter by these.',
    nl: 'De lijst waaruit threads kiezen — op openbare overzichten en website-embeds kunnen bezoekers hierop filteren.',
    es: 'La lista de la que eligen los threads — en listados públicos y embeds, los visitantes pueden filtrar por estas.', // MT
    pt: 'A lista da qual os threads escolhem — em listagens públicas e embeds, os visitantes podem filtrar por elas.', // MT
    de: 'Die Liste, aus der Threads wählen — auf öffentlichen Übersichten und Website-Embeds können Besucher danach filtern.', // MT
    fr: 'La liste dans laquelle les threads choisissent — sur les pages publiques et les embeds, les visiteurs peuvent filtrer par celles-ci.', // MT
  },
  new_category: {
    en: 'New category',
    nl: 'Nieuwe categorie',
    es: 'Nueva categoría', // MT
    pt: 'Nova categoria', // MT
    de: 'Neue Kategorie', // MT
    fr: 'Nouvelle catégorie', // MT
  },
  category_placeholder: {
    en: 'e.g. Festivals',
    nl: 'bijv. Festivals',
    es: 'p. ej. Festivales', // MT
    pt: 'ex.: Festivais', // MT
    de: 'z. B. Festivals', // MT
    fr: 'p. ex. Festivals', // MT
  },
  visible_to: {
    en: 'Visible to',
    nl: 'Zichtbaar voor',
    es: 'Visible para', // MT
    pt: 'Visível para', // MT
    de: 'Sichtbar für', // MT
    fr: 'Visible par', // MT
  },
  whole_workspace: {
    en: 'Whole workspace',
    nl: 'Hele werkruimte',
    es: 'Todo el espacio de trabajo', // MT
    pt: 'Todo o espaço de trabalho', // MT
    de: 'Gesamter Workspace', // MT
    fr: 'Tout l’espace de travail', // MT
  },
  only_me: {
    en: 'Only me',
    nl: 'Alleen ik',
    es: 'Solo yo', // MT
    pt: 'Só eu', // MT
    de: 'Nur ich', // MT
    fr: 'Moi uniquement', // MT
  },
  personal: {
    en: 'Personal',
    nl: 'Persoonlijk',
    es: 'Personal', // MT
    pt: 'Pessoal', // MT
    de: 'Persönlich', // MT
    fr: 'Personnel', // MT
  },
  workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  no_categories_yet: {
    en: 'No categories yet — add the first above.',
    nl: 'Nog geen categorieën — voeg hierboven de eerste toe.',
    es: 'Aún no hay categorías — añade la primera arriba.', // MT
    pt: 'Ainda não há categorias — adicione a primeira acima.', // MT
    de: 'Noch keine Kategorien — füge oben die erste hinzu.', // MT
    fr: 'Pas encore de catégories — ajoute la première ci-dessus.', // MT
  },
  category_delete_tooltip: {
    en: 'Delete — threads using it simply lose the label',
    nl: 'Verwijderen — threads die hem gebruiken raken alleen het label kwijt',
    es: 'Eliminar — los threads que la usan simplemente pierden la etiqueta', // MT
    pt: 'Excluir — os threads que a usam apenas perdem o rótulo', // MT
    de: 'Löschen — Threads, die sie nutzen, verlieren nur das Label', // MT
    fr: 'Supprimer — les threads qui l’utilisent perdent simplement l’étiquette', // MT
  },
  category_code_note: {
    en: 'The code next to each name is what website embeds filter by — it stays the same when you rename, so embedded listings keep working.',
    nl: 'De code naast elke naam is waar website-embeds op filteren — die blijft gelijk als je hernoemt, zodat embedded overzichten blijven werken.',
    es: 'El código junto a cada nombre es por el que filtran los embeds — no cambia al renombrar, así los listados incrustados siguen funcionando.', // MT
    pt: 'O código ao lado de cada nome é pelo que os embeds filtram — ele não muda quando você renomeia, então as listagens incorporadas continuam funcionando.', // MT
    de: 'Der Code neben jedem Namen ist das, wonach Website-Embeds filtern — er bleibt beim Umbenennen gleich, damit eingebettete Übersichten weiter funktionieren.', // MT
    fr: 'Le code à côté de chaque nom est ce par quoi filtrent les embeds — il ne change pas quand tu renommes, les listes intégrées continuent donc de fonctionner.', // MT
  },

  // ── settings → connections ────────────────────────────────────────────
  connections_title: {
    en: 'Connections',
    nl: 'Verbindingen',
    es: 'Conexiones', // MT
    pt: 'Conexões', // MT
    de: 'Verbindungen', // MT
    fr: 'Connexions', // MT
  },
  connections_desc: {
    en: 'External services connected to your account — one connection per person, shared across Meet and Thread.',
    nl: 'Externe diensten gekoppeld aan je account — één verbinding per persoon, gedeeld tussen Meet en Thread.',
    es: 'Servicios externos conectados a tu cuenta — una conexión por persona, compartida entre Meet y Thread.', // MT
    pt: 'Serviços externos conectados à sua conta — uma conexão por pessoa, compartilhada entre o Meet e o Thread.', // MT
    de: 'Externe Dienste, die mit deinem Konto verbunden sind — eine Verbindung pro Person, geteilt zwischen Meet und Thread.', // MT
    fr: 'Services externes reliés à ton compte — une connexion par personne, partagée entre Meet et Thread.', // MT
  },
  couldnt_load: {
    en: "Couldn't load: {error}",
    nl: 'Kon niet laden: {error}',
    es: 'No se pudo cargar: {error}', // MT
    pt: 'Não foi possível carregar: {error}', // MT
    de: 'Konnte nicht geladen werden: {error}', // MT
    fr: 'Chargement impossible : {error}', // MT
  },
  calendars: {
    en: 'Calendars',
    nl: 'Agenda’s',
    es: 'Calendarios', // MT
    pt: 'Calendários', // MT
    de: 'Kalender', // MT
    fr: 'Calendriers', // MT
  },
  personal_room: {
    en: 'Personal meeting room',
    nl: 'Persoonlijke vergaderruimte',
    es: 'Sala de reuniones personal', // MT
    pt: 'Sala de reunião pessoal', // MT
    de: 'Persönlicher Meeting-Raum', // MT
    fr: 'Salle de réunion personnelle', // MT
  },
  personal_room_desc_1: {
    en: 'Used by activities set to',
    nl: 'Gebruikt door activiteiten die op',
    es: 'Lo usan las actividades configuradas como', // MT
    pt: 'Usada por atividades configuradas como', // MT
    de: 'Genutzt von Aktivitäten mit der Einstellung', // MT
    fr: 'Utilisée par les activités réglées sur', // MT
  },
  personal_room_desc_2: {
    en: '— a static Zoom Personal Meeting Room URL, your Whereby link, anything that lives at a fixed URL.',
    nl: 'staan — een vaste Zoom Personal Meeting Room-URL, je Whereby-link, alles met een vast adres.',
    es: '— una URL fija de tu sala personal de Zoom, tu enlace de Whereby, cualquier cosa con una URL fija.', // MT
    pt: '— uma URL fixa da sua sala pessoal do Zoom, seu link do Whereby, qualquer coisa com endereço fixo.', // MT
    de: '— eine feste Zoom-Personal-Meeting-Room-URL, dein Whereby-Link, alles mit fester URL.', // MT
    fr: '— une URL fixe de salle personnelle Zoom, ton lien Whereby, tout ce qui vit à une adresse fixe.', // MT
  },
  personal_room_option: {
    en: 'Personal room',
    nl: 'Persoonlijke ruimte',
    es: 'Sala personal', // MT
    pt: 'Sala pessoal', // MT
    de: 'Persönlicher Raum', // MT
    fr: 'Salle personnelle', // MT
  },
  personal_room_url: {
    en: 'Personal meeting room URL',
    nl: 'URL van je persoonlijke vergaderruimte',
    es: 'URL de tu sala de reuniones personal', // MT
    pt: 'URL da sua sala de reunião pessoal', // MT
    de: 'URL deines persönlichen Meeting-Raums', // MT
    fr: 'URL de ta salle de réunion personnelle', // MT
  },
  google_calendar: {
    en: 'Google Calendar',
    nl: 'Google Agenda',
    es: 'Google Calendar', // MT
    pt: 'Google Agenda', // MT
    de: 'Google Kalender', // MT
    fr: 'Google Agenda', // MT
  },
  google_connect_desc: {
    en: 'One connection for all Fibre apps: Meet reads your free/busy and creates calendar events (with a Meet link) when someone books.',
    nl: 'Eén verbinding voor alle Fibre-apps: Meet leest je beschikbaarheid en zet agenda-items (met Meet-link) klaar zodra iemand boekt.',
    es: 'Una conexión para todas las apps de Fibre: Meet lee tu disponibilidad y crea eventos de calendario (con enlace de Meet) cuando alguien reserva.', // MT
    pt: 'Uma conexão para todos os apps Fibre: o Meet lê sua disponibilidade e cria eventos no calendário (com link do Meet) quando alguém agenda.', // MT
    de: 'Eine Verbindung für alle Fibre-Apps: Meet liest deine Verfügbarkeit und legt Kalendereinträge an (mit Meet-Link), sobald jemand bucht.', // MT
    fr: 'Une connexion pour toutes les apps Fibre : Meet lit tes disponibilités et crée des événements d’agenda (avec lien Meet) quand quelqu’un réserve.', // MT
  },
  google_connected_msg: {
    en: '✓ Connected. Calendars synced.',
    nl: '✓ Verbonden. Agenda’s gesynchroniseerd.',
    es: '✓ Conectado. Calendarios sincronizados.', // MT
    pt: '✓ Conectado. Calendários sincronizados.', // MT
    de: '✓ Verbunden. Kalender synchronisiert.', // MT
    fr: '✓ Connecté. Calendriers synchronisés.', // MT
  },
  google_connect_failed: {
    en: "Couldn't connect{reason}. Try again.",
    nl: 'Verbinden lukte niet{reason}. Probeer het opnieuw.',
    es: 'No se pudo conectar{reason}. Inténtalo de nuevo.', // MT
    pt: 'Não foi possível conectar{reason}. Tente novamente.', // MT
    de: 'Verbindung fehlgeschlagen{reason}. Versuche es erneut.', // MT
    fr: 'Connexion impossible{reason}. Réessaie.', // MT
  },
  google_connect_start_failed: {
    en: 'Could not start Google connect.',
    nl: 'Kon de Google-koppeling niet starten.',
    es: 'No se pudo iniciar la conexión con Google.', // MT
    pt: 'Não foi possível iniciar a conexão com o Google.', // MT
    de: 'Die Google-Verbindung konnte nicht gestartet werden.', // MT
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
  connect_google: {
    en: 'Connect Google',
    nl: 'Google koppelen',
    es: 'Conectar Google', // MT
    pt: 'Conectar Google', // MT
    de: 'Google verbinden', // MT
    fr: 'Connecter Google', // MT
  },
  starting: {
    en: 'Starting…',
    nl: 'Starten…',
    es: 'Iniciando…', // MT
    pt: 'Iniciando…', // MT
    de: 'Wird gestartet…', // MT
    fr: 'Démarrage…', // MT
  },

  // ── settings → payments ───────────────────────────────────────────────
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
    es: 'Una sola configuración de pagos para todas las apps de Fibre — tu cuenta personal y la del espacio de trabajo, más tus opciones de pago por defecto.', // MT
    pt: 'Uma única configuração de pagamentos para todos os apps Fibre — sua conta pessoal e a do espaço de trabalho, além das suas opções de pagamento padrão.', // MT
    de: 'Ein Satz Zahlungseinstellungen für alle Fibre-Apps — dein persönliches Konto und das des Workspace, plus deine Standard-Zahlungsoptionen.', // MT
    fr: 'Un seul jeu de réglages de paiement pour toutes les apps Fibre — ton compte personnel et celui de l’espace de travail, plus tes options de paiement par défaut.', // MT
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
    en: 'Payouts for your personal threads and meeting types — one connection, every Fibre app uses it. The invoice details appear as the seller on receipts for your personal sales.',
    nl: 'Uitbetalingen voor je persoonlijke threads en afspraaktypen — één koppeling, elke Fibre-app gebruikt hem. De factuurgegevens verschijnen als verkoper op bonnen van je persoonlijke verkopen.',
    es: 'Cobros de tus threads personales y tipos de reunión — una conexión que usan todas las apps de Fibre. Los datos de facturación aparecen como vendedor en los recibos de tus ventas personales.', // MT
    pt: 'Repasses dos seus threads pessoais e tipos de reunião — uma conexão, usada por todos os apps Fibre. Os dados de fatura aparecem como vendedor nos recibos das suas vendas pessoais.', // MT
    de: 'Auszahlungen für deine persönlichen Threads und Meeting-Typen — eine Verbindung, die jede Fibre-App nutzt. Die Rechnungsdaten erscheinen als Verkäufer auf Belegen deiner persönlichen Verkäufe.', // MT
    fr: 'Les versements de tes threads personnels et types de rendez-vous — une connexion, utilisée par toutes les apps Fibre. Les coordonnées de facturation apparaissent comme vendeur sur les reçus de tes ventes personnelles.', // MT
  },
  workspace_account: {
    en: 'Workspace account',
    nl: 'Werkruimte-account',
    es: 'Cuenta del espacio de trabajo', // MT
    pt: 'Conta do espaço de trabalho', // MT
    de: 'Workspace-Konto', // MT
    fr: 'Compte de l’espace de travail', // MT
  },
  workspace_account_desc: {
    en: "Payouts for team threads and anything routed to the workspace. Teams don't hold their own accounts — team sales land here, with these invoice details as the seller.",
    nl: 'Uitbetalingen voor teamthreads en alles wat naar de werkruimte gaat. Teams hebben geen eigen account — teamverkopen landen hier, met deze factuurgegevens als verkoper.',
    es: 'Cobros de los threads de equipo y de todo lo que va al espacio de trabajo. Los equipos no tienen cuenta propia — sus ventas llegan aquí, con estos datos como vendedor.', // MT
    pt: 'Repasses dos threads de equipe e de tudo que vai para o espaço de trabalho. As equipes não têm conta própria — as vendas caem aqui, com estes dados como vendedor.', // MT
    de: 'Auszahlungen für Team-Threads und alles, was zum Workspace geleitet wird. Teams haben keine eigenen Konten — Teamverkäufe landen hier, mit diesen Rechnungsdaten als Verkäufer.', // MT
    fr: 'Les versements des threads d’équipe et de tout ce qui est routé vers l’espace de travail. Les équipes n’ont pas de compte propre — leurs ventes arrivent ici, avec ces coordonnées comme vendeur.', // MT
  },
  methods_hint_workspace: {
    en: 'team & workspace threads inherit these',
    nl: 'team- en werkruimtethreads erven deze',
    es: 'los threads de equipo y del espacio los heredan', // MT
    pt: 'threads de equipe e do espaço herdam estas', // MT
    de: 'Team- und Workspace-Threads erben diese', // MT
    fr: 'les threads d’équipe et d’espace en héritent', // MT
  },
  methods_hint_personal: {
    en: 'your personal threads and tickets inherit these',
    nl: 'je persoonlijke threads en tickets erven deze',
    es: 'tus threads y entradas personales los heredan', // MT
    pt: 'seus threads e ingressos pessoais herdam estas', // MT
    de: 'deine persönlichen Threads und Tickets erben diese', // MT
    fr: 'tes threads et billets personnels en héritent', // MT
  },
  managed_by_admins: {
    en: 'Managed by workspace admins.',
    nl: 'Beheerd door werkruimtebeheerders.',
    es: 'Lo gestionan los administradores del espacio.', // MT
    pt: 'Gerenciado pelos administradores do espaço.', // MT
    de: 'Wird von Workspace-Admins verwaltet.', // MT
    fr: 'Géré par les admins de l’espace de travail.', // MT
  },
  stripe_note_1: {
    en: 'The Stripe account id starts with',
    nl: 'Het Stripe-account-id begint met',
    es: 'El id de la cuenta de Stripe empieza por', // MT
    pt: 'O id da conta Stripe começa com', // MT
    de: 'Die Stripe-Konto-ID beginnt mit', // MT
    fr: 'L’identifiant du compte Stripe commence par', // MT
  },
  stripe_note_2: {
    en: '(Stripe → Settings → Account details). Leaving it empty disconnects. Payment options inherit downward: account default → thread → ticket, each level can override.',
    nl: '(Stripe → Settings → Account details). Leeg laten ontkoppelt. Betaalopties erven naar beneden: accountstandaard → thread → ticket, elk niveau kan afwijken.',
    es: '(Stripe → Settings → Account details). Dejarlo vacío desconecta. Las opciones de pago se heredan hacia abajo: cuenta → thread → entrada, cada nivel puede sobrescribir.', // MT
    pt: '(Stripe → Settings → Account details). Deixar vazio desconecta. As opções de pagamento herdam para baixo: padrão da conta → thread → ingresso, cada nível pode sobrescrever.', // MT
    de: '(Stripe → Settings → Account details). Leer lassen trennt die Verbindung. Zahlungsoptionen vererben sich nach unten: Konto-Standard → Thread → Ticket, jede Ebene kann abweichen.', // MT
    fr: '(Stripe → Settings → Account details). Laisser vide déconnecte. Les options de paiement s’héritent vers le bas : défaut du compte → thread → billet, chaque niveau peut surcharger.', // MT
  },
  stripe_account_id: {
    en: 'Stripe account id',
    nl: 'Stripe-account-id',
    es: 'Id de cuenta de Stripe', // MT
    pt: 'Id da conta Stripe', // MT
    de: 'Stripe-Konto-ID', // MT
    fr: 'Identifiant de compte Stripe', // MT
  },
  legal_name_on_invoices: {
    en: 'Legal name (on invoices)',
    nl: 'Juridische naam (op facturen)',
    es: 'Razón social (en facturas)', // MT
    pt: 'Razão social (nas faturas)', // MT
    de: 'Rechtlicher Name (auf Rechnungen)', // MT
    fr: 'Raison sociale (sur les factures)', // MT
  },
  tax_vat_number: {
    en: 'Tax / VAT number',
    nl: 'Btw-nummer',
    es: 'NIF / número de IVA', // MT
    pt: 'NIF / número de IVA', // MT
    de: 'USt-IdNr.', // MT
    fr: 'Numéro de TVA', // MT
  },
  address_on_invoices: {
    en: 'Address (on invoices)',
    nl: 'Adres (op facturen)',
    es: 'Dirección (en facturas)', // MT
    pt: 'Endereço (nas faturas)', // MT
    de: 'Adresse (auf Rechnungen)', // MT
    fr: 'Adresse (sur les factures)', // MT
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
    de: 'Online bezahlen (Karte)', // MT
    fr: 'Paiement en ligne (carte)', // MT
  },
  pay_per_invoice: {
    en: 'Pay per invoice',
    nl: 'Betalen op factuur',
    es: 'Pago por factura', // MT
    pt: 'Pagar por fatura', // MT
    de: 'Auf Rechnung zahlen', // MT
    fr: 'Paiement sur facture', // MT
  },
  err_acct_prefix: {
    en: 'A Stripe account id starts with acct_',
    nl: 'Een Stripe-account-id begint met acct_',
    es: 'Un id de cuenta de Stripe empieza por acct_', // MT
    pt: 'Um id de conta Stripe começa com acct_', // MT
    de: 'Eine Stripe-Konto-ID beginnt mit acct_', // MT
    fr: 'Un identifiant de compte Stripe commence par acct_', // MT
  },
  err_keep_one_method: {
    en: 'Keep at least one payment option on.',
    nl: 'Houd minstens één betaaloptie aan.',
    es: 'Mantén activa al menos una opción de pago.', // MT
    pt: 'Mantenha pelo menos uma opção de pagamento ativa.', // MT
    de: 'Lass mindestens eine Zahlungsoption aktiviert.', // MT
    fr: 'Garde au moins une option de paiement activée.', // MT
  },
  err_vat_rate: {
    en: 'VAT rate must be between 0 and 100.',
    nl: 'Het btw-tarief moet tussen 0 en 100 liggen.',
    es: 'El tipo de IVA debe estar entre 0 y 100.', // MT
    pt: 'A alíquota de IVA deve estar entre 0 e 100.', // MT
    de: 'Der USt-Satz muss zwischen 0 und 100 liegen.', // MT
    fr: 'Le taux de TVA doit être compris entre 0 et 100.', // MT
  },
  // ── dashboard ─────────────────────────────────────────────────────────
  dash_welcome: {
    en: 'Welcome to Thread, {name}',
    nl: 'Welkom bij Thread, {name}',
    es: 'Bienvenido a Thread, {name}', // MT
    pt: 'Bem-vindo ao Thread, {name}', // MT
    de: 'Willkommen bei Thread, {name}', // MT
    fr: 'Bienvenue dans Thread, {name}', // MT
  },
  dash_what_lives_here: {
    en: 'What lives here',
    nl: 'Wat hier staat',
    es: 'Qué vive aquí', // MT
    pt: 'O que vive aqui', // MT
    de: 'Was hier lebt', // MT
    fr: 'Ce qui vit ici', // MT
  },
  dash_lives_1: {
    en: 'Conferences and multi-session programmes',
    nl: 'Conferenties en programma’s met meerdere sessies',
    es: 'Conferencias y programas de varias sesiones', // MT
    pt: 'Conferências e programas de várias sessões', // MT
    de: 'Konferenzen und mehrteilige Programme', // MT
    fr: 'Conférences et programmes à plusieurs sessions', // MT
  },
  dash_lives_2: {
    en: 'Post-event journeys — the arc that follows a gathering',
    nl: 'Reizen na afloop — de boog die op een bijeenkomst volgt',
    es: 'Recorridos posteriores al evento — el arco que sigue a un encuentro', // MT
    pt: 'Jornadas pós-evento — o arco que segue um encontro', // MT
    de: 'Journeys nach dem Event — der Bogen, der auf ein Treffen folgt', // MT
    fr: 'Parcours post-événement — l’arc qui suit un rassemblement', // MT
  },
  dash_lives_3: {
    en: 'Enrolment state per participant',
    nl: 'Inschrijvingsstatus per deelnemer',
    es: 'Estado de inscripción por participante', // MT
    pt: 'Estado de inscrição por participante', // MT
    de: 'Anmeldestatus pro Teilnehmer:in', // MT
    fr: 'État d’inscription par participant', // MT
  },
  dash_lives_4: {
    en: 'Session-level attendance + milestones',
    nl: 'Aanwezigheid per sessie + mijlpalen',
    es: 'Asistencia por sesión + hitos', // MT
    pt: 'Presença por sessão + marcos', // MT
    de: 'Anwesenheit pro Session + Meilensteine', // MT
    fr: 'Présence par session + jalons', // MT
  },
  dash_what_stays: {
    en: 'What stays on The Fibre',
    nl: 'Wat op The Fibre blijft',
    es: 'Qué se queda en The Fibre', // MT
    pt: 'O que fica no The Fibre', // MT
    de: 'Was auf The Fibre bleibt', // MT
    fr: 'Ce qui reste sur The Fibre', // MT
  },
  dash_stays_body: {
    en: 'Identity (the person, the organisation), the platform activity log, and shared programme/enrolment state. Curator data tagged for Thread also lives on The Fibre but is only visible to Thread members.',
    nl: 'Identiteit (de persoon, de organisatie), het activiteitenlogboek van het platform en gedeelde programma-/inschrijvingsstatus. Curatordata met een Thread-label staat ook op The Fibre, maar is alleen zichtbaar voor Thread-leden.',
    es: 'La identidad (la persona, la organización), el registro de actividad de la plataforma y el estado compartido de programas e inscripciones. Los datos de curador etiquetados para Thread también viven en The Fibre, pero solo los ven los miembros de Thread.', // MT
    pt: 'A identidade (a pessoa, a organização), o registro de atividade da plataforma e o estado compartilhado de programas/inscrições. Dados de curadoria marcados para o Thread também vivem no The Fibre, mas só são visíveis para membros do Thread.', // MT
    de: 'Identität (die Person, die Organisation), das Aktivitätsprotokoll der Plattform und geteilter Programm-/Anmeldestatus. Für Thread markierte Kuratordaten liegen ebenfalls auf The Fibre, sind aber nur für Thread-Mitglieder sichtbar.', // MT
    fr: 'L’identité (la personne, l’organisation), le journal d’activité de la plateforme et l’état partagé des programmes/inscriptions. Les données de curation marquées pour Thread vivent aussi sur The Fibre mais ne sont visibles que par les membres de Thread.', // MT
  },
  dash_skeleton: {
    en: 'Skeleton. Programme creation, session attendance tracking, and the public arc view come next.',
    nl: 'Skelet. Programma’s aanmaken, aanwezigheid per sessie bijhouden en de openbare boogweergave volgen hierna.',
    es: 'Esqueleto. La creación de programas, el registro de asistencia por sesión y la vista pública del arco llegan después.', // MT
    pt: 'Esqueleto. Criação de programas, registro de presença por sessão e a visão pública do arco vêm a seguir.', // MT
    de: 'Skelett. Programm-Erstellung, Anwesenheits-Tracking pro Session und die öffentliche Bogen-Ansicht kommen als Nächstes.', // MT
    fr: 'Squelette. La création de programmes, le suivi de présence par session et la vue publique de l’arc arrivent ensuite.', // MT
  },

  // ── threads list ──────────────────────────────────────────────────────
  threads_desc: {
    en: 'Events and journeys — each thread carries its own engagements, enrolments and certificate.',
    nl: 'Evenementen en reizen — elke thread draagt zijn eigen engagements, inschrijvingen en certificaat.',
    es: 'Eventos y recorridos — cada thread lleva sus propios compromisos, inscripciones y certificado.', // MT
    pt: 'Eventos e jornadas — cada thread carrega seus próprios engajamentos, inscrições e certificado.', // MT
    de: 'Veranstaltungen und Journeys — jeder Thread trägt seine eigenen Engagements, Anmeldungen und sein Zertifikat.', // MT
    fr: 'Événements et parcours — chaque thread porte ses propres engagements, inscriptions et certificat.', // MT
  },
  no_dates_yet: {
    en: 'No dates yet',
    nl: 'Nog geen datums',
    es: 'Aún sin fechas', // MT
    pt: 'Ainda sem datas', // MT
    de: 'Noch keine Termine', // MT
    fr: 'Pas encore de dates', // MT
  },
  filter_all: {
    en: 'All',
    nl: 'Alle',
    es: 'Todos', // MT
    pt: 'Todos', // MT
    de: 'Alle', // MT
    fr: 'Tous', // MT
  },
  filter_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activos', // MT
    pt: 'Ativos', // MT
    de: 'Aktiv', // MT
    fr: 'Actifs', // MT
  },
  filter_drafts: {
    en: 'Drafts',
    nl: 'Concepten',
    es: 'Borradores', // MT
    pt: 'Rascunhos', // MT
    de: 'Entwürfe', // MT
    fr: 'Brouillons', // MT
  },
  filter_past: {
    en: 'Past',
    nl: 'Voorbij',
    es: 'Pasados', // MT
    pt: 'Passados', // MT
    de: 'Vergangen', // MT
    fr: 'Passés', // MT
  },
  filter_everyone: {
    en: 'Everyone',
    nl: 'Iedereen',
    es: 'Todo el mundo', // MT
    pt: 'Todo mundo', // MT
    de: 'Alle', // MT
    fr: 'Tout le monde', // MT
  },
  threads_empty: {
    en: 'No threads yet. Create your first — an event with a schedule, or a journey that unfolds over time.',
    nl: 'Nog geen threads. Maak je eerste — een evenement met een programma, of een reis die zich in de tijd ontvouwt.',
    es: 'Aún no hay threads. Crea el primero — un evento con programa, o un recorrido que se despliega en el tiempo.', // MT
    pt: 'Ainda não há threads. Crie o primeiro — um evento com programação, ou uma jornada que se desenrola no tempo.', // MT
    de: 'Noch keine Threads. Erstelle deinen ersten — eine Veranstaltung mit Programm oder eine Journey, die sich über die Zeit entfaltet.', // MT
    fr: 'Pas encore de threads. Crée le premier — un événement avec programme, ou un parcours qui se déploie dans le temps.', // MT
  },
  nothing_for_filter: {
    en: 'Nothing here for this filter.',
    nl: 'Niets voor dit filter.',
    es: 'Nada aquí con este filtro.', // MT
    pt: 'Nada aqui para este filtro.', // MT
    de: 'Nichts für diesen Filter.', // MT
    fr: 'Rien ici pour ce filtre.', // MT
  },
  status_draft: {
    en: 'Draft',
    nl: 'Concept',
    es: 'Borrador', // MT
    pt: 'Rascunho', // MT
    de: 'Entwurf', // MT
    fr: 'Brouillon', // MT
  },
  status_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activo', // MT
    pt: 'Ativo', // MT
    de: 'Aktiv', // MT
    fr: 'Actif', // MT
  },
  status_completed: {
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
  new_thread: {
    en: 'New thread',
    nl: 'Nieuwe thread',
    es: 'Nuevo thread', // MT
    pt: 'Novo thread', // MT
    de: 'Neuer Thread', // MT
    fr: 'Nouveau thread', // MT
  },
  start_from_scratch: {
    en: 'Start from scratch',
    nl: 'Begin vanaf nul',
    es: 'Empezar desde cero', // MT
    pt: 'Começar do zero', // MT
    de: 'Von Grund auf beginnen', // MT
    fr: 'Partir de zéro', // MT
  },
  from_a_template: {
    en: 'From a template',
    nl: 'Vanuit een sjabloon',
    es: 'Desde una plantilla', // MT
    pt: 'A partir de um modelo', // MT
    de: 'Aus einer Vorlage', // MT
    fr: 'À partir d’un modèle', // MT
  },

  // ── contacts ──────────────────────────────────────────────────────────
  contacts_desc: {
    en: 'The people Thread knows — everyone who has enrolled in one of your threads.',
    nl: 'De mensen die Thread kent — iedereen die zich ooit voor een van je threads heeft ingeschreven.',
    es: 'Las personas que Thread conoce — todo el que se ha inscrito en alguno de tus threads.', // MT
    pt: 'As pessoas que o Thread conhece — todos que já se inscreveram em um dos seus threads.', // MT
    de: 'Die Menschen, die Thread kennt — alle, die sich je für einen deiner Threads angemeldet haben.', // MT
    fr: 'Les personnes que Thread connaît — tous ceux qui se sont inscrits à l’un de tes threads.', // MT
  },
  contacts_empty: {
    en: 'Contacts appear when people enrol in your threads.',
    nl: 'Contacten verschijnen zodra mensen zich inschrijven voor je threads.',
    es: 'Los contactos aparecen cuando la gente se inscribe en tus threads.', // MT
    pt: 'Os contatos aparecem quando as pessoas se inscrevem nos seus threads.', // MT
    de: 'Kontakte erscheinen, sobald sich Menschen für deine Threads anmelden.', // MT
    fr: 'Les contacts apparaissent quand des personnes s’inscrivent à tes threads.', // MT
  },
  unknown: {
    en: 'Unknown',
    nl: 'Onbekend',
    es: 'Desconocido', // MT
    pt: 'Desconhecido', // MT
    de: 'Unbekannt', // MT
    fr: 'Inconnu', // MT
  },
  no_email: {
    en: 'No email',
    nl: 'Geen e-mail',
    es: 'Sin correo', // MT
    pt: 'Sem e-mail', // MT
    de: 'Keine E-Mail', // MT
    fr: 'Pas d’e-mail', // MT
  },
  no_thread_enrolments: {
    en: 'No thread enrolments.',
    nl: 'Geen thread-inschrijvingen.',
    es: 'Sin inscripciones a threads.', // MT
    pt: 'Sem inscrições em threads.', // MT
    de: 'Keine Thread-Anmeldungen.', // MT
    fr: 'Aucune inscription à un thread.', // MT
  },
  last_enrolled: {
    en: 'Last enrolled',
    nl: 'Laatst ingeschreven',
    es: 'Última inscripción', // MT
    pt: 'Última inscrição', // MT
    de: 'Zuletzt angemeldet', // MT
    fr: 'Dernière inscription', // MT
  },
  open_in_fibre: {
    en: 'Open in The Fibre',
    nl: 'Openen in The Fibre',
    es: 'Abrir en The Fibre', // MT
    pt: 'Abrir no The Fibre', // MT
    de: 'In The Fibre öffnen', // MT
    fr: 'Ouvrir dans The Fibre', // MT
  },

  // ── teams ─────────────────────────────────────────────────────────────
  teams_desc: {
    en: "Shared groups that organise threads together — members see and share each other's work.",
    nl: 'Gedeelde groepen die samen threads organiseren — leden zien en delen elkaars werk.',
    es: 'Grupos compartidos que organizan threads juntos — los miembros ven y comparten el trabajo de los demás.', // MT
    pt: 'Grupos compartilhados que organizam threads juntos — os membros veem e compartilham o trabalho uns dos outros.', // MT
    de: 'Geteilte Gruppen, die gemeinsam Threads organisieren — Mitglieder sehen und teilen die Arbeit der anderen.', // MT
    fr: 'Des groupes partagés qui organisent des threads ensemble — les membres voient et partagent le travail des autres.', // MT
  },
  new_team: {
    en: 'New team',
    nl: 'Nieuw team',
    es: 'Nuevo equipo', // MT
    pt: 'Nova equipe', // MT
    de: 'Neues Team', // MT
    fr: 'Nouvelle équipe', // MT
  },
  teams_empty: {
    en: 'No teams yet. Create one so a group can own threads together.',
    nl: 'Nog geen teams. Maak er een aan zodat een groep samen threads kan beheren.',
    es: 'Aún no hay equipos. Crea uno para que un grupo pueda tener threads en común.', // MT
    pt: 'Ainda não há equipes. Crie uma para que um grupo possa ter threads em conjunto.', // MT
    de: 'Noch keine Teams. Erstelle eines, damit eine Gruppe gemeinsam Threads besitzen kann.', // MT
    fr: 'Pas encore d’équipes. Crées-en une pour qu’un groupe possède des threads ensemble.', // MT
  },
  new_team_desc: {
    en: 'A shared group that organises threads together. You become its first lead.',
    nl: 'Een gedeelde groep die samen threads organiseert. Jij wordt de eerste lead.',
    es: 'Un grupo compartido que organiza threads juntos. Tú serás su primer responsable.', // MT
    pt: 'Um grupo compartilhado que organiza threads juntos. Você se torna o primeiro líder.', // MT
    de: 'Eine geteilte Gruppe, die gemeinsam Threads organisiert. Du wirst ihr erster Lead.', // MT
    fr: 'Un groupe partagé qui organise des threads ensemble. Tu en deviens le premier responsable.', // MT
  },
  err_team_name: {
    en: 'Give the team a name.',
    nl: 'Geef het team een naam.',
    es: 'Ponle un nombre al equipo.', // MT
    pt: 'Dê um nome à equipe.', // MT
    de: 'Gib dem Team einen Namen.', // MT
    fr: 'Donne un nom à l’équipe.', // MT
  },
  err_pick_slug: {
    en: 'Pick a URL slug.',
    nl: 'Kies een URL-slug.',
    es: 'Elige un slug para la URL.', // MT
    pt: 'Escolha um slug para a URL.', // MT
    de: 'Wähle einen URL-Slug.', // MT
    fr: 'Choisis un slug d’URL.', // MT
  },
  team_slug_hint: {
    en: 'Lowercase letters, digits and hyphens. Teams share the root slug namespace with organisers.',
    nl: 'Kleine letters, cijfers en koppeltekens. Teams delen de slug-naamruimte met organisatoren.',
    es: 'Minúsculas, dígitos y guiones. Los equipos comparten el espacio de slugs con los organizadores.', // MT
    pt: 'Letras minúsculas, dígitos e hifens. As equipes compartilham o espaço de slugs com os organizadores.', // MT
    de: 'Kleinbuchstaben, Ziffern und Bindestriche. Teams teilen den Slug-Namensraum mit Veranstaltern.', // MT
    fr: 'Minuscules, chiffres et tirets. Les équipes partagent l’espace de slugs avec les organisateurs.', // MT
  },
  description: {
    en: 'Description',
    nl: 'Omschrijving',
    es: 'Descripción', // MT
    pt: 'Descrição', // MT
    de: 'Beschreibung', // MT
    fr: 'Description', // MT
  },
  team_desc_hint: {
    en: 'What this team is for — shown to members.',
    nl: 'Waar dit team voor is — zichtbaar voor leden.',
    es: 'Para qué es este equipo — visible para los miembros.', // MT
    pt: 'Para que serve esta equipe — visível para os membros.', // MT
    de: 'Wofür dieses Team da ist — für Mitglieder sichtbar.', // MT
    fr: 'À quoi sert cette équipe — visible par les membres.', // MT
  },
  creating: {
    en: 'Creating…',
    nl: 'Aanmaken…',
    es: 'Creando…', // MT
    pt: 'Criando…', // MT
    de: 'Wird erstellt…', // MT
    fr: 'Création…', // MT
  },
  create_team: {
    en: 'Create team',
    nl: 'Team aanmaken',
    es: 'Crear equipo', // MT
    pt: 'Criar equipe', // MT
    de: 'Team erstellen', // MT
    fr: 'Créer l’équipe', // MT
  },

  // ── templates ─────────────────────────────────────────────────────────
  templates_desc: {
    en: 'Reusable designs — for whole threads and for certificates.',
    nl: 'Herbruikbare ontwerpen — voor hele threads en voor certificaten.',
    es: 'Diseños reutilizables — para threads enteros y para certificados.', // MT
    pt: 'Designs reutilizáveis — para threads inteiros e para certificados.', // MT
    de: 'Wiederverwendbare Designs — für ganze Threads und für Zertifikate.', // MT
    fr: 'Des modèles réutilisables — pour des threads entiers et pour des certificats.', // MT
  },
  cert_templates: {
    en: 'Certificate templates',
    nl: 'Certificaatsjablonen',
    es: 'Plantillas de certificado', // MT
    pt: 'Modelos de certificado', // MT
    de: 'Zertifikatvorlagen', // MT
    fr: 'Modèles de certificat', // MT
  },
  cert_templates_card_desc: {
    en: 'Design certificates in the visual builder — threads pick one and issue it on completion.',
    nl: 'Ontwerp certificaten in de visuele builder — threads kiezen er een en reiken hem uit na afronding.',
    es: 'Diseña certificados en el editor visual — los threads eligen uno y lo emiten al finalizar.', // MT
    pt: 'Desenhe certificados no editor visual — os threads escolhem um e o emitem na conclusão.', // MT
    de: 'Gestalte Zertifikate im visuellen Builder — Threads wählen eines und stellen es nach Abschluss aus.', // MT
    fr: 'Conçois des certificats dans l’éditeur visuel — les threads en choisissent un et l’émettent à la fin.', // MT
  },
  thread_templates: {
    en: 'Thread templates',
    nl: 'Thread-sjablonen',
    es: 'Plantillas de thread', // MT
    pt: 'Modelos de thread', // MT
    de: 'Thread-Vorlagen', // MT
    fr: 'Modèles de thread', // MT
  },
  thread_templates_card_desc: {
    en: 'Save a thread as a template and start new ones from it — dates rebase automatically.',
    nl: 'Sla een thread op als sjabloon en start er nieuwe mee — datums schuiven automatisch mee.',
    es: 'Guarda un thread como plantilla y crea nuevos desde ella — las fechas se recalculan solas.', // MT
    pt: 'Salve um thread como modelo e crie novos a partir dele — as datas se reajustam automaticamente.', // MT
    de: 'Speichere einen Thread als Vorlage und starte neue daraus — Termine verschieben sich automatisch.', // MT
    fr: 'Enregistre un thread comme modèle et crées-en de nouveaux — les dates se recalent automatiquement.', // MT
  },
  thread_templates_desc: {
    en: 'Start new threads from a saved design — engagements, messages and triggers included, dates rebased automatically.',
    nl: 'Start nieuwe threads vanuit een opgeslagen ontwerp — engagements, berichten en triggers inbegrepen, datums schuiven automatisch mee.',
    es: 'Crea nuevos threads desde un diseño guardado — compromisos, mensajes y disparadores incluidos, con fechas recalculadas.', // MT
    pt: 'Crie novos threads a partir de um design salvo — engajamentos, mensagens e gatilhos incluídos, datas reajustadas automaticamente.', // MT
    de: 'Starte neue Threads aus einem gespeicherten Design — Engagements, Nachrichten und Trigger inklusive, Termine automatisch verschoben.', // MT
    fr: 'Crée de nouveaux threads à partir d’un design enregistré — engagements, messages et déclencheurs inclus, dates recalées automatiquement.', // MT
  },

  // ── invoices ──────────────────────────────────────────────────────────
  invoices_desc: {
    en: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
    nl: 'Elke aankoop in je Fibre-apps — zoeken, facturen opnieuw versturen, terugbetalen.',
    es: 'Cada compra en tus apps de Fibre — busca, reenvía facturas, reembolsa.', // MT
    pt: 'Cada compra nos seus apps Fibre — pesquise, reenvie faturas, reembolse.', // MT
    de: 'Jeder Kauf in deinen Fibre-Apps — suchen, Rechnungen erneut senden, erstatten.', // MT
    fr: 'Chaque achat dans tes apps Fibre — recherche, renvoi de factures, remboursement.', // MT
  },

  // ── help ──────────────────────────────────────────────────────────────
  help_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  help_home_blurb: {
    en: 'What is running, and what needs you.',
    nl: 'Wat er loopt, en wat jou nodig heeft.',
    es: 'Qué está en marcha y qué te necesita.', // MT
    pt: 'O que está em andamento e o que precisa de você.', // MT
    de: 'Was läuft, und was dich braucht.', // MT
    fr: 'Ce qui tourne, et ce qui a besoin de toi.', // MT
  },
  enrolments_desc: {
    en: 'Everyone enrolled across your threads.',
    nl: 'Iedereen die is ingeschreven in je threads.',
    es: 'Todos los inscritos en tus threads.', // MT
    pt: 'Todos os inscritos nos seus threads.', // MT
    de: 'Alle Angemeldeten über deine Threads hinweg.', // MT
    fr: 'Tous les inscrits à travers tes threads.', // MT
  },
  help_settings_blurb: {
    en: 'Your organiser profile and workspace defaults — emails, payments, website embeds.',
    nl: 'Je organisatorprofiel en werkruimte-standaarden — e-mails, betalingen, website-embeds.',
    es: 'Tu perfil de organizador y los valores del espacio — correos, pagos, embeds.', // MT
    pt: 'Seu perfil de organizador e os padrões do espaço — e-mails, pagamentos, embeds.', // MT
    de: 'Dein Veranstalterprofil und Workspace-Standards — E-Mails, Zahlungen, Website-Embeds.', // MT
    fr: 'Ton profil organisateur et les réglages de l’espace — e-mails, paiements, intégrations.', // MT
  },

  // ── internal team ─────────────────────────────────────────────────────
  internal_team: {
    en: 'Internal team',
    nl: 'Intern team',
    es: 'Equipo interno', // MT
    pt: 'Equipe interna', // MT
    de: 'Internes Team', // MT
    fr: 'Équipe interne', // MT
  },
  internal_team_desc: {
    en: 'Who in the workspace can use Thread — read-only here.',
    nl: 'Wie in de werkruimte Thread kan gebruiken — hier alleen-lezen.',
    es: 'Quién puede usar Thread en el espacio — aquí solo lectura.', // MT
    pt: 'Quem no espaço pode usar o Thread — aqui somente leitura.', // MT
    de: 'Wer im Workspace Thread nutzen kann — hier nur lesend.', // MT
    fr: 'Qui dans l’espace peut utiliser Thread — en lecture seule ici.', // MT
  },
  internal_managed_pre: {
    en: 'Members and app access are managed in',
    nl: 'Leden en app-toegang beheer je in',
    es: 'Los miembros y el acceso a apps se gestionan en', // MT
    pt: 'Membros e acesso aos apps são gerenciados no', // MT
    de: 'Mitglieder und App-Zugriff verwaltest du in', // MT
    fr: 'Les membres et l’accès aux apps se gèrent dans', // MT
  },
  internal_managed_post: {
    en: '→ Settings → Members.',
    nl: '→ Instellingen → Leden.',
    es: '→ Configuración → Miembros.', // MT
    pt: '→ Configurações → Membros.', // MT
    de: '→ Einstellungen → Mitglieder.', // MT
    fr: '→ Paramètres → Membres.', // MT
  },
  no_workspace_members: {
    en: 'No workspace members found.',
    nl: 'Geen werkruimteleden gevonden.',
    es: 'No se encontraron miembros del espacio.', // MT
    pt: 'Nenhum membro do espaço encontrado.', // MT
    de: 'Keine Workspace-Mitglieder gefunden.', // MT
    fr: 'Aucun membre de l’espace trouvé.', // MT
  },
  thread_admin: {
    en: 'Thread admin',
    nl: 'Thread-beheerder',
    es: 'Admin de Thread', // MT
    pt: 'Admin do Thread', // MT
    de: 'Thread-Admin', // MT
    fr: 'Admin Thread', // MT
  },
  thread_member: {
    en: 'Thread member',
    nl: 'Thread-lid',
    es: 'Miembro de Thread', // MT
    pt: 'Membro do Thread', // MT
    de: 'Thread-Mitglied', // MT
    fr: 'Membre Thread', // MT
  },
  no_access: {
    en: 'No access',
    nl: 'Geen toegang',
    es: 'Sin acceso', // MT
    pt: 'Sem acesso', // MT
    de: 'Kein Zugriff', // MT
    fr: 'Pas d’accès', // MT
  },
  // ── enrolments ────────────────────────────────────────────────────────
  enrolments_empty: {
    en: 'No enrolments yet. Publish a thread and share its public page — sign-ups land here.',
    nl: 'Nog geen inschrijvingen. Publiceer een thread en deel de openbare pagina — aanmeldingen landen hier.',
    es: 'Aún no hay inscripciones. Publica un thread y comparte su página pública — los registros llegan aquí.', // MT
    pt: 'Ainda não há inscrições. Publique um thread e compartilhe a página pública — os registros chegam aqui.', // MT
    de: 'Noch keine Anmeldungen. Veröffentliche einen Thread und teile die öffentliche Seite — Anmeldungen landen hier.', // MT
    fr: 'Pas encore d’inscriptions. Publie un thread et partage sa page publique — les inscriptions arrivent ici.', // MT
  },
  filtered: {
    en: 'Filtered',
    nl: 'Gefilterd',
    es: 'Filtrado', // MT
    pt: 'Filtrado', // MT
    de: 'Gefiltert', // MT
    fr: 'Filtré', // MT
  },
  clear_thread_filter: {
    en: 'Clear thread filter',
    nl: 'Threadfilter wissen',
    es: 'Quitar el filtro de thread', // MT
    pt: 'Limpar o filtro de thread', // MT
    de: 'Thread-Filter löschen', // MT
    fr: 'Effacer le filtre de thread', // MT
  },
  pay_pending: {
    en: 'Payment pending',
    nl: 'Betaling in afwachting',
    es: 'Pago pendiente', // MT
    pt: 'Pagamento pendente', // MT
    de: 'Zahlung ausstehend', // MT
    fr: 'Paiement en attente', // MT
  },
  pay_paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'Pagado', // MT
    pt: 'Pago', // MT
    de: 'Bezahlt', // MT
    fr: 'Payé', // MT
  },
  pay_refunded: {
    en: 'Refunded',
    nl: 'Terugbetaald',
    es: 'Reembolsado', // MT
    pt: 'Reembolsado', // MT
    de: 'Erstattet', // MT
    fr: 'Remboursé', // MT
  },
  pay_failed: {
    en: 'Payment failed',
    nl: 'Betaling mislukt',
    es: 'Pago fallido', // MT
    pt: 'Pagamento falhou', // MT
    de: 'Zahlung fehlgeschlagen', // MT
    fr: 'Paiement échoué', // MT
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
    nl: 'Afgehaakt',
    es: 'Abandonó', // MT
    pt: 'Desistiu', // MT
    de: 'Abgesprungen', // MT
    fr: 'Abandonné', // MT
  },
  search_enrolments_placeholder: {
    en: 'Search name, email or thread…',
    nl: 'Zoek op naam, e-mail of thread…',
    es: 'Busca por nombre, correo o thread…', // MT
    pt: 'Pesquise por nome, e-mail ou thread…', // MT
    de: 'Nach Name, E-Mail oder Thread suchen…', // MT
    fr: 'Rechercher par nom, e-mail ou thread…', // MT
  },
  n_selected: {
    en: '{n} selected',
    nl: '{n} geselecteerd',
    es: '{n} seleccionados', // MT
    pt: '{n} selecionados', // MT
    de: '{n} ausgewählt', // MT
    fr: '{n} sélectionnés', // MT
  },
  select_all: {
    en: 'Select all',
    nl: 'Alles selecteren',
    es: 'Seleccionar todo', // MT
    pt: 'Selecionar tudo', // MT
    de: 'Alle auswählen', // MT
    fr: 'Tout sélectionner', // MT
  },
  select_name: {
    en: 'Select {name}',
    nl: 'Selecteer {name}',
    es: 'Seleccionar a {name}', // MT
    pt: 'Selecionar {name}', // MT
    de: '{name} auswählen', // MT
    fr: 'Sélectionner {name}', // MT
  },
  issue_certificates_n: {
    en: 'Issue certificates ({n})',
    nl: 'Certificaten uitreiken ({n})',
    es: 'Emitir certificados ({n})', // MT
    pt: 'Emitir certificados ({n})', // MT
    de: 'Zertifikate ausstellen ({n})', // MT
    fr: 'Émettre les certificats ({n})', // MT
  },
  mark_completed_n: {
    en: 'Mark completed ({n})',
    nl: 'Markeer als afgerond ({n})',
    es: 'Marcar como completado ({n})', // MT
    pt: 'Marcar como concluído ({n})', // MT
    de: 'Als abgeschlossen markieren ({n})', // MT
    fr: 'Marquer comme terminé ({n})', // MT
  },
  download_print_n: {
    en: 'Download for print ({n})',
    nl: 'Downloaden om te printen ({n})',
    es: 'Descargar para imprimir ({n})', // MT
    pt: 'Baixar para impressão ({n})', // MT
    de: 'Zum Drucken herunterladen ({n})', // MT
    fr: 'Télécharger pour impression ({n})', // MT
  },
  send_by_email_n: {
    en: 'Send by email ({n})',
    nl: 'Per e-mail versturen ({n})',
    es: 'Enviar por correo ({n})', // MT
    pt: 'Enviar por e-mail ({n})', // MT
    de: 'Per E-Mail senden ({n})', // MT
    fr: 'Envoyer par e-mail ({n})', // MT
  },
  tooltip_no_awaiting: {
    en: 'Selection has no enrolments awaiting a certificate',
    nl: 'De selectie bevat geen inschrijvingen die op een certificaat wachten',
    es: 'La selección no tiene inscripciones a la espera de certificado', // MT
    pt: 'A seleção não tem inscrições aguardando certificado', // MT
    de: 'Die Auswahl enthält keine Anmeldungen, die auf ein Zertifikat warten', // MT
    fr: 'La sélection ne contient aucune inscription en attente de certificat', // MT
  },
  tooltip_no_enrolled: {
    en: 'Selection has no enrolled participants',
    nl: 'De selectie bevat geen ingeschreven deelnemers',
    es: 'La selección no tiene participantes inscritos', // MT
    pt: 'A seleção não tem participantes inscritos', // MT
    de: 'Die Auswahl enthält keine angemeldeten Teilnehmenden', // MT
    fr: 'La sélection ne contient aucun participant inscrit', // MT
  },
  tooltip_no_certs: {
    en: 'Selection has no issued certificates yet',
    nl: 'De selectie bevat nog geen uitgereikte certificaten',
    es: 'La selección aún no tiene certificados emitidos', // MT
    pt: 'A seleção ainda não tem certificados emitidos', // MT
    de: 'Die Auswahl enthält noch keine ausgestellten Zertifikate', // MT
    fr: 'La sélection ne contient pas encore de certificats émis', // MT
  },
  failed_suffix: {
    en: ', {n} failed',
    nl: ', {n} mislukt',
    es: ', {n} fallaron', // MT
    pt: ', {n} falharam', // MT
    de: ', {n} fehlgeschlagen', // MT
    fr: ', {n} en échec', // MT
  },
  msg_issued: {
    en: 'Issued {n} certificate(s){failed}.',
    nl: '{n} certifica(a)t(en) uitgereikt{failed}.',
    es: '{n} certificado(s) emitido(s){failed}.', // MT
    pt: '{n} certificado(s) emitido(s){failed}.', // MT
    de: '{n} Zertifikat(e) ausgestellt{failed}.', // MT
    fr: '{n} certificat(s) émis{failed}.', // MT
  },
  msg_emailed: {
    en: 'Emailed {n} certificate(s){failed}.',
    nl: '{n} certifica(a)t(en) gemaild{failed}.',
    es: '{n} certificado(s) enviado(s) por correo{failed}.', // MT
    pt: '{n} certificado(s) enviado(s) por e-mail{failed}.', // MT
    de: '{n} Zertifikat(e) per E-Mail gesendet{failed}.', // MT
    fr: '{n} certificat(s) envoyé(s) par e-mail{failed}.', // MT
  },
  msg_completed: {
    en: 'Marked {n} completed{failed} — certificates auto-issued where enabled.',
    nl: '{n} gemarkeerd als afgerond{failed} — certificaten automatisch uitgereikt waar ingeschakeld.',
    es: '{n} marcados como completados{failed} — certificados emitidos automáticamente donde está activado.', // MT
    pt: '{n} marcados como concluídos{failed} — certificados emitidos automaticamente onde ativado.', // MT
    de: '{n} als abgeschlossen markiert{failed} — Zertifikate automatisch ausgestellt, wo aktiviert.', // MT
    fr: '{n} marqués comme terminés{failed} — certificats émis automatiquement là où c’est activé.', // MT
  },

  // ── participant dialog ────────────────────────────────────────────────
  open_thread: {
    en: 'Open thread →',
    nl: 'Thread openen →',
    es: 'Abrir thread →', // MT
    pt: 'Abrir thread →', // MT
    de: 'Thread öffnen →', // MT
    fr: 'Ouvrir le thread →', // MT
  },
  receipt_sent: {
    en: 'Receipt sent.',
    nl: 'Bon verstuurd.',
    es: 'Recibo enviado.', // MT
    pt: 'Recibo enviado.', // MT
    de: 'Beleg gesendet.', // MT
    fr: 'Reçu envoyé.', // MT
  },
  send_receipt: {
    en: 'Send receipt',
    nl: 'Bon versturen',
    es: 'Enviar recibo', // MT
    pt: 'Enviar recibo', // MT
    de: 'Beleg senden', // MT
    fr: 'Envoyer le reçu', // MT
  },
  contact: {
    en: 'Contact',
    nl: 'Contact',
    es: 'Contacto', // MT
    pt: 'Contato', // MT
    de: 'Kontakt', // MT
    fr: 'Contact', // MT
  },
  thread: {
    en: 'Thread',
    nl: 'Thread',
    es: 'Thread', // MT
    pt: 'Thread', // MT
    de: 'Thread', // MT
    fr: 'Thread', // MT
  },
  speaks: {
    en: 'Speaks {language}',
    nl: 'Spreekt {language}',
    es: 'Habla {language}', // MT
    pt: 'Fala {language}', // MT
    de: 'Spricht {language}', // MT
    fr: 'Parle {language}', // MT
  },
  progress_suffix: {
    en: '{pct}% progress',
    nl: '{pct}% voortgang',
    es: '{pct}% de progreso', // MT
    pt: '{pct}% de progresso', // MT
    de: '{pct} % Fortschritt', // MT
    fr: '{pct}% de progression', // MT
  },
  signed_up: {
    en: 'Signed up',
    nl: 'Aangemeld',
    es: 'Registrado', // MT
    pt: 'Registrado', // MT
    de: 'Registriert', // MT
    fr: 'Inscrit le', // MT
  },
  certificate: {
    en: 'Certificate',
    nl: 'Certificaat',
    es: 'Certificado', // MT
    pt: 'Certificado', // MT
    de: 'Zertifikat', // MT
    fr: 'Certificat', // MT
  },
  payment: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago', // MT
    pt: 'Pagamento', // MT
    de: 'Zahlung', // MT
    fr: 'Paiement', // MT
  },
  amount: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Valor', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  by_invoice: {
    en: 'by invoice',
    nl: 'op factuur',
    es: 'por factura', // MT
    pt: 'por fatura', // MT
    de: 'auf Rechnung', // MT
    fr: 'sur facture', // MT
  },
  by_card: {
    en: 'card',
    nl: 'kaart',
    es: 'tarjeta', // MT
    pt: 'cartão', // MT
    de: 'Karte', // MT
    fr: 'carte', // MT
  },
  ticket: {
    en: 'Ticket',
    nl: 'Ticket',
    es: 'Entrada', // MT
    pt: 'Ingresso', // MT
    de: 'Ticket', // MT
    fr: 'Billet', // MT
  },
  discount_code: {
    en: 'Discount code',
    nl: 'Kortingscode',
    es: 'Código de descuento', // MT
    pt: 'Código de desconto', // MT
    de: 'Rabattcode', // MT
    fr: 'Code de réduction', // MT
  },
  billing: {
    en: 'Billing',
    nl: 'Facturering',
    es: 'Facturación', // MT
    pt: 'Faturamento', // MT
    de: 'Rechnungsstellung', // MT
    fr: 'Facturation', // MT
  },
  tax_vat: {
    en: 'Tax/VAT',
    nl: 'Btw',
    es: 'NIF/IVA', // MT
    pt: 'NIF/IVA', // MT
    de: 'USt', // MT
    fr: 'TVA', // MT
  },
  registration_answers: {
    en: 'Registration answers',
    nl: 'Registratie-antwoorden',
    es: 'Respuestas de registro', // MT
    pt: 'Respostas de registro', // MT
    de: 'Registrierungsantworten', // MT
    fr: 'Réponses d’inscription', // MT
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

  // ── certificate actions ───────────────────────────────────────────────
  reissue: {
    en: 'Reissue',
    nl: 'Opnieuw uitreiken',
    es: 'Reemitir', // MT
    pt: 'Reemitir', // MT
    de: 'Neu ausstellen', // MT
    fr: 'Réémettre', // MT
  },
  reissue_certificate: {
    en: 'Reissue certificate',
    nl: 'Certificaat opnieuw uitreiken',
    es: 'Reemitir certificado', // MT
    pt: 'Reemitir certificado', // MT
    de: 'Zertifikat neu ausstellen', // MT
    fr: 'Réémettre le certificat', // MT
  },
  reissue_tooltip: {
    en: 'Reissue — regenerate from the current template (number and issue date stay)',
    nl: 'Opnieuw uitreiken — regenereer vanuit het huidige sjabloon (nummer en uitreikdatum blijven)',
    es: 'Reemitir — regenerar desde la plantilla actual (número y fecha se mantienen)', // MT
    pt: 'Reemitir — regenerar a partir do modelo atual (número e data permanecem)', // MT
    de: 'Neu ausstellen — aus der aktuellen Vorlage neu erzeugen (Nummer und Datum bleiben)', // MT
    fr: 'Réémettre — régénérer depuis le modèle actuel (numéro et date conservés)', // MT
  },
  reissue_message: {
    en: 'This regenerates {number} from the CURRENT template design. The number, recipient and issue date stay the same — shared links keep working — but the look changes to the template as it is now.',
    nl: 'Dit regenereert {number} vanuit het HUIDIGE sjabloonontwerp. Nummer, ontvanger en uitreikdatum blijven gelijk — gedeelde links blijven werken — maar het uiterlijk wordt dat van het sjabloon zoals het nu is.',
    es: 'Esto regenera {number} desde el diseño ACTUAL de la plantilla. El número, el destinatario y la fecha se mantienen — los enlaces compartidos siguen funcionando — pero el aspecto pasa a ser el de la plantilla tal como está ahora.', // MT
    pt: 'Isso regenera {number} a partir do design ATUAL do modelo. Número, destinatário e data permanecem — links compartilhados continuam funcionando — mas o visual muda para o modelo como está agora.', // MT
    de: 'Das erzeugt {number} aus dem AKTUELLEN Vorlagendesign neu. Nummer, Empfänger und Ausstellungsdatum bleiben gleich — geteilte Links funktionieren weiter — aber das Aussehen wechselt zur Vorlage, wie sie jetzt ist.', // MT
    fr: 'Cela régénère {number} depuis le design ACTUEL du modèle. Le numéro, le destinataire et la date restent identiques — les liens partagés continuent de fonctionner — mais l’apparence devient celle du modèle tel qu’il est maintenant.', // MT
  },
  issuing: {
    en: 'Issuing…',
    nl: 'Uitreiken…',
    es: 'Emitiendo…', // MT
    pt: 'Emitindo…', // MT
    de: 'Wird ausgestellt…', // MT
    fr: 'Émission…', // MT
  },
  failed_retry: {
    en: 'Failed — retry',
    nl: 'Mislukt — opnieuw',
    es: 'Falló — reintentar', // MT
    pt: 'Falhou — tentar de novo', // MT
    de: 'Fehlgeschlagen — erneut', // MT
    fr: 'Échec — réessayer', // MT
  },
  issue_certificate: {
    en: 'Issue certificate',
    nl: 'Certificaat uitreiken',
    es: 'Emitir certificado', // MT
    pt: 'Emitir certificado', // MT
    de: 'Zertifikat ausstellen', // MT
    fr: 'Émettre le certificat', // MT
  },
  issue_to_completed: {
    en: 'Issue to completed',
    nl: 'Uitreiken aan afgeronden',
    es: 'Emitir a los completados', // MT
    pt: 'Emitir para os concluídos', // MT
    de: 'An Abgeschlossene ausstellen', // MT
    fr: 'Émettre aux terminés', // MT
  },
  bulk_issue_result: {
    en: 'Issued {issued}, skipped {skipped} (only completed enrolments).',
    nl: '{issued} uitgereikt, {skipped} overgeslagen (alleen afgeronde inschrijvingen).',
    es: '{issued} emitidos, {skipped} omitidos (solo inscripciones completadas).', // MT
    pt: '{issued} emitidos, {skipped} ignorados (apenas inscrições concluídas).', // MT
    de: '{issued} ausgestellt, {skipped} übersprungen (nur abgeschlossene Anmeldungen).', // MT
    fr: '{issued} émis, {skipped} ignorés (uniquement les inscriptions terminées).', // MT
  },
  // ── name + slug fields ────────────────────────────────────────────────
  auto_generated: {
    en: 'auto-generated',
    nl: 'automatisch gegenereerd',
    es: 'generado automáticamente', // MT
    pt: 'gerado automaticamente', // MT
    de: 'automatisch erzeugt', // MT
    fr: 'généré automatiquement', // MT
  },
  alt_slug_tooltip: {
    en: 'Suggest an alternative slug',
    nl: 'Stel een alternatieve slug voor',
    es: 'Sugerir un slug alternativo', // MT
    pt: 'Sugerir um slug alternativo', // MT
    de: 'Alternativen Slug vorschlagen', // MT
    fr: 'Suggérer un slug alternatif', // MT
  },
  // ── new thread + thread editor form ───────────────────────────────────
  new_thread_desc: {
    en: 'An event with a schedule, or a journey that unfolds over time.',
    nl: 'Een evenement met een programma, of een reis die zich in de tijd ontvouwt.',
    es: 'Un evento con programa, o un recorrido que se despliega en el tiempo.', // MT
    pt: 'Um evento com programação, ou uma jornada que se desenrola no tempo.', // MT
    de: 'Eine Veranstaltung mit Programm oder eine Journey, die sich über die Zeit entfaltet.', // MT
    fr: 'Un événement avec programme, ou un parcours qui se déploie dans le temps.', // MT
  },
  kind: {
    en: 'Kind',
    nl: 'Soort',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Art', // MT
    fr: 'Type', // MT
  },
  scope: {
    en: 'Scope',
    nl: 'Bereik',
    es: 'Ámbito', // MT
    pt: 'Escopo', // MT
    de: 'Bereich', // MT
    fr: 'Portée', // MT
  },
  team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipe', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  kind_event_desc: {
    en: 'A gathering with a schedule — sessions, workshops, conversations at set times.',
    nl: 'Een bijeenkomst met een programma — sessies, workshops, gesprekken op vaste tijden.',
    es: 'Un encuentro con programa — sesiones, talleres, conversaciones a horas fijas.', // MT
    pt: 'Um encontro com programação — sessões, oficinas, conversas em horários definidos.', // MT
    de: 'Ein Treffen mit Programm — Sessions, Workshops, Gespräche zu festen Zeiten.', // MT
    fr: 'Un rassemblement avec programme — sessions, ateliers, conversations à heures fixes.', // MT
  },
  kind_journey_desc: {
    en: "A personal arc over time — reflections, practices and messages, at each participant's own pace.",
    nl: 'Een persoonlijke boog in de tijd — reflecties, oefeningen en berichten, in ieders eigen tempo.',
    es: 'Un arco personal en el tiempo — reflexiones, prácticas y mensajes, al ritmo de cada participante.', // MT
    pt: 'Um arco pessoal no tempo — reflexões, práticas e mensagens, no ritmo de cada participante.', // MT
    de: 'Ein persönlicher Bogen über die Zeit — Reflexionen, Übungen und Nachrichten, im eigenen Tempo.', // MT
    fr: 'Un arc personnel dans le temps — réflexions, pratiques et messages, au rythme de chacun.', // MT
  },
  scope_personal_desc: {
    en: 'You organise this thread; invite hosts and facilitators later.',
    nl: 'Jij organiseert deze thread; nodig later hosts en facilitators uit.',
    es: 'Tú organizas este thread; invita a anfitriones y facilitadores más tarde.', // MT
    pt: 'Você organiza este thread; convide anfitriões e facilitadores depois.', // MT
    de: 'Du organisierst diesen Thread; lade Hosts und Facilitators später ein.', // MT
    fr: 'Tu organises ce thread ; invite hôtes et facilitateurs plus tard.', // MT
  },
  scope_team_desc: {
    en: 'Owned by one of your teams — members see and share it.',
    nl: 'In eigendom van een van je teams — leden zien en delen hem.',
    es: 'Pertenece a uno de tus equipos — los miembros lo ven y lo comparten.', // MT
    pt: 'Pertence a uma das suas equipes — os membros o veem e compartilham.', // MT
    de: 'Gehört einem deiner Teams — Mitglieder sehen und teilen ihn.', // MT
    fr: 'Appartient à l’une de tes équipes — les membres le voient et le partagent.', // MT
  },
  err_thread_name: {
    en: 'Give the thread a name.',
    nl: 'Geef de thread een naam.',
    es: 'Ponle un nombre al thread.', // MT
    pt: 'Dê um nome ao thread.', // MT
    de: 'Gib dem Thread einen Namen.', // MT
    fr: 'Donne un nom au thread.', // MT
  },
  err_pick_team: {
    en: 'Pick a team.',
    nl: 'Kies een team.',
    es: 'Elige un equipo.', // MT
    pt: 'Escolha uma equipe.', // MT
    de: 'Wähle ein Team.', // MT
    fr: 'Choisis une équipe.', // MT
  },
  slug_hint_simple: {
    en: 'Lowercase letters, digits and hyphens.',
    nl: 'Kleine letters, cijfers en koppeltekens.',
    es: 'Minúsculas, dígitos y guiones.', // MT
    pt: 'Letras minúsculas, dígitos e hifens.', // MT
    de: 'Kleinbuchstaben, Ziffern und Bindestriche.', // MT
    fr: 'Minuscules, chiffres et tirets.', // MT
  },
  intention: {
    en: 'Intention',
    nl: 'Intentie',
    es: 'Intención', // MT
    pt: 'Intenção', // MT
    de: 'Intention', // MT
    fr: 'Intention', // MT
  },
  intention_hint: {
    en: 'Why this thread exists — shown on the public page.',
    nl: 'Waarom deze thread bestaat — te zien op de openbare pagina.',
    es: 'Por qué existe este thread — se muestra en la página pública.', // MT
    pt: 'Por que este thread existe — aparece na página pública.', // MT
    de: 'Warum es diesen Thread gibt — zu sehen auf der öffentlichen Seite.', // MT
    fr: 'Pourquoi ce thread existe — affiché sur la page publique.', // MT
  },
  starts_on: {
    en: 'Starts on',
    nl: 'Begint op',
    es: 'Empieza el', // MT
    pt: 'Começa em', // MT
    de: 'Beginnt am', // MT
    fr: 'Commence le', // MT
  },
  ends_on: {
    en: 'Ends on',
    nl: 'Eindigt op',
    es: 'Termina el', // MT
    pt: 'Termina em', // MT
    de: 'Endet am', // MT
    fr: 'Se termine le', // MT
  },
  create_thread: {
    en: 'Create thread',
    nl: 'Thread aanmaken',
    es: 'Crear thread', // MT
    pt: 'Criar thread', // MT
    de: 'Thread erstellen', // MT
    fr: 'Créer le thread', // MT
  },
  basics: {
    en: 'Basics',
    nl: 'Basis',
    es: 'Básicos', // MT
    pt: 'Básico', // MT
    de: 'Grundlagen', // MT
    fr: 'Essentiel', // MT
  },
  thread_image: {
    en: 'Thread image',
    nl: 'Thread-afbeelding',
    es: 'Imagen del thread', // MT
    pt: 'Imagem do thread', // MT
    de: 'Thread-Bild', // MT
    fr: 'Image du thread', // MT
  },
  upload_image: {
    en: 'Upload image',
    nl: 'Afbeelding uploaden',
    es: 'Subir imagen', // MT
    pt: 'Enviar imagem', // MT
    de: 'Bild hochladen', // MT
    fr: 'Téléverser une image', // MT
  },
  uploading: {
    en: 'Uploading…',
    nl: 'Uploaden…',
    es: 'Subiendo…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird hochgeladen…', // MT
    fr: 'Téléversement…', // MT
  },
  replace: {
    en: 'Replace',
    nl: 'Vervangen',
    es: 'Reemplazar', // MT
    pt: 'Substituir', // MT
    de: 'Ersetzen', // MT
    fr: 'Remplacer', // MT
  },
  upload_failed: {
    en: 'Upload failed',
    nl: 'Upload mislukt',
    es: 'Error al subir', // MT
    pt: 'Falha no envio', // MT
    de: 'Upload fehlgeschlagen', // MT
    fr: 'Échec du téléversement', // MT
  },
  cover_hint: {
    en: 'Cover on the public page and in embeds.',
    nl: 'Cover op de openbare pagina en in embeds.',
    es: 'Portada en la página pública y en los embeds.', // MT
    pt: 'Capa na página pública e nos embeds.', // MT
    de: 'Cover auf der öffentlichen Seite und in Embeds.', // MT
    fr: 'Couverture sur la page publique et dans les intégrations.', // MT
  },
  err_thread_needs_name: {
    en: 'The thread needs a name.',
    nl: 'De thread heeft een naam nodig.',
    es: 'El thread necesita un nombre.', // MT
    pt: 'O thread precisa de um nome.', // MT
    de: 'Der Thread braucht einen Namen.', // MT
    fr: 'Le thread a besoin d’un nom.', // MT
  },
  err_thread_needs_slug: {
    en: 'The thread needs a URL slug.',
    nl: 'De thread heeft een URL-slug nodig.',
    es: 'El thread necesita un slug de URL.', // MT
    pt: 'O thread precisa de um slug de URL.', // MT
    de: 'Der Thread braucht einen URL-Slug.', // MT
    fr: 'Le thread a besoin d’un slug d’URL.', // MT
  },
  timezone: {
    en: 'Timezone',
    nl: 'Tijdzone',
    es: 'Zona horaria', // MT
    pt: 'Fuso horário', // MT
    de: 'Zeitzone', // MT
    fr: 'Fuseau horaire', // MT
  },
  timezone_hint: {
    en: 'IANA name, e.g. Europe/Amsterdam.',
    nl: 'IANA-naam, bijv. Europe/Amsterdam.',
    es: 'Nombre IANA, p. ej. Europe/Amsterdam.', // MT
    pt: 'Nome IANA, ex.: Europe/Amsterdam.', // MT
    de: 'IANA-Name, z. B. Europe/Amsterdam.', // MT
    fr: 'Nom IANA, p. ex. Europe/Amsterdam.', // MT
  },
  page_language: {
    en: 'Page language',
    nl: 'Paginataal',
    es: 'Idioma de la página', // MT
    pt: 'Idioma da página', // MT
    de: 'Seitensprache', // MT
    fr: 'Langue de la page', // MT
  },
  page_language_hint: {
    en: 'Buttons, system messages and emails — what the platform says around your content.',
    nl: 'Knoppen, systeemberichten en e-mails — wat het platform rond jouw inhoud zegt.',
    es: 'Botones, mensajes del sistema y correos — lo que la plataforma dice alrededor de tu contenido.', // MT
    pt: 'Botões, mensagens do sistema e e-mails — o que a plataforma diz ao redor do seu conteúdo.', // MT
    de: 'Buttons, Systemmeldungen und E-Mails — was die Plattform rund um deine Inhalte sagt.', // MT
    fr: 'Boutons, messages système et e-mails — ce que la plateforme dit autour de ton contenu.', // MT
  },
  facilitation_language: {
    en: 'Facilitation language',
    nl: 'Voertaal',
    es: 'Idioma de facilitación', // MT
    pt: 'Idioma de facilitação', // MT
    de: 'Durchführungssprache', // MT
    fr: 'Langue d’animation', // MT
  },
  facilitation_placeholder: {
    en: 'e.g. Greek — defaults to the page language',
    nl: 'bijv. Grieks — standaard de paginataal',
    es: 'p. ej. griego — por defecto, el idioma de la página', // MT
    pt: 'ex.: grego — por padrão, o idioma da página', // MT
    de: 'z. B. Griechisch — standardmäßig die Seitensprache', // MT
    fr: 'p. ex. grec — par défaut, la langue de la page', // MT
  },
  facilitation_hint: {
    en: 'What the thread is run in — shown on the public page when it differs.',
    nl: 'De taal waarin de thread wordt gegeven — te zien op de openbare pagina als die afwijkt.',
    es: 'El idioma en que se imparte el thread — se muestra en la página pública cuando difiere.', // MT
    pt: 'O idioma em que o thread é conduzido — aparece na página pública quando difere.', // MT
    de: 'Die Sprache, in der der Thread läuft — auf der öffentlichen Seite zu sehen, wenn sie abweicht.', // MT
    fr: 'La langue dans laquelle le thread est animé — affichée sur la page publique quand elle diffère.', // MT
  },
  personal_no_team: {
    en: 'Personal — no team',
    nl: 'Persoonlijk — geen team',
    es: 'Personal — sin equipo', // MT
    pt: 'Pessoal — sem equipe', // MT
    de: 'Persönlich — kein Team', // MT
    fr: 'Personnel — sans équipe', // MT
  },
  team_hint: {
    en: 'Team members share this thread.',
    nl: 'Teamleden delen deze thread.',
    es: 'Los miembros del equipo comparten este thread.', // MT
    pt: 'Os membros da equipe compartilham este thread.', // MT
    de: 'Teammitglieder teilen diesen Thread.', // MT
    fr: 'Les membres de l’équipe partagent ce thread.', // MT
  },
  when_clicked: {
    en: 'When clicked in an overview',
    nl: 'Bij klikken in een overzicht',
    es: 'Al hacer clic en un listado', // MT
    pt: 'Ao clicar em uma listagem', // MT
    de: 'Beim Klick in einer Übersicht', // MT
    fr: 'Au clic dans une liste', // MT
  },
  thread_page: {
    en: 'Thread page',
    nl: 'Threadpagina',
    es: 'Página del thread', // MT
    pt: 'Página do thread', // MT
    de: 'Thread-Seite', // MT
    fr: 'Page du thread', // MT
  },
  thread_page_desc: {
    en: 'Opens the full public page with agenda and details.',
    nl: 'Opent de volledige openbare pagina met programma en details.',
    es: 'Abre la página pública completa con agenda y detalles.', // MT
    pt: 'Abre a página pública completa com programação e detalhes.', // MT
    de: 'Öffnet die vollständige öffentliche Seite mit Programm und Details.', // MT
    fr: 'Ouvre la page publique complète avec programme et détails.', // MT
  },
  enrol_popup: {
    en: 'Enrol popup',
    nl: 'Inschrijfpopup',
    es: 'Popup de inscripción', // MT
    pt: 'Popup de inscrição', // MT
    de: 'Anmelde-Popup', // MT
    fr: 'Popup d’inscription', // MT
  },
  enrol_popup_desc: {
    en: 'Opens a popup with thread info and direct enrolment.',
    nl: 'Opent een popup met threadinfo en directe inschrijving.',
    es: 'Abre un popup con info del thread e inscripción directa.', // MT
    pt: 'Abre um popup com informações do thread e inscrição direta.', // MT
    de: 'Öffnet ein Popup mit Thread-Infos und direkter Anmeldung.', // MT
    fr: 'Ouvre un popup avec les infos du thread et l’inscription directe.', // MT
  },
  list_public: {
    en: "List on the organiser's public page",
    nl: 'Tonen op de openbare organisatorpagina',
    es: 'Mostrar en la página pública del organizador', // MT
    pt: 'Mostrar na página pública do organizador', // MT
    de: 'Auf der öffentlichen Veranstalterseite listen', // MT
    fr: 'Afficher sur la page publique de l’organisateur', // MT
  },
  list_public_hint: {
    en: 'Unlisted threads stay reachable by direct link.',
    nl: 'Niet-getoonde threads blijven via een directe link bereikbaar.',
    es: 'Los threads no listados siguen accesibles por enlace directo.', // MT
    pt: 'Threads não listados continuam acessíveis por link direto.', // MT
    de: 'Ungelistete Threads bleiben per Direktlink erreichbar.', // MT
    fr: 'Les threads non listés restent accessibles par lien direct.', // MT
  },
  public_agenda: {
    en: 'Public agenda',
    nl: 'Openbaar programma',
    es: 'Agenda pública', // MT
    pt: 'Programação pública', // MT
    de: 'Öffentliches Programm', // MT
    fr: 'Programme public', // MT
  },
  public_agenda_hint: {
    en: 'Show an agenda on the public page, made of the elements that have “Show on the public agenda” turned on.',
    nl: 'Toon een programma op de openbare pagina, opgebouwd uit de elementen waarbij “Toon op het openbare programma” aanstaat.',
    es: 'Muestra una agenda en la página pública, hecha de los elementos con “Mostrar en la agenda pública” activado.', // MT
    pt: 'Mostra uma programação na página pública, feita dos elementos com “Mostrar na programação pública” ativado.', // MT
    de: 'Zeigt ein Programm auf der öffentlichen Seite, gebildet aus den Elementen mit aktivem „Im öffentlichen Programm zeigen“.', // MT
    fr: 'Affiche un programme sur la page publique, composé des éléments dont « Afficher au programme public » est activé.', // MT
  },
  manage_categories_note: {
    en: 'Manage the list in Settings → Categories.',
    nl: 'Beheer de lijst via Instellingen → Categorieën.',
    es: 'Gestiona la lista en Configuración → Categorías.', // MT
    pt: 'Gerencie a lista em Configurações → Categorias.', // MT
    de: 'Verwalte die Liste unter Einstellungen → Kategorien.', // MT
    fr: 'Gère la liste dans Paramètres → Catégories.', // MT
  },
  // ── thread timeline ───────────────────────────────────────────────────
  status_published: {
    en: 'Published',
    nl: 'Gepubliceerd',
    es: 'Publicado', // MT
    pt: 'Publicado', // MT
    de: 'Veröffentlicht', // MT
    fr: 'Publié', // MT
  },
  trig_on_enrolment: {
    en: 'On enrolment',
    nl: 'Bij inschrijving',
    es: 'Al inscribirse', // MT
    pt: 'Na inscrição', // MT
    de: 'Bei Anmeldung', // MT
    fr: 'À l’inscription', // MT
  },
  trig_on_approval: {
    en: 'On approval',
    nl: 'Bij goedkeuring',
    es: 'Al aprobarse', // MT
    pt: 'Na aprovação', // MT
    de: 'Bei Freigabe', // MT
    fr: 'À l’approbation', // MT
  },
  trig_on_completion: {
    en: 'On completion',
    nl: 'Bij afronding',
    es: 'Al completar', // MT
    pt: 'Na conclusão', // MT
    de: 'Bei Abschluss', // MT
    fr: 'À la fin', // MT
  },
  sends_at: {
    en: 'Sends {time}',
    nl: 'Verstuurt {time}',
    es: 'Se envía {time}', // MT
    pt: 'Envia {time}', // MT
    de: 'Sendet {time}', // MT
    fr: 'Envoi {time}', // MT
  },
  unscheduled: {
    en: 'Unscheduled',
    nl: 'Niet gepland',
    es: 'Sin programar', // MT
    pt: 'Não agendado', // MT
    de: 'Nicht geplant', // MT
    fr: 'Non planifié', // MT
  },
  rel_trigger: {
    en: '{n}d {dir} {anchor} · {time}',
    nl: '{n}d {dir} {anchor} · {time}',
    es: '{n}d {dir} {anchor} · {time}', // MT
    pt: '{n}d {dir} {anchor} · {time}', // MT
    de: '{n} T. {dir} {anchor} · {time}', // MT
    fr: '{n}j {dir} {anchor} · {time}', // MT
  },
  before: {
    en: 'before',
    nl: 'vóór',
    es: 'antes de', // MT
    pt: 'antes de', // MT
    de: 'vor', // MT
    fr: 'avant', // MT
  },
  after: {
    en: 'after',
    nl: 'na',
    es: 'después de', // MT
    pt: 'depois de', // MT
    de: 'nach', // MT
    fr: 'après', // MT
  },
  anchor_event: {
    en: 'event',
    nl: 'evenement',
    es: 'evento', // MT
    pt: 'evento', // MT
    de: 'Veranstaltung', // MT
    fr: 'événement', // MT
  },
  anchor_end: {
    en: 'end',
    nl: 'einde',
    es: 'fin', // MT
    pt: 'fim', // MT
    de: 'Ende', // MT
    fr: 'fin', // MT
  },
  anchor_start: {
    en: 'start',
    nl: 'begin',
    es: 'inicio', // MT
    pt: 'início', // MT
    de: 'Beginn', // MT
    fr: 'début', // MT
  },
  wont_send_no_date: {
    en: ' — won’t send: the anchor has no date',
    nl: ' — wordt niet verstuurd: het anker heeft geen datum',
    es: ' — no se enviará: el ancla no tiene fecha', // MT
    pt: ' — não será enviado: a âncora não tem data', // MT
    de: ' — wird nicht gesendet: der Anker hat kein Datum', // MT
    fr: ' — ne partira pas : l’ancre n’a pas de date', // MT
  },
  all_threads: {
    en: 'All threads',
    nl: 'Alle threads',
    es: 'Todos los threads', // MT
    pt: 'Todos os threads', // MT
    de: 'Alle Threads', // MT
    fr: 'Tous les threads', // MT
  },
  thread_title_aria: {
    en: 'Thread title',
    nl: 'Threadtitel',
    es: 'Título del thread', // MT
    pt: 'Título do thread', // MT
    de: 'Thread-Titel', // MT
    fr: 'Titre du thread', // MT
  },
  thread_status_aria: {
    en: 'Thread status',
    nl: 'Threadstatus',
    es: 'Estado del thread', // MT
    pt: 'Status do thread', // MT
    de: 'Thread-Status', // MT
    fr: 'Statut du thread', // MT
  },
  registrations: {
    en: 'Registrations',
    nl: 'Registraties',
    es: 'Registros', // MT
    pt: 'Registros', // MT
    de: 'Registrierungen', // MT
    fr: 'Inscriptions', // MT
  },
  checkin_door: {
    en: 'Check-in (door list)',
    nl: 'Check-in (deurlijst)',
    es: 'Check-in (lista de puerta)', // MT
    pt: 'Check-in (lista de porta)', // MT
    de: 'Check-in (Türliste)', // MT
    fr: 'Check-in (liste d’entrée)', // MT
  },
  thread_settings: {
    en: 'Thread settings',
    nl: 'Threadinstellingen',
    es: 'Configuración del thread', // MT
    pt: 'Configurações do thread', // MT
    de: 'Thread-Einstellungen', // MT
    fr: 'Paramètres du thread', // MT
  },
  thread_settings_desc: {
    en: 'Basics, dates and the public registration form.',
    nl: 'Basis, datums en het openbare registratieformulier.',
    es: 'Básicos, fechas y el formulario público de registro.', // MT
    pt: 'Básico, datas e o formulário público de registro.', // MT
    de: 'Grundlagen, Termine und das öffentliche Anmeldeformular.', // MT
    fr: 'Essentiel, dates et le formulaire public d’inscription.', // MT
  },
  open_public_page: {
    en: 'Open public page',
    nl: 'Openbare pagina openen',
    es: 'Abrir la página pública', // MT
    pt: 'Abrir a página pública', // MT
    de: 'Öffentliche Seite öffnen', // MT
    fr: 'Ouvrir la page publique', // MT
  },
  timeline_empty: {
    en: 'Nothing on the timeline yet — add the first engagement below.',
    nl: 'Nog niets op de tijdlijn — voeg hieronder het eerste engagement toe.',
    es: 'Aún no hay nada en la línea de tiempo — añade el primer compromiso abajo.', // MT
    pt: 'Ainda não há nada na linha do tempo — adicione o primeiro engajamento abaixo.', // MT
    de: 'Noch nichts auf der Timeline — füge unten das erste Engagement hinzu.', // MT
    fr: 'Rien sur la timeline pour l’instant — ajoute le premier engagement ci-dessous.', // MT
  },
  auto: {
    en: 'Auto',
    nl: 'Auto',
    es: 'Auto', // MT
    pt: 'Auto', // MT
    de: 'Auto', // MT
    fr: 'Auto', // MT
  },
  auto_tooltip_trigger: {
    en: 'Sent automatically when the trigger fires per participant',
    nl: 'Wordt automatisch verstuurd zodra de trigger per deelnemer afgaat',
    es: 'Se envía automáticamente cuando el disparador se activa por participante', // MT
    pt: 'Enviado automaticamente quando o gatilho dispara por participante', // MT
    de: 'Wird automatisch gesendet, wenn der Trigger pro Teilnehmer:in auslöst', // MT
    fr: 'Envoyé automatiquement quand le déclencheur se lance pour chaque participant', // MT
  },
  auto_tooltip_completion: {
    en: 'Sent automatically when the participant completes the thread',
    nl: 'Wordt automatisch verstuurd zodra de deelnemer de thread afrondt',
    es: 'Se envía automáticamente cuando el participante completa el thread', // MT
    pt: 'Enviado automaticamente quando o participante conclui o thread', // MT
    de: 'Wird automatisch gesendet, wenn die Teilnehmer:in den Thread abschließt', // MT
    fr: 'Envoyé automatiquement quand le participant termine le thread', // MT
  },
  no_date: {
    en: 'No date',
    nl: 'Geen datum',
    es: 'Sin fecha', // MT
    pt: 'Sem data', // MT
    de: 'Kein Datum', // MT
    fr: 'Sans date', // MT
  },
  add_engagement: {
    en: 'Add engagement',
    nl: 'Engagement toevoegen',
    es: 'Añadir compromiso', // MT
    pt: 'Adicionar engajamento', // MT
    de: 'Engagement hinzufügen', // MT
    fr: 'Ajouter un engagement', // MT
  },
  activities: {
    en: 'Activities',
    nl: 'Activiteiten',
    es: 'Actividades', // MT
    pt: 'Atividades', // MT
    de: 'Aktivitäten', // MT
    fr: 'Activités', // MT
  },
  messages: {
    en: 'Messages',
    nl: 'Berichten',
    es: 'Mensajes', // MT
    pt: 'Mensagens', // MT
    de: 'Nachrichten', // MT
    fr: 'Messages', // MT
  },
  save_as_template: {
    en: 'Save as template',
    nl: 'Opslaan als sjabloon',
    es: 'Guardar como plantilla', // MT
    pt: 'Salvar como modelo', // MT
    de: 'Als Vorlage speichern', // MT
    fr: 'Enregistrer comme modèle', // MT
  },
  discard_changes: {
    en: 'Discard changes?',
    nl: 'Wijzigingen verwerpen?',
    es: '¿Descartar los cambios?', // MT
    pt: 'Descartar as alterações?', // MT
    de: 'Änderungen verwerfen?', // MT
    fr: 'Abandonner les modifications ?', // MT
  },
  discard_msg: {
    en: 'You have unsaved changes in the thread settings.',
    nl: 'Je hebt niet-opgeslagen wijzigingen in de threadinstellingen.',
    es: 'Tienes cambios sin guardar en la configuración del thread.', // MT
    pt: 'Você tem alterações não salvas nas configurações do thread.', // MT
    de: 'Du hast ungespeicherte Änderungen in den Thread-Einstellungen.', // MT
    fr: 'Tu as des modifications non enregistrées dans les paramètres du thread.', // MT
  },
  discard: {
    en: 'Discard',
    nl: 'Verwerpen',
    es: 'Descartar', // MT
    pt: 'Descartar', // MT
    de: 'Verwerfen', // MT
    fr: 'Abandonner', // MT
  },
  delete_thread: {
    en: 'Delete thread',
    nl: 'Thread verwijderen',
    es: 'Eliminar thread', // MT
    pt: 'Excluir thread', // MT
    de: 'Thread löschen', // MT
    fr: 'Supprimer le thread', // MT
  },
  delete_thread_msg_1: {
    en: 'This deletes',
    nl: 'Dit verwijdert',
    es: 'Esto elimina', // MT
    pt: 'Isto exclui', // MT
    de: 'Das löscht', // MT
    fr: 'Cela supprime', // MT
  },
  delete_thread_msg_2: {
    en: 'with all its engagements, tickets, codes and registrations. There is no undo.',
    nl: 'met alle engagements, tickets, codes en registraties. Dit kan niet ongedaan worden gemaakt.',
    es: 'con todos sus compromisos, entradas, códigos y registros. No se puede deshacer.', // MT
    pt: 'com todos os seus engajamentos, ingressos, códigos e registros. Não há como desfazer.', // MT
    de: 'mit allen Engagements, Tickets, Codes und Registrierungen. Es gibt kein Zurück.', // MT
    fr: 'avec tous ses engagements, billets, codes et inscriptions. Il n’y a pas d’annulation.', // MT
  },
  more_n: {
    en: '+{n} more',
    nl: '+{n} meer',
    es: '+{n} más', // MT
    pt: '+{n} mais', // MT
    de: '+{n} weitere', // MT
    fr: '+{n} de plus', // MT
  },
  change_time: {
    en: 'Change time',
    nl: 'Tijd wijzigen',
    es: 'Cambiar la hora', // MT
    pt: 'Alterar o horário', // MT
    de: 'Zeit ändern', // MT
    fr: 'Changer l’heure', // MT
  },
  quick_runs: {
    en: 'Change when it runs.',
    nl: 'Wijzig wanneer het plaatsvindt.',
    es: 'Cambia cuándo tiene lugar.', // MT
    pt: 'Altere quando acontece.', // MT
    de: 'Ändere, wann es stattfindet.', // MT
    fr: 'Change le moment où ça a lieu.', // MT
  },
  quick_sends: {
    en: 'Change when it sends.',
    nl: 'Wijzig wanneer het wordt verstuurd.',
    es: 'Cambia cuándo se envía.', // MT
    pt: 'Altere quando é enviado.', // MT
    de: 'Ändere, wann es gesendet wird.', // MT
    fr: 'Change le moment de l’envoi.', // MT
  },
  starts: {
    en: 'Starts',
    nl: 'Begint',
    es: 'Empieza', // MT
    pt: 'Começa', // MT
    de: 'Beginnt', // MT
    fr: 'Commence', // MT
  },
  ends: {
    en: 'Ends',
    nl: 'Eindigt',
    es: 'Termina', // MT
    pt: 'Termina', // MT
    de: 'Endet', // MT
    fr: 'Se termine', // MT
  },
  send_at: {
    en: 'Send at',
    nl: 'Versturen om',
    es: 'Enviar a las', // MT
    pt: 'Enviar às', // MT
    de: 'Senden um', // MT
    fr: 'Envoyer à', // MT
  },
  hosts_facilitators: {
    en: 'Hosts & facilitators',
    nl: 'Hosts & facilitators',
    es: 'Anfitriones y facilitadores', // MT
    pt: 'Anfitriões e facilitadores', // MT
    de: 'Hosts & Facilitators', // MT
    fr: 'Hôtes et facilitateurs', // MT
  },
  hosts_facilitators_desc: {
    en: 'Hosts can edit the thread; facilitators run sessions.',
    nl: 'Hosts kunnen de thread bewerken; facilitators begeleiden sessies.',
    es: 'Los anfitriones pueden editar el thread; los facilitadores dirigen sesiones.', // MT
    pt: 'Anfitriões podem editar o thread; facilitadores conduzem sessões.', // MT
    de: 'Hosts können den Thread bearbeiten; Facilitators leiten Sessions.', // MT
    fr: 'Les hôtes peuvent modifier le thread ; les facilitateurs animent les sessions.', // MT
  },
  organiser: {
    en: 'Organiser',
    nl: 'Organisator',
    es: 'Organizador', // MT
    pt: 'Organizador', // MT
    de: 'Veranstalter', // MT
    fr: 'Organisateur', // MT
  },
  role_host: {
    en: 'Host',
    nl: 'Host',
    es: 'Anfitrión', // MT
    pt: 'Anfitrião', // MT
    de: 'Host', // MT
    fr: 'Hôte', // MT
  },
  role_facilitator: {
    en: 'Facilitator',
    nl: 'Facilitator',
    es: 'Facilitador', // MT
    pt: 'Facilitador', // MT
    de: 'Facilitator', // MT
    fr: 'Facilitateur', // MT
  },
  invite: {
    en: 'Invite',
    nl: 'Uitnodigen',
    es: 'Invitar', // MT
    pt: 'Convidar', // MT
    de: 'Einladen', // MT
    fr: 'Inviter', // MT
  },
  choose_member: {
    en: 'Choose a workspace member…',
    nl: 'Kies een werkruimtelid…',
    es: 'Elige un miembro del espacio…', // MT
    pt: 'Escolha um membro do espaço…', // MT
    de: 'Wähle ein Workspace-Mitglied…', // MT
    fr: 'Choisis un membre de l’espace…', // MT
  },
  err_pick_member: {
    en: 'Pick a member.',
    nl: 'Kies een lid.',
    es: 'Elige un miembro.', // MT
    pt: 'Escolha um membro.', // MT
    de: 'Wähle ein Mitglied.', // MT
    fr: 'Choisis un membre.', // MT
  },
  tab_pricing: {
    en: 'Pricing',
    nl: 'Prijzen',
    es: 'Precios', // MT
    pt: 'Preços', // MT
    de: 'Preise', // MT
    fr: 'Tarifs', // MT
  },
  tab_registration: {
    en: 'Registration',
    nl: 'Registratie',
    es: 'Registro', // MT
    pt: 'Registro', // MT
    de: 'Registrierung', // MT
    fr: 'Inscription', // MT
  },
  tab_embed: {
    en: 'Embed',
    nl: 'Embed',
    es: 'Embed', // MT
    pt: 'Embed', // MT
    de: 'Embed', // MT
    fr: 'Embed', // MT
  },

  // ── engagement types ──────────────────────────────────────────────────
  et_event: {
    en: 'Event',
    nl: 'Evenement',
    es: 'Evento', // MT
    pt: 'Evento', // MT
    de: 'Veranstaltung', // MT
    fr: 'Événement', // MT
  },
  et_conversation: {
    en: 'Conversation',
    nl: 'Gesprek',
    es: 'Conversación', // MT
    pt: 'Conversa', // MT
    de: 'Gespräch', // MT
    fr: 'Conversation', // MT
  },
  et_workshop: {
    en: 'Workshop',
    nl: 'Workshop',
    es: 'Taller', // MT
    pt: 'Oficina', // MT
    de: 'Workshop', // MT
    fr: 'Atelier', // MT
  },
  et_message: {
    en: 'Message',
    nl: 'Bericht',
    es: 'Mensaje', // MT
    pt: 'Mensagem', // MT
    de: 'Nachricht', // MT
    fr: 'Message', // MT
  },
  et_reflection: {
    en: 'Reflection',
    nl: 'Reflectie',
    es: 'Reflexión', // MT
    pt: 'Reflexão', // MT
    de: 'Reflexion', // MT
    fr: 'Réflexion', // MT
  },
  et_practice: {
    en: 'Practice',
    nl: 'Oefening',
    es: 'Práctica', // MT
    pt: 'Prática', // MT
    de: 'Übung', // MT
    fr: 'Pratique', // MT
  },
  et_document: {
    en: 'Document',
    nl: 'Document',
    es: 'Documento', // MT
    pt: 'Documento', // MT
    de: 'Dokument', // MT
    fr: 'Document', // MT
  },
  et_inspiration: {
    en: 'Inspiration',
    nl: 'Inspiratie',
    es: 'Inspiración', // MT
    pt: 'Inspiração', // MT
    de: 'Inspiration', // MT
    fr: 'Inspiration', // MT
  },
  etd_event: {
    en: 'A session at a set time — plenary, gathering, ceremony.',
    nl: 'Een sessie op een vast tijdstip — plenair, bijeenkomst, ceremonie.',
    es: 'Una sesión a hora fija — plenaria, encuentro, ceremonia.', // MT
    pt: 'Uma sessão em horário fixo — plenária, encontro, cerimônia.', // MT
    de: 'Eine Session zu fester Zeit — Plenum, Treffen, Zeremonie.', // MT
    fr: 'Une session à heure fixe — plénière, rassemblement, cérémonie.', // MT
  },
  etd_conversation: {
    en: 'A guided group conversation or circle.',
    nl: 'Een begeleid groepsgesprek of cirkel.',
    es: 'Una conversación grupal guiada o un círculo.', // MT
    pt: 'Uma conversa em grupo guiada ou um círculo.', // MT
    de: 'Ein geführtes Gruppengespräch oder ein Kreis.', // MT
    fr: 'Une conversation de groupe guidée ou un cercle.', // MT
  },
  etd_workshop: {
    en: 'Hands-on working session with a facilitator.',
    nl: 'Praktische werksessie met een facilitator.',
    es: 'Sesión práctica de trabajo con un facilitador.', // MT
    pt: 'Sessão prática de trabalho com um facilitador.', // MT
    de: 'Praktische Arbeitssession mit Facilitator.', // MT
    fr: 'Session de travail pratique avec un facilitateur.', // MT
  },
  etd_message: {
    en: 'An email to all participants, sent at a scheduled moment.',
    nl: 'Een e-mail aan alle deelnemers, verstuurd op een gepland moment.',
    es: 'Un correo a todos los participantes, enviado en un momento programado.', // MT
    pt: 'Um e-mail para todos os participantes, enviado em um momento agendado.', // MT
    de: 'Eine E-Mail an alle Teilnehmenden, gesendet zu einem geplanten Zeitpunkt.', // MT
    fr: 'Un e-mail à tous les participants, envoyé à un moment planifié.', // MT
  },
  etd_reflection: {
    en: 'Questions participants answer in their own words.',
    nl: 'Vragen die deelnemers in hun eigen woorden beantwoorden.',
    es: 'Preguntas que los participantes responden con sus propias palabras.', // MT
    pt: 'Perguntas que os participantes respondem com suas próprias palavras.', // MT
    de: 'Fragen, die Teilnehmende in eigenen Worten beantworten.', // MT
    fr: 'Des questions auxquelles les participants répondent avec leurs mots.', // MT
  },
  etd_practice: {
    en: 'Assignments to complete before the next step.',
    nl: 'Opdrachten om af te ronden vóór de volgende stap.',
    es: 'Tareas para completar antes del siguiente paso.', // MT
    pt: 'Tarefas para concluir antes do próximo passo.', // MT
    de: 'Aufgaben, die vor dem nächsten Schritt zu erledigen sind.', // MT
    fr: 'Des tâches à accomplir avant l’étape suivante.', // MT
  },
  etd_document: {
    en: 'A file or link shared with participants.',
    nl: 'Een bestand of link gedeeld met deelnemers.',
    es: 'Un archivo o enlace compartido con los participantes.', // MT
    pt: 'Um arquivo ou link compartilhado com os participantes.', // MT
    de: 'Eine Datei oder ein Link, geteilt mit Teilnehmenden.', // MT
    fr: 'Un fichier ou un lien partagé avec les participants.', // MT
  },
  etd_inspiration: {
    en: 'A quote, video or idea to spark the thread.',
    nl: 'Een citaat, video of idee om de thread aan te wakkeren.',
    es: 'Una cita, un vídeo o una idea para encender el thread.', // MT
    pt: 'Uma citação, vídeo ou ideia para inspirar o thread.', // MT
    de: 'Ein Zitat, Video oder eine Idee, die den Thread entzündet.', // MT
    fr: 'Une citation, une vidéo ou une idée pour lancer le thread.', // MT
  },
  // ── engagement dialog ─────────────────────────────────────────────────
  err_give_title: {
    en: 'Give it a title.',
    nl: 'Geef het een titel.',
    es: 'Ponle un título.', // MT
    pt: 'Dê um título.', // MT
    de: 'Gib ihm einen Titel.', // MT
    fr: 'Donne-lui un titre.', // MT
  },
  add_item: {
    en: 'Add {type}',
    nl: '{type} toevoegen',
    es: 'Añadir {type}', // MT
    pt: 'Adicionar {type}', // MT
    de: '{type} hinzufügen', // MT
    fr: 'Ajouter : {type}', // MT
  },
  edit_item: {
    en: 'Edit — {title}',
    nl: 'Bewerken — {title}',
    es: 'Editar — {title}', // MT
    pt: 'Editar — {title}', // MT
    de: 'Bearbeiten — {title}', // MT
    fr: 'Modifier — {title}', // MT
  },
  add_to_timeline: {
    en: 'Add to timeline',
    nl: 'Aan tijdlijn toevoegen',
    es: 'Añadir a la línea de tiempo', // MT
    pt: 'Adicionar à linha do tempo', // MT
    de: 'Zur Timeline hinzufügen', // MT
    fr: 'Ajouter à la timeline', // MT
  },
  title: {
    en: 'Title',
    nl: 'Titel',
    es: 'Título', // MT
    pt: 'Título', // MT
    de: 'Titel', // MT
    fr: 'Titre', // MT
  },
  copy_suffix: {
    en: '(copy)',
    nl: '(kopie)',
    es: '(copia)', // MT
    pt: '(cópia)', // MT
    de: '(Kopie)', // MT
    fr: '(copie)', // MT
  },
  image: {
    en: 'Image',
    nl: 'Afbeelding',
    es: 'Imagen', // MT
    pt: 'Imagem', // MT
    de: 'Bild', // MT
    fr: 'Image', // MT
  },
  add_an_image: {
    en: 'Add an image',
    nl: 'Afbeelding toevoegen',
    es: 'Añadir una imagen', // MT
    pt: 'Adicionar uma imagem', // MT
    de: 'Bild hinzufügen', // MT
    fr: 'Ajouter une image', // MT
  },
  engagement_image_hint: {
    en: 'Shown with this event on the public agenda.',
    nl: 'Te zien bij dit evenement op het openbare programma.',
    es: 'Se muestra con este evento en la agenda pública.', // MT
    pt: 'Aparece com este evento na programação pública.', // MT
    de: 'Wird mit dieser Veranstaltung im öffentlichen Programm gezeigt.', // MT
    fr: 'Affichée avec cet événement au programme public.', // MT
  },
  where: {
    en: 'Where',
    nl: 'Waar',
    es: 'Dónde', // MT
    pt: 'Onde', // MT
    de: 'Wo', // MT
    fr: 'Où', // MT
  },
  in_person: {
    en: 'In person',
    nl: 'Fysiek',
    es: 'Presencial', // MT
    pt: 'Presencial', // MT
    de: 'Vor Ort', // MT
    fr: 'En présentiel', // MT
  },
  virtual: {
    en: 'Virtual',
    nl: 'Online',
    es: 'Virtual', // MT
    pt: 'Virtual', // MT
    de: 'Virtuell', // MT
    fr: 'En ligne', // MT
  },
  location: {
    en: 'Location',
    nl: 'Locatie',
    es: 'Ubicación', // MT
    pt: 'Local', // MT
    de: 'Ort', // MT
    fr: 'Lieu', // MT
  },
  venue_or_address: {
    en: 'Venue or address',
    nl: 'Locatie of adres',
    es: 'Recinto o dirección', // MT
    pt: 'Local ou endereço', // MT
    de: 'Veranstaltungsort oder Adresse', // MT
    fr: 'Lieu ou adresse', // MT
  },
  location_link: {
    en: 'Location link',
    nl: 'Locatielink',
    es: 'Enlace de ubicación', // MT
    pt: 'Link do local', // MT
    de: 'Orts-Link', // MT
    fr: 'Lien du lieu', // MT
  },
  maps_or_venue_url: {
    en: 'Maps or venue URL',
    nl: 'Maps- of locatie-URL',
    es: 'URL de Maps o del recinto', // MT
    pt: 'URL do Maps ou do local', // MT
    de: 'Maps- oder Veranstaltungsort-URL', // MT
    fr: 'URL Maps ou du lieu', // MT
  },
  use_maps_link: {
    en: 'Use a Google Maps link for “{location}”',
    nl: 'Gebruik een Google Maps-link voor “{location}”',
    es: 'Usar un enlace de Google Maps para «{location}»', // MT
    pt: 'Usar um link do Google Maps para “{location}”', // MT
    de: 'Google-Maps-Link für „{location}“ verwenden', // MT
    fr: 'Utiliser un lien Google Maps pour « {location} »', // MT
  },
  provider: {
    en: 'Provider',
    nl: 'Aanbieder',
    es: 'Proveedor', // MT
    pt: 'Provedor', // MT
    de: 'Anbieter', // MT
    fr: 'Fournisseur', // MT
  },
  custom_link: {
    en: 'Custom link',
    nl: 'Eigen link',
    es: 'Enlace personalizado', // MT
    pt: 'Link personalizado', // MT
    de: 'Eigener Link', // MT
    fr: 'Lien personnalisé', // MT
  },
  not_set_suffix: {
    en: ' — not set',
    nl: ' — niet ingesteld',
    es: ' — sin configurar', // MT
    pt: ' — não configurado', // MT
    de: ' — nicht eingerichtet', // MT
    fr: ' — non configuré', // MT
  },
  uses_personal_room: {
    en: 'Uses your personal room from Meet:',
    nl: 'Gebruikt je persoonlijke ruimte uit Meet:',
    es: 'Usa tu sala personal de Meet:', // MT
    pt: 'Usa a sua sala pessoal do Meet:', // MT
    de: 'Nutzt deinen persönlichen Raum aus Meet:', // MT
    fr: 'Utilise ta salle personnelle de Meet :', // MT
  },
  no_personal_room: {
    en: 'No personal room configured — set one in Settings → Connections.',
    nl: 'Geen persoonlijke ruimte ingesteld — stel er een in via Instellingen → Verbindingen.',
    es: 'No hay sala personal configurada — configúrala en Configuración → Conexiones.', // MT
    pt: 'Nenhuma sala pessoal configurada — configure uma em Configurações → Conexões.', // MT
    de: 'Kein persönlicher Raum eingerichtet — richte einen unter Einstellungen → Verbindungen ein.', // MT
    fr: 'Aucune salle personnelle configurée — configure-la dans Paramètres → Connexions.', // MT
  },
  meeting_link: {
    en: 'Meeting link',
    nl: 'Meetinglink',
    es: 'Enlace de la reunión', // MT
    pt: 'Link da reunião', // MT
    de: 'Meeting-Link', // MT
    fr: 'Lien de réunion', // MT
  },
  type: {
    en: 'Type',
    nl: 'Type',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Typ', // MT
    fr: 'Type', // MT
  },
  time_per_day: {
    en: 'Time per day',
    nl: 'Tijd per dag',
    es: 'Horario por día', // MT
    pt: 'Horário por dia', // MT
    de: 'Zeit pro Tag', // MT
    fr: 'Horaire par jour', // MT
  },
  time_per_day_hint: {
    en: 'Set a begin/end time for each day of a multi-day activity.',
    nl: 'Stel per dag een begin- en eindtijd in voor een meerdaagse activiteit.',
    es: 'Define hora de inicio y fin para cada día de una actividad de varios días.', // MT
    pt: 'Defina hora de início e fim para cada dia de uma atividade de vários dias.', // MT
    de: 'Lege Beginn und Ende für jeden Tag einer mehrtägigen Aktivität fest.', // MT
    fr: 'Définis une heure de début et de fin pour chaque jour d’une activité sur plusieurs jours.', // MT
  },
  first_day: {
    en: 'First day',
    nl: 'Eerste dag',
    es: 'Primer día', // MT
    pt: 'Primeiro dia', // MT
    de: 'Erster Tag', // MT
    fr: 'Premier jour', // MT
  },
  last_day: {
    en: 'Last day',
    nl: 'Laatste dag',
    es: 'Último día', // MT
    pt: 'Último dia', // MT
    de: 'Letzter Tag', // MT
    fr: 'Dernier jour', // MT
  },
  daily_start: {
    en: 'Daily start',
    nl: 'Dagelijkse start',
    es: 'Inicio diario', // MT
    pt: 'Início diário', // MT
    de: 'Täglicher Beginn', // MT
    fr: 'Début quotidien', // MT
  },
  daily_end: {
    en: 'Daily end',
    nl: 'Dagelijks einde',
    es: 'Fin diario', // MT
    pt: 'Fim diário', // MT
    de: 'Tägliches Ende', // MT
    fr: 'Fin quotidienne', // MT
  },
  fills_every_day: {
    en: 'Fills every day — edit a row to change one day.',
    nl: 'Vult elke dag — bewerk een rij om één dag aan te passen.',
    es: 'Rellena todos los días — edita una fila para cambiar un día.', // MT
    pt: 'Preenche todos os dias — edite uma linha para mudar um dia.', // MT
    de: 'Füllt jeden Tag — bearbeite eine Zeile, um einen Tag zu ändern.', // MT
    fr: 'Remplit chaque jour — modifie une ligne pour changer un jour.', // MT
  },
  show_on_agenda: {
    en: 'Show on the public agenda',
    nl: 'Toon op het openbare programma',
    es: 'Mostrar en la agenda pública', // MT
    pt: 'Mostrar na programação pública', // MT
    de: 'Im öffentlichen Programm zeigen', // MT
    fr: 'Afficher au programme public', // MT
  },
  discard_engagement_msg: {
    en: 'You have unsaved changes in this engagement.',
    nl: 'Je hebt niet-opgeslagen wijzigingen in dit engagement.',
    es: 'Tienes cambios sin guardar en este compromiso.', // MT
    pt: 'Você tem alterações não salvas neste engajamento.', // MT
    de: 'Du hast ungespeicherte Änderungen in diesem Engagement.', // MT
    fr: 'Tu as des modifications non enregistrées dans cet engagement.', // MT
  },
  delete_engagement: {
    en: 'Delete engagement',
    nl: 'Engagement verwijderen',
    es: 'Eliminar compromiso', // MT
    pt: 'Excluir engajamento', // MT
    de: 'Engagement löschen', // MT
    fr: 'Supprimer l’engagement', // MT
  },
  delete_engagement_msg_1: {
    en: 'Delete',
    nl: 'Verwijder',
    es: '¿Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Lösche', // MT
    fr: 'Supprimer', // MT
  },
  delete_engagement_msg_2: {
    en: "from the timeline? This can't be undone.",
    nl: 'van de tijdlijn? Dit kan niet ongedaan worden gemaakt.',
    es: 'de la línea de tiempo? No se puede deshacer.', // MT
    pt: 'da linha do tempo? Isso não pode ser desfeito.', // MT
    de: 'von der Timeline? Das kann nicht rückgängig gemacht werden.', // MT
    fr: 'de la timeline ? Impossible d’annuler.', // MT
  },
  when_to_send: {
    en: 'When to send',
    nl: 'Wanneer versturen',
    es: 'Cuándo enviar', // MT
    pt: 'Quando enviar', // MT
    de: 'Wann senden', // MT
    fr: 'Quand envoyer', // MT
  },
  trig_fixed_date: {
    en: 'On a fixed date',
    nl: 'Op een vaste datum',
    es: 'En una fecha fija', // MT
    pt: 'Em uma data fixa', // MT
    de: 'An einem festen Datum', // MT
    fr: 'À une date fixe', // MT
  },
  trig_relative: {
    en: 'Relative to a date or event',
    nl: 'Relatief aan een datum of evenement',
    es: 'Relativo a una fecha o evento', // MT
    pt: 'Relativo a uma data ou evento', // MT
    de: 'Relativ zu einem Datum oder Ereignis', // MT
    fr: 'Relatif à une date ou un événement', // MT
  },
  trig_when_enrols: {
    en: 'When someone enrols',
    nl: 'Wanneer iemand zich inschrijft',
    es: 'Cuando alguien se inscribe', // MT
    pt: 'Quando alguém se inscreve', // MT
    de: 'Wenn sich jemand anmeldet', // MT
    fr: 'Quand quelqu’un s’inscrit', // MT
  },
  trig_when_approved: {
    en: 'When their enrolment is approved',
    nl: 'Wanneer hun inschrijving wordt goedgekeurd',
    es: 'Cuando su inscripción es aprobada', // MT
    pt: 'Quando a inscrição é aprovada', // MT
    de: 'Wenn ihre Anmeldung freigegeben wird', // MT
    fr: 'Quand leur inscription est approuvée', // MT
  },
  trig_when_completes: {
    en: 'When they complete the thread',
    nl: 'Wanneer ze de thread afronden',
    es: 'Cuando completan el thread', // MT
    pt: 'Quando concluem o thread', // MT
    de: 'Wenn sie den Thread abschließen', // MT
    fr: 'Quand ils terminent le thread', // MT
  },
  leave_unscheduled: {
    en: 'Leave empty to keep it unscheduled.',
    nl: 'Laat leeg om het ongepland te houden.',
    es: 'Déjalo vacío para mantenerlo sin programar.', // MT
    pt: 'Deixe vazio para mantê-lo sem agendamento.', // MT
    de: 'Leer lassen, um es ungeplant zu lassen.', // MT
    fr: 'Laisse vide pour ne pas le planifier.', // MT
  },
  days: {
    en: 'Days',
    nl: 'Dagen',
    es: 'Días', // MT
    pt: 'Dias', // MT
    de: 'Tage', // MT
    fr: 'Jours', // MT
  },
  n_days: {
    en: '{n} day(s)',
    nl: '{n} dag(en)',
    es: '{n} día(s)', // MT
    pt: '{n} dia(s)', // MT
    de: '{n} Tag(e)', // MT
    fr: '{n} jour(s)', // MT
  },
  direction: {
    en: 'Direction',
    nl: 'Richting',
    es: 'Dirección', // MT
    pt: 'Direção', // MT
    de: 'Richtung', // MT
    fr: 'Sens', // MT
  },
  anchor: {
    en: 'Anchor',
    nl: 'Anker',
    es: 'Ancla', // MT
    pt: 'Âncora', // MT
    de: 'Anker', // MT
    fr: 'Ancre', // MT
  },
  thread_start: {
    en: 'thread start',
    nl: 'threadstart',
    es: 'inicio del thread', // MT
    pt: 'início do thread', // MT
    de: 'Thread-Beginn', // MT
    fr: 'début du thread', // MT
  },
  thread_end: {
    en: 'thread end',
    nl: 'threadeinde',
    es: 'fin del thread', // MT
    pt: 'fim do thread', // MT
    de: 'Thread-Ende', // MT
    fr: 'fin du thread', // MT
  },
  no_date_yet_suffix: {
    en: ' — has no date yet',
    nl: ' — heeft nog geen datum',
    es: ' — aún sin fecha', // MT
    pt: ' — ainda sem data', // MT
    de: ' — hat noch kein Datum', // MT
    fr: ' — n’a pas encore de date', // MT
  },
  at_time: {
    en: 'At',
    nl: 'Om',
    es: 'A las', // MT
    pt: 'Às', // MT
    de: 'Um', // MT
    fr: 'À', // MT
  },
  lifecycle_note: {
    en: 'Sent automatically to each participant the moment it happens — no date needed.',
    nl: 'Wordt automatisch naar elke deelnemer gestuurd op het moment dat het gebeurt — geen datum nodig.',
    es: 'Se envía automáticamente a cada participante en el momento en que sucede — sin fecha.', // MT
    pt: 'Enviado automaticamente a cada participante no momento em que acontece — sem necessidade de data.', // MT
    de: 'Wird jeder Teilnehmer:in automatisch im Moment des Ereignisses gesendet — kein Datum nötig.', // MT
    fr: 'Envoyé automatiquement à chaque participant au moment où ça se produit — pas de date nécessaire.', // MT
  },
  questions: {
    en: 'Questions',
    nl: 'Vragen',
    es: 'Preguntas', // MT
    pt: 'Perguntas', // MT
    de: 'Fragen', // MT
    fr: 'Questions', // MT
  },
  one_question_per_line: {
    en: 'One question per line.',
    nl: 'Eén vraag per regel.',
    es: 'Una pregunta por línea.', // MT
    pt: 'Uma pergunta por linha.', // MT
    de: 'Eine Frage pro Zeile.', // MT
    fr: 'Une question par ligne.', // MT
  },
  assignments: {
    en: 'Assignments',
    nl: 'Opdrachten',
    es: 'Tareas', // MT
    pt: 'Tarefas', // MT
    de: 'Aufgaben', // MT
    fr: 'Tâches', // MT
  },
  one_assignment_per_line: {
    en: 'One assignment per line.',
    nl: 'Eén opdracht per regel.',
    es: 'Una tarea por línea.', // MT
    pt: 'Uma tarefa por linha.', // MT
    de: 'Eine Aufgabe pro Zeile.', // MT
    fr: 'Une tâche par ligne.', // MT
  },
  link: {
    en: 'Link',
    nl: 'Link',
    es: 'Enlace', // MT
    pt: 'Link', // MT
    de: 'Link', // MT
    fr: 'Lien', // MT
  },
  link_optional: {
    en: 'Link (optional)',
    nl: 'Link (optioneel)',
    es: 'Enlace (opcional)', // MT
    pt: 'Link (opcional)', // MT
    de: 'Link (optional)', // MT
    fr: 'Lien (facultatif)', // MT
  },
  note: {
    en: 'Note',
    nl: 'Notitie',
    es: 'Nota', // MT
    pt: 'Nota', // MT
    de: 'Notiz', // MT
    fr: 'Note', // MT
  },
  text: {
    en: 'Text',
    nl: 'Tekst',
    es: 'Texto', // MT
    pt: 'Texto', // MT
    de: 'Text', // MT
    fr: 'Texte', // MT
  },
  body: {
    en: 'Body',
    nl: 'Inhoud',
    es: 'Cuerpo', // MT
    pt: 'Corpo', // MT
    de: 'Inhalt', // MT
    fr: 'Corps', // MT
  },
  body_tokens_hint: {
    en: 'Tokens: {name}, {thread}, {organiser}, {date} — replaced per participant when sent.',
    nl: 'Tokens: {name}, {thread}, {organiser}, {date} — per deelnemer vervangen bij verzending.',
    es: 'Variables: {name}, {thread}, {organiser}, {date} — se reemplazan por participante al enviar.', // MT
    pt: 'Variáveis: {name}, {thread}, {organiser}, {date} — substituídas por participante no envio.', // MT
    de: 'Platzhalter: {name}, {thread}, {organiser}, {date} — beim Senden pro Teilnehmer:in ersetzt.', // MT
    fr: 'Jetons : {name}, {thread}, {organiser}, {date} — remplacés par participant à l’envoi.', // MT
  },
  // ── image upload + rich text ──────────────────────────────────────────
  or_paste_url: {
    en: 'or paste URL',
    nl: 'of plak een URL',
    es: 'o pega una URL', // MT
    pt: 'ou cole uma URL', // MT
    de: 'oder URL einfügen', // MT
    fr: 'ou colle une URL', // MT
  },
  or_paste_a_url: {
    en: 'or paste a URL',
    nl: 'of plak een URL',
    es: 'o pega una URL', // MT
    pt: 'ou cole uma URL', // MT
    de: 'oder eine URL einfügen', // MT
    fr: 'ou colle une URL', // MT
  },
  image_url: {
    en: 'Image URL',
    nl: 'Afbeeldings-URL',
    es: 'URL de la imagen', // MT
    pt: 'URL da imagem', // MT
    de: 'Bild-URL', // MT
    fr: 'URL de l’image', // MT
  },
  image_url_placeholder: {
    en: 'https://… image URL',
    nl: 'https://… afbeeldings-URL',
    es: 'https://… URL de la imagen', // MT
    pt: 'https://… URL da imagem', // MT
    de: 'https://… Bild-URL', // MT
    fr: 'https://… URL de l’image', // MT
  },
  bold: {
    en: 'Bold',
    nl: 'Vet',
    es: 'Negrita', // MT
    pt: 'Negrito', // MT
    de: 'Fett', // MT
    fr: 'Gras', // MT
  },
  italic: {
    en: 'Italic',
    nl: 'Cursief',
    es: 'Cursiva', // MT
    pt: 'Itálico', // MT
    de: 'Kursiv', // MT
    fr: 'Italique', // MT
  },
  bullet_list: {
    en: 'Bullet list',
    nl: 'Opsommingslijst',
    es: 'Lista con viñetas', // MT
    pt: 'Lista com marcadores', // MT
    de: 'Aufzählung', // MT
    fr: 'Liste à puces', // MT
  },
  numbered_list: {
    en: 'Numbered list',
    nl: 'Genummerde lijst',
    es: 'Lista numerada', // MT
    pt: 'Lista numerada', // MT
    de: 'Nummerierte Liste', // MT
    fr: 'Liste numérotée', // MT
  },
  clear_formatting: {
    en: 'Clear formatting',
    nl: 'Opmaak wissen',
    es: 'Quitar formato', // MT
    pt: 'Limpar formatação', // MT
    de: 'Formatierung entfernen', // MT
    fr: 'Effacer la mise en forme', // MT
  },
  link_url: {
    en: 'Link URL',
    nl: 'Link-URL',
    es: 'URL del enlace', // MT
    pt: 'URL do link', // MT
    de: 'Link-URL', // MT
    fr: 'URL du lien', // MT
  },
  // ── registration panel ────────────────────────────────────────────────
  err_question_label: {
    en: 'Every question needs a label.',
    nl: 'Elke vraag heeft een label nodig.',
    es: 'Cada pregunta necesita una etiqueta.', // MT
    pt: 'Cada pergunta precisa de um rótulo.', // MT
    de: 'Jede Frage braucht eine Beschriftung.', // MT
    fr: 'Chaque question a besoin d’un intitulé.', // MT
  },
  registration_questions: {
    en: 'Registration questions',
    nl: 'Registratievragen',
    es: 'Preguntas de registro', // MT
    pt: 'Perguntas de registro', // MT
    de: 'Registrierungsfragen', // MT
    fr: 'Questions d’inscription', // MT
  },
  add_question: {
    en: 'Add question',
    nl: 'Vraag toevoegen',
    es: 'Añadir pregunta', // MT
    pt: 'Adicionar pergunta', // MT
    de: 'Frage hinzufügen', // MT
    fr: 'Ajouter une question', // MT
  },
  reg_questions_note: {
    en: 'Asked on the public enrolment form, after name and email. Answers stay in Thread — they never cross to the platform timeline.',
    nl: 'Gevraagd op het openbare inschrijfformulier, na naam en e-mail. Antwoorden blijven in Thread — ze gaan nooit naar de platformtijdlijn.',
    es: 'Se preguntan en el formulario público de inscripción, tras nombre y correo. Las respuestas se quedan en Thread — nunca pasan a la línea de tiempo de la plataforma.', // MT
    pt: 'Perguntadas no formulário público de inscrição, depois de nome e e-mail. As respostas ficam no Thread — nunca passam para a linha do tempo da plataforma.', // MT
    de: 'Gefragt im öffentlichen Anmeldeformular, nach Name und E-Mail. Antworten bleiben in Thread — sie gelangen nie in die Plattform-Timeline.', // MT
    fr: 'Posées sur le formulaire public d’inscription, après le nom et l’e-mail. Les réponses restent dans Thread — elles ne passent jamais dans la timeline de la plateforme.', // MT
  },
  reg_no_questions: {
    en: 'No extra questions — enrolment asks only name and email.',
    nl: 'Geen extra vragen — de inschrijving vraagt alleen naam en e-mail.',
    es: 'Sin preguntas extra — la inscripción solo pide nombre y correo.', // MT
    pt: 'Sem perguntas extras — a inscrição pede apenas nome e e-mail.', // MT
    de: 'Keine zusätzlichen Fragen — die Anmeldung fragt nur Name und E-Mail.', // MT
    fr: 'Pas de questions supplémentaires — l’inscription ne demande que le nom et l’e-mail.', // MT
  },
  question_label_placeholder: {
    en: 'Question label',
    nl: 'Vraaglabel',
    es: 'Etiqueta de la pregunta', // MT
    pt: 'Rótulo da pergunta', // MT
    de: 'Fragebeschriftung', // MT
    fr: 'Intitulé de la question', // MT
  },
  q_short: {
    en: 'Short answer',
    nl: 'Kort antwoord',
    es: 'Respuesta corta', // MT
    pt: 'Resposta curta', // MT
    de: 'Kurze Antwort', // MT
    fr: 'Réponse courte', // MT
  },
  q_long: {
    en: 'Long answer',
    nl: 'Lang antwoord',
    es: 'Respuesta larga', // MT
    pt: 'Resposta longa', // MT
    de: 'Lange Antwort', // MT
    fr: 'Réponse longue', // MT
  },
  q_choice: {
    en: 'Choice',
    nl: 'Keuze',
    es: 'Selección', // MT
    pt: 'Escolha', // MT
    de: 'Auswahl', // MT
    fr: 'Choix', // MT
  },
  q_checkbox: {
    en: 'Checkbox',
    nl: 'Selectievakje',
    es: 'Casilla', // MT
    pt: 'Caixa de seleção', // MT
    de: 'Kontrollkästchen', // MT
    fr: 'Case à cocher', // MT
  },
  required: {
    en: 'Required',
    nl: 'Verplicht',
    es: 'Obligatorio', // MT
    pt: 'Obrigatório', // MT
    de: 'Pflichtfeld', // MT
    fr: 'Obligatoire', // MT
  },
  remove_question: {
    en: 'Remove question',
    nl: 'Vraag verwijderen',
    es: 'Quitar la pregunta', // MT
    pt: 'Remover a pergunta', // MT
    de: 'Frage entfernen', // MT
    fr: 'Retirer la question', // MT
  },
  options_comma: {
    en: 'Options, comma-separated',
    nl: 'Opties, gescheiden door komma’s',
    es: 'Opciones, separadas por comas', // MT
    pt: 'Opções, separadas por vírgulas', // MT
    de: 'Optionen, durch Kommas getrennt', // MT
    fr: 'Options, séparées par des virgules', // MT
  },
  approval: {
    en: 'Approval',
    nl: 'Goedkeuring',
    es: 'Aprobación', // MT
    pt: 'Aprovação', // MT
    de: 'Freigabe', // MT
    fr: 'Approbation', // MT
  },
  approval_required_strong: {
    en: 'Approval required',
    nl: 'Goedkeuring vereist',
    es: 'Aprobación requerida', // MT
    pt: 'Aprovação necessária', // MT
    de: 'Freigabe erforderlich', // MT
    fr: 'Approbation requise', // MT
  },
  approval_required_rest: {
    en: '— enrolments wait as requests until you approve them (Registrations popup → Approve/Decline). Paid enrolments are charged first, then approved.',
    nl: '— inschrijvingen wachten als aanvragen tot jij ze goedkeurt (Registraties-popup → Goedkeuren/Afwijzen). Betaalde inschrijvingen worden eerst afgerekend en dan goedgekeurd.',
    es: '— las inscripciones esperan como solicitudes hasta que las apruebes (popup de Registros → Aprobar/Rechazar). Las de pago se cobran primero y luego se aprueban.', // MT
    pt: '— as inscrições ficam como pedidos até você aprová-las (popup de Registros → Aprovar/Recusar). As pagas são cobradas primeiro e depois aprovadas.', // MT
    de: '— Anmeldungen warten als Anfragen, bis du sie freigibst (Registrierungen-Popup → Freigeben/Ablehnen). Bezahlte Anmeldungen werden erst abgerechnet, dann freigegeben.', // MT
    fr: '— les inscriptions attendent comme demandes jusqu’à ton approbation (popup Inscriptions → Approuver/Refuser). Les inscriptions payées sont débitées d’abord, puis approuvées.', // MT
  },
  participant_visibility: {
    en: 'Participant visibility',
    nl: 'Zichtbaarheid deelnemers',
    es: 'Visibilidad de los participantes', // MT
    pt: 'Visibilidade dos participantes', // MT
    de: 'Sichtbarkeit der Teilnehmenden', // MT
    fr: 'Visibilité des participants', // MT
  },
  visibility_note: {
    en: 'Names show only for people who tick “show my name” when they enrol — opt-in, never default.',
    nl: 'Namen verschijnen alleen van mensen die bij inschrijving “toon mijn naam” aanvinken — opt-in, nooit standaard.',
    es: 'Solo se muestran los nombres de quienes marcan «mostrar mi nombre» al inscribirse — opt-in, nunca por defecto.', // MT
    pt: 'Os nomes só aparecem para quem marca “mostrar meu nome” ao se inscrever — opt-in, nunca padrão.', // MT
    de: 'Namen erscheinen nur von Personen, die bei der Anmeldung „Meinen Namen zeigen“ ankreuzen — Opt-in, nie Standard.', // MT
    fr: 'Les noms n’apparaissent que pour ceux qui cochent « montrer mon nom » à l’inscription — opt-in, jamais par défaut.', // MT
  },
  share_participants_pre: {
    en: 'Share participants',
    nl: 'Deel deelnemers',
    es: 'Compartir participantes', // MT
    pt: 'Compartilhar participantes', // MT
    de: 'Teilnehmende teilen', // MT
    fr: 'Partager les participants', // MT
  },
  share_publicly_strong: {
    en: 'publicly',
    nl: 'openbaar',
    es: 'públicamente', // MT
    pt: 'publicamente', // MT
    de: 'öffentlich', // MT
    fr: 'publiquement', // MT
  },
  share_publicly_rest: {
    en: '— a “Who’s coming” list on the public thread page (first name + initial).',
    nl: '— een “Wie komen er”-lijst op de openbare threadpagina (voornaam + initiaal).',
    es: '— una lista de «Quiénes vienen» en la página pública del thread (nombre + inicial).', // MT
    pt: '— uma lista “Quem vem” na página pública do thread (nome + inicial).', // MT
    de: '— eine „Wer kommt“-Liste auf der öffentlichen Thread-Seite (Vorname + Initiale).', // MT
    fr: '— une liste « Qui vient » sur la page publique du thread (prénom + initiale).', // MT
  },
  share_with_participants_strong: {
    en: 'with other participants',
    nl: 'met andere deelnemers',
    es: 'con otros participantes', // MT
    pt: 'com outros participantes', // MT
    de: 'mit anderen Teilnehmenden', // MT
    fr: 'avec les autres participants', // MT
  },
  share_with_participants_rest: {
    en: '— the cohort sees each other on their personal page.',
    nl: '— de groep ziet elkaar op hun persoonlijke pagina.',
    es: '— el grupo se ve entre sí en su página personal.', // MT
    pt: '— o grupo se vê na página pessoal.', // MT
    de: '— die Kohorte sieht einander auf ihrer persönlichen Seite.', // MT
    fr: '— la cohorte se voit sur sa page personnelle.', // MT
  },
  your_words: {
    en: 'Your words in the enrolment emails',
    nl: 'Jouw woorden in de inschrijfmails',
    es: 'Tus palabras en los correos de inscripción', // MT
    pt: 'Suas palavras nos e-mails de inscrição', // MT
    de: 'Deine Worte in den Anmelde-E-Mails', // MT
    fr: 'Tes mots dans les e-mails d’inscription', // MT
  },
  your_words_note: {
    en: 'Shown inside the two emails this thread sends by itself — the one confirming the request arrived, and the one carrying the ticket. Written once, it saves sending a welcome of its own.',
    nl: 'Verschijnt in de twee e-mails die deze thread zelf verstuurt — de bevestiging dat de aanvraag is aangekomen en de mail met het ticket. Eén keer schrijven en een aparte welkomstmail is niet meer nodig.',
    es: 'Aparece dentro de los dos correos que este thread envía por sí solo — el que confirma la solicitud y el que lleva la entrada. Escrito una vez, evita enviar una bienvenida aparte.', // MT
    pt: 'Aparece nos dois e-mails que este thread envia sozinho — o que confirma o pedido e o que leva o ingresso. Escrito uma vez, dispensa enviar boas-vindas à parte.', // MT
    de: 'Erscheint in den zwei E-Mails, die dieser Thread selbst sendet — der Eingangsbestätigung und der mit dem Ticket. Einmal geschrieben, erspart es eine eigene Willkommensmail.', // MT
    fr: 'Affiché dans les deux e-mails que ce thread envoie tout seul — celui qui confirme la demande et celui qui porte le billet. Écrit une fois, il évite d’envoyer un message de bienvenue à part.', // MT
  },
  write_for_thread: {
    en: 'Write something just for this thread',
    nl: 'Schrijf iets speciaal voor deze thread',
    es: 'Escribe algo solo para este thread', // MT
    pt: 'Escreva algo só para este thread', // MT
    de: 'Schreib etwas nur für diesen Thread', // MT
    fr: 'Écris quelque chose juste pour ce thread', // MT
  },
  welcome_placeholder: {
    en: 'Welcome — here is what to expect…',
    nl: 'Welkom — dit kun je verwachten…',
    es: 'Bienvenido — esto es lo que te espera…', // MT
    pt: 'Bem-vindo — veja o que esperar…', // MT
    de: 'Willkommen — das erwartet dich…', // MT
    fr: 'Bienvenue — voici ce qui t’attend…', // MT
  },
  no_workspace_note: {
    en: 'The workspace has no note yet — Settings → Emails & defaults sets one for every thread.',
    nl: 'De werkruimte heeft nog geen notitie — Instellingen → E-mails & standaarden stelt er één in voor elke thread.',
    es: 'El espacio aún no tiene nota — Configuración → Correos y valores por defecto define una para todos los threads.', // MT
    pt: 'O espaço ainda não tem nota — Configurações → E-mails e padrões define uma para todos os threads.', // MT
    de: 'Der Workspace hat noch keine Notiz — Einstellungen → E-Mails & Standards setzt eine für jeden Thread.', // MT
    fr: 'L’espace n’a pas encore de note — Paramètres → E-mails et valeurs par défaut en définit une pour chaque thread.', // MT
  },

  // ── registrations dialog ──────────────────────────────────────────────
  registrations_desc: {
    en: 'Everyone enrolled for this thread.',
    nl: 'Iedereen die voor deze thread is ingeschreven.',
    es: 'Todos los inscritos en este thread.', // MT
    pt: 'Todos os inscritos neste thread.', // MT
    de: 'Alle, die für diesen Thread angemeldet sind.', // MT
    fr: 'Tous les inscrits à ce thread.', // MT
  },
  add_participant: {
    en: 'Add participant',
    nl: 'Deelnemer toevoegen',
    es: 'Añadir participante', // MT
    pt: 'Adicionar participante', // MT
    de: 'Teilnehmer:in hinzufügen', // MT
    fr: 'Ajouter un participant', // MT
  },
  open_full_page: {
    en: 'Open full page →',
    nl: 'Volledige pagina openen →',
    es: 'Abrir la página completa →', // MT
    pt: 'Abrir a página completa →', // MT
    de: 'Ganze Seite öffnen →', // MT
    fr: 'Ouvrir la page complète →', // MT
  },
  action_failed: {
    en: 'that action failed — try again',
    nl: 'die actie is mislukt — probeer het opnieuw',
    es: 'esa acción falló — inténtalo de nuevo', // MT
    pt: 'essa ação falhou — tente novamente', // MT
    de: 'diese Aktion ist fehlgeschlagen — versuche es erneut', // MT
    fr: 'cette action a échoué — réessaie', // MT
  },
  no_registrations: {
    en: 'No registrations yet — publish the thread and share its public page.',
    nl: 'Nog geen registraties — publiceer de thread en deel de openbare pagina.',
    es: 'Aún no hay registros — publica el thread y comparte su página pública.', // MT
    pt: 'Ainda não há registros — publique o thread e compartilhe a página pública.', // MT
    de: 'Noch keine Registrierungen — veröffentliche den Thread und teile die öffentliche Seite.', // MT
    fr: 'Pas encore d’inscriptions — publie le thread et partage sa page publique.', // MT
  },
  approve: {
    en: 'Approve',
    nl: 'Goedkeuren',
    es: 'Aprobar', // MT
    pt: 'Aprovar', // MT
    de: 'Freigeben', // MT
    fr: 'Approuver', // MT
  },
  decline: {
    en: 'Decline',
    nl: 'Afwijzen',
    es: 'Rechazar', // MT
    pt: 'Recusar', // MT
    de: 'Ablehnen', // MT
    fr: 'Refuser', // MT
  },
  mark_paid: {
    en: 'Mark paid',
    nl: 'Markeer als betaald',
    es: 'Marcar como pagado', // MT
    pt: 'Marcar como pago', // MT
    de: 'Als bezahlt markieren', // MT
    fr: 'Marquer payé', // MT
  },
  complete: {
    en: 'Complete',
    nl: 'Afronden',
    es: 'Completar', // MT
    pt: 'Concluir', // MT
    de: 'Abschließen', // MT
    fr: 'Terminer', // MT
  },

  // ── certificate panel ─────────────────────────────────────────────────
  award_certificate: {
    en: 'Award a certificate on completion',
    nl: 'Reik een certificaat uit na afronding',
    es: 'Otorgar un certificado al finalizar', // MT
    pt: 'Conceder um certificado na conclusão', // MT
    de: 'Zertifikat nach Abschluss vergeben', // MT
    fr: 'Décerner un certificat à la fin', // MT
  },
  template: {
    en: 'Template',
    nl: 'Sjabloon',
    es: 'Plantilla', // MT
    pt: 'Modelo', // MT
    de: 'Vorlage', // MT
    fr: 'Modèle', // MT
  },
  choose_template: {
    en: 'Choose a template…',
    nl: 'Kies een sjabloon…',
    es: 'Elige una plantilla…', // MT
    pt: 'Escolha um modelo…', // MT
    de: 'Wähle eine Vorlage…', // MT
    fr: 'Choisis un modèle…', // MT
  },
  no_templates_yet: {
    en: 'No templates yet',
    nl: 'Nog geen sjablonen',
    es: 'Aún no hay plantillas', // MT
    pt: 'Ainda não há modelos', // MT
    de: 'Noch keine Vorlagen', // MT
    fr: 'Pas encore de modèles', // MT
  },
  designed_under: {
    en: 'Designed under',
    nl: 'Ontworpen onder',
    es: 'Diseñadas en', // MT
    pt: 'Criados em', // MT
    de: 'Gestaltet unter', // MT
    fr: 'Conçus sous', // MT
  },
  criteria_label: {
    en: 'Criteria / awarded for',
    nl: 'Criteria / uitgereikt voor',
    es: 'Criterios / otorgado por', // MT
    pt: 'Critérios / concedido por', // MT
    de: 'Kriterien / vergeben für', // MT
    fr: 'Critères / décerné pour', // MT
  },
  criteria_placeholder: {
    en: 'Completed all sessions',
    nl: 'Alle sessies afgerond',
    es: 'Completó todas las sesiones', // MT
    pt: 'Concluiu todas as sessões', // MT
    de: 'Alle Sessions abgeschlossen', // MT
    fr: 'A terminé toutes les sessions', // MT
  },

  // ── thread embed panel ────────────────────────────────────────────────
  what: {
    en: 'What',
    nl: 'Wat',
    es: 'Qué', // MT
    pt: 'O quê', // MT
    de: 'Was', // MT
    fr: 'Quoi', // MT
  },
  embed_card_option: {
    en: 'Card — image, title, date, price',
    nl: 'Kaart — afbeelding, titel, datum, prijs',
    es: 'Tarjeta — imagen, título, fecha, precio', // MT
    pt: 'Cartão — imagem, título, data, preço', // MT
    de: 'Karte — Bild, Titel, Datum, Preis', // MT
    fr: 'Carte — image, titre, date, prix', // MT
  },
  embed_card_form_option: {
    en: 'Card with the registration form in it',
    nl: 'Kaart met het registratieformulier erin',
    es: 'Tarjeta con el formulario de registro dentro', // MT
    pt: 'Cartão com o formulário de registro dentro', // MT
    de: 'Karte mit dem Anmeldeformular darin', // MT
    fr: 'Carte avec le formulaire d’inscription intégré', // MT
  },
  embed_enrol_option: {
    en: 'Registration button only',
    nl: 'Alleen een registratieknop',
    es: 'Solo el botón de registro', // MT
    pt: 'Apenas o botão de registro', // MT
    de: 'Nur ein Anmelde-Button', // MT
    fr: 'Uniquement le bouton d’inscription', // MT
  },
  website: {
    en: 'Website',
    nl: 'Website',
    es: 'Sitio web', // MT
    pt: 'Site', // MT
    de: 'Website', // MT
    fr: 'Site web', // MT
  },
  any_website: {
    en: 'Any website',
    nl: 'Elke website',
    es: 'Cualquier web', // MT
    pt: 'Qualquer site', // MT
    de: 'Jede Website', // MT
    fr: 'N’importe quel site', // MT
  },
  language: {
    en: 'Language',
    nl: 'Taal',
    es: 'Idioma', // MT
    pt: 'Idioma', // MT
    de: 'Sprache', // MT
    fr: 'Langue', // MT
  },
  auto_thread_lang: {
    en: "Automatic — the thread's own",
    nl: 'Automatisch — die van de thread zelf',
    es: 'Automático — el del propio thread', // MT
    pt: 'Automático — o do próprio thread', // MT
    de: 'Automatisch — die des Threads', // MT
    fr: 'Automatique — celle du thread', // MT
  },
  button_text: {
    en: 'Button text',
    nl: 'Knoptekst',
    es: 'Texto del botón', // MT
    pt: 'Texto do botão', // MT
    de: 'Button-Text', // MT
    fr: 'Texte du bouton', // MT
  },
  head_label_webflow: {
    en: '1 · Webflow: Site settings → Custom code → Head code (once per site)',
    nl: '1 · Webflow: Site settings → Custom code → Head code (één keer per site)',
    es: '1 · Webflow: Site settings → Custom code → Head code (una vez por sitio)', // MT
    pt: '1 · Webflow: Site settings → Custom code → Head code (uma vez por site)', // MT
    de: '1 · Webflow: Site settings → Custom code → Head code (einmal pro Site)', // MT
    fr: '1 · Webflow : Site settings → Custom code → Head code (une fois par site)', // MT
  },
  head_label_any: {
    en: '1 · Once per site, in the <head> (or before </body>)',
    nl: '1 · Eén keer per site, in de <head> (of vóór </body>)',
    es: '1 · Una vez por sitio, en el <head> (o antes de </body>)', // MT
    pt: '1 · Uma vez por site, no <head> (ou antes de </body>)', // MT
    de: '1 · Einmal pro Site, im <head> (oder vor </body>)', // MT
    fr: '1 · Une fois par site, dans le <head> (ou avant </body>)', // MT
  },
  body_label_webflow: {
    en: '2 · Add an Embed element where it should appear, paste this',
    nl: '2 · Voeg een Embed-element toe waar het moet komen en plak dit',
    es: '2 · Añade un elemento Embed donde deba aparecer y pega esto', // MT
    pt: '2 · Adicione um elemento Embed onde deve aparecer e cole isto', // MT
    de: '2 · Füge ein Embed-Element ein, wo es erscheinen soll, und füge dies ein', // MT
    fr: '2 · Ajoute un élément Embed là où il doit apparaître et colle ceci', // MT
  },
  body_label_any: {
    en: '2 · Where the embed should appear',
    nl: '2 · Waar de embed moet verschijnen',
    es: '2 · Donde debe aparecer el embed', // MT
    pt: '2 · Onde o embed deve aparecer', // MT
    de: '2 · Wo das Embed erscheinen soll', // MT
    fr: '2 · Là où l’intégration doit apparaître', // MT
  },
  all_in_one: {
    en: 'Or all-in-one, if you can only paste a single block',
    nl: 'Of alles-in-één, als je maar één blok kunt plakken',
    es: 'O todo en uno, si solo puedes pegar un bloque', // MT
    pt: 'Ou tudo em um, se você só pode colar um bloco', // MT
    de: 'Oder alles in einem, wenn du nur einen Block einfügen kannst', // MT
    fr: 'Ou tout-en-un, si tu ne peux coller qu’un seul bloc', // MT
  },
  embed_more_note: {
    en: 'Whole agendas, team or workspace listings and custom CSS live in Settings → Website embeds.',
    nl: 'Volledige programma’s, team- of werkruimteoverzichten en eigen CSS vind je in Instellingen → Website-embeds.',
    es: 'Agendas completas, listados de equipo o espacio y CSS propio viven en Configuración → Embeds.', // MT
    pt: 'Programações completas, listagens de equipe ou espaço e CSS próprio ficam em Configurações → Embeds.', // MT
    de: 'Ganze Programme, Team- oder Workspace-Listen und eigenes CSS liegen unter Einstellungen → Website-Embeds.', // MT
    fr: 'Les programmes entiers, les listes d’équipe ou d’espace et le CSS personnalisé vivent dans Paramètres → Intégrations web.', // MT
  },
  copied_word: {
    en: 'Copied',
    nl: 'Gekopieerd',
    es: 'Copiado', // MT
    pt: 'Copiado', // MT
    de: 'Kopiert', // MT
    fr: 'Copié', // MT
  },

  // ── add participant ───────────────────────────────────────────────────
  add_participant_paid_desc: {
    en: 'This thread is paid — manual adds are invoiced by email, or comped.',
    nl: 'Deze thread is betaald — handmatige toevoegingen krijgen een factuur per e-mail, of zijn gratis (comped).',
    es: 'Este thread es de pago — las altas manuales se facturan por correo, o son invitación.', // MT
    pt: 'Este thread é pago — adições manuais são faturadas por e-mail, ou cortesia.', // MT
    de: 'Dieser Thread ist kostenpflichtig — manuelle Zugänge werden per E-Mail in Rechnung gestellt oder freigestellt.', // MT
    fr: 'Ce thread est payant — les ajouts manuels sont facturés par e-mail, ou offerts.', // MT
  },
  add_participant_free_desc: {
    en: 'Adds the person directly as enrolled.',
    nl: 'Voegt de persoon direct toe als ingeschreven.',
    es: 'Añade a la persona directamente como inscrita.', // MT
    pt: 'Adiciona a pessoa diretamente como inscrita.', // MT
    de: 'Fügt die Person direkt als angemeldet hinzu.', // MT
    fr: 'Ajoute la personne directement comme inscrite.', // MT
  },
  adding: {
    en: 'Adding…',
    nl: 'Toevoegen…',
    es: 'Añadiendo…', // MT
    pt: 'Adicionando…', // MT
    de: 'Wird hinzugefügt…', // MT
    fr: 'Ajout…', // MT
  },
  ticket_hint: {
    en: 'Sets the invoice amount.',
    nl: 'Bepaalt het factuurbedrag.',
    es: 'Define el importe de la factura.', // MT
    pt: 'Define o valor da fatura.', // MT
    de: 'Bestimmt den Rechnungsbetrag.', // MT
    fr: 'Définit le montant de la facture.', // MT
  },
  invoice_amount_label: {
    en: 'Invoice · {amount}',
    nl: 'Factuur · {amount}',
    es: 'Factura · {amount}', // MT
    pt: 'Fatura · {amount}', // MT
    de: 'Rechnung · {amount}', // MT
    fr: 'Facture · {amount}', // MT
  },
  invoice_manual_desc: {
    en: "Emails a pending invoice now — pay by transfer or the pay-online link. The confirmation email follows once it's paid.",
    nl: 'Mailt nu een openstaande factuur — betalen per overschrijving of via de online-betaallink. De bevestigingsmail volgt zodra er is betaald.',
    es: 'Envía ahora una factura pendiente — se paga por transferencia o con el enlace de pago. El correo de confirmación llega al pagarse.', // MT
    pt: 'Envia agora uma fatura pendente — pague por transferência ou pelo link de pagamento. O e-mail de confirmação vem após o pagamento.', // MT
    de: 'Sendet jetzt eine offene Rechnung — zahlbar per Überweisung oder Online-Link. Die Bestätigungsmail folgt nach Zahlung.', // MT
    fr: 'Envoie maintenant une facture en attente — payable par virement ou via le lien de paiement. L’e-mail de confirmation suit une fois payée.', // MT
  },
  comped_label: {
    en: 'Comped / free',
    nl: 'Gratis / comped',
    es: 'Invitación / gratis', // MT
    pt: 'Cortesia / grátis', // MT
    de: 'Freigestellt / gratis', // MT
    fr: 'Offert / gratuit', // MT
  },
  comped_desc: {
    en: 'No invoice — the person is enrolled right away.',
    nl: 'Geen factuur — de persoon is direct ingeschreven.',
    es: 'Sin factura — la persona queda inscrita al momento.', // MT
    pt: 'Sem fatura — a pessoa é inscrita imediatamente.', // MT
    de: 'Keine Rechnung — die Person ist sofort angemeldet.', // MT
    fr: 'Pas de facture — la personne est inscrite tout de suite.', // MT
  },
  send_confirmation: {
    en: 'Send the confirmation email and welcome messages',
    nl: 'Verstuur de bevestigingsmail en welkomstberichten',
    es: 'Enviar el correo de confirmación y los mensajes de bienvenida', // MT
    pt: 'Enviar o e-mail de confirmação e as mensagens de boas-vindas', // MT
    de: 'Bestätigungsmail und Willkommensnachrichten senden', // MT
    fr: 'Envoyer l’e-mail de confirmation et les messages de bienvenue', // MT
  },
  already_enrolled_no_changes: {
    en: 'Already enrolled — no changes made.',
    nl: 'Al ingeschreven — er is niets gewijzigd.',
    es: 'Ya inscrito — no se hicieron cambios.', // MT
    pt: 'Já inscrito — nenhuma alteração feita.', // MT
    de: 'Bereits angemeldet — nichts geändert.', // MT
    fr: 'Déjà inscrit — aucun changement.', // MT
  },
  added_invoice_pending: {
    en: 'Added with a pending invoice — mark it paid once the money arrives.',
    nl: 'Toegevoegd met een openstaande factuur — markeer als betaald zodra het geld binnen is.',
    es: 'Añadido con factura pendiente — márcala como pagada cuando llegue el dinero.', // MT
    pt: 'Adicionado com fatura pendente — marque como paga quando o dinheiro chegar.', // MT
    de: 'Mit offener Rechnung hinzugefügt — als bezahlt markieren, sobald das Geld da ist.', // MT
    fr: 'Ajouté avec une facture en attente — marque-la payée quand l’argent arrive.', // MT
  },
  reactivated_msg: {
    en: 'Re-activated an earlier registration — the person is enrolled again.',
    nl: 'Een eerdere registratie is opnieuw geactiveerd — de persoon is weer ingeschreven.',
    es: 'Se reactivó un registro anterior — la persona vuelve a estar inscrita.', // MT
    pt: 'Um registro anterior foi reativado — a pessoa está inscrita novamente.', // MT
    de: 'Eine frühere Registrierung wurde reaktiviert — die Person ist wieder angemeldet.', // MT
    fr: 'Une inscription antérieure a été réactivée — la personne est de nouveau inscrite.', // MT
  },
  // ── pricing panel ─────────────────────────────────────────────────────
  paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'De pago', // MT
    pt: 'Pago', // MT
    de: 'Kostenpflichtig', // MT
    fr: 'Payant', // MT
  },
  free_mode_desc: {
    en: 'Anyone can enrol without paying.',
    nl: 'Iedereen kan zich inschrijven zonder te betalen.',
    es: 'Cualquiera puede inscribirse sin pagar.', // MT
    pt: 'Qualquer pessoa pode se inscrever sem pagar.', // MT
    de: 'Jede:r kann sich ohne Bezahlung anmelden.', // MT
    fr: 'Tout le monde peut s’inscrire sans payer.', // MT
  },
  paid_mode_desc: {
    en: 'Tickets and discount codes; Stripe or invoice at checkout.',
    nl: 'Tickets en kortingscodes; Stripe of factuur bij het afrekenen.',
    es: 'Entradas y códigos de descuento; Stripe o factura al pagar.', // MT
    pt: 'Ingressos e códigos de desconto; Stripe ou fatura no checkout.', // MT
    de: 'Tickets und Rabattcodes; Stripe oder Rechnung beim Checkout.', // MT
    fr: 'Billets et codes de réduction ; Stripe ou facture au paiement.', // MT
  },
  tickets: {
    en: 'Tickets',
    nl: 'Tickets',
    es: 'Entradas', // MT
    pt: 'Ingressos', // MT
    de: 'Tickets', // MT
    fr: 'Billets', // MT
  },
  add_ticket: {
    en: 'Add ticket',
    nl: 'Ticket toevoegen',
    es: 'Añadir entrada', // MT
    pt: 'Adicionar ingresso', // MT
    de: 'Ticket hinzufügen', // MT
    fr: 'Ajouter un billet', // MT
  },
  no_tickets: {
    en: 'No tickets yet — free enrolment. Add one to charge.',
    nl: 'Nog geen tickets — gratis inschrijving. Voeg er een toe om geld te vragen.',
    es: 'Aún no hay entradas — inscripción gratis. Añade una para cobrar.', // MT
    pt: 'Ainda não há ingressos — inscrição grátis. Adicione um para cobrar.', // MT
    de: 'Noch keine Tickets — kostenlose Anmeldung. Füge eines hinzu, um Geld zu verlangen.', // MT
    fr: 'Pas encore de billets — inscription gratuite. Ajoutes-en un pour facturer.', // MT
  },
  n_max: {
    en: '{n} max',
    nl: 'max. {n}',
    es: '{n} máx.', // MT
    pt: '{n} máx.', // MT
    de: 'max. {n}', // MT
    fr: '{n} max', // MT
  },
  until_date: {
    en: 'until {date}',
    nl: 'tot {date}',
    es: 'hasta {date}', // MT
    pt: 'até {date}', // MT
    de: 'bis {date}', // MT
    fr: 'jusqu’au {date}', // MT
  },
  inactive: {
    en: 'Inactive',
    nl: 'Inactief',
    es: 'Inactivo', // MT
    pt: 'Inativo', // MT
    de: 'Inaktiv', // MT
    fr: 'Inactif', // MT
  },
  discount_codes: {
    en: 'Discount codes',
    nl: 'Kortingscodes',
    es: 'Códigos de descuento', // MT
    pt: 'Códigos de desconto', // MT
    de: 'Rabattcodes', // MT
    fr: 'Codes de réduction', // MT
  },
  add_code: {
    en: 'Add code',
    nl: 'Code toevoegen',
    es: 'Añadir código', // MT
    pt: 'Adicionar código', // MT
    de: 'Code hinzufügen', // MT
    fr: 'Ajouter un code', // MT
  },
  no_codes: {
    en: 'No codes yet. Add one for early birds, scholarships or partners.',
    nl: 'Nog geen codes. Voeg er een toe voor vroegboekers, beurzen of partners.',
    es: 'Aún no hay códigos. Añade uno para madrugadores, becas o socios.', // MT
    pt: 'Ainda não há códigos. Adicione um para inscrições antecipadas, bolsas ou parceiros.', // MT
    de: 'Noch keine Codes. Füge einen für Frühbucher, Stipendien oder Partner hinzu.', // MT
    fr: 'Pas encore de codes. Ajoutes-en un pour les inscriptions anticipées, les bourses ou les partenaires.', // MT
  },
  copy_this_code: {
    en: 'Copy this code',
    nl: 'Kopieer deze code',
    es: 'Copiar este código', // MT
    pt: 'Copiar este código', // MT
    de: 'Diesen Code kopieren', // MT
    fr: 'Copier ce code', // MT
  },
  ticket_only: {
    en: '{name} only',
    nl: 'alleen {name}',
    es: 'solo {name}', // MT
    pt: 'só {name}', // MT
    de: 'nur {name}', // MT
    fr: '{name} uniquement', // MT
  },
  early_bird: {
    en: 'Early bird',
    nl: 'Vroegboeker',
    es: 'Madrugador', // MT
    pt: 'Antecipado', // MT
    de: 'Frühbucher', // MT
    fr: 'Lève-tôt', // MT
  },
  expired: {
    en: 'Expired',
    nl: 'Verlopen',
    es: 'Caducado', // MT
    pt: 'Expirado', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expiré', // MT
  },
  amount_off: {
    en: '{amount} off',
    nl: '{amount} korting',
    es: '{amount} de descuento', // MT
    pt: '{amount} de desconto', // MT
    de: '{amount} Rabatt', // MT
    fr: '{amount} de réduction', // MT
  },
  payout: {
    en: 'Payout',
    nl: 'Uitbetaling',
    es: 'Cobro', // MT
    pt: 'Repasse', // MT
    de: 'Auszahlung', // MT
    fr: 'Versement', // MT
  },
  my_personal_account: {
    en: 'My personal account',
    nl: 'Mijn persoonlijke account',
    es: 'Mi cuenta personal', // MT
    pt: 'Minha conta pessoal', // MT
    de: 'Mein persönliches Konto', // MT
    fr: 'Mon compte personnel', // MT
  },
  stripe_connected: {
    en: 'Stripe connected',
    nl: 'Stripe gekoppeld',
    es: 'Stripe conectado', // MT
    pt: 'Stripe conectado', // MT
    de: 'Stripe verbunden', // MT
    fr: 'Stripe connecté', // MT
  },
  not_connected_payments: {
    en: 'Not connected — Settings → Payments',
    nl: 'Niet gekoppeld — Instellingen → Betalingen',
    es: 'No conectado — Configuración → Pagos', // MT
    pt: 'Não conectado — Configurações → Pagamentos', // MT
    de: 'Nicht verbunden — Einstellungen → Zahlungen', // MT
    fr: 'Non connecté — Paramètres → Paiements', // MT
  },
  no_stripe_tooltip: {
    en: 'No Stripe account connected yet',
    nl: 'Nog geen Stripe-account gekoppeld',
    es: 'Aún no hay cuenta de Stripe conectada', // MT
    pt: 'Nenhuma conta Stripe conectada ainda', // MT
    de: 'Noch kein Stripe-Konto verbunden', // MT
    fr: 'Aucun compte Stripe connecté pour l’instant', // MT
  },
  connect_stripe_first: {
    en: 'Connect a Stripe account in Settings → Payments first.',
    nl: 'Koppel eerst een Stripe-account via Instellingen → Betalingen.',
    es: 'Conecta primero una cuenta de Stripe en Configuración → Pagos.', // MT
    pt: 'Conecte primeiro uma conta Stripe em Configurações → Pagamentos.', // MT
    de: 'Verbinde zuerst ein Stripe-Konto unter Einstellungen → Zahlungen.', // MT
    fr: 'Connecte d’abord un compte Stripe dans Paramètres → Paiements.', // MT
  },
  payment_options: {
    en: 'Payment options',
    nl: 'Betaalopties',
    es: 'Opciones de pago', // MT
    pt: 'Opções de pagamento', // MT
    de: 'Zahlungsoptionen', // MT
    fr: 'Options de paiement', // MT
  },
  inherit_account: {
    en: 'Inherit from my account settings',
    nl: 'Overnemen van mijn accountinstellingen',
    es: 'Heredar de la configuración de mi cuenta', // MT
    pt: 'Herdar das configurações da minha conta', // MT
    de: 'Von meinen Kontoeinstellungen erben', // MT
    fr: 'Hériter des réglages de mon compte', // MT
  },
  custom_thread: {
    en: 'Custom for this thread',
    nl: 'Aangepast voor deze thread',
    es: 'Personalizado para este thread', // MT
    pt: 'Personalizado para este thread', // MT
    de: 'Individuell für diesen Thread', // MT
    fr: 'Personnalisé pour ce thread', // MT
  },
  pay_online: {
    en: 'Pay online',
    nl: 'Online betalen',
    es: 'Pago en línea', // MT
    pt: 'Pagar online', // MT
    de: 'Online bezahlen', // MT
    fr: 'Payer en ligne', // MT
  },
  tickets_override: {
    en: 'Tickets can override these again in their own popup.',
    nl: 'Tickets kunnen dit weer overschrijven in hun eigen popup.',
    es: 'Las entradas pueden sobrescribirlas de nuevo en su propio popup.', // MT
    pt: 'Os ingressos podem sobrescrever isso de novo no próprio popup.', // MT
    de: 'Tickets können dies in ihrem eigenen Popup wieder überschreiben.', // MT
    fr: 'Les billets peuvent de nouveau les remplacer dans leur propre popup.', // MT
  },
  // ── ticket + coupon dialogs ───────────────────────────────────────────
  err_ticket_name: {
    en: 'Give the ticket a name.',
    nl: 'Geef het ticket een naam.',
    es: 'Ponle un nombre a la entrada.', // MT
    pt: 'Dê um nome ao ingresso.', // MT
    de: 'Gib dem Ticket einen Namen.', // MT
    fr: 'Donne un nom au billet.', // MT
  },
  err_price: {
    en: 'Price must be 0 or more.',
    nl: 'De prijs moet 0 of hoger zijn.',
    es: 'El precio debe ser 0 o más.', // MT
    pt: 'O preço deve ser 0 ou mais.', // MT
    de: 'Der Preis muss 0 oder mehr sein.', // MT
    fr: 'Le prix doit être de 0 ou plus.', // MT
  },
  err_keep_one_or_inherit: {
    en: 'Keep at least one payment option on, or switch back to inherit.',
    nl: 'Houd minstens één betaaloptie aan, of schakel terug naar overerven.',
    es: 'Mantén al menos una opción de pago activa, o vuelve a heredar.', // MT
    pt: 'Mantenha pelo menos uma opção de pagamento ativa, ou volte a herdar.', // MT
    de: 'Lass mindestens eine Zahlungsoption aktiv oder wechsle zurück zu „erben“.', // MT
    fr: 'Garde au moins une option de paiement activée, ou repasse en héritage.', // MT
  },
  price: {
    en: 'Price',
    nl: 'Prijs',
    es: 'Precio', // MT
    pt: 'Preço', // MT
    de: 'Preis', // MT
    fr: 'Prix', // MT
  },
  price_hint: {
    en: '0 = free ticket.',
    nl: '0 = gratis ticket.',
    es: '0 = entrada gratis.', // MT
    pt: '0 = ingresso grátis.', // MT
    de: '0 = kostenloses Ticket.', // MT
    fr: '0 = billet gratuit.', // MT
  },
  currency: {
    en: 'Currency',
    nl: 'Valuta',
    es: 'Moneda', // MT
    pt: 'Moeda', // MT
    de: 'Währung', // MT
    fr: 'Devise', // MT
  },
  quantity_limit: {
    en: 'Quantity limit',
    nl: 'Maximumaantal',
    es: 'Límite de cantidad', // MT
    pt: 'Limite de quantidade', // MT
    de: 'Stückzahl-Limit', // MT
    fr: 'Limite de quantité', // MT
  },
  no_limit: {
    en: 'No limit',
    nl: 'Geen limiet',
    es: 'Sin límite', // MT
    pt: 'Sem limite', // MT
    de: 'Kein Limit', // MT
    fr: 'Sans limite', // MT
  },
  unlimited_hint: {
    en: 'Leave empty for unlimited.',
    nl: 'Laat leeg voor onbeperkt.',
    es: 'Déjalo vacío para ilimitado.', // MT
    pt: 'Deixe vazio para ilimitado.', // MT
    de: 'Leer lassen für unbegrenzt.', // MT
    fr: 'Laisse vide pour illimité.', // MT
  },
  available_until: {
    en: 'Available until',
    nl: 'Beschikbaar tot',
    es: 'Disponible hasta', // MT
    pt: 'Disponível até', // MT
    de: 'Verfügbar bis', // MT
    fr: 'Disponible jusqu’au', // MT
  },
  keep_available_hint: {
    en: 'Leave empty to keep it available.',
    nl: 'Laat leeg om het beschikbaar te houden.',
    es: 'Déjalo vacío para mantenerla disponible.', // MT
    pt: 'Deixe vazio para mantê-lo disponível.', // MT
    de: 'Leer lassen, um es verfügbar zu halten.', // MT
    fr: 'Laisse vide pour le garder disponible.', // MT
  },
  inherit: {
    en: 'Inherit',
    nl: 'Overerven',
    es: 'Heredar', // MT
    pt: 'Herdar', // MT
    de: 'Erben', // MT
    fr: 'Hériter', // MT
  },
  custom_ticket: {
    en: 'Custom for this ticket',
    nl: 'Aangepast voor dit ticket',
    es: 'Personalizado para esta entrada', // MT
    pt: 'Personalizado para este ingresso', // MT
    de: 'Individuell für dieses Ticket', // MT
    fr: 'Personnalisé pour ce billet', // MT
  },
  active_shown: {
    en: 'Active — shown at enrolment',
    nl: 'Actief — getoond bij inschrijving',
    es: 'Activa — se muestra al inscribirse', // MT
    pt: 'Ativo — mostrado na inscrição', // MT
    de: 'Aktiv — bei der Anmeldung sichtbar', // MT
    fr: 'Actif — affiché à l’inscription', // MT
  },
  delete_ticket: {
    en: 'Delete ticket',
    nl: 'Ticket verwijderen',
    es: 'Eliminar entrada', // MT
    pt: 'Excluir ingresso', // MT
    de: 'Ticket löschen', // MT
    fr: 'Supprimer le billet', // MT
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
  err_code_value: {
    en: 'Give the code a value.',
    nl: 'Geef de code een waarde.',
    es: 'Dale un valor al código.', // MT
    pt: 'Dê um valor ao código.', // MT
    de: 'Gib dem Code einen Wert.', // MT
    fr: 'Donne une valeur au code.', // MT
  },
  err_percentage: {
    en: 'Percentage must be between 1 and 100.',
    nl: 'Het percentage moet tussen 1 en 100 liggen.',
    es: 'El porcentaje debe estar entre 1 y 100.', // MT
    pt: 'A porcentagem deve estar entre 1 e 100.', // MT
    de: 'Der Prozentsatz muss zwischen 1 und 100 liegen.', // MT
    fr: 'Le pourcentage doit être compris entre 1 et 100.', // MT
  },
  err_discount_amount: {
    en: 'Set a discount amount.',
    nl: 'Stel een kortingsbedrag in.',
    es: 'Define un importe de descuento.', // MT
    pt: 'Defina um valor de desconto.', // MT
    de: 'Lege einen Rabattbetrag fest.', // MT
    fr: 'Définis un montant de réduction.', // MT
  },
  add_discount_code: {
    en: 'Add discount code',
    nl: 'Kortingscode toevoegen',
    es: 'Añadir código de descuento', // MT
    pt: 'Adicionar código de desconto', // MT
    de: 'Rabattcode hinzufügen', // MT
    fr: 'Ajouter un code de réduction', // MT
  },
  unlimited: {
    en: 'Unlimited',
    nl: 'Onbeperkt',
    es: 'Ilimitado', // MT
    pt: 'Ilimitado', // MT
    de: 'Unbegrenzt', // MT
    fr: 'Illimité', // MT
  },
  n_uses: {
    en: '{n} uses',
    nl: '{n} keer te gebruiken',
    es: '{n} usos', // MT
    pt: '{n} usos', // MT
    de: '{n} Verwendungen', // MT
    fr: '{n} utilisations', // MT
  },
  all_tickets: {
    en: 'All tickets',
    nl: 'Alle tickets',
    es: 'Todas las entradas', // MT
    pt: 'Todos os ingressos', // MT
    de: 'Alle Tickets', // MT
    fr: 'Tous les billets', // MT
  },
  code: {
    en: 'Code',
    nl: 'Code',
    es: 'Código', // MT
    pt: 'Código', // MT
    de: 'Code', // MT
    fr: 'Code', // MT
  },
  uppercased_hint: {
    en: 'Uppercased automatically.',
    nl: 'Wordt automatisch in hoofdletters gezet.',
    es: 'Se pasa a mayúsculas automáticamente.', // MT
    pt: 'Convertido em maiúsculas automaticamente.', // MT
    de: 'Wird automatisch großgeschrieben.', // MT
    fr: 'Mis en majuscules automatiquement.', // MT
  },
  percentage: {
    en: 'Percentage',
    nl: 'Percentage',
    es: 'Porcentaje', // MT
    pt: 'Porcentagem', // MT
    de: 'Prozentsatz', // MT
    fr: 'Pourcentage', // MT
  },
  discount: {
    en: 'Discount',
    nl: 'Korting',
    es: 'Descuento', // MT
    pt: 'Desconto', // MT
    de: 'Rabatt', // MT
    fr: 'Réduction', // MT
  },
  percent_hint: {
    en: 'Percent off, 1–100.',
    nl: 'Procent korting, 1–100.',
    es: 'Por ciento de descuento, 1–100.', // MT
    pt: 'Percentual de desconto, 1–100.', // MT
    de: 'Prozent Rabatt, 1–100.', // MT
    fr: 'Pourcentage de réduction, 1–100.', // MT
  },
  discount_amount: {
    en: 'Discount amount',
    nl: 'Kortingsbedrag',
    es: 'Importe del descuento', // MT
    pt: 'Valor do desconto', // MT
    de: 'Rabattbetrag', // MT
    fr: 'Montant de la réduction', // MT
  },
  amount_hint: {
    en: "Fixed amount off, in the ticket's currency.",
    nl: 'Vast bedrag korting, in de valuta van het ticket.',
    es: 'Importe fijo de descuento, en la moneda de la entrada.', // MT
    pt: 'Valor fixo de desconto, na moeda do ingresso.', // MT
    de: 'Fester Rabattbetrag in der Währung des Tickets.', // MT
    fr: 'Montant fixe de réduction, dans la devise du billet.', // MT
  },
  free_code_note: {
    en: 'The code makes enrolment free — no charge at checkout.',
    nl: 'De code maakt inschrijven gratis — er wordt niets afgerekend.',
    es: 'El código hace la inscripción gratis — sin cobro al pagar.', // MT
    pt: 'O código torna a inscrição grátis — sem cobrança no checkout.', // MT
    de: 'Der Code macht die Anmeldung kostenlos — keine Abbuchung beim Checkout.', // MT
    fr: 'Le code rend l’inscription gratuite — aucun débit au paiement.', // MT
  },
  applies_to: {
    en: 'Applies to',
    nl: 'Geldt voor',
    es: 'Se aplica a', // MT
    pt: 'Aplica-se a', // MT
    de: 'Gilt für', // MT
    fr: 'S’applique à', // MT
  },
  scope_hint: {
    en: 'Scope the code to one ticket, or leave it valid for all.',
    nl: 'Beperk de code tot één ticket, of laat hem voor alle gelden.',
    es: 'Limita el código a una entrada, o déjalo válido para todas.', // MT
    pt: 'Limite o código a um ingresso, ou deixe válido para todos.', // MT
    de: 'Beschränke den Code auf ein Ticket oder lass ihn für alle gelten.', // MT
    fr: 'Restreins le code à un billet, ou laisse-le valable pour tous.', // MT
  },
  usage_limit: {
    en: 'Usage limit',
    nl: 'Gebruikslimiet',
    es: 'Límite de usos', // MT
    pt: 'Limite de usos', // MT
    de: 'Nutzungslimit', // MT
    fr: 'Limite d’utilisation', // MT
  },
  expires: {
    en: 'Expires',
    nl: 'Verloopt',
    es: 'Caduca', // MT
    pt: 'Expira', // MT
    de: 'Läuft ab', // MT
    fr: 'Expire', // MT
  },
  early_bird_switch: {
    en: 'Early bird — only valid until a deadline',
    nl: 'Vroegboeker — alleen geldig tot een deadline',
    es: 'Madrugador — solo válido hasta una fecha límite', // MT
    pt: 'Antecipado — válido apenas até um prazo', // MT
    de: 'Frühbucher — nur bis zu einer Frist gültig', // MT
    fr: 'Lève-tôt — valable seulement jusqu’à une date limite', // MT
  },
  early_bird_deadline: {
    en: 'Early-bird deadline',
    nl: 'Vroegboekdeadline',
    es: 'Fecha límite del madrugador', // MT
    pt: 'Prazo do antecipado', // MT
    de: 'Frühbucher-Frist', // MT
    fr: 'Date limite lève-tôt', // MT
  },
  active_redeemable: {
    en: 'Active — redeemable at checkout',
    nl: 'Actief — inwisselbaar bij het afrekenen',
    es: 'Activo — canjeable al pagar', // MT
    pt: 'Ativo — resgatável no checkout', // MT
    de: 'Aktiv — beim Checkout einlösbar', // MT
    fr: 'Actif — utilisable au paiement', // MT
  },
  delete_discount_code: {
    en: 'Delete discount code',
    nl: 'Kortingscode verwijderen',
    es: 'Eliminar código de descuento', // MT
    pt: 'Excluir código de desconto', // MT
    de: 'Rabattcode löschen', // MT
    fr: 'Supprimer le code de réduction', // MT
  },
  amount_label: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Valor', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  // ── check-in ──────────────────────────────────────────────────────────
  checkin: {
    en: 'Check-in',
    nl: 'Check-in',
    es: 'Check-in', // MT
    pt: 'Check-in', // MT
    de: 'Check-in', // MT
    fr: 'Check-in', // MT
  },
  check_in: {
    en: 'Check in',
    nl: 'Inchecken',
    es: 'Registrar entrada', // MT
    pt: 'Fazer check-in', // MT
    de: 'Einchecken', // MT
    fr: 'Enregistrer', // MT
  },
  checked_in: {
    en: 'Checked in',
    nl: 'Ingecheckt',
    es: 'Registrado', // MT
    pt: 'Check-in feito', // MT
    de: 'Eingecheckt', // MT
    fr: 'Enregistré', // MT
  },
  checking_in: {
    en: 'Checking in…',
    nl: 'Inchecken…',
    es: 'Registrando…', // MT
    pt: 'Fazendo check-in…', // MT
    de: 'Wird eingecheckt…', // MT
    fr: 'Enregistrement…', // MT
  },
  undo: {
    en: 'Undo',
    nl: 'Ongedaan maken',
    es: 'Deshacer', // MT
    pt: 'Desfazer', // MT
    de: 'Rückgängig', // MT
    fr: 'Annuler', // MT
  },
  ticket_no_match: {
    en: 'This ticket does not match any registration.',
    nl: 'Dit ticket hoort bij geen enkele registratie.',
    es: 'Esta entrada no coincide con ningún registro.', // MT
    pt: 'Este ingresso não corresponde a nenhum registro.', // MT
    de: 'Dieses Ticket passt zu keiner Registrierung.', // MT
    fr: 'Ce billet ne correspond à aucune inscription.', // MT
  },
  door_ticket_refusal: {
    en: 'This is a door ticket. Only the organiser of the event can check people in — if that is you, sign in with your organiser account.',
    nl: 'Dit is een deurticket. Alleen de organisator van het evenement kan mensen inchecken — ben jij dat, log dan in met je organisatoraccount.',
    es: 'Esta es una entrada de puerta. Solo el organizador del evento puede registrar entradas — si eres tú, inicia sesión con tu cuenta de organizador.', // MT
    pt: 'Este é um ingresso de porta. Só o organizador do evento pode fazer check-in — se for você, entre com sua conta de organizador.', // MT
    de: 'Das ist ein Türticket. Nur die Veranstalter:in des Events kann einchecken — wenn du das bist, melde dich mit deinem Veranstalterkonto an.', // MT
    fr: 'Ceci est un billet d’entrée. Seul l’organisateur de l’événement peut enregistrer les arrivées — si c’est toi, connecte-toi avec ton compte organisateur.', // MT
  },
  reg_not_approved: {
    en: 'Registration not yet approved',
    nl: 'Registratie nog niet goedgekeurd',
    es: 'Registro aún no aprobado', // MT
    pt: 'Registro ainda não aprovado', // MT
    de: 'Registrierung noch nicht freigegeben', // MT
    fr: 'Inscription pas encore approuvée', // MT
  },
  payment_still_pending: {
    en: 'Payment still pending',
    nl: 'Betaling nog in afwachting',
    es: 'Pago aún pendiente', // MT
    pt: 'Pagamento ainda pendente', // MT
    de: 'Zahlung noch ausstehend', // MT
    fr: 'Paiement toujours en attente', // MT
  },
  not_a_ticket: {
    en: 'Not a ticket for this event',
    nl: 'Geen ticket voor dit evenement',
    es: 'No es una entrada de este evento', // MT
    pt: 'Não é um ingresso deste evento', // MT
    de: 'Kein Ticket für diese Veranstaltung', // MT
    fr: 'Pas un billet pour cet événement', // MT
  },
  camera_error: {
    en: "The camera could not be opened — check the browser's permission.",
    nl: 'De camera kon niet worden geopend — controleer de browsertoestemming.',
    es: 'No se pudo abrir la cámara — revisa el permiso del navegador.', // MT
    pt: 'A câmera não pôde ser aberta — verifique a permissão do navegador.', // MT
    de: 'Die Kamera konnte nicht geöffnet werden — prüfe die Browser-Berechtigung.', // MT
    fr: 'Impossible d’ouvrir la caméra — vérifie l’autorisation du navigateur.', // MT
  },
  checked_in_lower: {
    en: 'checked in',
    nl: 'ingecheckt',
    es: 'registrados', // MT
    pt: 'com check-in', // MT
    de: 'eingecheckt', // MT
    fr: 'enregistrés', // MT
  },
  stop_scanning: {
    en: 'Stop scanning',
    nl: 'Stop met scannen',
    es: 'Dejar de escanear', // MT
    pt: 'Parar de escanear', // MT
    de: 'Scannen beenden', // MT
    fr: 'Arrêter le scan', // MT
  },
  scan_tickets: {
    en: 'Scan tickets',
    nl: 'Tickets scannen',
    es: 'Escanear entradas', // MT
    pt: 'Escanear ingressos', // MT
    de: 'Tickets scannen', // MT
    fr: 'Scanner les billets', // MT
  },
  search_name_email: {
    en: 'Search name or email',
    nl: 'Zoek op naam of e-mail',
    es: 'Busca por nombre o correo', // MT
    pt: 'Pesquise por nome ou e-mail', // MT
    de: 'Nach Name oder E-Mail suchen', // MT
    fr: 'Rechercher par nom ou e-mail', // MT
  },
  camera_is_door: {
    en: 'The camera is the door while it is on — tap Stop scanning to check someone in by hand.',
    nl: 'Zolang de camera aanstaat is die de deur — tik op Stop met scannen om iemand handmatig in te checken.',
    es: 'Mientras está encendida, la cámara es la puerta — toca Dejar de escanear para registrar a alguien a mano.', // MT
    pt: 'Enquanto ligada, a câmera é a porta — toque em Parar de escanear para fazer check-in manual.', // MT
    de: 'Solange die Kamera an ist, ist sie die Tür — tippe auf Scannen beenden, um jemanden von Hand einzuchecken.', // MT
    fr: 'Tant qu’elle est allumée, la caméra est la porte — appuie sur Arrêter le scan pour enregistrer quelqu’un à la main.', // MT
  },
  nobody_registered: {
    en: 'Nobody is registered yet.',
    nl: 'Er is nog niemand geregistreerd.',
    es: 'Aún no hay nadie registrado.', // MT
    pt: 'Ainda ninguém se registrou.', // MT
    de: 'Noch niemand ist registriert.', // MT
    fr: 'Personne n’est encore inscrit.', // MT
  },
  no_match: {
    en: 'No match.',
    nl: 'Geen resultaat.',
    es: 'Sin coincidencias.', // MT
    pt: 'Sem correspondência.', // MT
    de: 'Kein Treffer.', // MT
    fr: 'Aucun résultat.', // MT
  },
  not_approved_yet: {
    en: 'not approved yet',
    nl: 'nog niet goedgekeurd',
    es: 'aún sin aprobar', // MT
    pt: 'ainda não aprovado', // MT
    de: 'noch nicht freigegeben', // MT
    fr: 'pas encore approuvé', // MT
  },
  payment_pending_lower: {
    en: 'payment pending',
    nl: 'betaling in afwachting',
    es: 'pago pendiente', // MT
    pt: 'pagamento pendente', // MT
    de: 'Zahlung ausstehend', // MT
    fr: 'paiement en attente', // MT
  },
  not_admitted: {
    en: 'Not admitted',
    nl: 'Niet toegelaten',
    es: 'No admitido', // MT
    pt: 'Não admitido', // MT
    de: 'Nicht eingelassen', // MT
    fr: 'Non admis', // MT
  },
  already_checked_in_at: {
    en: '{name} was already checked in at {time}',
    nl: '{name} was al ingecheckt om {time}',
    es: '{name} ya se registró a las {time}', // MT
    pt: '{name} já fez check-in às {time}', // MT
    de: '{name} war schon um {time} eingecheckt', // MT
    fr: '{name} était déjà enregistré à {time}', // MT
  },

  // ── team detail ───────────────────────────────────────────────────────
  couldnt_load_team: {
    en: "Couldn't load the team.",
    nl: 'Kon het team niet laden.',
    es: 'No se pudo cargar el equipo.', // MT
    pt: 'Não foi possível carregar a equipe.', // MT
    de: 'Das Team konnte nicht geladen werden.', // MT
    fr: 'Impossible de charger l’équipe.', // MT
  },
  members: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  no_members_yet: {
    en: 'No members yet. Add workspace members below.',
    nl: 'Nog geen leden. Voeg hieronder werkruimteleden toe.',
    es: 'Aún no hay miembros. Añade miembros del espacio abajo.', // MT
    pt: 'Ainda não há membros. Adicione membros do espaço abaixo.', // MT
    de: 'Noch keine Mitglieder. Füge unten Workspace-Mitglieder hinzu.', // MT
    fr: 'Pas encore de membres. Ajoute des membres de l’espace ci-dessous.', // MT
  },
  role_lead: {
    en: 'Lead',
    nl: 'Lead',
    es: 'Responsable', // MT
    pt: 'Líder', // MT
    de: 'Lead', // MT
    fr: 'Responsable', // MT
  },
  role_member: {
    en: 'Member',
    nl: 'Lid',
    es: 'Miembro', // MT
    pt: 'Membro', // MT
    de: 'Mitglied', // MT
    fr: 'Membre', // MT
  },
  add_a_member: {
    en: 'Add a member',
    nl: 'Lid toevoegen',
    es: 'Añadir un miembro', // MT
    pt: 'Adicionar um membro', // MT
    de: 'Mitglied hinzufügen', // MT
    fr: 'Ajouter un membre', // MT
  },
  everyone_on_team: {
    en: 'Everyone in the workspace is already on this team.',
    nl: 'Iedereen in de werkruimte zit al in dit team.',
    es: 'Todos en el espacio ya están en este equipo.', // MT
    pt: 'Todos no espaço já estão nesta equipe.', // MT
    de: 'Alle im Workspace sind schon in diesem Team.', // MT
    fr: 'Tout le monde dans l’espace est déjà dans cette équipe.', // MT
  },
  workspace_member: {
    en: 'Workspace member',
    nl: 'Werkruimtelid',
    es: 'Miembro del espacio', // MT
    pt: 'Membro do espaço', // MT
    de: 'Workspace-Mitglied', // MT
    fr: 'Membre de l’espace', // MT
  },
  role: {
    en: 'Role',
    nl: 'Rol',
    es: 'Rol', // MT
    pt: 'Função', // MT
    de: 'Rolle', // MT
    fr: 'Rôle', // MT
  },
  err_pick_ws_member: {
    en: 'Pick a workspace member.',
    nl: 'Kies een werkruimtelid.',
    es: 'Elige un miembro del espacio.', // MT
    pt: 'Escolha um membro do espaço.', // MT
    de: 'Wähle ein Workspace-Mitglied.', // MT
    fr: 'Choisis un membre de l’espace.', // MT
  },
  remove_from_team: {
    en: 'Remove from team',
    nl: 'Uit team verwijderen',
    es: 'Quitar del equipo', // MT
    pt: 'Remover da equipe', // MT
    de: 'Aus dem Team entfernen', // MT
    fr: 'Retirer de l’équipe', // MT
  },
  remove_name_aria: {
    en: 'Remove {name} from the team',
    nl: 'Verwijder {name} uit het team',
    es: 'Quitar a {name} del equipo', // MT
    pt: 'Remover {name} da equipe', // MT
    de: '{name} aus dem Team entfernen', // MT
    fr: 'Retirer {name} de l’équipe', // MT
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
    en: 'Remove {name} from this team? They keep their workspace access — only the team membership goes.',
    nl: '{name} uit dit team verwijderen? De werkruimtetoegang blijft — alleen het teamlidmaatschap vervalt.',
    es: '¿Quitar a {name} de este equipo? Conserva su acceso al espacio — solo se va la pertenencia al equipo.', // MT
    pt: 'Remover {name} desta equipe? O acesso ao espaço continua — só a participação na equipe vai embora.', // MT
    de: '{name} aus diesem Team entfernen? Der Workspace-Zugriff bleibt — nur die Teamzugehörigkeit endet.', // MT
    fr: 'Retirer {name} de cette équipe ? L’accès à l’espace reste — seule l’appartenance à l’équipe disparaît.', // MT
  },
  team_settings: {
    en: 'Team settings',
    nl: 'Teaminstellingen',
    es: 'Configuración del equipo', // MT
    pt: 'Configurações da equipe', // MT
    de: 'Team-Einstellungen', // MT
    fr: 'Paramètres de l’équipe', // MT
  },
  team_public_desc_placeholder: {
    en: "What this team is for — shown on the team's public page.",
    nl: 'Waar dit team voor is — te zien op de openbare teampagina.',
    es: 'Para qué es este equipo — se muestra en la página pública del equipo.', // MT
    pt: 'Para que serve esta equipe — aparece na página pública da equipe.', // MT
    de: 'Wofür dieses Team da ist — auf der öffentlichen Teamseite zu sehen.', // MT
    fr: 'À quoi sert cette équipe — affiché sur la page publique de l’équipe.', // MT
  },
  payments_go_to: {
    en: "Payments from this team's threads go to",
    nl: 'Betalingen uit de threads van dit team gaan naar',
    es: 'Los pagos de los threads de este equipo van a', // MT
    pt: 'Os pagamentos dos threads desta equipe vão para', // MT
    de: 'Zahlungen aus den Threads dieses Teams gehen an', // MT
    fr: 'Les paiements des threads de cette équipe vont à', // MT
  },
  workspace_account_note: {
    en: "The workspace's Stripe account and invoice identity (default).",
    nl: 'Het Stripe-account en de factuuridentiteit van de werkruimte (standaard).',
    es: 'La cuenta de Stripe y la identidad de facturación del espacio (por defecto).', // MT
    pt: 'A conta Stripe e a identidade de fatura do espaço (padrão).', // MT
    de: 'Das Stripe-Konto und die Rechnungsidentität des Workspace (Standard).', // MT
    fr: 'Le compte Stripe et l’identité de facturation de l’espace (par défaut).', // MT
  },
  lead_account: {
    en: "Team lead's account",
    nl: 'Account van de teamlead',
    es: 'Cuenta del responsable del equipo', // MT
    pt: 'Conta do líder da equipe', // MT
    de: 'Konto des Team-Leads', // MT
    fr: 'Compte du responsable d’équipe', // MT
  },
  lead_account_note: {
    en: "The lead's personal Stripe account (Settings → Payments → My account).",
    nl: 'Het persoonlijke Stripe-account van de lead (Instellingen → Betalingen → Mijn account).',
    es: 'La cuenta personal de Stripe del responsable (Configuración → Pagos → Mi cuenta).', // MT
    pt: 'A conta Stripe pessoal do líder (Configurações → Pagamentos → Minha conta).', // MT
    de: 'Das persönliche Stripe-Konto des Leads (Einstellungen → Zahlungen → Mein Konto).', // MT
    fr: 'Le compte Stripe personnel du responsable (Paramètres → Paiements → Mon compte).', // MT
  },
  // ── thread templates ──────────────────────────────────────────────────
  templates_none: {
    en: 'No thread templates yet. Open a thread → settings (gear) → “Save as template”.',
    nl: 'Nog geen thread-sjablonen. Open een thread → instellingen (tandwiel) → “Opslaan als sjabloon”.',
    es: 'Aún no hay plantillas de thread. Abre un thread → configuración (engranaje) → «Guardar como plantilla».', // MT
    pt: 'Ainda não há modelos de thread. Abra um thread → configurações (engrenagem) → “Salvar como modelo”.', // MT
    de: 'Noch keine Thread-Vorlagen. Öffne einen Thread → Einstellungen (Zahnrad) → „Als Vorlage speichern“.', // MT
    fr: 'Pas encore de modèles de thread. Ouvre un thread → paramètres (engrenage) → « Enregistrer comme modèle ».', // MT
  },
  n_engagements: {
    en: '{n} engagement(s)',
    nl: '{n} engagement(s)',
    es: '{n} compromiso(s)', // MT
    pt: '{n} engajamento(s)', // MT
    de: '{n} Engagement(s)', // MT
    fr: '{n} engagement(s)', // MT
  },
  use_template: {
    en: 'Use template',
    nl: 'Sjabloon gebruiken',
    es: 'Usar plantilla', // MT
    pt: 'Usar modelo', // MT
    de: 'Vorlage verwenden', // MT
    fr: 'Utiliser le modèle', // MT
  },
  delete_template: {
    en: 'Delete template',
    nl: 'Sjabloon verwijderen',
    es: 'Eliminar plantilla', // MT
    pt: 'Excluir modelo', // MT
    de: 'Vorlage löschen', // MT
    fr: 'Supprimer le modèle', // MT
  },
  delete_template_msg_1: {
    en: 'This deletes the template',
    nl: 'Dit verwijdert het sjabloon',
    es: 'Esto elimina la plantilla', // MT
    pt: 'Isto exclui o modelo', // MT
    de: 'Das löscht die Vorlage', // MT
    fr: 'Cela supprime le modèle', // MT
  },
  delete_template_msg_2: {
    en: 'Threads already created from it are not affected. There is no undo.',
    nl: 'Threads die er al mee zijn gemaakt blijven ongemoeid. Dit kan niet ongedaan worden gemaakt.',
    es: 'Los threads ya creados con ella no se ven afectados. No se puede deshacer.', // MT
    pt: 'Threads já criados a partir dele não são afetados. Não há como desfazer.', // MT
    de: 'Bereits daraus erstellte Threads bleiben unberührt. Es gibt kein Zurück.', // MT
    fr: 'Les threads déjà créés à partir de lui ne sont pas affectés. Il n’y a pas d’annulation.', // MT
  },
  err_new_thread_name: {
    en: 'Give the new thread a name.',
    nl: 'Geef de nieuwe thread een naam.',
    es: 'Ponle un nombre al nuevo thread.', // MT
    pt: 'Dê um nome ao novo thread.', // MT
    de: 'Gib dem neuen Thread einen Namen.', // MT
    fr: 'Donne un nom au nouveau thread.', // MT
  },
  err_new_thread_slug: {
    en: 'Give the new thread a slug.',
    nl: 'Geef de nieuwe thread een slug.',
    es: 'Ponle un slug al nuevo thread.', // MT
    pt: 'Dê um slug ao novo thread.', // MT
    de: 'Gib dem neuen Thread einen Slug.', // MT
    fr: 'Donne un slug au nouveau thread.', // MT
  },
  use_template_desc: {
    en: 'New thread from “{title}” — every engagement rebases onto the start date.',
    nl: 'Nieuwe thread vanuit “{title}” — elk engagement schuift mee naar de startdatum.',
    es: 'Nuevo thread desde «{title}» — cada compromiso se recalcula sobre la fecha de inicio.', // MT
    pt: 'Novo thread a partir de “{title}” — cada engajamento se reajusta à data de início.', // MT
    de: 'Neuer Thread aus „{title}“ — jedes Engagement richtet sich am Startdatum neu aus.', // MT
    fr: 'Nouveau thread depuis « {title} » — chaque engagement se recale sur la date de début.', // MT
  },
  thread_name: {
    en: 'Thread name',
    nl: 'Threadnaam',
    es: 'Nombre del thread', // MT
    pt: 'Nome do thread', // MT
    de: 'Thread-Name', // MT
    fr: 'Nom du thread', // MT
  },
  slug: {
    en: 'Slug',
    nl: 'Slug',
    es: 'Slug', // MT
    pt: 'Slug', // MT
    de: 'Slug', // MT
    fr: 'Slug', // MT
  },
  start_date: {
    en: 'Start date',
    nl: 'Startdatum',
    es: 'Fecha de inicio', // MT
    pt: 'Data de início', // MT
    de: 'Startdatum', // MT
    fr: 'Date de début', // MT
  },
  start_date_hint: {
    en: 'Leave empty to set dates later — engagements arrive undated.',
    nl: 'Laat leeg om datums later te bepalen — engagements komen zonder datum binnen.',
    es: 'Déjalo vacío para fijar fechas después — los compromisos llegan sin fecha.', // MT
    pt: 'Deixe vazio para definir datas depois — os engajamentos chegam sem data.', // MT
    de: 'Leer lassen, um Termine später zu setzen — Engagements kommen ohne Datum an.', // MT
    fr: 'Laisse vide pour fixer les dates plus tard — les engagements arrivent sans date.', // MT
  },
  err_template_name: {
    en: 'The template needs a name.',
    nl: 'Het sjabloon heeft een naam nodig.',
    es: 'La plantilla necesita un nombre.', // MT
    pt: 'O modelo precisa de um nome.', // MT
    de: 'Die Vorlage braucht einen Namen.', // MT
    fr: 'Le modèle a besoin d’un nom.', // MT
  },
  err_template_team: {
    en: 'Pick the team that owns this template.',
    nl: 'Kies het team dat dit sjabloon beheert.',
    es: 'Elige el equipo dueño de esta plantilla.', // MT
    pt: 'Escolha a equipe dona deste modelo.', // MT
    de: 'Wähle das Team, dem diese Vorlage gehört.', // MT
    fr: 'Choisis l’équipe propriétaire de ce modèle.', // MT
  },
  edit_template: {
    en: 'Edit template',
    nl: 'Sjabloon bewerken',
    es: 'Editar plantilla', // MT
    pt: 'Editar modelo', // MT
    de: 'Vorlage bearbeiten', // MT
    fr: 'Modifier le modèle', // MT
  },
  edit_template_desc: {
    en: 'Name and sharing. To change the design, edit a thread and save it as a template again.',
    nl: 'Naam en delen. Wil je het ontwerp wijzigen, bewerk dan een thread en sla die opnieuw op als sjabloon.',
    es: 'Nombre y uso compartido. Para cambiar el diseño, edita un thread y guárdalo de nuevo como plantilla.', // MT
    pt: 'Nome e compartilhamento. Para mudar o design, edite um thread e salve-o de novo como modelo.', // MT
    de: 'Name und Freigabe. Um das Design zu ändern, bearbeite einen Thread und speichere ihn erneut als Vorlage.', // MT
    fr: 'Nom et partage. Pour changer le design, modifie un thread et enregistre-le de nouveau comme modèle.', // MT
  },
  template_name: {
    en: 'Template name',
    nl: 'Sjabloonnaam',
    es: 'Nombre de la plantilla', // MT
    pt: 'Nome do modelo', // MT
    de: 'Vorlagenname', // MT
    fr: 'Nom du modèle', // MT
  },
  available_to: {
    en: 'Available to',
    nl: 'Beschikbaar voor',
    es: 'Disponible para', // MT
    pt: 'Disponível para', // MT
    de: 'Verfügbar für', // MT
    fr: 'Disponible pour', // MT
  },
  just_me: {
    en: 'Just me',
    nl: 'Alleen ik',
    es: 'Solo yo', // MT
    pt: 'Só eu', // MT
    de: 'Nur ich', // MT
    fr: 'Moi uniquement', // MT
  },
  a_team: {
    en: 'A team',
    nl: 'Een team',
    es: 'Un equipo', // MT
    pt: 'Uma equipe', // MT
    de: 'Ein Team', // MT
    fr: 'Une équipe', // MT
  },
  contents_click: {
    en: 'Contents — click to edit',
    nl: 'Inhoud — klik om te bewerken',
    es: 'Contenido — haz clic para editar', // MT
    pt: 'Conteúdo — clique para editar', // MT
    de: 'Inhalt — zum Bearbeiten klicken', // MT
    fr: 'Contenu — clique pour modifier', // MT
  },
  no_engagements_captured: {
    en: 'No engagements captured.',
    nl: 'Geen engagements vastgelegd.',
    es: 'No hay compromisos capturados.', // MT
    pt: 'Nenhum engajamento capturado.', // MT
    de: 'Keine Engagements erfasst.', // MT
    fr: 'Aucun engagement capturé.', // MT
  },
  day_n: {
    en: 'Day {n}',
    nl: 'Dag {n}',
    es: 'Día {n}', // MT
    pt: 'Dia {n}', // MT
    de: 'Tag {n}', // MT
    fr: 'Jour {n}', // MT
  },
  tpl_engagement_desc: {
    en: "Part of the template — day numbers count from the thread's start date.",
    nl: 'Onderdeel van het sjabloon — dagnummers tellen vanaf de startdatum van de thread.',
    es: 'Parte de la plantilla — los números de día cuentan desde la fecha de inicio del thread.', // MT
    pt: 'Parte do modelo — os números dos dias contam a partir da data de início do thread.', // MT
    de: 'Teil der Vorlage — Tagesnummern zählen ab dem Startdatum des Threads.', // MT
    fr: 'Partie du modèle — les numéros de jour comptent depuis la date de début du thread.', // MT
  },
  apply_btn: {
    en: 'Apply',
    nl: 'Toepassen',
    es: 'Aplicar', // MT
    pt: 'Aplicar', // MT
    de: 'Übernehmen', // MT
    fr: 'Appliquer', // MT
  },
  day: {
    en: 'Day',
    nl: 'Dag',
    es: 'Día', // MT
    pt: 'Dia', // MT
    de: 'Tag', // MT
    fr: 'Jour', // MT
  },
  time: {
    en: 'Time',
    nl: 'Tijd',
    es: 'Hora', // MT
    pt: 'Hora', // MT
    de: 'Zeit', // MT
    fr: 'Heure', // MT
  },
  duration_min: {
    en: 'Duration (min)',
    nl: 'Duur (min)',
    es: 'Duración (min)', // MT
    pt: 'Duração (min)', // MT
    de: 'Dauer (Min.)', // MT
    fr: 'Durée (min)', // MT
  },
  // ── certificates ──────────────────────────────────────────────────────
  certificates_desc: {
    en: 'Design certificate templates — threads pick one and issue it on completion.',
    nl: 'Ontwerp certificaatsjablonen — threads kiezen er een en reiken hem uit na afronding.',
    es: 'Diseña plantillas de certificado — los threads eligen una y la emiten al finalizar.', // MT
    pt: 'Crie modelos de certificado — os threads escolhem um e o emitem na conclusão.', // MT
    de: 'Gestalte Zertifikatvorlagen — Threads wählen eine und stellen sie nach Abschluss aus.', // MT
    fr: 'Conçois des modèles de certificat — les threads en choisissent un et l’émettent à la fin.', // MT
  },
  cert_empty: {
    en: "No templates yet. Create your first — pick a page size, drop in the recipient's name and the thread title, and threads can start issuing it.",
    nl: 'Nog geen sjablonen. Maak je eerste — kies een paginaformaat, zet de naam van de ontvanger en de threadtitel erin, en threads kunnen hem gaan uitreiken.',
    es: 'Aún no hay plantillas. Crea la primera — elige un tamaño de página, coloca el nombre del destinatario y el título del thread, y los threads podrán emitirla.', // MT
    pt: 'Ainda não há modelos. Crie o primeiro — escolha um tamanho de página, insira o nome do destinatário e o título do thread, e os threads poderão emiti-lo.', // MT
    de: 'Noch keine Vorlagen. Erstelle die erste — wähle ein Seitenformat, setze den Namen der Empfänger:in und den Thread-Titel ein, und Threads können sie ausstellen.', // MT
    fr: 'Pas encore de modèles. Crée le premier — choisis un format de page, place le nom du destinataire et le titre du thread, et les threads pourront l’émettre.', // MT
  },
  updated_on: {
    en: 'Updated {date}',
    nl: 'Bijgewerkt {date}',
    es: 'Actualizado {date}', // MT
    pt: 'Atualizado {date}', // MT
    de: 'Aktualisiert {date}', // MT
    fr: 'Mis à jour {date}', // MT
  },
  orientation_landscape: {
    en: 'Landscape',
    nl: 'Liggend',
    es: 'Horizontal', // MT
    pt: 'Paisagem', // MT
    de: 'Querformat', // MT
    fr: 'Paysage', // MT
  },
  orientation_portrait: {
    en: 'Portrait',
    nl: 'Staand',
    es: 'Vertical', // MT
    pt: 'Retrato', // MT
    de: 'Hochformat', // MT
    fr: 'Portrait', // MT
  },
  new_template: {
    en: 'New template',
    nl: 'Nieuw sjabloon',
    es: 'Nueva plantilla', // MT
    pt: 'Novo modelo', // MT
    de: 'Neue Vorlage', // MT
    fr: 'Nouveau modèle', // MT
  },
  new_cert_template: {
    en: 'New certificate template',
    nl: 'Nieuw certificaatsjabloon',
    es: 'Nueva plantilla de certificado', // MT
    pt: 'Novo modelo de certificado', // MT
    de: 'Neue Zertifikatvorlage', // MT
    fr: 'Nouveau modèle de certificat', // MT
  },
  new_cert_template_desc: {
    en: 'Name it and choose who can use it. You design it next.',
    nl: 'Geef het een naam en kies wie hem mag gebruiken. Daarna ga je ontwerpen.',
    es: 'Ponle nombre y elige quién puede usarla. Después la diseñas.', // MT
    pt: 'Dê um nome e escolha quem pode usá-lo. Você o desenha em seguida.', // MT
    de: 'Benenne sie und wähle, wer sie nutzen darf. Danach gestaltest du sie.', // MT
    fr: 'Nomme-le et choisis qui peut l’utiliser. Tu le conçois ensuite.', // MT
  },
  create: {
    en: 'Create',
    nl: 'Aanmaken',
    es: 'Crear', // MT
    pt: 'Criar', // MT
    de: 'Erstellen', // MT
    fr: 'Créer', // MT
  },
  err_template_no_id: {
    en: 'Template was created without an id.',
    nl: 'Sjabloon is aangemaakt zonder id.',
    es: 'La plantilla se creó sin id.', // MT
    pt: 'O modelo foi criado sem id.', // MT
    de: 'Die Vorlage wurde ohne ID erstellt.', // MT
    fr: 'Le modèle a été créé sans identifiant.', // MT
  },
  scope_personal_only_you: {
    en: 'Personal — only you',
    nl: 'Persoonlijk — alleen jij',
    es: 'Personal — solo tú', // MT
    pt: 'Pessoal — só você', // MT
    de: 'Persönlich — nur du', // MT
    fr: 'Personnel — toi uniquement', // MT
  },
  scope_workspace_share: {
    en: 'Workspace — share with specific people',
    nl: 'Werkruimte — delen met specifieke mensen',
    es: 'Espacio — compartir con personas concretas', // MT
    pt: 'Espaço — compartilhar com pessoas específicas', // MT
    de: 'Workspace — mit bestimmten Personen teilen', // MT
    fr: 'Espace — partager avec des personnes précises', // MT
  },
  cert_name_placeholder: {
    en: 'e.g. Completion certificate',
    nl: 'bijv. Afrondingscertificaat',
    es: 'p. ej. Certificado de finalización', // MT
    pt: 'ex.: Certificado de conclusão', // MT
    de: 'z. B. Abschlusszertifikat', // MT
    fr: 'p. ex. Certificat de fin', // MT
  },
  share_template: {
    en: 'Share template',
    nl: 'Sjabloon delen',
    es: 'Compartir plantilla', // MT
    pt: 'Compartilhar modelo', // MT
    de: 'Vorlage teilen', // MT
    fr: 'Partager le modèle', // MT
  },
  share_template_desc: {
    en: 'Who in the workspace can use this template on their threads.',
    nl: 'Wie in de werkruimte dit sjabloon op zijn threads mag gebruiken.',
    es: 'Quién en el espacio puede usar esta plantilla en sus threads.', // MT
    pt: 'Quem no espaço pode usar este modelo em seus threads.', // MT
    de: 'Wer im Workspace diese Vorlage auf seinen Threads nutzen darf.', // MT
    fr: 'Qui dans l’espace peut utiliser ce modèle sur ses threads.', // MT
  },
  save_shares: {
    en: 'Save shares',
    nl: 'Delen opslaan',
    es: 'Guardar accesos', // MT
    pt: 'Salvar compartilhamentos', // MT
    de: 'Freigaben speichern', // MT
    fr: 'Enregistrer les partages', // MT
  },
  everyone_in_workspace: {
    en: 'Everyone in the workspace',
    nl: 'Iedereen in de werkruimte',
    es: 'Todos en el espacio', // MT
    pt: 'Todos no espaço', // MT
    de: 'Alle im Workspace', // MT
    fr: 'Tout le monde dans l’espace', // MT
  },
  anyone_can_use: {
    en: 'Any workspace member can use this template.',
    nl: 'Elk werkruimtelid kan dit sjabloon gebruiken.',
    es: 'Cualquier miembro del espacio puede usar esta plantilla.', // MT
    pt: 'Qualquer membro do espaço pode usar este modelo.', // MT
    de: 'Jedes Workspace-Mitglied kann diese Vorlage nutzen.', // MT
    fr: 'Tout membre de l’espace peut utiliser ce modèle.', // MT
  },
  only_selected: {
    en: 'Only selected people and teams',
    nl: 'Alleen geselecteerde mensen en teams',
    es: 'Solo personas y equipos seleccionados', // MT
    pt: 'Apenas pessoas e equipes selecionadas', // MT
    de: 'Nur ausgewählte Personen und Teams', // MT
    fr: 'Seulement des personnes et équipes choisies', // MT
  },
  pick_below: {
    en: 'Pick who gets access below.',
    nl: 'Kies hieronder wie toegang krijgt.',
    es: 'Elige abajo quién tiene acceso.', // MT
    pt: 'Escolha abaixo quem tem acesso.', // MT
    de: 'Wähle unten, wer Zugriff bekommt.', // MT
    fr: 'Choisis ci-dessous qui a accès.', // MT
  },
  people: {
    en: 'People',
    nl: 'Mensen',
    es: 'Personas', // MT
    pt: 'Pessoas', // MT
    de: 'Personen', // MT
    fr: 'Personnes', // MT
  },
  no_other_members: {
    en: 'No other workspace members.',
    nl: 'Geen andere werkruimteleden.',
    es: 'No hay otros miembros del espacio.', // MT
    pt: 'Nenhum outro membro do espaço.', // MT
    de: 'Keine anderen Workspace-Mitglieder.', // MT
    fr: 'Aucun autre membre de l’espace.', // MT
  },
  // ── certificate builder ───────────────────────────────────────────────
  all_templates: {
    en: 'All templates',
    nl: 'Alle sjablonen',
    es: 'Todas las plantillas', // MT
    pt: 'Todos os modelos', // MT
    de: 'Alle Vorlagen', // MT
    fr: 'Tous les modèles', // MT
  },
  page_size: {
    en: 'Page size',
    nl: 'Paginaformaat',
    es: 'Tamaño de página', // MT
    pt: 'Tamanho da página', // MT
    de: 'Seitenformat', // MT
    fr: 'Format de page', // MT
  },
  owning_team: {
    en: 'Owning team',
    nl: 'Eigenaarsteam',
    es: 'Equipo propietario', // MT
    pt: 'Equipe proprietária', // MT
    de: 'Besitzendes Team', // MT
    fr: 'Équipe propriétaire', // MT
  },
  share_ellipsis: {
    en: 'Share…',
    nl: 'Delen…',
    es: 'Compartir…', // MT
    pt: 'Compartilhar…', // MT
    de: 'Teilen…', // MT
    fr: 'Partager…', // MT
  },
  save_failed: {
    en: 'Save failed',
    nl: 'Opslaan mislukt',
    es: 'Error al guardar', // MT
    pt: 'Falha ao salvar', // MT
    de: 'Speichern fehlgeschlagen', // MT
    fr: 'Échec de l’enregistrement', // MT
  },
  saved_word: {
    en: 'Saved',
    nl: 'Opgeslagen',
    es: 'Guardado', // MT
    pt: 'Salvo', // MT
    de: 'Gespeichert', // MT
    fr: 'Enregistré', // MT
  },
  restore: {
    en: 'Restore',
    nl: 'Herstellen',
    es: 'Restaurar', // MT
    pt: 'Restaurar', // MT
    de: 'Wiederherstellen', // MT
    fr: 'Restaurer', // MT
  },
  archive: {
    en: 'Archive',
    nl: 'Archiveren',
    es: 'Archivar', // MT
    pt: 'Arquivar', // MT
    de: 'Archivieren', // MT
    fr: 'Archiver', // MT
  },
  restore_tooltip: {
    en: 'Restore — show it in template pickers again',
    nl: 'Herstellen — toon het weer in sjabloonkiezers',
    es: 'Restaurar — vuelve a aparecer en los selectores de plantilla', // MT
    pt: 'Restaurar — volta a aparecer nos seletores de modelo', // MT
    de: 'Wiederherstellen — wieder in Vorlagen-Auswahlen zeigen', // MT
    fr: 'Restaurer — le réafficher dans les sélecteurs de modèles', // MT
  },
  archive_tooltip: {
    en: 'Archive — keep issued certificates and thread references, hide from pickers',
    nl: 'Archiveren — uitgereikte certificaten en threadverwijzingen blijven, verborgen in kiezers',
    es: 'Archivar — conserva certificados emitidos y referencias, se oculta de los selectores', // MT
    pt: 'Arquivar — mantém certificados emitidos e referências, some dos seletores', // MT
    de: 'Archivieren — ausgestellte Zertifikate und Thread-Verweise bleiben, aus Auswahlen ausgeblendet', // MT
    fr: 'Archiver — conserve les certificats émis et les références, masqué des sélecteurs', // MT
  },
  delete_template_tooltip: {
    en: 'Delete template (templates in use can only be archived)',
    nl: 'Sjabloon verwijderen (sjablonen in gebruik kunnen alleen worden gearchiveerd)',
    es: 'Eliminar plantilla (las que están en uso solo se pueden archivar)', // MT
    pt: 'Excluir modelo (modelos em uso só podem ser arquivados)', // MT
    de: 'Vorlage löschen (genutzte Vorlagen können nur archiviert werden)', // MT
    fr: 'Supprimer le modèle (les modèles utilisés ne peuvent qu’être archivés)', // MT
  },
  font: {
    en: 'Font',
    nl: 'Lettertype',
    es: 'Fuente', // MT
    pt: 'Fonte', // MT
    de: 'Schrift', // MT
    fr: 'Police', // MT
  },
  size: {
    en: 'Size',
    nl: 'Grootte',
    es: 'Tamaño', // MT
    pt: 'Tamanho', // MT
    de: 'Größe', // MT
    fr: 'Taille', // MT
  },
  position: {
    en: 'Position',
    nl: 'Positie',
    es: 'Posición', // MT
    pt: 'Posição', // MT
    de: 'Position', // MT
    fr: 'Position', // MT
  },
  measure_from: {
    en: 'Measure from this point of the page',
    nl: 'Meet vanaf dit punt van de pagina',
    es: 'Medir desde este punto de la página', // MT
    pt: 'Medir a partir deste ponto da página', // MT
    de: 'Von diesem Punkt der Seite aus messen', // MT
    fr: 'Mesurer depuis ce point de la page', // MT
  },
  width: {
    en: 'Width',
    nl: 'Breedte',
    es: 'Ancho', // MT
    pt: 'Largura', // MT
    de: 'Breite', // MT
    fr: 'Largeur', // MT
  },
  scale: {
    en: 'Scale',
    nl: 'Schaal',
    es: 'Escala', // MT
    pt: 'Escala', // MT
    de: 'Skalierung', // MT
    fr: 'Échelle', // MT
  },
  align_left: {
    en: 'Align left',
    nl: 'Links uitlijnen',
    es: 'Alinear a la izquierda', // MT
    pt: 'Alinhar à esquerda', // MT
    de: 'Linksbündig', // MT
    fr: 'Aligner à gauche', // MT
  },
  align_center: {
    en: 'Align center',
    nl: 'Centreren',
    es: 'Centrar', // MT
    pt: 'Centralizar', // MT
    de: 'Zentrieren', // MT
    fr: 'Centrer', // MT
  },
  align_right: {
    en: 'Align right',
    nl: 'Rechts uitlijnen',
    es: 'Alinear a la derecha', // MT
    pt: 'Alinhar à direita', // MT
    de: 'Rechtsbündig', // MT
    fr: 'Aligner à droite', // MT
  },
  colour: {
    en: 'Colour',
    nl: 'Kleur',
    es: 'Color', // MT
    pt: 'Cor', // MT
    de: 'Farbe', // MT
    fr: 'Couleur', // MT
  },
  opacity: {
    en: 'Opacity',
    nl: 'Dekking',
    es: 'Opacidad', // MT
    pt: 'Opacidade', // MT
    de: 'Deckkraft', // MT
    fr: 'Opacité', // MT
  },
  dbl_click_insert: {
    en: 'Double-click to edit · insert',
    nl: 'Dubbelklik om te bewerken · invoegen',
    es: 'Doble clic para editar · insertar', // MT
    pt: 'Clique duplo para editar · inserir', // MT
    de: 'Doppelklick zum Bearbeiten · einfügen', // MT
    fr: 'Double-clic pour modifier · insérer', // MT
  },
  token_placeholder: {
    en: 'token…',
    nl: 'token…',
    es: 'variable…', // MT
    pt: 'variável…', // MT
    de: 'Platzhalter…', // MT
    fr: 'jeton…', // MT
  },
  insert_token_tooltip: {
    en: 'Insert a token — it becomes the real value on the issued certificate',
    nl: 'Voeg een token in — die wordt de echte waarde op het uitgereikte certificaat',
    es: 'Inserta una variable — se convierte en el valor real en el certificado emitido', // MT
    pt: 'Insira uma variável — ela vira o valor real no certificado emitido', // MT
    de: 'Füge einen Platzhalter ein — er wird zum echten Wert auf dem ausgestellten Zertifikat', // MT
    fr: 'Insère un jeton — il devient la vraie valeur sur le certificat émis', // MT
  },
  arrange: {
    en: 'Arrange',
    nl: 'Ordenen',
    es: 'Organizar', // MT
    pt: 'Organizar', // MT
    de: 'Anordnen', // MT
    fr: 'Disposer', // MT
  },
  send_to_back: {
    en: 'Send to back',
    nl: 'Naar achtergrond',
    es: 'Enviar al fondo', // MT
    pt: 'Enviar para trás', // MT
    de: 'In den Hintergrund', // MT
    fr: 'Mettre à l’arrière-plan', // MT
  },
  move_backward: {
    en: 'Move backward',
    nl: 'Naar achteren',
    es: 'Mover atrás', // MT
    pt: 'Mover para trás', // MT
    de: 'Nach hinten', // MT
    fr: 'Reculer', // MT
  },
  move_forward: {
    en: 'Move forward',
    nl: 'Naar voren',
    es: 'Mover adelante', // MT
    pt: 'Mover para a frente', // MT
    de: 'Nach vorn', // MT
    fr: 'Avancer', // MT
  },
  bring_to_front: {
    en: 'Bring to front',
    nl: 'Naar voorgrond',
    es: 'Traer al frente', // MT
    pt: 'Trazer para a frente', // MT
    de: 'In den Vordergrund', // MT
    fr: 'Mettre au premier plan', // MT
  },
  select_element_hint: {
    en: 'Select an element to edit its style',
    nl: 'Selecteer een element om de stijl te bewerken',
    es: 'Selecciona un elemento para editar su estilo', // MT
    pt: 'Selecione um elemento para editar o estilo', // MT
    de: 'Wähle ein Element, um seinen Stil zu bearbeiten', // MT
    fr: 'Sélectionne un élément pour modifier son style', // MT
  },
  fields_label: {
    en: 'Fields',
    nl: 'Velden',
    es: 'Campos', // MT
    pt: 'Campos', // MT
    de: 'Felder', // MT
    fr: 'Champs', // MT
  },
  guides: {
    en: 'Guides',
    nl: 'Hulplijnen',
    es: 'Guías', // MT
    pt: 'Guias', // MT
    de: 'Hilfslinien', // MT
    fr: 'Repères', // MT
  },
  guides_note: {
    en: "Drag off a ruler to lay one. Elements snap to guides and to the page's edges and centre; hold Alt to place freely.",
    nl: 'Sleep vanaf een liniaal om er een te leggen. Elementen klikken vast aan hulplijnen en aan de randen en het midden van de pagina; houd Alt ingedrukt om vrij te plaatsen.',
    es: 'Arrastra desde una regla para colocar una. Los elementos se ajustan a las guías y a los bordes y centro de la página; mantén Alt para colocar libremente.', // MT
    pt: 'Arraste a partir de uma régua para criar uma. Os elementos se alinham às guias e às bordas e centro da página; segure Alt para posicionar livremente.', // MT
    de: 'Ziehe von einem Lineal, um eine zu legen. Elemente rasten an Hilfslinien und an Rändern und Mitte der Seite ein; halte Alt für freies Platzieren.', // MT
    fr: 'Fais glisser depuis une règle pour en poser un. Les éléments s’aimantent aux repères et aux bords et centre de la page ; maintiens Alt pour placer librement.', // MT
  },
  snap_to_guides: {
    en: 'Snap to guides',
    nl: 'Vastklikken aan hulplijnen',
    es: 'Ajustar a las guías', // MT
    pt: 'Alinhar às guias', // MT
    de: 'An Hilfslinien einrasten', // MT
    fr: 'Aimanter aux repères', // MT
  },
  clear_n_guides: {
    en: 'Clear {n} guide(s)',
    nl: '{n} hulplijn(en) wissen',
    es: 'Borrar {n} guía(s)', // MT
    pt: 'Limpar {n} guia(s)', // MT
    de: '{n} Hilfslinie(n) löschen', // MT
    fr: 'Effacer {n} repère(s)', // MT
  },
  tokens: {
    en: 'Tokens',
    nl: 'Tokens',
    es: 'Variables', // MT
    pt: 'Variáveis', // MT
    de: 'Platzhalter', // MT
    fr: 'Jetons', // MT
  },
  tokens_note: {
    en: 'Type these into any text element — they become the real value on each issued certificate.',
    nl: 'Typ deze in elk tekstelement — ze worden de echte waarde op elk uitgereikt certificaat.',
    es: 'Escríbelas en cualquier elemento de texto — se convierten en el valor real en cada certificado emitido.', // MT
    pt: 'Digite-as em qualquer elemento de texto — elas viram o valor real em cada certificado emitido.', // MT
    de: 'Tippe sie in ein Textelement — sie werden auf jedem ausgestellten Zertifikat zum echten Wert.', // MT
    fr: 'Tape-les dans n’importe quel élément de texte — ils deviennent la vraie valeur sur chaque certificat émis.', // MT
  },
  insert_token_sel: {
    en: 'Insert {token} into the selected text',
    nl: 'Voeg {token} in de geselecteerde tekst in',
    es: 'Insertar {token} en el texto seleccionado', // MT
    pt: 'Inserir {token} no texto selecionado', // MT
    de: '{token} in den ausgewählten Text einfügen', // MT
    fr: 'Insérer {token} dans le texte sélectionné', // MT
  },
  select_text_first: {
    en: 'Select a text element to insert this',
    nl: 'Selecteer een tekstelement om dit in te voegen',
    es: 'Selecciona un elemento de texto para insertarlo', // MT
    pt: 'Selecione um elemento de texto para inserir isto', // MT
    de: 'Wähle ein Textelement, um dies einzufügen', // MT
    fr: 'Sélectionne un élément de texte pour l’insérer', // MT
  },
  elements_label: {
    en: 'Elements',
    nl: 'Elementen',
    es: 'Elementos', // MT
    pt: 'Elementos', // MT
    de: 'Elemente', // MT
    fr: 'Éléments', // MT
  },
  line: {
    en: 'Line',
    nl: 'Lijn',
    es: 'Línea', // MT
    pt: 'Linha', // MT
    de: 'Linie', // MT
    fr: 'Ligne', // MT
  },
  qr_code: {
    en: 'QR code',
    nl: 'QR-code',
    es: 'Código QR', // MT
    pt: 'Código QR', // MT
    de: 'QR-Code', // MT
    fr: 'Code QR', // MT
  },
  qr_tooltip: {
    en: "A QR code linking to this certificate's own verification page",
    nl: 'Een QR-code die naar de verificatiepagina van dit certificaat linkt',
    es: 'Un código QR que enlaza a la página de verificación de este certificado', // MT
    pt: 'Um código QR que leva à página de verificação deste certificado', // MT
    de: 'Ein QR-Code, der zur Verifizierungsseite dieses Zertifikats führt', // MT
    fr: 'Un code QR menant à la page de vérification de ce certificat', // MT
  },
  background: {
    en: 'Background',
    nl: 'Achtergrond',
    es: 'Fondo', // MT
    pt: 'Fundo', // MT
    de: 'Hintergrund', // MT
    fr: 'Arrière-plan', // MT
  },
  upload_background: {
    en: 'Upload background',
    nl: 'Achtergrond uploaden',
    es: 'Subir fondo', // MT
    pt: 'Enviar fundo', // MT
    de: 'Hintergrund hochladen', // MT
    fr: 'Téléverser un arrière-plan', // MT
  },
  bg_hint: {
    en: 'Fills the page as a cover background.',
    nl: 'Vult de pagina als dekkende achtergrond.',
    es: 'Rellena la página como fondo de cubierta.', // MT
    pt: 'Preenche a página como fundo de capa.', // MT
    de: 'Füllt die Seite als deckender Hintergrund.', // MT
    fr: 'Remplit la page comme arrière-plan de couverture.', // MT
  },
  select_then_upload: {
    en: 'Select, then upload an image',
    nl: 'Selecteer en upload dan een afbeelding',
    es: 'Selecciona y luego sube una imagen', // MT
    pt: 'Selecione e depois envie uma imagem', // MT
    de: 'Auswählen, dann ein Bild hochladen', // MT
    fr: 'Sélectionne, puis téléverse une image', // MT
  },
  qr_verification: {
    en: 'QR · verification page',
    nl: 'QR · verificatiepagina',
    es: 'QR · página de verificación', // MT
    pt: 'QR · página de verificação', // MT
    de: 'QR · Verifizierungsseite', // MT
    fr: 'QR · page de vérification', // MT
  },
  drag_down_guide: {
    en: 'Drag down for a horizontal guide',
    nl: 'Sleep omlaag voor een horizontale hulplijn',
    es: 'Arrastra hacia abajo para una guía horizontal', // MT
    pt: 'Arraste para baixo para uma guia horizontal', // MT
    de: 'Nach unten ziehen für eine horizontale Hilfslinie', // MT
    fr: 'Fais glisser vers le bas pour un repère horizontal', // MT
  },
  drag_right_guide: {
    en: 'Drag right for a vertical guide',
    nl: 'Sleep opzij voor een verticale hulplijn',
    es: 'Arrastra a la derecha para una guía vertical', // MT
    pt: 'Arraste para a direita para uma guia vertical', // MT
    de: 'Nach rechts ziehen für eine vertikale Hilfslinie', // MT
    fr: 'Fais glisser vers la droite pour un repère vertical', // MT
  },
  guide_move_tooltip: {
    en: 'Drag to move · drop on the ruler to remove',
    nl: 'Sleep om te verplaatsen · laat los op de liniaal om te verwijderen',
    es: 'Arrastra para mover · suéltala en la regla para quitarla', // MT
    pt: 'Arraste para mover · solte na régua para remover', // MT
    de: 'Ziehen zum Verschieben · auf dem Lineal ablegen zum Entfernen', // MT
    fr: 'Glisse pour déplacer · dépose sur la règle pour retirer', // MT
  },
  remove_element_tooltip: {
    en: 'Remove this element (or press Delete)',
    nl: 'Verwijder dit element (of druk op Delete)',
    es: 'Quita este elemento (o pulsa Supr)', // MT
    pt: 'Remova este elemento (ou pressione Delete)', // MT
    de: 'Dieses Element entfernen (oder Entf drücken)', // MT
    fr: 'Retire cet élément (ou appuie sur Suppr)', // MT
  },
  remove_element_aria: {
    en: 'Remove this element',
    nl: 'Verwijder dit element',
    es: 'Quitar este elemento', // MT
    pt: 'Remover este elemento', // MT
    de: 'Dieses Element entfernen', // MT
    fr: 'Retirer cet élément', // MT
  },
  delete_cert_template_msg: {
    en: 'Delete “{name}”? Threads that reference it will lose their certificate design.',
    nl: '“{name}” verwijderen? Threads die ernaar verwijzen raken hun certificaatontwerp kwijt.',
    es: '¿Eliminar «{name}»? Los threads que la referencian perderán su diseño de certificado.', // MT
    pt: 'Excluir “{name}”? Os threads que o referenciam perderão o design do certificado.', // MT
    de: '„{name}“ löschen? Threads, die darauf verweisen, verlieren ihr Zertifikatdesign.', // MT
    fr: 'Supprimer « {name} » ? Les threads qui y font référence perdront leur design de certificat.', // MT
  },
  this_template: {
    en: 'this template',
    nl: 'dit sjabloon',
    es: 'esta plantilla', // MT
    pt: 'este modelo', // MT
    de: 'diese Vorlage', // MT
    fr: 'ce modèle', // MT
  },
  // ── embeds settings + generator ───────────────────────────────────────
  embeds_page_desc: {
    en: 'Show your threads and take enrolments on any website — auto-sizing, no code beyond copy-paste.',
    nl: 'Toon je threads en ontvang inschrijvingen op elke website — automatisch passend, geen code behalve knippen en plakken.',
    es: 'Muestra tus threads y recibe inscripciones en cualquier web — tamaño automático, sin más código que copiar y pegar.', // MT
    pt: 'Mostre seus threads e receba inscrições em qualquer site — tamanho automático, sem código além de copiar e colar.', // MT
    de: 'Zeige deine Threads und nimm Anmeldungen auf jeder Website an — automatische Größe, kein Code außer Copy-paste.', // MT
    fr: 'Affiche tes threads et reçois des inscriptions sur n’importe quel site — taille automatique, aucun code au-delà du copier-coller.', // MT
  },
  embeds_dev_note_1: {
    en: 'Building something custom instead? The read API behind these widgets is public and documented at',
    nl: 'Bouw je liever iets eigens? De lees-API achter deze widgets is openbaar en gedocumenteerd op',
    es: '¿Prefieres construir algo a medida? La API de lectura detrás de estos widgets es pública y está documentada en', // MT
    pt: 'Prefere construir algo próprio? A API de leitura por trás desses widgets é pública e documentada em', // MT
    de: 'Baust du lieber etwas Eigenes? Die Lese-API hinter diesen Widgets ist öffentlich und dokumentiert unter', // MT
    fr: 'Tu préfères construire du sur-mesure ? L’API de lecture derrière ces widgets est publique et documentée sur', // MT
  },
  snippet_1_title: {
    en: '1 · Load the script once',
    nl: '1 · Laad het script één keer',
    es: '1 · Carga el script una vez', // MT
    pt: '1 · Carregue o script uma vez', // MT
    de: '1 · Lade das Skript einmal', // MT
    fr: '1 · Charge le script une fois', // MT
  },
  snippet_1_desc: {
    en: 'Paste in your site’s <head> (Webflow: Site settings → Custom code).',
    nl: 'Plak in de <head> van je site (Webflow: Site settings → Custom code).',
    es: 'Pégalo en el <head> de tu web (Webflow: Site settings → Custom code).', // MT
    pt: 'Cole no <head> do seu site (Webflow: Site settings → Custom code).', // MT
    de: 'Füge es in den <head> deiner Website ein (Webflow: Site settings → Custom code).', // MT
    fr: 'Colle-le dans le <head> de ton site (Webflow : Site settings → Custom code).', // MT
  },
  snippet_2_title: {
    en: '2 · Overview of your threads',
    nl: '2 · Overzicht van je threads',
    es: '2 · Resumen de tus threads', // MT
    pt: '2 · Visão geral dos seus threads', // MT
    de: '2 · Übersicht deiner Threads', // MT
    fr: '2 · Aperçu de tes threads', // MT
  },
  snippet_2_desc: {
    en: 'Lists your public threads. Swap data-organiser for data-team="<team-uuid>", data-org="<org-uuid>" or data-workspace="<workspace-uuid>" (everyone’s public threads).',
    nl: 'Toont je openbare threads. Vervang data-organiser door data-team="<team-uuid>", data-org="<org-uuid>" of data-workspace="<workspace-uuid>" (ieders openbare threads).',
    es: 'Lista tus threads públicos. Cambia data-organiser por data-team="<team-uuid>", data-org="<org-uuid>" o data-workspace="<workspace-uuid>" (los threads públicos de todos).', // MT
    pt: 'Lista seus threads públicos. Troque data-organiser por data-team="<team-uuid>", data-org="<org-uuid>" ou data-workspace="<workspace-uuid>" (threads públicos de todos).', // MT
    de: 'Listet deine öffentlichen Threads. Ersetze data-organiser durch data-team="<team-uuid>", data-org="<org-uuid>" oder data-workspace="<workspace-uuid>" (alle öffentlichen Threads).', // MT
    fr: 'Liste tes threads publics. Remplace data-organiser par data-team="<team-uuid>", data-org="<org-uuid>" ou data-workspace="<workspace-uuid>" (les threads publics de tous).', // MT
  },
  snippet_3_title: {
    en: '3 · One thread, chosen elements',
    nl: '3 · Eén thread, gekozen elementen',
    es: '3 · Un thread, elementos elegidos', // MT
    pt: '3 · Um thread, elementos escolhidos', // MT
    de: '3 · Ein Thread, gewählte Elemente', // MT
    fr: '3 · Un thread, éléments choisis', // MT
  },
  snippet_3_desc: {
    en: 'Pick the sections: cover, intention, agenda, price, enrol.',
    nl: 'Kies de secties: cover, intention, agenda, price, enrol.',
    es: 'Elige las secciones: cover, intention, agenda, price, enrol.', // MT
    pt: 'Escolha as seções: cover, intention, agenda, price, enrol.', // MT
    de: 'Wähle die Abschnitte: cover, intention, agenda, price, enrol.', // MT
    fr: 'Choisis les sections : cover, intention, agenda, price, enrol.', // MT
  },
  snippet_4_title: {
    en: '4 · Enrolment popup from any button',
    nl: '4 · Inschrijfpopup vanaf elke knop',
    es: '4 · Popup de inscripción desde cualquier botón', // MT
    pt: '4 · Popup de inscrição a partir de qualquer botão', // MT
    de: '4 · Anmelde-Popup von jedem Button', // MT
    fr: '4 · Popup d’inscription depuis n’importe quel bouton', // MT
  },
  snippet_4_desc: {
    en: 'Opens the subscription form in an overlay — Luma style.',
    nl: 'Opent het inschrijfformulier in een overlay — Luma-stijl.',
    es: 'Abre el formulario de inscripción en una superposición — estilo Luma.', // MT
    pt: 'Abre o formulário de inscrição em uma sobreposição — estilo Luma.', // MT
    de: 'Öffnet das Anmeldeformular als Overlay — im Luma-Stil.', // MT
    fr: 'Ouvre le formulaire d’inscription en surimpression — style Luma.', // MT
  },
  embeds_lang_label: {
    en: 'Language (data-lang)',
    nl: 'Taal (data-lang)',
    es: 'Idioma (data-lang)', // MT
    pt: 'Idioma (data-lang)', // MT
    de: 'Sprache (data-lang)', // MT
    fr: 'Langue (data-lang)', // MT
  },
  embeds_lang_1: {
    en: 'Add',
    nl: 'Voeg',
    es: 'Añade', // MT
    pt: 'Adicione', // MT
    de: 'Füge', // MT
    fr: 'Ajoute', // MT
  },
  embeds_lang_2: {
    en: 'to any embed to force the language of the embedded UI (labels, buttons, enrol form). Supported:',
    nl: 'toe aan elke embed om de taal van de embedded UI te forceren (labels, knoppen, inschrijfformulier). Ondersteund:',
    es: 'a cualquier embed para forzar el idioma de la interfaz incrustada (etiquetas, botones, formulario). Idiomas:', // MT
    pt: 'a qualquer embed para forçar o idioma da interface incorporada (rótulos, botões, formulário). Suportados:', // MT
    de: 'zu jedem Embed hinzu, um die Sprache der eingebetteten UI zu erzwingen (Labels, Buttons, Anmeldeformular). Unterstützt:', // MT
    fr: 'à n’importe quelle intégration pour forcer la langue de l’interface intégrée (libellés, boutons, formulaire). Prises en charge :', // MT
  },
  embeds_lang_3: {
    en: '. Without it, the thread embed and the enrol popup use the thread’s own language; the list falls back to English for its chrome while each item’s button and popup still follow that thread’s language.',
    nl: '. Zonder gebruiken de thread-embed en de inschrijfpopup de eigen taal van de thread; het overzicht valt voor zijn kader terug op Engels terwijl knop en popup van elk item de taal van die thread blijven volgen.',
    es: '. Sin él, el embed del thread y el popup usan el idioma del propio thread; la lista recurre al inglés para su marco mientras el botón y el popup de cada elemento siguen el idioma de ese thread.', // MT
    pt: '. Sem ele, o embed do thread e o popup usam o idioma do próprio thread; a lista usa inglês no seu contorno enquanto o botão e o popup de cada item seguem o idioma daquele thread.', // MT
    de: '. Ohne nutzen Thread-Embed und Anmelde-Popup die eigene Sprache des Threads; die Liste fällt für ihren Rahmen auf Englisch zurück, während Button und Popup jedes Eintrags der Sprache des Threads folgen.', // MT
    fr: '. Sans lui, l’intégration du thread et le popup utilisent la langue du thread ; la liste retombe sur l’anglais pour son cadre tandis que le bouton et le popup de chaque élément suivent la langue de ce thread.', // MT
  },
  embeds_popup_note: {
    en: 'In the embedded list, threads whose public interaction is set to “popup” open the enrolment overlay right on your site; threads set to “page” link out to their public page.',
    nl: 'In het embedded overzicht openen threads met interactie “popup” de inschrijfoverlay direct op je site; threads op “page” linken naar hun openbare pagina.',
    es: 'En la lista incrustada, los threads con interacción «popup» abren la superposición de inscripción en tu web; los de «page» enlazan a su página pública.', // MT
    pt: 'Na lista incorporada, threads com interação “popup” abrem a sobreposição de inscrição no seu site; os com “page” levam à página pública.', // MT
    de: 'In der eingebetteten Liste öffnen Threads mit Interaktion „popup“ das Anmelde-Overlay direkt auf deiner Site; Threads auf „page“ verlinken auf ihre öffentliche Seite.', // MT
    fr: 'Dans la liste intégrée, les threads dont l’interaction est « popup » ouvrent la superposition d’inscription sur ton site ; ceux réglés sur « page » renvoient vers leur page publique.', // MT
  },
  code_generator: {
    en: 'Code generator',
    nl: 'Codegenerator',
    es: 'Generador de código', // MT
    pt: 'Gerador de código', // MT
    de: 'Code-Generator', // MT
    fr: 'Générateur de code', // MT
  },
  code_generator_desc: {
    en: 'Pick what you want on your website — the code builds itself below.',
    nl: 'Kies wat je op je website wilt — de code bouwt zichzelf hieronder.',
    es: 'Elige lo que quieres en tu web — el código se construye solo abajo.', // MT
    pt: 'Escolha o que quer no seu site — o código se monta sozinho abaixo.', // MT
    de: 'Wähle, was du auf deiner Website willst — der Code baut sich unten von selbst.', // MT
    fr: 'Choisis ce que tu veux sur ton site — le code se construit tout seul en dessous.', // MT
  },
  what_embed: {
    en: 'What do you want to embed?',
    nl: 'Wat wil je embedden?',
    es: '¿Qué quieres incrustar?', // MT
    pt: 'O que você quer incorporar?', // MT
    de: 'Was möchtest du einbetten?', // MT
    fr: 'Que veux-tu intégrer ?', // MT
  },
  gen_thread_list: {
    en: 'Thread list',
    nl: 'Threadoverzicht',
    es: 'Lista de threads', // MT
    pt: 'Lista de threads', // MT
    de: 'Thread-Liste', // MT
    fr: 'Liste de threads', // MT
  },
  gen_one_thread: {
    en: 'One thread',
    nl: 'Eén thread',
    es: 'Un thread', // MT
    pt: 'Um thread', // MT
    de: 'Ein Thread', // MT
    fr: 'Un thread', // MT
  },
  gen_card: {
    en: 'Card',
    nl: 'Kaart',
    es: 'Tarjeta', // MT
    pt: 'Cartão', // MT
    de: 'Karte', // MT
    fr: 'Carte', // MT
  },
  gen_card_form: {
    en: 'Card + form',
    nl: 'Kaart + formulier',
    es: 'Tarjeta + formulario', // MT
    pt: 'Cartão + formulário', // MT
    de: 'Karte + Formular', // MT
    fr: 'Carte + formulaire', // MT
  },
  gen_enrol_button: {
    en: 'Enrol button',
    nl: 'Inschrijfknop',
    es: 'Botón de inscripción', // MT
    pt: 'Botão de inscrição', // MT
    de: 'Anmelde-Button', // MT
    fr: 'Bouton d’inscription', // MT
  },
  which_threads: {
    en: 'Which threads',
    nl: 'Welke threads',
    es: 'Qué threads', // MT
    pt: 'Quais threads', // MT
    de: 'Welche Threads', // MT
    fr: 'Quels threads', // MT
  },
  all_my_public: {
    en: 'All my public threads',
    nl: 'Al mijn openbare threads',
    es: 'Todos mis threads públicos', // MT
    pt: 'Todos os meus threads públicos', // MT
    de: 'Alle meine öffentlichen Threads', // MT
    fr: 'Tous mes threads publics', // MT
  },
  whole_ws_public: {
    en: "Whole workspace — everyone's public threads",
    nl: 'Hele werkruimte — ieders openbare threads',
    es: 'Todo el espacio — los threads públicos de todos', // MT
    pt: 'Todo o espaço — os threads públicos de todos', // MT
    de: 'Gesamter Workspace — alle öffentlichen Threads', // MT
    fr: 'Tout l’espace — les threads publics de tous', // MT
  },
  events_and_journeys: {
    en: 'Events and journeys',
    nl: 'Evenementen en reizen',
    es: 'Eventos y recorridos', // MT
    pt: 'Eventos e jornadas', // MT
    de: 'Veranstaltungen und Journeys', // MT
    fr: 'Événements et parcours', // MT
  },
  events_only: {
    en: 'Events only',
    nl: 'Alleen evenementen',
    es: 'Solo eventos', // MT
    pt: 'Só eventos', // MT
    de: 'Nur Veranstaltungen', // MT
    fr: 'Événements uniquement', // MT
  },
  journeys_only: {
    en: 'Journeys only',
    nl: 'Alleen reizen',
    es: 'Solo recorridos', // MT
    pt: 'Só jornadas', // MT
    de: 'Nur Journeys', // MT
    fr: 'Parcours uniquement', // MT
  },
  category: {
    en: 'Category',
    nl: 'Categorie',
    es: 'Categoría', // MT
    pt: 'Categoria', // MT
    de: 'Kategorie', // MT
    fr: 'Catégorie', // MT
  },
  all_categories: {
    en: 'All categories',
    nl: 'Alle categorieën',
    es: 'Todas las categorías', // MT
    pt: 'Todas as categorias', // MT
    de: 'Alle Kategorien', // MT
    fr: 'Toutes les catégories', // MT
  },
  pick_thread: {
    en: 'Pick a thread…',
    nl: 'Kies een thread…',
    es: 'Elige un thread…', // MT
    pt: 'Escolha um thread…', // MT
    de: 'Wähle einen Thread…', // MT
    fr: 'Choisis un thread…', // MT
  },
  search_threads: {
    en: 'Search threads…',
    nl: 'Zoek threads…',
    es: 'Buscar threads…', // MT
    pt: 'Pesquisar threads…', // MT
    de: 'Threads suchen…', // MT
    fr: 'Rechercher des threads…', // MT
  },
  sections_to_show: {
    en: 'Sections to show',
    nl: 'Secties om te tonen',
    es: 'Secciones a mostrar', // MT
    pt: 'Seções a mostrar', // MT
    de: 'Anzuzeigende Abschnitte', // MT
    fr: 'Sections à afficher', // MT
  },
  el_cover: {
    en: 'Cover image',
    nl: 'Coverafbeelding',
    es: 'Imagen de portada', // MT
    pt: 'Imagem de capa', // MT
    de: 'Cover-Bild', // MT
    fr: 'Image de couverture', // MT
  },
  agenda: {
    en: 'Agenda',
    nl: 'Programma',
    es: 'Agenda', // MT
    pt: 'Programação', // MT
    de: 'Programm', // MT
    fr: 'Programme', // MT
  },
  enrol_form: {
    en: 'Enrol form',
    nl: 'Inschrijfformulier',
    es: 'Formulario de inscripción', // MT
    pt: 'Formulário de inscrição', // MT
    de: 'Anmeldeformular', // MT
    fr: 'Formulaire d’inscription', // MT
  },
  include_css: {
    en: 'Include the starter stylesheet — every element listed with its default look, ready to change. Only affects the embed, never your page.',
    nl: 'Voeg de starter-stylesheet toe — elk element met zijn standaardstijl, klaar om aan te passen. Raakt alleen de embed, nooit je pagina.',
    es: 'Incluye la hoja de estilos inicial — cada elemento con su aspecto por defecto, listo para cambiar. Solo afecta al embed, nunca a tu página.', // MT
    pt: 'Inclua a folha de estilos inicial — cada elemento com o visual padrão, pronto para mudar. Afeta só o embed, nunca sua página.', // MT
    de: 'Füge das Starter-Stylesheet hinzu — jedes Element mit seinem Standardstil, bereit zum Anpassen. Betrifft nur das Embed, nie deine Seite.', // MT
    fr: 'Inclus la feuille de style de départ — chaque élément avec son apparence par défaut, prêt à changer. N’affecte que l’intégration, jamais ta page.', // MT
  },
  unlisted_note: {
    en: "This thread is unlisted — the embed still works (direct link), it just won't appear in list embeds.",
    nl: 'Deze thread is niet gelist — de embed werkt gewoon (directe link), hij verschijnt alleen niet in overzicht-embeds.',
    es: 'Este thread no está listado — el embed funciona igual (enlace directo), solo que no aparecerá en los embeds de lista.', // MT
    pt: 'Este thread não está listado — o embed funciona mesmo assim (link direto), só não aparece nos embeds de lista.', // MT
    de: 'Dieser Thread ist ungelistet — das Embed funktioniert trotzdem (Direktlink), er erscheint nur nicht in Listen-Embeds.', // MT
    fr: 'Ce thread n’est pas listé — l’intégration fonctionne quand même (lien direct), il n’apparaîtra juste pas dans les listes.', // MT
  },
  ticket_other_event: {
    en: 'Ticket for another event',
    nl: 'Ticket voor een ander evenement',
    es: 'Entrada de otro evento', // MT
    pt: 'Ingresso de outro evento', // MT
    de: 'Ticket für eine andere Veranstaltung', // MT
    fr: 'Billet pour un autre événement', // MT
  },
  team_option_prefix: {
    en: 'Team · {name}',
    nl: 'Team · {name}',
    es: 'Equipo · {name}', // MT
    pt: 'Equipe · {name}', // MT
    de: 'Team · {name}', // MT
    fr: 'Équipe · {name}', // MT
  },

  // ── sidebar / bottom-nav (added at NAV translation) ──────────────────
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  nav_threads: {
    en: 'Threads',
    nl: 'Threads',
    es: 'Threads', // MT
    pt: 'Threads', // MT
    de: 'Threads', // MT
    fr: 'Threads', // MT
  },
  nav_enrolments: {
    en: 'Enrolments',
    nl: 'Inschrijvingen',
    es: 'Inscripciones', // MT
    pt: 'Inscrições', // MT
    de: 'Anmeldungen', // MT
    fr: 'Inscriptions', // MT
  },
  nav_invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  nav_templates: {
    en: 'Templates',
    nl: 'Sjablonen',
    es: 'Plantillas', // MT
    pt: 'Modelos', // MT
    de: 'Vorlagen', // MT
    fr: 'Modèles', // MT
  },
  nav_people: {
    en: 'People',
    nl: 'Mensen',
    es: 'Personas', // MT
    pt: 'Pessoas', // MT
    de: 'Personen', // MT
    fr: 'Personnes', // MT
  },
  nav_contacts: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contatos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  nav_teams: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipes', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
  },
  nav_internal_team: {
    en: 'Internal team',
    nl: 'Intern team',
    es: 'Equipo interno', // MT
    pt: 'Equipe interna', // MT
    de: 'Internes Team', // MT
    fr: 'Équipe interne', // MT
  },
  nav_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Configuración', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
} satisfies Record<string, I18nEntry>;

export type UiKey = keyof typeof CATALOG;

/** Translate a signed-in-UI key; {placeholders} substituted from vars. */
export const t = makeT(CATALOG);

const ENROL_STATUS_KEYS: Record<string, UiKey> = {
  invited: 'status_invited',
  enrolled: 'status_enrolled',
  active: 'status_active',
  completed: 'status_completed',
  dropped: 'status_dropped',
};

/** Enrolment status → label in the user's language (unknown values pass through). */
export function enrolStatusLabel(locale: Locale, status: string): string {
  const key = ENROL_STATUS_KEYS[status];
  return key ? t(locale, key) : status;
}

const ENGAGEMENT_TYPES = [
  'event',
  'conversation',
  'workshop',
  'message',
  'reflection',
  'practice',
  'document',
  'inspiration',
] as const;

/** Engagement type → translated label (lib/engagement-meta.ts keeps EN labels). */
export function engagementTypeLabel(locale: Locale, type: string): string {
  return (ENGAGEMENT_TYPES as readonly string[]).includes(type)
    ? t(locale, `et_${type}` as UiKey)
    : type;
}

/** Engagement type → translated description. */
export function engagementTypeDesc(locale: Locale, type: string): string {
  return (ENGAGEMENT_TYPES as readonly string[]).includes(type)
    ? t(locale, `etd_${type}` as UiKey)
    : '';
}
