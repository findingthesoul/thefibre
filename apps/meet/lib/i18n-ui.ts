// Fibre Meet — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string a signed-in user can see (pages, dialogs, forms,
// empty states, toasts, aria-labels) lives HERE, in all locales. The locale
// list itself lives in @thefibre/shared/i18n (one definition for the whole
// platform); the catalog stays per-surface, next to its consumers. The
// catalog is typed so a key missing a translation fails `pnpm typecheck`.
// Default locale: en. Register: informal (je/du/tu/tú/você).
//
// es/pt/de/fr entries are machine-drafted (marked // MT) pending native
// review; nl is native quality.
//
// User CONTENT (meeting-type names, notes, locations, team names) is never
// translated. Technical diagnostics ("API 500: …") stay English.

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
  save: {
    en: 'Save',
    nl: 'Opslaan',
    es: 'Guardar', // MT
    pt: 'Guardar', // MT
    de: 'Speichern', // MT
    fr: 'Enregistrer', // MT
  },
  save_changes: {
    en: 'Save changes',
    nl: 'Wijzigingen opslaan',
    es: 'Guardar cambios', // MT
    pt: 'Guardar alterações', // MT
    de: 'Änderungen speichern', // MT
    fr: 'Enregistrer les modifications', // MT
  },
  saving: {
    en: 'Saving…',
    nl: 'Opslaan…',
    es: 'Guardando…', // MT
    pt: 'A guardar…', // MT
    de: 'Wird gespeichert…', // MT
    fr: 'Enregistrement…', // MT
  },
  saved: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Guardado.', // MT
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
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
  create: {
    en: 'Create',
    nl: 'Aanmaken',
    es: 'Crear', // MT
    pt: 'Criar', // MT
    de: 'Erstellen', // MT
    fr: 'Créer', // MT
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
  loading: {
    en: 'Loading…',
    nl: 'Laden…',
    es: 'Cargando…', // MT
    pt: 'A carregar…', // MT
    de: 'Wird geladen…', // MT
    fr: 'Chargement…', // MT
  },
  working: {
    en: 'Working…',
    nl: 'Bezig…',
    es: 'Procesando…', // MT
    pt: 'A processar…', // MT
    de: 'Wird ausgeführt…', // MT
    fr: 'En cours…', // MT
  },
  couldnt_load: {
    en: 'Couldn’t load: {error}',
    nl: 'Kon niet laden: {error}',
    es: 'No se pudo cargar: {error}', // MT
    pt: 'Não foi possível carregar: {error}', // MT
    de: 'Konnte nicht geladen werden: {error}', // MT
    fr: 'Impossible de charger : {error}', // MT
  },
  could_not_save: {
    en: 'could not save',
    nl: 'kon niet opslaan',
    es: 'no se pudo guardar', // MT
    pt: 'não foi possível guardar', // MT
    de: 'konnte nicht gespeichert werden', // MT
    fr: 'impossible d’enregistrer', // MT
  },
  settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Definições', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  copy_link: {
    en: 'Copy link',
    nl: 'Link kopiëren',
    es: 'Copiar enlace', // MT
    pt: 'Copiar ligação', // MT
    de: 'Link kopieren', // MT
    fr: 'Copier le lien', // MT
  },
  copied: {
    en: 'Copied!',
    nl: 'Gekopieerd!',
    es: '¡Copiado!', // MT
    pt: 'Copiado!', // MT
    de: 'Kopiert!', // MT
    fr: 'Copié !', // MT
  },
  open: {
    en: 'Open',
    nl: 'Openen',
    es: 'Abrir', // MT
    pt: 'Abrir', // MT
    de: 'Öffnen', // MT
    fr: 'Ouvrir', // MT
  },
  hidden: {
    en: 'Hidden',
    nl: 'Verborgen',
    es: 'Oculto', // MT
    pt: 'Oculto', // MT
    de: 'Verborgen', // MT
    fr: 'Masqué', // MT
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
  timezone: {
    en: 'Timezone',
    nl: 'Tijdzone',
    es: 'Zona horaria', // MT
    pt: 'Fuso horário', // MT
    de: 'Zeitzone', // MT
    fr: 'Fuseau horaire', // MT
  },
  location: {
    en: 'Location',
    nl: 'Locatie',
    es: 'Ubicación', // MT
    pt: 'Localização', // MT
    de: 'Ort', // MT
    fr: 'Lieu', // MT
  },
  email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  name_optional: {
    en: 'Name (optional)',
    nl: 'Naam (optioneel)',
    es: 'Nombre (opcional)', // MT
    pt: 'Nome (opcional)', // MT
    de: 'Name (optional)', // MT
    fr: 'Nom (facultatif)', // MT
  },
  personal: {
    en: 'Personal',
    nl: 'Persoonlijk',
    es: 'Personal', // MT
    pt: 'Pessoal', // MT
    de: 'Persönlich', // MT
    fr: 'Personnel', // MT
  },
  team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipa', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  role: {
    en: 'Role',
    nl: 'Rol',
    es: 'Rol', // MT
    pt: 'Função', // MT
    de: 'Rolle', // MT
    fr: 'Rôle', // MT
  },
  status_confirmed: {
    en: 'Confirmed',
    nl: 'Bevestigd',
    es: 'Confirmada', // MT
    pt: 'Confirmada', // MT
    de: 'Bestätigt', // MT
    fr: 'Confirmée', // MT
  },
  status_cancelled: {
    en: 'Cancelled',
    nl: 'Geannuleerd',
    es: 'Cancelada', // MT
    pt: 'Cancelada', // MT
    de: 'Storniert', // MT
    fr: 'Annulée', // MT
  },
  status_pending: {
    en: 'Pending',
    nl: 'In afwachting',
    es: 'Pendiente', // MT
    pt: 'Pendente', // MT
    de: 'Ausstehend', // MT
    fr: 'En attente', // MT
  },
  status_pending_approval: {
    en: 'Pending approval',
    nl: 'Wacht op goedkeuring',
    es: 'Pendiente de aprobación', // MT
    pt: 'Aguarda aprovação', // MT
    de: 'Wartet auf Freigabe', // MT
    fr: 'En attente d’approbation', // MT
  },

  // ── settings index ────────────────────────────────────────────────────
  settings_desc: {
    en: 'You, the workspace, and Meet. The same four sections in every Fibre app.',
    nl: 'Jij, de werkruimte en Meet. Dezelfde vier secties in elke Fibre-app.',
    es: 'Tú, el espacio de trabajo y Meet. Las mismas cuatro secciones en todas las apps de Fibre.', // MT
    pt: 'Você, o espaço de trabalho e o Meet. As mesmas quatro secções em todas as apps Fibre.', // MT
    de: 'Du, der Workspace und Meet. Dieselben vier Bereiche in jeder Fibre-App.', // MT
    fr: 'Toi, l’espace de travail et Meet. Les quatre mêmes sections dans chaque app Fibre.', // MT
  },
  st_booking_page: {
    en: 'Booking page',
    nl: 'Boekingspagina',
    es: 'Página de reservas', // MT
    pt: 'Página de reservas', // MT
    de: 'Buchungsseite', // MT
    fr: 'Page de réservation', // MT
  },
  st_booking_page_desc: {
    en: 'The address people book you at, your location and your personal room.',
    nl: 'Het adres waarop mensen je boeken, je locatie en je persoonlijke room.',
    es: 'La dirección donde te reservan, tu ubicación y tu sala personal.', // MT
    pt: 'O endereço onde as pessoas o reservam, a sua localização e a sua sala pessoal.', // MT
    de: 'Die Adresse, unter der man dich bucht, dein Ort und dein persönlicher Raum.', // MT
    fr: 'L’adresse où l’on te réserve, ton lieu et ta salle personnelle.', // MT
  },
  st_availability: {
    en: 'Availability',
    nl: 'Beschikbaarheid',
    es: 'Disponibilidad', // MT
    pt: 'Disponibilidade', // MT
    de: 'Verfügbarkeit', // MT
    fr: 'Disponibilité', // MT
  },
  st_availability_desc: {
    en: 'Timezone and weekly working hours.',
    nl: 'Tijdzone en wekelijkse werkuren.',
    es: 'Zona horaria y horario laboral semanal.', // MT
    pt: 'Fuso horário e horário de trabalho semanal.', // MT
    de: 'Zeitzone und wöchentliche Arbeitszeiten.', // MT
    fr: 'Fuseau horaire et heures de travail hebdomadaires.', // MT
  },
  st_calendars: {
    en: 'Calendars',
    nl: 'Agenda’s',
    es: 'Calendarios', // MT
    pt: 'Calendários', // MT
    de: 'Kalender', // MT
    fr: 'Calendriers', // MT
  },
  st_calendars_desc: {
    en: 'Which calendars are checked for conflicts, and where bookings land.',
    nl: 'Welke agenda’s op conflicten worden gecheckt en waar boekingen terechtkomen.',
    es: 'Qué calendarios se revisan por conflictos y dónde llegan las reservas.', // MT
    pt: 'Que calendários são verificados quanto a conflitos e onde as reservas chegam.', // MT
    de: 'Welche Kalender auf Konflikte geprüft werden und wo Buchungen landen.', // MT
    fr: 'Quels calendriers sont vérifiés pour les conflits, et où arrivent les réservations.', // MT
  },
  st_integrations: {
    en: 'Integrations',
    nl: 'Integraties',
    es: 'Integraciones', // MT
    pt: 'Integrações', // MT
    de: 'Integrationen', // MT
    fr: 'Intégrations', // MT
  },
  st_integrations_desc: {
    en: 'Video, and the rest of what Meet can talk to.',
    nl: 'Video, en de rest waar Meet mee kan praten.',
    es: 'Vídeo, y el resto de cosas con las que Meet puede hablar.', // MT
    pt: 'Vídeo, e o resto com que o Meet pode falar.', // MT
    de: 'Video und der Rest, mit dem Meet sprechen kann.', // MT
    fr: 'La vidéo, et tout le reste avec quoi Meet peut communiquer.', // MT
  },

  // ── availability ──────────────────────────────────────────────────────
  av_card_title: {
    en: 'Timezone & weekly hours',
    nl: 'Tijdzone & wekelijkse uren',
    es: 'Zona horaria y horario semanal', // MT
    pt: 'Fuso horário e horário semanal', // MT
    de: 'Zeitzone & Wochenstunden', // MT
    fr: 'Fuseau horaire et heures hebdomadaires', // MT
  },
  av_card_desc: {
    en: 'Your bookable windows in your local timezone.',
    nl: 'Je boekbare tijdvakken in je lokale tijdzone.',
    es: 'Tus franjas reservables en tu zona horaria local.', // MT
    pt: 'As suas janelas reserváveis no seu fuso horário local.', // MT
    de: 'Deine buchbaren Zeitfenster in deiner lokalen Zeitzone.', // MT
    fr: 'Tes créneaux réservables dans ton fuseau horaire local.', // MT
  },
  search_timezones: {
    en: 'Search timezones…',
    nl: 'Zoek tijdzones…',
    es: 'Buscar zonas horarias…', // MT
    pt: 'Pesquisar fusos horários…', // MT
    de: 'Zeitzonen suchen…', // MT
    fr: 'Rechercher un fuseau horaire…', // MT
  },

  // ── public page (settings/profile) ────────────────────────────────────
  pp_title: {
    en: 'Public page',
    nl: 'Openbare pagina',
    es: 'Página pública', // MT
    pt: 'Página pública', // MT
    de: 'Öffentliche Seite', // MT
    fr: 'Page publique', // MT
  },
  pp_desc: {
    en: 'Where your booking page lives, and what it shows.',
    nl: 'Waar je boekingspagina staat en wat die laat zien.',
    es: 'Dónde vive tu página de reservas y qué muestra.', // MT
    pt: 'Onde vive a sua página de reservas e o que mostra.', // MT
    de: 'Wo deine Buchungsseite liegt und was sie zeigt.', // MT
    fr: 'Où vit ta page de réservation, et ce qu’elle montre.', // MT
  },
  public_url: {
    en: 'Public URL',
    nl: 'Openbare URL',
    es: 'URL pública', // MT
    pt: 'URL pública', // MT
    de: 'Öffentliche URL', // MT
    fr: 'URL publique', // MT
  },
  pp_url_hint: {
    en: 'Your booking page lives under this address.',
    nl: 'Je boekingspagina staat onder dit adres.',
    es: 'Tu página de reservas vive en esta dirección.', // MT
    pt: 'A sua página de reservas vive neste endereço.', // MT
    de: 'Deine Buchungsseite liegt unter dieser Adresse.', // MT
    fr: 'Ta page de réservation vit sous cette adresse.', // MT
  },
  pp_location_hint: {
    en: 'Shown on your booking page — the one field that is Meet’s own.',
    nl: 'Te zien op je boekingspagina — het ene veld dat van Meet zelf is.',
    es: 'Se muestra en tu página de reservas: el único campo propio de Meet.', // MT
    pt: 'Mostrado na sua página de reservas — o único campo que é do próprio Meet.', // MT
    de: 'Wird auf deiner Buchungsseite gezeigt — das eine Feld, das Meet selbst gehört.', // MT
    fr: 'Affiché sur ta page de réservation — le seul champ qui appartient à Meet.', // MT
  },
  pp_what_it_shows: {
    en: 'What it shows',
    nl: 'Wat de pagina laat zien',
    es: 'Qué muestra', // MT
    pt: 'O que mostra', // MT
    de: 'Was sie zeigt', // MT
    fr: 'Ce qu’elle montre', // MT
  },
  pp_no_bio: {
    en: 'No bio yet.',
    nl: 'Nog geen bio.',
    es: 'Aún sin biografía.', // MT
    pt: 'Ainda sem biografia.', // MT
    de: 'Noch keine Bio.', // MT
    fr: 'Pas encore de bio.', // MT
  },
  pp_edit_in_fibre: {
    en: 'Edit your profile in The Fibre',
    nl: 'Bewerk je profiel in The Fibre',
    es: 'Edita tu perfil en The Fibre', // MT
    pt: 'Edite o seu perfil no The Fibre', // MT
    de: 'Bearbeite dein Profil in The Fibre', // MT
    fr: 'Modifie ton profil dans The Fibre', // MT
  },
  pp_one_profile: {
    en: 'One profile, used by every app — so it is edited in one place.',
    nl: 'Eén profiel, gebruikt door elke app — dus je bewerkt het op één plek.',
    es: 'Un solo perfil, usado por todas las apps, así que se edita en un solo sitio.', // MT
    pt: 'Um perfil, usado por todas as apps — por isso edita-se num único sítio.', // MT
    de: 'Ein Profil, von jeder App genutzt — deshalb wird es an einem Ort bearbeitet.', // MT
    fr: 'Un seul profil, utilisé par toutes les apps — il se modifie donc à un seul endroit.', // MT
  },
  pp_pick_url: {
    en: 'Pick a public URL.',
    nl: 'Kies een openbare URL.',
    es: 'Elige una URL pública.', // MT
    pt: 'Escolha uma URL pública.', // MT
    de: 'Wähle eine öffentliche URL.', // MT
    fr: 'Choisis une URL publique.', // MT
  },

  // ── calendars ─────────────────────────────────────────────────────────
  cal_page_desc: {
    en: 'Pick which Google calendars block availability and where new bookings get created.',
    nl: 'Kies welke Google-agenda’s je beschikbaarheid blokkeren en waar nieuwe boekingen worden aangemaakt.',
    es: 'Elige qué calendarios de Google bloquean tu disponibilidad y dónde se crean las reservas nuevas.', // MT
    pt: 'Escolha que calendários Google bloqueiam a disponibilidade e onde as novas reservas são criadas.', // MT
    de: 'Wähle, welche Google-Kalender Verfügbarkeit blockieren und wo neue Buchungen angelegt werden.', // MT
    fr: 'Choisis quels calendriers Google bloquent ta disponibilité et où les nouvelles réservations sont créées.', // MT
  },
  cal_not_connected: {
    en: 'Google Calendar isn’t connected yet.',
    nl: 'Google Agenda is nog niet gekoppeld.',
    es: 'Google Calendar aún no está conectado.', // MT
    pt: 'O Google Calendar ainda não está ligado.', // MT
    de: 'Google Kalender ist noch nicht verbunden.', // MT
    fr: 'Google Agenda n’est pas encore connecté.', // MT
  },
  cal_connect_first: {
    en: 'Connect it first.',
    nl: 'Koppel hem eerst.',
    es: 'Conéctalo primero.', // MT
    pt: 'Ligue-o primeiro.', // MT
    de: 'Verbinde ihn zuerst.', // MT
    fr: 'Connecte-le d’abord.', // MT
  },
  cal_connected_title: {
    en: 'Connected calendars',
    nl: 'Gekoppelde agenda’s',
    es: 'Calendarios conectados', // MT
    pt: 'Calendários ligados', // MT
    de: 'Verbundene Kalender', // MT
    fr: 'Calendriers connectés', // MT
  },
  cal_connected_desc: {
    en: 'Conflict sources block availability; the write target receives new bookings.',
    nl: 'Conflictbronnen blokkeren beschikbaarheid; het schrijfdoel ontvangt nieuwe boekingen.',
    es: 'Las fuentes de conflicto bloquean disponibilidad; el destino de escritura recibe las reservas nuevas.', // MT
    pt: 'As fontes de conflito bloqueiam a disponibilidade; o destino de escrita recebe as novas reservas.', // MT
    de: 'Konfliktquellen blockieren Verfügbarkeit; das Schreibziel erhält neue Buchungen.', // MT
    fr: 'Les sources de conflit bloquent la disponibilité ; la cible d’écriture reçoit les nouvelles réservations.', // MT
  },
  cal_empty: {
    en: 'No calendars synced yet. Click Re-sync to pull them in from Google.',
    nl: 'Nog geen agenda’s gesynchroniseerd. Klik op Opnieuw synchroniseren om ze uit Google op te halen.',
    es: 'Aún no hay calendarios sincronizados. Pulsa Resincronizar para traerlos de Google.', // MT
    pt: 'Ainda não há calendários sincronizados. Clique em Ressincronizar para os trazer do Google.', // MT
    de: 'Noch keine Kalender synchronisiert. Klicke auf Neu synchronisieren, um sie von Google zu holen.', // MT
    fr: 'Aucun calendrier synchronisé pour l’instant. Clique sur Resynchroniser pour les importer depuis Google.', // MT
  },
  cal_missing_title: {
    en: 'Don’t see a calendar you expected?',
    nl: 'Mis je een agenda die je verwachtte?',
    es: '¿No ves un calendario que esperabas?', // MT
    pt: 'Não vê um calendário que esperava?', // MT
    de: 'Fehlt ein Kalender, den du erwartet hast?', // MT
    fr: 'Un calendrier attendu manque à l’appel ?', // MT
  },
  cal_missing_body: {
    en: 'Meet shows every Google calendar you own or have write access to. Add the calendar inside Google Calendar and disconnect / reconnect the integration to refresh the list.',
    nl: 'Meet toont elke Google-agenda die je bezit of waarop je schrijfrechten hebt. Voeg de agenda toe in Google Agenda en ontkoppel/herkoppel de integratie om de lijst te verversen.',
    es: 'Meet muestra todos los calendarios de Google que posees o donde puedes escribir. Añade el calendario en Google Calendar y desconecta / reconecta la integración para refrescar la lista.', // MT
    pt: 'O Meet mostra todos os calendários Google que possui ou onde pode escrever. Adicione o calendário no Google Calendar e desligue/religue a integração para atualizar a lista.', // MT
    de: 'Meet zeigt jeden Google-Kalender, den du besitzt oder auf den du Schreibzugriff hast. Füge den Kalender in Google Kalender hinzu und trenne/verbinde die Integration neu, um die Liste zu aktualisieren.', // MT
    fr: 'Meet affiche chaque calendrier Google que tu possèdes ou sur lequel tu peux écrire. Ajoute le calendrier dans Google Agenda puis déconnecte/reconnecte l’intégration pour rafraîchir la liste.', // MT
  },
  role_primary: {
    en: 'Primary',
    nl: 'Primair',
    es: 'Principal', // MT
    pt: 'Principal', // MT
    de: 'Primär', // MT
    fr: 'Principal', // MT
  },
  role_conflict_source: {
    en: 'Conflict source',
    nl: 'Conflictbron',
    es: 'Fuente de conflicto', // MT
    pt: 'Fonte de conflito', // MT
    de: 'Konfliktquelle', // MT
    fr: 'Source de conflit', // MT
  },
  role_write_target: {
    en: 'Write target',
    nl: 'Schrijfdoel',
    es: 'Destino de escritura', // MT
    pt: 'Destino de escrita', // MT
    de: 'Schreibziel', // MT
    fr: 'Cible d’écriture', // MT
  },
  role_ignore: {
    en: 'Ignore',
    nl: 'Negeren',
    es: 'Ignorar', // MT
    pt: 'Ignorar', // MT
    de: 'Ignorieren', // MT
    fr: 'Ignorer', // MT
  },
  resync: {
    en: 'Re-sync from Google',
    nl: 'Opnieuw synchroniseren met Google',
    es: 'Resincronizar desde Google', // MT
    pt: 'Ressincronizar do Google', // MT
    de: 'Neu von Google synchronisieren', // MT
    fr: 'Resynchroniser depuis Google', // MT
  },
  syncing: {
    en: 'Syncing…',
    nl: 'Synchroniseren…',
    es: 'Sincronizando…', // MT
    pt: 'A sincronizar…', // MT
    de: 'Wird synchronisiert…', // MT
    fr: 'Synchronisation…', // MT
  },
  cal_added_one: {
    en: '1 new calendar added.',
    nl: '1 nieuwe agenda toegevoegd.',
    es: '1 calendario nuevo añadido.', // MT
    pt: '1 novo calendário adicionado.', // MT
    de: '1 neuer Kalender hinzugefügt.', // MT
    fr: '1 nouveau calendrier ajouté.', // MT
  },
  cal_added_many: {
    en: '{n} new calendars added.',
    nl: '{n} nieuwe agenda’s toegevoegd.',
    es: '{n} calendarios nuevos añadidos.', // MT
    pt: '{n} novos calendários adicionados.', // MT
    de: '{n} neue Kalender hinzugefügt.', // MT
    fr: '{n} nouveaux calendriers ajoutés.', // MT
  },
  cal_up_to_date_one: {
    en: '1 calendar — all up to date.',
    nl: '1 agenda — alles is bij.',
    es: '1 calendario: todo al día.', // MT
    pt: '1 calendário — tudo em dia.', // MT
    de: '1 Kalender — alles aktuell.', // MT
    fr: '1 calendrier — tout est à jour.', // MT
  },
  cal_up_to_date_many: {
    en: '{n} calendars — all up to date.',
    nl: '{n} agenda’s — alles is bij.',
    es: '{n} calendarios: todo al día.', // MT
    pt: '{n} calendários — tudo em dia.', // MT
    de: '{n} Kalender — alles aktuell.', // MT
    fr: '{n} calendriers — tout est à jour.', // MT
  },

  // ── integrations / connections ────────────────────────────────────────
  int_title: {
    en: 'Connections',
    nl: 'Koppelingen',
    es: 'Conexiones', // MT
    pt: 'Ligações', // MT
    de: 'Verbindungen', // MT
    fr: 'Connexions', // MT
  },
  int_desc: {
    en: 'Connect external services so Meet can read your calendar and create video links.',
    nl: 'Koppel externe diensten zodat Meet je agenda kan lezen en videolinks kan aanmaken.',
    es: 'Conecta servicios externos para que Meet pueda leer tu calendario y crear enlaces de vídeo.', // MT
    pt: 'Ligue serviços externos para que o Meet possa ler o seu calendário e criar ligações de vídeo.', // MT
    de: 'Verbinde externe Dienste, damit Meet deinen Kalender lesen und Video-Links erstellen kann.', // MT
    fr: 'Connecte des services externes pour que Meet puisse lire ton calendrier et créer des liens vidéo.', // MT
  },
  personal_room: {
    en: 'Personal meeting room',
    nl: 'Persoonlijke meetingroom',
    es: 'Sala de reuniones personal', // MT
    pt: 'Sala de reuniões pessoal', // MT
    de: 'Persönlicher Meetingraum', // MT
    fr: 'Salle de réunion personnelle', // MT
  },
  int_room_desc: {
    en: 'Used by meeting types set to Personal room. A static Zoom Personal Meeting Room URL, your Whereby link, anything that lives at a fixed URL.',
    nl: 'Gebruikt door meetingtypes die op Persoonlijke room staan. Een vaste Zoom Personal Meeting Room-URL, je Whereby-link, alles wat op een vast adres staat.',
    es: 'Lo usan los tipos de reunión con Sala personal. Una URL fija de Zoom Personal Meeting Room, tu enlace de Whereby, cualquier cosa que viva en una URL fija.', // MT
    pt: 'Usado por tipos de reunião definidos como Sala pessoal. Uma URL fixa de Zoom Personal Meeting Room, a sua ligação Whereby, qualquer coisa que viva numa URL fixa.', // MT
    de: 'Genutzt von Meeting-Typen mit Persönlicher Raum. Eine feste Zoom-Personal-Meeting-Room-URL, dein Whereby-Link, alles mit fester URL.', // MT
    fr: 'Utilisée par les types de réunion réglés sur Salle personnelle. Une URL fixe de salle Zoom, ton lien Whereby, tout ce qui vit à une URL fixe.', // MT
  },
  personal_room_url: {
    en: 'Personal meeting room URL',
    nl: 'URL van je persoonlijke meetingroom',
    es: 'URL de tu sala de reuniones personal', // MT
    pt: 'URL da sala de reuniões pessoal', // MT
    de: 'URL deines persönlichen Meetingraums', // MT
    fr: 'URL de ta salle de réunion personnelle', // MT
  },
  google_desc: {
    en: 'Read your free/busy to hide booked times from your booking page, and create the meeting on your calendar (with a Meet link) when someone books.',
    nl: 'Leest je vrij/bezet om geboekte tijden van je boekingspagina te verbergen, en zet de meeting (met Meet-link) in je agenda zodra iemand boekt.',
    es: 'Lee tu disponibilidad para ocultar horas ocupadas en tu página de reservas, y crea la reunión en tu calendario (con enlace de Meet) cuando alguien reserva.', // MT
    pt: 'Lê a sua disponibilidade para ocultar horas ocupadas na página de reservas, e cria a reunião no seu calendário (com ligação Meet) quando alguém reserva.', // MT
    de: 'Liest deine Frei/Belegt-Zeiten, um gebuchte Zeiten auf deiner Buchungsseite zu verbergen, und legt das Meeting (mit Meet-Link) in deinem Kalender an, sobald jemand bucht.', // MT
    fr: 'Lit tes disponibilités pour masquer les créneaux occupés sur ta page de réservation, et crée la réunion dans ton calendrier (avec un lien Meet) quand quelqu’un réserve.', // MT
  },
  google_connected_msg: {
    en: '✓ Connected. Calendars synced.',
    nl: '✓ Gekoppeld. Agenda’s gesynchroniseerd.',
    es: '✓ Conectado. Calendarios sincronizados.', // MT
    pt: '✓ Ligado. Calendários sincronizados.', // MT
    de: '✓ Verbunden. Kalender synchronisiert.', // MT
    fr: '✓ Connecté. Calendriers synchronisés.', // MT
  },
  google_error_msg: {
    en: 'Couldn’t connect{reason}. Try again or check that your Google account hasn’t revoked access.',
    nl: 'Koppelen mislukt{reason}. Probeer opnieuw of check of je Google-account de toegang niet heeft ingetrokken.',
    es: 'No se pudo conectar{reason}. Inténtalo de nuevo o comprueba que tu cuenta de Google no haya revocado el acceso.', // MT
    pt: 'Não foi possível ligar{reason}. Tente novamente ou verifique se a sua conta Google não revogou o acesso.', // MT
    de: 'Verbindung fehlgeschlagen{reason}. Versuch es erneut oder prüfe, ob dein Google-Konto den Zugriff entzogen hat.', // MT
    fr: 'Connexion impossible{reason}. Réessaie ou vérifie que ton compte Google n’a pas révoqué l’accès.', // MT
  },
  google_start_failed: {
    en: 'Could not start Google connect.',
    nl: 'Kon de Google-koppeling niet starten.',
    es: 'No se pudo iniciar la conexión con Google.', // MT
    pt: 'Não foi possível iniciar a ligação ao Google.', // MT
    de: 'Google-Verbindung konnte nicht gestartet werden.', // MT
    fr: 'Impossible de démarrer la connexion Google.', // MT
  },
  disconnect: {
    en: 'Disconnect',
    nl: 'Ontkoppelen',
    es: 'Desconectar', // MT
    pt: 'Desligar', // MT
    de: 'Trennen', // MT
    fr: 'Déconnecter', // MT
  },
  connect_google: {
    en: 'Connect Google Calendar',
    nl: 'Google Agenda koppelen',
    es: 'Conectar Google Calendar', // MT
    pt: 'Ligar o Google Calendar', // MT
    de: 'Google Kalender verbinden', // MT
    fr: 'Connecter Google Agenda', // MT
  },
  redirecting: {
    en: 'Redirecting…',
    nl: 'Doorsturen…',
    es: 'Redirigiendo…', // MT
    pt: 'A redirecionar…', // MT
    de: 'Weiterleitung…', // MT
    fr: 'Redirection…', // MT
  },

  // ── payments ──────────────────────────────────────────────────────────
  pay_title: {
    en: 'Payments',
    nl: 'Betalingen',
    es: 'Pagos', // MT
    pt: 'Pagamentos', // MT
    de: 'Zahlungen', // MT
    fr: 'Paiements', // MT
  },
  pay_desc: {
    en: 'One set of payment settings for all Fibre apps — your personal account and the workspace’s, plus your default payment options.',
    nl: 'Eén set betaalinstellingen voor alle Fibre-apps — je persoonlijke account en die van de werkruimte, plus je standaard betaalopties.',
    es: 'Un solo conjunto de ajustes de pago para todas las apps de Fibre: tu cuenta personal y la del espacio de trabajo, más tus opciones de pago predeterminadas.', // MT
    pt: 'Um único conjunto de definições de pagamento para todas as apps Fibre — a sua conta pessoal e a do espaço de trabalho, mais as suas opções de pagamento predefinidas.', // MT
    de: 'Ein Satz Zahlungseinstellungen für alle Fibre-Apps — dein persönliches Konto und das des Workspace, plus deine Standard-Zahlungsoptionen.', // MT
    fr: 'Un seul jeu de réglages de paiement pour toutes les apps Fibre — ton compte personnel et celui de l’espace de travail, plus tes options de paiement par défaut.', // MT
  },
  pay_my_account: {
    en: 'My account',
    nl: 'Mijn account',
    es: 'Mi cuenta', // MT
    pt: 'A minha conta', // MT
    de: 'Mein Konto', // MT
    fr: 'Mon compte', // MT
  },
  pay_my_desc: {
    en: 'Payouts for your personal threads and meeting types — one connection, every Fibre app uses it. The invoice details appear as the seller on receipts for your personal sales.',
    nl: 'Uitbetalingen voor je persoonlijke threads en meetingtypes — één koppeling, elke Fibre-app gebruikt hem. De factuurgegevens verschijnen als verkoper op bonnen van je persoonlijke verkopen.',
    es: 'Cobros de tus threads y tipos de reunión personales: una conexión que usan todas las apps de Fibre. Los datos de factura aparecen como vendedor en los recibos de tus ventas personales.', // MT
    pt: 'Recebimentos dos seus threads e tipos de reunião pessoais — uma ligação, usada por todas as apps Fibre. Os dados de fatura aparecem como vendedor nos recibos das suas vendas pessoais.', // MT
    de: 'Auszahlungen für deine persönlichen Threads und Meeting-Typen — eine Verbindung, jede Fibre-App nutzt sie. Die Rechnungsangaben erscheinen als Verkäufer auf Belegen deiner persönlichen Verkäufe.', // MT
    fr: 'Les versements de tes threads et types de réunion personnels — une seule connexion, utilisée par toutes les apps Fibre. Les coordonnées de facturation apparaissent comme vendeur sur les reçus de tes ventes personnelles.', // MT
  },
  pay_ws_account: {
    en: 'Workspace account',
    nl: 'Werkruimte-account',
    es: 'Cuenta del espacio de trabajo', // MT
    pt: 'Conta do espaço de trabalho', // MT
    de: 'Workspace-Konto', // MT
    fr: 'Compte de l’espace de travail', // MT
  },
  pay_ws_desc: {
    en: 'Payouts for team threads and anything routed to the workspace. Teams don’t hold their own accounts — team sales land here, with these invoice details as the seller.',
    nl: 'Uitbetalingen voor teamthreads en alles wat naar de werkruimte gaat. Teams hebben geen eigen accounts — teamverkopen landen hier, met deze factuurgegevens als verkoper.',
    es: 'Cobros de los threads de equipo y de todo lo que va al espacio de trabajo. Los equipos no tienen cuentas propias: sus ventas llegan aquí, con estos datos de factura como vendedor.', // MT
    pt: 'Recebimentos dos threads de equipa e de tudo o que vai para o espaço de trabalho. As equipas não têm contas próprias — as vendas de equipa chegam aqui, com estes dados de fatura como vendedor.', // MT
    de: 'Auszahlungen für Team-Threads und alles, was zum Workspace geleitet wird. Teams haben keine eigenen Konten — Team-Verkäufe landen hier, mit diesen Rechnungsangaben als Verkäufer.', // MT
    fr: 'Les versements des threads d’équipe et de tout ce qui est routé vers l’espace de travail. Les équipes n’ont pas de compte propre — leurs ventes arrivent ici, avec ces coordonnées de facturation comme vendeur.', // MT
  },
  pay_footer: {
    en: 'The Stripe account id starts with acct_ (Stripe → Settings → Account details). Leaving it empty disconnects. Payment options inherit downward: account default → thread → ticket, each level can override.',
    nl: 'Het Stripe-account-id begint met acct_ (Stripe → Settings → Account details). Leeg laten ontkoppelt. Betaalopties erven omlaag: accountstandaard → thread → ticket, elk niveau kan afwijken.',
    es: 'El id de cuenta de Stripe empieza por acct_ (Stripe → Settings → Account details). Dejarlo vacío desconecta. Las opciones de pago se heredan hacia abajo: predeterminado de cuenta → thread → ticket, cada nivel puede sobrescribir.', // MT
    pt: 'O id da conta Stripe começa por acct_ (Stripe → Settings → Account details). Deixar vazio desliga. As opções de pagamento herdam para baixo: predefinição da conta → thread → bilhete, cada nível pode substituir.', // MT
    de: 'Die Stripe-Konto-ID beginnt mit acct_ (Stripe → Settings → Account details). Leer lassen trennt die Verbindung. Zahlungsoptionen vererben sich nach unten: Konto-Standard → Thread → Ticket, jede Ebene kann überschreiben.', // MT
    fr: 'L’identifiant de compte Stripe commence par acct_ (Stripe → Settings → Account details). Le laisser vide déconnecte. Les options de paiement s’héritent vers le bas : défaut du compte → thread → billet, chaque niveau peut remplacer.', // MT
  },
  connected: {
    en: 'Connected',
    nl: 'Gekoppeld',
    es: 'Conectado', // MT
    pt: 'Ligado', // MT
    de: 'Verbunden', // MT
    fr: 'Connecté', // MT
  },
  not_connected: {
    en: 'Not connected',
    nl: 'Niet gekoppeld',
    es: 'Sin conectar', // MT
    pt: 'Não ligado', // MT
    de: 'Nicht verbunden', // MT
    fr: 'Non connecté', // MT
  },
  stripe_account_id: {
    en: 'Stripe account id',
    nl: 'Stripe-account-id',
    es: 'Id de cuenta de Stripe', // MT
    pt: 'Id da conta Stripe', // MT
    de: 'Stripe-Konto-ID', // MT
    fr: 'Identifiant de compte Stripe', // MT
  },
  legal_name_invoices: {
    en: 'Legal name (on invoices)',
    nl: 'Juridische naam (op facturen)',
    es: 'Nombre legal (en facturas)', // MT
    pt: 'Nome legal (nas faturas)', // MT
    de: 'Rechtlicher Name (auf Rechnungen)', // MT
    fr: 'Raison sociale (sur les factures)', // MT
  },
  tax_vat_number: {
    en: 'Tax / VAT number',
    nl: 'Btw-nummer',
    es: 'NIF / número de IVA', // MT
    pt: 'NIF / número de IVA', // MT
    de: 'Steuer-/USt-Nummer', // MT
    fr: 'Numéro fiscal / TVA', // MT
  },
  address_invoices: {
    en: 'Address (on invoices)',
    nl: 'Adres (op facturen)',
    es: 'Dirección (en facturas)', // MT
    pt: 'Morada (nas faturas)', // MT
    de: 'Adresse (auf Rechnungen)', // MT
    fr: 'Adresse (sur les factures)', // MT
  },
  vat_on_sales: {
    en: 'VAT on sales',
    nl: 'Btw op verkopen',
    es: 'IVA en ventas', // MT
    pt: 'IVA nas vendas', // MT
    de: 'USt auf Verkäufe', // MT
    fr: 'TVA sur les ventes', // MT
  },
  vat_registered: {
    en: 'VAT registered — show VAT on invoices',
    nl: 'Btw-geregistreerd — toon btw op facturen',
    es: 'Registrado a efectos de IVA: mostrar IVA en facturas', // MT
    pt: 'Registado para IVA — mostrar IVA nas faturas', // MT
    de: 'USt-registriert — USt auf Rechnungen ausweisen', // MT
    fr: 'Assujetti à la TVA — afficher la TVA sur les factures', // MT
  },
  rate: {
    en: 'Rate',
    nl: 'Tarief',
    es: 'Tipo', // MT
    pt: 'Taxa', // MT
    de: 'Satz', // MT
    fr: 'Taux', // MT
  },
  vat_note: {
    en: 'Prices stay what buyers see — the invoice splits out the included VAT (“incl. VAT 21%”). Personal settings override the workspace’s.',
    nl: 'Prijzen blijven wat kopers zien — de factuur splitst de inbegrepen btw uit („incl. 21% btw”). Persoonlijke instellingen gaan boven die van de werkruimte.',
    es: 'Los precios siguen siendo lo que ven los compradores: la factura desglosa el IVA incluido («IVA 21% incl.»). Los ajustes personales prevalecen sobre los del espacio de trabajo.', // MT
    pt: 'Os preços continuam a ser o que os compradores veem — a fatura discrimina o IVA incluído («IVA 21% incl.»). As definições pessoais prevalecem sobre as do espaço de trabalho.', // MT
    de: 'Preise bleiben, was Käufer sehen — die Rechnung weist die enthaltene USt aus („inkl. 21 % USt“). Persönliche Einstellungen gehen vor denen des Workspace.', // MT
    fr: 'Les prix restent ce que voient les acheteurs — la facture détaille la TVA incluse (« TVA 21 % incl. »). Les réglages personnels priment sur ceux de l’espace de travail.', // MT
  },
  default_payment_options: {
    en: 'Default payment options — {hint}',
    nl: 'Standaard betaalopties — {hint}',
    es: 'Opciones de pago predeterminadas: {hint}', // MT
    pt: 'Opções de pagamento predefinidas — {hint}', // MT
    de: 'Standard-Zahlungsoptionen — {hint}', // MT
    fr: 'Options de paiement par défaut — {hint}', // MT
  },
  pay_methods_hint_personal: {
    en: 'your personal threads and tickets inherit these',
    nl: 'je persoonlijke threads en tickets erven deze',
    es: 'tus threads y entradas personales heredan esto', // MT
    pt: 'os seus threads e bilhetes pessoais herdam isto', // MT
    de: 'deine persönlichen Threads und Tickets erben diese', // MT
    fr: 'tes threads et billets personnels en héritent', // MT
  },
  pay_methods_hint_ws: {
    en: 'team & workspace threads inherit these',
    nl: 'team- en werkruimtethreads erven deze',
    es: 'los threads de equipo y del espacio de trabajo heredan esto', // MT
    pt: 'os threads de equipa e do espaço de trabalho herdam isto', // MT
    de: 'Team- und Workspace-Threads erben diese', // MT
    fr: 'les threads d’équipe et d’espace de travail en héritent', // MT
  },
  pay_online_card: {
    en: 'Pay online (card)',
    nl: 'Online betalen (kaart)',
    es: 'Pagar en línea (tarjeta)', // MT
    pt: 'Pagar online (cartão)', // MT
    de: 'Online zahlen (Karte)', // MT
    fr: 'Payer en ligne (carte)', // MT
  },
  pay_per_invoice: {
    en: 'Pay per invoice',
    nl: 'Betalen op factuur',
    es: 'Pagar por factura', // MT
    pt: 'Pagar por fatura', // MT
    de: 'Auf Rechnung zahlen', // MT
    fr: 'Payer sur facture', // MT
  },
  pay_admin_only: {
    en: 'Managed by workspace admins.',
    nl: 'Beheerd door werkruimte-admins.',
    es: 'Lo gestionan los administradores del espacio de trabajo.', // MT
    pt: 'Gerido pelos administradores do espaço de trabalho.', // MT
    de: 'Wird von Workspace-Admins verwaltet.', // MT
    fr: 'Géré par les admins de l’espace de travail.', // MT
  },
  err_acct_prefix: {
    en: 'A Stripe account id starts with acct_',
    nl: 'Een Stripe-account-id begint met acct_',
    es: 'Un id de cuenta de Stripe empieza por acct_', // MT
    pt: 'Um id de conta Stripe começa por acct_', // MT
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
    pt: 'A taxa de IVA tem de estar entre 0 e 100.', // MT
    de: 'Der USt-Satz muss zwischen 0 und 100 liegen.', // MT
    fr: 'Le taux de TVA doit être entre 0 et 100.', // MT
  },

  // ── dashboard ─────────────────────────────────────────────────────────
  welcome: {
    en: 'Welcome, {name}',
    nl: 'Welkom, {name}',
    es: 'Bienvenido, {name}', // MT
    pt: 'Bem-vindo, {name}', // MT
    de: 'Willkommen, {name}', // MT
    fr: 'Bienvenue, {name}', // MT
  },
  quick_links: {
    en: 'Quick links',
    nl: 'Snelle links',
    es: 'Enlaces rápidos', // MT
    pt: 'Ligações rápidas', // MT
    de: 'Schnellzugriffe', // MT
    fr: 'Liens rapides', // MT
  },
  quick_links_desc: {
    en: 'Your active meeting types — copy and share.',
    nl: 'Je actieve meetingtypes — kopiëren en delen.',
    es: 'Tus tipos de reunión activos: copia y comparte.', // MT
    pt: 'Os seus tipos de reunião ativos — copie e partilhe.', // MT
    de: 'Deine aktiven Meeting-Typen — kopieren und teilen.', // MT
    fr: 'Tes types de réunion actifs — copie et partage.', // MT
  },
  no_active_mts: {
    en: 'No active meeting types yet.',
    nl: 'Nog geen actieve meetingtypes.',
    es: 'Aún no hay tipos de reunión activos.', // MT
    pt: 'Ainda não há tipos de reunião ativos.', // MT
    de: 'Noch keine aktiven Meeting-Typen.', // MT
    fr: 'Pas encore de type de réunion actif.', // MT
  },
  create_one: {
    en: 'Create one',
    nl: 'Maak er een aan',
    es: 'Crea uno', // MT
    pt: 'Crie um', // MT
    de: 'Erstelle einen', // MT
    fr: 'Crées-en un', // MT
  },
  today_label: {
    en: 'Today',
    nl: 'Vandaag',
    es: 'Hoy', // MT
    pt: 'Hoje', // MT
    de: 'Heute', // MT
    fr: 'Aujourd’hui', // MT
  },
  view_all: {
    en: 'View all',
    nl: 'Bekijk alles',
    es: 'Ver todo', // MT
    pt: 'Ver tudo', // MT
    de: 'Alle ansehen', // MT
    fr: 'Tout voir', // MT
  },
  nothing_today: {
    en: 'Nothing on the calendar today.',
    nl: 'Vandaag niets in de agenda.',
    es: 'Nada en el calendario hoy.', // MT
    pt: 'Nada no calendário hoje.', // MT
    de: 'Heute nichts im Kalender.', // MT
    fr: 'Rien au calendrier aujourd’hui.', // MT
  },
  next_up: {
    en: 'Next up',
    nl: 'Hierna',
    es: 'A continuación', // MT
    pt: 'A seguir', // MT
    de: 'Als Nächstes', // MT
    fr: 'À suivre', // MT
  },
  no_upcoming: {
    en: 'No upcoming bookings.',
    nl: 'Geen aankomende boekingen.',
    es: 'No hay reservas próximas.', // MT
    pt: 'Sem reservas próximas.', // MT
    de: 'Keine anstehenden Buchungen.', // MT
    fr: 'Aucune réservation à venir.', // MT
  },
  couldnt_load_some: {
    en: 'Couldn’t load some data: {error}',
    nl: 'Kon sommige gegevens niet laden: {error}',
    es: 'No se pudieron cargar algunos datos: {error}', // MT
    pt: 'Não foi possível carregar alguns dados: {error}', // MT
    de: 'Einige Daten konnten nicht geladen werden: {error}', // MT
    fr: 'Impossible de charger certaines données : {error}', // MT
  },

  // ── bookings ──────────────────────────────────────────────────────────
  bookings_title: {
    en: 'Bookings',
    nl: 'Boekingen',
    es: 'Reservas', // MT
    pt: 'Reservas', // MT
    de: 'Buchungen', // MT
    fr: 'Réservations', // MT
  },
  bookings_desc: {
    en: 'Everything booked with you.',
    nl: 'Alles wat bij jou geboekt is.',
    es: 'Todo lo reservado contigo.', // MT
    pt: 'Tudo o que foi reservado consigo.', // MT
    de: 'Alles, was bei dir gebucht wurde.', // MT
    fr: 'Tout ce qui est réservé avec toi.', // MT
  },
  scope_upcoming: {
    en: 'Upcoming',
    nl: 'Aankomend',
    es: 'Próximas', // MT
    pt: 'Próximas', // MT
    de: 'Anstehend', // MT
    fr: 'À venir', // MT
  },
  scope_past: {
    en: 'Past',
    nl: 'Voorbij',
    es: 'Pasadas', // MT
    pt: 'Passadas', // MT
    de: 'Vergangen', // MT
    fr: 'Passées', // MT
  },
  scope_all: {
    en: 'All',
    nl: 'Alles',
    es: 'Todas', // MT
    pt: 'Todas', // MT
    de: 'Alle', // MT
    fr: 'Toutes', // MT
  },
  view_list: {
    en: 'List view',
    nl: 'Lijstweergave',
    es: 'Vista de lista', // MT
    pt: 'Vista de lista', // MT
    de: 'Listenansicht', // MT
    fr: 'Vue liste', // MT
  },
  view_week: {
    en: 'Week view',
    nl: 'Weekweergave',
    es: 'Vista semanal', // MT
    pt: 'Vista semanal', // MT
    de: 'Wochenansicht', // MT
    fr: 'Vue semaine', // MT
  },
  view_month: {
    en: 'Month view',
    nl: 'Maandweergave',
    es: 'Vista mensual', // MT
    pt: 'Vista mensal', // MT
    de: 'Monatsansicht', // MT
    fr: 'Vue mois', // MT
  },
  scope: {
    en: 'Scope',
    nl: 'Bereik',
    es: 'Ámbito', // MT
    pt: 'Âmbito', // MT
    de: 'Bereich', // MT
    fr: 'Portée', // MT
  },
  all_scopes: {
    en: 'All scopes',
    nl: 'Alle bereiken',
    es: 'Todos los ámbitos', // MT
    pt: 'Todos os âmbitos', // MT
    de: 'Alle Bereiche', // MT
    fr: 'Toutes les portées', // MT
  },
  include_cancelled: {
    en: 'Include cancelled',
    nl: 'Inclusief geannuleerd',
    es: 'Incluir canceladas', // MT
    pt: 'Incluir canceladas', // MT
    de: 'Stornierte einbeziehen', // MT
    fr: 'Inclure les annulées', // MT
  },
  nothing_in_view: {
    en: 'Nothing in this view.',
    nl: 'Niets in deze weergave.',
    es: 'Nada en esta vista.', // MT
    pt: 'Nada nesta vista.', // MT
    de: 'Nichts in dieser Ansicht.', // MT
    fr: 'Rien dans cette vue.', // MT
  },
  week_of: {
    en: 'Week of {range}',
    nl: 'Week van {range}',
    es: 'Semana del {range}', // MT
    pt: 'Semana de {range}', // MT
    de: 'Woche vom {range}', // MT
    fr: 'Semaine du {range}', // MT
  },
  n_more: {
    en: '+{n} more',
    nl: '+{n} meer',
    es: '+{n} más', // MT
    pt: '+{n} mais', // MT
    de: '+{n} weitere', // MT
    fr: '+{n} de plus', // MT
  },
  day_mon: { en: 'Mon', nl: 'Ma', es: 'Lun', pt: 'Seg', de: 'Mo', fr: 'Lun' },
  day_tue: { en: 'Tue', nl: 'Di', es: 'Mar', pt: 'Ter', de: 'Di', fr: 'Mar' },
  day_wed: { en: 'Wed', nl: 'Wo', es: 'Mié', pt: 'Qua', de: 'Mi', fr: 'Mer' },
  day_thu: { en: 'Thu', nl: 'Do', es: 'Jue', pt: 'Qui', de: 'Do', fr: 'Jeu' },
  day_fri: { en: 'Fri', nl: 'Vr', es: 'Vie', pt: 'Sex', de: 'Fr', fr: 'Ven' },
  day_sat: { en: 'Sat', nl: 'Za', es: 'Sáb', pt: 'Sáb', de: 'Sa', fr: 'Sam' },
  day_sun: { en: 'Sun', nl: 'Zo', es: 'Dom', pt: 'Dom', de: 'So', fr: 'Dim' },

  // ── meeting types (list + new) ────────────────────────────────────────
  mt_title: {
    en: 'Meeting types',
    nl: 'Meetingtypes',
    es: 'Tipos de reunión', // MT
    pt: 'Tipos de reunião', // MT
    de: 'Meeting-Typen', // MT
    fr: 'Types de réunion', // MT
  },
  mt_desc: {
    en: 'What you offer to be booked for.',
    nl: 'Waarvoor je geboekt kunt worden.',
    es: 'Aquello para lo que te pueden reservar.', // MT
    pt: 'Aquilo para que pode ser reservado.', // MT
    de: 'Wofür du gebucht werden kannst.', // MT
    fr: 'Ce pour quoi on peut te réserver.', // MT
  },
  no_personal_mts: {
    en: 'No personal meeting types yet.',
    nl: 'Nog geen persoonlijke meetingtypes.',
    es: 'Aún no hay tipos de reunión personales.', // MT
    pt: 'Ainda não há tipos de reunião pessoais.', // MT
    de: 'Noch keine persönlichen Meeting-Typen.', // MT
    fr: 'Pas encore de type de réunion personnel.', // MT
  },
  copy_booking_link: {
    en: 'Copy booking link',
    nl: 'Boekingslink kopiëren',
    es: 'Copiar enlace de reserva', // MT
    pt: 'Copiar ligação de reserva', // MT
    de: 'Buchungslink kopieren', // MT
    fr: 'Copier le lien de réservation', // MT
  },
  open_booking_page: {
    en: 'Open booking page',
    nl: 'Boekingspagina openen',
    es: 'Abrir página de reservas', // MT
    pt: 'Abrir página de reservas', // MT
    de: 'Buchungsseite öffnen', // MT
    fr: 'Ouvrir la page de réservation', // MT
  },
  new: {
    en: 'New',
    nl: 'Nieuw',
    es: 'Nuevo', // MT
    pt: 'Novo', // MT
    de: 'Neu', // MT
    fr: 'Nouveau', // MT
  },
  event_type: {
    en: 'Event type',
    nl: 'Eventtype',
    es: 'Tipo de evento', // MT
    pt: 'Tipo de evento', // MT
    de: 'Event-Typ', // MT
    fr: 'Type d’événement', // MT
  },
  new_mt_title: {
    en: 'New meeting type',
    nl: 'Nieuw meetingtype',
    es: 'Nuevo tipo de reunión', // MT
    pt: 'Novo tipo de reunião', // MT
    de: 'Neuer Meeting-Typ', // MT
    fr: 'Nouveau type de réunion', // MT
  },
  new_mt_desc: {
    en: 'What can people book you for?',
    nl: 'Waarvoor kunnen mensen je boeken?',
    es: '¿Para qué te puede reservar la gente?', // MT
    pt: 'Para que é que as pessoas o podem reservar?', // MT
    de: 'Wofür können dich Leute buchen?', // MT
    fr: 'Pour quoi peut-on te réserver ?', // MT
  },

  // ── meeting-type form ─────────────────────────────────────────────────
  tab_basics: {
    en: 'Basics',
    nl: 'Basis',
    es: 'Básico', // MT
    pt: 'Básico', // MT
    de: 'Grundlagen', // MT
    fr: 'Essentiel', // MT
  },
  tab_conferencing: {
    en: 'Conferencing',
    nl: 'Videobellen',
    es: 'Videollamada', // MT
    pt: 'Videoconferência', // MT
    de: 'Konferenz', // MT
    fr: 'Visioconférence', // MT
  },
  tab_pricing: {
    en: 'Pricing',
    nl: 'Prijs',
    es: 'Precio', // MT
    pt: 'Preço', // MT
    de: 'Preis', // MT
    fr: 'Tarif', // MT
  },
  tab_intake: {
    en: 'Intake',
    nl: 'Intake',
    es: 'Formulario', // MT
    pt: 'Formulário', // MT
    de: 'Intake', // MT
    fr: 'Formulaire', // MT
  },
  scope_section_desc: {
    en: 'Personal types live under your handle. Team types live under a team’s URL — bookings show up in the team’s shared view.',
    nl: 'Persoonlijke types staan onder jouw handle. Teamtypes staan onder de URL van een team — boekingen verschijnen in de gedeelde teamweergave.',
    es: 'Los tipos personales viven bajo tu alias. Los de equipo viven bajo la URL del equipo: las reservas aparecen en la vista compartida del equipo.', // MT
    pt: 'Os tipos pessoais vivem sob o seu identificador. Os de equipa vivem sob a URL da equipa — as reservas aparecem na vista partilhada da equipa.', // MT
    de: 'Persönliche Typen liegen unter deinem Handle. Team-Typen liegen unter der URL eines Teams — Buchungen erscheinen in der gemeinsamen Team-Ansicht.', // MT
    fr: 'Les types personnels vivent sous ton identifiant. Les types d’équipe vivent sous l’URL d’une équipe — les réservations apparaissent dans la vue partagée de l’équipe.', // MT
  },
  scope_personal_desc: {
    en: 'Just for you.',
    nl: 'Alleen voor jou.',
    es: 'Solo para ti.', // MT
    pt: 'Só para você.', // MT
    de: 'Nur für dich.', // MT
    fr: 'Rien que pour toi.', // MT
  },
  scope_team_none: {
    en: 'You aren’t a lead of any team yet.',
    nl: 'Je bent nog geen lead van een team.',
    es: 'Aún no eres lead de ningún equipo.', // MT
    pt: 'Ainda não é lead de nenhuma equipa.', // MT
    de: 'Du bist noch kein Lead eines Teams.', // MT
    fr: 'Tu n’es encore lead d’aucune équipe.', // MT
  },
  scope_team_desc: {
    en: 'Owned by a team you lead.',
    nl: 'Van een team waarvan jij lead bent.',
    es: 'Pertenece a un equipo que lideras.', // MT
    pt: 'Pertence a uma equipa que você lidera.', // MT
    de: 'Gehört einem Team, das du leitest.', // MT
    fr: 'Appartient à une équipe que tu diriges.', // MT
  },
  details_section: {
    en: 'Details',
    nl: 'Details',
    es: 'Detalles', // MT
    pt: 'Detalhes', // MT
    de: 'Details', // MT
    fr: 'Détails', // MT
  },
  details_desc: {
    en: 'Name, slug, and duration are the essentials.',
    nl: 'Naam, slug en duur zijn de essentie.',
    es: 'Nombre, slug y duración son lo esencial.', // MT
    pt: 'Nome, slug e duração são o essencial.', // MT
    de: 'Name, Slug und Dauer sind das Wesentliche.', // MT
    fr: 'Nom, slug et durée sont l’essentiel.', // MT
  },
  description_optional: {
    en: 'Description (optional)',
    nl: 'Beschrijving (optioneel)',
    es: 'Descripción (opcional)', // MT
    pt: 'Descrição (opcional)', // MT
    de: 'Beschreibung (optional)', // MT
    fr: 'Description (facultative)', // MT
  },
  duration: {
    en: 'Duration',
    nl: 'Duur',
    es: 'Duración', // MT
    pt: 'Duração', // MT
    de: 'Dauer', // MT
    fr: 'Durée', // MT
  },
  capacity: {
    en: 'Capacity',
    nl: 'Capaciteit',
    es: 'Capacidad', // MT
    pt: 'Capacidade', // MT
    de: 'Kapazität', // MT
    fr: 'Capacité', // MT
  },
  capacity_hint: {
    en: 'Max invitees who can share each slot. Once full, the slot disappears from the booking page.',
    nl: 'Maximaal aantal genodigden per tijdslot. Zodra vol, verdwijnt het slot van de boekingspagina.',
    es: 'Máximo de invitados que comparten cada franja. Al llenarse, la franja desaparece de la página de reservas.', // MT
    pt: 'Máximo de convidados que partilham cada horário. Quando cheio, o horário desaparece da página de reservas.', // MT
    de: 'Maximale Eingeladene pro Slot. Sobald voll, verschwindet der Slot von der Buchungsseite.', // MT
    fr: 'Nombre maximum d’invités par créneau. Une fois plein, le créneau disparaît de la page de réservation.', // MT
  },
  datetime_label: {
    en: 'Date & time',
    nl: 'Datum & tijd',
    es: 'Fecha y hora', // MT
    pt: 'Data e hora', // MT
    de: 'Datum & Uhrzeit', // MT
    fr: 'Date et heure', // MT
  },
  datetime_hint: {
    en: 'The single, fixed time this meeting will run. Invitees confirm attendance instead of picking a slot.',
    nl: 'De ene, vaste tijd waarop deze meeting plaatsvindt. Genodigden bevestigen hun aanwezigheid in plaats van een slot te kiezen.',
    es: 'La única hora fija en que se celebrará esta reunión. Los invitados confirman asistencia en lugar de elegir franja.', // MT
    pt: 'A hora única e fixa desta reunião. Os convidados confirmam presença em vez de escolher um horário.', // MT
    de: 'Die eine, feste Zeit dieses Meetings. Eingeladene bestätigen die Teilnahme, statt einen Slot zu wählen.', // MT
    fr: 'L’horaire unique et fixe de cette réunion. Les invités confirment leur présence au lieu de choisir un créneau.', // MT
  },
  capacity_one_hint: {
    en: '1 = traditional one-on-one. Higher = a small group event capped at N attendees.',
    nl: '1 = klassiek één-op-één. Hoger = een klein groepsevent met maximaal N deelnemers.',
    es: '1 = uno a uno tradicional. Más = un pequeño evento de grupo limitado a N asistentes.', // MT
    pt: '1 = um-para-um tradicional. Mais = um pequeno evento de grupo limitado a N participantes.', // MT
    de: '1 = klassisches Einzelgespräch. Mehr = ein kleines Gruppenevent mit maximal N Teilnehmenden.', // MT
    fr: '1 = un-à-un classique. Plus = un petit événement de groupe limité à N participants.', // MT
  },
  active_accept: {
    en: 'Active — accept new bookings',
    nl: 'Actief — nieuwe boekingen aannemen',
    es: 'Activo: aceptar reservas nuevas', // MT
    pt: 'Ativo — aceitar novas reservas', // MT
    de: 'Aktiv — neue Buchungen annehmen', // MT
    fr: 'Actif — accepter les nouvelles réservations', // MT
  },
  opt_n_invitees: {
    en: '{n} invitees',
    nl: '{n} genodigden',
    es: '{n} invitados', // MT
    pt: '{n} convidados', // MT
    de: '{n} Eingeladene', // MT
    fr: '{n} invités', // MT
  },
  opt_1_invitee_interview: {
    en: '1 invitee (interview)',
    nl: '1 genodigde (interview)',
    es: '1 invitado (entrevista)', // MT
    pt: '1 convidado (entrevista)', // MT
    de: '1 Eingeladener (Interview)', // MT
    fr: '1 invité (entretien)', // MT
  },
  opt_n_minutes: {
    en: '{n} minutes',
    nl: '{n} minuten',
    es: '{n} minutos', // MT
    pt: '{n} minutos', // MT
    de: '{n} Minuten', // MT
    fr: '{n} minutes', // MT
  },
  opt_none: {
    en: 'None',
    nl: 'Geen',
    es: 'Ninguno', // MT
    pt: 'Nenhum', // MT
    de: 'Keiner', // MT
    fr: 'Aucun', // MT
  },
  opt_n_min: {
    en: '{n} min',
    nl: '{n} min',
    es: '{n} min', // MT
    pt: '{n} min', // MT
    de: '{n} Min.', // MT
    fr: '{n} min', // MT
  },
  opt_1_hour: {
    en: '1 hour',
    nl: '1 uur',
    es: '1 hora', // MT
    pt: '1 hora', // MT
    de: '1 Stunde', // MT
    fr: '1 heure', // MT
  },
  opt_n_hours: {
    en: '{n} hours',
    nl: '{n} uur',
    es: '{n} horas', // MT
    pt: '{n} horas', // MT
    de: '{n} Stunden', // MT
    fr: '{n} heures', // MT
  },
  opt_1_day: {
    en: '1 day',
    nl: '1 dag',
    es: '1 día', // MT
    pt: '1 dia', // MT
    de: '1 Tag', // MT
    fr: '1 jour', // MT
  },
  opt_n_days: {
    en: '{n} days',
    nl: '{n} dagen',
    es: '{n} días', // MT
    pt: '{n} dias', // MT
    de: '{n} Tage', // MT
    fr: '{n} jours', // MT
  },
  opt_1_week: {
    en: '1 week',
    nl: '1 week',
    es: '1 semana', // MT
    pt: '1 semana', // MT
    de: '1 Woche', // MT
    fr: '1 semaine', // MT
  },
  opt_1_year: {
    en: '1 year',
    nl: '1 jaar',
    es: '1 año', // MT
    pt: '1 ano', // MT
    de: '1 Jahr', // MT
    fr: '1 an', // MT
  },
  av_defaults_prefix: {
    en: 'Defaults to your overall',
    nl: 'Volgt standaard je algemene',
    es: 'Por defecto usa tu', // MT
    pt: 'Por predefinição usa o seu', // MT
    de: 'Folgt standardmäßig deinen allgemeinen', // MT
    fr: 'Suit par défaut tes', // MT
  },
  working_hours_link: {
    en: 'working hours',
    nl: 'werkuren',
    es: 'horario laboral general', // MT
    pt: 'horário de trabalho geral', // MT
    de: 'Arbeitszeiten', // MT
    fr: 'heures de travail générales', // MT
  },
  av_defaults_suffix: {
    en: '. Override here when this meeting type only happens at specific times.',
    nl: '. Wijk hier af als dit meetingtype alleen op specifieke tijden plaatsvindt.',
    es: '. Cámbialo aquí si este tipo de reunión solo ocurre a horas concretas.', // MT
    pt: '. Substitua aqui se este tipo de reunião só acontecer a horas específicas.', // MT
    de: '. Überschreibe hier, wenn dieser Meeting-Typ nur zu bestimmten Zeiten stattfindet.', // MT
    fr: '. Remplace ici si ce type de réunion n’a lieu qu’à des heures précises.', // MT
  },
  use_default_hours: {
    en: 'Use my default working hours',
    nl: 'Gebruik mijn standaard werkuren',
    es: 'Usar mi horario laboral predeterminado', // MT
    pt: 'Usar o meu horário de trabalho predefinido', // MT
    de: 'Meine Standard-Arbeitszeiten verwenden', // MT
    fr: 'Utiliser mes heures de travail par défaut', // MT
  },
  custom_for_mt: {
    en: 'Custom for this meeting type',
    nl: 'Aangepast voor dit meetingtype',
    es: 'Personalizado para este tipo de reunión', // MT
    pt: 'Personalizado para este tipo de reunião', // MT
    de: 'Individuell für diesen Meeting-Typ', // MT
    fr: 'Personnalisé pour ce type de réunion', // MT
  },
  scheduling_rules: {
    en: 'Scheduling rules',
    nl: 'Planningsregels',
    es: 'Reglas de programación', // MT
    pt: 'Regras de agendamento', // MT
    de: 'Planungsregeln', // MT
    fr: 'Règles de planification', // MT
  },
  scheduling_desc: {
    en: 'Buffers, how soon people can book, and how far ahead.',
    nl: 'Buffers, hoe kort van tevoren mensen kunnen boeken en hoe ver vooruit.',
    es: 'Márgenes, con cuánta antelación mínima se puede reservar y hasta cuándo.', // MT
    pt: 'Intervalos, com que antecedência mínima se pode reservar e até quando.', // MT
    de: 'Puffer, wie kurzfristig gebucht werden kann und wie weit im Voraus.', // MT
    fr: 'Les marges, le délai minimum de réservation et l’horizon maximum.', // MT
  },
  buffer_before: {
    en: 'Buffer before',
    nl: 'Buffer vooraf',
    es: 'Margen antes', // MT
    pt: 'Intervalo antes', // MT
    de: 'Puffer davor', // MT
    fr: 'Marge avant', // MT
  },
  buffer_before_hint: {
    en: 'Quiet time reserved before the meeting starts.',
    nl: 'Rustmoment gereserveerd voordat de meeting begint.',
    es: 'Tiempo libre reservado antes de que empiece la reunión.', // MT
    pt: 'Tempo livre reservado antes de a reunião começar.', // MT
    de: 'Ruhezeit vor Beginn des Meetings.', // MT
    fr: 'Temps calme réservé avant le début de la réunion.', // MT
  },
  buffer_after: {
    en: 'Buffer after',
    nl: 'Buffer achteraf',
    es: 'Margen después', // MT
    pt: 'Intervalo depois', // MT
    de: 'Puffer danach', // MT
    fr: 'Marge après', // MT
  },
  buffer_after_hint: {
    en: 'Quiet time reserved after the meeting ends.',
    nl: 'Rustmoment gereserveerd nadat de meeting eindigt.',
    es: 'Tiempo libre reservado después de que termine la reunión.', // MT
    pt: 'Tempo livre reservado depois de a reunião terminar.', // MT
    de: 'Ruhezeit nach Ende des Meetings.', // MT
    fr: 'Temps calme réservé après la fin de la réunion.', // MT
  },
  min_notice: {
    en: 'Minimum notice',
    nl: 'Minimale aankondigingstijd',
    es: 'Antelación mínima', // MT
    pt: 'Antecedência mínima', // MT
    de: 'Mindestvorlauf', // MT
    fr: 'Préavis minimum', // MT
  },
  min_notice_hint: {
    en: 'How late someone can still book.',
    nl: 'Hoe laat iemand nog kan boeken.',
    es: 'Hasta cuándo se puede reservar.', // MT
    pt: 'Até quando ainda se pode reservar.', // MT
    de: 'Wie kurzfristig noch gebucht werden kann.', // MT
    fr: 'Jusqu’à quand on peut encore réserver.', // MT
  },
  bookable_up_to: {
    en: 'Bookable up to',
    nl: 'Boekbaar tot',
    es: 'Reservable hasta', // MT
    pt: 'Reservável até', // MT
    de: 'Buchbar bis zu', // MT
    fr: 'Réservable jusqu’à', // MT
  },
  bookable_hint: {
    en: 'How far in the future the calendar opens.',
    nl: 'Hoe ver vooruit de agenda opengaat.',
    es: 'Hasta qué punto del futuro se abre el calendario.', // MT
    pt: 'Até que ponto no futuro o calendário abre.', // MT
    de: 'Wie weit in die Zukunft der Kalender öffnet.', // MT
    fr: 'Jusqu’où dans le futur le calendrier s’ouvre.', // MT
  },
  visibility_section: {
    en: 'Visibility',
    nl: 'Zichtbaarheid',
    es: 'Visibilidad', // MT
    pt: 'Visibilidade', // MT
    de: 'Sichtbarkeit', // MT
    fr: 'Visibilité', // MT
  },
  mt_visibility_desc: {
    en: 'Controls whether this meeting type shows up in your public booking page list. Either way the direct link keeps working.',
    nl: 'Bepaalt of dit meetingtype in de lijst op je openbare boekingspagina staat. De directe link blijft hoe dan ook werken.',
    es: 'Controla si este tipo de reunión aparece en la lista de tu página pública de reservas. En cualquier caso, el enlace directo sigue funcionando.', // MT
    pt: 'Controla se este tipo de reunião aparece na lista da sua página pública de reservas. De qualquer forma, a ligação direta continua a funcionar.', // MT
    de: 'Steuert, ob dieser Meeting-Typ in der Liste deiner öffentlichen Buchungsseite erscheint. Der Direktlink funktioniert so oder so.', // MT
    fr: 'Contrôle si ce type de réunion apparaît dans la liste de ta page publique de réservation. Le lien direct continue de fonctionner dans tous les cas.', // MT
  },
  public_listed: {
    en: 'Available on personal overview page',
    nl: 'Beschikbaar op je persoonlijke overzichtspagina',
    es: 'Disponible en tu página de resumen personal', // MT
    pt: 'Disponível na sua página de resumo pessoal', // MT
    de: 'Auf deiner persönlichen Übersichtsseite verfügbar', // MT
    fr: 'Disponible sur ta page d’aperçu personnelle', // MT
  },
  public_listed_hint: {
    en: 'When checked, this meeting type appears in the list at {url}. Uncheck to keep it bookable only via the direct link.',
    nl: 'Aangevinkt verschijnt dit meetingtype in de lijst op {url}. Vink uit om het alleen via de directe link boekbaar te houden.',
    es: 'Si está marcado, este tipo de reunión aparece en la lista en {url}. Desmárcalo para que solo sea reservable con el enlace directo.', // MT
    pt: 'Se marcado, este tipo de reunião aparece na lista em {url}. Desmarque para o manter reservável apenas pela ligação direta.', // MT
    de: 'Angehakt erscheint dieser Meeting-Typ in der Liste unter {url}. Abhaken, damit er nur über den Direktlink buchbar bleibt.', // MT
    fr: 'Coché, ce type de réunion apparaît dans la liste sur {url}. Décoche pour qu’il ne soit réservable que via le lien direct.', // MT
  },
  approval_section: {
    en: 'Approval',
    nl: 'Goedkeuring',
    es: 'Aprobación', // MT
    pt: 'Aprovação', // MT
    de: 'Freigabe', // MT
    fr: 'Approbation', // MT
  },
  approval_desc: {
    en: 'When approval is required, the booking sits as ‘pending’ and the invitee gets a request-received email. You approve or reject from the Bookings page.',
    nl: 'Als goedkeuring vereist is, blijft de boeking ‘in afwachting’ en krijgt de genodigde een ontvangstmail. Je keurt goed of wijst af vanaf de pagina Boekingen.',
    es: 'Si se requiere aprobación, la reserva queda «pendiente» y el invitado recibe un correo de solicitud recibida. Apruebas o rechazas desde la página de Reservas.', // MT
    pt: 'Quando a aprovação é obrigatória, a reserva fica «pendente» e o convidado recebe um e-mail de pedido recebido. Aprova ou rejeita na página Reservas.', // MT
    de: 'Ist eine Freigabe nötig, bleibt die Buchung „ausstehend“ und der Eingeladene bekommt eine Eingangsbestätigung per E-Mail. Du gibst frei oder lehnst ab auf der Seite Buchungen.', // MT
    fr: 'Quand l’approbation est requise, la réservation reste « en attente » et l’invité reçoit un e-mail d’accusé de réception. Tu approuves ou rejettes depuis la page Réservations.', // MT
  },
  approval_default: {
    en: 'Use my default',
    nl: 'Gebruik mijn standaard',
    es: 'Usar mi predeterminado', // MT
    pt: 'Usar a minha predefinição', // MT
    de: 'Meinen Standard verwenden', // MT
    fr: 'Utiliser mon réglage par défaut', // MT
  },
  approval_default_hint: {
    en: 'Follow the Approval setting on your Profile page.',
    nl: 'Volgt de goedkeuringsinstelling op je profielpagina.',
    es: 'Sigue el ajuste de Aprobación de tu página de perfil.', // MT
    pt: 'Segue a definição de Aprovação na sua página de perfil.', // MT
    de: 'Folgt der Freigabe-Einstellung auf deiner Profilseite.', // MT
    fr: 'Suit le réglage Approbation de ta page de profil.', // MT
  },
  approval_always: {
    en: 'Always require approval',
    nl: 'Altijd goedkeuring vereisen',
    es: 'Requerir aprobación siempre', // MT
    pt: 'Exigir sempre aprovação', // MT
    de: 'Immer Freigabe verlangen', // MT
    fr: 'Toujours exiger l’approbation', // MT
  },
  approval_always_hint: {
    en: 'Every booking starts as pending until you approve it.',
    nl: 'Elke boeking begint in afwachting totdat jij haar goedkeurt.',
    es: 'Cada reserva empieza pendiente hasta que la apruebes.', // MT
    pt: 'Cada reserva começa pendente até você a aprovar.', // MT
    de: 'Jede Buchung startet als ausstehend, bis du sie freigibst.', // MT
    fr: 'Chaque réservation démarre en attente jusqu’à ton approbation.', // MT
  },
  approval_never: {
    en: 'Never require approval',
    nl: 'Nooit goedkeuring vereisen',
    es: 'No requerir aprobación nunca', // MT
    pt: 'Nunca exigir aprovação', // MT
    de: 'Nie Freigabe verlangen', // MT
    fr: 'Ne jamais exiger l’approbation', // MT
  },
  approval_never_hint: {
    en: 'Bookings auto-confirm even if your default is set.',
    nl: 'Boekingen bevestigen automatisch, ook als je standaard aan staat.',
    es: 'Las reservas se confirman solas aunque tu predeterminado esté activado.', // MT
    pt: 'As reservas confirmam-se automaticamente mesmo com a predefinição ativa.', // MT
    de: 'Buchungen bestätigen sich automatisch, auch wenn dein Standard gesetzt ist.', // MT
    fr: 'Les réservations se confirment automatiquement même si ton réglage par défaut est actif.', // MT
  },
  conferencing_section_desc: {
    en: 'Where the meeting happens. Zoom requires you to connect it in Settings.',
    nl: 'Waar de meeting plaatsvindt. Voor Zoom moet je hem koppelen in Instellingen.',
    es: 'Dónde ocurre la reunión. Zoom requiere conectarlo en Ajustes.', // MT
    pt: 'Onde a reunião acontece. O Zoom requer ligação nas Definições.', // MT
    de: 'Wo das Meeting stattfindet. Zoom musst du in den Einstellungen verbinden.', // MT
    fr: 'Où la réunion a lieu. Zoom doit être connecté dans les Paramètres.', // MT
  },
  provider: {
    en: 'Provider',
    nl: 'Aanbieder',
    es: 'Proveedor', // MT
    pt: 'Fornecedor', // MT
    de: 'Anbieter', // MT
    fr: 'Fournisseur', // MT
  },
  provider_in_person: {
    en: 'In person',
    nl: 'Fysiek',
    es: 'En persona', // MT
    pt: 'Presencial', // MT
    de: 'Vor Ort', // MT
    fr: 'En personne', // MT
  },
  provider_personal_room: {
    en: 'Personal room',
    nl: 'Persoonlijke room',
    es: 'Sala personal', // MT
    pt: 'Sala pessoal', // MT
    de: 'Persönlicher Raum', // MT
    fr: 'Salle personnelle', // MT
  },
  provider_none: {
    en: 'No conferencing',
    nl: 'Geen videobellen',
    es: 'Sin videollamada', // MT
    pt: 'Sem videoconferência', // MT
    de: 'Keine Konferenz', // MT
    fr: 'Pas de visioconférence', // MT
  },
  default_location_optional: {
    en: 'Default location (optional)',
    nl: 'Standaardlocatie (optioneel)',
    es: 'Ubicación predeterminada (opcional)', // MT
    pt: 'Localização predefinida (opcional)', // MT
    de: 'Standardort (optional)', // MT
    fr: 'Lieu par défaut (facultatif)', // MT
  },
  location_placeholder: {
    en: 'Address, room, link…',
    nl: 'Adres, ruimte, link…',
    es: 'Dirección, sala, enlace…', // MT
    pt: 'Morada, sala, ligação…', // MT
    de: 'Adresse, Raum, Link…', // MT
    fr: 'Adresse, salle, lien…', // MT
  },
  conflict_cals_section: {
    en: 'Conflict calendars',
    nl: 'Conflictagenda’s',
    es: 'Calendarios de conflicto', // MT
    pt: 'Calendários de conflito', // MT
    de: 'Konfliktkalender', // MT
    fr: 'Calendriers de conflit', // MT
  },
  conflict_cals_prefix: {
    en: 'Which of your calendars block this meeting type. Default uses every conflict source you set in',
    nl: 'Welke van je agenda’s dit meetingtype blokkeren. Standaard telt elke conflictbron die je instelde in',
    es: 'Qué calendarios tuyos bloquean este tipo de reunión. Por defecto usa cada fuente de conflicto que definiste en', // MT
    pt: 'Que calendários seus bloqueiam este tipo de reunião. Por predefinição usa cada fonte de conflito definida em', // MT
    de: 'Welche deiner Kalender diesen Meeting-Typ blockieren. Standardmäßig zählt jede Konfliktquelle aus', // MT
    fr: 'Lesquels de tes calendriers bloquent ce type de réunion. Par défaut, chaque source de conflit définie dans', // MT
  },
  settings_calendars_link: {
    en: 'Settings → Calendars',
    nl: 'Instellingen → Agenda’s',
    es: 'Ajustes → Calendarios', // MT
    pt: 'Definições → Calendários', // MT
    de: 'Einstellungen → Kalender', // MT
    fr: 'Paramètres → Calendriers', // MT
  },
  use_host_default_cals: {
    en: 'Use host default (every conflict-source calendar)',
    nl: 'Gebruik de hoststandaard (elke conflictbron-agenda)',
    es: 'Usar el predeterminado del anfitrión (todos los calendarios fuente de conflicto)', // MT
    pt: 'Usar a predefinição do anfitrião (todos os calendários fonte de conflito)', // MT
    de: 'Host-Standard verwenden (jeder Konfliktquellen-Kalender)', // MT
    fr: 'Utiliser le réglage par défaut de l’hôte (tous les calendriers sources de conflit)', // MT
  },
  no_cals_prefix: {
    en: 'No calendars synced yet. Connect Google in',
    nl: 'Nog geen agenda’s gesynchroniseerd. Koppel Google in',
    es: 'Aún no hay calendarios sincronizados. Conecta Google en', // MT
    pt: 'Ainda não há calendários sincronizados. Ligue o Google em', // MT
    de: 'Noch keine Kalender synchronisiert. Verbinde Google in', // MT
    fr: 'Aucun calendrier synchronisé pour l’instant. Connecte Google dans', // MT
  },
  integrations_link: {
    en: 'Integrations',
    nl: 'Integraties',
    es: 'Integraciones', // MT
    pt: 'Integrações', // MT
    de: 'Integrationen', // MT
    fr: 'Intégrations', // MT
  },
  pricing_section_desc: {
    en: 'Charge invitees through Stripe Checkout before the booking is confirmed. Free meetings skip payment entirely.',
    nl: 'Laat genodigden via Stripe Checkout betalen voordat de boeking bevestigd wordt. Gratis meetings slaan betalen helemaal over.',
    es: 'Cobra a los invitados con Stripe Checkout antes de confirmar la reserva. Las reuniones gratuitas se saltan el pago por completo.', // MT
    pt: 'Cobre aos convidados via Stripe Checkout antes de a reserva ser confirmada. As reuniões gratuitas dispensam o pagamento por completo.', // MT
    de: 'Lass Eingeladene über Stripe Checkout zahlen, bevor die Buchung bestätigt wird. Kostenlose Meetings überspringen die Zahlung komplett.', // MT
    fr: 'Fais payer les invités via Stripe Checkout avant la confirmation de la réservation. Les réunions gratuites sautent entièrement le paiement.', // MT
  },
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis', // MT
    pt: 'Gratuito', // MT
    de: 'Kostenlos', // MT
    fr: 'Gratuit', // MT
  },
  paid_via_stripe: {
    en: 'Paid (via Stripe Checkout)',
    nl: 'Betaald (via Stripe Checkout)',
    es: 'De pago (vía Stripe Checkout)', // MT
    pt: 'Pago (via Stripe Checkout)', // MT
    de: 'Kostenpflichtig (über Stripe Checkout)', // MT
    fr: 'Payant (via Stripe Checkout)', // MT
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
    en: 'Excluding tax. Stripe minimum is roughly 0.50 in most currencies.',
    nl: 'Exclusief btw. Het Stripe-minimum is ongeveer 0,50 in de meeste valuta.',
    es: 'Sin impuestos. El mínimo de Stripe es de aproximadamente 0,50 en la mayoría de monedas.', // MT
    pt: 'Sem impostos. O mínimo do Stripe é cerca de 0,50 na maioria das moedas.', // MT
    de: 'Ohne Steuern. Das Stripe-Minimum liegt bei etwa 0,50 in den meisten Währungen.', // MT
    fr: 'Hors taxes. Le minimum Stripe est d’environ 0,50 dans la plupart des devises.', // MT
  },
  currency: {
    en: 'Currency',
    nl: 'Valuta',
    es: 'Moneda', // MT
    pt: 'Moeda', // MT
    de: 'Währung', // MT
    fr: 'Devise', // MT
  },
  pricing_note_prefix: {
    en: 'Connect Stripe at',
    nl: 'Koppel Stripe via',
    es: 'Conecta Stripe en', // MT
    pt: 'Ligue o Stripe em', // MT
    de: 'Verbinde Stripe unter', // MT
    fr: 'Connecte Stripe via', // MT
  },
  settings_payments_link: {
    en: 'Settings → Payments',
    nl: 'Instellingen → Betalingen',
    es: 'Ajustes → Pagos', // MT
    pt: 'Definições → Pagamentos', // MT
    de: 'Einstellungen → Zahlungen', // MT
    fr: 'Paramètres → Paiements', // MT
  },
  pricing_note_suffix: {
    en: 'before saving a paid price. Stripe Checkout on the booking flow is queued for Phase 3 — saving a price today reserves the field but won’t yet trigger payment.',
    nl: 'voordat je een betaalde prijs opslaat. Stripe Checkout in de boekingsflow staat gepland voor fase 3 — een prijs opslaan reserveert nu het veld maar start nog geen betaling.',
    es: 'antes de guardar un precio de pago. Stripe Checkout en el flujo de reserva está previsto para la fase 3: guardar un precio hoy reserva el campo pero aún no activa el pago.', // MT
    pt: 'antes de guardar um preço pago. O Stripe Checkout no fluxo de reserva está previsto para a fase 3 — guardar um preço hoje reserva o campo mas ainda não aciona o pagamento.', // MT
    de: 'bevor du einen kostenpflichtigen Preis speicherst. Stripe Checkout im Buchungsablauf ist für Phase 3 geplant — ein Preis reserviert heute das Feld, löst aber noch keine Zahlung aus.', // MT
    fr: 'avant d’enregistrer un prix payant. Stripe Checkout dans le parcours de réservation est prévu pour la phase 3 — enregistrer un prix aujourd’hui réserve le champ mais ne déclenche pas encore de paiement.', // MT
  },
  intake_section: {
    en: 'Intake form',
    nl: 'Intakeformulier',
    es: 'Formulario de admisión', // MT
    pt: 'Formulário de admissão', // MT
    de: 'Intake-Formular', // MT
    fr: 'Formulaire d’accueil', // MT
  },
  intake_desc: {
    en: 'Ask invitees structured questions when they book. Save the meeting type first, then add fields here.',
    nl: 'Stel genodigden gestructureerde vragen bij het boeken. Sla het meetingtype eerst op en voeg dan hier velden toe.',
    es: 'Haz preguntas estructuradas a los invitados cuando reservan. Guarda primero el tipo de reunión y luego añade campos aquí.', // MT
    pt: 'Faça perguntas estruturadas aos convidados quando reservam. Guarde primeiro o tipo de reunião e depois adicione campos aqui.', // MT
    de: 'Stelle Eingeladenen beim Buchen strukturierte Fragen. Speichere erst den Meeting-Typ, dann füge hier Felder hinzu.', // MT
    fr: 'Pose des questions structurées aux invités quand ils réservent. Enregistre d’abord le type de réunion, puis ajoute des champs ici.', // MT
  },
  intake_create_first: {
    en: 'Create the meeting type first — the intake editor unlocks once it exists.',
    nl: 'Maak eerst het meetingtype aan — de intake-editor gaat open zodra het bestaat.',
    es: 'Crea primero el tipo de reunión: el editor de admisión se desbloquea cuando exista.', // MT
    pt: 'Crie primeiro o tipo de reunião — o editor de admissão desbloqueia assim que existir.', // MT
    de: 'Erstelle zuerst den Meeting-Typ — der Intake-Editor öffnet sich, sobald er existiert.', // MT
    fr: 'Crée d’abord le type de réunion — l’éditeur du formulaire se débloque dès qu’il existe.', // MT
  },
  save_intake: {
    en: 'Save intake fields',
    nl: 'Intakevelden opslaan',
    es: 'Guardar campos de admisión', // MT
    pt: 'Guardar campos de admissão', // MT
    de: 'Intake-Felder speichern', // MT
    fr: 'Enregistrer les champs du formulaire', // MT
  },
  intake_none_note: {
    en: 'No questions yet — invitees just enter name + email.',
    nl: 'Nog geen vragen — genodigden vullen alleen naam + e-mail in.',
    es: 'Aún sin preguntas: los invitados solo introducen nombre y correo.', // MT
    pt: 'Ainda sem perguntas — os convidados apenas indicam nome e e-mail.', // MT
    de: 'Noch keine Fragen — Eingeladene geben nur Name + E-Mail ein.', // MT
    fr: 'Pas encore de questions — les invités saisissent juste nom + e-mail.', // MT
  },
  candidate_slots: {
    en: 'Candidate slots',
    nl: 'Kandidaat-tijden',
    es: 'Horarios candidatos', // MT
    pt: 'Horários candidatos', // MT
    de: 'Kandidaten-Slots', // MT
    fr: 'Créneaux candidats', // MT
  },
  poll_editor_desc: {
    en: 'Add 2–5 specific date/times. Invitees will tick the ones they can attend; you confirm the winner from the votes view below.',
    nl: 'Voeg 2–5 specifieke datums/tijden toe. Genodigden vinken aan wanneer ze kunnen; jij bevestigt de winnaar in de stemmenweergave hieronder.',
    es: 'Añade de 2 a 5 fechas/horas concretas. Los invitados marcarán las que les vengan bien; tú confirmas la ganadora en la vista de votos de abajo.', // MT
    pt: 'Adicione 2–5 datas/horas específicas. Os convidados marcam as que podem; você confirma a vencedora na vista de votos abaixo.', // MT
    de: 'Füge 2–5 konkrete Termine hinzu. Eingeladene haken an, wann sie können; du bestätigst den Gewinner unten in der Stimmen-Ansicht.', // MT
    fr: 'Ajoute 2 à 5 dates/heures précises. Les invités cochent celles qui leur conviennent ; tu confirmes la gagnante dans la vue des votes ci-dessous.', // MT
  },
  add_slot: {
    en: 'Add slot',
    nl: 'Tijd toevoegen',
    es: 'Añadir horario', // MT
    pt: 'Adicionar horário', // MT
    de: 'Slot hinzufügen', // MT
    fr: 'Ajouter un créneau', // MT
  },
  save_slots: {
    en: 'Save slots',
    nl: 'Tijden opslaan',
    es: 'Guardar horarios', // MT
    pt: 'Guardar horários', // MT
    de: 'Slots speichern', // MT
    fr: 'Enregistrer les créneaux', // MT
  },
  remove_slot: {
    en: 'Remove slot',
    nl: 'Tijd verwijderen',
    es: 'Quitar horario', // MT
    pt: 'Remover horário', // MT
    de: 'Slot entfernen', // MT
    fr: 'Retirer le créneau', // MT
  },
  poll_save_first: {
    en: 'Save the meeting type first, then add candidate slots here.',
    nl: 'Sla het meetingtype eerst op en voeg dan hier kandidaat-tijden toe.',
    es: 'Guarda primero el tipo de reunión y luego añade horarios candidatos aquí.', // MT
    pt: 'Guarde primeiro o tipo de reunião e depois adicione horários candidatos aqui.', // MT
    de: 'Speichere erst den Meeting-Typ, dann füge hier Kandidaten-Slots hinzu.', // MT
    fr: 'Enregistre d’abord le type de réunion, puis ajoute les créneaux candidats ici.', // MT
  },
  poll_pick_valid: {
    en: 'Pick between 2 and 5 valid candidate slots.',
    nl: 'Kies tussen de 2 en 5 geldige kandidaat-tijden.',
    es: 'Elige entre 2 y 5 horarios candidatos válidos.', // MT
    pt: 'Escolha entre 2 e 5 horários candidatos válidos.', // MT
    de: 'Wähle zwischen 2 und 5 gültige Kandidaten-Slots.', // MT
    fr: 'Choisis entre 2 et 5 créneaux candidats valides.', // MT
  },

  // ── meeting-type detail (votes + assignees) ───────────────────────────
  votes_label: {
    en: 'Votes',
    nl: 'Stemmen',
    es: 'Votos', // MT
    pt: 'Votos', // MT
    de: 'Stimmen', // MT
    fr: 'Votes', // MT
  },
  votes_desc: {
    en: 'One row per invitee, one column per candidate slot. Tap “Confirm” on the winning column to convert this poll into a fixed time — the meeting type flips to one-off so the slot becomes bookable.',
    nl: 'Eén rij per genodigde, één kolom per kandidaat-tijd. Tik op „Bevestigen” bij de winnende kolom om deze poll om te zetten naar een vaste tijd — het meetingtype wordt eenmalig zodat het slot boekbaar wordt.',
    es: 'Una fila por invitado, una columna por horario candidato. Pulsa «Confirmar» en la columna ganadora para convertir esta encuesta en una hora fija: el tipo de reunión pasa a puntual y el horario se vuelve reservable.', // MT
    pt: 'Uma linha por convidado, uma coluna por horário candidato. Toque em «Confirmar» na coluna vencedora para converter esta sondagem numa hora fixa — o tipo de reunião passa a pontual e o horário torna-se reservável.', // MT
    de: 'Eine Zeile pro Eingeladenem, eine Spalte pro Kandidaten-Slot. Tippe bei der Gewinnerspalte auf „Bestätigen“, um diese Umfrage in eine feste Zeit umzuwandeln — der Meeting-Typ wird einmalig und der Slot buchbar.', // MT
    fr: 'Une ligne par invité, une colonne par créneau candidat. Appuie sur « Confirmer » dans la colonne gagnante pour convertir ce sondage en horaire fixe — le type de réunion devient ponctuel et le créneau devient réservable.', // MT
  },
  voter: {
    en: 'Voter',
    nl: 'Stemmer',
    es: 'Votante', // MT
    pt: 'Votante', // MT
    de: 'Abstimmende(r)', // MT
    fr: 'Votant', // MT
  },
  one_vote: {
    en: '1 vote',
    nl: '1 stem',
    es: '1 voto', // MT
    pt: '1 voto', // MT
    de: '1 Stimme', // MT
    fr: '1 vote', // MT
  },
  n_votes: {
    en: '{n} votes',
    nl: '{n} stemmen',
    es: '{n} votos', // MT
    pt: '{n} votos', // MT
    de: '{n} Stimmen', // MT
    fr: '{n} votes', // MT
  },
  confirm: {
    en: 'Confirm',
    nl: 'Bevestigen',
    es: 'Confirmar', // MT
    pt: 'Confirmar', // MT
    de: 'Bestätigen', // MT
    fr: 'Confirmer', // MT
  },
  confirm_poll_prompt: {
    en: 'Convert this poll into a confirmed slot? Voters will need to book the resulting one-off meeting type to be added.',
    nl: 'Deze poll omzetten naar een bevestigde tijd? Stemmers moeten het resulterende eenmalige meetingtype boeken om toegevoegd te worden.',
    es: '¿Convertir esta encuesta en un horario confirmado? Los votantes tendrán que reservar el tipo de reunión puntual resultante para ser añadidos.', // MT
    pt: 'Converter esta sondagem num horário confirmado? Os votantes terão de reservar o tipo de reunião pontual resultante para serem adicionados.', // MT
    de: 'Diese Umfrage in einen bestätigten Slot umwandeln? Abstimmende müssen den entstehenden einmaligen Meeting-Typ buchen, um hinzugefügt zu werden.', // MT
    fr: 'Convertir ce sondage en créneau confirmé ? Les votants devront réserver le type de réunion ponctuel résultant pour être ajoutés.', // MT
  },
  couldnt_confirm: {
    en: 'Couldn’t confirm: {error}',
    nl: 'Kon niet bevestigen: {error}',
    es: 'No se pudo confirmar: {error}', // MT
    pt: 'Não foi possível confirmar: {error}', // MT
    de: 'Konnte nicht bestätigt werden: {error}', // MT
    fr: 'Impossible de confirmer : {error}', // MT
  },
  no_votes_yet: {
    en: 'No votes yet. Share the poll link to start collecting responses.',
    nl: 'Nog geen stemmen. Deel de poll-link om reacties te verzamelen.',
    es: 'Aún no hay votos. Comparte el enlace de la encuesta para empezar a recibir respuestas.', // MT
    pt: 'Ainda sem votos. Partilhe a ligação da sondagem para começar a receber respostas.', // MT
    de: 'Noch keine Stimmen. Teile den Umfrage-Link, um Antworten zu sammeln.', // MT
    fr: 'Pas encore de votes. Partage le lien du sondage pour commencer à recueillir des réponses.', // MT
  },
  add_slots_first: {
    en: 'Add candidate slots on the Candidate slots tab to start collecting votes.',
    nl: 'Voeg kandidaat-tijden toe op het tabblad Kandidaat-tijden om stemmen te verzamelen.',
    es: 'Añade horarios candidatos en la pestaña Horarios candidatos para empezar a recibir votos.', // MT
    pt: 'Adicione horários candidatos no separador Horários candidatos para começar a receber votos.', // MT
    de: 'Füge im Tab Kandidaten-Slots Termine hinzu, um Stimmen zu sammeln.', // MT
    fr: 'Ajoute des créneaux candidats dans l’onglet Créneaux candidats pour commencer à recueillir des votes.', // MT
  },
  assignees_label: {
    en: 'Assignees',
    nl: 'Toegewezen hosts',
    es: 'Asignados', // MT
    pt: 'Atribuídos', // MT
    de: 'Zugewiesene', // MT
    fr: 'Assignés', // MT
  },
  assignees_rr_desc: {
    en: 'Bookings rotate to the least-loaded assignee free at the requested slot. Mark one assignee as primary — they own the canonical calendar event.',
    nl: 'Boekingen rouleren naar de minst belaste host die vrij is op het gevraagde slot. Markeer één host als primair — die bezit het canonieke agenda-item.',
    es: 'Las reservas rotan al asignado con menos carga que esté libre en la franja pedida. Marca a uno como principal: es dueño del evento canónico del calendario.', // MT
    pt: 'As reservas rodam para o atribuído com menos carga livre no horário pedido. Marque um como principal — ele detém o evento canónico do calendário.', // MT
    de: 'Buchungen rotieren zum am wenigsten ausgelasteten Zugewiesenen, der im gewünschten Slot frei ist. Markiere einen als primär — er besitzt den kanonischen Kalendereintrag.', // MT
    fr: 'Les réservations tournent vers l’assigné le moins chargé et libre au créneau demandé. Marque un assigné comme principal — il détient l’événement canonique du calendrier.', // MT
  },
  assignees_col_desc: {
    en: 'All assignees attend every booking. Slots are computed by intersecting availability. The primary holds the canonical calendar event.',
    nl: 'Alle toegewezen hosts zijn bij elke boeking. Slots worden berekend door beschikbaarheid te kruisen. De primaire host houdt het canonieke agenda-item.',
    es: 'Todos los asignados asisten a cada reserva. Las franjas se calculan cruzando disponibilidades. El principal mantiene el evento canónico del calendario.', // MT
    pt: 'Todos os atribuídos participam em cada reserva. Os horários calculam-se cruzando disponibilidades. O principal mantém o evento canónico do calendário.', // MT
    de: 'Alle Zugewiesenen nehmen an jeder Buchung teil. Slots ergeben sich aus dem Schnitt der Verfügbarkeiten. Der Primäre hält den kanonischen Kalendereintrag.', // MT
    fr: 'Tous les assignés participent à chaque réservation. Les créneaux sont calculés en croisant les disponibilités. Le principal détient l’événement canonique du calendrier.', // MT
  },
  add_members_first: {
    en: 'Add members to the team first, then assign them here.',
    nl: 'Voeg eerst leden toe aan het team en wijs ze dan hier toe.',
    es: 'Añade primero miembros al equipo y luego asígnalos aquí.', // MT
    pt: 'Adicione primeiro membros à equipa e depois atribua-os aqui.', // MT
    de: 'Füge dem Team erst Mitglieder hinzu und weise sie dann hier zu.', // MT
    fr: 'Ajoute d’abord des membres à l’équipe, puis assigne-les ici.', // MT
  },
  primary: {
    en: 'Primary',
    nl: 'Primair',
    es: 'Principal', // MT
    pt: 'Principal', // MT
    de: 'Primär', // MT
    fr: 'Principal', // MT
  },

  // ── event-type picker ─────────────────────────────────────────────────
  more_ways: {
    en: 'More ways to meet',
    nl: 'Meer manieren om te meeten',
    es: 'Más formas de reunirse', // MT
    pt: 'Mais formas de reunir', // MT
    de: 'Weitere Wege, sich zu treffen', // MT
    fr: 'D’autres façons de se réunir', // MT
  },
  et_one_on_one: {
    en: 'One-on-one',
    nl: 'Eén-op-één',
    es: 'Uno a uno', // MT
    pt: 'Um-para-um', // MT
    de: 'Einzelgespräch', // MT
    fr: 'Un-à-un', // MT
  },
  et_one_on_one_sub: {
    en: '1 host → 1 invitee',
    nl: '1 host → 1 genodigde',
    es: '1 anfitrión → 1 invitado', // MT
    pt: '1 anfitrião → 1 convidado', // MT
    de: '1 Host → 1 Eingeladener', // MT
    fr: '1 hôte → 1 invité', // MT
  },
  et_one_on_one_desc: {
    en: 'Coffee chats, intro calls, 1:1 reviews.',
    nl: 'Koffiegesprekken, kennismakingscalls, 1:1-reviews.',
    es: 'Cafés, llamadas de presentación, revisiones 1:1.', // MT
    pt: 'Cafés, chamadas de apresentação, revisões 1:1.', // MT
    de: 'Kaffeegespräche, Kennenlern-Calls, 1:1-Reviews.', // MT
    fr: 'Cafés, appels de présentation, points 1:1.', // MT
  },
  et_group: {
    en: 'Group',
    nl: 'Groep',
    es: 'Grupo', // MT
    pt: 'Grupo', // MT
    de: 'Gruppe', // MT
    fr: 'Groupe', // MT
  },
  et_group_sub: {
    en: '1 host → multiple invitees',
    nl: '1 host → meerdere genodigden',
    es: '1 anfitrión → varios invitados', // MT
    pt: '1 anfitrião → vários convidados', // MT
    de: '1 Host → mehrere Eingeladene', // MT
    fr: '1 hôte → plusieurs invités', // MT
  },
  et_group_desc: {
    en: 'Webinars, office hours, classes.',
    nl: 'Webinars, spreekuren, lessen.',
    es: 'Webinarios, tutorías, clases.', // MT
    pt: 'Webinars, horários de atendimento, aulas.', // MT
    de: 'Webinare, Sprechstunden, Kurse.', // MT
    fr: 'Webinaires, permanences, cours.', // MT
  },
  et_round_robin: {
    en: 'Round-robin',
    nl: 'Roulerend',
    es: 'Rotatorio', // MT
    pt: 'Rotativo', // MT
    de: 'Round-Robin', // MT
    fr: 'Tour de rôle', // MT
  },
  et_round_robin_sub: {
    en: 'Rotating hosts → 1 invitee',
    nl: 'Roulerende hosts → 1 genodigde',
    es: 'Anfitriones rotatorios → 1 invitado', // MT
    pt: 'Anfitriões rotativos → 1 convidado', // MT
    de: 'Rotierende Hosts → 1 Eingeladener', // MT
    fr: 'Hôtes en rotation → 1 invité', // MT
  },
  et_round_robin_desc: {
    en: 'Distribute bookings across a team.',
    nl: 'Verdeel boekingen over een team.',
    es: 'Reparte reservas entre un equipo.', // MT
    pt: 'Distribua reservas por uma equipa.', // MT
    de: 'Verteile Buchungen über ein Team.', // MT
    fr: 'Répartis les réservations dans une équipe.', // MT
  },
  et_collective: {
    en: 'Collective',
    nl: 'Collectief',
    es: 'Colectivo', // MT
    pt: 'Coletivo', // MT
    de: 'Kollektiv', // MT
    fr: 'Collectif', // MT
  },
  et_collective_sub: {
    en: 'Multiple hosts → 1 invitee',
    nl: 'Meerdere hosts → 1 genodigde',
    es: 'Varios anfitriones → 1 invitado', // MT
    pt: 'Vários anfitriões → 1 convidado', // MT
    de: 'Mehrere Hosts → 1 Eingeladener', // MT
    fr: 'Plusieurs hôtes → 1 invité', // MT
  },
  et_collective_desc: {
    en: 'Panel interviews, group sales calls.',
    nl: 'Panelgesprekken, gezamenlijke salescalls.',
    es: 'Entrevistas de panel, llamadas de ventas en grupo.', // MT
    pt: 'Entrevistas de painel, chamadas de vendas em grupo.', // MT
    de: 'Panel-Interviews, gemeinsame Sales-Calls.', // MT
    fr: 'Entretiens en panel, appels de vente en groupe.', // MT
  },
  et_one_off: {
    en: 'One-off meeting',
    nl: 'Eenmalige meeting',
    es: 'Reunión puntual', // MT
    pt: 'Reunião pontual', // MT
    de: 'Einmaliges Meeting', // MT
    fr: 'Réunion ponctuelle', // MT
  },
  et_one_off_sub: {
    en: 'A single time, outside your schedule',
    nl: 'Eén enkele tijd, buiten je schema',
    es: 'Una sola hora, fuera de tu agenda', // MT
    pt: 'Uma única hora, fora do seu horário', // MT
    de: 'Eine einzelne Zeit, außerhalb deines Plans', // MT
    fr: 'Un horaire unique, hors de ton planning', // MT
  },
  et_one_off_desc: {
    en: 'Offer a single time outside your normal schedule.',
    nl: 'Bied één tijd aan buiten je normale schema.',
    es: 'Ofrece una sola hora fuera de tu agenda habitual.', // MT
    pt: 'Ofereça uma única hora fora do seu horário normal.', // MT
    de: 'Biete eine einzelne Zeit außerhalb deines normalen Plans an.', // MT
    fr: 'Propose un horaire unique hors de ton planning habituel.', // MT
  },
  et_poll: {
    en: 'Meeting poll',
    nl: 'Meetingpoll',
    es: 'Encuesta de reunión', // MT
    pt: 'Sondagem de reunião', // MT
    de: 'Terminumfrage', // MT
    fr: 'Sondage de réunion', // MT
  },
  et_poll_sub: {
    en: 'Invitees vote on a time',
    nl: 'Genodigden stemmen op een tijd',
    es: 'Los invitados votan una hora', // MT
    pt: 'Os convidados votam numa hora', // MT
    de: 'Eingeladene stimmen über eine Zeit ab', // MT
    fr: 'Les invités votent pour un horaire', // MT
  },
  et_poll_desc: {
    en: 'Let invitees vote on a time to meet.',
    nl: 'Laat genodigden stemmen op een tijd om te meeten.',
    es: 'Deja que los invitados voten la hora de reunirse.', // MT
    pt: 'Deixe os convidados votar na hora de reunir.', // MT
    de: 'Lass Eingeladene über eine Zeit abstimmen.', // MT
    fr: 'Laisse les invités voter pour un horaire de réunion.', // MT
  },
  needs_team_picker: {
    en: 'Switch to Team scope to use this.',
    nl: 'Zet het bereik op Team om dit te gebruiken.',
    es: 'Cambia al ámbito Equipo para usar esto.', // MT
    pt: 'Mude para o âmbito Equipa para usar isto.', // MT
    de: 'Wechsle zum Team-Bereich, um das zu nutzen.', // MT
    fr: 'Passe à la portée Équipe pour utiliser ceci.', // MT
  },
  needs_team_menu: {
    en: 'Lives inside a team — create one first.',
    nl: 'Hoort bij een team — maak er eerst een aan.',
    es: 'Vive dentro de un equipo: crea uno primero.', // MT
    pt: 'Vive dentro de uma equipa — crie uma primeiro.', // MT
    de: 'Gehört zu einem Team — erstelle zuerst eins.', // MT
    fr: 'Vit au sein d’une équipe — crées-en une d’abord.', // MT
  },

  // ── contacts ──────────────────────────────────────────────────────────
  contacts_title: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contactos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  contacts_desc: {
    en: 'People Meet has a reason to know about — invitees on bookings, and members of your Meet teams. Identity is managed in The Fibre platform; Meet only surfaces the slice it justifies.',
    nl: 'Mensen waar Meet een reden voor heeft — genodigden op boekingen en leden van je Meet-teams. Identiteit wordt beheerd in het Fibre-platform; Meet toont alleen het deel dat het rechtvaardigt.',
    es: 'Personas que Meet tiene motivo para conocer: invitados de reservas y miembros de tus equipos de Meet. La identidad se gestiona en la plataforma The Fibre; Meet solo muestra la parte que justifica.', // MT
    pt: 'Pessoas que o Meet tem motivo para conhecer — convidados de reservas e membros das suas equipas Meet. A identidade é gerida na plataforma The Fibre; o Meet só mostra a fatia que justifica.', // MT
    de: 'Menschen, die Meet aus gutem Grund kennt — Eingeladene von Buchungen und Mitglieder deiner Meet-Teams. Identität wird in der Fibre-Plattform verwaltet; Meet zeigt nur den Teil, den es rechtfertigt.', // MT
    fr: 'Les personnes que Meet a une raison de connaître — invités des réservations et membres de tes équipes Meet. L’identité est gérée dans la plateforme The Fibre ; Meet ne montre que la part qu’il justifie.', // MT
  },
  contacts_empty: {
    en: 'No-one has booked yet, and your teams have no members — so Meet has no contacts to show.',
    nl: 'Nog niemand heeft geboekt en je teams hebben geen leden — dus Meet heeft geen contacten om te tonen.',
    es: 'Nadie ha reservado aún y tus equipos no tienen miembros, así que Meet no tiene contactos que mostrar.', // MT
    pt: 'Ainda ninguém reservou e as suas equipas não têm membros — por isso o Meet não tem contactos para mostrar.', // MT
    de: 'Noch hat niemand gebucht und deine Teams haben keine Mitglieder — also hat Meet keine Kontakte zu zeigen.', // MT
    fr: 'Personne n’a encore réservé et tes équipes n’ont pas de membres — Meet n’a donc aucun contact à montrer.', // MT
  },
  search_contacts_placeholder: {
    en: 'Search by name, email, or company',
    nl: 'Zoek op naam, e-mail of bedrijf',
    es: 'Buscar por nombre, correo o empresa', // MT
    pt: 'Pesquisar por nome, e-mail ou empresa', // MT
    de: 'Nach Name, E-Mail oder Firma suchen', // MT
    fr: 'Rechercher par nom, e-mail ou entreprise', // MT
  },
  searching: {
    en: 'Searching…',
    nl: 'Zoeken…',
    es: 'Buscando…', // MT
    pt: 'A pesquisar…', // MT
    de: 'Suche läuft…', // MT
    fr: 'Recherche…', // MT
  },
  badge_booked: {
    en: 'Booked',
    nl: 'Geboekt',
    es: 'Reservó', // MT
    pt: 'Reservou', // MT
    de: 'Gebucht', // MT
    fr: 'A réservé', // MT
  },
  one_booking: {
    en: '1 booking',
    nl: '1 boeking',
    es: '1 reserva', // MT
    pt: '1 reserva', // MT
    de: '1 Buchung', // MT
    fr: '1 réservation', // MT
  },
  n_bookings: {
    en: '{n} bookings',
    nl: '{n} boekingen',
    es: '{n} reservas', // MT
    pt: '{n} reservas', // MT
    de: '{n} Buchungen', // MT
    fr: '{n} réservations', // MT
  },
  contact: {
    en: 'Contact',
    nl: 'Contact',
    es: 'Contacto', // MT
    pt: 'Contacto', // MT
    de: 'Kontakt', // MT
    fr: 'Contact', // MT
  },
  open_in_fibre: {
    en: 'Open in The Fibre',
    nl: 'Open in The Fibre',
    es: 'Abrir en The Fibre', // MT
    pt: 'Abrir no The Fibre', // MT
    de: 'In The Fibre öffnen', // MT
    fr: 'Ouvrir dans The Fibre', // MT
  },
  domain: {
    en: 'Domain',
    nl: 'Domein',
    es: 'Dominio', // MT
    pt: 'Domínio', // MT
    de: 'Domain', // MT
    fr: 'Domaine', // MT
  },
  in_meet_because: {
    en: 'In Meet because',
    nl: 'In Meet omdat',
    es: 'En Meet porque', // MT
    pt: 'No Meet porque', // MT
    de: 'In Meet, weil', // MT
    fr: 'Dans Meet parce que', // MT
  },
  chip_booked_meeting: {
    en: 'Booked a meeting',
    nl: 'Boekte een meeting',
    es: 'Reservó una reunión', // MT
    pt: 'Reservou uma reunião', // MT
    de: 'Hat ein Meeting gebucht', // MT
    fr: 'A réservé une réunion', // MT
  },
  chip_team_member: {
    en: 'Member of a Meet team',
    nl: 'Lid van een Meet-team',
    es: 'Miembro de un equipo de Meet', // MT
    pt: 'Membro de uma equipa Meet', // MT
    de: 'Mitglied eines Meet-Teams', // MT
    fr: 'Membre d’une équipe Meet', // MT
  },
  last_booked: {
    en: 'Last booked',
    nl: 'Laatst geboekt',
    es: 'Última reserva', // MT
    pt: 'Última reserva', // MT
    de: 'Zuletzt gebucht', // MT
    fr: 'Dernière réservation', // MT
  },
  has_account: {
    en: 'Has account',
    nl: 'Heeft account',
    es: 'Tiene cuenta', // MT
    pt: 'Tem conta', // MT
    de: 'Hat Konto', // MT
    fr: 'A un compte', // MT
  },
  appointments: {
    en: 'Appointments',
    nl: 'Afspraken',
    es: 'Citas', // MT
    pt: 'Marcações', // MT
    de: 'Termine', // MT
    fr: 'Rendez-vous', // MT
  },
  no_appointments: {
    en: 'No appointments yet.',
    nl: 'Nog geen afspraken.',
    es: 'Aún sin citas.', // MT
    pt: 'Ainda sem marcações.', // MT
    de: 'Noch keine Termine.', // MT
    fr: 'Pas encore de rendez-vous.', // MT
  },
  meeting: {
    en: 'Meeting',
    nl: 'Meeting',
    es: 'Reunión', // MT
    pt: 'Reunião', // MT
    de: 'Meeting', // MT
    fr: 'Réunion', // MT
  },
  contacts_footer: {
    en: 'Identity (name, email, address) and change-context fields are managed in The Fibre platform. Open the full profile to edit.',
    nl: 'Identiteit (naam, e-mail, adres) en context-velden worden beheerd in het Fibre-platform. Open het volledige profiel om te bewerken.',
    es: 'La identidad (nombre, correo, dirección) y los campos de contexto se gestionan en la plataforma The Fibre. Abre el perfil completo para editar.', // MT
    pt: 'A identidade (nome, e-mail, morada) e os campos de contexto são geridos na plataforma The Fibre. Abra o perfil completo para editar.', // MT
    de: 'Identität (Name, E-Mail, Adresse) und Kontextfelder werden in der Fibre-Plattform verwaltet. Öffne das vollständige Profil zum Bearbeiten.', // MT
    fr: 'L’identité (nom, e-mail, adresse) et les champs de contexte sont gérés dans la plateforme The Fibre. Ouvre le profil complet pour modifier.', // MT
  },

  // ── teams ─────────────────────────────────────────────────────────────
  teams_title: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipas', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
  },
  teams_desc: {
    en: 'Shared groups that own their own booking links and meeting types.',
    nl: 'Gedeelde groepen met hun eigen boekingslinks en meetingtypes.',
    es: 'Grupos compartidos con sus propios enlaces de reserva y tipos de reunión.', // MT
    pt: 'Grupos partilhados com as suas próprias ligações de reserva e tipos de reunião.', // MT
    de: 'Gemeinsame Gruppen mit eigenen Buchungslinks und Meeting-Typen.', // MT
    fr: 'Des groupes partagés qui possèdent leurs propres liens de réservation et types de réunion.', // MT
  },
  new_team: {
    en: 'New team',
    nl: 'Nieuw team',
    es: 'Nuevo equipo', // MT
    pt: 'Nova equipa', // MT
    de: 'Neues Team', // MT
    fr: 'Nouvelle équipe', // MT
  },
  your_teams: {
    en: 'Your teams',
    nl: 'Jouw teams',
    es: 'Tus equipos', // MT
    pt: 'As suas equipas', // MT
    de: 'Deine Teams', // MT
    fr: 'Tes équipes', // MT
  },
  teams_empty: {
    en: 'No teams yet. Create one to share booking links.',
    nl: 'Nog geen teams. Maak er een aan om boekingslinks te delen.',
    es: 'Aún no hay equipos. Crea uno para compartir enlaces de reserva.', // MT
    pt: 'Ainda não há equipas. Crie uma para partilhar ligações de reserva.', // MT
    de: 'Noch keine Teams. Erstelle eins, um Buchungslinks zu teilen.', // MT
    fr: 'Pas encore d’équipe. Crées-en une pour partager des liens de réservation.', // MT
  },
  role_lead: {
    en: 'Lead',
    nl: 'Lead',
    es: 'Lead', // MT
    pt: 'Lead', // MT
    de: 'Lead', // MT
    fr: 'Lead', // MT
  },
  role_member: {
    en: 'Member',
    nl: 'Lid',
    es: 'Miembro', // MT
    pt: 'Membro', // MT
    de: 'Mitglied', // MT
    fr: 'Membre', // MT
  },
  team_name: {
    en: 'Team name',
    nl: 'Teamnaam',
    es: 'Nombre del equipo', // MT
    pt: 'Nome da equipa', // MT
    de: 'Teamname', // MT
    fr: 'Nom de l’équipe', // MT
  },
  description: {
    en: 'Description',
    nl: 'Beschrijving',
    es: 'Descripción', // MT
    pt: 'Descrição', // MT
    de: 'Beschreibung', // MT
    fr: 'Description', // MT
  },
  active_visible_team: {
    en: 'Active (visible at the team URL)',
    nl: 'Actief (zichtbaar op de team-URL)',
    es: 'Activo (visible en la URL del equipo)', // MT
    pt: 'Ativa (visível na URL da equipa)', // MT
    de: 'Aktiv (unter der Team-URL sichtbar)', // MT
    fr: 'Active (visible à l’URL de l’équipe)', // MT
  },
  create_team: {
    en: 'Create team',
    nl: 'Team aanmaken',
    es: 'Crear equipo', // MT
    pt: 'Criar equipa', // MT
    de: 'Team erstellen', // MT
    fr: 'Créer l’équipe', // MT
  },
  new_team_desc: {
    en: 'A team has its own booking URL and meeting types.',
    nl: 'Een team heeft zijn eigen boekings-URL en meetingtypes.',
    es: 'Un equipo tiene su propia URL de reservas y tipos de reunión.', // MT
    pt: 'Uma equipa tem a sua própria URL de reservas e tipos de reunião.', // MT
    de: 'Ein Team hat seine eigene Buchungs-URL und Meeting-Typen.', // MT
    fr: 'Une équipe a sa propre URL de réservation et ses types de réunion.', // MT
  },
  edit: {
    en: 'Edit',
    nl: 'Bewerken',
    es: 'Editar', // MT
    pt: 'Editar', // MT
    de: 'Bearbeiten', // MT
    fr: 'Modifier', // MT
  },
  team_visibility_desc: {
    en: 'Controls who can see this team and its bookings.',
    nl: 'Bepaalt wie dit team en zijn boekingen kan zien.',
    es: 'Controla quién puede ver este equipo y sus reservas.', // MT
    pt: 'Controla quem pode ver esta equipa e as suas reservas.', // MT
    de: 'Steuert, wer dieses Team und seine Buchungen sehen kann.', // MT
    fr: 'Contrôle qui peut voir cette équipe et ses réservations.', // MT
  },
  members_only: {
    en: 'Members only',
    nl: 'Alleen leden',
    es: 'Solo miembros', // MT
    pt: 'Só membros', // MT
    de: 'Nur Mitglieder', // MT
    fr: 'Membres uniquement', // MT
  },
  members_only_desc: {
    en: 'Only members of this team can see the team and its bookings.',
    nl: 'Alleen leden van dit team zien het team en zijn boekingen.',
    es: 'Solo los miembros de este equipo pueden ver el equipo y sus reservas.', // MT
    pt: 'Só os membros desta equipa podem ver a equipa e as suas reservas.', // MT
    de: 'Nur Mitglieder dieses Teams sehen das Team und seine Buchungen.', // MT
    fr: 'Seuls les membres de cette équipe voient l’équipe et ses réservations.', // MT
  },
  org_wide: {
    en: 'Org-wide',
    nl: 'Hele organisatie',
    es: 'Toda la organización', // MT
    pt: 'Toda a organização', // MT
    de: 'Organisationsweit', // MT
    fr: 'Toute l’organisation', // MT
  },
  org_wide_desc: {
    en: 'Every internal member of the organisation can see this team and its members. Externals still only see what they’re directly added to.',
    nl: 'Elk intern lid van de organisatie ziet dit team en zijn leden. Externen zien nog steeds alleen waar ze direct aan toegevoegd zijn.',
    es: 'Todos los miembros internos de la organización pueden ver este equipo y sus miembros. Los externos solo ven aquello a lo que se les añade directamente.', // MT
    pt: 'Todos os membros internos da organização veem esta equipa e os seus membros. Os externos continuam a ver apenas aquilo a que foram diretamente adicionados.', // MT
    de: 'Jedes interne Mitglied der Organisation sieht dieses Team und seine Mitglieder. Externe sehen weiterhin nur, wozu sie direkt hinzugefügt wurden.', // MT
    fr: 'Chaque membre interne de l’organisation voit cette équipe et ses membres. Les externes ne voient toujours que ce à quoi ils sont directement ajoutés.', // MT
  },
  visibility_leads_only: {
    en: 'Only the team’s leads (or an org admin) can change visibility.',
    nl: 'Alleen de leads van het team (of een organisatie-admin) kunnen de zichtbaarheid wijzigen.',
    es: 'Solo los leads del equipo (o un admin de la organización) pueden cambiar la visibilidad.', // MT
    pt: 'Só os leads da equipa (ou um admin da organização) podem alterar a visibilidade.', // MT
    de: 'Nur die Leads des Teams (oder ein Org-Admin) können die Sichtbarkeit ändern.', // MT
    fr: 'Seuls les leads de l’équipe (ou un admin de l’organisation) peuvent changer la visibilité.', // MT
  },
  members: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  pending_invites: {
    en: 'Pending invites',
    nl: 'Openstaande uitnodigingen',
    es: 'Invitaciones pendientes', // MT
    pt: 'Convites pendentes', // MT
    de: 'Ausstehende Einladungen', // MT
    fr: 'Invitations en attente', // MT
  },
  pending_invites_desc: {
    en: 'These invitees haven’t accepted yet. They’ll start receiving bookings only after they accept. Copy the link if the email didn’t land.',
    nl: 'Deze genodigden hebben nog niet geaccepteerd. Ze ontvangen pas boekingen nadat ze accepteren. Kopieer de link als de e-mail niet is aangekomen.',
    es: 'Estos invitados aún no han aceptado. Solo empezarán a recibir reservas cuando acepten. Copia el enlace si el correo no llegó.', // MT
    pt: 'Estes convidados ainda não aceitaram. Só começam a receber reservas depois de aceitarem. Copie a ligação se o e-mail não chegou.', // MT
    de: 'Diese Eingeladenen haben noch nicht angenommen. Sie erhalten Buchungen erst nach Annahme. Kopiere den Link, falls die E-Mail nicht ankam.', // MT
    fr: 'Ces invités n’ont pas encore accepté. Ils ne recevront des réservations qu’après acceptation. Copie le lien si l’e-mail n’est pas arrivé.', // MT
  },
  team_no_mts: {
    en: 'No meeting types for this team yet.',
    nl: 'Nog geen meetingtypes voor dit team.',
    es: 'Aún no hay tipos de reunión para este equipo.', // MT
    pt: 'Ainda não há tipos de reunião para esta equipa.', // MT
    de: 'Noch keine Meeting-Typen für dieses Team.', // MT
    fr: 'Pas encore de type de réunion pour cette équipe.', // MT
  },
  couldnt_load_team: {
    en: 'Couldn’t load the team.',
    nl: 'Kon het team niet laden.',
    es: 'No se pudo cargar el equipo.', // MT
    pt: 'Não foi possível carregar a equipa.', // MT
    de: 'Team konnte nicht geladen werden.', // MT
    fr: 'Impossible de charger l’équipe.', // MT
  },
  add_a_member: {
    en: 'Add a member',
    nl: 'Lid toevoegen',
    es: 'Añadir un miembro', // MT
    pt: 'Adicionar um membro', // MT
    de: 'Mitglied hinzufügen', // MT
    fr: 'Ajouter un membre', // MT
  },
  if_new_to_fibre: {
    en: 'If new to Fibre',
    nl: 'Als nieuw bij Fibre',
    es: 'Si es nuevo en Fibre', // MT
    pt: 'Se for novo no Fibre', // MT
    de: 'Falls neu bei Fibre', // MT
    fr: 'Si nouveau sur Fibre', // MT
  },
  relationship: {
    en: 'Relationship',
    nl: 'Relatie',
    es: 'Relación', // MT
    pt: 'Relação', // MT
    de: 'Beziehung', // MT
    fr: 'Relation', // MT
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
  relationship_hint: {
    en: 'Internals get org-wide widening; externals only see what they’re added to.',
    nl: 'Internen krijgen organisatiebrede toegang; externen zien alleen waar ze aan toegevoegd zijn.',
    es: 'Los internos obtienen alcance de toda la organización; los externos solo ven aquello a lo que se les añade.', // MT
    pt: 'Os internos ganham alcance em toda a organização; os externos só veem aquilo a que são adicionados.', // MT
    de: 'Interne bekommen organisationsweite Sicht; Externe sehen nur, wozu sie hinzugefügt werden.', // MT
    fr: 'Les internes ont une portée sur toute l’organisation ; les externes ne voient que ce à quoi ils sont ajoutés.', // MT
  },
  adding: {
    en: 'Adding…',
    nl: 'Toevoegen…',
    es: 'Añadiendo…', // MT
    pt: 'A adicionar…', // MT
    de: 'Wird hinzugefügt…', // MT
    fr: 'Ajout…', // MT
  },
  invite_sent_team: {
    en: 'Invite email sent. They’re on the team — they’ll start receiving bookings once they sign in to The Fibre.',
    nl: 'Uitnodigingsmail verstuurd. Ze staan in het team — ze ontvangen boekingen zodra ze inloggen bij The Fibre.',
    es: 'Correo de invitación enviado. Ya están en el equipo: empezarán a recibir reservas cuando inicien sesión en The Fibre.', // MT
    pt: 'E-mail de convite enviado. Já estão na equipa — começam a receber reservas assim que iniciarem sessão no The Fibre.', // MT
    de: 'Einladungs-E-Mail gesendet. Sie sind im Team — Buchungen erhalten sie, sobald sie sich bei The Fibre anmelden.', // MT
    fr: 'E-mail d’invitation envoyé. La personne est dans l’équipe — elle recevra des réservations dès sa connexion à The Fibre.', // MT
  },
  invited_on: {
    en: 'invited {date}',
    nl: 'uitgenodigd op {date}',
    es: 'invitado el {date}', // MT
    pt: 'convidado a {date}', // MT
    de: 'eingeladen am {date}', // MT
    fr: 'invité le {date}', // MT
  },
  copied_short: {
    en: 'Copied',
    nl: 'Gekopieerd',
    es: 'Copiado', // MT
    pt: 'Copiado', // MT
    de: 'Kopiert', // MT
    fr: 'Copié', // MT
  },
  resend: {
    en: 'Resend',
    nl: 'Opnieuw versturen',
    es: 'Reenviar', // MT
    pt: 'Reenviar', // MT
    de: 'Erneut senden', // MT
    fr: 'Renvoyer', // MT
  },
  revoke: {
    en: 'Revoke',
    nl: 'Intrekken',
    es: 'Revocar', // MT
    pt: 'Revogar', // MT
    de: 'Widerrufen', // MT
    fr: 'Révoquer', // MT
  },

  // ── internal team ─────────────────────────────────────────────────────
  it_title: {
    en: 'Internal team',
    nl: 'Intern team',
    es: 'Equipo interno', // MT
    pt: 'Equipa interna', // MT
    de: 'Internes Team', // MT
    fr: 'Équipe interne', // MT
  },
  it_desc: {
    en: 'Workspace members who can sign in to Meet. External collaborators don’t live here — add them per team.',
    nl: 'Werkruimteleden die kunnen inloggen bij Meet. Externe samenwerkers staan hier niet — voeg die per team toe.',
    es: 'Miembros del espacio de trabajo que pueden iniciar sesión en Meet. Los colaboradores externos no viven aquí: añádelos por equipo.', // MT
    pt: 'Membros do espaço de trabalho que podem iniciar sessão no Meet. Os colaboradores externos não vivem aqui — adicione-os por equipa.', // MT
    de: 'Workspace-Mitglieder, die sich bei Meet anmelden können. Externe Mitwirkende leben hier nicht — füge sie pro Team hinzu.', // MT
    fr: 'Les membres de l’espace de travail qui peuvent se connecter à Meet. Les collaborateurs externes ne vivent pas ici — ajoute-les par équipe.', // MT
  },
  it_notice: {
    en: 'Members are now managed centrally in The Fibre → Settings → Members. This page still works, but moves there next release.',
    nl: 'Leden worden nu centraal beheerd in The Fibre → Instellingen → Leden. Deze pagina werkt nog, maar verhuist daarheen in de volgende release.',
    es: 'Los miembros ahora se gestionan centralmente en The Fibre → Ajustes → Miembros. Esta página aún funciona, pero se mudará allí en la próxima versión.', // MT
    pt: 'Os membros agora são geridos centralmente em The Fibre → Definições → Membros. Esta página ainda funciona, mas muda para lá na próxima versão.', // MT
    de: 'Mitglieder werden jetzt zentral in The Fibre → Einstellungen → Mitglieder verwaltet. Diese Seite funktioniert noch, zieht aber im nächsten Release dorthin um.', // MT
    fr: 'Les membres sont désormais gérés de façon centralisée dans The Fibre → Paramètres → Membres. Cette page fonctionne encore, mais y déménagera à la prochaine version.', // MT
  },
  it_section: {
    en: 'Internal team ({n})',
    nl: 'Intern team ({n})',
    es: 'Equipo interno ({n})', // MT
    pt: 'Equipa interna ({n})', // MT
    de: 'Internes Team ({n})', // MT
    fr: 'Équipe interne ({n})', // MT
  },
  it_section_desc: {
    en: 'Everyone who can sign in to Meet. Admins can change roles and relationship types.',
    nl: 'Iedereen die kan inloggen bij Meet. Admins kunnen rollen en relatietypes wijzigen.',
    es: 'Todos los que pueden iniciar sesión en Meet. Los admins pueden cambiar roles y tipos de relación.', // MT
    pt: 'Todos os que podem iniciar sessão no Meet. Os admins podem alterar funções e tipos de relação.', // MT
    de: 'Alle, die sich bei Meet anmelden können. Admins können Rollen und Beziehungstypen ändern.', // MT
    fr: 'Toutes les personnes qui peuvent se connecter à Meet. Les admins peuvent changer les rôles et types de relation.', // MT
  },
  invite_member: {
    en: 'Invite a member',
    nl: 'Lid uitnodigen',
    es: 'Invitar a un miembro', // MT
    pt: 'Convidar um membro', // MT
    de: 'Mitglied einladen', // MT
    fr: 'Inviter un membre', // MT
  },
  invite_member_desc: {
    en: 'They’ll get an email with a link to sign in with Google.',
    nl: 'Ze krijgen een e-mail met een link om in te loggen met Google.',
    es: 'Recibirán un correo con un enlace para iniciar sesión con Google.', // MT
    pt: 'Vão receber um e-mail com uma ligação para iniciar sessão com o Google.', // MT
    de: 'Sie bekommen eine E-Mail mit einem Link zum Anmelden mit Google.', // MT
    fr: 'La personne recevra un e-mail avec un lien pour se connecter avec Google.', // MT
  },
  full_name: {
    en: 'Full name',
    nl: 'Volledige naam',
    es: 'Nombre completo', // MT
    pt: 'Nome completo', // MT
    de: 'Vollständiger Name', // MT
    fr: 'Nom complet', // MT
  },
  inviting: {
    en: 'Inviting…',
    nl: 'Uitnodigen…',
    es: 'Invitando…', // MT
    pt: 'A convidar…', // MT
    de: 'Wird eingeladen…', // MT
    fr: 'Invitation…', // MT
  },
  send_invite: {
    en: 'Send invite',
    nl: 'Uitnodiging versturen',
    es: 'Enviar invitación', // MT
    pt: 'Enviar convite', // MT
    de: 'Einladung senden', // MT
    fr: 'Envoyer l’invitation', // MT
  },
  invite_sent_internal: {
    en: 'Invite sent. They’ll appear above once they sign in.',
    nl: 'Uitnodiging verstuurd. Ze verschijnen hierboven zodra ze inloggen.',
    es: 'Invitación enviada. Aparecerán arriba cuando inicien sesión.', // MT
    pt: 'Convite enviado. Vão aparecer acima assim que iniciarem sessão.', // MT
    de: 'Einladung gesendet. Sie erscheinen oben, sobald sie sich anmelden.', // MT
    fr: 'Invitation envoyée. La personne apparaîtra ci-dessus dès sa connexion.', // MT
  },
  granted_access: {
    en: 'Granted Meet access to the existing user.',
    nl: 'Meet-toegang gegeven aan de bestaande gebruiker.',
    es: 'Acceso a Meet concedido al usuario existente.', // MT
    pt: 'Acesso ao Meet concedido ao utilizador existente.', // MT
    de: 'Meet-Zugriff für den bestehenden Nutzer freigegeben.', // MT
    fr: 'Accès à Meet accordé à l’utilisateur existant.', // MT
  },
  badge_no_meet: {
    en: 'No Meet',
    nl: 'Geen Meet',
    es: 'Sin Meet', // MT
    pt: 'Sem Meet', // MT
    de: 'Kein Meet', // MT
    fr: 'Sans Meet', // MT
  },
  role_organiser: {
    en: 'Organiser',
    nl: 'Organisator',
    es: 'Organizador', // MT
    pt: 'Organizador', // MT
    de: 'Organisator', // MT
    fr: 'Organisateur', // MT
  },
  role_admin: {
    en: 'Admin',
    nl: 'Admin',
    es: 'Admin', // MT
    pt: 'Admin', // MT
    de: 'Admin', // MT
    fr: 'Admin', // MT
  },
  role_super_admin: {
    en: 'Super admin',
    nl: 'Superadmin',
    es: 'Superadmin', // MT
    pt: 'Superadmin', // MT
    de: 'Superadmin', // MT
    fr: 'Super admin', // MT
  },

  // ── invoices ──────────────────────────────────────────────────────────
  invoices_title: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  invoices_desc: {
    en: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
    nl: 'Elke aankoop in je Fibre-apps — zoeken, facturen opnieuw versturen, terugbetalen.',
    es: 'Cada compra en tus apps de Fibre: busca, reenvía facturas, reembolsa.', // MT
    pt: 'Cada compra nas suas apps Fibre — pesquise, reenvie faturas, reembolse.', // MT
    de: 'Jeder Kauf in deinen Fibre-Apps — suchen, Rechnungen erneut senden, erstatten.', // MT
    fr: 'Chaque achat dans tes apps Fibre — chercher, renvoyer des factures, rembourser.', // MT
  },

  // ── help ──────────────────────────────────────────────────────────────
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  help_home_blurb: {
    en: 'Today, and what is booked next.',
    nl: 'Vandaag, en wat hierna geboekt staat.',
    es: 'Hoy, y lo próximo reservado.', // MT
    pt: 'Hoje, e o que está reservado a seguir.', // MT
    de: 'Heute, und was als Nächstes gebucht ist.', // MT
    fr: 'Aujourd’hui, et ce qui est réservé ensuite.', // MT
  },
  help_mt_blurb: {
    en: 'What you offer to be booked for — length, availability, price, where it happens.',
    nl: 'Waarvoor je geboekt kunt worden — duur, beschikbaarheid, prijs, waar het plaatsvindt.',
    es: 'Aquello para lo que te pueden reservar: duración, disponibilidad, precio, dónde ocurre.', // MT
    pt: 'Aquilo para que pode ser reservado — duração, disponibilidade, preço, onde acontece.', // MT
    de: 'Wofür du gebucht werden kannst — Dauer, Verfügbarkeit, Preis, wo es stattfindet.', // MT
    fr: 'Ce pour quoi on peut te réserver — durée, disponibilité, prix, lieu.', // MT
  },
  help_contacts_blurb: {
    en: 'People Meet has a reason to know about — invitees on bookings, and members of your Meet teams. Identity is managed in The Fibre platform.',
    nl: 'Mensen waar Meet een reden voor heeft — genodigden op boekingen en leden van je Meet-teams. Identiteit wordt beheerd in het Fibre-platform.',
    es: 'Personas que Meet tiene motivo para conocer: invitados de reservas y miembros de tus equipos de Meet. La identidad se gestiona en la plataforma The Fibre.', // MT
    pt: 'Pessoas que o Meet tem motivo para conhecer — convidados de reservas e membros das suas equipas Meet. A identidade é gerida na plataforma The Fibre.', // MT
    de: 'Menschen, die Meet aus gutem Grund kennt — Eingeladene von Buchungen und Mitglieder deiner Meet-Teams. Identität wird in der Fibre-Plattform verwaltet.', // MT
    fr: 'Les personnes que Meet a une raison de connaître — invités des réservations et membres de tes équipes Meet. L’identité est gérée dans la plateforme The Fibre.', // MT
  },
  help_settings_blurb: {
    en: 'Personal and workspace configuration — calendar connection, payments, defaults.',
    nl: 'Persoonlijke en werkruimte-instellingen — agendakoppeling, betalingen, standaarden.',
    es: 'Configuración personal y del espacio de trabajo: conexión de calendario, pagos, valores predeterminados.', // MT
    pt: 'Configuração pessoal e do espaço de trabalho — ligação de calendário, pagamentos, predefinições.', // MT
    de: 'Persönliche und Workspace-Konfiguration — Kalenderverbindung, Zahlungen, Standards.', // MT
    fr: 'Configuration personnelle et de l’espace de travail — connexion du calendrier, paiements, réglages par défaut.', // MT
  },

  // ── booking details dialog ────────────────────────────────────────────
  when: {
    en: 'When',
    nl: 'Wanneer',
    es: 'Cuándo', // MT
    pt: 'Quando', // MT
    de: 'Wann', // MT
    fr: 'Quand', // MT
  },
  what: {
    en: 'What',
    nl: 'Wat',
    es: 'Qué', // MT
    pt: 'O quê', // MT
    de: 'Was', // MT
    fr: 'Quoi', // MT
  },
  where: {
    en: 'Where',
    nl: 'Waar',
    es: 'Dónde', // MT
    pt: 'Onde', // MT
    de: 'Wo', // MT
    fr: 'Où', // MT
  },
  team_dot: {
    en: 'Team {name}',
    nl: 'Team {name}',
    es: 'Equipo {name}', // MT
    pt: 'Equipa {name}', // MT
    de: 'Team {name}', // MT
    fr: 'Équipe {name}', // MT
  },
  join_meeting: {
    en: 'Join meeting',
    nl: 'Deelnemen aan meeting',
    es: 'Unirse a la reunión', // MT
    pt: 'Entrar na reunião', // MT
    de: 'Meeting beitreten', // MT
    fr: 'Rejoindre la réunion', // MT
  },
  reject: {
    en: 'Reject',
    nl: 'Afwijzen',
    es: 'Rechazar', // MT
    pt: 'Rejeitar', // MT
    de: 'Ablehnen', // MT
    fr: 'Rejeter', // MT
  },
  approve: {
    en: 'Approve',
    nl: 'Goedkeuren',
    es: 'Aprobar', // MT
    pt: 'Aprovar', // MT
    de: 'Freigeben', // MT
    fr: 'Approuver', // MT
  },
  approving: {
    en: 'Approving…',
    nl: 'Goedkeuren…',
    es: 'Aprobando…', // MT
    pt: 'A aprovar…', // MT
    de: 'Wird freigegeben…', // MT
    fr: 'Approbation…', // MT
  },
  reject_confirm: {
    en: 'Reject this booking? The invitee will get a notification email.',
    nl: 'Deze boeking afwijzen? De genodigde krijgt een notificatiemail.',
    es: '¿Rechazar esta reserva? El invitado recibirá un correo de aviso.', // MT
    pt: 'Rejeitar esta reserva? O convidado vai receber um e-mail de notificação.', // MT
    de: 'Diese Buchung ablehnen? Der Eingeladene erhält eine Benachrichtigungs-E-Mail.', // MT
    fr: 'Rejeter cette réservation ? L’invité recevra un e-mail de notification.', // MT
  },
  cancel_booking: {
    en: 'Cancel this booking',
    nl: 'Deze boeking annuleren',
    es: 'Cancelar esta reserva', // MT
    pt: 'Cancelar esta reserva', // MT
    de: 'Diese Buchung stornieren', // MT
    fr: 'Annuler cette réservation', // MT
  },

  // ── working-hours editor ──────────────────────────────────────────────
  day_full_mon: { en: 'Monday', nl: 'Maandag', es: 'Lunes', pt: 'Segunda-feira', de: 'Montag', fr: 'Lundi' },
  day_full_tue: { en: 'Tuesday', nl: 'Dinsdag', es: 'Martes', pt: 'Terça-feira', de: 'Dienstag', fr: 'Mardi' },
  day_full_wed: { en: 'Wednesday', nl: 'Woensdag', es: 'Miércoles', pt: 'Quarta-feira', de: 'Mittwoch', fr: 'Mercredi' },
  day_full_thu: { en: 'Thursday', nl: 'Donderdag', es: 'Jueves', pt: 'Quinta-feira', de: 'Donnerstag', fr: 'Jeudi' },
  day_full_fri: { en: 'Friday', nl: 'Vrijdag', es: 'Viernes', pt: 'Sexta-feira', de: 'Freitag', fr: 'Vendredi' },
  day_full_sat: { en: 'Saturday', nl: 'Zaterdag', es: 'Sábado', pt: 'Sábado', de: 'Samstag', fr: 'Samedi' },
  day_full_sun: { en: 'Sunday', nl: 'Zondag', es: 'Domingo', pt: 'Domingo', de: 'Sonntag', fr: 'Dimanche' },
  unavailable: {
    en: 'Unavailable',
    nl: 'Niet beschikbaar',
    es: 'No disponible', // MT
    pt: 'Indisponível', // MT
    de: 'Nicht verfügbar', // MT
    fr: 'Indisponible', // MT
  },
  add_block: {
    en: 'Add block',
    nl: 'Blok toevoegen',
    es: 'Añadir bloque', // MT
    pt: 'Adicionar bloco', // MT
    de: 'Block hinzufügen', // MT
    fr: 'Ajouter un bloc', // MT
  },
  remove_block: {
    en: 'Remove time block',
    nl: 'Tijdblok verwijderen',
    es: 'Quitar bloque horario', // MT
    pt: 'Remover bloco horário', // MT
    de: 'Zeitblock entfernen', // MT
    fr: 'Retirer le bloc horaire', // MT
  },

  // ── intake fields editor ──────────────────────────────────────────────
  intake_no_questions: {
    en: 'No questions yet. Bookings will only collect name + email.',
    nl: 'Nog geen vragen. Boekingen vragen alleen naam + e-mail.',
    es: 'Aún sin preguntas. Las reservas solo recogerán nombre y correo.', // MT
    pt: 'Ainda sem perguntas. As reservas só vão recolher nome e e-mail.', // MT
    de: 'Noch keine Fragen. Buchungen erfassen nur Name + E-Mail.', // MT
    fr: 'Pas encore de questions. Les réservations ne recueilleront que nom + e-mail.', // MT
  },
  add_question: {
    en: 'Add a question',
    nl: 'Vraag toevoegen',
    es: 'Añadir una pregunta', // MT
    pt: 'Adicionar uma pergunta', // MT
    de: 'Frage hinzufügen', // MT
    fr: 'Ajouter une question', // MT
  },
  question_n: {
    en: 'Question {n}',
    nl: 'Vraag {n}',
    es: 'Pregunta {n}', // MT
    pt: 'Pergunta {n}', // MT
    de: 'Frage {n}', // MT
    fr: 'Question {n}', // MT
  },
  move_up: {
    en: 'Move up',
    nl: 'Omhoog',
    es: 'Subir', // MT
    pt: 'Mover para cima', // MT
    de: 'Nach oben', // MT
    fr: 'Monter', // MT
  },
  move_down: {
    en: 'Move down',
    nl: 'Omlaag',
    es: 'Bajar', // MT
    pt: 'Mover para baixo', // MT
    de: 'Nach unten', // MT
    fr: 'Descendre', // MT
  },
  question: {
    en: 'Question',
    nl: 'Vraag',
    es: 'Pregunta', // MT
    pt: 'Pergunta', // MT
    de: 'Frage', // MT
    fr: 'Question', // MT
  },
  question_placeholder: {
    en: 'What would you like to discuss?',
    nl: 'Wat wil je bespreken?',
    es: '¿Qué te gustaría tratar?', // MT
    pt: 'O que gostaria de discutir?', // MT
    de: 'Worüber möchtest du sprechen?', // MT
    fr: 'De quoi veux-tu discuter ?', // MT
  },
  type: {
    en: 'Type',
    nl: 'Type',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Typ', // MT
    fr: 'Type', // MT
  },
  options: {
    en: 'Options',
    nl: 'Opties',
    es: 'Opciones', // MT
    pt: 'Opções', // MT
    de: 'Optionen', // MT
    fr: 'Options', // MT
  },
  option_n: {
    en: 'Option {n}',
    nl: 'Optie {n}',
    es: 'Opción {n}', // MT
    pt: 'Opção {n}', // MT
    de: 'Option {n}', // MT
    fr: 'Option {n}', // MT
  },
  add_option: {
    en: 'Add option',
    nl: 'Optie toevoegen',
    es: 'Añadir opción', // MT
    pt: 'Adicionar opção', // MT
    de: 'Option hinzufügen', // MT
    fr: 'Ajouter une option', // MT
  },
  remove_option: {
    en: 'Remove option',
    nl: 'Optie verwijderen',
    es: 'Quitar opción', // MT
    pt: 'Remover opção', // MT
    de: 'Option entfernen', // MT
    fr: 'Retirer l’option', // MT
  },
  required: {
    en: 'Required',
    nl: 'Verplicht',
    es: 'Obligatoria', // MT
    pt: 'Obrigatória', // MT
    de: 'Pflichtfeld', // MT
    fr: 'Obligatoire', // MT
  },
  only_show_if: {
    en: 'Only show this question if…',
    nl: 'Toon deze vraag alleen als…',
    es: 'Mostrar esta pregunta solo si…', // MT
    pt: 'Mostrar esta pergunta apenas se…', // MT
    de: 'Diese Frage nur zeigen, wenn…', // MT
    fr: 'N’afficher cette question que si…', // MT
  },
  equals: {
    en: 'equals',
    nl: 'gelijk is aan',
    es: 'es igual a', // MT
    pt: 'é igual a', // MT
    de: 'gleich ist', // MT
    fr: 'vaut', // MT
  },
  checked: {
    en: 'checked',
    nl: 'aangevinkt',
    es: 'marcada', // MT
    pt: 'marcada', // MT
    de: 'angehakt', // MT
    fr: 'cochée', // MT
  },
  not_checked: {
    en: 'not checked',
    nl: 'niet aangevinkt',
    es: 'sin marcar', // MT
    pt: 'não marcada', // MT
    de: 'nicht angehakt', // MT
    fr: 'non cochée', // MT
  },
  slug_auto_placeholder: {
    en: 'auto-generated',
    nl: 'automatisch gegenereerd',
    es: 'generado automáticamente', // MT
    pt: 'gerado automaticamente', // MT
    de: 'automatisch erzeugt', // MT
    fr: 'généré automatiquement', // MT
  },
  slug_alt_title: {
    en: 'Suggest an alternative slug',
    nl: 'Stel een alternatieve slug voor',
    es: 'Sugerir un slug alternativo', // MT
    pt: 'Sugerir um slug alternativo', // MT
    de: 'Alternativen Slug vorschlagen', // MT
    fr: 'Suggérer un slug alternatif', // MT
  },
  type_short: {
    en: 'Short text',
    nl: 'Korte tekst',
    es: 'Texto corto', // MT
    pt: 'Texto curto', // MT
    de: 'Kurzer Text', // MT
    fr: 'Texte court', // MT
  },
  type_long: {
    en: 'Long text',
    nl: 'Lange tekst',
    es: 'Texto largo', // MT
    pt: 'Texto longo', // MT
    de: 'Langer Text', // MT
    fr: 'Texte long', // MT
  },
  type_select: {
    en: 'Single choice',
    nl: 'Enkele keuze',
    es: 'Elección única', // MT
    pt: 'Escolha única', // MT
    de: 'Einfachauswahl', // MT
    fr: 'Choix unique', // MT
  },
  type_checkbox: {
    en: 'Checkbox',
    nl: 'Selectievakje',
    es: 'Casilla', // MT
    pt: 'Caixa de seleção', // MT
    de: 'Kontrollkästchen', // MT
    fr: 'Case à cocher', // MT
  },

  // ── sidebar / bottom-nav (added at NAV translation) ──────────────────
  nav_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  nav_contacts: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contatos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  nav_meeting_types: {
    en: 'Meeting types',
    nl: 'Meetingtypes',
    es: 'Tipos de reunión', // MT
    pt: 'Tipos de reunião', // MT
    de: 'Meeting-Typen', // MT
    fr: 'Types de réunion', // MT
  },
  nav_teams: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipes', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
  },
  nav_bookings: {
    en: 'Bookings',
    nl: 'Boekingen',
    es: 'Reservas', // MT
    pt: 'Reservas', // MT
    de: 'Buchungen', // MT
    fr: 'Réservations', // MT
  },
  nav_invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  nav_internal_team: {
    en: 'Internal team',
    nl: 'Intern team',
    es: 'Equipo interno', // MT
    pt: 'Equipe interna', // MT
    de: 'Internes Team', // MT
    fr: 'Équipe interne', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
