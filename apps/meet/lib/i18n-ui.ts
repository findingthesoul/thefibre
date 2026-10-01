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
  cal_free_busy_label: {
    en: 'Events marked Free still block',
    nl: 'Afspraken met “vrij” blokkeren ook',
    es: 'Los eventos marcados como Libre también bloquean', // MT
    pt: 'Os eventos marcados como Livre também bloqueiam', // MT
    de: 'Termine mit „Frei“ blockieren trotzdem', // MT
    fr: 'Les événements marqués Libre bloquent aussi', // MT
  },
  cal_free_busy_hint: {
    en: 'Google leaves events marked Free out of your availability, so Meet offers those hours. Turn this on and every timed event blocks, whatever it is marked. All-day events and meetings you declined never block.',
    nl: 'Google laat afspraken met “vrij” weg uit je beschikbaarheid, dus Meet biedt die uren aan. Zet dit aan en elke afspraak met een tijd blokkeert, hoe die ook staat. Hele dagen en afgezegde afspraken blokkeren nooit.',
    es: 'Google omite de tu disponibilidad los eventos marcados como Libre, así que Meet ofrece esas horas. Actívalo y cualquier evento con hora bloquea, esté como esté marcado. Los eventos de todo el día y las reuniones que rechazaste nunca bloquean.', // MT
    pt: 'O Google deixa de fora da sua disponibilidade os eventos marcados como Livre, por isso o Meet oferece essas horas. Ative isto e qualquer evento com hora bloqueia, seja como for marcado. Eventos de dia inteiro e reuniões recusadas nunca bloqueiam.', // MT
    de: 'Google lässt als „Frei“ markierte Termine aus deiner Verfügbarkeit heraus, also bietet Meet diese Stunden an. Schalte das ein, und jeder Termin mit Uhrzeit blockiert, egal wie er markiert ist. Ganztägige Termine und abgesagte Meetings blockieren nie.', // MT
    fr: 'Google exclut de ta disponibilité les événements marqués Libre, donc Meet propose ces heures. Active ceci et tout événement avec une heure bloque, quelle que soit sa marque. Les journées entières et les réunions refusées ne bloquent jamais.', // MT
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
  // ── Zoom (v0.59.0) ────────────────────────────────────────────────────
  zoom_desc: {
    en: 'Create a Zoom meeting automatically for every booking on a meeting type set to Zoom. The join link goes into the calendar event and the confirmation email.',
    nl: 'Maakt automatisch een Zoom-meeting voor elke boeking op een afspraaktype dat op Zoom staat. De deelnamelink komt in de agenda-afspraak en de bevestigingsmail.',
    es: 'Crea automáticamente una reunión de Zoom para cada reserva de un tipo de reunión configurado con Zoom. El enlace va en el evento del calendario y en el correo de confirmación.', // MT
    pt: 'Cria automaticamente uma reunião Zoom para cada marcação de um tipo de reunião definido como Zoom. A ligação entra no evento do calendário e no e-mail de confirmação.', // MT
    de: 'Legt für jede Buchung eines Meeting-Typs mit Zoom automatisch ein Zoom-Meeting an. Der Link steht im Kalendereintrag und in der Bestätigungsmail.', // MT
    fr: 'Crée automatiquement une réunion Zoom pour chaque réservation d’un type de réunion réglé sur Zoom. Le lien figure dans l’événement du calendrier et dans l’e-mail de confirmation.', // MT
  },
  zoom_connected_msg: {
    en: '✓ Connected.',
    nl: '✓ Gekoppeld.',
    es: '✓ Conectado.', // MT
    pt: '✓ Ligado.', // MT
    de: '✓ Verbunden.', // MT
    fr: '✓ Connecté.', // MT
  },
  zoom_error_msg: {
    en: 'Couldn’t connect{reason}. Try again, or check that your Zoom account still allows this app.',
    nl: 'Koppelen mislukt{reason}. Probeer opnieuw of check of je Zoom-account deze app nog toestaat.',
    es: 'No se pudo conectar{reason}. Inténtalo de nuevo o comprueba que tu cuenta de Zoom siga permitiendo esta app.', // MT
    pt: 'Não foi possível ligar{reason}. Tente novamente ou verifique se a sua conta Zoom ainda permite esta app.', // MT
    de: 'Verbindung fehlgeschlagen{reason}. Versuch es erneut oder prüfe, ob dein Zoom-Konto diese App noch zulässt.', // MT
    fr: 'Connexion impossible{reason}. Réessaie ou vérifie que ton compte Zoom autorise toujours cette application.', // MT
  },
  zoom_start_failed: {
    en: 'Could not start Zoom connect.',
    nl: 'Kon de Zoom-koppeling niet starten.',
    es: 'No se pudo iniciar la conexión con Zoom.', // MT
    pt: 'Não foi possível iniciar a ligação ao Zoom.', // MT
    de: 'Zoom-Verbindung konnte nicht gestartet werden.', // MT
    fr: 'Impossible de démarrer la connexion Zoom.', // MT
  },
  connect_zoom: {
    en: 'Connect Zoom',
    nl: 'Zoom koppelen',
    es: 'Conectar Zoom', // MT
    pt: 'Ligar o Zoom', // MT
    de: 'Zoom verbinden', // MT
    fr: 'Connecter Zoom', // MT
  },
  zoom_not_configured: {
    en: 'Zoom isn’t set up on this server yet. Ask your workspace admin.',
    nl: 'Zoom is nog niet ingesteld op deze server. Vraag je workspace-beheerder.',
    es: 'Zoom aún no está configurado en este servidor. Pregunta a la administración de tu espacio.', // MT
    pt: 'O Zoom ainda não está configurado neste servidor. Fale com a administração do seu espaço.', // MT
    de: 'Zoom ist auf diesem Server noch nicht eingerichtet. Frag deine Workspace-Admin.', // MT
    fr: 'Zoom n’est pas encore configuré sur ce serveur. Demande à l’administration de ton espace.', // MT
  },
  zoom_account: {
    en: 'Zoom account: {email}',
    nl: 'Zoom-account: {email}',
    es: 'Cuenta de Zoom: {email}', // MT
    pt: 'Conta Zoom: {email}', // MT
    de: 'Zoom-Konto: {email}', // MT
    fr: 'Compte Zoom : {email}', // MT
  },
  zoom_not_connected_hint: {
    en: 'Zoom becomes selectable once you connect your account in',
    nl: 'Zoom wordt kiesbaar zodra je je account koppelt in',
    es: 'Zoom estará disponible cuando conectes tu cuenta en', // MT
    pt: 'O Zoom fica disponível assim que ligar a sua conta em', // MT
    de: 'Zoom wird wählbar, sobald du dein Konto verbindest unter', // MT
    fr: 'Zoom devient sélectionnable dès que tu connectes ton compte dans', // MT
  },
  // ── Round-robin fairness (v0.59.0) ────────────────────────────────────
  rr_fairness: {
    en: 'Who gets the booking',
    nl: 'Wie de boeking krijgt',
    es: 'Quién recibe la reserva', // MT
    pt: 'Quem fica com a marcação', // MT
    de: 'Wer die Buchung bekommt', // MT
    fr: 'Qui reçoit la réservation', // MT
  },
  rr_fairness_desc: {
    en: 'When more than one assignee is free at the chosen time.',
    nl: 'Wanneer meerdere toegewezen mensen vrij zijn op het gekozen moment.',
    es: 'Cuando hay más de una persona asignada libre a esa hora.', // MT
    pt: 'Quando há mais do que uma pessoa atribuída livre a essa hora.', // MT
    de: 'Wenn mehrere zugewiesene Personen zur gewählten Zeit frei sind.', // MT
    fr: 'Quand plusieurs personnes assignées sont libres à ce créneau.', // MT
  },
  rr_least_loaded: {
    en: 'Fewest upcoming meetings',
    nl: 'Minste komende meetings',
    es: 'Menos reuniones próximas', // MT
    pt: 'Menos reuniões futuras', // MT
    de: 'Wenigste anstehende Meetings', // MT
    fr: 'Le moins de réunions à venir', // MT
  },
  rr_least_recent: {
    en: 'Whoever waited longest',
    nl: 'Wie het langst wachtte',
    es: 'Quien lleva más tiempo esperando', // MT
    pt: 'Quem esperou mais tempo', // MT
    de: 'Wer am längsten gewartet hat', // MT
    fr: 'Celui ou celle qui attend depuis le plus longtemps', // MT
  },
  rr_strict_rotation: {
    en: 'Strict rotation, in order',
    nl: 'Strikte rotatie, op volgorde',
    es: 'Rotación estricta, por orden', // MT
    pt: 'Rotação estrita, por ordem', // MT
    de: 'Strikte Rotation, der Reihe nach', // MT
    fr: 'Rotation stricte, dans l’ordre', // MT
  },
  rr_random: {
    en: 'At random',
    nl: 'Willekeurig',
    es: 'Al azar', // MT
    pt: 'Ao acaso', // MT
    de: 'Zufällig', // MT
    fr: 'Au hasard', // MT
  },
  // ── Per-team availability (v0.59.0) ───────────────────────────────────
  team_hours_title: {
    en: 'Availability for this team',
    nl: 'Beschikbaarheid voor dit team',
    es: 'Disponibilidad para este equipo', // MT
    pt: 'Disponibilidade para esta equipa', // MT
    de: 'Verfügbarkeit für dieses Team', // MT
    fr: 'Disponibilité pour cette équipe', // MT
  },
  team_hours_desc: {
    en: 'Narrower hours that apply only to this team’s meeting types. Leave off to use your own weekly hours.',
    nl: 'Beperktere uren die alleen gelden voor de afspraaktypes van dit team. Laat uit om je eigen weekuren te gebruiken.',
    es: 'Horas más restringidas que solo se aplican a los tipos de reunión de este equipo. Déjalo desactivado para usar tus horas semanales.', // MT
    pt: 'Horas mais restritas que só se aplicam aos tipos de reunião desta equipa. Deixe desligado para usar as suas horas semanais.', // MT
    de: 'Engere Zeiten, die nur für die Meeting-Typen dieses Teams gelten. Aus lassen, um deine eigenen Wochenzeiten zu nutzen.', // MT
    fr: 'Des horaires plus restreints qui ne valent que pour les types de réunion de cette équipe. Laisse désactivé pour utiliser tes horaires hebdomadaires.', // MT
  },
  team_hours_use_own: {
    en: 'Use my own weekly hours',
    nl: 'Mijn eigen weekuren gebruiken',
    es: 'Usar mis horas semanales', // MT
    pt: 'Usar as minhas horas semanais', // MT
    de: 'Meine eigenen Wochenzeiten verwenden', // MT
    fr: 'Utiliser mes horaires hebdomadaires', // MT
  },
  team_hours_custom: {
    en: 'Different hours for this team',
    nl: 'Andere uren voor dit team',
    es: 'Horas distintas para este equipo', // MT
    pt: 'Horas diferentes para esta equipa', // MT
    de: 'Andere Zeiten für dieses Team', // MT
    fr: 'Des horaires différents pour cette équipe', // MT
  },
  team_hours_edit: {
    en: 'Team availability',
    nl: 'Teambeschikbaarheid',
    es: 'Disponibilidad del equipo', // MT
    pt: 'Disponibilidade da equipa', // MT
    de: 'Teamverfügbarkeit', // MT
    fr: 'Disponibilité de l’équipe', // MT
  },
  team_hours_set: {
    en: 'Custom hours set',
    nl: 'Aangepaste uren ingesteld',
    es: 'Horas personalizadas definidas', // MT
    pt: 'Horas personalizadas definidas', // MT
    de: 'Eigene Zeiten gesetzt', // MT
    fr: 'Horaires personnalisés définis', // MT
  },
  booking_amount: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago', // MT
    pt: 'Pagamento', // MT
    de: 'Zahlung', // MT
    fr: 'Paiement', // MT
  },
  booking_paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'Pagado', // MT
    pt: 'Pago', // MT
    de: 'Bezahlt', // MT
    fr: 'Payé', // MT
  },
  // ── Reimbursement from a booking (v0.59.0) ────────────────────────────
  booking_reimburse: {
    en: 'Reimburse',
    nl: 'Terugbetalen',
    es: 'Reembolsar', // MT
    pt: 'Reembolsar', // MT
    de: 'Erstatten', // MT
    fr: 'Rembourser', // MT
  },
  booking_refunded: {
    en: 'Reimbursed',
    nl: 'Terugbetaald',
    es: 'Reembolsado', // MT
    pt: 'Reembolsado', // MT
    de: 'Erstattet', // MT
    fr: 'Remboursé', // MT
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
    en: 'Default payment options',
    nl: 'Standaard betaalopties',
    es: 'Opciones de pago por defecto', // MT
    pt: 'Opções de pagamento padrão', // MT
    de: 'Standard-Zahlungsoptionen', // MT
    fr: 'Options de paiement par défaut', // MT
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
  // ── pay by invoice (copied from Thread's catalogues, 2026-09-14) ──
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
  pay_online: {
    en: 'Pay online',
    nl: 'Online betalen',
    es: 'Pago en línea', // MT
    pt: 'Pagar online', // MT
    de: 'Online bezahlen', // MT
    fr: 'Payer en ligne', // MT
  },
  pay_by_invoice: {
    en: 'Receive an invoice',
    nl: 'Op factuur',
    es: 'Recibir una factura',
    pt: 'Receber uma fatura',
    de: 'Auf Rechnung',
    fr: 'Recevoir une facture', // MT
  },
  payment_method: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago',
    pt: 'Pagamento',
    de: 'Zahlung',
    fr: 'Paiement', // MT
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
  tax_number: {
    en: 'Tax / VAT number (optional)',
    nl: 'Btw-nummer (optioneel)',
    es: 'NIF / número de IVA (opcional)',
    pt: 'NIF / número de IVA (opcional)',
    de: 'USt-IdNr. (optional)',
    fr: 'Numéro de TVA (facultatif)', // MT
  },
  invoice_note_confirmed: {
    en: 'Your host will send you an invoice.',
    nl: 'Je host stuurt je een factuur.',
    es: 'Tu anfitrión te enviará una factura.', // MT
    pt: 'O seu anfitrião vai enviar-lhe uma fatura.', // MT
    de: 'Dein Gastgeber schickt dir eine Rechnung.', // MT
    fr: 'Ton hôte t’enverra une facture.', // MT
  },
  your_pages: {
    en: 'Your pages',
    nl: 'Jouw pagina’s',
    es: 'Tus páginas', // MT
    pt: 'As suas páginas', // MT
    de: 'Deine Seiten', // MT
    fr: 'Tes pages', // MT
  },
  your_pages_desc: {
    en: 'Everything people can book with you, on one page each.',
    nl: 'Alles wat mensen bij je kunnen boeken, per pagina.',
    es: 'Todo lo que la gente puede reservar contigo, en una página cada uno.', // MT
    pt: 'Tudo o que as pessoas podem marcar consigo, numa página cada.', // MT
    de: 'Alles, was man bei dir buchen kann, jeweils auf einer Seite.', // MT
    fr: 'Tout ce qu’on peut réserver avec toi, sur une page chacun.', // MT
  },
  your_personal_page: {
    en: 'Your personal page',
    nl: 'Je persoonlijke pagina',
    es: 'Tu página personal', // MT
    pt: 'A sua página pessoal', // MT
    de: 'Deine persönliche Seite', // MT
    fr: 'Ta page personnelle', // MT
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
  share: {
    en: 'Share',
    nl: 'Delen',
    es: 'Compartir', // MT
    pt: 'Partilhar', // MT
    de: 'Teilen', // MT
    fr: 'Partager', // MT
  },
  visit_page: {
    en: 'Visit page',
    nl: 'Pagina bekijken',
    es: 'Ver la página', // MT
    pt: 'Ver a página', // MT
    de: 'Seite ansehen', // MT
    fr: 'Voir la page', // MT
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
  paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'De pago', // MT
    pt: 'Pago', // MT
    de: 'Kostenpflichtig', // MT
    fr: 'Payant', // MT
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
    en: 'Online payment needs Stripe connected in',
    nl: 'Online betalen vraagt een gekoppelde Stripe in',
    es: 'El pago en línea necesita Stripe conectado en', // MT
    pt: 'O pagamento online precisa do Stripe ligado em', // MT
    de: 'Online-Zahlung braucht ein verbundenes Stripe unter', // MT
    fr: 'Le paiement en ligne demande Stripe connecté dans', // MT
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
    en: '. Payment by invoice works without it: the booking confirms, and you mark the invoice paid under Invoices.',
    nl: '. Betalen per factuur werkt zonder: de boeking wordt bevestigd en je zet de factuur op betaald onder Facturen.',
    es: '. El pago por factura funciona sin él: la reserva se confirma y marcas la factura como pagada en Facturas.', // MT
    pt: '. O pagamento por fatura funciona sem ele: a marcação é confirmada e marca a fatura como paga em Faturas.', // MT
    de: '. Zahlung per Rechnung geht auch ohne: Die Buchung wird bestätigt und du markierst die Rechnung unter Rechnungen als bezahlt.', // MT
    fr: '. Le paiement par facture fonctionne sans : la réservation est confirmée et tu marques la facture payée dans Factures.', // MT
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
  member_search_placeholder: {
    en: 'Search people in your workspace…',
    nl: 'Zoek mensen in je werkruimte…',
    es: 'Busca personas en tu espacio de trabajo…', // MT
    pt: 'Procure pessoas no seu espaço de trabalho…', // MT
    de: 'Personen in deinem Workspace suchen…', // MT
    fr: 'Cherche des personnes dans ton espace…', // MT
  },
  member_search_hint: {
    en: 'Not in the list? Type their name and invite them as someone new.',
    nl: 'Staat iemand er niet bij? Typ de naam en nodig diegene uit.',
    es: '¿No está en la lista? Escribe su nombre e invítalo como alguien nuevo.', // MT
    pt: 'Não está na lista? Escreva o nome e convide como alguém novo.', // MT
    de: 'Nicht in der Liste? Namen eintippen und als neue Person einladen.', // MT
    fr: 'Pas dans la liste ? Tape son nom et invite-le comme nouvelle personne.', // MT
  },
  member_create_row: {
    en: 'Invite “{name}” as someone new',
    nl: '“{name}” uitnodigen als nieuw persoon',
    es: 'Invitar a «{name}» como alguien nuevo', // MT
    pt: 'Convidar “{name}” como alguém novo', // MT
    de: '„{name}“ als neue Person einladen', // MT
    fr: 'Inviter « {name} » comme nouvelle personne', // MT
  },
  member_create_title: {
    en: 'Invite someone new',
    nl: 'Iemand nieuws uitnodigen',
    es: 'Invitar a alguien nuevo', // MT
    pt: 'Convidar alguém novo', // MT
    de: 'Neue Person einladen', // MT
    fr: 'Inviter une nouvelle personne', // MT
  },
  member_create_desc: {
    en: 'They are not in your workspace yet. They get an invite by email and join the team when they accept.',
    nl: 'Diegene zit nog niet in je werkruimte. Er gaat een uitnodiging per e-mail en na accepteren zit diegene in het team.',
    es: 'Aún no está en tu espacio de trabajo. Recibe una invitación por correo y se une al equipo al aceptarla.', // MT
    pt: 'Ainda não está no seu espaço de trabalho. Recebe um convite por email e entra na equipa ao aceitar.', // MT
    de: 'Die Person ist noch nicht in deinem Workspace. Sie bekommt eine Einladung per E-Mail und ist nach dem Annehmen im Team.', // MT
    fr: 'Cette personne n’est pas encore dans ton espace. Elle reçoit une invitation par e-mail et rejoint l’équipe en l’acceptant.', // MT
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
  reschedule_booking: {
    en: 'Reschedule this booking',
    nl: 'Deze boeking verzetten',
    es: 'Reprogramar esta reserva', // MT
    pt: 'Remarcar esta reserva', // MT
    de: 'Diese Buchung verschieben', // MT
    fr: 'Reprogrammer cette réservation', // MT
  },
  active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activos', // MT
    pt: 'Ativos', // MT
    de: 'Aktiv', // MT
    fr: 'Actifs', // MT
  },
  archived: {
    en: 'Archived',
    nl: 'Gearchiveerd',
    es: 'Archivados', // MT
    pt: 'Arquivados', // MT
    de: 'Archiviert', // MT
    fr: 'Archivés', // MT
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
    nl: 'Terughalen',
    es: 'Desarchivar', // MT
    pt: 'Desarquivar', // MT
    de: 'Wiederherstellen', // MT
    fr: 'Désarchiver', // MT
  },
  retire_label: {
    en: 'Archive or delete',
    nl: 'Archiveren of verwijderen',
    es: 'Archivar o eliminar', // MT
    pt: 'Arquivar ou eliminar', // MT
    de: 'Archivieren oder löschen', // MT
    fr: 'Archiver ou supprimer', // MT
  },
  archive_desc: {
    en: 'Archiving takes it off your booking page and out of this list. Bookings already made are unaffected, and you can bring it back later.',
    nl: 'Archiveren haalt het van je boekingspagina en uit deze lijst. Bestaande boekingen blijven staan en je kunt het later terughalen.',
    es: 'Archivar lo retira de tu página de reservas y de esta lista. Las reservas ya hechas no cambian y puedes recuperarlo más tarde.', // MT
    pt: 'Arquivar remove-o da tua página de marcações e desta lista. As marcações já feitas não mudam e podes recuperá-lo mais tarde.', // MT
    de: 'Archivieren nimmt es von deiner Buchungsseite und aus dieser Liste. Bereits getätigte Buchungen bleiben bestehen, und du kannst es später zurückholen.', // MT
    fr: 'Archiver le retire de ta page de réservation et de cette liste. Les réservations déjà faites ne changent pas et tu peux le restaurer plus tard.', // MT
  },
  unarchive_desc: {
    en: 'This meeting type is archived. Bringing it back puts it in your list as hidden — publish it again whenever you are ready.',
    nl: 'Dit meetingtype is gearchiveerd. Terughalen zet het verborgen in je lijst — publiceer het weer wanneer je wilt.',
    es: 'Este tipo de reunión está archivado. Al recuperarlo vuelve a tu lista como oculto: publícalo de nuevo cuando quieras.', // MT
    pt: 'Este tipo de reunião está arquivado. Ao recuperá-lo volta à tua lista como oculto: publica-o de novo quando quiseres.', // MT
    de: 'Dieser Meeting-Typ ist archiviert. Beim Zurückholen erscheint er verborgen in deiner Liste — veröffentliche ihn wieder, wann du willst.', // MT
    fr: 'Ce type de réunion est archivé. En le restaurant, il revient masqué dans ta liste — publie-le à nouveau quand tu veux.', // MT
  },
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Eliminar', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },
  delete_mt_title: {
    en: 'Delete this meeting type?',
    nl: 'Dit meetingtype verwijderen?',
    es: '¿Eliminar este tipo de reunión?', // MT
    pt: 'Eliminar este tipo de reunião?', // MT
    de: 'Diesen Meeting-Typ löschen?', // MT
    fr: 'Supprimer ce type de réunion ?', // MT
  },
  delete_mt_message: {
    en: '“{name}” will be gone for good. This only works if nobody has ever booked it — otherwise archive it instead.',
    nl: '“{name}” is dan definitief weg. Dit kan alleen als niemand het ooit geboekt heeft — archiveer het anders.',
    es: '“{name}” desaparecerá para siempre. Solo funciona si nadie lo ha reservado nunca; si no, archívalo.', // MT
    pt: '“{name}” desaparece definitivamente. Só funciona se ninguém o tiver marcado; caso contrário, arquiva-o.', // MT
    de: '„{name}“ ist dann endgültig weg. Das geht nur, wenn es nie gebucht wurde — archiviere es sonst.', // MT
    fr: '« {name} » sera supprimé définitivement. Cela ne fonctionne que si personne ne l’a jamais réservé — sinon, archive-le.', // MT
  },
  no_archived_mts: {
    en: 'Nothing archived.',
    nl: 'Niets gearchiveerd.',
    es: 'Nada archivado.', // MT
    pt: 'Nada arquivado.', // MT
    de: 'Nichts archiviert.', // MT
    fr: 'Rien d’archivé.', // MT
  },
  suggest_times: {
    en: 'Suggest times',
    nl: 'Tijden voorstellen',
    es: 'Sugerir horarios', // MT
    pt: 'Sugerir horários', // MT
    de: 'Zeiten vorschlagen', // MT
    fr: 'Proposer des horaires', // MT
  },
  how_many_options: {
    en: 'How many options',
    nl: 'Hoeveel opties',
    es: 'Cuántas opciones', // MT
    pt: 'Quantas opções', // MT
    de: 'Wie viele Optionen', // MT
    fr: 'Combien d’options', // MT
  },
  poll_no_free_times: {
    en: 'No free times in your calendar for the coming period. Widen your availability or add times yourself.',
    nl: 'Geen vrije tijden in je agenda voor de komende periode. Verruim je beschikbaarheid of voeg zelf tijden toe.',
    es: 'No hay horarios libres en tu calendario para el próximo periodo. Amplía tu disponibilidad o añade horarios tú mismo.', // MT
    pt: 'Não há horários livres na tua agenda para o próximo período. Alarga a tua disponibilidade ou adiciona horários tu mesmo.', // MT
    de: 'Keine freien Zeiten in deinem Kalender für den kommenden Zeitraum. Erweitere deine Verfügbarkeit oder trage selbst Zeiten ein.', // MT
    fr: 'Aucun créneau libre dans ton agenda pour la période à venir. Élargis ta disponibilité ou ajoute des horaires toi-même.', // MT
  },
  poll_only_n_free: {
    en: 'Only {n} free times were found — add more yourself if you want a wider choice.',
    nl: 'Maar {n} vrije tijden gevonden — voeg er zelf meer toe als je meer keuze wilt.',
    es: 'Solo se encontraron {n} horarios libres: añade más si quieres más opciones.', // MT
    pt: 'Só foram encontrados {n} horários livres — adiciona mais se quiseres mais opções.', // MT
    de: 'Nur {n} freie Zeiten gefunden — trage selbst mehr ein, wenn du mehr Auswahl willst.', // MT
    fr: 'Seulement {n} créneaux libres trouvés — ajoutes-en si tu veux plus de choix.', // MT
  },
  new_booking: {
    en: 'New booking',
    nl: 'Nieuwe boeking',
    es: 'Nueva reserva', // MT
    pt: 'Nova marcação', // MT
    de: 'Neue Buchung', // MT
    fr: 'Nouvelle réservation', // MT
  },
  meeting_type: {
    en: 'Meeting type',
    nl: 'Meetingtype',
    es: 'Tipo de reunión', // MT
    pt: 'Tipo de reunião', // MT
    de: 'Meeting-Typ', // MT
    fr: 'Type de réunion', // MT
  },
  host_booking_time_hint: {
    en: 'Your own time is yours to book — this is not checked against your availability.',
    nl: 'Je eigen tijd boek je zelf — dit wordt niet getoetst aan je beschikbaarheid.',
    es: 'Tu tiempo es tuyo: esto no se comprueba con tu disponibilidad.', // MT
    pt: 'O teu tempo é teu: isto não é verificado com a tua disponibilidade.', // MT
    de: 'Deine eigene Zeit buchst du selbst — das wird nicht gegen deine Verfügbarkeit geprüft.', // MT
    fr: 'Ton temps t’appartient — ceci n’est pas vérifié avec ta disponibilité.', // MT
  },
  payment_of: {
    en: 'Payment of {price}',
    nl: 'Betaling van {price}',
    es: 'Pago de {price}', // MT
    pt: 'Pagamento de {price}', // MT
    de: 'Zahlung von {price}', // MT
    fr: 'Paiement de {price}', // MT
  },
  pay_send_link: {
    en: 'Send a payment link (with invoice)',
    nl: 'Betaallink sturen (met factuur)',
    es: 'Enviar un enlace de pago (con factura)', // MT
    pt: 'Enviar uma ligação de pagamento (com fatura)', // MT
    de: 'Zahlungslink senden (mit Rechnung)', // MT
    fr: 'Envoyer un lien de paiement (avec facture)', // MT
  },
  pay_send_invoice: {
    en: 'Invoice them separately',
    nl: 'Apart factureren',
    es: 'Facturar aparte', // MT
    pt: 'Faturar em separado', // MT
    de: 'Separat in Rechnung stellen', // MT
    fr: 'Facturer séparément', // MT
  },
  pay_on_the_house: {
    en: 'On the house',
    nl: 'Van het huis',
    es: 'Invita la casa', // MT
    pt: 'Por conta da casa', // MT
    de: 'Geht aufs Haus', // MT
    fr: 'C’est la maison qui offre', // MT
  },
  send_confirmation: {
    en: 'Send a confirmation email',
    nl: 'Bevestigingsmail sturen',
    es: 'Enviar un correo de confirmación', // MT
    pt: 'Enviar um email de confirmação', // MT
    de: 'Bestätigungsmail senden', // MT
    fr: 'Envoyer un e-mail de confirmation', // MT
  },
  no_bookable_types: {
    en: 'This workspace has no meeting types yet, so there is nothing to book somebody into. Make one first.',
    nl: 'Deze workspace heeft nog geen meetingtypes, dus er is niets om iemand voor in te plannen. Maak er eerst een.',
    es: 'Este espacio aún no tiene tipos de reunión, así que no hay nada para lo que reservar a alguien. Crea uno primero.', // MT
    pt: 'Este espaço ainda não tem tipos de reunião, por isso não há nada para marcar. Cria um primeiro.', // MT
    de: 'Dieser Workspace hat noch keine Meeting-Typen, also gibt es nichts, wofür du jemanden buchen kannst. Lege zuerst einen an.', // MT
    fr: 'Cet espace n’a pas encore de type de réunion, il n’y a donc rien pour lequel réserver quelqu’un. Crées-en un d’abord.', // MT
  },
  public_language: {
    en: 'Language for guests',
    nl: 'Taal voor gasten',
    es: 'Idioma para los invitados', // MT
    pt: 'Idioma para os convidados', // MT
    de: 'Sprache für Gäste', // MT
    fr: 'Langue pour les invités', // MT
  },
  language_inherit: {
    en: 'Same as my own language',
    nl: 'Zelfde als mijn eigen taal',
    es: 'La misma que mi idioma', // MT
    pt: 'A mesma que o meu idioma', // MT
    de: 'Wie meine eigene Sprache', // MT
    fr: 'Comme ma propre langue', // MT
  },
  public_language_hint: {
    en: 'The booking page and the emails your invitees get. Leave it as your own language unless this one meeting is in another.',
    nl: 'De boekingspagina en de mails die je gasten krijgen. Laat het op je eigen taal staan, tenzij juist deze afspraak in een andere taal is.',
    es: 'La página de reservas y los correos que reciben tus invitados. Déjalo en tu idioma salvo que esta reunión sea en otro.', // MT
    pt: 'A página de marcação e os emails que os teus convidados recebem. Deixa no teu idioma, a não ser que esta reunião seja noutro.', // MT
    de: 'Die Buchungsseite und die Mails an deine Gäste. Lass es bei deiner eigenen Sprache, außer dieses eine Meeting ist in einer anderen.', // MT
    fr: 'La page de réservation et les e-mails que reçoivent tes invités. Laisse ta propre langue, sauf si cette réunion est dans une autre.', // MT
  },
  voter_none_of_these: {
    en: 'Can’t make any of these',
    nl: 'Kan geen van deze',
    es: 'No puede en ninguna', // MT
    pt: 'Não pode em nenhuma', // MT
    de: 'Kann bei keiner', // MT
    fr: 'Ne peut à aucune', // MT
  },
  invite_people: {
    en: 'Invite people',
    nl: 'Mensen uitnodigen',
    es: 'Invitar a personas', // MT
    pt: 'Convidar pessoas', // MT
    de: 'Leute einladen', // MT
    fr: 'Inviter des personnes', // MT
  },
  invite_search_placeholder: {
    en: 'Search a contact…',
    nl: 'Zoek een contact…',
    es: 'Buscar un contacto…', // MT
    pt: 'Procurar um contacto…', // MT
    de: 'Kontakt suchen…', // MT
    fr: 'Rechercher un contact…', // MT
  },
  invite_message: {
    en: 'Message (optional)',
    nl: 'Bericht (optioneel)',
    es: 'Mensaje (opcional)', // MT
    pt: 'Mensagem (opcional)', // MT
    de: 'Nachricht (optional)', // MT
    fr: 'Message (facultatif)', // MT
  },
  invite_message_placeholder: {
    en: 'A line about why you are asking — it goes in the invitation.',
    nl: 'Een zin over waarom je het vraagt — die komt in de uitnodiging.',
    es: 'Una línea sobre por qué lo preguntas: irá en la invitación.', // MT
    pt: 'Uma linha sobre porque estás a perguntar — vai no convite.', // MT
    de: 'Ein Satz dazu, warum du fragst — er steht in der Einladung.', // MT
    fr: 'Une ligne sur la raison de ta demande — elle figure dans l’invitation.', // MT
  },
  invite_pick_someone: {
    en: 'Pick at least one person to invite.',
    nl: 'Kies minstens één persoon om uit te nodigen.',
    es: 'Elige al menos una persona a la que invitar.', // MT
    pt: 'Escolhe pelo menos uma pessoa para convidar.', // MT
    de: 'Wähle mindestens eine Person zum Einladen.', // MT
    fr: 'Choisis au moins une personne à inviter.', // MT
  },
  send_invitations: {
    en: 'Send invitations',
    nl: 'Uitnodigingen versturen',
    es: 'Enviar las invitaciones', // MT
    pt: 'Enviar os convites', // MT
    de: 'Einladungen senden', // MT
    fr: 'Envoyer les invitations', // MT
  },
  invitations_sent: {
    en: '{n} sent.',
    nl: '{n} verstuurd.',
    es: '{n} enviadas.', // MT
    pt: '{n} enviados.', // MT
    de: '{n} gesendet.', // MT
    fr: '{n} envoyées.', // MT
  },
  already_invited_n: {
    en: '{n} already invited',
    nl: '{n} al uitgenodigd',
    es: '{n} ya invitadas', // MT
    pt: '{n} já convidados', // MT
    de: '{n} bereits eingeladen', // MT
    fr: '{n} déjà invitées', // MT
  },
  invited_label: {
    en: 'Invited',
    nl: 'Uitgenodigd',
    es: 'Invitado', // MT
    pt: 'Convidado', // MT
    de: 'Eingeladen', // MT
    fr: 'Invité', // MT
  },
  no_answer_yet: {
    en: 'No answer yet',
    nl: 'Nog geen antwoord',
    es: 'Sin respuesta todavía', // MT
    pt: 'Ainda sem resposta', // MT
    de: 'Noch keine Antwort', // MT
    fr: 'Pas encore de réponse', // MT
  },
  ob_title: {
    en: 'Get set up',
    nl: 'Even instellen',
    es: 'Pon todo a punto', // MT
    pt: 'Começa a configurar', // MT
    de: 'Kurz einrichten', // MT
    fr: 'Mets tout en place', // MT
  },
  ob_intro: {
    en: 'Five things, and people can book you. This disappears when you are done.',
    nl: 'Vijf dingen, en mensen kunnen je boeken. Dit verdwijnt zodra je klaar bent.',
    es: 'Cinco cosas y ya podrán reservarte. Esto desaparece cuando termines.', // MT
    pt: 'Cinco coisas e já te podem marcar. Isto desaparece quando acabares.', // MT
    de: 'Fünf Dinge, dann kann man dich buchen. Das hier verschwindet, wenn du fertig bist.', // MT
    fr: 'Cinq choses et on pourra te réserver. Ceci disparaît quand tu as fini.', // MT
  },
  ob_progress: {
    en: '{done} of {total}',
    nl: '{done} van {total}',
    es: '{done} de {total}', // MT
    pt: '{done} de {total}', // MT
    de: '{done} von {total}', // MT
    fr: '{done} sur {total}', // MT
  },
  ob_your_page: {
    en: 'Your page:',
    nl: 'Je pagina:',
    es: 'Tu página:', // MT
    pt: 'A tua página:', // MT
    de: 'Deine Seite:', // MT
    fr: 'Ta page :', // MT
  },

  ob_calendar_title: {
    en: 'Connect your calendar',
    nl: 'Koppel je agenda',
    es: 'Conecta tu calendario', // MT
    pt: 'Liga a tua agenda', // MT
    de: 'Verbinde deinen Kalender', // MT
    fr: 'Connecte ton agenda', // MT
  },
  ob_calendar_why: {
    en: 'So Meet never offers a time you are already busy — and puts every booking straight into your calendar.',
    nl: 'Zodat Meet nooit een tijd aanbiedt waarop je al bezet bent — en elke boeking meteen in je agenda zet.',
    es: 'Para que Meet nunca ofrezca una hora en la que ya estás ocupado, y meta cada reserva en tu calendario.', // MT
    pt: 'Para que o Meet nunca ofereça uma hora em que já estás ocupado — e coloque cada marcação na tua agenda.', // MT
    de: 'Damit Meet nie eine Zeit anbietet, zu der du schon belegt bist — und jede Buchung direkt in deinen Kalender legt.', // MT
    fr: 'Pour que Meet ne propose jamais un horaire où tu es déjà pris — et mette chaque réservation dans ton agenda.', // MT
  },
  ob_calendar_cta: {
    en: 'Connect',
    nl: 'Koppelen',
    es: 'Conectar', // MT
    pt: 'Ligar', // MT
    de: 'Verbinden', // MT
    fr: 'Connecter', // MT
  },

  ob_availability_title: {
    en: 'Say when you are available',
    nl: 'Geef aan wanneer je beschikbaar bent',
    es: 'Indica cuándo estás disponible', // MT
    pt: 'Diz quando estás disponível', // MT
    de: 'Sag, wann du verfügbar bist', // MT
    fr: 'Indique quand tu es disponible', // MT
  },
  ob_availability_why: {
    en: 'Your working hours are the outer edge of what anyone can book. Without them, nobody can book anything.',
    nl: 'Je werktijden zijn de buitengrens van wat iemand kan boeken. Zonder die tijden kan niemand iets boeken.',
    es: 'Tu horario es el límite de lo que alguien puede reservar. Sin él, nadie puede reservar nada.', // MT
    pt: 'O teu horário é o limite do que alguém pode marcar. Sem ele, ninguém pode marcar nada.', // MT
    de: 'Deine Arbeitszeiten sind die äußere Grenze dessen, was jemand buchen kann. Ohne sie kann niemand etwas buchen.', // MT
    fr: 'Tes horaires de travail sont la limite de ce qu’on peut réserver. Sans eux, personne ne peut rien réserver.', // MT
  },
  ob_availability_cta: {
    en: 'Set hours',
    nl: 'Tijden instellen',
    es: 'Definir horario', // MT
    pt: 'Definir horário', // MT
    de: 'Zeiten festlegen', // MT
    fr: 'Définir les horaires', // MT
  },

  ob_type_title: {
    en: 'Make your first meeting type',
    nl: 'Maak je eerste afspraaktype',
    es: 'Crea tu primer tipo de reunión', // MT
    pt: 'Cria o teu primeiro tipo de reunião', // MT
    de: 'Lege deinen ersten Meeting-Typ an', // MT
    fr: 'Crée ton premier type de rendez-vous', // MT
  },
  ob_type_why: {
    en: 'A meeting type is what people actually book — a half-hour intro, an hour of advice. It gets its own page and link.',
    nl: 'Een afspraaktype is wat mensen daadwerkelijk boeken — een half uur kennismaken, een uur advies. Het krijgt een eigen pagina en link.',
    es: 'Un tipo de reunión es lo que la gente reserva: media hora de presentación, una hora de asesoría. Tiene su propia página y enlace.', // MT
    pt: 'Um tipo de reunião é o que as pessoas marcam — meia hora de apresentação, uma hora de aconselhamento. Tem a sua própria página e ligação.', // MT
    de: 'Ein Meeting-Typ ist das, was man tatsächlich bucht — eine halbe Stunde Kennenlernen, eine Stunde Beratung. Er bekommt eine eigene Seite und einen Link.', // MT
    fr: 'Un type de rendez-vous est ce que les gens réservent — une demi-heure de présentation, une heure de conseil. Il a sa propre page et son lien.', // MT
  },
  ob_type_cta: {
    en: 'Create one',
    nl: 'Er een maken',
    es: 'Crear uno', // MT
    pt: 'Criar um', // MT
    de: 'Einen anlegen', // MT
    fr: 'En créer un', // MT
  },

  ob_profile_title: {
    en: 'Put your face on it',
    nl: 'Zet je gezicht erbij',
    es: 'Pon tu cara', // MT
    pt: 'Põe a tua cara', // MT
    de: 'Zeig dein Gesicht', // MT
    fr: 'Mets ton visage', // MT
  },
  ob_profile_why: {
    en: 'A photo and a line about yourself. Your booking page is often the first thing someone sees of you.',
    nl: 'Een foto en een zin over jezelf. Je boekingspagina is vaak het eerste wat iemand van je ziet.',
    es: 'Una foto y una línea sobre ti. Tu página de reservas suele ser lo primero que alguien ve de ti.', // MT
    pt: 'Uma foto e uma linha sobre ti. A tua página de marcações é muitas vezes a primeira coisa que alguém vê de ti.', // MT
    de: 'Ein Foto und ein Satz über dich. Deine Buchungsseite ist oft das Erste, was jemand von dir sieht.', // MT
    fr: 'Une photo et une ligne sur toi. Ta page de réservation est souvent la première chose qu’on voit de toi.', // MT
  },
  ob_profile_cta: {
    en: 'Add it',
    nl: 'Toevoegen',
    es: 'Añadir', // MT
    pt: 'Adicionar', // MT
    de: 'Hinzufügen', // MT
    fr: 'Ajouter', // MT
  },

  ob_share_title: {
    en: 'Share your link',
    nl: 'Deel je link',
    es: 'Comparte tu enlace', // MT
    pt: 'Partilha a tua ligação', // MT
    de: 'Teile deinen Link', // MT
    fr: 'Partage ton lien', // MT
  },
  ob_share_why: {
    en: 'Nothing happens until somebody has the address. Put it in your signature, or send it to one person today.',
    nl: 'Er gebeurt niets tot iemand het adres heeft. Zet het in je handtekening, of stuur het vandaag naar één iemand.',
    es: 'No pasa nada hasta que alguien tenga la dirección. Ponla en tu firma o envíasela hoy a una persona.', // MT
    pt: 'Nada acontece até alguém ter o endereço. Põe-no na tua assinatura ou envia-o hoje a uma pessoa.', // MT
    de: 'Es passiert nichts, bis jemand die Adresse hat. Setz sie in deine Signatur oder schick sie heute einer Person.', // MT
    fr: 'Rien ne se passe tant que personne n’a l’adresse. Mets-la dans ta signature ou envoie-la aujourd’hui à une personne.', // MT
  },
  ob_share_cta: {
    en: 'See the page',
    nl: 'Bekijk de pagina',
    es: 'Ver la página', // MT
    pt: 'Ver a página', // MT
    de: 'Seite ansehen', // MT
    fr: 'Voir la page', // MT
  },
  ob_dismiss: {
    en: 'Put this away',
    nl: 'Even wegzetten',
    es: 'Guardar esto', // MT
    pt: 'Guardar isto', // MT
    de: 'Weglegen', // MT
    fr: 'Ranger ceci', // MT
  },
  ob_reopen: {
    en: 'Get set up',
    nl: 'Even instellen',
    es: 'Pon todo a punto', // MT
    pt: 'Começa a configurar', // MT
    de: 'Kurz einrichten', // MT
    fr: 'Mets tout en place', // MT
  },
  ob_read_the_guide: {
    en: 'Read the full guide',
    nl: 'Lees de volledige uitleg',
    es: 'Leer la guía completa', // MT
    pt: 'Ler o guia completo', // MT
    de: 'Die ganze Anleitung lesen', // MT
    fr: 'Lire le guide complet', // MT
  },
  ob_payments_title: {
    en: 'Connect Stripe, if you charge',
    nl: 'Koppel Stripe, als je iets rekent',
    es: 'Conecta Stripe, si cobras', // MT
    pt: 'Liga o Stripe, se cobras', // MT
    de: 'Stripe verbinden, wenn du abrechnest', // MT
    fr: 'Connecte Stripe, si tu factures', // MT
  },
  ob_payments_why: {
    en: 'Only needed for paid meetings — people pay when they book, and the invoice goes out by itself. Skip it if everything you offer is free.',
    nl: 'Alleen nodig voor betaalde afspraken — mensen betalen bij het boeken en de factuur gaat vanzelf de deur uit. Sla het over als alles wat je aanbiedt gratis is.',
    es: 'Solo hace falta para reuniones de pago: la gente paga al reservar y la factura sale sola. Sáltatelo si todo lo que ofreces es gratis.', // MT
    pt: 'Só é preciso para reuniões pagas — as pessoas pagam ao marcar e a fatura sai sozinha. Salta isto se tudo o que ofereces é grátis.', // MT
    de: 'Nur für bezahlte Termine nötig — man zahlt beim Buchen und die Rechnung geht von selbst raus. Überspring es, wenn alles kostenlos ist.', // MT
    fr: 'Utile seulement pour les rendez-vous payants — on paie en réservant et la facture part toute seule. Passe si tout ce que tu proposes est gratuit.', // MT
  },
  ob_payments_cta: {
    en: 'Set up payments',
    nl: 'Betalingen instellen',
    es: 'Configurar los pagos', // MT
    pt: 'Configurar pagamentos', // MT
    de: 'Zahlungen einrichten', // MT
    fr: 'Configurer les paiements', // MT
  },
  ob_close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
  ob_dont_show_again: {
    en: 'Don\u2019t show this again',
    nl: 'Dit niet meer tonen',
    es: 'No volver a mostrar esto', // MT
    pt: 'N\u00e3o mostrar isto outra vez', // MT
    de: 'Das nicht mehr anzeigen', // MT
    fr: 'Ne plus afficher ceci', // MT
  },
  ob_show_me_more: {
    en: 'Show me more',
    nl: 'Laat me meer zien',
    es: 'Mu\u00e9strame m\u00e1s', // MT
    pt: 'Mostra-me mais', // MT
    de: 'Mehr dazu', // MT
    fr: 'En savoir plus', // MT
  },
  ob_type_more_title: {
    en: 'What is a meeting type?',
    nl: 'Wat is een afspraaktype?',
    es: '\u00bfQu\u00e9 es un tipo de reuni\u00f3n?', // MT
    pt: 'O que \u00e9 um tipo de reuni\u00e3o?', // MT
    de: 'Was ist ein Meeting-Typ?',  // MT
    fr: 'Qu\u2019est-ce qu\u2019un type de rendez-vous ?', // MT
  },
  ob_type_more_1: {
    en: 'A meeting type is one kind of conversation you are willing to have: a half-hour intro, an hour of advice, a twenty-minute check-in. You describe it once — how long it lasts, where it happens, what it costs if anything — and it gets its own page and its own link.',
    nl: 'Een afspraaktype is \u00e9\u00e9n soort gesprek dat je wilt voeren: een half uur kennismaken, een uur advies, twintig minuten bijpraten. Je beschrijft het \u00e9\u00e9n keer \u2014 hoe lang het duurt, waar het plaatsvindt, wat het eventueel kost \u2014 en het krijgt een eigen pagina en een eigen link.',
    es: 'Un tipo de reuni\u00f3n es una clase de conversaci\u00f3n que quieres tener: media hora de presentaci\u00f3n, una hora de asesor\u00eda, veinte minutos de seguimiento. Lo describes una vez \u2014 cu\u00e1nto dura, d\u00f3nde ocurre, cu\u00e1nto cuesta si cuesta algo \u2014 y tiene su propia p\u00e1gina y su propio enlace.', // MT
    pt: 'Um tipo de reuni\u00e3o \u00e9 um tipo de conversa que queres ter: meia hora de apresenta\u00e7\u00e3o, uma hora de aconselhamento, vinte minutos de ponto de situa\u00e7\u00e3o. Descreve-lo uma vez \u2014 quanto dura, onde acontece, quanto custa se custar \u2014 e fica com a sua pr\u00f3pria p\u00e1gina e liga\u00e7\u00e3o.', // MT
    de: 'Ein Meeting-Typ ist eine Art Gespr\u00e4ch, die du f\u00fchren willst: eine halbe Stunde Kennenlernen, eine Stunde Beratung, zwanzig Minuten Austausch. Du beschreibst ihn einmal \u2014 wie lange er dauert, wo er stattfindet, was er gegebenenfalls kostet \u2014 und er bekommt eine eigene Seite und einen eigenen Link.', // MT
    fr: 'Un type de rendez-vous est une sorte de conversation que tu veux avoir : une demi-heure de pr\u00e9sentation, une heure de conseil, vingt minutes de point. Tu le d\u00e9cris une fois \u2014 sa dur\u00e9e, son lieu, son prix s\u2019il en a un \u2014 et il obtient sa propre page et son propre lien.', // MT
  },
  ob_type_more_2: {
    en: 'People book the type, not your diary. They see only the times you are actually free for that kind of meeting, so nobody has to ask when suits you, and nothing lands on top of something else.',
    nl: 'Mensen boeken het type, niet je agenda. Ze zien alleen de tijden waarop je voor dat soort afspraak \u00e9cht vrij bent, dus niemand hoeft te vragen wanneer het schikt en er valt niets bovenop iets anders.',
    es: 'La gente reserva el tipo, no tu agenda. Solo ve las horas en las que est\u00e1s realmente libre para ese tipo de reuni\u00f3n, as\u00ed que nadie tiene que preguntar cu\u00e1ndo te viene bien y nada se solapa.', // MT
    pt: 'As pessoas marcam o tipo, n\u00e3o a tua agenda. S\u00f3 veem as horas em que est\u00e1s mesmo livre para esse tipo de reuni\u00e3o, por isso ningu\u00e9m tem de perguntar quando te d\u00e1 jeito e nada se sobrep\u00f5e.', // MT
    de: 'Man bucht den Typ, nicht deinen Kalender. Sichtbar sind nur die Zeiten, zu denen du f\u00fcr diese Art Termin wirklich frei bist \u2014 niemand muss fragen, wann es dir passt, und nichts landet auf etwas anderem.', // MT
    fr: 'On r\u00e9serve le type, pas ton agenda. On ne voit que les horaires o\u00f9 tu es vraiment libre pour ce genre de rendez-vous : personne n\u2019a \u00e0 demander quand \u00e7a t\u2019arrange, et rien ne se superpose.', // MT
  },
  ob_type_more_3: {
    en: 'Most people start with one and add more later. A poll is a different sort: instead of offering your free times, you propose a few and let everyone say which they can make.',
    nl: 'De meeste mensen beginnen met \u00e9\u00e9n en voegen er later meer toe. Een poll is een ander soort: in plaats van je vrije tijden aan te bieden, stel je er een paar voor en laat je iedereen zeggen wanneer ze kunnen.',
    es: 'La mayor\u00eda empieza con uno y a\u00f1ade m\u00e1s despu\u00e9s. Una encuesta es otra cosa: en vez de ofrecer tus horas libres, propones unas cuantas y cada cual dice a cu\u00e1les puede.', // MT
    pt: 'A maioria come\u00e7a com um e acrescenta mais depois. Uma sondagem \u00e9 outra coisa: em vez de ofereceres as tuas horas livres, prop\u00f5es algumas e cada um diz a quais pode.', // MT
    de: 'Die meisten fangen mit einem an und erg\u00e4nzen sp\u00e4ter. Eine Umfrage ist etwas anderes: statt deine freien Zeiten anzubieten, schl\u00e4gst du ein paar vor und jeder sagt, wann er kann.', // MT
    fr: 'La plupart commencent par un seul et en ajoutent ensuite. Un sondage est d\u2019une autre nature : au lieu de proposer tes cr\u00e9neaux libres, tu en proposes quelques-uns et chacun dit o\u00f9 il peut.', // MT
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
  // Shared sidebar section labels — one shape in every app (2026-09-11).
  nav_people: {
    en: 'People',
    nl: 'Mensen',
    es: 'Personas', // MT
    pt: 'Pessoas', // MT
    de: 'Menschen', // MT
    fr: 'Personnes', // MT
  },
  nav_money: {
    en: 'Money',
    nl: 'Geld',
    es: 'Dinero', // MT
    pt: 'Dinheiro', // MT
    de: 'Geld', // MT
    fr: 'Argent', // MT
  },
  // ── help: how-to guides ──
  // The manual on the Help page (2026-09-27). Each guide is two keys: a title
  // and ONE string of steps separated by \n, split by guideSteps() in
  // app/(app)/help/page.tsx. Written from the screens as they are today.
  help_g_booking_page_title: {
    en: 'Set up your booking page and hours',
    nl: 'Je boekingspagina en werkuren instellen',
    es: 'Configura tu página de reservas y tus horas', // MT
    pt: 'Configura a tua página de marcações e as tuas horas', // MT
    de: 'Buchungsseite und Arbeitszeiten einrichten', // MT
    fr: 'Configurer ta page de réservation et tes horaires', // MT
  },
  help_g_booking_page_steps: {
    en: 'Go to Settings → Booking page and pick your Public URL. This is the address people book you at.\nAdd your Location if meetings happen in person, then click Save.\nGo to Settings → Availability and choose your Timezone.\nSet your hours per weekday. Use Add block for a second window on a day, or leave a day unavailable.\nClick Save changes. Every meeting type uses these hours unless it sets its own.',
    nl: 'Ga naar Instellingen → Boekingspagina en kies je Openbare URL. Dit is het adres waarop mensen je boeken.\nVul je Locatie in als afspraken op locatie plaatsvinden en klik op Opslaan.\nGa naar Instellingen → Beschikbaarheid en kies je Tijdzone.\nStel je uren per weekdag in. Gebruik Blok toevoegen voor een tweede venster op een dag, of laat een dag niet beschikbaar.\nKlik op Wijzigingen opslaan. Elk meetingtype gebruikt deze uren, tenzij het eigen uren heeft.',
    es: 'Ve a Ajustes → Página de reservas y elige tu URL pública. Es la dirección en la que la gente reserva contigo.\nAñade tu Ubicación si las reuniones son presenciales y pulsa Guardar.\nVe a Ajustes → Disponibilidad y elige tu Zona horaria.\nDefine tus horas por día de la semana. Usa Añadir bloque para una segunda franja en un día, o deja un día no disponible.\nPulsa Guardar cambios. Cada tipo de reunión usa estas horas salvo que defina las suyas.', // MT
    pt: 'Vai a Definições → Página de marcações e escolhe o teu URL público. É o endereço onde as pessoas marcam contigo.\nAdiciona a tua Localização se as reuniões forem presenciais e clica em Guardar.\nVai a Definições → Disponibilidade e escolhe o teu Fuso horário.\nDefine as tuas horas por dia da semana. Usa Adicionar bloco para uma segunda janela num dia, ou deixa um dia indisponível.\nClica em Guardar alterações. Cada tipo de reunião usa estas horas, a menos que defina as suas.', // MT
    de: 'Gehe zu Einstellungen → Buchungsseite und wähle deine öffentliche URL. Unter dieser Adresse buchen dich andere.\nTrage deinen Ort ein, wenn Termine vor Ort stattfinden, und klicke auf Speichern.\nGehe zu Einstellungen → Verfügbarkeit und wähle deine Zeitzone.\nLege deine Zeiten pro Wochentag fest. Mit Block hinzufügen legst du ein zweites Zeitfenster an, oder du lässt einen Tag nicht verfügbar.\nKlicke auf Änderungen speichern. Jeder Meeting-Typ nutzt diese Zeiten, sofern er keine eigenen hat.', // MT
    fr: 'Va dans Paramètres → Page de réservation et choisis ton URL publique. C’est l’adresse à laquelle on te réserve.\nAjoute ton Lieu si les rendez-vous ont lieu en personne, puis clique sur Enregistrer.\nVa dans Paramètres → Disponibilité et choisis ton Fuseau horaire.\nDéfinis tes heures par jour de la semaine. Utilise Ajouter un bloc pour une deuxième plage dans une journée, ou laisse un jour indisponible.\nClique sur Enregistrer les modifications. Chaque type de réunion utilise ces heures, sauf s’il définit les siennes.', // MT
  },
  help_g_google_calendar_title: {
    en: 'Connect Google Calendar',
    nl: 'Google Agenda koppelen',
    es: 'Conectar Google Calendar', // MT
    pt: 'Ligar o Google Calendar', // MT
    de: 'Google Kalender verbinden', // MT
    fr: 'Connecter Google Agenda', // MT
  },
  help_g_google_calendar_steps: {
    en: 'Go to Settings → Integrations, click Connect Google Calendar and allow access in Google. Each host connects their own calendar.\nGo to Settings → Calendars. Every calendar Google returned now has a role.\nSet Conflict source on each calendar that should block your availability, and Write target on the one that receives new bookings. Set Ignore on the rest.\nClick Re-sync from Google if a calendar is missing.\nIf your calendar is full of events marked Free, switch on Events marked Free still block. All-day events and meetings you declined never block.',
    nl: 'Ga naar Instellingen → Integraties, klik op Google Agenda koppelen en geef toegang bij Google. Elke host koppelt zijn eigen agenda.\nGa naar Instellingen → Agenda’s. Elke agenda die Google teruggaf heeft nu een rol.\nZet Conflictbron op elke agenda die je beschikbaarheid moet blokkeren, en Schrijfdoel op de agenda waar nieuwe boekingen in komen. Zet Negeren op de rest.\nKlik op Opnieuw synchroniseren met Google als een agenda ontbreekt.\nStaat je agenda vol met afspraken die op Vrij staan? Zet dan Afspraken met “vrij” blokkeren ook aan. Hele-dag-afspraken en afgewezen uitnodigingen blokkeren nooit.',
    es: 'Ve a Ajustes → Integraciones, pulsa Conectar Google Calendar y concede acceso en Google. Cada anfitrión conecta su propio calendario.\nVe a Ajustes → Calendarios. Cada calendario que devolvió Google tiene ahora un rol.\nPon Fuente de conflictos en cada calendario que deba bloquear tu disponibilidad, y Destino de escritura en el que recibe las nuevas reservas. Pon Ignorar en el resto.\nPulsa Volver a sincronizar desde Google si falta un calendario.\nSi tu calendario está lleno de eventos marcados como Libre, activa Los eventos marcados como Libre también bloquean. Los eventos de todo el día y las reuniones que rechazaste nunca bloquean.', // MT
    pt: 'Vai a Definições → Integrações, clica em Ligar o Google Calendar e autoriza o acesso no Google. Cada anfitrião liga o seu próprio calendário.\nVai a Definições → Calendários. Cada calendário que o Google devolveu tem agora um papel.\nDefine Fonte de conflitos em cada calendário que deve bloquear a tua disponibilidade, e Destino de escrita no que recebe as novas marcações. Define Ignorar nos restantes.\nClica em Ressincronizar a partir do Google se faltar um calendário.\nSe o teu calendário estiver cheio de eventos marcados como Livre, liga Eventos marcados como Livre continuam a bloquear. Eventos de dia inteiro e reuniões que recusaste nunca bloqueiam.', // MT
    de: 'Gehe zu Einstellungen → Integrationen, klicke auf Google Kalender verbinden und erlaube den Zugriff bei Google. Jeder Host verbindet seinen eigenen Kalender.\nGehe zu Einstellungen → Kalender. Jeder Kalender, den Google geliefert hat, hat jetzt eine Rolle.\nSetze Konfliktquelle bei jedem Kalender, der deine Verfügbarkeit blockieren soll, und Schreibziel bei dem, der neue Buchungen erhält. Setze Ignorieren bei den übrigen.\nKlicke auf Erneut mit Google synchronisieren, wenn ein Kalender fehlt.\nIst dein Kalender voller Termine, die als Frei markiert sind, schalte Als Frei markierte Termine blockieren trotzdem ein. Ganztägige Termine und abgelehnte Einladungen blockieren nie.', // MT
    fr: 'Va dans Paramètres → Intégrations, clique sur Connecter Google Agenda et autorise l’accès dans Google. Chaque hôte connecte son propre agenda.\nVa dans Paramètres → Agendas. Chaque agenda renvoyé par Google a maintenant un rôle.\nMets Source de conflits sur chaque agenda qui doit bloquer ta disponibilité, et Cible d’écriture sur celui qui reçoit les nouvelles réservations. Mets Ignorer sur les autres.\nClique sur Resynchroniser depuis Google s’il manque un agenda.\nSi ton agenda est plein d’événements marqués Libre, active Les événements marqués Libre bloquent quand même. Les événements sur toute la journée et les réunions refusées ne bloquent jamais.', // MT
  },
  help_g_create_mt_title: {
    en: 'Create a meeting type and share its link',
    nl: 'Een meetingtype maken en de link delen',
    es: 'Crear un tipo de reunión y compartir su enlace', // MT
    pt: 'Criar um tipo de reunião e partilhar o seu link', // MT
    de: 'Einen Meeting-Typ anlegen und den Link teilen', // MT
    fr: 'Créer un type de réunion et partager son lien', // MT
  },
  help_g_create_mt_steps: {
    en: 'Go to Meeting types, click New and pick an event type: One-on-one or Group, or Round-robin or Collective for a team you lead.\nIn Basics choose the Scope (Personal, or a team), then set the Name, Public URL and Duration.\nOpen the Availability tab: keep Use my default working hours, or pick Custom for this meeting type.\nUnder Scheduling rules set Buffer before, Buffer after, Minimum notice and Bookable up to.\nClick Create. Share in the header now offers Visit page and Copy link; Meeting types and Home → Quick links show Copy booking link too.\nUnder Visibility, untick Available on personal overview page to keep it reachable by direct link only. Untick Active — accept new bookings to pause it; Share disappears while it is paused.',
    nl: 'Ga naar Meetingtypes, klik op Nieuw en kies een type: Eén-op-één of Groep, of Roulerend of Collectief voor een team dat je leidt.\nKies bij Basis het Bereik (Persoonlijk, of een team) en vul Naam, Openbare URL en Duur in.\nOpen het tabblad Beschikbaarheid: houd Gebruik mijn standaard werkuren, of kies Aangepast voor dit meetingtype.\nStel bij Planningsregels Buffer vooraf, Buffer achteraf, Minimale aankondigingstijd en Boekbaar tot in.\nKlik op Aanmaken. Delen in de kop biedt nu Pagina bekijken en Link kopiëren; op Meetingtypes en Home → Snelle links staat ook Boekingslink kopiëren.\nVink bij Zichtbaarheid Beschikbaar op je persoonlijke overzichtspagina uit om het alleen via de directe link bereikbaar te houden. Vink Actief — nieuwe boekingen aannemen uit om het te pauzeren; Delen verdwijnt zolang het gepauzeerd is.',
    es: 'Ve a Tipos de reunión, pulsa Nuevo y elige un tipo: Uno a uno o Grupo, o Rotativo o Colectivo para un equipo que lideras.\nEn Básico elige el Ámbito (Personal, o un equipo) y define el Nombre, la URL pública y la Duración.\nAbre la pestaña Disponibilidad: mantén Usar mis horas de trabajo por defecto, o elige Personalizado para este tipo de reunión.\nEn Reglas de programación define Margen antes, Margen después, Antelación mínima y Reservable hasta.\nPulsa Crear. Compartir en la cabecera ofrece ahora Visitar página y Copiar enlace; Tipos de reunión e Inicio → Enlaces rápidos también muestran Copiar enlace de reserva.\nEn Visibilidad, desmarca Disponible en la página de resumen personal para que solo sea accesible por enlace directo. Desmarca Activo — aceptar nuevas reservas para pausarlo; Compartir desaparece mientras esté en pausa.', // MT
    pt: 'Vai a Tipos de reunião, clica em Novo e escolhe um tipo: Um a um ou Grupo, ou Rotativo ou Coletivo para uma equipa que lideras.\nEm Básico escolhe o Âmbito (Pessoal, ou uma equipa) e define o Nome, o URL público e a Duração.\nAbre o separador Disponibilidade: mantém Usar as minhas horas de trabalho padrão, ou escolhe Personalizado para este tipo de reunião.\nEm Regras de agendamento define Intervalo antes, Intervalo depois, Aviso mínimo e Reservável até.\nClica em Criar. Partilhar no cabeçalho oferece agora Visitar página e Copiar link; Tipos de reunião e Início → Links rápidos também mostram Copiar link de marcação.\nEm Visibilidade, desmarca Disponível na página de resumo pessoal para o manter acessível só por link direto. Desmarca Ativo — aceitar novas marcações para o pausar; Partilhar desaparece enquanto estiver em pausa.', // MT
    de: 'Gehe zu Meeting-Typen, klicke auf Neu und wähle einen Typ: Einzelgespräch oder Gruppe, oder Round-Robin oder Kollektiv für ein Team, das du leitest.\nWähle unter Grundlagen den Bereich (Persönlich oder ein Team) und lege Name, öffentliche URL und Dauer fest.\nÖffne den Tab Verfügbarkeit: behalte Meine Standard-Arbeitszeiten verwenden oder wähle Eigene für diesen Meeting-Typ.\nLege unter Planungsregeln Puffer davor, Puffer danach, Mindestvorlauf und Buchbar bis fest.\nKlicke auf Erstellen. Teilen in der Kopfzeile bietet jetzt Seite ansehen und Link kopieren; Meeting-Typen und Start → Schnellzugriffe zeigen ebenfalls Buchungslink kopieren.\nEntferne unter Sichtbarkeit das Häkchen bei Auf persönlicher Übersichtsseite verfügbar, damit er nur per Direktlink erreichbar bleibt. Entferne das Häkchen bei Aktiv — neue Buchungen annehmen, um ihn zu pausieren; Teilen verschwindet, solange er pausiert ist.', // MT
    fr: 'Va dans Types de réunion, clique sur Nouveau et choisis un type : Individuel ou Groupe, ou Rotation ou Collectif pour une équipe que tu diriges.\nDans Général, choisis la Portée (Personnel, ou une équipe), puis définis le Nom, l’URL publique et la Durée.\nOuvre l’onglet Disponibilité : garde Utiliser mes horaires par défaut, ou choisis Personnalisé pour ce type de réunion.\nSous Règles de planification, définis Marge avant, Marge après, Préavis minimum et Réservable jusqu’à.\nClique sur Créer. Partager dans l’en-tête propose maintenant Voir la page et Copier le lien ; Types de réunion et Accueil → Liens rapides montrent aussi Copier le lien de réservation.\nSous Visibilité, décoche Disponible sur la page d’aperçu personnelle pour ne le rendre accessible que par lien direct. Décoche Actif — accepter de nouvelles réservations pour le mettre en pause ; Partager disparaît tant qu’il est en pause.', // MT
  },
  help_g_where_title: {
    en: 'Choose where the meeting happens',
    nl: 'Kiezen waar de meeting plaatsvindt',
    es: 'Elegir dónde tiene lugar la reunión', // MT
    pt: 'Escolher onde a reunião acontece', // MT
    de: 'Festlegen, wo das Meeting stattfindet', // MT
    fr: 'Choisir où a lieu la réunion', // MT
  },
  help_g_where_steps: {
    en: 'Open the meeting type and go to the Conferencing tab.\nChoose a Provider: Google Meet (needs Google Calendar connected), Zoom, Personal room, In person or No conferencing.\nFor Personal room, paste your fixed link (a Zoom personal room, a Whereby room, anything at one URL) under Settings → Integrations → Personal meeting room URL.\nFor Zoom, click Connect Zoom under Settings → Integrations first; until then Zoom is greyed out. If it says Zoom isn’t set up on this server yet, ask your workspace admin.\nFor In person, fill in Default location. The invitee sees it on the confirmation.\nUnder Conflict calendars keep the host default, or pick which calendars this meeting type checks.',
    nl: 'Open het meetingtype en ga naar het tabblad Videobellen.\nKies een Aanbieder: Google Meet (vereist gekoppelde Google Agenda), Zoom, Persoonlijke room, Fysiek of Geen videobellen.\nPlak voor Persoonlijke room je vaste link (een persoonlijke Zoom-ruimte, een Whereby-ruimte, alles met één vaste URL) bij Instellingen → Integraties → URL van je persoonlijke meetingroom.\nKlik voor Zoom eerst op Zoom koppelen bij Instellingen → Integraties; tot dan is Zoom grijs. Staat er dat Zoom nog niet is ingesteld op deze server, vraag het dan je workspace-beheerder.\nVul voor Fysiek de Standaardlocatie in. De genodigde ziet die op de bevestiging.\nHoud bij Conflictagenda’s de standaard van de host, of kies welke agenda’s dit meetingtype controleert.',
    es: 'Abre el tipo de reunión y ve a la pestaña Videoconferencia.\nElige un Proveedor: Google Meet (requiere Google Calendar conectado), Zoom, Sala personal, Presencial o Sin videoconferencia.\nPara Sala personal, pega tu enlace fijo (una sala personal de Zoom, una sala de Whereby, cualquier cosa con una sola URL) en Ajustes → Integraciones → URL de la sala de reuniones personal.\nPara Zoom, pulsa primero Conectar Zoom en Ajustes → Integraciones; hasta entonces Zoom aparece en gris. Si dice que Zoom aún no está configurado en este servidor, pregunta al administrador de tu espacio de trabajo.\nPara Presencial, rellena Ubicación por defecto. El invitado la ve en la confirmación.\nEn Calendarios de conflictos mantén el valor por defecto del anfitrión, o elige qué calendarios comprueba este tipo de reunión.', // MT
    pt: 'Abre o tipo de reunião e vai ao separador Videoconferência.\nEscolhe um Fornecedor: Google Meet (precisa do Google Calendar ligado), Zoom, Sala pessoal, Presencial ou Sem videoconferência.\nPara Sala pessoal, cola o teu link fixo (uma sala pessoal do Zoom, uma sala Whereby, qualquer coisa num único URL) em Definições → Integrações → URL da sala de reuniões pessoal.\nPara Zoom, clica primeiro em Ligar o Zoom em Definições → Integrações; até lá o Zoom aparece a cinzento. Se disser que o Zoom ainda não está configurado neste servidor, pergunta ao administrador do teu espaço de trabalho.\nPara Presencial, preenche a Localização padrão. O convidado vê-a na confirmação.\nEm Calendários de conflitos mantém o padrão do anfitrião, ou escolhe que calendários este tipo de reunião verifica.', // MT
    de: 'Öffne den Meeting-Typ und gehe zum Tab Konferenz.\nWähle einen Anbieter: Google Meet (braucht einen verbundenen Google Kalender), Zoom, Persönlicher Raum, Vor Ort oder Keine Konferenz.\nFür Persönlicher Raum fügst du deinen festen Link (ein persönlicher Zoom-Raum, ein Whereby-Raum, alles mit einer festen URL) unter Einstellungen → Integrationen → URL des persönlichen Meeting-Raums ein.\nFür Zoom klickst du zuerst unter Einstellungen → Integrationen auf Zoom verbinden; bis dahin ist Zoom ausgegraut. Steht dort, dass Zoom auf diesem Server noch nicht eingerichtet ist, frag deinen Workspace-Admin.\nFür Vor Ort füllst du Standardort aus. Der Gast sieht ihn in der Bestätigung.\nUnter Konfliktkalender behältst du die Host-Voreinstellung oder wählst, welche Kalender dieser Meeting-Typ prüft.', // MT
    fr: 'Ouvre le type de réunion et va dans l’onglet Visioconférence.\nChoisis un Fournisseur : Google Meet (nécessite Google Agenda connecté), Zoom, Salle personnelle, En personne ou Sans visioconférence.\nPour Salle personnelle, colle ton lien fixe (une salle personnelle Zoom, une salle Whereby, tout ce qui a une seule URL) dans Paramètres → Intégrations → URL de la salle de réunion personnelle.\nPour Zoom, clique d’abord sur Connecter Zoom dans Paramètres → Intégrations ; d’ici là Zoom est grisé. Si le message dit que Zoom n’est pas encore configuré sur ce serveur, demande à l’administrateur de ton espace de travail.\nPour En personne, remplis Lieu par défaut. L’invité le voit sur la confirmation.\nSous Agendas de conflits, garde la valeur par défaut de l’hôte, ou choisis quels agendas ce type de réunion vérifie.', // MT
  },
  help_g_charge_title: {
    en: 'Charge for a meeting',
    nl: 'Geld vragen voor een meeting',
    es: 'Cobrar por una reunión', // MT
    pt: 'Cobrar por uma reunião', // MT
    de: 'Ein Meeting kostenpflichtig machen', // MT
    fr: 'Faire payer une réunion', // MT
  },
  help_g_charge_steps: {
    en: 'Go to Settings → Payments and click Connect Stripe under My account (you sell as yourself) or under Workspace account.\nTick your Default payment options: Pay online (card), Pay per invoice, or both. Use Test payment to check the connection.\nOpen the meeting type, go to the Pricing tab, choose Paid and set the Price and Currency.\nUnder Payment options keep Inherit from my account settings, or pick Custom for this meeting type.\nPaying online sends the invitee to Stripe Checkout before the booking confirms; paying by invoice confirms at once and emails an invoice.\nEvery payment lands on the Invoices page, where you can resend an invoice or Reimburse.',
    nl: 'Ga naar Instellingen → Betalingen en klik op Stripe koppelen bij Mijn account (je verkoopt als jezelf) of bij Werkruimte-account.\nVink je Standaard betaalopties aan: Online betalen (kaart), Betalen op factuur, of beide. Gebruik Testbetaling om de koppeling te controleren.\nOpen het meetingtype, ga naar het tabblad Prijs, kies Betaald en vul Prijs en Valuta in.\nHoud bij Betaalopties Overnemen van mijn accountinstellingen, of kies Aangepast voor dit meetingtype.\nBij online betalen gaat de genodigde eerst naar Stripe Checkout en wordt de boeking daarna bevestigd; op factuur wordt de boeking direct bevestigd en gaat er een factuur per e-mail uit.\nElke betaling komt op de pagina Facturen, waar je een factuur opnieuw kunt versturen of kunt Terugbetalen.',
    es: 'Ve a Ajustes → Pagos y pulsa Conectar Stripe en Mi cuenta (vendes como tú mismo) o en Cuenta del espacio de trabajo.\nMarca tus Opciones de pago por defecto: Pagar en línea (tarjeta), Pagar por factura, o ambas. Usa Pago de prueba para comprobar la conexión.\nAbre el tipo de reunión, ve a la pestaña Precio, elige De pago y define el Precio y la Moneda.\nEn Opciones de pago mantén Heredar de la configuración de mi cuenta, o elige Personalizado para este tipo de reunión.\nPagar en línea lleva al invitado a Stripe Checkout antes de confirmar la reserva; pagar por factura confirma de inmediato y envía una factura por correo.\nCada pago aparece en la página Facturas, donde puedes reenviar una factura o Reembolsar.', // MT
    pt: 'Vai a Definições → Pagamentos e clica em Ligar o Stripe em A minha conta (vendes como tu próprio) ou em Conta do espaço de trabalho.\nMarca as tuas Opções de pagamento padrão: Pagar online (cartão), Pagar por fatura, ou ambas. Usa Pagamento de teste para verificar a ligação.\nAbre o tipo de reunião, vai ao separador Preço, escolhe Pago e define o Preço e a Moeda.\nEm Opções de pagamento mantém Herdar das definições da minha conta, ou escolhe Personalizado para este tipo de reunião.\nPagar online leva o convidado ao Stripe Checkout antes de a marcação ser confirmada; pagar por fatura confirma de imediato e envia uma fatura por e-mail.\nCada pagamento aparece na página Faturas, onde podes reenviar uma fatura ou Reembolsar.', // MT
    de: 'Gehe zu Einstellungen → Zahlungen und klicke unter Mein Konto (du verkaufst als du selbst) oder unter Workspace-Konto auf Stripe verbinden.\nHake deine Standard-Zahlungsoptionen an: Online bezahlen (Karte), Per Rechnung bezahlen oder beides. Mit Testzahlung prüfst du die Verbindung.\nÖffne den Meeting-Typ, gehe zum Tab Preis, wähle Kostenpflichtig und lege Preis und Währung fest.\nBehalte unter Zahlungsoptionen Aus meinen Kontoeinstellungen übernehmen oder wähle Eigene für diesen Meeting-Typ.\nBei Online-Zahlung geht der Gast vor der Bestätigung zu Stripe Checkout; bei Rechnung wird sofort bestätigt und eine Rechnung per E-Mail verschickt.\nJede Zahlung landet auf der Seite Rechnungen, wo du eine Rechnung erneut senden oder Erstatten kannst.', // MT
    fr: 'Va dans Paramètres → Paiements et clique sur Connecter Stripe sous Mon compte (tu vends en ton nom) ou sous Compte de l’espace de travail.\nCoche tes Options de paiement par défaut : Payer en ligne (carte), Payer sur facture, ou les deux. Utilise Paiement test pour vérifier la connexion.\nOuvre le type de réunion, va dans l’onglet Tarif, choisis Payant et définis le Prix et la Devise.\nSous Options de paiement, garde Hériter des paramètres de mon compte, ou choisis Personnalisé pour ce type de réunion.\nLe paiement en ligne envoie l’invité vers Stripe Checkout avant la confirmation ; le paiement sur facture confirme aussitôt et envoie une facture par e-mail.\nChaque paiement arrive sur la page Factures, où tu peux renvoyer une facture ou Rembourser.', // MT
  },
  help_g_intake_approval_title: {
    en: 'Ask questions, or approve bookings first',
    nl: 'Vragen stellen, of boekingen eerst goedkeuren',
    es: 'Hacer preguntas, o aprobar las reservas primero', // MT
    pt: 'Fazer perguntas, ou aprovar marcações primeiro', // MT
    de: 'Fragen stellen oder Buchungen erst freigeben', // MT
    fr: 'Poser des questions, ou approuver les réservations d’abord', // MT
  },
  help_g_intake_approval_steps: {
    en: 'Save the meeting type first: the Intake tab unlocks once it exists.\nIn the Intake tab click Add a question, type the Question, pick its type and tick Required if it must be answered.\nClick Save intake fields. The answers show on the booking when you open it.\nTo vet bookings, go to Basics → Approval and choose Always require approval.\nSuch a booking shows as Pending on the Bookings page. Open it and click Approve or Reject; the invitee gets an email either way.',
    nl: 'Sla het meetingtype eerst op: het tabblad Intake gaat pas open als het bestaat.\nKlik in het tabblad Intake op Vraag toevoegen, typ de Vraag, kies het type en vink Verplicht aan als een antwoord nodig is.\nKlik op Intakevelden opslaan. De antwoorden staan op de boeking als je die opent.\nWil je boekingen eerst beoordelen? Ga naar Basis → Goedkeuring en kies Altijd goedkeuring vereisen.\nZo’n boeking staat als In afwachting op de pagina Boekingen. Open hem en klik op Goedkeuren of Afwijzen; de genodigde krijgt in beide gevallen een e-mail.',
    es: 'Guarda primero el tipo de reunión: la pestaña Formulario se desbloquea cuando existe.\nEn la pestaña Formulario pulsa Añadir pregunta, escribe la Pregunta, elige su tipo y marca Obligatoria si debe responderse.\nPulsa Guardar campos del formulario. Las respuestas aparecen en la reserva al abrirla.\nPara revisar las reservas, ve a Básico → Aprobación y elige Requerir siempre aprobación.\nEsa reserva aparece como Pendiente en la página Reservas. Ábrela y pulsa Aprobar o Rechazar; el invitado recibe un correo en ambos casos.', // MT
    pt: 'Guarda primeiro o tipo de reunião: o separador Formulário desbloqueia quando ele existe.\nNo separador Formulário clica em Adicionar pergunta, escreve a Pergunta, escolhe o tipo e marca Obrigatória se tiver de ser respondida.\nClica em Guardar campos do formulário. As respostas aparecem na marcação quando a abres.\nPara verificar marcações, vai a Básico → Aprovação e escolhe Exigir sempre aprovação.\nEssa marcação aparece como Pendente na página Marcações. Abre-a e clica em Aprovar ou Rejeitar; o convidado recebe um e-mail em ambos os casos.', // MT
    de: 'Speichere den Meeting-Typ zuerst: Der Tab Fragebogen wird frei, sobald er existiert.\nKlicke im Tab Fragebogen auf Frage hinzufügen, gib die Frage ein, wähle den Typ und hake Pflichtfeld an, wenn sie beantwortet werden muss.\nKlicke auf Fragebogenfelder speichern. Die Antworten stehen in der Buchung, wenn du sie öffnest.\nUm Buchungen zu prüfen, gehe zu Grundlagen → Freigabe und wähle Immer Freigabe verlangen.\nSo eine Buchung steht als Ausstehend auf der Seite Buchungen. Öffne sie und klicke auf Freigeben oder Ablehnen; der Gast bekommt in beiden Fällen eine E-Mail.', // MT
    fr: 'Enregistre d’abord le type de réunion : l’onglet Questionnaire se débloque une fois qu’il existe.\nDans l’onglet Questionnaire, clique sur Ajouter une question, saisis la Question, choisis son type et coche Obligatoire si une réponse est requise.\nClique sur Enregistrer les champs du questionnaire. Les réponses apparaissent sur la réservation quand tu l’ouvres.\nPour vérifier les réservations, va dans Général → Approbation et choisis Toujours exiger une approbation.\nUne telle réservation apparaît comme En attente sur la page Réservations. Ouvre-la et clique sur Approuver ou Refuser ; l’invité reçoit un e-mail dans les deux cas.', // MT
  },
  help_g_bookings_title: {
    en: 'Find, reschedule or cancel a booking',
    nl: 'Een boeking vinden, verzetten of annuleren',
    es: 'Buscar, reprogramar o cancelar una reserva', // MT
    pt: 'Encontrar, remarcar ou cancelar uma marcação', // MT
    de: 'Eine Buchung finden, verschieben oder absagen', // MT
    fr: 'Trouver, reprogrammer ou annuler une réservation', // MT
  },
  help_g_bookings_steps: {
    en: 'Go to Bookings. Switch between Upcoming, Past and All, and between List, Week and Month view.\nUse Scope to show one team’s bookings, and tick Include cancelled to see cancelled ones.\nClick a booking to open it: when, who, where, what was paid, and Join meeting when there is a link.\nClick Reschedule this booking to pick a new time, or Cancel this booking. A one-off meeting or a meeting poll cannot be rescheduled.\nInvitees can do the same from the links in their confirmation email.',
    nl: 'Ga naar Boekingen. Wissel tussen Aankomend, Voorbij en Alles, en tussen Lijst-, Week- en Maandweergave.\nGebruik Scope om de boekingen van één team te zien, en vink Inclusief geannuleerd aan voor geannuleerde boekingen.\nKlik op een boeking om hem te openen: wanneer, wie, waar, wat er betaald is, en Deelnemen aan meeting als er een link is.\nKlik op Deze boeking verzetten om een nieuwe tijd te kiezen, of op Deze boeking annuleren. Een eenmalige meeting of een meetingpoll kan niet verzet worden.\nGenodigden kunnen hetzelfde doen via de links in hun bevestigingsmail.',
    es: 'Ve a Reservas. Cambia entre Próximas, Pasadas y Todas, y entre vista de Lista, Semana y Mes.\nUsa Ámbito para ver las reservas de un equipo, y marca Incluir canceladas para ver las canceladas.\nPulsa una reserva para abrirla: cuándo, quién, dónde, qué se pagó, y Unirse a la reunión cuando hay un enlace.\nPulsa Reprogramar esta reserva para elegir una nueva hora, o Cancelar esta reserva. Una reunión única o una encuesta de reunión no se puede reprogramar.\nLos invitados pueden hacer lo mismo desde los enlaces de su correo de confirmación.', // MT
    pt: 'Vai a Marcações. Alterna entre Próximas, Passadas e Todas, e entre vista de Lista, Semana e Mês.\nUsa Âmbito para ver as marcações de uma equipa, e marca Incluir canceladas para ver as canceladas.\nClica numa marcação para a abrir: quando, quem, onde, o que foi pago, e Entrar na reunião quando há um link.\nClica em Remarcar esta marcação para escolher uma nova hora, ou em Cancelar esta marcação. Uma reunião única ou uma sondagem de reunião não pode ser remarcada.\nOs convidados podem fazer o mesmo a partir dos links no e-mail de confirmação.', // MT
    de: 'Gehe zu Buchungen. Wechsle zwischen Bevorstehend, Vergangen und Alle sowie zwischen Listen-, Wochen- und Monatsansicht.\nMit Bereich zeigst du die Buchungen eines Teams; hake Abgesagte einschließen an, um abgesagte zu sehen.\nKlicke auf eine Buchung, um sie zu öffnen: wann, wer, wo, was bezahlt wurde, und Meeting beitreten, wenn es einen Link gibt.\nKlicke auf Diese Buchung verschieben, um eine neue Zeit zu wählen, oder auf Diese Buchung absagen. Ein einmaliges Meeting oder eine Terminumfrage lässt sich nicht verschieben.\nGäste können dasselbe über die Links in ihrer Bestätigungs-E-Mail tun.', // MT
    fr: 'Va dans Réservations. Passe de À venir à Passées ou Toutes, et de la vue Liste à Semaine ou Mois.\nUtilise Portée pour afficher les réservations d’une équipe, et coche Inclure les annulées pour voir celles qui ont été annulées.\nClique sur une réservation pour l’ouvrir : quand, qui, où, ce qui a été payé, et Rejoindre la réunion quand il y a un lien.\nClique sur Reprogrammer cette réservation pour choisir un nouvel horaire, ou sur Annuler cette réservation. Une réunion unique ou un sondage de réunion ne peut pas être reprogrammé.\nLes invités peuvent faire de même depuis les liens de leur e-mail de confirmation.', // MT
  },
  help_g_team_title: {
    en: 'Set up a team with shared booking links',
    nl: 'Een team met gedeelde boekingslinks opzetten',
    es: 'Crear un equipo con enlaces de reserva compartidos', // MT
    pt: 'Criar uma equipa com links de marcação partilhados', // MT
    de: 'Ein Team mit gemeinsamen Buchungslinks einrichten', // MT
    fr: 'Créer une équipe avec des liens de réservation partagés', // MT
  },
  help_g_team_steps: {
    en: 'Go to Teams, click New team, set the Team name and Public URL, then click Create team.\nUnder Members, search people in your workspace, or type a name to invite someone new by email. Give each one the role Lead or Member.\nClick Team availability on a member to give them narrower hours for this team only.\nUnder Visibility choose Members only or Org-wide.\nClick New meeting type on the team page and pick Round-robin (one host per booking, chosen by Who gets the booking) or Collective (every assignee attends).\nSave it, then choose the Assignees at the bottom of the meeting type. The team’s public page is the Public URL shown on Teams.',
    nl: 'Ga naar Teams, klik op Nieuw team, vul Teamnaam en Openbare URL in en klik op Team aanmaken.\nZoek bij Leden mensen in je werkruimte, of typ een naam om iemand nieuws per e-mail uit te nodigen. Geef iedereen de rol Lead of Lid.\nKlik bij een lid op Teambeschikbaarheid om alleen voor dit team krappere uren in te stellen.\nKies bij Zichtbaarheid Alleen leden of Hele organisatie.\nKlik op de teampagina op Nieuw meetingtype en kies Roulerend (één host per boeking, gekozen via Wie de boeking krijgt) of Collectief (alle toegewezen hosts zijn erbij).\nSla het op en kies onderaan het meetingtype de Toegewezen hosts. De publieke pagina van het team is de Openbare URL die op Teams staat.',
    es: 'Ve a Equipos, pulsa Nuevo equipo, define el Nombre del equipo y la URL pública y pulsa Crear equipo.\nEn Miembros, busca personas de tu espacio de trabajo, o escribe un nombre para invitar a alguien nuevo por correo. Da a cada uno el rol Líder o Miembro.\nPulsa Disponibilidad del equipo en un miembro para darle horas más reducidas solo para este equipo.\nEn Visibilidad elige Solo miembros o Toda la organización.\nPulsa Nuevo tipo de reunión en la página del equipo y elige Rotativo (un anfitrión por reserva, elegido por Quién recibe la reserva) o Colectivo (asisten todos los asignados).\nGuárdalo y elige los Asignados al final del tipo de reunión. La página pública del equipo es la URL pública que aparece en Equipos.', // MT
    pt: 'Vai a Equipas, clica em Nova equipa, define o Nome da equipa e o URL público e clica em Criar equipa.\nEm Membros, procura pessoas no teu espaço de trabalho, ou escreve um nome para convidar alguém novo por e-mail. Dá a cada um o papel Líder ou Membro.\nClica em Disponibilidade da equipa num membro para lhe dar horas mais restritas só para esta equipa.\nEm Visibilidade escolhe Só membros ou Toda a organização.\nClica em Novo tipo de reunião na página da equipa e escolhe Rotativo (um anfitrião por marcação, escolhido por Quem recebe a marcação) ou Coletivo (todos os atribuídos participam).\nGuarda-o e escolhe os Atribuídos no fim do tipo de reunião. A página pública da equipa é o URL público mostrado em Equipas.', // MT
    de: 'Gehe zu Teams, klicke auf Neues Team, lege Teamname und öffentliche URL fest und klicke auf Team erstellen.\nSuche unter Mitglieder Personen aus deinem Workspace oder tippe einen Namen, um jemand Neues per E-Mail einzuladen. Gib jedem die Rolle Leitung oder Mitglied.\nKlicke bei einem Mitglied auf Team-Verfügbarkeit, um ihm nur für dieses Team engere Zeiten zu geben.\nWähle unter Sichtbarkeit Nur Mitglieder oder Gesamte Organisation.\nKlicke auf der Teamseite auf Neuer Meeting-Typ und wähle Round-Robin (ein Host pro Buchung, bestimmt über Wer bekommt die Buchung) oder Kollektiv (alle Zugewiesenen nehmen teil).\nSpeichere ihn und wähle unten im Meeting-Typ die Zugewiesenen. Die öffentliche Seite des Teams ist die unter Teams gezeigte öffentliche URL.', // MT
    fr: 'Va dans Équipes, clique sur Nouvelle équipe, définis le Nom de l’équipe et l’URL publique, puis clique sur Créer l’équipe.\nSous Membres, cherche des personnes de ton espace de travail, ou saisis un nom pour inviter quelqu’un de nouveau par e-mail. Donne à chacun le rôle Responsable ou Membre.\nClique sur Disponibilité de l’équipe sur un membre pour lui donner des horaires plus restreints pour cette équipe seulement.\nSous Visibilité, choisis Membres uniquement ou Toute l’organisation.\nClique sur Nouveau type de réunion sur la page de l’équipe et choisis Rotation (un hôte par réservation, choisi via Qui reçoit la réservation) ou Collectif (tous les assignés participent).\nEnregistre-le, puis choisis les Assignés en bas du type de réunion. La page publique de l’équipe est l’URL publique affichée dans Équipes.', // MT
  },
  help_g_poll_title: {
    en: 'Let invitees vote on a time, or offer one fixed time',
    nl: 'Genodigden laten stemmen over een tijd, of één vaste tijd aanbieden',
    es: 'Dejar que los invitados voten una hora, u ofrecer una hora fija', // MT
    pt: 'Deixar os convidados votar numa hora, ou oferecer uma hora fixa', // MT
    de: 'Gäste über eine Zeit abstimmen lassen oder eine feste Zeit anbieten', // MT
    fr: 'Laisser les invités voter pour un horaire, ou proposer un horaire fixe', // MT
  },
  help_g_poll_steps: {
    en: 'Go to Meeting types, click New and pick Meeting poll, or One-off meeting for a single fixed time. You can also switch the Event type in Basics.\nFor a one-off, set Date & time and Capacity in Basics. Invitees confirm attendance instead of picking a slot.\nFor a poll, click Create, open the Candidate slots tab, click Add slot for 2–5 date/times and click Save slots.\nShare the link. Invitees tick the slots they can attend.\nUnder Votes, click Confirm on the winning column. The poll becomes a one-off meeting at that time.',
    nl: 'Ga naar Meetingtypes, klik op Nieuw en kies Meetingpoll, of Eenmalige meeting voor één vaste tijd. Je kunt het Eventtype ook bij Basis wisselen.\nStel voor een eenmalige meeting bij Basis Datum & tijd en Capaciteit in. Genodigden bevestigen hun aanwezigheid in plaats van een tijdslot te kiezen.\nKlik voor een poll op Aanmaken, open het tabblad Kandidaat-tijden, klik op Tijd toevoegen voor 2–5 datums/tijden en klik op Tijden opslaan.\nDeel de link. Genodigden vinken de tijdsloten aan waarop ze kunnen.\nKlik bij Stemmen op Bevestigen in de winnende kolom. De poll wordt een eenmalige meeting op die tijd.',
    es: 'Ve a Tipos de reunión, pulsa Nuevo y elige Encuesta de reunión, o Reunión única para una sola hora fija. También puedes cambiar el Tipo de evento en Básico.\nPara una reunión única, define Fecha y hora y Capacidad en Básico. Los invitados confirman asistencia en lugar de elegir un hueco.\nPara una encuesta, pulsa Crear, abre la pestaña Huecos candidatos, pulsa Añadir hueco para 2–5 fechas/horas y pulsa Guardar huecos.\nComparte el enlace. Los invitados marcan los huecos a los que pueden asistir.\nEn Votos, pulsa Confirmar en la columna ganadora. La encuesta se convierte en una reunión única a esa hora.', // MT
    pt: 'Vai a Tipos de reunião, clica em Novo e escolhe Sondagem de reunião, ou Reunião única para uma única hora fixa. Também podes mudar o Tipo de evento em Básico.\nPara uma reunião única, define Data e hora e Capacidade em Básico. Os convidados confirmam presença em vez de escolher um horário.\nPara uma sondagem, clica em Criar, abre o separador Horários candidatos, clica em Adicionar horário para 2–5 datas/horas e clica em Guardar horários.\nPartilha o link. Os convidados marcam os horários em que podem.\nEm Votos, clica em Confirmar na coluna vencedora. A sondagem torna-se uma reunião única nessa hora.', // MT
    de: 'Gehe zu Meeting-Typen, klicke auf Neu und wähle Terminumfrage oder Einmaliges Meeting für eine einzelne feste Zeit. Du kannst den Ereignistyp auch unter Grundlagen wechseln.\nFür ein einmaliges Meeting legst du unter Grundlagen Datum & Uhrzeit und Kapazität fest. Gäste bestätigen ihre Teilnahme, statt einen Slot zu wählen.\nFür eine Umfrage klickst du auf Erstellen, öffnest den Tab Kandidaten-Slots, klickst für 2–5 Termine auf Slot hinzufügen und dann auf Slots speichern.\nTeile den Link. Gäste haken die Slots ab, an denen sie können.\nKlicke unter Stimmen in der Gewinnerspalte auf Bestätigen. Die Umfrage wird zu einem einmaligen Meeting zu dieser Zeit.', // MT
    fr: 'Va dans Types de réunion, clique sur Nouveau et choisis Sondage de réunion, ou Réunion unique pour un seul horaire fixe. Tu peux aussi changer le Type d’événement dans Général.\nPour une réunion unique, définis Date et heure et Capacité dans Général. Les invités confirment leur présence au lieu de choisir un créneau.\nPour un sondage, clique sur Créer, ouvre l’onglet Créneaux candidats, clique sur Ajouter un créneau pour 2 à 5 dates/heures et clique sur Enregistrer les créneaux.\nPartage le lien. Les invités cochent les créneaux où ils sont disponibles.\nSous Votes, clique sur Confirmer dans la colonne gagnante. Le sondage devient une réunion unique à cet horaire.', // MT
  },
  help_g_retire_title: {
    en: 'Archive or delete a meeting type',
    nl: 'Een meetingtype archiveren of verwijderen',
    es: 'Archivar o eliminar un tipo de reunión', // MT
    pt: 'Arquivar ou eliminar um tipo de reunião', // MT
    de: 'Einen Meeting-Typ archivieren oder löschen', // MT
    fr: 'Archiver ou supprimer un type de réunion', // MT
  },
  help_g_retire_steps: {
    en: 'Open the meeting type and scroll down to Archive or delete.\nClick Archive. It leaves your booking page and the list; bookings already made stay. Find it under the Archived tab on Meeting types.\nClick Unarchive to bring it back. It returns hidden: tick Active — accept new bookings in Basics to publish it again.\nDelete only works for a meeting type nobody has ever booked. Once anything has been booked, Delete is refused because those bookings are the record of meetings that happened. Archive it instead.',
    nl: 'Open het meetingtype en scrol naar Archiveren of verwijderen.\nKlik op Archiveren. Het verdwijnt van je boekingspagina en uit de lijst; bestaande boekingen blijven staan. Je vindt het terug onder het tabblad Gearchiveerd op Meetingtypes.\nKlik op Terughalen om het terug te zetten. Het komt verborgen terug: vink bij Basis Actief — nieuwe boekingen aannemen aan om het weer te publiceren.\nVerwijderen werkt alleen voor een meetingtype dat nog nooit geboekt is. Zodra er iets geboekt is, wordt Verwijderen geweigerd, omdat die boekingen het verslag zijn van meetings die hebben plaatsgevonden. Archiveer het dan.',
    es: 'Abre el tipo de reunión y baja hasta Archivar o eliminar.\nPulsa Archivar. Desaparece de tu página de reservas y de la lista; las reservas ya hechas se conservan. Lo encontrarás en la pestaña Archivados de Tipos de reunión.\nPulsa Desarchivar para recuperarlo. Vuelve oculto: marca Activo — aceptar nuevas reservas en Básico para publicarlo de nuevo.\nEliminar solo funciona con un tipo de reunión que nadie ha reservado nunca. En cuanto hay alguna reserva, Eliminar se rechaza porque esas reservas son el registro de las reuniones que ocurrieron. Archívalo en su lugar.', // MT
    pt: 'Abre o tipo de reunião e desce até Arquivar ou eliminar.\nClica em Arquivar. Sai da tua página de marcações e da lista; as marcações já feitas mantêm-se. Encontra-lo no separador Arquivados em Tipos de reunião.\nClica em Desarquivar para o recuperar. Volta oculto: marca Ativo — aceitar novas marcações em Básico para o publicar de novo.\nEliminar só funciona para um tipo de reunião que nunca foi marcado. Assim que houver uma marcação, Eliminar é recusado porque essas marcações são o registo das reuniões que aconteceram. Arquiva-o em vez disso.', // MT
    de: 'Öffne den Meeting-Typ und scrolle zu Archivieren oder löschen.\nKlicke auf Archivieren. Er verschwindet von deiner Buchungsseite und aus der Liste; bestehende Buchungen bleiben. Du findest ihn im Tab Archiviert unter Meeting-Typen.\nKlicke auf Aus dem Archiv holen, um ihn zurückzuholen. Er kommt verborgen zurück: Hake unter Grundlagen Aktiv — neue Buchungen annehmen an, um ihn wieder zu veröffentlichen.\nLöschen funktioniert nur bei einem Meeting-Typ, den noch nie jemand gebucht hat. Sobald etwas gebucht wurde, wird Löschen abgelehnt, weil diese Buchungen das Protokoll stattgefundener Meetings sind. Archiviere ihn stattdessen.', // MT
    fr: 'Ouvre le type de réunion et descends jusqu’à Archiver ou supprimer.\nClique sur Archiver. Il disparaît de ta page de réservation et de la liste ; les réservations déjà faites restent. Tu le retrouves dans l’onglet Archivés de Types de réunion.\nClique sur Désarchiver pour le récupérer. Il revient masqué : coche Actif — accepter de nouvelles réservations dans Général pour le publier à nouveau.\nSupprimer ne fonctionne que pour un type de réunion que personne n’a jamais réservé. Dès qu’il y a eu une réservation, Supprimer est refusé, car ces réservations sont la trace des réunions qui ont eu lieu. Archive-le plutôt.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
