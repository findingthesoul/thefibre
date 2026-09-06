// Fibre Flow — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string a signed-in user can see in Flow's interface lives
// HERE, in all locales. The locale list itself lives in @thefibre/shared/i18n
// (one definition for the whole platform); the catalog stays per-surface,
// next to its consumers. The catalog is typed so a key missing a translation
// fails `pnpm typecheck` — that is how the list stays complete as the product
// grows. Default locale: en.
//
// Register is informal (je / du / tú / você / tu). Dutch entries are native
// quality; es / pt / de / fr are machine-drafted (marked // MT) pending
// native review.
//
// Chrome only: builder canvas labels, buttons and panels ARE translated;
// node titles, step names and flow definitions authored by users are CONTENT
// and are never translated. Product terms stay untranslated everywhere:
// "flow", "run" and "gate" are Flow's own vocabulary, like "Thread" in The
// Thread.

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
  add: {
    en: 'Add',
    nl: 'Toevoegen',
    es: 'Añadir', // MT
    pt: 'Adicionar', // MT
    de: 'Hinzufügen', // MT
    fr: 'Ajouter', // MT
  },
  move: {
    en: 'Move',
    nl: 'Verplaatsen',
    es: 'Mover', // MT
    pt: 'Mover', // MT
    de: 'Verschieben', // MT
    fr: 'Déplacer', // MT
  },
  board: {
    en: 'Board',
    nl: 'Bord',
    es: 'Tablero', // MT
    pt: 'Quadro', // MT
    de: 'Board', // MT
    fr: 'Tableau', // MT
  },
  list: {
    en: 'List',
    nl: 'Lijst',
    es: 'Lista', // MT
    pt: 'Lista', // MT
    de: 'Liste', // MT
    fr: 'Liste', // MT
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
  optional: {
    en: 'Optional',
    nl: 'Optioneel',
    es: 'Opcional', // MT
    pt: 'Opcional', // MT
    de: 'Optional', // MT
    fr: 'Facultatif', // MT
  },
  required: {
    en: 'Required',
    nl: 'Verplicht',
    es: 'Obligatoria', // MT
    pt: 'Obrigatória', // MT
    de: 'Erforderlich', // MT
    fr: 'Obligatoire', // MT
  },

  // ── lifecycle / scope / status vocab ──────────────────────────────────
  lifecycle_draft: {
    en: 'draft',
    nl: 'concept',
    es: 'borrador', // MT
    pt: 'rascunho', // MT
    de: 'Entwurf', // MT
    fr: 'brouillon', // MT
  },
  lifecycle_active: {
    en: 'active',
    nl: 'actief',
    es: 'activo', // MT
    pt: 'ativo', // MT
    de: 'aktiv', // MT
    fr: 'actif', // MT
  },
  lifecycle_closed: {
    en: 'closed',
    nl: 'gesloten',
    es: 'cerrado', // MT
    pt: 'fechado', // MT
    de: 'geschlossen', // MT
    fr: 'fermé', // MT
  },
  lifecycle_archived: {
    en: 'archived',
    nl: 'gearchiveerd',
    es: 'archivado', // MT
    pt: 'arquivado', // MT
    de: 'archiviert', // MT
    fr: 'archivé', // MT
  },
  scope_personal: {
    en: 'Personal',
    nl: 'Persoonlijk',
    es: 'Personal', // MT
    pt: 'Pessoal', // MT
    de: 'Persönlich', // MT
    fr: 'Personnel', // MT
  },
  scope_team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipe', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  scope_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  status_active: {
    en: 'active',
    nl: 'actief',
    es: 'activo', // MT
    pt: 'ativo', // MT
    de: 'aktiv', // MT
    fr: 'actif', // MT
  },
  status_completed: {
    en: 'completed',
    nl: 'afgerond',
    es: 'completado', // MT
    pt: 'concluído', // MT
    de: 'abgeschlossen', // MT
    fr: 'terminé', // MT
  },
  status_withdrawn: {
    en: 'withdrawn',
    nl: 'teruggetrokken',
    es: 'retirado', // MT
    pt: 'retirado', // MT
    de: 'zurückgezogen', // MT
    fr: 'retiré', // MT
  },

  // ── dashboard ─────────────────────────────────────────────────────────
  welcome_back: {
    en: 'Welcome back',
    nl: 'Welkom terug',
    es: 'Bienvenido de nuevo', // MT
    pt: 'Bem-vindo de volta', // MT
    de: 'Willkommen zurück', // MT
    fr: 'Content de te revoir', // MT
  },
  moving_today: {
    en: "Here's what's moving today.",
    nl: 'Dit is er vandaag in beweging.',
    es: 'Esto es lo que se mueve hoy.', // MT
    pt: 'Isto é o que está em movimento hoje.', // MT
    de: 'Das bewegt sich heute.', // MT
    fr: "Voici ce qui bouge aujourd'hui.", // MT
  },
  open_tasks: {
    en: 'Open tasks',
    nl: 'Open taken',
    es: 'Tareas abiertas', // MT
    pt: 'Tarefas abertas', // MT
    de: 'Offene Aufgaben', // MT
    fr: 'Tâches ouvertes', // MT
  },
  assigned_to_you: {
    en: 'assigned to you',
    nl: 'aan jou toegewezen',
    es: 'asignadas a ti', // MT
    pt: 'atribuídas a você', // MT
    de: 'dir zugewiesen', // MT
    fr: 'qui te sont assignées', // MT
  },
  in_motion: {
    en: 'In motion',
    nl: 'In beweging',
    es: 'En movimiento', // MT
    pt: 'Em movimento', // MT
    de: 'In Bewegung', // MT
    fr: 'En mouvement', // MT
  },
  contacts_across_flows: {
    en: 'contacts across flows',
    nl: 'contacten in alle flows',
    es: 'contactos en todos los flows', // MT
    pt: 'contatos em todos os flows', // MT
    de: 'Kontakte über alle Flows', // MT
    fr: 'contacts dans tous les flows', // MT
  },
  favourite_flows: {
    en: 'Favourite flows',
    nl: 'Favoriete flows',
    es: 'Flows favoritos', // MT
    pt: 'Flows favoritos', // MT
    de: 'Lieblings-Flows', // MT
    fr: 'Flows favoris', // MT
  },
  pinned_here: {
    en: 'pinned here',
    nl: 'hier vastgezet',
    es: 'fijados aquí', // MT
    pt: 'fixados aqui', // MT
    de: 'hier angeheftet', // MT
    fr: 'épinglés ici', // MT
  },
  no_favourites_before: {
    en: 'No favourites yet. Open',
    nl: 'Nog geen favorieten. Open',
    es: 'Aún no hay favoritos. Abre', // MT
    pt: 'Ainda não há favoritos. Abra', // MT
    de: 'Noch keine Favoriten. Öffne', // MT
    fr: 'Pas encore de favoris. Ouvre', // MT
  },
  no_favourites_after: {
    en: "and tap the ☆ on the ones you use most — they'll pin here.",
    nl: 'en tik op de ☆ bij de flows die je het meest gebruikt — die komen hier te staan.',
    es: 'y toca la ☆ en los que más usas: se fijarán aquí.', // MT
    pt: 'e toque na ☆ dos que você mais usa — eles ficarão fixados aqui.', // MT
    de: 'und tippe auf die ☆ bei denen, die du am meisten nutzt — sie erscheinen dann hier.', // MT
    fr: "et touche la ☆ de ceux que tu utilises le plus — ils s'épingleront ici.", // MT
  },
  n_contacts_in_motion: {
    en: '{n} contacts in motion',
    nl: '{n} contacten in beweging',
    es: '{n} contactos en movimiento', // MT
    pt: '{n} contatos em movimento', // MT
    de: '{n} Kontakte in Bewegung', // MT
    fr: '{n} contacts en mouvement', // MT
  },

  // ── flows list ────────────────────────────────────────────────────────
  flows: {
    en: 'Flows',
    nl: 'Flows',
    es: 'Flows', // MT
    pt: 'Flows', // MT
    de: 'Flows', // MT
    fr: 'Flows', // MT
  },
  flows_blurb: {
    en: 'State machines your contacts move through. Each step is held by gate tasks.',
    nl: 'Stappenplannen waar je contacten doorheen bewegen. Elke stap wordt bewaakt door gate-taken.',
    es: 'Máquinas de estados por las que se mueven tus contactos. Cada paso está custodiado por tareas de gate.', // MT
    pt: 'Máquinas de estados pelas quais seus contatos se movem. Cada passo é guardado por tarefas de gate.', // MT
    de: 'Zustandsmaschinen, durch die sich deine Kontakte bewegen. Jeder Schritt wird von Gate-Aufgaben gehalten.', // MT
    fr: 'Des machines à états que tes contacts traversent. Chaque étape est tenue par des tâches de gate.', // MT
  },
  load_flows_failed: {
    en: 'Could not load flows.',
    nl: 'Kon de flows niet laden.',
    es: 'No se pudieron cargar los flows.', // MT
    pt: 'Não foi possível carregar os flows.', // MT
    de: 'Flows konnten nicht geladen werden.', // MT
    fr: 'Impossible de charger les flows.', // MT
  },
  new_flow: {
    en: 'New flow',
    nl: 'Nieuwe flow',
    es: 'Nuevo flow', // MT
    pt: 'Novo flow', // MT
    de: 'Neuer Flow', // MT
    fr: 'Nouveau flow', // MT
  },
  no_flows_yet: {
    en: 'No flows yet',
    nl: 'Nog geen flows',
    es: 'Aún no hay flows', // MT
    pt: 'Ainda não há flows', // MT
    de: 'Noch keine Flows', // MT
    fr: 'Pas encore de flows', // MT
  },
  no_flows_blurb: {
    en: 'A flow is a sequence of steps with gate tasks. Create one, define its graph, and start moving contacts through it.',
    nl: 'Een flow is een reeks stappen met gate-taken. Maak er een, teken het schema en laat je contacten er doorheen bewegen.',
    es: 'Un flow es una secuencia de pasos con tareas de gate. Crea uno, define su grafo y empieza a mover contactos por él.', // MT
    pt: 'Um flow é uma sequência de passos com tarefas de gate. Crie um, defina seu grafo e comece a mover contatos por ele.', // MT
    de: 'Ein Flow ist eine Abfolge von Schritten mit Gate-Aufgaben. Erstelle einen, definiere seinen Graphen und bewege Kontakte hindurch.', // MT
    fr: "Un flow est une suite d'étapes avec des tâches de gate. Crées-en un, définis son graphe et commence à y faire avancer des contacts.", // MT
  },
  n_active: {
    en: '{n} active',
    nl: '{n} actief',
    es: '{n} activos', // MT
    pt: '{n} ativos', // MT
    de: '{n} aktiv', // MT
    fr: '{n} actifs', // MT
  },
  favourite: {
    en: 'Favourite',
    nl: 'Favoriet maken',
    es: 'Marcar favorito', // MT
    pt: 'Favoritar', // MT
    de: 'Favorisieren', // MT
    fr: 'Ajouter aux favoris', // MT
  },
  unfavourite: {
    en: 'Unfavourite',
    nl: 'Favoriet verwijderen',
    es: 'Quitar favorito', // MT
    pt: 'Desfavoritar', // MT
    de: 'Favorit entfernen', // MT
    fr: 'Retirer des favoris', // MT
  },

  // ── new-flow dialog ───────────────────────────────────────────────────
  name_required: {
    en: 'Name is required.',
    nl: 'Een naam is verplicht.',
    es: 'El nombre es obligatorio.', // MT
    pt: 'O nome é obrigatório.', // MT
    de: 'Ein Name ist erforderlich.', // MT
    fr: 'Le nom est obligatoire.', // MT
  },
  team_scope_unavailable: {
    en: 'Team-scoped flows need a team picker — not in this build yet. Use Personal or Workspace for now.',
    nl: 'Flows op teamniveau hebben een teamkiezer nodig — die zit nog niet in deze versie. Gebruik voorlopig Persoonlijk of Werkruimte.',
    es: 'Los flows de equipo necesitan un selector de equipo, que aún no está en esta versión. Usa Personal o Espacio de trabajo por ahora.', // MT
    pt: 'Flows de equipe precisam de um seletor de equipe — ainda não disponível nesta versão. Use Pessoal ou Espaço de trabalho por enquanto.', // MT
    de: 'Team-Flows brauchen eine Teamauswahl — die gibt es in dieser Version noch nicht. Nimm vorerst Persönlich oder Workspace.', // MT
    fr: "Les flows d'équipe nécessitent un sélecteur d'équipe — pas encore disponible. Utilise Personnel ou Espace de travail pour l'instant.", // MT
  },
  creating: {
    en: 'Creating…',
    nl: 'Aanmaken…',
    es: 'Creando…', // MT
    pt: 'Criando…', // MT
    de: 'Wird erstellt…', // MT
    fr: 'Création…', // MT
  },
  create_flow: {
    en: 'Create flow',
    nl: 'Flow aanmaken',
    es: 'Crear flow', // MT
    pt: 'Criar flow', // MT
    de: 'Flow erstellen', // MT
    fr: 'Créer le flow', // MT
  },
  name_example_ph: {
    en: 'e.g. Sales pipeline',
    nl: 'bijv. Salespipeline',
    es: 'p. ej. Pipeline de ventas', // MT
    pt: 'p. ex. Pipeline de vendas', // MT
    de: 'z. B. Sales-Pipeline', // MT
    fr: 'p. ex. Pipeline commercial', // MT
  },
  scope: {
    en: 'Scope',
    nl: 'Bereik',
    es: 'Alcance', // MT
    pt: 'Escopo', // MT
    de: 'Bereich', // MT
    fr: 'Portée', // MT
  },
  scope_personal_hint: {
    en: 'Only you can see and run this flow.',
    nl: 'Alleen jij kunt deze flow zien en gebruiken.',
    es: 'Solo tú puedes ver y usar este flow.', // MT
    pt: 'Só você pode ver e usar este flow.', // MT
    de: 'Nur du kannst diesen Flow sehen und nutzen.', // MT
    fr: 'Toi seul peux voir et utiliser ce flow.', // MT
  },
  scope_workspace_hint: {
    en: 'Everyone in the workspace can see and run it.',
    nl: 'Iedereen in de werkruimte kan hem zien en gebruiken.',
    es: 'Todos en el espacio de trabajo pueden verlo y usarlo.', // MT
    pt: 'Todos no espaço de trabalho podem vê-lo e usá-lo.', // MT
    de: 'Alle im Workspace können ihn sehen und nutzen.', // MT
    fr: "Tout le monde dans l'espace de travail peut le voir et l'utiliser.", // MT
  },
  scope_team_hint: {
    en: 'Team picker coming in a later build.',
    nl: 'De teamkiezer komt in een latere versie.',
    es: 'El selector de equipo llegará en una versión posterior.', // MT
    pt: 'O seletor de equipe chega em uma versão futura.', // MT
    de: 'Die Teamauswahl kommt in einer späteren Version.', // MT
    fr: "Le sélecteur d'équipe arrive dans une prochaine version.", // MT
  },

  // ── flow detail header ────────────────────────────────────────────────
  self_paced: {
    en: 'self-paced',
    nl: 'eigen tempo',
    es: 'a tu ritmo', // MT
    pt: 'no seu ritmo', // MT
    de: 'im eigenen Tempo', // MT
    fr: 'à ton rythme', // MT
  },
  self_paced_tooltip: {
    en: 'Every step is open from the start and nothing is ever overdue',
    nl: 'Elke stap staat vanaf het begin open en niets is ooit te laat',
    es: 'Cada paso está abierto desde el principio y nada vence nunca', // MT
    pt: 'Cada passo está aberto desde o início e nada fica atrasado', // MT
    de: 'Jeder Schritt ist von Anfang an offen und nichts ist je überfällig', // MT
    fr: "Chaque étape est ouverte dès le départ et rien n'est jamais en retard", // MT
  },
  draft_suffix: {
    en: '(draft)',
    nl: '(concept)',
    es: '(borrador)', // MT
    pt: '(rascunho)', // MT
    de: '(Entwurf)', // MT
    fr: '(brouillon)', // MT
  },

  // ── lifecycle menu ────────────────────────────────────────────────────
  flow_actions: {
    en: 'Flow actions',
    nl: 'Flow-acties',
    es: 'Acciones del flow', // MT
    pt: 'Ações do flow', // MT
    de: 'Flow-Aktionen', // MT
    fr: 'Actions du flow', // MT
  },
  close_to_new_contacts: {
    en: 'Close to new contacts',
    nl: 'Sluiten voor nieuwe contacten',
    es: 'Cerrar a nuevos contactos', // MT
    pt: 'Fechar para novos contatos', // MT
    de: 'Für neue Kontakte schließen', // MT
    fr: 'Fermer aux nouveaux contacts', // MT
  },
  close_flow: {
    en: 'Close flow',
    nl: 'Flow sluiten',
    es: 'Cerrar flow', // MT
    pt: 'Fechar flow', // MT
    de: 'Flow schließen', // MT
    fr: 'Fermer le flow', // MT
  },
  contacts_still_active_one: {
    en: '1 contact still active in this flow. Closing stops new contacts entering; existing ones can still be moved to completion.',
    nl: 'Er is nog 1 contact actief in deze flow. Sluiten voorkomt dat nieuwe contacten instromen; bestaande kunnen nog naar afronding worden gebracht.',
    es: 'Todavía hay 1 contacto activo en este flow. Cerrarlo impide que entren contactos nuevos; los existentes aún pueden llevarse hasta el final.', // MT
    pt: 'Ainda há 1 contato ativo neste flow. Fechar impede a entrada de novos contatos; os existentes ainda podem ser levados até a conclusão.', // MT
    de: 'Noch 1 Kontakt ist in diesem Flow aktiv. Schließen verhindert neue Kontakte; bestehende können weiter bis zum Abschluss bewegt werden.', // MT
    fr: "1 contact est encore actif dans ce flow. Fermer empêche l'entrée de nouveaux contacts ; les existants peuvent encore être menés à terme.", // MT
  },
  contacts_still_active_many: {
    en: '{n} contacts still active in this flow. Closing stops new contacts entering; existing ones can still be moved to completion.',
    nl: 'Er zijn nog {n} contacten actief in deze flow. Sluiten voorkomt dat nieuwe contacten instromen; bestaande kunnen nog naar afronding worden gebracht.',
    es: 'Todavía hay {n} contactos activos en este flow. Cerrarlo impide que entren contactos nuevos; los existentes aún pueden llevarse hasta el final.', // MT
    pt: 'Ainda há {n} contatos ativos neste flow. Fechar impede a entrada de novos contatos; os existentes ainda podem ser levados até a conclusão.', // MT
    de: 'Noch {n} Kontakte sind in diesem Flow aktiv. Schließen verhindert neue Kontakte; bestehende können weiter bis zum Abschluss bewegt werden.', // MT
    fr: "{n} contacts sont encore actifs dans ce flow. Fermer empêche l'entrée de nouveaux contacts ; les existants peuvent encore être menés à terme.", // MT
  },
  reopen: {
    en: 'Reopen',
    nl: 'Heropenen',
    es: 'Reabrir', // MT
    pt: 'Reabrir', // MT
    de: 'Wieder öffnen', // MT
    fr: 'Rouvrir', // MT
  },
  archive: {
    en: 'Archive',
    nl: 'Archiveren',
    es: 'Archivar', // MT
    pt: 'Arquivar', // MT
    de: 'Archivieren', // MT
    fr: 'Archiver', // MT
  },
  archive_flow: {
    en: 'Archive flow',
    nl: 'Flow archiveren',
    es: 'Archivar flow', // MT
    pt: 'Arquivar flow', // MT
    de: 'Flow archivieren', // MT
    fr: 'Archiver le flow', // MT
  },
  archive_flow_q: {
    en: 'Archive this flow? It becomes read-only.',
    nl: 'Deze flow archiveren? Hij wordt dan alleen-lezen.',
    es: '¿Archivar este flow? Pasará a ser de solo lectura.', // MT
    pt: 'Arquivar este flow? Ele ficará somente leitura.', // MT
    de: 'Diesen Flow archivieren? Er wird dann schreibgeschützt.', // MT
    fr: 'Archiver ce flow ? Il deviendra en lecture seule.', // MT
  },
  restore_to_active: {
    en: 'Restore to active',
    nl: 'Terugzetten naar actief',
    es: 'Restaurar a activo', // MT
    pt: 'Restaurar para ativo', // MT
    de: 'Wieder aktivieren', // MT
    fr: 'Restaurer en actif', // MT
  },
  make_self_paced: {
    en: 'Make self-paced',
    nl: 'Op eigen tempo zetten',
    es: 'Hacerlo a tu ritmo', // MT
    pt: 'Tornar no seu ritmo', // MT
    de: 'Auf eigenes Tempo stellen', // MT
    fr: 'Passer à ton rythme', // MT
  },
  make_self_paced_title: {
    en: 'Make this flow self-paced',
    nl: 'Deze flow op eigen tempo zetten',
    es: 'Hacer este flow a tu ritmo', // MT
    pt: 'Tornar este flow no seu ritmo', // MT
    de: 'Diesen Flow auf eigenes Tempo stellen', // MT
    fr: 'Passer ce flow à ton rythme', // MT
  },
  make_self_paced_msg: {
    en: 'Every step opens from the start, each one gets its tasks when a run begins, and no due dates are set — so nothing here can ever be overdue. Gates stay visible but stop holding anyone back. Runs already under way keep the tasks they have.',
    nl: 'Elke stap staat vanaf het begin open, elke stap krijgt zijn taken zodra een run start, en er worden geen deadlines gezet — dus niets kan hier ooit te laat zijn. Gates blijven zichtbaar maar houden niemand meer tegen. Lopende runs houden de taken die ze hebben.',
    es: 'Cada paso se abre desde el principio, cada uno recibe sus tareas cuando empieza un run y no se fijan fechas límite, así que nada puede vencer nunca. Los gates siguen visibles pero dejan de retener a nadie. Los runs en curso conservan sus tareas.', // MT
    pt: 'Cada passo abre desde o início, cada um recebe suas tarefas quando um run começa e nenhum prazo é definido — então nada aqui pode ficar atrasado. Os gates continuam visíveis mas deixam de segurar alguém. Runs em andamento mantêm as tarefas que têm.', // MT
    de: 'Jeder Schritt ist von Anfang an offen, jeder erhält seine Aufgaben beim Start eines Runs, und es werden keine Fristen gesetzt — hier kann also nie etwas überfällig sein. Gates bleiben sichtbar, halten aber niemanden mehr auf. Laufende Runs behalten ihre Aufgaben.', // MT
    fr: "Chaque étape s'ouvre dès le départ, chacune reçoit ses tâches quand un run démarre, et aucune échéance n'est fixée — rien ne peut donc jamais être en retard. Les gates restent visibles mais ne bloquent plus personne. Les runs en cours gardent leurs tâches.", // MT
  },
  make_gated: {
    en: 'Make gated',
    nl: 'Gates aanzetten',
    es: 'Activar gates', // MT
    pt: 'Ativar gates', // MT
    de: 'Gates aktivieren', // MT
    fr: 'Activer les gates', // MT
  },
  make_gated_title: {
    en: 'Make this flow gated',
    nl: 'Gates aanzetten voor deze flow',
    es: 'Activar gates en este flow', // MT
    pt: 'Ativar gates neste flow', // MT
    de: 'Gates für diesen Flow aktivieren', // MT
    fr: 'Activer les gates sur ce flow', // MT
  },
  make_gated_msg: {
    en: "Back to a state machine: a run sits on one step, moves along the transitions you drew, and gates hold it until their required tasks are done. New runs get only the entry step's tasks.",
    nl: 'Terug naar een stappenplan: een run staat op één stap, beweegt langs de overgangen die je hebt getekend, en gates houden hem vast tot hun verplichte taken af zijn. Nieuwe runs krijgen alleen de taken van de startstap.',
    es: 'De vuelta a una máquina de estados: un run está en un solo paso, avanza por las transiciones que dibujaste y los gates lo retienen hasta completar sus tareas obligatorias. Los runs nuevos reciben solo las tareas del paso de entrada.', // MT
    pt: 'De volta a uma máquina de estados: um run fica em um passo, avança pelas transições que você desenhou e os gates o seguram até suas tarefas obrigatórias serem concluídas. Runs novos recebem apenas as tarefas do passo de entrada.', // MT
    de: 'Zurück zur Zustandsmaschine: Ein Run sitzt auf einem Schritt, bewegt sich entlang der von dir gezeichneten Übergänge, und Gates halten ihn, bis ihre Pflichtaufgaben erledigt sind. Neue Runs erhalten nur die Aufgaben des Startschritts.', // MT
    fr: "Retour à une machine à états : un run se trouve sur une étape, avance le long des transitions que tu as tracées, et les gates le retiennent tant que leurs tâches obligatoires ne sont pas faites. Les nouveaux runs ne reçoivent que les tâches de l'étape d'entrée.", // MT
  },
  delete_flow: {
    en: 'Delete flow',
    nl: 'Flow verwijderen',
    es: 'Eliminar flow', // MT
    pt: 'Excluir flow', // MT
    de: 'Flow löschen', // MT
    fr: 'Supprimer le flow', // MT
  },
  delete_flow_q: {
    en: 'Delete this flow? It will be hidden (soft delete). Active contacts keep their history.',
    nl: 'Deze flow verwijderen? Hij wordt verborgen (soft delete). Actieve contacten behouden hun geschiedenis.',
    es: '¿Eliminar este flow? Quedará oculto (borrado suave). Los contactos activos conservan su historial.', // MT
    pt: 'Excluir este flow? Ele ficará oculto (soft delete). Contatos ativos mantêm seu histórico.', // MT
    de: 'Diesen Flow löschen? Er wird ausgeblendet (Soft Delete). Aktive Kontakte behalten ihre Historie.', // MT
    fr: "Supprimer ce flow ? Il sera masqué (suppression douce). Les contacts actifs gardent leur historique.", // MT
  },
  delete: {
    en: 'Delete',
    nl: 'Verwijderen',
    es: 'Eliminar', // MT
    pt: 'Excluir', // MT
    de: 'Löschen', // MT
    fr: 'Supprimer', // MT
  },

  // ── flow tabs ─────────────────────────────────────────────────────────
  tab_builder: {
    en: 'Builder',
    nl: 'Builder',
    es: 'Constructor', // MT
    pt: 'Construtor', // MT
    de: 'Builder', // MT
    fr: 'Éditeur', // MT
  },
  tab_reports: {
    en: 'Reports',
    nl: 'Rapporten',
    es: 'Informes', // MT
    pt: 'Relatórios', // MT
    de: 'Berichte', // MT
    fr: 'Rapports', // MT
  },

  // ── builder canvas ────────────────────────────────────────────────────
  add_step: {
    en: 'Add step',
    nl: 'Stap toevoegen',
    es: 'Añadir paso', // MT
    pt: 'Adicionar passo', // MT
    de: 'Schritt hinzufügen', // MT
    fr: 'Ajouter une étape', // MT
  },
  auto_arrange: {
    en: 'Auto-arrange',
    nl: 'Automatisch schikken',
    es: 'Ordenar automáticamente', // MT
    pt: 'Organizar automaticamente', // MT
    de: 'Automatisch anordnen', // MT
    fr: 'Réorganiser', // MT
  },
  auto_arrange_title: {
    en: 'Tidy cards into clean columns',
    nl: 'Zet de kaarten netjes in kolommen',
    es: 'Ordena las tarjetas en columnas limpias', // MT
    pt: 'Organiza os cartões em colunas limpas', // MT
    de: 'Karten sauber in Spalten anordnen', // MT
    fr: 'Range les cartes en colonnes propres', // MT
  },
  canvas_settings: {
    en: 'Canvas settings',
    nl: 'Canvasinstellingen',
    es: 'Ajustes del lienzo', // MT
    pt: 'Configurações do canvas', // MT
    de: 'Canvas-Einstellungen', // MT
    fr: 'Réglages du canevas', // MT
  },
  grid: {
    en: 'Grid',
    nl: 'Raster',
    es: 'Cuadrícula', // MT
    pt: 'Grade', // MT
    de: 'Raster', // MT
    fr: 'Grille', // MT
  },
  magnetic_snap: {
    en: 'Magnetic (snap)',
    nl: 'Magnetisch (uitlijnen)',
    es: 'Magnético (ajustar)', // MT
    pt: 'Magnético (encaixar)', // MT
    de: 'Magnetisch (einrasten)', // MT
    fr: 'Magnétique (aimanter)', // MT
  },
  full_screen: {
    en: 'Full screen',
    nl: 'Volledig scherm',
    es: 'Pantalla completa', // MT
    pt: 'Tela cheia', // MT
    de: 'Vollbild', // MT
    fr: 'Plein écran', // MT
  },
  exit_full_screen: {
    en: 'Exit full screen (Esc)',
    nl: 'Volledig scherm verlaten (Esc)',
    es: 'Salir de pantalla completa (Esc)', // MT
    pt: 'Sair da tela cheia (Esc)', // MT
    de: 'Vollbild verlassen (Esc)', // MT
    fr: 'Quitter le plein écran (Échap)', // MT
  },
  publish: {
    en: 'Publish',
    nl: 'Publiceren',
    es: 'Publicar', // MT
    pt: 'Publicar', // MT
    de: 'Veröffentlichen', // MT
    fr: 'Publier', // MT
  },
  save_republish: {
    en: 'Save & republish',
    nl: 'Opslaan & opnieuw publiceren',
    es: 'Guardar y republicar', // MT
    pt: 'Salvar e republicar', // MT
    de: 'Speichern & erneut veröffentlichen', // MT
    fr: 'Enregistrer et republier', // MT
  },
  saved_notice: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
  },
  published_notice: {
    en: 'Published. The flow is now active.',
    nl: 'Gepubliceerd. De flow is nu actief.',
    es: 'Publicado. El flow ya está activo.', // MT
    pt: 'Publicado. O flow agora está ativo.', // MT
    de: 'Veröffentlicht. Der Flow ist jetzt aktiv.', // MT
    fr: 'Publié. Le flow est maintenant actif.', // MT
  },
  meta_reason: {
    en: 'must be a JSON object, e.g. {"purpose": "…"}',
    nl: 'moet een JSON-object zijn, bijv. {"purpose": "…"}',
    es: 'debe ser un objeto JSON, p. ej. {"purpose": "…"}', // MT
    pt: 'deve ser um objeto JSON, p. ex. {"purpose": "…"}', // MT
    de: 'muss ein JSON-Objekt sein, z. B. {"purpose": "…"}', // MT
    fr: 'doit être un objet JSON, p. ex. {"purpose": "…"}', // MT
  },
  step_meta_error: {
    en: 'Step "{name}": extra fields {reason}',
    nl: 'Stap "{name}": extra velden {reason}',
    es: 'Paso "{name}": los campos extra {reason}', // MT
    pt: 'Passo "{name}": os campos extras {reason}', // MT
    de: 'Schritt "{name}": Zusatzfelder {reason}', // MT
    fr: 'Étape "{name}" : les champs supplémentaires {reason}', // MT
  },
  extra_fields_error: {
    en: 'Extra fields {reason}',
    nl: 'Extra velden {reason}',
    es: 'Los campos extra {reason}', // MT
    pt: 'Os campos extras {reason}', // MT
    de: 'Zusatzfelder {reason}', // MT
    fr: 'Les champs supplémentaires {reason}', // MT
  },
  to_publish: {
    en: 'To publish:',
    nl: 'Om te publiceren:',
    es: 'Para publicar:', // MT
    pt: 'Para publicar:', // MT
    de: 'Zum Veröffentlichen:', // MT
    fr: 'Pour publier :', // MT
  },
  hint_set_entry: {
    en: 'Set one step’s Kind to "Entry".',
    nl: 'Zet het type van één stap op "Start".',
    es: 'Pon el tipo de un paso en "Entrada".', // MT
    pt: 'Defina o tipo de um passo como "Entrada".', // MT
    de: 'Setze die Art eines Schritts auf "Start".', // MT
    fr: "Règle le type d'une étape sur « Entrée ».", // MT
  },
  hint_one_entry: {
    en: 'Only one step can be the Entry — change the extras.',
    nl: 'Slechts één stap kan de start zijn — pas de andere aan.',
    es: 'Solo un paso puede ser la entrada: cambia los demás.', // MT
    pt: 'Só um passo pode ser a entrada — mude os demais.', // MT
    de: 'Nur ein Schritt kann der Start sein — ändere die übrigen.', // MT
    fr: "Une seule étape peut être l'entrée — modifie les autres.", // MT
  },
  hint_mark_end: {
    en: 'Mark a step as an End (positive ✓ or negative ✗).',
    nl: 'Markeer een stap als einde (positief ✓ of negatief ✗).',
    es: 'Marca un paso como final (positivo ✓ o negativo ✗).', // MT
    pt: 'Marque um passo como fim (positivo ✓ ou negativo ✗).', // MT
    de: 'Markiere einen Schritt als Ende (positiv ✓ oder negativ ✗).', // MT
    fr: 'Marque une étape comme fin (positive ✓ ou négative ✗).', // MT
  },
  hint_open_panel: {
    en: 'Click a step card to open its panel and change its Kind.',
    nl: 'Klik op een stapkaart om het paneel te openen en het type te wijzigen.',
    es: 'Haz clic en una tarjeta de paso para abrir su panel y cambiar su tipo.', // MT
    pt: 'Clique em um cartão de passo para abrir seu painel e mudar seu tipo.', // MT
    de: 'Klicke auf eine Schrittkarte, um ihr Panel zu öffnen und die Art zu ändern.', // MT
    fr: "Clique sur une carte d'étape pour ouvrir son panneau et changer son type.", // MT
  },
  canvas_footer: {
    en: "Drag cards to arrange · drag from a card's right edge to another's left to connect · click a card or arrow to edit · one Entry + at least one End step required to publish.",
    nl: 'Sleep kaarten om te schikken · sleep van de rechterrand van een kaart naar de linkerrand van een andere om te verbinden · klik op een kaart of pijl om te bewerken · één start + minstens één eindstap nodig om te publiceren.',
    es: 'Arrastra tarjetas para ordenarlas · arrastra del borde derecho de una al izquierdo de otra para conectar · haz clic en una tarjeta o flecha para editar · se necesita una entrada + al menos un paso final para publicar.', // MT
    pt: 'Arraste os cartões para organizar · arraste da borda direita de um até a esquerda de outro para conectar · clique em um cartão ou seta para editar · é preciso uma entrada + pelo menos um passo final para publicar.', // MT
    de: 'Ziehe Karten zum Anordnen · ziehe vom rechten Rand einer Karte zum linken einer anderen zum Verbinden · klicke auf Karte oder Pfeil zum Bearbeiten · ein Start + mindestens ein Endschritt nötig zum Veröffentlichen.', // MT
    fr: "Fais glisser les cartes pour les ranger · du bord droit d'une carte au bord gauche d'une autre pour connecter · clique sur une carte ou une flèche pour éditer · une entrée + au moins une étape finale sont requises pour publier.", // MT
  },
  new_step: {
    en: 'New step',
    nl: 'Nieuwe stap',
    es: 'Nuevo paso', // MT
    pt: 'Novo passo', // MT
    de: 'Neuer Schritt', // MT
    fr: 'Nouvelle étape', // MT
  },
  new_task: {
    en: 'New task',
    nl: 'Nieuwe taak',
    es: 'Nueva tarea', // MT
    pt: 'Nova tarefa', // MT
    de: 'Neue Aufgabe', // MT
    fr: 'Nouvelle tâche', // MT
  },
  transition_default_label: {
    en: 'Transition',
    nl: 'Overgang',
    es: 'Transición', // MT
    pt: 'Transição', // MT
    de: 'Übergang', // MT
    fr: 'Transition', // MT
  },
  step_name_ph: {
    en: 'Step name',
    nl: 'Naam van de stap',
    es: 'Nombre del paso', // MT
    pt: 'Nome do passo', // MT
    de: 'Name des Schritts', // MT
    fr: "Nom de l'étape", // MT
  },
  chip_start: {
    en: 'Start',
    nl: 'Start',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Départ', // MT
  },
  chip_step: {
    en: 'Step',
    nl: 'Stap',
    es: 'Paso', // MT
    pt: 'Passo', // MT
    de: 'Schritt', // MT
    fr: 'Étape', // MT
  },
  chip_end: {
    en: 'End',
    nl: 'Einde',
    es: 'Fin', // MT
    pt: 'Fim', // MT
    de: 'Ende', // MT
    fr: 'Fin', // MT
  },
  chip_loop: {
    en: 'Loop',
    nl: 'Lus',
    es: 'Bucle', // MT
    pt: 'Loop', // MT
    de: 'Schleife', // MT
    fr: 'Boucle', // MT
  },
  step: {
    en: 'Step',
    nl: 'Stap',
    es: 'Paso', // MT
    pt: 'Passo', // MT
    de: 'Schritt', // MT
    fr: 'Étape', // MT
  },
  transition: {
    en: 'Transition',
    nl: 'Overgang',
    es: 'Transición', // MT
    pt: 'Transição', // MT
    de: 'Übergang', // MT
    fr: 'Transition', // MT
  },
  kind: {
    en: 'Kind',
    nl: 'Type',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Art', // MT
    fr: 'Type', // MT
  },
  kind_entry: {
    en: 'Entry',
    nl: 'Start',
    es: 'Entrada', // MT
    pt: 'Entrada', // MT
    de: 'Start', // MT
    fr: 'Entrée', // MT
  },
  kind_normal: {
    en: 'Normal',
    nl: 'Normaal',
    es: 'Normal', // MT
    pt: 'Normal', // MT
    de: 'Normal', // MT
    fr: 'Normale', // MT
  },
  kind_end_positive: {
    en: 'End — positive ✓',
    nl: 'Einde — positief ✓',
    es: 'Fin — positivo ✓', // MT
    pt: 'Fim — positivo ✓', // MT
    de: 'Ende — positiv ✓', // MT
    fr: 'Fin — positive ✓', // MT
  },
  kind_end_negative: {
    en: 'End — negative ✗',
    nl: 'Einde — negatief ✗',
    es: 'Fin — negativo ✗', // MT
    pt: 'Fim — negativo ✗', // MT
    de: 'Ende — negativ ✗', // MT
    fr: 'Fin — négative ✗', // MT
  },
  kind_loop: {
    en: 'Loop — back to start',
    nl: 'Lus — terug naar start',
    es: 'Bucle — vuelta al inicio', // MT
    pt: 'Loop — de volta ao início', // MT
    de: 'Schleife — zurück zum Start', // MT
    fr: 'Boucle — retour au départ', // MT
  },
  actor_personal: {
    en: 'You (personal)',
    nl: 'Jij (persoonlijk)',
    es: 'Tú (personal)', // MT
    pt: 'Você (pessoal)', // MT
    de: 'Du (persönlich)', // MT
    fr: 'Toi (personnel)', // MT
  },
  actor_team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipe', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  actor_contact: {
    en: 'Contact',
    nl: 'Contact',
    es: 'Contacto', // MT
    pt: 'Contato', // MT
    de: 'Kontakt', // MT
    fr: 'Contact', // MT
  },
  expected_duration_days: {
    en: 'Expected duration (days)',
    nl: 'Verwachte duur (dagen)',
    es: 'Duración prevista (días)', // MT
    pt: 'Duração prevista (dias)', // MT
    de: 'Erwartete Dauer (Tage)', // MT
    fr: 'Durée prévue (jours)', // MT
  },
  section: {
    en: 'Section',
    nl: 'Sectie',
    es: 'Sección', // MT
    pt: 'Seção', // MT
    de: 'Abschnitt', // MT
    fr: 'Section', // MT
  },
  section_help: {
    en: "Groups long flows into sections. Steps sharing the lower value belong together — it's the stable one, so rename the label freely but change the key only deliberately. Lowercase letters, digits, _ and -.",
    nl: 'Groepeert lange flows in secties. Stappen met dezelfde onderste waarde horen bij elkaar — dat is de stabiele, dus hernoem het label gerust maar wijzig de sleutel alleen bewust. Kleine letters, cijfers, _ en -.',
    es: 'Agrupa flows largos en secciones. Los pasos que comparten el valor inferior van juntos: es el estable, así que renombra la etiqueta con libertad pero cambia la clave solo a propósito. Minúsculas, dígitos, _ y -.', // MT
    pt: 'Agrupa flows longos em seções. Passos que compartilham o valor de baixo pertencem juntos — é o estável, então renomeie o rótulo à vontade, mas mude a chave só de propósito. Minúsculas, dígitos, _ e -.', // MT
    de: 'Gruppiert lange Flows in Abschnitte. Schritte mit demselben unteren Wert gehören zusammen — er ist der stabile: das Label kannst du frei umbenennen, den Schlüssel nur bewusst ändern. Kleinbuchstaben, Ziffern, _ und -.', // MT
    fr: "Regroupe les longs flows en sections. Les étapes partageant la valeur du bas vont ensemble — c'est la stable : renomme le libellé librement, mais ne change la clé que délibérément. Minuscules, chiffres, _ et -.", // MT
  },
  extra_fields: {
    en: 'Extra fields',
    nl: 'Extra velden',
    es: 'Campos extra', // MT
    pt: 'Campos extras', // MT
    de: 'Zusatzfelder', // MT
    fr: 'Champs supplémentaires', // MT
  },
  extra_fields_help: {
    en: "A JSON object for whatever an app needs on this step that the platform doesn't model — the Festival planner keeps its purpose, trap and reflection here. Fibre never reads these; apps see them verbatim.",
    nl: 'Een JSON-object voor alles wat een app op deze stap nodig heeft en het platform niet modelleert — de Festival-planner bewaart hier zijn purpose, trap en reflection. Fibre leest dit nooit; apps zien het letterlijk.',
    es: 'Un objeto JSON para lo que una app necesite en este paso y la plataforma no modele: el planificador del Festival guarda aquí su propósito, trampa y reflexión. Fibre nunca lo lee; las apps lo ven tal cual.', // MT
    pt: 'Um objeto JSON para o que um app precisar neste passo e a plataforma não modela — o planejador do Festival guarda aqui seu propósito, armadilha e reflexão. O Fibre nunca lê isto; os apps veem tal e qual.', // MT
    de: 'Ein JSON-Objekt für alles, was eine App an diesem Schritt braucht und die Plattform nicht abbildet — der Festival-Planer speichert hier Zweck, Falle und Reflexion. Fibre liest das nie; Apps sehen es wortwörtlich.', // MT
    fr: "Un objet JSON pour tout ce dont une app a besoin sur cette étape et que la plateforme ne modélise pas — le planificateur du Festival y garde son objectif, son piège et sa réflexion. Fibre ne le lit jamais ; les apps le voient tel quel.", // MT
  },
  auto_tasks_on_entry: {
    en: 'Auto-created tasks on entry',
    nl: 'Automatisch aangemaakte taken bij binnenkomst',
    es: 'Tareas creadas automáticamente al entrar', // MT
    pt: 'Tarefas criadas automaticamente na entrada', // MT
    de: 'Automatisch erstellte Aufgaben beim Eintritt', // MT
    fr: "Tâches créées automatiquement à l'entrée", // MT
  },
  add_short: {
    en: '+ add',
    nl: '+ toevoegen',
    es: '+ añadir', // MT
    pt: '+ adicionar', // MT
    de: '+ hinzufügen', // MT
    fr: '+ ajouter', // MT
  },
  delete_step: {
    en: 'Delete step',
    nl: 'Stap verwijderen',
    es: 'Eliminar paso', // MT
    pt: 'Excluir passo', // MT
    de: 'Schritt löschen', // MT
    fr: "Supprimer l'étape", // MT
  },
  delete_transition: {
    en: 'Delete transition',
    nl: 'Overgang verwijderen',
    es: 'Eliminar transición', // MT
    pt: 'Excluir transição', // MT
    de: 'Übergang löschen', // MT
    fr: 'Supprimer la transition', // MT
  },
  label: {
    en: 'Label',
    nl: 'Label',
    es: 'Etiqueta', // MT
    pt: 'Rótulo', // MT
    de: 'Label', // MT
    fr: 'Libellé', // MT
  },
  gate_logic: {
    en: 'Gate logic',
    nl: 'Gate-logica',
    es: 'Lógica del gate', // MT
    pt: 'Lógica do gate', // MT
    de: 'Gate-Logik', // MT
    fr: 'Logique du gate', // MT
  },
  gate_all_desc: {
    en: 'All required tasks must be done',
    nl: 'Alle verplichte taken moeten af zijn',
    es: 'Todas las tareas obligatorias deben estar hechas', // MT
    pt: 'Todas as tarefas obrigatórias devem estar concluídas', // MT
    de: 'Alle Pflichtaufgaben müssen erledigt sein', // MT
    fr: 'Toutes les tâches obligatoires doivent être faites', // MT
  },
  gate_any_desc: {
    en: 'Any one required task is enough',
    nl: 'Eén verplichte taak is genoeg',
    es: 'Basta con una tarea obligatoria', // MT
    pt: 'Uma única tarefa obrigatória basta', // MT
    de: 'Eine einzige Pflichtaufgabe genügt', // MT
    fr: 'Une seule tâche obligatoire suffit', // MT
  },
  gate_tasks_label: {
    en: 'Gate tasks (must be done to move)',
    nl: 'Gate-taken (moeten af zijn om te verplaatsen)',
    es: 'Tareas de gate (deben hacerse para avanzar)', // MT
    pt: 'Tarefas de gate (devem ser feitas para avançar)', // MT
    de: 'Gate-Aufgaben (müssen zum Weitergehen erledigt sein)', // MT
    fr: 'Tâches de gate (à faire pour avancer)', // MT
  },
  action_type_ph: {
    en: 'action type — auto-completes from activity',
    nl: 'actietype — vult automatisch aan vanuit activiteit',
    es: 'tipo de acción: se autocompleta desde la actividad', // MT
    pt: 'tipo de ação — autocompleta a partir da atividade', // MT
    de: 'Aktionstyp — vervollständigt sich aus der Aktivität', // MT
    fr: "type d'action — se complète depuis l'activité", // MT
  },
  contact_action_help: {
    en: 'When an activity of this type is logged for the contact (e.g. they book a Meet), this task auto-completes. Pick a known type or type your own (logged manually).',
    nl: 'Zodra er voor het contact een activiteit van dit type wordt gelogd (bijv. een Meet boeken), wordt deze taak automatisch afgevinkt. Kies een bekend type of typ je eigen (handmatig gelogd).',
    es: 'Cuando se registra una actividad de este tipo para el contacto (p. ej. reserva un Meet), esta tarea se completa sola. Elige un tipo conocido o escribe el tuyo (registrado a mano).', // MT
    pt: 'Quando uma atividade deste tipo é registrada para o contato (p. ex. ele agenda um Meet), esta tarefa se completa sozinha. Escolha um tipo conhecido ou digite o seu (registrado manualmente).', // MT
    de: 'Wird für den Kontakt eine Aktivität dieses Typs protokolliert (z. B. ein Meet gebucht), erledigt sich diese Aufgabe automatisch. Wähle einen bekannten Typ oder tippe deinen eigenen (manuell protokolliert).', // MT
    fr: "Quand une activité de ce type est enregistrée pour le contact (p. ex. il réserve un Meet), cette tâche se complète toute seule. Choisis un type connu ou tape le tien (enregistré à la main).", // MT
  },
  action_booked_meet: {
    en: 'Booked a Meet',
    nl: 'Heeft een Meet geboekt',
    es: 'Reservó un Meet', // MT
    pt: 'Agendou um Meet', // MT
    de: 'Hat einen Meet gebucht', // MT
    fr: 'A réservé un Meet', // MT
  },
  action_requested_meet: {
    en: 'Requested a Meet (needs approval)',
    nl: 'Heeft een Meet aangevraagd (goedkeuring nodig)',
    es: 'Solicitó un Meet (requiere aprobación)', // MT
    pt: 'Solicitou um Meet (precisa de aprovação)', // MT
    de: 'Hat einen Meet angefragt (Freigabe nötig)', // MT
    fr: 'A demandé un Meet (approbation requise)', // MT
  },
  action_attended_meet: {
    en: 'Attended a Meet',
    nl: 'Was bij een Meet',
    es: 'Asistió a un Meet', // MT
    pt: 'Participou de um Meet', // MT
    de: 'Hat an einem Meet teilgenommen', // MT
    fr: 'A participé à un Meet', // MT
  },
  action_attended_thread: {
    en: 'Attended a Thread session',
    nl: 'Was bij een Thread-sessie',
    es: 'Asistió a una sesión de Thread', // MT
    pt: 'Participou de uma sessão do Thread', // MT
    de: 'Hat an einer Thread-Sitzung teilgenommen', // MT
    fr: 'A participé à une session Thread', // MT
  },
  action_signed_contract: {
    en: 'Signed a contract',
    nl: 'Heeft een contract getekend',
    es: 'Firmó un contrato', // MT
    pt: 'Assinou um contrato', // MT
    de: 'Hat einen Vertrag unterschrieben', // MT
    fr: 'A signé un contrat', // MT
  },
  action_confirmed_attendance: {
    en: 'Confirmed attendance',
    nl: 'Heeft aanwezigheid bevestigd',
    es: 'Confirmó asistencia', // MT
    pt: 'Confirmou presença', // MT
    de: 'Hat Teilnahme bestätigt', // MT
    fr: 'A confirmé sa présence', // MT
  },
  action_submitted_form: {
    en: 'Submitted a form',
    nl: 'Heeft een formulier ingestuurd',
    es: 'Envió un formulario', // MT
    pt: 'Enviou um formulário', // MT
    de: 'Hat ein Formular abgeschickt', // MT
    fr: 'A envoyé un formulaire', // MT
  },

  // ── import / export design ────────────────────────────────────────────
  design_file: {
    en: 'Design file',
    nl: 'Ontwerpbestand',
    es: 'Archivo de diseño', // MT
    pt: 'Arquivo de design', // MT
    de: 'Design-Datei', // MT
    fr: 'Fichier de design', // MT
  },
  design_file_title: {
    en: 'Import or export this flow as a JSON design file',
    nl: 'Importeer of exporteer deze flow als JSON-ontwerpbestand',
    es: 'Importa o exporta este flow como archivo de diseño JSON', // MT
    pt: 'Importe ou exporte este flow como arquivo de design JSON', // MT
    de: 'Diesen Flow als JSON-Design-Datei importieren oder exportieren', // MT
    fr: 'Importe ou exporte ce flow comme fichier de design JSON', // MT
  },
  import_design: {
    en: 'Import design',
    nl: 'Ontwerp importeren',
    es: 'Importar diseño', // MT
    pt: 'Importar design', // MT
    de: 'Design importieren', // MT
    fr: 'Importer le design', // MT
  },
  import_design_desc: {
    en: 'Paste or choose a JSON design file. Nothing changes until you have seen what it will do.',
    nl: 'Plak of kies een JSON-ontwerpbestand. Er verandert niets tot je hebt gezien wat het gaat doen.',
    es: 'Pega o elige un archivo de diseño JSON. Nada cambia hasta que hayas visto lo que hará.', // MT
    pt: 'Cole ou escolha um arquivo de design JSON. Nada muda até você ver o que ele fará.', // MT
    de: 'Füge eine JSON-Design-Datei ein oder wähle eine. Nichts ändert sich, bevor du gesehen hast, was sie tun wird.', // MT
    fr: "Colle ou choisis un fichier de design JSON. Rien ne change avant que tu aies vu ce qu'il va faire.", // MT
  },
  choose_file: {
    en: 'Choose file…',
    nl: 'Bestand kiezen…',
    es: 'Elegir archivo…', // MT
    pt: 'Escolher arquivo…', // MT
    de: 'Datei wählen…', // MT
    fr: 'Choisir un fichier…', // MT
  },
  export_this_flow: {
    en: 'Export this flow',
    nl: 'Deze flow exporteren',
    es: 'Exportar este flow', // MT
    pt: 'Exportar este flow', // MT
    de: 'Diesen Flow exportieren', // MT
    fr: 'Exporter ce flow', // MT
  },
  export_failed: {
    en: 'export failed',
    nl: 'exporteren mislukt',
    es: 'la exportación falló', // MT
    pt: 'a exportação falhou', // MT
    de: 'Export fehlgeschlagen', // MT
    fr: "l'export a échoué", // MT
  },
  importing: {
    en: 'Importing…',
    nl: 'Importeren…',
    es: 'Importando…', // MT
    pt: 'Importando…', // MT
    de: 'Wird importiert…', // MT
    fr: 'Import en cours…', // MT
  },
  import: {
    en: 'Import',
    nl: 'Importeren',
    es: 'Importar', // MT
    pt: 'Importar', // MT
    de: 'Importieren', // MT
    fr: 'Importer', // MT
  },
  checking: {
    en: 'Checking…',
    nl: 'Controleren…',
    es: 'Comprobando…', // MT
    pt: 'Verificando…', // MT
    de: 'Wird geprüft…', // MT
    fr: 'Vérification…', // MT
  },
  check: {
    en: 'Check',
    nl: 'Controleren',
    es: 'Comprobar', // MT
    pt: 'Verificar', // MT
    de: 'Prüfen', // MT
    fr: 'Vérifier', // MT
  },
  plan_valid_heading: {
    en: 'Valid. Here is what Import will do:',
    nl: 'Geldig. Dit gaat importeren doen:',
    es: 'Válido. Esto es lo que hará la importación:', // MT
    pt: 'Válido. Isto é o que a importação fará:', // MT
    de: 'Gültig. Das wird der Import tun:', // MT
    fr: "Valide. Voici ce que l'import va faire :", // MT
  },
  row_steps: {
    en: 'steps',
    nl: 'stappen',
    es: 'pasos', // MT
    pt: 'passos', // MT
    de: 'Schritte', // MT
    fr: 'étapes', // MT
  },
  row_transitions: {
    en: 'transitions',
    nl: 'overgangen',
    es: 'transiciones', // MT
    pt: 'transições', // MT
    de: 'Übergänge', // MT
    fr: 'transitions', // MT
  },
  row_default_tasks: {
    en: 'default tasks',
    nl: 'standaardtaken',
    es: 'tareas predeterminadas', // MT
    pt: 'tarefas padrão', // MT
    de: 'Standardaufgaben', // MT
    fr: 'tâches par défaut', // MT
  },
  row_replacing: {
    en: 'replacing {m}.',
    nl: 'vervangt {m}.',
    es: 'reemplazando {m}.', // MT
    pt: 'substituindo {m}.', // MT
    de: 'ersetzen {m}.', // MT
    fr: 'remplaçant {m}.', // MT
  },
  lands_on_version: {
    en: 'Lands on',
    nl: 'Komt terecht op',
    es: 'Aterriza en', // MT
    pt: 'Cai na', // MT
    de: 'Landet auf', // MT
    fr: 'Atterrit sur', // MT
  },
  version_n: {
    en: 'version {n}',
    nl: 'versie {n}',
    es: 'versión {n}', // MT
    pt: 'versão {n}', // MT
    de: 'Version {n}', // MT
    fr: 'version {n}', // MT
  },
  new_draft_suffix: {
    en: '(new draft).',
    nl: '(nieuw concept).',
    es: '(borrador nuevo).', // MT
    pt: '(rascunho novo).', // MT
    de: '(neuer Entwurf).', // MT
    fr: '(nouveau brouillon).', // MT
  },
  existing_draft_suffix: {
    en: '(existing draft).',
    nl: '(bestaand concept).',
    es: '(borrador existente).', // MT
    pt: '(rascunho existente).', // MT
    de: '(bestehender Entwurf).', // MT
    fr: '(brouillon existant).', // MT
  },
  progression_label: {
    en: 'Progression',
    nl: 'Progressie',
    es: 'Progresión', // MT
    pt: 'Progressão', // MT
    de: 'Progression', // MT
    fr: 'Progression', // MT
  },
  system_key_label: {
    en: 'System key',
    nl: 'Systeemsleutel',
    es: 'Clave de sistema', // MT
    pt: 'Chave de sistema', // MT
    de: 'Systemschlüssel', // MT
    fr: 'Clé système', // MT
  },
  none_paren: {
    en: '(none)',
    nl: '(geen)',
    es: '(ninguna)', // MT
    pt: '(nenhuma)', // MT
    de: '(keiner)', // MT
    fr: '(aucune)', // MT
  },
  warn_creates_version: {
    en: "This flow's latest version is published, so importing creates version {v}.",
    nl: 'De laatste versie van deze flow is gepubliceerd, dus importeren maakt versie {v} aan.',
    es: 'La última versión de este flow está publicada, así que la importación crea la versión {v}.', // MT
    pt: 'A última versão deste flow está publicada, então a importação cria a versão {v}.', // MT
    de: 'Die letzte Version dieses Flows ist veröffentlicht, der Import erstellt daher Version {v}.', // MT
    fr: "La dernière version de ce flow est publiée, l'import crée donc la version {v}.", // MT
  },
  warn_runs_stay_one: {
    en: 'The 1 existing run stays on the version it started on until you publish.',
    nl: 'De 1 bestaande run blijft op de versie waarop hij begon tot je publiceert.',
    es: 'El único run existente se queda en la versión con la que empezó hasta que publiques.', // MT
    pt: 'O único run existente fica na versão em que começou até você publicar.', // MT
    de: 'Der 1 bestehende Run bleibt auf seiner Startversion, bis du veröffentlichst.', // MT
    fr: "Le run existant reste sur la version où il a démarré jusqu'à ce que tu publies.", // MT
  },
  warn_runs_stay_many: {
    en: 'The {n} existing runs stay on the version they started on until you publish.',
    nl: 'De {n} bestaande runs blijven op de versie waarop ze begonnen tot je publiceert.',
    es: 'Los {n} runs existentes se quedan en la versión con la que empezaron hasta que publiques.', // MT
    pt: 'Os {n} runs existentes ficam na versão em que começaram até você publicar.', // MT
    de: 'Die {n} bestehenden Runs bleiben auf ihrer Startversion, bis du veröffentlichst.', // MT
    fr: "Les {n} runs existants restent sur la version où ils ont démarré jusqu'à ce que tu publies.", // MT
  },
  warn_nothing_running: {
    en: 'Nothing is running on it yet.',
    nl: 'Er draait nog niets op.',
    es: 'Aún no corre nada en ella.', // MT
    pt: 'Ainda não há nada rodando nela.', // MT
    de: 'Darauf läuft noch nichts.', // MT
    fr: "Rien n'y tourne encore.", // MT
  },
  warn_replace_draft_one: {
    en: 'Replacing the draft in place. 1 run exists on this flow — it is pinned to its own version and is not touched.',
    nl: 'Het concept wordt ter plekke vervangen. Er bestaat 1 run op deze flow — die zit vast aan zijn eigen versie en wordt niet aangeraakt.',
    es: 'Se reemplaza el borrador en el sitio. Existe 1 run en este flow: está anclado a su propia versión y no se toca.', // MT
    pt: 'O rascunho é substituído no lugar. Existe 1 run neste flow — ele está preso à sua própria versão e não é tocado.', // MT
    de: 'Der Entwurf wird direkt ersetzt. Auf diesem Flow existiert 1 Run — er ist an seine eigene Version gebunden und bleibt unberührt.', // MT
    fr: "Le brouillon est remplacé sur place. 1 run existe sur ce flow — il est épinglé à sa propre version et n'est pas touché.", // MT
  },
  warn_replace_draft_many: {
    en: 'Replacing the draft in place. {n} runs exist on this flow — they are pinned to their own version and are not touched.',
    nl: 'Het concept wordt ter plekke vervangen. Er bestaan {n} runs op deze flow — die zitten vast aan hun eigen versie en worden niet aangeraakt.',
    es: 'Se reemplaza el borrador en el sitio. Existen {n} runs en este flow: están anclados a su propia versión y no se tocan.', // MT
    pt: 'O rascunho é substituído no lugar. Existem {n} runs neste flow — eles estão presos à sua própria versão e não são tocados.', // MT
    de: 'Der Entwurf wird direkt ersetzt. Auf diesem Flow existieren {n} Runs — sie sind an ihre eigene Version gebunden und bleiben unberührt.', // MT
    fr: "Le brouillon est remplacé sur place. {n} runs existent sur ce flow — ils sont épinglés à leur propre version et ne sont pas touchés.", // MT
  },
  warn_removed_one: {
    en: '1 step in the draft is not in this file and will disappear: {keys}.',
    nl: '1 stap in het concept staat niet in dit bestand en verdwijnt: {keys}.',
    es: '1 paso del borrador no está en este archivo y desaparecerá: {keys}.', // MT
    pt: '1 passo do rascunho não está neste arquivo e vai desaparecer: {keys}.', // MT
    de: '1 Schritt im Entwurf ist nicht in dieser Datei und wird verschwinden: {keys}.', // MT
    fr: "1 étape du brouillon n'est pas dans ce fichier et va disparaître : {keys}.", // MT
  },
  warn_removed_many: {
    en: '{n} steps in the draft are not in this file and will disappear: {keys}.',
    nl: '{n} stappen in het concept staan niet in dit bestand en verdwijnen: {keys}.',
    es: '{n} pasos del borrador no están en este archivo y desaparecerán: {keys}.', // MT
    pt: '{n} passos do rascunho não estão neste arquivo e vão desaparecer: {keys}.', // MT
    de: '{n} Schritte im Entwurf sind nicht in dieser Datei und werden verschwinden: {keys}.', // MT
    fr: "{n} étapes du brouillon ne sont pas dans ce fichier et vont disparaître : {keys}.", // MT
  },
  warn_system_key_taken: {
    en: 'Another flow ("{name}") already holds that system key. The import will be refused.',
    nl: 'Een andere flow ("{name}") heeft die systeemsleutel al. De import wordt geweigerd.',
    es: 'Otro flow ("{name}") ya tiene esa clave de sistema. La importación será rechazada.', // MT
    pt: 'Outro flow ("{name}") já tem essa chave de sistema. A importação será recusada.', // MT
    de: 'Ein anderer Flow ("{name}") hält diesen Systemschlüssel bereits. Der Import wird abgelehnt.', // MT
    fr: "Un autre flow (« {name} ») détient déjà cette clé système. L'import sera refusé.", // MT
  },

  // ── runs panel / board ────────────────────────────────────────────────
  contacts_in_this_flow: {
    en: 'Contacts in this flow',
    nl: 'Contacten in deze flow',
    es: 'Contactos en este flow', // MT
    pt: 'Contatos neste flow', // MT
    de: 'Kontakte in diesem Flow', // MT
    fr: 'Contacts dans ce flow', // MT
  },
  add_contact: {
    en: 'Add contact',
    nl: 'Contact toevoegen',
    es: 'Añadir contacto', // MT
    pt: 'Adicionar contato', // MT
    de: 'Kontakt hinzufügen', // MT
    fr: 'Ajouter un contact', // MT
  },
  no_contacts_add_one: {
    en: 'No contacts in this flow yet. Add one to start moving them through.',
    nl: 'Nog geen contacten in deze flow. Voeg er een toe om ze erdoorheen te laten bewegen.',
    es: 'Aún no hay contactos en este flow. Añade uno para empezar a moverlos.', // MT
    pt: 'Ainda não há contatos neste flow. Adicione um para começar a movê-los.', // MT
    de: 'Noch keine Kontakte in diesem Flow. Füge einen hinzu, um sie hindurchzubewegen.', // MT
    fr: 'Pas encore de contacts dans ce flow. Ajoutes-en un pour commencer à les faire avancer.', // MT
  },
  publish_before_adding: {
    en: 'Publish the flow before adding contacts.',
    nl: 'Publiceer de flow voordat je contacten toevoegt.',
    es: 'Publica el flow antes de añadir contactos.', // MT
    pt: 'Publique o flow antes de adicionar contatos.', // MT
    de: 'Veröffentliche den Flow, bevor du Kontakte hinzufügst.', // MT
    fr: "Publie le flow avant d'ajouter des contacts.", // MT
  },
  no_one_here: {
    en: 'No one here',
    nl: 'Niemand hier',
    es: 'No hay nadie aquí', // MT
    pt: 'Ninguém aqui', // MT
    de: 'Niemand hier', // MT
    fr: 'Personne ici', // MT
  },
  other_column: {
    en: 'Other',
    nl: 'Overig',
    es: 'Otros', // MT
    pt: 'Outros', // MT
    de: 'Sonstige', // MT
    fr: 'Autres', // MT
  },
  add_contact_title: {
    en: 'Add a contact to the flow',
    nl: 'Voeg een contact toe aan de flow',
    es: 'Añade un contacto al flow', // MT
    pt: 'Adicione um contato ao flow', // MT
    de: 'Füge dem Flow einen Kontakt hinzu', // MT
    fr: 'Ajoute un contact au flow', // MT
  },
  pick_person_ph: {
    en: 'Pick a person…',
    nl: 'Kies een persoon…',
    es: 'Elige una persona…', // MT
    pt: 'Escolha uma pessoa…', // MT
    de: 'Wähle eine Person…', // MT
    fr: 'Choisis une personne…', // MT
  },
  search_people_ph: {
    en: 'Search people by name or email',
    nl: 'Zoek mensen op naam of e-mail',
    es: 'Busca personas por nombre o correo', // MT
    pt: 'Busque pessoas por nome ou e-mail', // MT
    de: 'Personen nach Name oder E-Mail suchen', // MT
    fr: 'Cherche des personnes par nom ou e-mail', // MT
  },
  adding_to_flow: {
    en: 'Adding to the flow…',
    nl: 'Toevoegen aan de flow…',
    es: 'Añadiendo al flow…', // MT
    pt: 'Adicionando ao flow…', // MT
    de: 'Wird zum Flow hinzugefügt…', // MT
    fr: 'Ajout au flow…', // MT
  },
  today: {
    en: 'today',
    nl: 'vandaag',
    es: 'hoy', // MT
    pt: 'hoje', // MT
    de: 'heute', // MT
    fr: "aujourd'hui", // MT
  },
  one_day: {
    en: '1 day',
    nl: '1 dag',
    es: '1 día', // MT
    pt: '1 dia', // MT
    de: '1 Tag', // MT
    fr: '1 jour', // MT
  },
  n_days: {
    en: '{n} days',
    nl: '{n} dagen',
    es: '{n} días', // MT
    pt: '{n} dias', // MT
    de: '{n} Tage', // MT
    fr: '{n} jours', // MT
  },
  one_month_short: {
    en: '1 mo',
    nl: '1 mnd',
    es: '1 mes', // MT
    pt: '1 mês', // MT
    de: '1 Mon.', // MT
    fr: '1 mois', // MT
  },
  n_months_short: {
    en: '{n} mo',
    nl: '{n} mnd',
    es: '{n} meses', // MT
    pt: '{n} meses', // MT
    de: '{n} Mon.', // MT
    fr: '{n} mois', // MT
  },
  pulse_badge_title: {
    en: 'mirrored from Pulse — stage changes sync both ways',
    nl: 'gespiegeld vanuit Pulse — fasewijzigingen synchroniseren beide kanten op',
    es: 'reflejado desde Pulse: los cambios de etapa se sincronizan en ambos sentidos', // MT
    pt: 'espelhado do Pulse — mudanças de etapa sincronizam nos dois sentidos', // MT
    de: 'gespiegelt aus Pulse — Phasenwechsel synchronisieren in beide Richtungen', // MT
    fr: "reflété depuis Pulse — les changements d'étape se synchronisent dans les deux sens", // MT
  },

  // ── run modal ─────────────────────────────────────────────────────────
  currently_at: {
    en: 'Currently at',
    nl: 'Nu bij',
    es: 'Actualmente en', // MT
    pt: 'Atualmente em', // MT
    de: 'Aktuell bei', // MT
    fr: 'Actuellement à', // MT
  },
  full_view: {
    en: 'Full view',
    nl: 'Volledige weergave',
    es: 'Vista completa', // MT
    pt: 'Visão completa', // MT
    de: 'Vollansicht', // MT
    fr: 'Vue complète', // MT
  },
  flow_view: {
    en: 'Flow',
    nl: 'Flow',
    es: 'Flow', // MT
    pt: 'Flow', // MT
    de: 'Flow', // MT
    fr: 'Flow', // MT
  },
  loading_flow: {
    en: 'Loading flow…',
    nl: 'Flow laden…',
    es: 'Cargando el flow…', // MT
    pt: 'Carregando o flow…', // MT
    de: 'Flow wird geladen…', // MT
    fr: 'Chargement du flow…', // MT
  },
  picking_hint: {
    en: 'Now click a step to move {initials} there — amber = forward (gated), grey = manual move / revert. Click the current step again to cancel.',
    nl: 'Klik nu op een stap om {initials} daarheen te verplaatsen — oranje = vooruit (met gate), grijs = handmatig / terugzetten. Klik nogmaals op de huidige stap om te annuleren.',
    es: 'Ahora haz clic en un paso para mover a {initials} ahí: ámbar = adelante (con gate), gris = movimiento manual / revertir. Haz clic de nuevo en el paso actual para cancelar.', // MT
    pt: 'Agora clique em um passo para mover {initials} para lá — âmbar = avançar (com gate), cinza = movimento manual / reverter. Clique de novo no passo atual para cancelar.', // MT
    de: 'Klicke jetzt auf einen Schritt, um {initials} dorthin zu bewegen — bernstein = vorwärts (mit Gate), grau = manuell / zurücksetzen. Klicke erneut auf den aktuellen Schritt zum Abbrechen.', // MT
    fr: "Clique maintenant sur une étape pour y déplacer {initials} — ambre = en avant (avec gate), gris = déplacement manuel / retour. Reclique sur l'étape actuelle pour annuler.", // MT
  },
  pickup_hint_before: {
    en: 'Click the',
    nl: 'Klik op de kaart',
    es: 'Haz clic en la tarjeta', // MT
    pt: 'Clique no cartão', // MT
    de: 'Klicke auf die Karte', // MT
    fr: 'Clique sur la carte', // MT
  },
  pickup_hint_after: {
    en: 'card to pick up {initials}, then click any step — forward to advance, or back to revert.',
    nl: 'om {initials} op te pakken, en klik dan op een stap — vooruit om verder te gaan, of terug om terug te zetten.',
    es: 'para recoger a {initials} y luego haz clic en cualquier paso: adelante para avanzar o atrás para revertir.', // MT
    pt: 'para pegar {initials} e depois clique em qualquer passo — para frente para avançar, para trás para reverter.', // MT
    de: 'um {initials} aufzunehmen, und klicke dann auf einen Schritt — vorwärts zum Weitergehen, zurück zum Zurücksetzen.', // MT
    fr: "pour prendre {initials}, puis clique sur n'importe quelle étape — en avant pour avancer, en arrière pour revenir.", // MT
  },
  token_hint: {
    en: 'Click the card to pick up / drop, then click a highlighted step — or drag',
    nl: 'Klik op de kaart om op te pakken / neer te leggen en klik dan op een gemarkeerde stap — of sleep',
    es: 'Haz clic en la tarjeta para recoger / soltar y luego en un paso resaltado, o arrastra', // MT
    pt: 'Clique no cartão para pegar / soltar e depois em um passo destacado — ou arraste', // MT
    de: 'Klicke auf die Karte zum Aufnehmen / Ablegen und dann auf einen markierten Schritt — oder ziehe', // MT
    fr: 'Clique sur la carte pour prendre / poser, puis sur une étape en surbrillance — ou fais glisser', // MT
  },
  current: {
    en: 'Current',
    nl: 'Huidig',
    es: 'Actual', // MT
    pt: 'Atual', // MT
    de: 'Aktuell', // MT
    fr: 'Actuelle', // MT
  },
  move_here: {
    en: 'Move here',
    nl: 'Hierheen',
    es: 'Mover aquí', // MT
    pt: 'Mover para cá', // MT
    de: 'Hierher bewegen', // MT
    fr: 'Déplacer ici', // MT
  },
  someone: {
    en: 'Someone',
    nl: 'Iemand',
    es: 'Alguien', // MT
    pt: 'Alguém', // MT
    de: 'Jemand', // MT
    fr: "Quelqu'un", // MT
  },
  add_note_ph: {
    en: 'Add a note…',
    nl: 'Voeg een notitie toe…',
    es: 'Añade una nota…', // MT
    pt: 'Adicione uma nota…', // MT
    de: 'Notiz hinzufügen…', // MT
    fr: 'Ajoute une note…', // MT
  },
  move_to_q: {
    en: 'Move to {step}?',
    nl: 'Verplaatsen naar {step}?',
    es: '¿Mover a {step}?', // MT
    pt: 'Mover para {step}?', // MT
    de: 'Nach {step} verschieben?', // MT
    fr: 'Déplacer vers {step} ?', // MT
  },
  revert_to_q: {
    en: 'Revert to {step}?',
    nl: 'Terugzetten naar {step}?',
    es: '¿Revertir a {step}?', // MT
    pt: 'Reverter para {step}?', // MT
    de: 'Auf {step} zurücksetzen?', // MT
    fr: 'Revenir à {step} ?', // MT
  },
  confirm_move: {
    en: 'Confirm move',
    nl: 'Verplaatsing bevestigen',
    es: 'Confirmar movimiento', // MT
    pt: 'Confirmar movimento', // MT
    de: 'Verschieben bestätigen', // MT
    fr: 'Confirmer le déplacement', // MT
  },
  move_anyway: {
    en: 'Move anyway',
    nl: 'Toch verplaatsen',
    es: 'Mover de todos modos', // MT
    pt: 'Mover mesmo assim', // MT
    de: 'Trotzdem verschieben', // MT
    fr: 'Déplacer quand même', // MT
  },
  gate_satisfied_msg: {
    en: 'Gate satisfied — ready to move.',
    nl: 'Gate voldaan — klaar om te verplaatsen.',
    es: 'Gate cumplido: listo para mover.', // MT
    pt: 'Gate cumprido — pronto para mover.', // MT
    de: 'Gate erfüllt — bereit zum Verschieben.', // MT
    fr: 'Gate satisfait — prêt à déplacer.', // MT
  },
  gate_not_satisfied_msg: {
    en: 'Gate not satisfied. Complete the required tasks below, or move anyway with a reason.',
    nl: 'Gate niet voldaan. Rond de verplichte taken hieronder af, of verplaats toch met een reden.',
    es: 'Gate no cumplido. Completa las tareas obligatorias de abajo o mueve de todos modos con un motivo.', // MT
    pt: 'Gate não cumprido. Conclua as tarefas obrigatórias abaixo ou mova mesmo assim com um motivo.', // MT
    de: 'Gate nicht erfüllt. Erledige die Pflichtaufgaben unten oder verschiebe trotzdem mit Begründung.', // MT
    fr: 'Gate non satisfait. Termine les tâches obligatoires ci-dessous, ou déplace quand même avec un motif.', // MT
  },
  override_reason_ph: {
    en: 'Override reason (if moving anyway)',
    nl: 'Reden voor overrulen (als je toch verplaatst)',
    es: 'Motivo de la anulación (si mueves de todos modos)', // MT
    pt: 'Motivo da anulação (se mover mesmo assim)', // MT
    de: 'Begründung fürs Übergehen (wenn du trotzdem verschiebst)', // MT
    fr: 'Motif du passage outre (si tu déplaces quand même)', // MT
  },
  manual_desc_revert: {
    en: 'Revert from {step} — no transition gate.',
    nl: 'Terugzetten vanaf {step} — geen overgangs-gate.',
    es: 'Revertir desde {step}: sin gate de transición.', // MT
    pt: 'Reverter de {step} — sem gate de transição.', // MT
    de: 'Zurücksetzen von {step} — kein Übergangs-Gate.', // MT
    fr: 'Retour depuis {step} — pas de gate de transition.', // MT
  },
  manual_desc_move: {
    en: 'Manual move from {step} — no transition gate.',
    nl: 'Handmatige verplaatsing vanaf {step} — geen overgangs-gate.',
    es: 'Movimiento manual desde {step}: sin gate de transición.', // MT
    pt: 'Movimento manual de {step} — sem gate de transição.', // MT
    de: 'Manuelles Verschieben von {step} — kein Übergangs-Gate.', // MT
    fr: 'Déplacement manuel depuis {step} — pas de gate de transition.', // MT
  },
  manual_move_warning: {
    en: "This skips gate checks and re-creates the destination step's tasks. The move is logged on the activity timeline as manual.",
    nl: 'Dit slaat gate-controles over en maakt de taken van de doelstap opnieuw aan. De verplaatsing wordt op de activiteitentijdlijn gelogd als handmatig.',
    es: 'Esto omite las comprobaciones de gate y vuelve a crear las tareas del paso de destino. El movimiento se registra en la línea de actividad como manual.', // MT
    pt: 'Isto pula as verificações de gate e recria as tarefas do passo de destino. O movimento é registrado na linha de atividade como manual.', // MT
    de: 'Das überspringt die Gate-Prüfungen und erstellt die Aufgaben des Zielschritts neu. Der Zug wird in der Aktivitäts-Timeline als manuell protokolliert.', // MT
    fr: "Cela ignore les vérifications de gate et recrée les tâches de l'étape de destination. Le déplacement est journalisé comme manuel dans la chronologie d'activité.", // MT
  },
  reason_optional_ph: {
    en: 'Reason (optional)',
    nl: 'Reden (optioneel)',
    es: 'Motivo (opcional)', // MT
    pt: 'Motivo (opcional)', // MT
    de: 'Grund (optional)', // MT
    fr: 'Motif (facultatif)', // MT
  },
  revert: {
    en: 'Revert',
    nl: 'Terugzetten',
    es: 'Revertir', // MT
    pt: 'Reverter', // MT
    de: 'Zurücksetzen', // MT
    fr: 'Revenir', // MT
  },

  // ── run full view ─────────────────────────────────────────────────────
  back_to_flow: {
    en: 'Back to flow',
    nl: 'Terug naar de flow',
    es: 'Volver al flow', // MT
    pt: 'Voltar ao flow', // MT
    de: 'Zurück zum Flow', // MT
    fr: 'Retour au flow', // MT
  },
  withdraw: {
    en: 'Withdraw',
    nl: 'Terugtrekken',
    es: 'Retirar', // MT
    pt: 'Retirar', // MT
    de: 'Zurückziehen', // MT
    fr: 'Retirer', // MT
  },
  withdraw_confirm_q: {
    en: 'Withdraw this contact from the flow? Open tasks will be cancelled.',
    nl: 'Dit contact uit de flow terugtrekken? Open taken worden geannuleerd.',
    es: '¿Retirar este contacto del flow? Las tareas abiertas se cancelarán.', // MT
    pt: 'Retirar este contato do flow? As tarefas abertas serão canceladas.', // MT
    de: 'Diesen Kontakt aus dem Flow zurückziehen? Offene Aufgaben werden storniert.', // MT
    fr: 'Retirer ce contact du flow ? Les tâches ouvertes seront annulées.', // MT
  },
  current_step: {
    en: 'Current step',
    nl: 'Huidige stap',
    es: 'Paso actual', // MT
    pt: 'Passo atual', // MT
    de: 'Aktueller Schritt', // MT
    fr: 'Étape actuelle', // MT
  },
  tasks_at_step: {
    en: 'Tasks at this step',
    nl: 'Taken bij deze stap',
    es: 'Tareas en este paso', // MT
    pt: 'Tarefas neste passo', // MT
    de: 'Aufgaben bei diesem Schritt', // MT
    fr: 'Tâches à cette étape', // MT
  },
  no_tasks_at_step: {
    en: 'No tasks at this step — you can move on freely.',
    nl: 'Geen taken bij deze stap — je kunt vrij doorgaan.',
    es: 'No hay tareas en este paso: puedes avanzar libremente.', // MT
    pt: 'Sem tarefas neste passo — você pode seguir livremente.', // MT
    de: 'Keine Aufgaben bei diesem Schritt — du kannst frei weitergehen.', // MT
    fr: 'Pas de tâches à cette étape — tu peux avancer librement.', // MT
  },
  move_to_next_step: {
    en: 'Move to next step',
    nl: 'Naar de volgende stap',
    es: 'Mover al siguiente paso', // MT
    pt: 'Mover para o próximo passo', // MT
    de: 'Zum nächsten Schritt', // MT
    fr: "Passer à l'étape suivante", // MT
  },
  gate_badge: {
    en: 'gate',
    nl: 'gate',
    es: 'gate', // MT
    pt: 'gate', // MT
    de: 'Gate', // MT
    fr: 'gate', // MT
  },
  gate_summary_all_one: {
    en: 'gate: 1 task required',
    nl: 'gate: 1 taak vereist',
    es: 'gate: 1 tarea obligatoria', // MT
    pt: 'gate: 1 tarefa obrigatória', // MT
    de: 'Gate: 1 Aufgabe erforderlich', // MT
    fr: 'gate : 1 tâche requise', // MT
  },
  gate_summary_all_many: {
    en: 'gate: all of {n} tasks',
    nl: 'gate: alle {n} taken',
    es: 'gate: las {n} tareas', // MT
    pt: 'gate: todas as {n} tarefas', // MT
    de: 'Gate: alle {n} Aufgaben', // MT
    fr: 'gate : les {n} tâches', // MT
  },
  gate_summary_any_many: {
    en: 'gate: any of {n} tasks',
    nl: 'gate: één van de {n} taken',
    es: 'gate: cualquiera de las {n} tareas', // MT
    pt: 'gate: qualquer uma das {n} tarefas', // MT
    de: 'Gate: eine der {n} Aufgaben', // MT
    fr: "gate : n'importe laquelle des {n} tâches", // MT
  },
  override: {
    en: 'Override',
    nl: 'Overrulen',
    es: 'Anular', // MT
    pt: 'Anular', // MT
    de: 'Übergehen', // MT
    fr: 'Passer outre', // MT
  },
  gate_reason_label: {
    en: 'Gate not satisfied. Give a reason to move anyway:',
    nl: 'Gate niet voldaan. Geef een reden om toch te verplaatsen:',
    es: 'Gate no cumplido. Da un motivo para mover de todos modos:', // MT
    pt: 'Gate não cumprido. Dê um motivo para mover mesmo assim:', // MT
    de: 'Gate nicht erfüllt. Gib einen Grund an, um trotzdem zu verschieben:', // MT
    fr: 'Gate non satisfait. Donne un motif pour déplacer quand même :', // MT
  },
  override_example_ph: {
    en: 'e.g. verified out-of-band',
    nl: 'bijv. buiten het systeem om geverifieerd',
    es: 'p. ej. verificado por otra vía', // MT
    pt: 'p. ex. verificado por outro canal', // MT
    de: 'z. B. anderweitig verifiziert', // MT
    fr: 'p. ex. vérifié par un autre canal', // MT
  },
  actor_you: {
    en: 'You',
    nl: 'Jij',
    es: 'Tú', // MT
    pt: 'Você', // MT
    de: 'Du', // MT
    fr: 'Toi', // MT
  },

  // ── tasks page ────────────────────────────────────────────────────────
  my_tasks: {
    en: 'My tasks',
    nl: 'Mijn taken',
    es: 'Mis tareas', // MT
    pt: 'Minhas tarefas', // MT
    de: 'Meine Aufgaben', // MT
    fr: 'Mes tâches', // MT
  },
  tasks_blurb: {
    en: 'Open tasks assigned to you across all flows.',
    nl: 'Open taken die in alle flows aan jou zijn toegewezen.',
    es: 'Tareas abiertas asignadas a ti en todos los flows.', // MT
    pt: 'Tarefas abertas atribuídas a você em todos os flows.', // MT
    de: 'Offene Aufgaben, die dir über alle Flows zugewiesen sind.', // MT
    fr: 'Les tâches ouvertes qui te sont assignées dans tous les flows.', // MT
  },
  load_tasks_failed: {
    en: 'Could not load tasks.',
    nl: 'Kon de taken niet laden.',
    es: 'No se pudieron cargar las tareas.', // MT
    pt: 'Não foi possível carregar as tarefas.', // MT
    de: 'Aufgaben konnten nicht geladen werden.', // MT
    fr: 'Impossible de charger les tâches.', // MT
  },
  add_task_ph: {
    en: 'Add a task and press Enter',
    nl: 'Typ een taak en druk op Enter',
    es: 'Añade una tarea y pulsa Enter', // MT
    pt: 'Adicione uma tarefa e pressione Enter', // MT
    de: 'Aufgabe eingeben und Enter drücken', // MT
    fr: 'Ajoute une tâche et appuie sur Entrée', // MT
  },
  nothing_on_plate: {
    en: 'Nothing on your plate',
    nl: 'Niets op je bordje',
    es: 'Nada pendiente', // MT
    pt: 'Nada no seu prato', // MT
    de: 'Nichts auf deinem Teller', // MT
    fr: 'Rien sur ta liste', // MT
  },
  tasks_empty_blurb: {
    en: 'Tasks assigned to you appear here as contacts move through flows — or add your own above.',
    nl: 'Taken die aan jou worden toegewezen verschijnen hier terwijl contacten door flows bewegen — of voeg hierboven je eigen taak toe.',
    es: 'Las tareas asignadas a ti aparecen aquí a medida que los contactos avanzan por los flows, o añade la tuya arriba.', // MT
    pt: 'Tarefas atribuídas a você aparecem aqui conforme os contatos avançam pelos flows — ou adicione a sua acima.', // MT
    de: 'Dir zugewiesene Aufgaben erscheinen hier, während Kontakte durch Flows wandern — oder füge oben eigene hinzu.', // MT
    fr: "Les tâches qui te sont assignées apparaissent ici au fil des flows — ou ajoute la tienne ci-dessus.", // MT
  },
  re_contact: {
    en: 're: {name}',
    nl: 'over: {name}',
    es: 'sobre: {name}', // MT
    pt: 'sobre: {name}', // MT
    de: 'zu: {name}', // MT
    fr: 'au sujet de : {name}', // MT
  },
  mark_done: {
    en: 'Mark done',
    nl: 'Afvinken',
    es: 'Marcar como hecha', // MT
    pt: 'Marcar como concluída', // MT
    de: 'Als erledigt markieren', // MT
    fr: 'Marquer comme faite', // MT
  },
  open_flow_run: {
    en: 'Open flow run',
    nl: 'Flow-run openen',
    es: 'Abrir el run del flow', // MT
    pt: 'Abrir o run do flow', // MT
    de: 'Flow-Run öffnen', // MT
    fr: 'Ouvrir le run du flow', // MT
  },

  // ── contacts page ─────────────────────────────────────────────────────
  contacts_in_motion: {
    en: 'Contacts in motion',
    nl: 'Contacten in beweging',
    es: 'Contactos en movimiento', // MT
    pt: 'Contatos em movimento', // MT
    de: 'Kontakte in Bewegung', // MT
    fr: 'Contacts en mouvement', // MT
  },
  contacts_page_blurb: {
    en: 'People currently moving through a flow. Identity comes from The Fibre.',
    nl: 'Mensen die op dit moment door een flow bewegen. Identiteit komt van The Fibre.',
    es: 'Personas que se mueven ahora mismo por un flow. La identidad viene de The Fibre.', // MT
    pt: 'Pessoas que estão agora se movendo por um flow. A identidade vem do The Fibre.', // MT
    de: 'Menschen, die sich gerade durch einen Flow bewegen. Die Identität kommt von The Fibre.', // MT
    fr: "Les personnes qui traversent un flow en ce moment. L'identité vient de The Fibre.", // MT
  },
  load_contacts_failed: {
    en: 'Could not load contacts.',
    nl: 'Kon de contacten niet laden.',
    es: 'No se pudieron cargar los contactos.', // MT
    pt: 'Não foi possível carregar os contatos.', // MT
    de: 'Kontakte konnten nicht geladen werden.', // MT
    fr: 'Impossible de charger les contacts.', // MT
  },
  nobody_in_flow: {
    en: 'Nobody in a flow yet',
    nl: 'Nog niemand in een flow',
    es: 'Aún no hay nadie en un flow', // MT
    pt: 'Ainda não há ninguém em um flow', // MT
    de: 'Noch niemand in einem Flow', // MT
    fr: 'Personne dans un flow pour le moment', // MT
  },
  nobody_in_flow_blurb: {
    en: "Add contacts to a flow from its page, and they'll appear here with their current step.",
    nl: 'Voeg contacten toe aan een flow vanaf de flowpagina; ze verschijnen hier met hun huidige stap.',
    es: 'Añade contactos a un flow desde su página y aparecerán aquí con su paso actual.', // MT
    pt: 'Adicione contatos a um flow pela página dele e eles aparecerão aqui com o passo atual.', // MT
    de: 'Füge Kontakte auf der Seite eines Flows hinzu — sie erscheinen hier mit ihrem aktuellen Schritt.', // MT
    fr: "Ajoute des contacts à un flow depuis sa page ; ils apparaîtront ici avec leur étape actuelle.", // MT
  },

  // ── settings page ─────────────────────────────────────────────────────
  settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  settings_blurb: {
    en: 'You and the workspace. Flow has nothing of its own to configure yet.',
    nl: 'Jij en de werkruimte. Flow heeft zelf nog niets in te stellen.',
    es: 'Tú y el espacio de trabajo. Flow aún no tiene nada propio que configurar.', // MT
    pt: 'Você e o espaço de trabalho. O Flow ainda não tem nada próprio para configurar.', // MT
    de: 'Du und der Workspace. Flow selbst hat noch nichts einzustellen.', // MT
    fr: "Toi et l'espace de travail. Flow n'a encore rien à configurer en propre.", // MT
  },

  // ── help page ─────────────────────────────────────────────────────────
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  nav_tasks: {
    en: 'Tasks',
    nl: 'Taken',
    es: 'Tareas', // MT
    pt: 'Tarefas', // MT
    de: 'Aufgaben', // MT
    fr: 'Tâches', // MT
  },
  nav_contacts: {
    en: 'Contacts',
    nl: 'Contacten',
    es: 'Contactos', // MT
    pt: 'Contatos', // MT
    de: 'Kontakte', // MT
    fr: 'Contacts', // MT
  },
  help_home_blurb: {
    en: "What's moving today, and your favourite flows.",
    nl: 'Wat er vandaag beweegt, en je favoriete flows.',
    es: 'Lo que se mueve hoy y tus flows favoritos.', // MT
    pt: 'O que está em movimento hoje e seus flows favoritos.', // MT
    de: 'Was sich heute bewegt, und deine Lieblings-Flows.', // MT
    fr: "Ce qui bouge aujourd'hui, et tes flows favoris.", // MT
  },
  help_flows_blurb: {
    en: 'State machines your contacts move through. Each step is held by gate tasks; the builder is visual.',
    nl: 'Stappenplannen waar je contacten doorheen bewegen. Elke stap wordt bewaakt door gate-taken; de builder is visueel.',
    es: 'Máquinas de estados por las que se mueven tus contactos. Cada paso está custodiado por tareas de gate; el constructor es visual.', // MT
    pt: 'Máquinas de estados pelas quais seus contatos se movem. Cada passo é guardado por tarefas de gate; o construtor é visual.', // MT
    de: 'Zustandsmaschinen, durch die sich deine Kontakte bewegen. Jeder Schritt wird von Gate-Aufgaben gehalten; der Builder ist visuell.', // MT
    fr: "Des machines à états que tes contacts traversent. Chaque étape est tenue par des tâches de gate ; l'éditeur est visuel.", // MT
  },
  help_tasks_blurb: {
    en: 'Open tasks assigned to you across all flows. Completing the gate tasks of a step moves the run on.',
    nl: 'Open taken die in alle flows aan jou zijn toegewezen. De gate-taken van een stap afronden brengt de run verder.',
    es: 'Tareas abiertas asignadas a ti en todos los flows. Completar las tareas de gate de un paso hace avanzar el run.', // MT
    pt: 'Tarefas abertas atribuídas a você em todos os flows. Concluir as tarefas de gate de um passo faz o run avançar.', // MT
    de: 'Offene Aufgaben über alle Flows. Das Erledigen der Gate-Aufgaben eines Schritts bewegt den Run weiter.', // MT
    fr: "Les tâches ouvertes qui te sont assignées dans tous les flows. Terminer les tâches de gate d'une étape fait avancer le run.", // MT
  },
  help_contacts_blurb: {
    en: 'People currently moving through a flow. Identity comes from The Fibre.',
    nl: 'Mensen die op dit moment door een flow bewegen. Identiteit komt van The Fibre.',
    es: 'Personas que se mueven ahora mismo por un flow. La identidad viene de The Fibre.', // MT
    pt: 'Pessoas que estão agora se movendo por um flow. A identidade vem do The Fibre.', // MT
    de: 'Menschen, die sich gerade durch einen Flow bewegen. Die Identität kommt von The Fibre.', // MT
    fr: "Les personnes qui traversent un flow en ce moment. L'identité vient de The Fibre.", // MT
  },

  // ── flow report ───────────────────────────────────────────────────────
  report_empty: {
    en: 'No contacts in this flow yet — nothing to report.',
    nl: 'Nog geen contacten in deze flow — niets te rapporteren.',
    es: 'Aún no hay contactos en este flow: nada que informar.', // MT
    pt: 'Ainda não há contatos neste flow — nada a relatar.', // MT
    de: 'Noch keine Kontakte in diesem Flow — nichts zu berichten.', // MT
    fr: 'Pas encore de contacts dans ce flow — rien à signaler.', // MT
  },
  total: {
    en: 'Total',
    nl: 'Totaal',
    es: 'Total', // MT
    pt: 'Total', // MT
    de: 'Gesamt', // MT
    fr: 'Total', // MT
  },
  stat_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activos', // MT
    pt: 'Ativos', // MT
    de: 'Aktiv', // MT
    fr: 'Actifs', // MT
  },
  stat_completed: {
    en: 'Completed',
    nl: 'Afgerond',
    es: 'Completados', // MT
    pt: 'Concluídos', // MT
    de: 'Abgeschlossen', // MT
    fr: 'Terminés', // MT
  },
  stat_withdrawn: {
    en: 'Withdrawn',
    nl: 'Teruggetrokken',
    es: 'Retirados', // MT
    pt: 'Retirados', // MT
    de: 'Zurückgezogen', // MT
    fr: 'Retirés', // MT
  },
  distribution_heading: {
    en: 'Current distribution across steps',
    nl: 'Huidige verdeling over de stappen',
    es: 'Distribución actual por pasos', // MT
    pt: 'Distribuição atual pelos passos', // MT
    de: 'Aktuelle Verteilung über die Schritte', // MT
    fr: 'Répartition actuelle par étapes', // MT
  },
  report_footnote: {
    en: 'Shows where contacts sit right now. A historical cohort funnel (how many ever reached each step) comes with step-history tracking.',
    nl: 'Laat zien waar contacten nu staan. Een historische cohorttrechter (hoeveel er ooit elke stap bereikten) komt met stapgeschiedenis.',
    es: 'Muestra dónde están los contactos ahora mismo. Un embudo histórico de cohortes (cuántos llegaron a cada paso) vendrá con el historial de pasos.', // MT
    pt: 'Mostra onde os contatos estão agora. Um funil histórico de coorte (quantos já chegaram a cada passo) virá com o histórico de passos.', // MT
    de: 'Zeigt, wo Kontakte gerade stehen. Ein historischer Kohorten-Funnel (wie viele je jeden Schritt erreichten) kommt mit der Schritt-Historie.', // MT
    fr: "Montre où sont les contacts en ce moment. Un entonnoir de cohorte historique (combien ont atteint chaque étape) viendra avec l'historique des étapes.", // MT
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
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  nav_flows: {
    en: 'Flows',
    nl: 'Flows',
    es: 'Flows', // MT
    pt: 'Flows', // MT
    de: 'Flows', // MT
    fr: 'Flows', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
