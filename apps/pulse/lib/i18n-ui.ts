// Fibre Pulse — signed-in interface translations (i18n P3, 2026-09-06).
//
// THE RULE: every string a signed-in user can see in Pulse's interface lives
// HERE, in all locales. The locale list itself lives in @thefibre/shared/i18n
// (one definition for the whole platform); the catalog stays per-surface,
// next to its consumers. The catalog is typed so a key missing a translation
// fails `pnpm typecheck` — that is how the list stays complete as the product
// grows. Default locale: en.
//
// Register is informal (je / du / tú / você / tu). Dutch entries are native
// quality; es / pt / de / fr are machine-drafted (marked // MT) pending
// native review. Portuguese is Brazilian-leaning (você, Configurações).
//
// Chrome only: table headers, buttons, tooltips and empty states ARE
// translated; budget line names, scenario/account/offering names, notes and
// anything else the user typed is CONTENT and never translated. Product
// terms stay untranslated: "Pulse", "Flow", "Stripe", app names, and
// "cashflow" is treated as an international word (kept in nl/de).

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
  saved_notice: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
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
  duplicate: {
    en: 'Duplicate',
    nl: 'Dupliceren',
    es: 'Duplicar', // MT
    pt: 'Duplicar', // MT
    de: 'Duplizieren', // MT
    fr: 'Dupliquer', // MT
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
    pt: 'Pronto', // MT
    de: 'Fertig', // MT
    fr: 'Terminé', // MT
  },
  add: {
    en: 'Add',
    nl: 'Toevoegen',
    es: 'Añadir', // MT
    pt: 'Adicionar', // MT
    de: 'Hinzufügen', // MT
    fr: 'Ajouter', // MT
  },
  adding: {
    en: 'Adding…',
    nl: 'Toevoegen…',
    es: 'Añadiendo…', // MT
    pt: 'Adicionando…', // MT
    de: 'Wird hinzugefügt…', // MT
    fr: 'Ajout…', // MT
  },
  create: {
    en: 'Create',
    nl: 'Aanmaken',
    es: 'Crear', // MT
    pt: 'Criar', // MT
    de: 'Erstellen', // MT
    fr: 'Créer', // MT
  },
  creating: {
    en: 'Creating…',
    nl: 'Aanmaken…',
    es: 'Creando…', // MT
    pt: 'Criando…', // MT
    de: 'Wird erstellt…', // MT
    fr: 'Création…', // MT
  },
  edit: {
    en: 'Edit',
    nl: 'Bewerken',
    es: 'Editar', // MT
    pt: 'Editar', // MT
    de: 'Bearbeiten', // MT
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
  removing: {
    en: 'Removing…',
    nl: 'Verwijderen…',
    es: 'Quitando…', // MT
    pt: 'Removendo…', // MT
    de: 'Wird entfernt…', // MT
    fr: 'Retrait…', // MT
  },
  archive: {
    en: 'Archive',
    nl: 'Archiveren',
    es: 'Archivar', // MT
    pt: 'Arquivar', // MT
    de: 'Archivieren', // MT
    fr: 'Archiver', // MT
  },
  really_archive_q: {
    en: 'Really archive?',
    nl: 'Echt archiveren?',
    es: '¿Archivar de verdad?', // MT
    pt: 'Arquivar mesmo?', // MT
    de: 'Wirklich archivieren?', // MT
    fr: 'Vraiment archiver ?', // MT
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
  working: {
    en: 'Working…',
    nl: 'Bezig…',
    es: 'Procesando…', // MT
    pt: 'Processando…', // MT
    de: 'Wird ausgeführt…', // MT
    fr: 'En cours…', // MT
  },
  not_now: {
    en: 'Not now',
    nl: 'Niet nu',
    es: 'Ahora no', // MT
    pt: 'Agora não', // MT
    de: 'Nicht jetzt', // MT
    fr: 'Pas maintenant', // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  label: {
    en: 'Label',
    nl: 'Label',
    es: 'Etiqueta', // MT
    pt: 'Rótulo', // MT
    de: 'Label', // MT
    fr: 'Libellé', // MT
  },
  notes: {
    en: 'Notes',
    nl: 'Notities',
    es: 'Notas', // MT
    pt: 'Notas', // MT
    de: 'Notizen', // MT
    fr: 'Notes', // MT
  },
  category: {
    en: 'Category',
    nl: 'Categorie',
    es: 'Categoría', // MT
    pt: 'Categoria', // MT
    de: 'Kategorie', // MT
    fr: 'Catégorie', // MT
  },
  optional: {
    en: 'Optional',
    nl: 'Optioneel',
    es: 'Opcional', // MT
    pt: 'Opcional', // MT
    de: 'Optional', // MT
    fr: 'Facultatif', // MT
  },
  team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipe', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  kind: {
    en: 'Kind',
    nl: 'Soort',
    es: 'Tipo', // MT
    pt: 'Tipo', // MT
    de: 'Art', // MT
    fr: 'Type', // MT
  },
  none: {
    en: 'None',
    nl: 'Geen',
    es: 'Ninguna', // MT
    pt: 'Nenhuma', // MT
    de: 'Keins', // MT
    fr: 'Aucun', // MT
  },
  none_dash: {
    en: '— none —',
    nl: '— geen —',
    es: '— ninguna —', // MT
    pt: '— nenhuma —', // MT
    de: '— keins —', // MT
    fr: '— aucun —', // MT
  },
  none_yet: {
    en: 'None yet.',
    nl: 'Nog geen.',
    es: 'Aún ninguna.', // MT
    pt: 'Nenhuma ainda.', // MT
    de: 'Noch keine.', // MT
    fr: 'Aucun pour le moment.', // MT
  },
  name_required: {
    en: 'Name is required.',
    nl: 'Een naam is verplicht.',
    es: 'El nombre es obligatorio.', // MT
    pt: 'O nome é obrigatório.', // MT
    de: 'Ein Name ist erforderlich.', // MT
    fr: 'Le nom est obligatoire.', // MT
  },
  label_required: {
    en: 'Label is required.',
    nl: 'Een label is verplicht.',
    es: 'La etiqueta es obligatoria.', // MT
    pt: 'O rótulo é obrigatório.', // MT
    de: 'Ein Label ist erforderlich.', // MT
    fr: 'Le libellé est obligatoire.', // MT
  },
  unknown_error: {
    en: 'unknown error',
    nl: 'onbekende fout',
    es: 'error desconocido', // MT
    pt: 'erro desconhecido', // MT
    de: 'unbekannter Fehler', // MT
    fr: 'erreur inconnue', // MT
  },
  me: {
    en: 'Me',
    nl: 'Ik',
    es: 'Yo', // MT
    pt: 'Eu', // MT
    de: 'Ich', // MT
    fr: 'Moi', // MT
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
  income: {
    en: 'Income',
    nl: 'Inkomsten',
    es: 'Ingresos', // MT
    pt: 'Receitas', // MT
    de: 'Einnahmen', // MT
    fr: 'Revenus', // MT
  },
  cost: {
    en: 'Cost',
    nl: 'Kosten',
    es: 'Costo', // MT
    pt: 'Custo', // MT
    de: 'Kosten', // MT
    fr: 'Coût', // MT
  },
  costs: {
    en: 'Costs',
    nl: 'Kosten',
    es: 'Costos', // MT
    pt: 'Custos', // MT
    de: 'Kosten', // MT
    fr: 'Coûts', // MT
  },
  reserve: {
    en: 'Reserve',
    nl: 'Reserve',
    es: 'Reserva', // MT
    pt: 'Reserva', // MT
    de: 'Rücklage', // MT
    fr: 'Réserve', // MT
  },
  reserve_lc: {
    en: 'reserve',
    nl: 'reserve',
    es: 'reserva', // MT
    pt: 'reserva', // MT
    de: 'Rücklage', // MT
    fr: 'réserve', // MT
  },
  bank: {
    en: 'Bank',
    nl: 'Bank',
    es: 'Banco', // MT
    pt: 'Banco', // MT
    de: 'Bank', // MT
    fr: 'Banque', // MT
  },
  unnamed_team: {
    en: 'Unnamed team',
    nl: 'Naamloos team',
    es: 'Equipo sin nombre', // MT
    pt: 'Equipe sem nome', // MT
    de: 'Unbenanntes Team', // MT
    fr: 'Équipe sans nom', // MT
  },
  unnamed: {
    en: 'Unnamed',
    nl: 'Naamloos',
    es: 'Sin nombre', // MT
    pt: 'Sem nome', // MT
    de: 'Unbenannt', // MT
    fr: 'Sans nom', // MT
  },
  current_team: {
    en: 'Current team',
    nl: 'Huidig team',
    es: 'Equipo actual', // MT
    pt: 'Equipe atual', // MT
    de: 'Aktuelles Team', // MT
    fr: 'Équipe actuelle', // MT
  },
  total: {
    en: 'Total',
    nl: 'Totaal',
    es: 'Total', // MT
    pt: 'Total', // MT
    de: 'Gesamt', // MT
    fr: 'Total', // MT
  },
  search: {
    en: 'Search',
    nl: 'Zoeken',
    es: 'Buscar', // MT
    pt: 'Buscar', // MT
    de: 'Suchen', // MT
    fr: 'Rechercher', // MT
  },

  // ── nav (sidebar / bottom bar — the parent wires the shim) ───────────
  nav_pulse: {
    en: 'Pulse',
    nl: 'Pulse',
    es: 'Pulse', // MT
    pt: 'Pulse', // MT
    de: 'Pulse', // MT
    fr: 'Pulse', // MT
  },
  nav_plan: {
    en: 'Plan',
    nl: 'Plannen',
    es: 'Planificar', // MT
    pt: 'Planejar', // MT
    de: 'Planen', // MT
    fr: 'Planifier', // MT
  },
  nav_cashflow: {
    en: 'Cashflow',
    nl: 'Cashflow',
    es: 'Flujo de caja', // MT
    pt: 'Fluxo de caixa', // MT
    de: 'Cashflow', // MT
    fr: 'Trésorerie', // MT
  },
  nav_projects: {
    en: 'Projects',
    nl: 'Projecten',
    es: 'Proyectos', // MT
    pt: 'Projetos', // MT
    de: 'Projekte', // MT
    fr: 'Projets', // MT
  },
  nav_budget: {
    en: 'Budget',
    nl: 'Budget',
    es: 'Presupuesto', // MT
    pt: 'Orçamento', // MT
    de: 'Budget', // MT
    fr: 'Budget', // MT
  },
  nav_people: {
    en: 'People',
    nl: 'Mensen',
    es: 'Personas', // MT
    pt: 'Pessoas', // MT
    de: 'Menschen', // MT
    fr: 'Personnes', // MT
  },
  nav_teams: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipes', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
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
  nav_accounts: {
    en: 'Accounts',
    nl: 'Rekeningen',
    es: 'Cuentas', // MT
    pt: 'Contas', // MT
    de: 'Konten', // MT
    fr: 'Comptes', // MT
  },
  nav_settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },

  // ── dashboard ─────────────────────────────────────────────────────────
  which_cashflow_aria: {
    en: 'Which cashflow to show',
    nl: 'Welke cashflow te tonen',
    es: 'Qué flujo de caja mostrar', // MT
    pt: 'Qual fluxo de caixa mostrar', // MT
    de: 'Welcher Cashflow gezeigt wird', // MT
    fr: 'Quelle trésorerie afficher', // MT
  },
  dash_no_access_before: {
    en: "This cashflow's projection isn't visible to you. Your own deals live in",
    nl: 'De projectie van deze cashflow is niet zichtbaar voor jou. Je eigen deals staan in',
    es: 'La proyección de este flujo de caja no es visible para ti. Tus propios acuerdos están en', // MT
    pt: 'A projeção deste fluxo de caixa não está visível para você. Seus próprios negócios estão em', // MT
    de: 'Die Projektion dieses Cashflows ist für dich nicht sichtbar. Deine eigenen Deals liegen in', // MT
    fr: "La projection de cette trésorerie ne t'est pas visible. Tes propres affaires se trouvent dans", // MT
  },
  dash_no_access_link: {
    en: 'the pipeline',
    nl: 'de pipeline',
    es: 'el pipeline', // MT
    pt: 'o pipeline', // MT
    de: 'der Pipeline', // MT
    fr: 'le pipeline', // MT
  },
  dash_no_access_switch: {
    en: '— or switch cashflow above.',
    nl: '— of wissel hierboven van cashflow.',
    es: '— o cambia de flujo de caja arriba.', // MT
    pt: '— ou troque de fluxo de caixa acima.', // MT
    de: '— oder wechsle oben den Cashflow.', // MT
    fr: '— ou change de trésorerie ci-dessus.', // MT
  },
  in_the_bank: {
    en: 'In the bank',
    nl: 'Op de bank',
    es: 'En el banco', // MT
    pt: 'No banco', // MT
    de: 'Auf der Bank', // MT
    fr: 'En banque', // MT
  },
  latest_snapshots: {
    en: 'latest snapshots',
    nl: 'laatste standen',
    es: 'últimos registros', // MT
    pt: 'últimos registros', // MT
    de: 'letzte Stände', // MT
    fr: 'derniers relevés', // MT
  },
  reserved: {
    en: 'Reserved',
    nl: 'Gereserveerd',
    es: 'Reservado', // MT
    pt: 'Reservado', // MT
    de: 'Reserviert', // MT
    fr: 'Réservé', // MT
  },
  earmarked_buckets: {
    en: 'earmarked buckets',
    nl: 'geoormerkte potjes',
    es: 'fondos asignados', // MT
    pt: 'reservas destinadas', // MT
    de: 'zweckgebundene Töpfe', // MT
    fr: 'enveloppes réservées', // MT
  },
  expected_in: {
    en: 'Expected in',
    nl: 'Verwacht binnen',
    es: 'Entradas previstas', // MT
    pt: 'Entradas previstas', // MT
    de: 'Erwartet herein', // MT
    fr: 'Entrées attendues', // MT
  },
  next_n_periods: {
    en: 'next {n} periods, weighted',
    nl: 'komende {n} periodes, gewogen',
    es: 'próximos {n} periodos, ponderado', // MT
    pt: 'próximos {n} períodos, ponderado', // MT
    de: 'nächste {n} Perioden, gewichtet', // MT
    fr: '{n} prochaines périodes, pondéré', // MT
  },
  proj_empty_1: {
    en: 'Nothing to project yet. Add',
    nl: 'Nog niets te projecteren. Voeg',
    es: 'Aún no hay nada que proyectar. Añade', // MT
    pt: 'Ainda não há nada para projetar. Adicione', // MT
    de: 'Noch nichts zu projizieren. Füge', // MT
    fr: 'Rien à projeter pour le moment. Ajoute', // MT
  },
  proj_empty_link_bank: {
    en: 'a bank balance',
    nl: 'een banksaldo',
    es: 'un saldo bancario', // MT
    pt: 'um saldo bancário', // MT
    de: 'einen Kontostand', // MT
    fr: 'un solde bancaire', // MT
  },
  proj_empty_2: {
    en: ', some',
    nl: 'toe, wat',
    es: ', algunos', // MT
    pt: ', algumas', // MT
    de: 'hinzu, etwas', // MT
    fr: ', des', // MT
  },
  proj_empty_link_income: {
    en: 'expected income',
    nl: 'verwachte inkomsten',
    es: 'ingresos previstos', // MT
    pt: 'receitas previstas', // MT
    de: 'erwartete Einnahmen', // MT
    fr: 'revenus attendus', // MT
  },
  proj_empty_3: {
    en: 'and',
    nl: 'en',
    es: 'y', // MT
    pt: 'e', // MT
    de: 'und', // MT
    fr: 'et des', // MT
  },
  proj_empty_link_costs: {
    en: 'recurring costs',
    nl: 'terugkerende kosten',
    es: 'costos recurrentes', // MT
    pt: 'custos recorrentes', // MT
    de: 'wiederkehrende Kosten', // MT
    fr: 'coûts récurrents', // MT
  },
  proj_empty_4: {
    en: '— the chart draws itself.',
    nl: '— de grafiek tekent zichzelf.',
    es: '— el gráfico se dibuja solo.', // MT
    pt: '— o gráfico se desenha sozinho.', // MT
    de: '— das Diagramm zeichnet sich von selbst.', // MT
    fr: '— le graphique se dessine tout seul.', // MT
  },
  runway_default: {
    en: 'Your cashflow, projected forward.',
    nl: 'Je cashflow, vooruit geprojecteerd.',
    es: 'Tu flujo de caja, proyectado hacia adelante.', // MT
    pt: 'Seu fluxo de caixa, projetado para a frente.', // MT
    de: 'Dein Cashflow, nach vorn projiziert.', // MT
    fr: 'Ta trésorerie, projetée vers l’avant.', // MT
  },
  runway_above_zero: {
    en: 'You stay above zero for the whole horizon. Breathe.',
    nl: 'Je blijft de hele horizon boven nul. Adem rustig.',
    es: 'Te mantienes por encima de cero durante todo el horizonte. Respira.', // MT
    pt: 'Você fica acima de zero durante todo o horizonte. Respire.', // MT
    de: 'Du bleibst über den ganzen Horizont über null. Atme durch.', // MT
    fr: 'Tu restes au-dessus de zéro sur tout l’horizon. Respire.', // MT
  },
  runway_both: {
    en: 'On committed money you dip below zero around {c}; with the weighted pipeline around {e}.',
    nl: 'Op toegezegd geld zak je rond {c} onder nul; met de gewogen pipeline rond {e}.',
    es: 'Con el dinero comprometido bajas de cero hacia {c}; con el pipeline ponderado hacia {e}.', // MT
    pt: 'Com o dinheiro comprometido você fica abaixo de zero por volta de {c}; com o pipeline ponderado por volta de {e}.', // MT
    de: 'Mit zugesagtem Geld rutschst du um {c} unter null; mit der gewichteten Pipeline um {e}.', // MT
    fr: 'Sur l’argent engagé tu passes sous zéro vers {c} ; avec le pipeline pondéré vers {e}.', // MT
  },
  runway_committed: {
    en: 'On committed money alone you dip below zero around {c} — the weighted pipeline keeps you above.',
    nl: 'Op alleen toegezegd geld zak je rond {c} onder nul — de gewogen pipeline houdt je erboven.',
    es: 'Solo con el dinero comprometido bajas de cero hacia {c}; el pipeline ponderado te mantiene por encima.', // MT
    pt: 'Só com o dinheiro comprometido você fica abaixo de zero por volta de {c} — o pipeline ponderado mantém você acima.', // MT
    de: 'Mit nur zugesagtem Geld rutschst du um {c} unter null — die gewichtete Pipeline hält dich darüber.', // MT
    fr: 'Sur le seul argent engagé tu passes sous zéro vers {c} — le pipeline pondéré te maintient au-dessus.', // MT
  },
  runway_expected: {
    en: 'The weighted projection dips below zero around {e}.',
    nl: 'De gewogen projectie zakt rond {e} onder nul.',
    es: 'La proyección ponderada baja de cero hacia {e}.', // MT
    pt: 'A projeção ponderada fica abaixo de zero por volta de {e}.', // MT
    de: 'Die gewichtete Projektion rutscht um {e} unter null.', // MT
    fr: 'La projection pondérée passe sous zéro vers {e}.', // MT
  },

  // ── dashboard chart ───────────────────────────────────────────────────
  chart_overview: {
    en: 'Cashflow overview',
    nl: 'Cashflow-overzicht',
    es: 'Resumen del flujo de caja', // MT
    pt: 'Visão geral do fluxo de caixa', // MT
    de: 'Cashflow-Übersicht', // MT
    fr: 'Aperçu de la trésorerie', // MT
  },
  chart_aria: {
    en: 'Cashflow chart: money in and out per period with running balance',
    nl: 'Cashflowgrafiek: geld in en uit per periode met doorlopend saldo',
    es: 'Gráfico de flujo de caja: dinero que entra y sale por periodo con saldo acumulado', // MT
    pt: 'Gráfico de fluxo de caixa: dinheiro entrando e saindo por período com saldo corrente', // MT
    de: 'Cashflow-Diagramm: Geld ein und aus pro Periode mit laufendem Saldo', // MT
    fr: 'Graphique de trésorerie : entrées et sorties par période avec solde courant', // MT
  },
  chart_bar_layer_aria: {
    en: 'Bar layer',
    nl: 'Balklaag',
    es: 'Capa de barras', // MT
    pt: 'Camada de barras', // MT
    de: 'Balkenebene', // MT
    fr: 'Couche de barres', // MT
  },
  layer_expected: {
    en: 'Expected',
    nl: 'Verwacht',
    es: 'Previsto', // MT
    pt: 'Previsto', // MT
    de: 'Erwartet', // MT
    fr: 'Attendu', // MT
  },
  layer_committed: {
    en: 'Committed',
    nl: 'Toegezegd',
    es: 'Comprometido', // MT
    pt: 'Comprometido', // MT
    de: 'Zugesagt', // MT
    fr: 'Engagé', // MT
  },
  layer_best: {
    en: 'Best case',
    nl: 'Beste geval',
    es: 'Mejor caso', // MT
    pt: 'Melhor caso', // MT
    de: 'Bester Fall', // MT
    fr: 'Meilleur cas', // MT
  },
  no_periods_yet: {
    en: 'No periods to project yet.',
    nl: 'Nog geen periodes om te projecteren.',
    es: 'Aún no hay periodos que proyectar.', // MT
    pt: 'Ainda não há períodos para projetar.', // MT
    de: 'Noch keine Perioden zu projizieren.', // MT
    fr: 'Pas encore de périodes à projeter.', // MT
  },
  tt_in: {
    en: 'In',
    nl: 'In',
    es: 'Entra', // MT
    pt: 'Entra', // MT
    de: 'Ein', // MT
    fr: 'Entrées', // MT
  },
  tt_out: {
    en: 'Out',
    nl: 'Uit',
    es: 'Sale', // MT
    pt: 'Sai', // MT
    de: 'Aus', // MT
    fr: 'Sorties', // MT
  },
  tt_in_value: {
    en: '{c} committed · {e} expected',
    nl: '{c} toegezegd · {e} verwacht',
    es: '{c} comprometido · {e} previsto', // MT
    pt: '{c} comprometido · {e} previsto', // MT
    de: '{c} zugesagt · {e} erwartet', // MT
    fr: '{c} engagé · {e} attendu', // MT
  },
  balance_committed: {
    en: 'Balance (committed)',
    nl: 'Saldo (toegezegd)',
    es: 'Saldo (comprometido)', // MT
    pt: 'Saldo (comprometido)', // MT
    de: 'Saldo (zugesagt)', // MT
    fr: 'Solde (engagé)', // MT
  },
  balance_expected: {
    en: 'Balance (expected)',
    nl: 'Saldo (verwacht)',
    es: 'Saldo (previsto)', // MT
    pt: 'Saldo (previsto)', // MT
    de: 'Saldo (erwartet)', // MT
    fr: 'Solde (attendu)', // MT
  },
  legend_money_in: {
    en: 'money in',
    nl: 'geld in',
    es: 'dinero que entra', // MT
    pt: 'dinheiro entrando', // MT
    de: 'Geld herein', // MT
    fr: 'entrées', // MT
  },
  legend_money_out: {
    en: 'money out',
    nl: 'geld uit',
    es: 'dinero que sale', // MT
    pt: 'dinheiro saindo', // MT
    de: 'Geld hinaus', // MT
    fr: 'sorties', // MT
  },
  legend_balance_committed: {
    en: 'balance (committed)',
    nl: 'saldo (toegezegd)',
    es: 'saldo (comprometido)', // MT
    pt: 'saldo (comprometido)', // MT
    de: 'Saldo (zugesagt)', // MT
    fr: 'solde (engagé)', // MT
  },
  legend_balance_expected: {
    en: 'balance (expected, probability-weighted)',
    nl: 'saldo (verwacht, gewogen naar kans)',
    es: 'saldo (previsto, ponderado por probabilidad)', // MT
    pt: 'saldo (previsto, ponderado por probabilidade)', // MT
    de: 'Saldo (erwartet, nach Wahrscheinlichkeit gewichtet)', // MT
    fr: 'solde (attendu, pondéré par la probabilité)', // MT
  },
  show_table: {
    en: 'Show table',
    nl: 'Tabel tonen',
    es: 'Mostrar tabla', // MT
    pt: 'Mostrar tabela', // MT
    de: 'Tabelle zeigen', // MT
    fr: 'Afficher le tableau', // MT
  },
  hide_table: {
    en: 'Hide table',
    nl: 'Tabel verbergen',
    es: 'Ocultar tabla', // MT
    pt: 'Ocultar tabela', // MT
    de: 'Tabelle ausblenden', // MT
    fr: 'Masquer le tableau', // MT
  },
  th_period: {
    en: 'Period',
    nl: 'Periode',
    es: 'Periodo', // MT
    pt: 'Período', // MT
    de: 'Periode', // MT
    fr: 'Période', // MT
  },
  th_in_committed: {
    en: 'In (committed)',
    nl: 'In (toegezegd)',
    es: 'Entra (comprometido)', // MT
    pt: 'Entra (comprometido)', // MT
    de: 'Ein (zugesagt)', // MT
    fr: 'Entrées (engagé)', // MT
  },
  th_balance: {
    en: 'Balance',
    nl: 'Saldo',
    es: 'Saldo', // MT
    pt: 'Saldo', // MT
    de: 'Saldo', // MT
    fr: 'Solde', // MT
  },

  // ── help + page blurbs ────────────────────────────────────────────────
  help_pulse_blurb: {
    en: 'Runway at a glance, and the dips ahead of it.',
    nl: 'Je runway in één oogopslag, en de dips die eraan komen.',
    es: 'Tu margen de un vistazo, y las caídas que vienen.', // MT
    pt: 'Sua folga financeira num relance, e as quedas à frente.', // MT
    de: 'Deine Reichweite auf einen Blick, und die Dellen davor.', // MT
    fr: 'Ta marge en un coup d’œil, et les creux à venir.', // MT
  },
  cashflow_blurb: {
    en: 'Expected money in and out, per contact — every line weighted by where it stands in the pipeline (a Flow).',
    nl: 'Verwacht geld in en uit, per contact — elke regel gewogen naar waar hij in de pipeline staat (een Flow).',
    es: 'Dinero previsto que entra y sale, por contacto: cada línea ponderada según dónde está en el pipeline (un Flow).', // MT
    pt: 'Dinheiro previsto entrando e saindo, por contato — cada linha ponderada por onde está no pipeline (um Flow).', // MT
    de: 'Erwartetes Geld ein und aus, pro Kontakt — jede Zeile gewichtet danach, wo sie in der Pipeline steht (ein Flow).', // MT
    fr: 'Argent attendu en entrée et en sortie, par contact — chaque ligne pondérée selon sa position dans le pipeline (un Flow).', // MT
  },
  projects_blurb: {
    en: 'Projects run under your involved teams (hubs/incubators) or free-standing.',
    nl: 'Projecten draaien onder je betrokken teams (hubs/incubators) of op zichzelf.',
    es: 'Los proyectos corren bajo tus equipos implicados (hubs/incubadoras) o por libre.', // MT
    pt: 'Projetos rodam sob suas equipes envolvidas (hubs/incubadoras) ou por conta própria.', // MT
    de: 'Projekte laufen unter deinen beteiligten Teams (Hubs/Inkubatoren) oder frei.', // MT
    fr: 'Les projets tournent sous tes équipes impliquées (hubs/incubateurs) ou en autonomie.', // MT
  },
  projects_page_blurb: {
    en: 'Projects run under your involved teams (hubs/incubators) or free-standing. Teams live under People → Teams.',
    nl: 'Projecten draaien onder je betrokken teams (hubs/incubators) of op zichzelf. Teams vind je onder Mensen → Teams.',
    es: 'Los proyectos corren bajo tus equipos implicados (hubs/incubadoras) o por libre. Los equipos están en Personas → Equipos.', // MT
    pt: 'Projetos rodam sob suas equipes envolvidas (hubs/incubadoras) ou por conta própria. Equipes ficam em Pessoas → Equipes.', // MT
    de: 'Projekte laufen unter deinen beteiligten Teams (Hubs/Inkubatoren) oder frei. Teams findest du unter Menschen → Teams.', // MT
    fr: 'Les projets tournent sous tes équipes impliquées (hubs/incubateurs) ou en autonomie. Les équipes vivent sous Personnes → Équipes.', // MT
  },
  budget_blurb: {
    en: 'Recurring lines expand into the projection automatically. Toggled-off lines stay here, out of the numbers.',
    nl: 'Terugkerende regels rollen automatisch de projectie in. Uitgeschakelde regels blijven hier staan, buiten de cijfers.',
    es: 'Las líneas recurrentes se expanden solas en la proyección. Las desactivadas se quedan aquí, fuera de los números.', // MT
    pt: 'Linhas recorrentes se expandem sozinhas na projeção. Linhas desativadas ficam aqui, fora dos números.', // MT
    de: 'Wiederkehrende Zeilen fließen automatisch in die Projektion. Abgeschaltete Zeilen bleiben hier, außerhalb der Zahlen.', // MT
    fr: 'Les lignes récurrentes s’étendent automatiquement dans la projection. Les lignes désactivées restent ici, hors des chiffres.', // MT
  },
  teams_blurb: {
    en: 'Teams are a Fibre platform primitive — one team, every app. Toggle which ones take part in the planner.',
    nl: 'Teams zijn een basisbouwsteen van het Fibre-platform — één team, elke app. Schakel in welke meedoen in de planner.',
    es: 'Los equipos son un elemento base de la plataforma Fibre: un equipo, todas las apps. Activa cuáles participan en el planificador.', // MT
    pt: 'Equipes são um elemento base da plataforma Fibre — uma equipe, todos os apps. Ative quais participam do planejador.', // MT
    de: 'Teams sind ein Grundbaustein der Fibre-Plattform — ein Team, jede App. Schalte um, welche im Planer mitmachen.', // MT
    fr: 'Les équipes sont une brique de la plateforme Fibre — une équipe, toutes les apps. Choisis lesquelles participent au planificateur.', // MT
  },
  teams_page_blurb: {
    en: 'Teams are a Fibre platform primitive — one team, every app. Toggle which ones take part in the planner (they act as hubs/incubators, get their own cashflow scope and hold projects).',
    nl: 'Teams zijn een basisbouwsteen van het Fibre-platform — één team, elke app. Schakel in welke meedoen in de planner (ze werken als hubs/incubators, krijgen hun eigen cashflow en dragen projecten).',
    es: 'Los equipos son un elemento base de la plataforma Fibre: un equipo, todas las apps. Activa cuáles participan en el planificador (actúan como hubs/incubadoras, tienen su propio flujo de caja y llevan proyectos).', // MT
    pt: 'Equipes são um elemento base da plataforma Fibre — uma equipe, todos os apps. Ative quais participam do planejador (elas atuam como hubs/incubadoras, ganham seu próprio fluxo de caixa e carregam projetos).', // MT
    de: 'Teams sind ein Grundbaustein der Fibre-Plattform — ein Team, jede App. Schalte um, welche im Planer mitmachen (sie wirken als Hubs/Inkubatoren, bekommen ihren eigenen Cashflow und tragen Projekte).', // MT
    fr: 'Les équipes sont une brique de la plateforme Fibre — une équipe, toutes les apps. Choisis lesquelles participent au planificateur (elles servent de hubs/incubateurs, ont leur propre trésorerie et portent des projets).', // MT
  },
  invoices_blurb: {
    en: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
    nl: 'Elke aankoop in al je Fibre-apps — zoeken, facturen opnieuw sturen, terugbetalen.',
    es: 'Cada compra en todas tus apps de Fibre: busca, reenvía facturas, reembolsa.', // MT
    pt: 'Cada compra em todos os seus apps Fibre — busque, reenvie faturas, reembolse.', // MT
    de: 'Jeder Kauf über deine Fibre-Apps — suchen, Rechnungen erneut senden, erstatten.', // MT
    fr: 'Chaque achat dans tes apps Fibre — recherche, renvoi de factures, remboursement.', // MT
  },
  accounts_blurb: {
    en: 'Balance snapshots anchor the projection. Reserves are earmarked money — in the bank, not yours to spend.',
    nl: 'Saldostanden verankeren de projectie. Reserves zijn geoormerkt geld — op de bank, niet om uit te geven.',
    es: 'Los registros de saldo anclan la proyección. Las reservas son dinero asignado: en el banco, pero no para gastar.', // MT
    pt: 'Registros de saldo ancoram a projeção. Reservas são dinheiro destinado — no banco, mas não para gastar.', // MT
    de: 'Saldostände verankern die Projektion. Rücklagen sind zweckgebundenes Geld — auf der Bank, nicht zum Ausgeben.', // MT
    fr: 'Les relevés de solde ancrent la projection. Les réserves sont de l’argent fléché — en banque, mais pas à dépenser.', // MT
  },
  settings_help_blurb: {
    en: "Your Fibre profile, payments and the planner's assumptions.",
    nl: 'Je Fibre-profiel, betalingen en de aannames van de planner.',
    es: 'Tu perfil de Fibre, los pagos y los supuestos del planificador.', // MT
    pt: 'Seu perfil Fibre, pagamentos e as premissas do planejador.', // MT
    de: 'Dein Fibre-Profil, Zahlungen und die Annahmen des Planers.', // MT
    fr: 'Ton profil Fibre, les paiements et les hypothèses du planificateur.', // MT
  },

  // ── settings hub ──────────────────────────────────────────────────────
  settings: {
    en: 'Settings',
    nl: 'Instellingen',
    es: 'Ajustes', // MT
    pt: 'Configurações', // MT
    de: 'Einstellungen', // MT
    fr: 'Paramètres', // MT
  },
  settings_page_blurb: {
    en: 'You, the workspace, and Pulse. The same four sections in every Fibre app.',
    nl: 'Jij, de werkruimte en Pulse. Dezelfde vier secties in elke Fibre-app.',
    es: 'Tú, el espacio de trabajo y Pulse. Las mismas cuatro secciones en cada app de Fibre.', // MT
    pt: 'Você, o espaço de trabalho e o Pulse. As mesmas quatro seções em todo app Fibre.', // MT
    de: 'Du, der Workspace und Pulse. Dieselben vier Bereiche in jeder Fibre-App.', // MT
    fr: 'Toi, l’espace de travail et Pulse. Les quatre mêmes sections dans chaque app Fibre.', // MT
  },
  planner: {
    en: 'Planner',
    nl: 'Planner',
    es: 'Planificador', // MT
    pt: 'Planejador', // MT
    de: 'Planer', // MT
    fr: 'Planificateur', // MT
  },
  planner_card_desc: {
    en: "Pulse's assumptions — rhythm, invoicing, ledger, reservations, teams, stages, offerings and history.",
    nl: 'De aannames van Pulse — ritme, facturatie, grootboek, reserveringen, teams, fases, aanbod en historie.',
    es: 'Los supuestos de Pulse: ritmo, facturación, libro mayor, reservas, equipos, etapas, ofertas e historial.', // MT
    pt: 'As premissas do Pulse — ritmo, faturamento, livro-razão, reservas, equipes, etapas, ofertas e histórico.', // MT
    de: 'Die Annahmen von Pulse — Rhythmus, Rechnungen, Ledger, Reservierungen, Teams, Phasen, Angebote und Verlauf.', // MT
    fr: 'Les hypothèses de Pulse — rythme, facturation, registre, réserves, équipes, étapes, offres et historique.', // MT
  },
  planner_blurb: {
    en: 'The assumptions layer. Nothing domain-specific is hardcoded — rhythm, currency, reservations, involved teams and offerings are all configuration.',
    nl: 'De aannamelaag. Niets domeinspecifieks staat vast in de code — ritme, valuta, reserveringen, betrokken teams en aanbod zijn allemaal configuratie.',
    es: 'La capa de supuestos. Nada específico del dominio está fijo en el código: ritmo, moneda, reservas, equipos implicados y ofertas son configuración.', // MT
    pt: 'A camada de premissas. Nada específico do domínio está fixo no código — ritmo, moeda, reservas, equipes envolvidas e ofertas são configuração.', // MT
    de: 'Die Annahmen-Schicht. Nichts Fachliches ist fest verdrahtet — Rhythmus, Währung, Reservierungen, beteiligte Teams und Angebote sind Konfiguration.', // MT
    fr: 'La couche d’hypothèses. Rien de spécifique au domaine n’est codé en dur — rythme, devise, réserves, équipes impliquées et offres sont de la configuration.', // MT
  },
  admin_only_notice: {
    en: 'These settings are visible to workspace admins only. If you expected to see them, ask an admin to widen your role.',
    nl: 'Deze instellingen zijn alleen zichtbaar voor werkruimte-admins. Verwachtte je ze te zien, vraag dan een admin om je rol te verruimen.',
    es: 'Estos ajustes solo son visibles para los admins del espacio de trabajo. Si esperabas verlos, pide a un admin que amplíe tu rol.', // MT
    pt: 'Estas configurações são visíveis só para admins do espaço de trabalho. Se você esperava vê-las, peça a um admin para ampliar seu papel.', // MT
    de: 'Diese Einstellungen sehen nur Workspace-Admins. Wenn du sie erwartet hast, bitte einen Admin, deine Rolle zu erweitern.', // MT
    fr: 'Ces paramètres ne sont visibles que par les admins de l’espace de travail. Si tu t’attendais à les voir, demande à un admin d’élargir ton rôle.', // MT
  },

  // ── rhythm card ───────────────────────────────────────────────────────
  rhythm_title: {
    en: 'Time rhythm & currency',
    nl: 'Tijdritme & valuta',
    es: 'Ritmo temporal y moneda', // MT
    pt: 'Ritmo de tempo e moeda', // MT
    de: 'Zeitrhythmus & Währung', // MT
    fr: 'Rythme temporel et devise', // MT
  },
  currency: {
    en: 'Currency',
    nl: 'Valuta',
    es: 'Moneda', // MT
    pt: 'Moeda', // MT
    de: 'Währung', // MT
    fr: 'Devise', // MT
  },
  currency_default: {
    en: 'EUR (default)',
    nl: 'EUR (standaard)',
    es: 'EUR (predeterminado)', // MT
    pt: 'EUR (padrão)', // MT
    de: 'EUR (Standard)', // MT
    fr: 'EUR (par défaut)', // MT
  },
  granularity: {
    en: 'Granularity',
    nl: 'Korrelgrootte',
    es: 'Granularidad', // MT
    pt: 'Granularidade', // MT
    de: 'Granularität', // MT
    fr: 'Granularité', // MT
  },
  granularity_default: {
    en: 'fortnight (default)',
    nl: 'twee weken (standaard)',
    es: 'quincena (predeterminado)', // MT
    pt: 'quinzena (padrão)', // MT
    de: 'zwei Wochen (Standard)', // MT
    fr: 'quinzaine (par défaut)', // MT
  },
  gran_week: {
    en: 'Week',
    nl: 'Week',
    es: 'Semana', // MT
    pt: 'Semana', // MT
    de: 'Woche', // MT
    fr: 'Semaine', // MT
  },
  gran_fortnight: {
    en: 'Fortnight',
    nl: 'Twee weken',
    es: 'Quincena', // MT
    pt: 'Quinzena', // MT
    de: 'Zwei Wochen', // MT
    fr: 'Quinzaine', // MT
  },
  gran_month: {
    en: 'Month',
    nl: 'Maand',
    es: 'Mes', // MT
    pt: 'Mês', // MT
    de: 'Monat', // MT
    fr: 'Mois', // MT
  },
  gran_quarter: {
    en: 'Quarter',
    nl: 'Kwartaal',
    es: 'Trimestre', // MT
    pt: 'Trimestre', // MT
    de: 'Quartal', // MT
    fr: 'Trimestre', // MT
  },
  gran_week_lc: {
    en: 'week',
    nl: 'week',
    es: 'semana', // MT
    pt: 'semana', // MT
    de: 'Woche', // MT
    fr: 'semaine', // MT
  },
  gran_fortnight_lc: {
    en: 'fortnight',
    nl: 'twee weken',
    es: 'quincena', // MT
    pt: 'quinzena', // MT
    de: 'zwei Wochen', // MT
    fr: 'quinzaine', // MT
  },
  gran_month_lc: {
    en: 'month',
    nl: 'maand',
    es: 'mes', // MT
    pt: 'mês', // MT
    de: 'Monat', // MT
    fr: 'mois', // MT
  },
  gran_quarter_lc: {
    en: 'quarter',
    nl: 'kwartaal',
    es: 'trimestre', // MT
    pt: 'trimestre', // MT
    de: 'Quartal', // MT
    fr: 'trimestre', // MT
  },
  fiscal_year_starts: {
    en: 'Fiscal year starts',
    nl: 'Boekjaar begint in',
    es: 'El año fiscal empieza en', // MT
    pt: 'O ano fiscal começa em', // MT
    de: 'Geschäftsjahr beginnt im', // MT
    fr: 'L’exercice commence en', // MT
  },
  how_far_ahead: {
    en: 'How far ahead',
    nl: 'Hoe ver vooruit',
    es: 'Cuánto hacia adelante', // MT
    pt: 'Até onde olhar', // MT
    de: 'Wie weit voraus', // MT
    fr: 'Jusqu’où regarder', // MT
  },
  n_months: {
    en: '{n} months',
    nl: '{n} maanden',
    es: '{n} meses', // MT
    pt: '{n} meses', // MT
    de: '{n} Monate', // MT
    fr: '{n} mois', // MT
  },
  two_years: {
    en: '2 years',
    nl: '2 jaar',
    es: '2 años', // MT
    pt: '2 anos', // MT
    de: '2 Jahre', // MT
    fr: '2 ans', // MT
  },
  first_column_on: {
    en: 'First column on',
    nl: 'Eerste kolom op',
    es: 'Primera columna en', // MT
    pt: 'Primeira coluna em', // MT
    de: 'Erste Spalte am', // MT
    fr: 'Première colonne le', // MT
  },
  today_cap: {
    en: 'Today',
    nl: 'Vandaag',
    es: 'Hoy', // MT
    pt: 'Hoje', // MT
    de: 'Heute', // MT
    fr: 'Aujourd’hui', // MT
  },
  first_column_hint: {
    en: 'The cashflow starts on the next such weekday instead of today.',
    nl: 'De cashflow begint op de eerstvolgende zo’n weekdag in plaats van vandaag.',
    es: 'El flujo de caja empieza en el próximo día de la semana elegido en vez de hoy.', // MT
    pt: 'O fluxo de caixa começa no próximo dia da semana escolhido em vez de hoje.', // MT
    de: 'Der Cashflow beginnt am nächsten solchen Wochentag statt heute.', // MT
    fr: 'La trésorerie démarre au prochain jour de semaine choisi au lieu d’aujourd’hui.', // MT
  },

  // ── invoicing card ────────────────────────────────────────────────────
  invoicing: {
    en: 'Invoicing',
    nl: 'Facturatie',
    es: 'Facturación', // MT
    pt: 'Faturamento', // MT
    de: 'Rechnungsstellung', // MT
    fr: 'Facturation', // MT
  },
  number_prefix: {
    en: 'Number prefix',
    nl: 'Nummervoorvoegsel',
    es: 'Prefijo del número', // MT
    pt: 'Prefixo do número', // MT
    de: 'Nummernpräfix', // MT
    fr: 'Préfixe de numéro', // MT
  },
  prefix_ph: {
    en: 'e.g. 2026-',
    nl: 'bijv. 2026-',
    es: 'p. ej. 2026-', // MT
    pt: 'p. ex. 2026-', // MT
    de: 'z. B. 2026-', // MT
    fr: 'p. ex. 2026-', // MT
  },
  next_number: {
    en: 'Next number',
    nl: 'Volgend nummer',
    es: 'Próximo número', // MT
    pt: 'Próximo número', // MT
    de: 'Nächste Nummer', // MT
    fr: 'Prochain numéro', // MT
  },
  invoice_seq_hint: {
    en: 'Assigned when an opportunity transfers to an invoice — the sequence advances by itself.',
    nl: 'Toegekend zodra een kans wordt omgezet naar een factuur — de reeks telt vanzelf door.',
    es: 'Se asigna cuando una oportunidad pasa a factura: la secuencia avanza sola.', // MT
    pt: 'Atribuído quando uma oportunidade vira fatura — a sequência avança sozinha.', // MT
    de: 'Wird vergeben, sobald eine Chance zur Rechnung wird — die Sequenz zählt von selbst weiter.', // MT
    fr: 'Attribué quand une opportunité devient facture — la séquence avance toute seule.', // MT
  },
  auto_send: {
    en: 'Send invoices automatically',
    nl: 'Facturen automatisch versturen',
    es: 'Enviar facturas automáticamente', // MT
    pt: 'Enviar faturas automaticamente', // MT
    de: 'Rechnungen automatisch senden', // MT
    fr: 'Envoyer les factures automatiquement', // MT
  },
  auto_send_hint: {
    en: 'Every created invoice is emailed to the contact person straight away.',
    nl: 'Elke aangemaakte factuur gaat direct per e-mail naar de contactpersoon.',
    es: 'Cada factura creada se envía por correo al contacto de inmediato.', // MT
    pt: 'Cada fatura criada é enviada por e-mail ao contato na hora.', // MT
    de: 'Jede erstellte Rechnung geht sofort per E-Mail an die Kontaktperson.', // MT
    fr: 'Chaque facture créée part aussitôt par e-mail au contact.', // MT
  },
  vat_tariffs: {
    en: 'VAT tariffs',
    nl: 'Btw-tarieven',
    es: 'Tipos de IVA', // MT
    pt: 'Alíquotas de IVA', // MT
    de: 'Mehrwertsteuersätze', // MT
    fr: 'Taux de TVA', // MT
  },
  vat_tariffs_hint: {
    en: 'The tariffs the income/cost popup offers — label + percentage.',
    nl: 'De tarieven die de inkomsten/kosten-popup aanbiedt — label + percentage.',
    es: 'Los tipos que ofrece el popup de ingresos/costos: etiqueta + porcentaje.', // MT
    pt: 'As alíquotas que o popup de receitas/custos oferece — rótulo + porcentagem.', // MT
    de: 'Die Sätze, die das Einnahmen/Kosten-Popup anbietet — Label + Prozentsatz.', // MT
    fr: 'Les taux proposés par la fenêtre revenus/coûts — libellé + pourcentage.', // MT
  },
  tariff_label_aria: {
    en: 'Tariff label',
    nl: 'Label van het tarief',
    es: 'Etiqueta del tipo', // MT
    pt: 'Rótulo da alíquota', // MT
    de: 'Label des Satzes', // MT
    fr: 'Libellé du taux', // MT
  },
  tariff_pct_aria: {
    en: 'Tariff percentage',
    nl: 'Percentage van het tarief',
    es: 'Porcentaje del tipo', // MT
    pt: 'Porcentagem da alíquota', // MT
    de: 'Prozentsatz des Satzes', // MT
    fr: 'Pourcentage du taux', // MT
  },
  remove_named: {
    en: 'Remove {name}',
    nl: '{name} verwijderen',
    es: 'Quitar {name}', // MT
    pt: 'Remover {name}', // MT
    de: '{name} entfernen', // MT
    fr: 'Retirer {name}', // MT
  },
  tariff_lc: {
    en: 'tariff',
    nl: 'tarief',
    es: 'tipo', // MT
    pt: 'alíquota', // MT
    de: 'Satz', // MT
    fr: 'taux', // MT
  },
  add_tariff: {
    en: 'Add tariff',
    nl: 'Tarief toevoegen',
    es: 'Añadir tipo', // MT
    pt: 'Adicionar alíquota', // MT
    de: 'Satz hinzufügen', // MT
    fr: 'Ajouter un taux', // MT
  },
  tariff_label_ph: {
    en: 'e.g. Hoog 21%',
    nl: 'bijv. Hoog 21%',
    es: 'p. ej. General 21%', // MT
    pt: 'p. ex. Padrão 21%', // MT
    de: 'z. B. Regelsatz 21%', // MT
    fr: 'p. ex. Normal 21%', // MT
  },

  // ── ledger card ───────────────────────────────────────────────────────
  ledger_invoices: {
    en: 'Ledger invoices',
    nl: 'Grootboekfacturen',
    es: 'Facturas del libro mayor', // MT
    pt: 'Faturas do livro-razão', // MT
    de: 'Ledger-Rechnungen', // MT
    fr: 'Factures du registre', // MT
  },
  include_in_cashflow: {
    en: 'Include in the cashflow',
    nl: 'Meenemen in de cashflow',
    es: 'Incluir en el flujo de caja', // MT
    pt: 'Incluir no fluxo de caixa', // MT
    de: 'In den Cashflow aufnehmen', // MT
    fr: 'Inclure dans la trésorerie', // MT
  },
  ledger_hint: {
    en: 'Open Stripe/invoice purchases from Meet and Thread project as receivables.',
    nl: 'Openstaande Stripe-/factuuraankopen uit Meet en Thread projecteren als te ontvangen bedragen.',
    es: 'Las compras abiertas por Stripe/factura de Meet y Thread se proyectan como cobros pendientes.', // MT
    pt: 'Compras abertas por Stripe/fatura do Meet e do Thread projetam como recebíveis.', // MT
    de: 'Offene Stripe-/Rechnungskäufe aus Meet und Thread projizieren als Forderungen.', // MT
    fr: 'Les achats Stripe/facture ouverts de Meet et Thread se projettent comme créances.', // MT
  },
  expected_settlement_days: {
    en: 'Expected settlement (days)',
    nl: 'Verwachte betaling (dagen)',
    es: 'Cobro previsto (días)', // MT
    pt: 'Liquidação prevista (dias)', // MT
    de: 'Erwarteter Zahlungseingang (Tage)', // MT
    fr: 'Règlement attendu (jours)', // MT
  },
  settlement_range_error: {
    en: 'Expected settlement must be between 0 and 120 days.',
    nl: 'De verwachte betaling moet tussen 0 en 120 dagen liggen.',
    es: 'El cobro previsto debe estar entre 0 y 120 días.', // MT
    pt: 'A liquidação prevista deve ficar entre 0 e 120 dias.', // MT
    de: 'Der erwartete Zahlungseingang muss zwischen 0 und 120 Tagen liegen.', // MT
    fr: 'Le règlement attendu doit être entre 0 et 120 jours.', // MT
  },

  // ── history card ──────────────────────────────────────────────────────
  history: {
    en: 'History',
    nl: 'Historie',
    es: 'Historial', // MT
    pt: 'Histórico', // MT
    de: 'Verlauf', // MT
    fr: 'Historique', // MT
  },
  cadence_off: {
    en: 'Off',
    nl: 'Uit',
    es: 'Desactivado', // MT
    pt: 'Desativado', // MT
    de: 'Aus', // MT
    fr: 'Désactivé', // MT
  },
  every_n_days: {
    en: 'Every {n} days',
    nl: 'Elke {n} dagen',
    es: 'Cada {n} días', // MT
    pt: 'A cada {n} dias', // MT
    de: 'Alle {n} Tage', // MT
    fr: 'Tous les {n} jours', // MT
  },
  history_aria: {
    en: 'How often to store an overview',
    nl: 'Hoe vaak een overzicht wordt bewaard',
    es: 'Con qué frecuencia guardar un resumen', // MT
    pt: 'Com que frequência guardar uma visão geral', // MT
    de: 'Wie oft eine Übersicht gespeichert wird', // MT
    fr: 'Fréquence d’enregistrement d’un aperçu', // MT
  },
  history_hint: {
    en: 'Stores an overview of the cashflow at that moment, for comparison later. Overviews are kept two years, then removed.',
    nl: 'Bewaart een overzicht van de cashflow op dat moment, om later te vergelijken. Overzichten blijven twee jaar bewaard en verdwijnen daarna.',
    es: 'Guarda un resumen del flujo de caja en ese momento, para comparar más tarde. Los resúmenes se conservan dos años y luego se eliminan.', // MT
    pt: 'Guarda uma visão geral do fluxo de caixa naquele momento, para comparar depois. Visões gerais são mantidas por dois anos e depois removidas.', // MT
    de: 'Speichert eine Übersicht des Cashflows zu diesem Zeitpunkt, zum späteren Vergleich. Übersichten bleiben zwei Jahre und werden dann entfernt.', // MT
    fr: 'Enregistre un aperçu de la trésorerie à ce moment-là, pour comparer plus tard. Les aperçus sont gardés deux ans, puis supprimés.', // MT
  },
  per_granularity: {
    en: 'per {g}',
    nl: 'per {g}',
    es: 'por {g}', // MT
    pt: 'por {g}', // MT
    de: 'pro {g}', // MT
    fr: 'par {g}', // MT
  },
  overview: {
    en: 'Overview',
    nl: 'Overzicht',
    es: 'Resumen', // MT
    pt: 'Visão geral', // MT
    de: 'Übersicht', // MT
    fr: 'Aperçu', // MT
  },
  stored_per: {
    en: 'Stored per {g}.',
    nl: 'Bewaard per {g}.',
    es: 'Guardado por {g}.', // MT
    pt: 'Guardado por {g}.', // MT
    de: 'Gespeichert pro {g}.', // MT
    fr: 'Enregistré par {g}.', // MT
  },
  overview_not_found: {
    en: 'Overview not found.',
    nl: 'Overzicht niet gevonden.',
    es: 'Resumen no encontrado.', // MT
    pt: 'Visão geral não encontrada.', // MT
    de: 'Übersicht nicht gefunden.', // MT
    fr: 'Aperçu introuvable.', // MT
  },
  overview_no_periods: {
    en: 'This overview holds no periods.',
    nl: 'Dit overzicht bevat geen periodes.',
    es: 'Este resumen no contiene periodos.', // MT
    pt: 'Esta visão geral não contém períodos.', // MT
    de: 'Diese Übersicht enthält keine Perioden.', // MT
    fr: 'Cet aperçu ne contient aucune période.', // MT
  },
  th_committed_in: {
    en: 'Committed in',
    nl: 'Toegezegd in',
    es: 'Comprometido entra', // MT
    pt: 'Comprometido entra', // MT
    de: 'Zugesagt ein', // MT
    fr: 'Engagé entrées', // MT
  },
  th_end_position: {
    en: 'End position',
    nl: 'Eindpositie',
    es: 'Posición final', // MT
    pt: 'Posição final', // MT
    de: 'Endposition', // MT
    fr: 'Position finale', // MT
  },

  // ── reservations (settings card + per-tab dialog) ─────────────────────
  reservations: {
    en: 'Reservations',
    nl: 'Reserveringen',
    es: 'Reservas', // MT
    pt: 'Reservas', // MT
    de: 'Reservierungen', // MT
    fr: 'Réserves', // MT
  },
  add_rule: {
    en: 'Add rule',
    nl: 'Regel toevoegen',
    es: 'Añadir regla', // MT
    pt: 'Adicionar regra', // MT
    de: 'Regel hinzufügen', // MT
    fr: 'Ajouter une règle', // MT
  },
  ws_rules_note: {
    en: 'Workspace rules only — team and personal cashflows manage their reservations from their own tab (the + on the Reservations row).',
    nl: 'Alleen werkruimte-regels — team- en persoonlijke cashflows beheren hun reserveringen vanaf hun eigen tabblad (de + op de rij Reserveringen).',
    es: 'Solo reglas del espacio de trabajo: los flujos de equipo y personales gestionan sus reservas desde su propia pestaña (el + en la fila Reservas).', // MT
    pt: 'Só regras do espaço de trabalho — fluxos de equipe e pessoais gerenciam suas reservas na própria aba (o + na linha Reservas).', // MT
    de: 'Nur Workspace-Regeln — Team- und persönliche Cashflows verwalten ihre Reservierungen im eigenen Tab (das + in der Zeile Reservierungen).', // MT
    fr: 'Règles de l’espace de travail uniquement — les trésoreries d’équipe et personnelles gèrent leurs réserves depuis leur propre onglet (le + sur la ligne Réserves).', // MT
  },
  no_rules_yet: {
    en: 'No reservation rules yet. Solidarity Fund, VAT reserve, buffer — all user-defined percentage rules; none are built in.',
    nl: 'Nog geen reserveringsregels. Solidariteitsfonds, btw-reserve, buffer — allemaal zelfgekozen percentageregels; niets is ingebouwd.',
    es: 'Aún no hay reglas de reserva. Fondo solidario, reserva de IVA, colchón: todas son reglas de porcentaje definidas por ti; ninguna viene integrada.', // MT
    pt: 'Ainda não há regras de reserva. Fundo solidário, reserva de IVA, colchão — todas são regras de porcentagem definidas por você; nenhuma vem embutida.', // MT
    de: 'Noch keine Reservierungsregeln. Solidaritätsfonds, MwSt-Rücklage, Puffer — alles selbstdefinierte Prozentregeln; nichts ist eingebaut.', // MT
    fr: 'Pas encore de règles de réserve. Fonds de solidarité, réserve de TVA, coussin — toutes des règles de pourcentage définies par toi ; rien n’est intégré.', // MT
  },
  edit_rule: {
    en: 'Edit reservation rule',
    nl: 'Reserveringsregel bewerken',
    es: 'Editar regla de reserva', // MT
    pt: 'Editar regra de reserva', // MT
    de: 'Reservierungsregel bearbeiten', // MT
    fr: 'Modifier la règle de réserve', // MT
  },
  new_rule: {
    en: 'New reservation rule',
    nl: 'Nieuwe reserveringsregel',
    es: 'Nueva regla de reserva', // MT
    pt: 'Nova regra de reserva', // MT
    de: 'Neue Reservierungsregel', // MT
    fr: 'Nouvelle règle de réserve', // MT
  },
  pct_range_error: {
    en: 'Percentage must be between 0 and 100.',
    nl: 'Het percentage moet tussen 0 en 100 liggen.',
    es: 'El porcentaje debe estar entre 0 y 100.', // MT
    pt: 'A porcentagem deve ficar entre 0 e 100.', // MT
    de: 'Der Prozentsatz muss zwischen 0 und 100 liegen.', // MT
    fr: 'Le pourcentage doit être entre 0 et 100.', // MT
  },
  percentage: {
    en: 'Percentage',
    nl: 'Percentage',
    es: 'Porcentaje', // MT
    pt: 'Porcentagem', // MT
    de: 'Prozentsatz', // MT
    fr: 'Pourcentage', // MT
  },
  basis: {
    en: 'Basis',
    nl: 'Grondslag',
    es: 'Base', // MT
    pt: 'Base', // MT
    de: 'Basis', // MT
    fr: 'Base', // MT
  },
  revenue: {
    en: 'Revenue',
    nl: 'Omzet',
    es: 'Ingresos', // MT
    pt: 'Receita', // MT
    de: 'Umsatz', // MT
    fr: 'Chiffre d’affaires', // MT
  },
  net_revenue: {
    en: 'Net revenue',
    nl: 'Netto-omzet',
    es: 'Ingresos netos', // MT
    pt: 'Receita líquida', // MT
    de: 'Nettoumsatz', // MT
    fr: 'Chiffre d’affaires net', // MT
  },
  target_account: {
    en: 'Target account',
    nl: 'Doelrekening',
    es: 'Cuenta de destino', // MT
    pt: 'Conta de destino', // MT
    de: 'Zielkonto', // MT
    fr: 'Compte cible', // MT
  },
  target_account_hint: {
    en: 'Optional — a reserve account the reserved amount conceptually flows into.',
    nl: 'Optioneel — een reserverekening waar het gereserveerde bedrag denkbeeldig naartoe stroomt.',
    es: 'Opcional: una cuenta de reserva a la que el importe reservado fluye conceptualmente.', // MT
    pt: 'Opcional — uma conta de reserva para onde o valor reservado flui conceitualmente.', // MT
    de: 'Optional — ein Rücklagenkonto, in das der reservierte Betrag gedanklich fließt.', // MT
    fr: 'Facultatif — un compte de réserve vers lequel le montant réservé s’écoule conceptuellement.', // MT
  },
  target_account_tab_hint: {
    en: "Optional — one of this cashflow's reserve accounts the reserved amount conceptually flows into.",
    nl: 'Optioneel — een van de reserverekeningen van deze cashflow waar het gereserveerde bedrag denkbeeldig naartoe stroomt.',
    es: 'Opcional: una de las cuentas de reserva de este flujo de caja a la que el importe reservado fluye conceptualmente.', // MT
    pt: 'Opcional — uma das contas de reserva deste fluxo de caixa para onde o valor reservado flui conceitualmente.', // MT
    de: 'Optional — eines der Rücklagenkonten dieses Cashflows, in das der reservierte Betrag gedanklich fließt.', // MT
    fr: 'Facultatif — un des comptes de réserve de cette trésorerie vers lequel le montant réservé s’écoule conceptuellement.', // MT
  },
  rule_tab_desc: {
    en: "A percentage of every period's income, set aside in the {tab} cashflow.",
    nl: 'Een percentage van de inkomsten van elke periode, apart gezet in de cashflow {tab}.',
    es: 'Un porcentaje de los ingresos de cada periodo, apartado en el flujo de caja {tab}.', // MT
    pt: 'Uma porcentagem da receita de cada período, separada no fluxo de caixa {tab}.', // MT
    de: 'Ein Prozentsatz der Einnahmen jeder Periode, beiseitegelegt im Cashflow {tab}.', // MT
    fr: 'Un pourcentage des revenus de chaque période, mis de côté dans la trésorerie {tab}.', // MT
  },
  eg_vat_reserve: {
    en: 'e.g. VAT reserve',
    nl: 'bijv. Btw-reserve',
    es: 'p. ej. Reserva de IVA', // MT
    pt: 'p. ex. Reserva de IVA', // MT
    de: 'z. B. MwSt-Rücklage', // MT
    fr: 'p. ex. Réserve de TVA', // MT
  },
  eg_21: {
    en: 'e.g. 21',
    nl: 'bijv. 21',
    es: 'p. ej. 21', // MT
    pt: 'p. ex. 21', // MT
    de: 'z. B. 21', // MT
    fr: 'p. ex. 21', // MT
  },

  // ── stages card ───────────────────────────────────────────────────────
  pipeline_stages: {
    en: 'Pipeline stages',
    nl: 'Pipelinefases',
    es: 'Etapas del pipeline', // MT
    pt: 'Etapas do pipeline', // MT
    de: 'Pipeline-Phasen', // MT
    fr: 'Étapes du pipeline', // MT
  },
  edit_flow_in_flow: {
    en: 'Edit the flow in Flow',
    nl: 'Bewerk de flow in Flow',
    es: 'Edita el flow en Flow', // MT
    pt: 'Edite o flow no Flow', // MT
    de: 'Den Flow in Flow bearbeiten', // MT
    fr: 'Modifier le flow dans Flow', // MT
  },
  stages_blurb_a: {
    en: 'The pipeline is a Flow — steps, order and names are edited there and mirrored here. What each step ',
    nl: 'De pipeline is een Flow — stappen, volgorde en namen bewerk je daar en worden hier gespiegeld. Wat elke stap ',
    es: 'El pipeline es un Flow: pasos, orden y nombres se editan allí y se reflejan aquí. Lo que cada paso ', // MT
    pt: 'O pipeline é um Flow — passos, ordem e nomes são editados lá e espelhados aqui. O que cada passo ', // MT
    de: 'Die Pipeline ist ein Flow — Schritte, Reihenfolge und Namen bearbeitest du dort, hier werden sie gespiegelt. Was jeder Schritt ', // MT
    fr: 'Le pipeline est un Flow — étapes, ordre et noms se modifient là-bas et sont reflétés ici. Ce que chaque étape ', // MT
  },
  stages_blurb_em: {
    en: 'means for the money',
    nl: 'voor het geld betekent',
    es: 'significa para el dinero', // MT
    pt: 'significa para o dinheiro', // MT
    de: 'für das Geld bedeutet', // MT
    fr: 'signifie pour l’argent', // MT
  },
  stages_blurb_b: {
    en: ' (weighted, committed, won, lost) is set here, per stage.',
    nl: ' (gewogen, toegezegd, gewonnen, verloren) stel je hier in, per fase.',
    es: ' (ponderado, comprometido, ganado, perdido) se define aquí, por etapa.', // MT
    pt: ' (ponderado, comprometido, ganho, perdido) é definido aqui, por etapa.', // MT
    de: ' (gewichtet, zugesagt, gewonnen, verloren) legst du hier fest, pro Phase.', // MT
    fr: ' (pondéré, engagé, gagné, perdu) se règle ici, par étape.', // MT
  },
  no_stages: {
    en: 'No stages visible. The Pipeline flow is seeded when Pulse is activated.',
    nl: 'Geen fases zichtbaar. De Pipeline-flow wordt aangemaakt zodra Pulse wordt geactiveerd.',
    es: 'No hay etapas visibles. El flow Pipeline se crea al activar Pulse.', // MT
    pt: 'Nenhuma etapa visível. O flow Pipeline é criado quando o Pulse é ativado.', // MT
    de: 'Keine Phasen sichtbar. Der Pipeline-Flow wird beim Aktivieren von Pulse angelegt.', // MT
    fr: 'Aucune étape visible. Le flow Pipeline est créé à l’activation de Pulse.', // MT
  },
  default_flow: {
    en: 'default flow',
    nl: 'standaardflow',
    es: 'flow predeterminado', // MT
    pt: 'flow padrão', // MT
    de: 'Standard-Flow', // MT
    fr: 'flow par défaut', // MT
  },
  default_prob_title: {
    en: 'Default probability on entering this stage',
    nl: 'Standaardkans bij binnenkomst in deze fase',
    es: 'Probabilidad predeterminada al entrar en esta etapa', // MT
    pt: 'Probabilidade padrão ao entrar nesta etapa', // MT
    de: 'Standardwahrscheinlichkeit beim Eintritt in diese Phase', // MT
    fr: 'Probabilité par défaut à l’entrée dans cette étape', // MT
  },
  change_kind_title: {
    en: 'Change what this stage means for the projection',
    nl: 'Wijzig wat deze fase betekent voor de projectie',
    es: 'Cambia lo que esta etapa significa para la proyección', // MT
    pt: 'Mude o que esta etapa significa para a projeção', // MT
    de: 'Ändere, was diese Phase für die Projektion bedeutet', // MT
    fr: 'Change ce que cette étape signifie pour la projection', // MT
  },
  kind_open: {
    en: 'Open — weighted by probability',
    nl: 'Open — gewogen naar kans',
    es: 'Abierta — ponderada por probabilidad', // MT
    pt: 'Aberta — ponderada por probabilidade', // MT
    de: 'Offen — nach Wahrscheinlichkeit gewichtet', // MT
    fr: 'Ouverte — pondérée par la probabilité', // MT
  },
  kind_committed: {
    en: 'Committed — counts in full',
    nl: 'Toegezegd — telt volledig mee',
    es: 'Comprometida — cuenta al completo', // MT
    pt: 'Comprometida — conta por inteiro', // MT
    de: 'Zugesagt — zählt voll', // MT
    fr: 'Engagée — compte en entier', // MT
  },
  kind_won: {
    en: 'Won — done',
    nl: 'Gewonnen — afgerond',
    es: 'Ganada — hecho', // MT
    pt: 'Ganha — concluído', // MT
    de: 'Gewonnen — erledigt', // MT
    fr: 'Gagnée — terminé', // MT
  },
  kind_lost: {
    en: 'Lost — excluded',
    nl: 'Verloren — uitgesloten',
    es: 'Perdida — excluida', // MT
    pt: 'Perdida — excluída', // MT
    de: 'Verloren — ausgeschlossen', // MT
    fr: 'Perdue — exclue', // MT
  },
  kind_open_badge: {
    en: 'open',
    nl: 'open',
    es: 'abierta', // MT
    pt: 'aberta', // MT
    de: 'offen', // MT
    fr: 'ouverte', // MT
  },
  kind_committed_badge: {
    en: 'committed',
    nl: 'toegezegd',
    es: 'comprometida', // MT
    pt: 'comprometida', // MT
    de: 'zugesagt', // MT
    fr: 'engagée', // MT
  },
  kind_won_badge: {
    en: 'won',
    nl: 'gewonnen',
    es: 'ganada', // MT
    pt: 'ganha', // MT
    de: 'gewonnen', // MT
    fr: 'gagnée', // MT
  },
  kind_lost_badge: {
    en: 'lost',
    nl: 'verloren',
    es: 'perdida', // MT
    pt: 'perdida', // MT
    de: 'verloren', // MT
    fr: 'perdue', // MT
  },
  money_semantics_title: {
    en: '{stage} — money semantics',
    nl: '{stage} — geldbetekenis',
    es: '{stage} — semántica del dinero', // MT
    pt: '{stage} — semântica do dinheiro', // MT
    de: '{stage} — Geldsemantik', // MT
    fr: '{stage} — sémantique de l’argent', // MT
  },
  how_money_counts: {
    en: 'How does money at this stage count?',
    nl: 'Hoe telt geld in deze fase mee?',
    es: '¿Cómo cuenta el dinero en esta etapa?', // MT
    pt: 'Como o dinheiro conta nesta etapa?', // MT
    de: 'Wie zählt Geld in dieser Phase?', // MT
    fr: 'Comment l’argent compte-t-il à cette étape ?', // MT
  },
  stages_sync_hint: {
    en: 'Terminal steps of the flow (positive/negative ends) are re-imposed as won/lost on the next sync. Rename or reorder the stage itself in Flow.',
    nl: 'Eindstappen van de flow (positieve/negatieve eindes) worden bij de volgende synchronisatie weer als gewonnen/verloren gezet. Hernoem of herschik de fase zelf in Flow.',
    es: 'Los pasos terminales del flow (finales positivos/negativos) se reimponen como ganada/perdida en la próxima sincronización. Renombra o reordena la etapa en Flow.', // MT
    pt: 'Passos terminais do flow (fins positivos/negativos) são reimpostos como ganha/perdida na próxima sincronização. Renomeie ou reordene a etapa no Flow.', // MT
    de: 'Endschritte des Flows (positive/negative Enden) werden beim nächsten Sync wieder als gewonnen/verloren gesetzt. Umbenennen oder umsortieren der Phase geht in Flow.', // MT
    fr: 'Les étapes terminales du flow (fins positives/négatives) sont réimposées comme gagnée/perdue à la prochaine synchro. Renomme ou réordonne l’étape dans Flow.', // MT
  },
  default_probability_pct: {
    en: 'Default probability %',
    nl: 'Standaardkans %',
    es: 'Probabilidad predeterminada %', // MT
    pt: 'Probabilidade padrão %', // MT
    de: 'Standardwahrscheinlichkeit %', // MT
    fr: 'Probabilité par défaut %', // MT
  },
  prob_none_ph: {
    en: 'none',
    nl: 'geen',
    es: 'ninguna', // MT
    pt: 'nenhuma', // MT
    de: 'keine', // MT
    fr: 'aucune', // MT
  },
  prob_range_error: {
    en: 'Default probability must be between 0 and 100 (or empty for none).',
    nl: 'De standaardkans moet tussen 0 en 100 liggen (of leeg voor geen).',
    es: 'La probabilidad predeterminada debe estar entre 0 y 100 (o vacía para ninguna).', // MT
    pt: 'A probabilidade padrão deve ficar entre 0 e 100 (ou vazia para nenhuma).', // MT
    de: 'Die Standardwahrscheinlichkeit muss zwischen 0 und 100 liegen (oder leer für keine).', // MT
    fr: 'La probabilité par défaut doit être entre 0 et 100 (ou vide pour aucune).', // MT
  },
  prob_committed_hint: {
    en: 'Committed and won money always counts in full (100%).',
    nl: 'Toegezegd en gewonnen geld telt altijd volledig mee (100%).',
    es: 'El dinero comprometido y ganado siempre cuenta al completo (100%).', // MT
    pt: 'Dinheiro comprometido e ganho sempre conta por inteiro (100%).', // MT
    de: 'Zugesagtes und gewonnenes Geld zählt immer voll (100%).', // MT
    fr: 'L’argent engagé et gagné compte toujours en entier (100 %).', // MT
  },
  prob_open_hint: {
    en: 'Rows moved into this stage take this probability. Empty = keep whatever the row had.',
    nl: 'Regels die naar deze fase gaan, krijgen deze kans. Leeg = houden wat de regel had.',
    es: 'Las líneas movidas a esta etapa toman esta probabilidad. Vacío = mantener la que tenían.', // MT
    pt: 'Linhas movidas para esta etapa assumem esta probabilidade. Vazio = manter a que a linha tinha.', // MT
    de: 'Zeilen, die in diese Phase wandern, übernehmen diese Wahrscheinlichkeit. Leer = behalten, was die Zeile hatte.', // MT
    fr: 'Les lignes déplacées vers cette étape prennent cette probabilité. Vide = garder celle qu’elles avaient.', // MT
  },

  // ── offerings card ────────────────────────────────────────────────────
  offerings: {
    en: 'Offerings',
    nl: 'Aanbod',
    es: 'Ofertas', // MT
    pt: 'Ofertas', // MT
    de: 'Angebote', // MT
    fr: 'Offres', // MT
  },
  new_offering: {
    en: 'New offering',
    nl: 'Nieuw aanbod',
    es: 'Nueva oferta', // MT
    pt: 'Nova oferta', // MT
    de: 'Neues Angebot', // MT
    fr: 'Nouvelle offre', // MT
  },
  offerings_empty: {
    en: 'Nothing here yet. Offerings are what the workspace sells — programmes, retainers, workshops. Commitments link to them so the pipeline stays legible.',
    nl: 'Nog niets hier. Aanbod is wat de werkruimte verkoopt — programma’s, retainers, workshops. Deals verwijzen ernaar zodat de pipeline leesbaar blijft.',
    es: 'Aún no hay nada. Las ofertas son lo que vende el espacio de trabajo: programas, retainers, talleres. Los compromisos enlazan con ellas para que el pipeline siga legible.', // MT
    pt: 'Nada aqui ainda. Ofertas são o que o espaço de trabalho vende — programas, retainers, workshops. Compromissos apontam para elas, mantendo o pipeline legível.', // MT
    de: 'Noch nichts hier. Angebote sind, was der Workspace verkauft — Programme, Retainer, Workshops. Deals verweisen darauf, damit die Pipeline lesbar bleibt.', // MT
    fr: 'Rien ici pour l’instant. Les offres sont ce que vend l’espace de travail — programmes, forfaits, ateliers. Les engagements y renvoient pour garder le pipeline lisible.', // MT
  },
  edit_offering: {
    en: 'Edit offering',
    nl: 'Aanbod bewerken',
    es: 'Editar oferta', // MT
    pt: 'Editar oferta', // MT
    de: 'Angebot bearbeiten', // MT
    fr: 'Modifier l’offre', // MT
  },
  create_offering: {
    en: 'Create offering',
    nl: 'Aanbod aanmaken',
    es: 'Crear oferta', // MT
    pt: 'Criar oferta', // MT
    de: 'Angebot erstellen', // MT
    fr: 'Créer l’offre', // MT
  },
  default_amount_eur: {
    en: 'Default amount (€)',
    nl: 'Standaardbedrag (€)',
    es: 'Importe predeterminado (€)', // MT
    pt: 'Valor padrão (€)', // MT
    de: 'Standardbetrag (€)', // MT
    fr: 'Montant par défaut (€)', // MT
  },
  eg_leadership: {
    en: 'e.g. Leadership programme',
    nl: 'bijv. Leiderschapsprogramma',
    es: 'p. ej. Programa de liderazgo', // MT
    pt: 'p. ex. Programa de liderança', // MT
    de: 'z. B. Leadership-Programm', // MT
    fr: 'p. ex. Programme de leadership', // MT
  },
  eg_training: {
    en: 'e.g. Training',
    nl: 'bijv. Training',
    es: 'p. ej. Formación', // MT
    pt: 'p. ex. Treinamento', // MT
    de: 'z. B. Training', // MT
    fr: 'p. ex. Formation', // MT
  },
  amount_optional_ph: {
    en: 'Optional, e.g. 1250.50',
    nl: 'Optioneel, bijv. 1250,50',
    es: 'Opcional, p. ej. 1250,50', // MT
    pt: 'Opcional, p. ex. 1250,50', // MT
    de: 'Optional, z. B. 1250,50', // MT
    fr: 'Facultatif, p. ex. 1250,50', // MT
  },
  amount_number_error: {
    en: 'Default amount must be a number (e.g. 1250.50).',
    nl: 'Het standaardbedrag moet een getal zijn (bijv. 1250,50).',
    es: 'El importe predeterminado debe ser un número (p. ej. 1250,50).', // MT
    pt: 'O valor padrão deve ser um número (p. ex. 1250,50).', // MT
    de: 'Der Standardbetrag muss eine Zahl sein (z. B. 1250,50).', // MT
    fr: 'Le montant par défaut doit être un nombre (p. ex. 1250,50).', // MT
  },

  // ── teams card + teams page ───────────────────────────────────────────
  teams_involved: {
    en: 'Teams involved',
    nl: 'Betrokken teams',
    es: 'Equipos implicados', // MT
    pt: 'Equipes envolvidas', // MT
    de: 'Beteiligte Teams', // MT
    fr: 'Équipes impliquées', // MT
  },
  add_team: {
    en: 'Add team',
    nl: 'Team toevoegen',
    es: 'Añadir equipo', // MT
    pt: 'Adicionar equipe', // MT
    de: 'Team hinzufügen', // MT
    fr: 'Ajouter une équipe', // MT
  },
  no_involved_teams: {
    en: 'No teams take part in the planner yet. Involved teams act as hubs / incubators — their projects and pipelines roll up on the Teams & projects page.',
    nl: 'Nog geen teams doen mee in de planner. Betrokken teams werken als hubs / incubators — hun projecten en pipelines komen samen op de pagina Teams & projecten.',
    es: 'Aún no participa ningún equipo en el planificador. Los equipos implicados actúan como hubs / incubadoras: sus proyectos y pipelines se agrupan en la página Equipos y proyectos.', // MT
    pt: 'Nenhuma equipe participa do planejador ainda. Equipes envolvidas atuam como hubs / incubadoras — seus projetos e pipelines se agrupam na página Equipes e projetos.', // MT
    de: 'Noch keine Teams im Planer. Beteiligte Teams wirken als Hubs / Inkubatoren — ihre Projekte und Pipelines laufen auf der Seite Teams & Projekte zusammen.', // MT
    fr: 'Aucune équipe ne participe encore au planificateur. Les équipes impliquées servent de hubs / incubateurs — leurs projets et pipelines se retrouvent sur la page Équipes et projets.', // MT
  },
  remove_team_note: {
    en: 'Removing a team only takes it out of the planner — the team itself is untouched.',
    nl: 'Een team verwijderen haalt het alleen uit de planner — het team zelf blijft onaangeroerd.',
    es: 'Quitar un equipo solo lo saca del planificador; el equipo en sí queda intacto.', // MT
    pt: 'Remover uma equipe só a tira do planejador — a equipe em si fica intacta.', // MT
    de: 'Ein Team zu entfernen nimmt es nur aus dem Planer — das Team selbst bleibt unberührt.', // MT
    fr: 'Retirer une équipe ne fait que la sortir du planificateur — l’équipe elle-même reste intacte.', // MT
  },
  pick_team_error: {
    en: 'Pick a team to add.',
    nl: 'Kies een team om toe te voegen.',
    es: 'Elige un equipo para añadir.', // MT
    pt: 'Escolha uma equipe para adicionar.', // MT
    de: 'Wähle ein Team zum Hinzufügen.', // MT
    fr: 'Choisis une équipe à ajouter.', // MT
  },
  all_teams_involved: {
    en: 'Every workspace team is already involved in the planner.',
    nl: 'Elk team in de werkruimte doet al mee in de planner.',
    es: 'Todos los equipos del espacio de trabajo ya participan en el planificador.', // MT
    pt: 'Toda equipe do espaço de trabalho já participa do planejador.', // MT
    de: 'Jedes Workspace-Team ist bereits im Planer.', // MT
    fr: 'Toutes les équipes de l’espace de travail participent déjà au planificateur.', // MT
  },
  choose_team_ph: {
    en: 'Choose a team…',
    nl: 'Kies een team…',
    es: 'Elige un equipo…', // MT
    pt: 'Escolha uma equipe…', // MT
    de: 'Team wählen…', // MT
    fr: 'Choisis une équipe…', // MT
  },
  member_count_one: {
    en: '1 member',
    nl: '1 lid',
    es: '1 miembro', // MT
    pt: '1 membro', // MT
    de: '1 Mitglied', // MT
    fr: '1 membre', // MT
  },
  member_count_many: {
    en: '{n} members',
    nl: '{n} leden',
    es: '{n} miembros', // MT
    pt: '{n} membros', // MT
    de: '{n} Mitglieder', // MT
    fr: '{n} membres', // MT
  },
  teams: {
    en: 'Teams',
    nl: 'Teams',
    es: 'Equipos', // MT
    pt: 'Equipes', // MT
    de: 'Teams', // MT
    fr: 'Équipes', // MT
  },
  new_team: {
    en: 'New team',
    nl: 'Nieuw team',
    es: 'Nuevo equipo', // MT
    pt: 'Nova equipe', // MT
    de: 'Neues Team', // MT
    fr: 'Nouvelle équipe', // MT
  },
  no_teams_yet: {
    en: 'No teams in this workspace yet — create the first one; it joins the planner and gets its own cashflow tab.',
    nl: 'Nog geen teams in deze werkruimte — maak het eerste aan; het doet mee in de planner en krijgt een eigen cashflow-tabblad.',
    es: 'Aún no hay equipos en este espacio de trabajo. Crea el primero: se une al planificador y recibe su propia pestaña de flujo de caja.', // MT
    pt: 'Ainda não há equipes neste espaço de trabalho — crie a primeira; ela entra no planejador e ganha sua própria aba de fluxo de caixa.', // MT
    de: 'Noch keine Teams in diesem Workspace — lege das erste an; es kommt in den Planer und bekommt einen eigenen Cashflow-Tab.', // MT
    fr: 'Pas encore d’équipes dans cet espace de travail — crée la première ; elle rejoint le planificateur et reçoit son propre onglet de trésorerie.', // MT
  },
  open_cashflow: {
    en: 'Open cashflow',
    nl: 'Cashflow openen',
    es: 'Abrir flujo de caja', // MT
    pt: 'Abrir fluxo de caixa', // MT
    de: 'Cashflow öffnen', // MT
    fr: 'Ouvrir la trésorerie', // MT
  },
  in_planner: {
    en: 'In the planner',
    nl: 'In de planner',
    es: 'En el planificador', // MT
    pt: 'No planejador', // MT
    de: 'Im Planer', // MT
    fr: 'Dans le planificateur', // MT
  },
  not_involved: {
    en: 'Not involved',
    nl: 'Niet betrokken',
    es: 'No participa', // MT
    pt: 'Não participa', // MT
    de: 'Nicht beteiligt', // MT
    fr: 'Non impliquée', // MT
  },
  new_team_desc: {
    en: 'A Fibre platform team — usable in every app. It joins the planner right away (own cashflow tab, bank, reservations).',
    nl: 'Een team op het Fibre-platform — bruikbaar in elke app. Het doet direct mee in de planner (eigen cashflow-tabblad, bank, reserveringen).',
    es: 'Un equipo de la plataforma Fibre, usable en todas las apps. Se une al planificador de inmediato (pestaña de flujo de caja, banco y reservas propios).', // MT
    pt: 'Uma equipe da plataforma Fibre — usável em todo app. Ela entra no planejador na hora (aba de fluxo de caixa, banco e reservas próprios).', // MT
    de: 'Ein Team der Fibre-Plattform — nutzbar in jeder App. Es kommt sofort in den Planer (eigener Cashflow-Tab, Bank, Reservierungen).', // MT
    fr: 'Une équipe de la plateforme Fibre — utilisable dans chaque app. Elle rejoint aussitôt le planificateur (onglet de trésorerie, banque et réserves propres).', // MT
  },
  create_team: {
    en: 'Create team',
    nl: 'Team aanmaken',
    es: 'Crear equipo', // MT
    pt: 'Criar equipe', // MT
    de: 'Team erstellen', // MT
    fr: 'Créer l’équipe', // MT
  },
  eg_incubator_rotterdam: {
    en: 'e.g. Incubator Rotterdam',
    nl: 'bijv. Incubator Rotterdam',
    es: 'p. ej. Incubadora Róterdam', // MT
    pt: 'p. ex. Incubadora Roterdã', // MT
    de: 'z. B. Inkubator Rotterdam', // MT
    fr: 'p. ex. Incubateur Rotterdam', // MT
  },

  // ── payments settings ─────────────────────────────────────────────────
  payments: {
    en: 'Payments',
    nl: 'Betalingen',
    es: 'Pagos', // MT
    pt: 'Pagamentos', // MT
    de: 'Zahlungen', // MT
    fr: 'Paiements', // MT
  },
  payments_blurb: {
    en: "One set of payment settings for all Fibre apps — your personal account and the workspace's, plus your default payment options.",
    nl: 'Eén set betaalinstellingen voor alle Fibre-apps — je persoonlijke account en dat van de werkruimte, plus je standaard betaalopties.',
    es: 'Un solo conjunto de ajustes de pago para todas las apps de Fibre: tu cuenta personal y la del espacio de trabajo, más tus opciones de pago predeterminadas.', // MT
    pt: 'Um único conjunto de configurações de pagamento para todos os apps Fibre — sua conta pessoal e a do espaço de trabalho, mais suas opções de pagamento padrão.', // MT
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
    en: 'Payouts for your personal sales — one connection, every Fibre app uses it. The invoice details appear as the seller on receipts for your personal sales.',
    nl: 'Uitbetalingen voor je persoonlijke verkopen — één koppeling, elke Fibre-app gebruikt hem. De factuurgegevens verschijnen als verkoper op bonnen van je persoonlijke verkopen.',
    es: 'Cobros de tus ventas personales: una conexión, todas las apps de Fibre la usan. Los datos de facturación aparecen como vendedor en los recibos de tus ventas personales.', // MT
    pt: 'Repasses das suas vendas pessoais — uma conexão, todo app Fibre a usa. Os dados de fatura aparecem como vendedor nos recibos das suas vendas pessoais.', // MT
    de: 'Auszahlungen für deine persönlichen Verkäufe — eine Verbindung, jede Fibre-App nutzt sie. Die Rechnungsdaten erscheinen als Verkäufer auf Belegen deiner persönlichen Verkäufe.', // MT
    fr: 'Les versements de tes ventes personnelles — une seule connexion, chaque app Fibre l’utilise. Les coordonnées de facturation apparaissent comme vendeur sur les reçus de tes ventes personnelles.', // MT
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
    en: "Payouts for team sales and anything routed to the workspace. Teams don't hold their own accounts — team sales land here, with these invoice details as the seller.",
    nl: 'Uitbetalingen voor teamverkopen en alles wat naar de werkruimte gaat. Teams hebben geen eigen account — teamverkopen landen hier, met deze factuurgegevens als verkoper.',
    es: 'Cobros de ventas de equipo y de todo lo que va al espacio de trabajo. Los equipos no tienen cuentas propias: sus ventas aterrizan aquí, con estos datos de facturación como vendedor.', // MT
    pt: 'Repasses de vendas de equipe e de tudo roteado para o espaço de trabalho. Equipes não têm contas próprias — as vendas de equipe caem aqui, com estes dados de fatura como vendedor.', // MT
    de: 'Auszahlungen für Team-Verkäufe und alles, was zum Workspace geleitet wird. Teams haben keine eigenen Konten — Team-Verkäufe landen hier, mit diesen Rechnungsdaten als Verkäufer.', // MT
    fr: 'Les versements des ventes d’équipe et de tout ce qui est routé vers l’espace de travail. Les équipes n’ont pas de comptes propres — leurs ventes atterrissent ici, avec ces coordonnées de facturation comme vendeur.', // MT
  },
  acct_hint_1: {
    en: 'The Stripe account id starts with',
    nl: 'Het Stripe-account-id begint met',
    es: 'El id de la cuenta de Stripe empieza por', // MT
    pt: 'O id da conta Stripe começa com', // MT
    de: 'Die Stripe-Konto-ID beginnt mit', // MT
    fr: 'L’identifiant de compte Stripe commence par', // MT
  },
  acct_hint_2: {
    en: '(Stripe → Settings → Account details). Leaving it empty disconnects. Payment options inherit downward: account default first, each app can override per item.',
    nl: '(Stripe → Settings → Account details). Leeg laten verbreekt de koppeling. Betaalopties erven naar beneden: eerst het account-standaard, elke app kan per item afwijken.',
    es: '(Stripe → Settings → Account details). Dejarlo vacío desconecta. Las opciones de pago se heredan hacia abajo: primero el valor de la cuenta, cada app puede anularlo por artículo.', // MT
    pt: '(Stripe → Settings → Account details). Deixar vazio desconecta. Opções de pagamento herdam para baixo: primeiro o padrão da conta; cada app pode sobrescrever por item.', // MT
    de: '(Stripe → Settings → Account details). Leer lassen trennt die Verbindung. Zahlungsoptionen vererben sich nach unten: erst der Konto-Standard, jede App kann pro Posten abweichen.', // MT
    fr: '(Stripe → Settings → Account details). Le laisser vide déconnecte. Les options de paiement s’héritent vers le bas : d’abord le défaut du compte, chaque app peut déroger par article.', // MT
  },
  connected: {
    en: 'Connected',
    nl: 'Gekoppeld',
    es: 'Conectada', // MT
    pt: 'Conectada', // MT
    de: 'Verbunden', // MT
    fr: 'Connecté', // MT
  },
  not_connected: {
    en: 'Not connected',
    nl: 'Niet gekoppeld',
    es: 'Sin conectar', // MT
    pt: 'Não conectada', // MT
    de: 'Nicht verbunden', // MT
    fr: 'Non connecté', // MT
  },
  managed_by_admins: {
    en: 'Managed by workspace admins.',
    nl: 'Beheerd door werkruimte-admins.',
    es: 'Gestionado por los admins del espacio de trabajo.', // MT
    pt: 'Gerenciado pelos admins do espaço de trabalho.', // MT
    de: 'Verwaltet von Workspace-Admins.', // MT
    fr: 'Géré par les admins de l’espace de travail.', // MT
  },
  stripe_account_id: {
    en: 'Stripe account id',
    nl: 'Stripe-account-id',
    es: 'Id de la cuenta de Stripe', // MT
    pt: 'Id da conta Stripe', // MT
    de: 'Stripe-Konto-ID', // MT
    fr: 'Identifiant de compte Stripe', // MT
  },
  legal_name_invoices: {
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
    pt: 'CNPJ / número de IVA', // MT
    de: 'Steuer-/USt-Nummer', // MT
    fr: 'Numéro fiscal / TVA', // MT
  },
  address_invoices: {
    en: 'Address (on invoices)',
    nl: 'Adres (op facturen)',
    es: 'Dirección (en facturas)', // MT
    pt: 'Endereço (nas faturas)', // MT
    de: 'Adresse (auf Rechnungen)', // MT
    fr: 'Adresse (sur les factures)', // MT
  },
  default_payment_options: {
    en: 'Default payment options —',
    nl: 'Standaard betaalopties —',
    es: 'Opciones de pago predeterminadas:', // MT
    pt: 'Opções de pagamento padrão —', // MT
    de: 'Standard-Zahlungsoptionen —', // MT
    fr: 'Options de paiement par défaut —', // MT
  },
  methods_hint_personal: {
    en: 'your personal sales inherit these',
    nl: 'je persoonlijke verkopen erven deze',
    es: 'tus ventas personales las heredan', // MT
    pt: 'suas vendas pessoais herdam estas', // MT
    de: 'deine persönlichen Verkäufe erben diese', // MT
    fr: 'tes ventes personnelles en héritent', // MT
  },
  methods_hint_ws: {
    en: 'team & workspace sales inherit these',
    nl: 'team- en werkruimteverkopen erven deze',
    es: 'las ventas de equipo y del espacio de trabajo las heredan', // MT
    pt: 'vendas de equipe e do espaço de trabalho herdam estas', // MT
    de: 'Team- & Workspace-Verkäufe erben diese', // MT
    fr: 'les ventes d’équipe et de l’espace de travail en héritent', // MT
  },
  pay_online_card: {
    en: 'Pay online (card)',
    nl: 'Online betalen (kaart)',
    es: 'Pagar en línea (tarjeta)', // MT
    pt: 'Pagar on-line (cartão)', // MT
    de: 'Online zahlen (Karte)', // MT
    fr: 'Payer en ligne (carte)', // MT
  },
  pay_per_invoice: {
    en: 'Pay per invoice',
    nl: 'Betalen per factuur',
    es: 'Pagar por factura', // MT
    pt: 'Pagar por fatura', // MT
    de: 'Per Rechnung zahlen', // MT
    fr: 'Payer sur facture', // MT
  },
  acct_starts_error: {
    en: 'A Stripe account id starts with acct_',
    nl: 'Een Stripe-account-id begint met acct_',
    es: 'Un id de cuenta de Stripe empieza por acct_', // MT
    pt: 'Um id de conta Stripe começa com acct_', // MT
    de: 'Eine Stripe-Konto-ID beginnt mit acct_', // MT
    fr: 'Un identifiant de compte Stripe commence par acct_', // MT
  },
  keep_one_method_error: {
    en: 'Keep at least one payment option on.',
    nl: 'Houd minstens één betaaloptie aan.',
    es: 'Mantén al menos una opción de pago activada.', // MT
    pt: 'Mantenha pelo menos uma opção de pagamento ativa.', // MT
    de: 'Lass mindestens eine Zahlungsoption an.', // MT
    fr: 'Garde au moins une option de paiement activée.', // MT
  },

  // ── projects ──────────────────────────────────────────────────────────
  projects: {
    en: 'Projects',
    nl: 'Projecten',
    es: 'Proyectos', // MT
    pt: 'Projetos', // MT
    de: 'Projekte', // MT
    fr: 'Projets', // MT
  },
  new_project: {
    en: 'New project',
    nl: 'Nieuw project',
    es: 'Nuevo proyecto', // MT
    pt: 'Novo projeto', // MT
    de: 'Neues Projekt', // MT
    fr: 'Nouveau projet', // MT
  },
  no_teams_projects_empty: {
    en: 'No teams involved yet. Pick the teams that act as hubs or incubators in Settings — projects and their pipelines roll up here.',
    nl: 'Nog geen betrokken teams. Kies in Instellingen de teams die als hubs of incubators werken — projecten en hun pipelines komen hier samen.',
    es: 'Aún no hay equipos implicados. Elige en Ajustes los equipos que actúan como hubs o incubadoras: los proyectos y sus pipelines se agrupan aquí.', // MT
    pt: 'Nenhuma equipe envolvida ainda. Escolha nas Configurações as equipes que atuam como hubs ou incubadoras — projetos e seus pipelines se agrupam aqui.', // MT
    de: 'Noch keine beteiligten Teams. Wähle in den Einstellungen die Teams, die als Hubs oder Inkubatoren wirken — Projekte und ihre Pipelines laufen hier zusammen.', // MT
    fr: 'Pas encore d’équipes impliquées. Choisis dans Paramètres les équipes qui servent de hubs ou d’incubateurs — les projets et leurs pipelines se retrouvent ici.', // MT
  },
  free_standing_projects: {
    en: 'Free-standing projects',
    nl: 'Losstaande projecten',
    es: 'Proyectos independientes', // MT
    pt: 'Projetos independentes', // MT
    de: 'Freistehende Projekte', // MT
    fr: 'Projets autonomes', // MT
  },
  no_projects_yet: {
    en: 'No projects yet.',
    nl: 'Nog geen projecten.',
    es: 'Aún no hay proyectos.', // MT
    pt: 'Ainda não há projetos.', // MT
    de: 'Noch keine Projekte.', // MT
    fr: 'Pas encore de projets.', // MT
  },
  edit_project: {
    en: 'Edit project',
    nl: 'Project bewerken',
    es: 'Editar proyecto', // MT
    pt: 'Editar projeto', // MT
    de: 'Projekt bearbeiten', // MT
    fr: 'Modifier le projet', // MT
  },
  free_standing: {
    en: 'Free-standing',
    nl: 'Losstaand',
    es: 'Independiente', // MT
    pt: 'Independente', // MT
    de: 'Freistehend', // MT
    fr: 'Autonome', // MT
  },
  hubs_hint: {
    en: 'Hubs and incubators are Fibre teams; pick which take part in Settings.',
    nl: 'Hubs en incubators zijn Fibre-teams; kies in Instellingen welke meedoen.',
    es: 'Los hubs e incubadoras son equipos de Fibre; elige en Ajustes cuáles participan.', // MT
    pt: 'Hubs e incubadoras são equipes Fibre; escolha nas Configurações quais participam.', // MT
    de: 'Hubs und Inkubatoren sind Fibre-Teams; wähle in den Einstellungen, welche mitmachen.', // MT
    fr: 'Les hubs et incubateurs sont des équipes Fibre ; choisis dans Paramètres lesquelles participent.', // MT
  },
  eg_incubator_cohort: {
    en: 'e.g. Incubator cohort 3',
    nl: 'bijv. Incubator-cohort 3',
    es: 'p. ej. Cohorte 3 de la incubadora', // MT
    pt: 'p. ex. Turma 3 da incubadora', // MT
    de: 'z. B. Inkubator-Kohorte 3', // MT
    fr: 'p. ex. Cohorte 3 de l’incubateur', // MT
  },

  // ── budget ────────────────────────────────────────────────────────────
  budget: {
    en: 'Budget',
    nl: 'Budget',
    es: 'Presupuesto', // MT
    pt: 'Orçamento', // MT
    de: 'Budget', // MT
    fr: 'Budget', // MT
  },
  new_line: {
    en: 'New line',
    nl: 'Nieuwe regel',
    es: 'Nueva línea', // MT
    pt: 'Nova linha', // MT
    de: 'Neue Zeile', // MT
    fr: 'Nouvelle ligne', // MT
  },
  budget_empty: {
    en: 'No budget lines yet. Add your recurring income and costs — they expand into the projection automatically.',
    nl: 'Nog geen budgetregels. Voeg je terugkerende inkomsten en kosten toe — ze rollen automatisch de projectie in.',
    es: 'Aún no hay líneas de presupuesto. Añade tus ingresos y costos recurrentes: se expanden solos en la proyección.', // MT
    pt: 'Ainda não há linhas de orçamento. Adicione suas receitas e custos recorrentes — eles se expandem sozinhos na projeção.', // MT
    de: 'Noch keine Budgetzeilen. Füge deine wiederkehrenden Einnahmen und Kosten hinzu — sie fließen automatisch in die Projektion.', // MT
    fr: 'Pas encore de lignes de budget. Ajoute tes revenus et coûts récurrents — ils s’étendent automatiquement dans la projection.', // MT
  },
  uncategorised: {
    en: 'Uncategorised',
    nl: 'Zonder categorie',
    es: 'Sin categoría', // MT
    pt: 'Sem categoria', // MT
    de: 'Ohne Kategorie', // MT
    fr: 'Sans catégorie', // MT
  },
  edit_budget_line: {
    en: 'Edit budget line',
    nl: 'Budgetregel bewerken',
    es: 'Editar línea de presupuesto', // MT
    pt: 'Editar linha de orçamento', // MT
    de: 'Budgetzeile bearbeiten', // MT
    fr: 'Modifier la ligne de budget', // MT
  },
  new_budget_line: {
    en: 'New budget line',
    nl: 'Nieuwe budgetregel',
    es: 'Nueva línea de presupuesto', // MT
    pt: 'Nova linha de orçamento', // MT
    de: 'Neue Budgetzeile', // MT
    fr: 'Nouvelle ligne de budget', // MT
  },
  create_line: {
    en: 'Create line',
    nl: 'Regel aanmaken',
    es: 'Crear línea', // MT
    pt: 'Criar linha', // MT
    de: 'Zeile erstellen', // MT
    fr: 'Créer la ligne', // MT
  },
  direction: {
    en: 'Direction',
    nl: 'Richting',
    es: 'Dirección', // MT
    pt: 'Direção', // MT
    de: 'Richtung', // MT
    fr: 'Sens', // MT
  },
  out_cost: {
    en: 'Out (cost)',
    nl: 'Uit (kosten)',
    es: 'Sale (costo)', // MT
    pt: 'Sai (custo)', // MT
    de: 'Aus (Kosten)', // MT
    fr: 'Sortie (coût)', // MT
  },
  in_income: {
    en: 'In (income)',
    nl: 'In (inkomsten)',
    es: 'Entra (ingreso)', // MT
    pt: 'Entra (receita)', // MT
    de: 'Ein (Einnahme)', // MT
    fr: 'Entrée (revenu)', // MT
  },
  amount: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Valor', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  cadence: {
    en: 'Cadence',
    nl: 'Ritme',
    es: 'Cadencia', // MT
    pt: 'Cadência', // MT
    de: 'Rhythmus', // MT
    fr: 'Cadence', // MT
  },
  cadence_weekly: {
    en: 'weekly',
    nl: 'wekelijks',
    es: 'semanal', // MT
    pt: 'semanal', // MT
    de: 'wöchentlich', // MT
    fr: 'hebdomadaire', // MT
  },
  cadence_fortnightly: {
    en: 'fortnightly',
    nl: 'tweewekelijks',
    es: 'quincenal', // MT
    pt: 'quinzenal', // MT
    de: 'zweiwöchentlich', // MT
    fr: 'bimensuel', // MT
  },
  cadence_monthly: {
    en: 'monthly',
    nl: 'maandelijks',
    es: 'mensual', // MT
    pt: 'mensal', // MT
    de: 'monatlich', // MT
    fr: 'mensuel', // MT
  },
  cadence_quarterly: {
    en: 'quarterly',
    nl: 'per kwartaal',
    es: 'trimestral', // MT
    pt: 'trimestral', // MT
    de: 'vierteljährlich', // MT
    fr: 'trimestriel', // MT
  },
  cadence_yearly: {
    en: 'yearly',
    nl: 'jaarlijks',
    es: 'anual', // MT
    pt: 'anual', // MT
    de: 'jährlich', // MT
    fr: 'annuel', // MT
  },
  cadence_weekly_cap: {
    en: 'Weekly',
    nl: 'Wekelijks',
    es: 'Semanal', // MT
    pt: 'Semanal', // MT
    de: 'Wöchentlich', // MT
    fr: 'Hebdomadaire', // MT
  },
  cadence_fortnightly_cap: {
    en: 'Fortnightly',
    nl: 'Tweewekelijks',
    es: 'Quincenal', // MT
    pt: 'Quinzenal', // MT
    de: 'Zweiwöchentlich', // MT
    fr: 'Bimensuel', // MT
  },
  cadence_monthly_cap: {
    en: 'Monthly',
    nl: 'Maandelijks',
    es: 'Mensual', // MT
    pt: 'Mensal', // MT
    de: 'Monatlich', // MT
    fr: 'Mensuel', // MT
  },
  cadence_quarterly_cap: {
    en: 'Quarterly',
    nl: 'Per kwartaal',
    es: 'Trimestral', // MT
    pt: 'Trimestral', // MT
    de: 'Vierteljährlich', // MT
    fr: 'Trimestriel', // MT
  },
  cadence_yearly_cap: {
    en: 'Yearly',
    nl: 'Jaarlijks',
    es: 'Anual', // MT
    pt: 'Anual', // MT
    de: 'Jährlich', // MT
    fr: 'Annuel', // MT
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
  owner: {
    en: 'Owner',
    nl: 'Eigenaar',
    es: 'Responsable', // MT
    pt: 'Responsável', // MT
    de: 'Verantwortlich', // MT
    fr: 'Responsable', // MT
  },
  nobody_dash: {
    en: '— nobody —',
    nl: '— niemand —',
    es: '— nadie —', // MT
    pt: '— ninguém —', // MT
    de: '— niemand —', // MT
    fr: '— personne —', // MT
  },
  included_in_projection: {
    en: 'Included in the projection',
    nl: 'Meegenomen in de projectie',
    es: 'Incluida en la proyección', // MT
    pt: 'Incluída na projeção', // MT
    de: 'In der Projektion enthalten', // MT
    fr: 'Incluse dans la projection', // MT
  },
  included_hint: {
    en: 'Toggled-off lines stay here, out of the numbers.',
    nl: 'Uitgeschakelde regels blijven hier staan, buiten de cijfers.',
    es: 'Las líneas desactivadas se quedan aquí, fuera de los números.', // MT
    pt: 'Linhas desativadas ficam aqui, fora dos números.', // MT
    de: 'Abgeschaltete Zeilen bleiben hier, außerhalb der Zahlen.', // MT
    fr: 'Les lignes désactivées restent ici, hors des chiffres.', // MT
  },
  amount_required_error: {
    en: 'Amount is required — euros, e.g. 1250 or 49,95.',
    nl: 'Een bedrag is verplicht — euro’s, bijv. 1250 of 49,95.',
    es: 'El importe es obligatorio: euros, p. ej. 1250 o 49,95.', // MT
    pt: 'O valor é obrigatório — euros, p. ex. 1250 ou 49,95.', // MT
    de: 'Ein Betrag ist erforderlich — Euro, z. B. 1250 oder 49,95.', // MT
    fr: 'Le montant est obligatoire — en euros, p. ex. 1250 ou 49,95.', // MT
  },
  eg_office_rent: {
    en: 'e.g. Office rent',
    nl: 'bijv. Kantoorhuur',
    es: 'p. ej. Alquiler de oficina', // MT
    pt: 'p. ex. Aluguel do escritório', // MT
    de: 'z. B. Büromiete', // MT
    fr: 'p. ex. Loyer du bureau', // MT
  },
  eg_housing: {
    en: 'e.g. Housing',
    nl: 'bijv. Huisvesting',
    es: 'p. ej. Vivienda', // MT
    pt: 'p. ex. Moradia', // MT
    de: 'z. B. Unterkunft', // MT
    fr: 'p. ex. Logement', // MT
  },
  archive_budget_line_q: {
    en: 'Archive this budget line?',
    nl: 'Deze budgetregel archiveren?',
    es: '¿Archivar esta línea de presupuesto?', // MT
    pt: 'Arquivar esta linha de orçamento?', // MT
    de: 'Diese Budgetzeile archivieren?', // MT
    fr: 'Archiver cette ligne de budget ?', // MT
  },
  archive_budget_line_msg: {
    en: 'It disappears from the budget and the projection. Nothing is hard-deleted.',
    nl: 'Hij verdwijnt uit het budget en de projectie. Niets wordt definitief verwijderd.',
    es: 'Desaparece del presupuesto y de la proyección. Nada se borra definitivamente.', // MT
    pt: 'Ela some do orçamento e da projeção. Nada é excluído de vez.', // MT
    de: 'Sie verschwindet aus Budget und Projektion. Nichts wird endgültig gelöscht.', // MT
    fr: 'Elle disparaît du budget et de la projection. Rien n’est supprimé définitivement.', // MT
  },

  // ── accounts ──────────────────────────────────────────────────────────
  accounts: {
    en: 'Accounts',
    nl: 'Rekeningen',
    es: 'Cuentas', // MT
    pt: 'Contas', // MT
    de: 'Konten', // MT
    fr: 'Comptes', // MT
  },
  new_account: {
    en: 'New account',
    nl: 'Nieuwe rekening',
    es: 'Nueva cuenta', // MT
    pt: 'Nova conta', // MT
    de: 'Neues Konto', // MT
    fr: 'Nouveau compte', // MT
  },
  update_balances: {
    en: 'Update balances',
    nl: 'Saldi bijwerken',
    es: 'Actualizar saldos', // MT
    pt: 'Atualizar saldos', // MT
    de: 'Salden aktualisieren', // MT
    fr: 'Mettre à jour les soldes', // MT
  },
  accounts_empty: {
    en: 'No accounts yet. Add your bank accounts first, then reserves earmarked inside them.',
    nl: 'Nog geen rekeningen. Voeg eerst je bankrekeningen toe, en daarna reserves die daarbinnen geoormerkt zijn.',
    es: 'Aún no hay cuentas. Añade primero tus cuentas bancarias y luego las reservas asignadas dentro de ellas.', // MT
    pt: 'Ainda não há contas. Adicione primeiro suas contas bancárias, depois as reservas destinadas dentro delas.', // MT
    de: 'Noch keine Konten. Füge zuerst deine Bankkonten hinzu, dann darin zweckgebundene Rücklagen.', // MT
    fr: 'Pas encore de comptes. Ajoute d’abord tes comptes bancaires, puis les réserves fléchées à l’intérieur.', // MT
  },
  bank_accounts: {
    en: 'Bank accounts',
    nl: 'Bankrekeningen',
    es: 'Cuentas bancarias', // MT
    pt: 'Contas bancárias', // MT
    de: 'Bankkonten', // MT
    fr: 'Comptes bancaires', // MT
  },
  reserves: {
    en: 'Reserves',
    nl: 'Reserves',
    es: 'Reservas', // MT
    pt: 'Reservas', // MT
    de: 'Rücklagen', // MT
    fr: 'Réserves', // MT
  },
  as_of_date: {
    en: 'as of {d}',
    nl: 'per {d}',
    es: 'a {d}', // MT
    pt: 'em {d}', // MT
    de: 'Stand {d}', // MT
    fr: 'au {d}', // MT
  },
  no_balance_yet: {
    en: 'no balance yet',
    nl: 'nog geen saldo',
    es: 'aún sin saldo', // MT
    pt: 'ainda sem saldo', // MT
    de: 'noch kein Saldo', // MT
    fr: 'pas encore de solde', // MT
  },
  edit_account: {
    en: 'Edit account',
    nl: 'Rekening bewerken',
    es: 'Editar cuenta', // MT
    pt: 'Editar conta', // MT
    de: 'Konto bearbeiten', // MT
    fr: 'Modifier le compte', // MT
  },
  create_account: {
    en: 'Create account',
    nl: 'Rekening aanmaken',
    es: 'Crear cuenta', // MT
    pt: 'Criar conta', // MT
    de: 'Konto erstellen', // MT
    fr: 'Créer le compte', // MT
  },
  bank_account: {
    en: 'Bank account',
    nl: 'Bankrekening',
    es: 'Cuenta bancaria', // MT
    pt: 'Conta bancária', // MT
    de: 'Bankkonto', // MT
    fr: 'Compte bancaire', // MT
  },
  reserves_hint: {
    en: 'Reserves are earmarked money — in the bank, not yours to spend.',
    nl: 'Reserves zijn geoormerkt geld — op de bank, niet om uit te geven.',
    es: 'Las reservas son dinero asignado: en el banco, pero no para gastar.', // MT
    pt: 'Reservas são dinheiro destinado — no banco, mas não para gastar.', // MT
    de: 'Rücklagen sind zweckgebundenes Geld — auf der Bank, nicht zum Ausgeben.', // MT
    fr: 'Les réserves sont de l’argent fléché — en banque, mais pas à dépenser.', // MT
  },
  cashflow: {
    en: 'Cashflow',
    nl: 'Cashflow',
    es: 'Flujo de caja', // MT
    pt: 'Fluxo de caixa', // MT
    de: 'Cashflow', // MT
    fr: 'Trésorerie', // MT
  },
  me_personal: {
    en: 'Me (personal)',
    nl: 'Ik (persoonlijk)',
    es: 'Yo (personal)', // MT
    pt: 'Eu (pessoal)', // MT
    de: 'Ich (persönlich)', // MT
    fr: 'Moi (personnel)', // MT
  },
  personal_other_user: {
    en: 'Personal (another user)',
    nl: 'Persoonlijk (andere gebruiker)',
    es: 'Personal (otro usuario)', // MT
    pt: 'Pessoal (outro usuário)', // MT
    de: 'Persönlich (andere Person)', // MT
    fr: 'Personnel (autre utilisateur)', // MT
  },
  cashflow_scope_hint: {
    en: 'Which cashflow tab this account belongs to — its balance anchors that projection.',
    nl: 'Bij welk cashflow-tabblad deze rekening hoort — het saldo verankert die projectie.',
    es: 'A qué pestaña de flujo de caja pertenece esta cuenta: su saldo ancla esa proyección.', // MT
    pt: 'A qual aba de fluxo de caixa esta conta pertence — o saldo dela ancora essa projeção.', // MT
    de: 'Zu welchem Cashflow-Tab dieses Konto gehört — sein Saldo verankert diese Projektion.', // MT
    fr: 'À quel onglet de trésorerie ce compte appartient — son solde ancre cette projection.', // MT
  },
  held_in_bank: {
    en: 'Held in bank account',
    nl: 'Aangehouden op bankrekening',
    es: 'Guardada en la cuenta bancaria', // MT
    pt: 'Mantida na conta bancária', // MT
    de: 'Geführt auf Bankkonto', // MT
    fr: 'Détenue sur le compte bancaire', // MT
  },
  eg_rabobank: {
    en: 'e.g. Rabobank current',
    nl: 'bijv. Rabobank betaalrekening',
    es: 'p. ej. Cuenta corriente Rabobank', // MT
    pt: 'p. ex. Conta corrente Rabobank', // MT
    de: 'z. B. Rabobank Girokonto', // MT
    fr: 'p. ex. Compte courant Rabobank', // MT
  },
  archive_account_q: {
    en: 'Archive this account?',
    nl: 'Deze rekening archiveren?',
    es: '¿Archivar esta cuenta?', // MT
    pt: 'Arquivar esta conta?', // MT
    de: 'Dieses Konto archivieren?', // MT
    fr: 'Archiver ce compte ?', // MT
  },
  archive_account_msg: {
    en: 'The account disappears from lists and the projection. Its balance history is kept.',
    nl: 'De rekening verdwijnt uit lijsten en de projectie. De saldogeschiedenis blijft bewaard.',
    es: 'La cuenta desaparece de las listas y la proyección. Su historial de saldos se conserva.', // MT
    pt: 'A conta some das listas e da projeção. O histórico de saldos é mantido.', // MT
    de: 'Das Konto verschwindet aus Listen und Projektion. Die Saldo-Historie bleibt erhalten.', // MT
    fr: 'Le compte disparaît des listes et de la projection. Son historique de soldes est conservé.', // MT
  },
  update_balances_desc: {
    en: 'Type what the bank says. Only rows you touch are saved.',
    nl: 'Typ wat de bank zegt. Alleen rijen die je aanraakt worden opgeslagen.',
    es: 'Escribe lo que dice el banco. Solo se guardan las filas que toques.', // MT
    pt: 'Digite o que o banco diz. Só as linhas que você tocar são salvas.', // MT
    de: 'Tippe, was die Bank sagt. Nur angefasste Zeilen werden gespeichert.', // MT
    fr: 'Tape ce que dit la banque. Seules les lignes que tu touches sont enregistrées.', // MT
  },
  save_balances: {
    en: 'Save balances',
    nl: 'Saldi opslaan',
    es: 'Guardar saldos', // MT
    pt: 'Salvar saldos', // MT
    de: 'Salden speichern', // MT
    fr: 'Enregistrer les soldes', // MT
  },
  as_of: {
    en: 'As of',
    nl: 'Per',
    es: 'A fecha de', // MT
    pt: 'Em', // MT
    de: 'Stand', // MT
    fr: 'Au', // MT
  },
  pick_asof_error: {
    en: 'Pick an as-of date.',
    nl: 'Kies een peildatum.',
    es: 'Elige una fecha de referencia.', // MT
    pt: 'Escolha uma data de referência.', // MT
    de: 'Wähle ein Stichdatum.', // MT
    fr: 'Choisis une date de référence.', // MT
  },
  invalid_amount_error: {
    en: '{name}: "{raw}" is not a valid amount.',
    nl: '{name}: "{raw}" is geen geldig bedrag.',
    es: '{name}: «{raw}» no es un importe válido.', // MT
    pt: '{name}: "{raw}" não é um valor válido.', // MT
    de: '{name}: „{raw}“ ist kein gültiger Betrag.', // MT
    fr: '{name} : « {raw} » n’est pas un montant valide.', // MT
  },
  nothing_to_save_error: {
    en: 'Nothing to save — change at least one balance first.',
    nl: 'Niets op te slaan — wijzig eerst minstens één saldo.',
    es: 'Nada que guardar: cambia al menos un saldo primero.', // MT
    pt: 'Nada para salvar — mude ao menos um saldo primeiro.', // MT
    de: 'Nichts zu speichern — ändere zuerst mindestens einen Saldo.', // MT
    fr: 'Rien à enregistrer — modifie d’abord au moins un solde.', // MT
  },
  last_date: {
    en: 'last: {d}',
    nl: 'laatst: {d}',
    es: 'último: {d}', // MT
    pt: 'último: {d}', // MT
    de: 'zuletzt: {d}', // MT
    fr: 'dernier : {d}', // MT
  },
  snapshots_kept: {
    en: 'Balances are recorded as snapshots; history is kept.',
    nl: 'Saldi worden als momentopnames vastgelegd; de geschiedenis blijft bewaard.',
    es: 'Los saldos se registran como instantáneas; el historial se conserva.', // MT
    pt: 'Saldos são registrados como retratos; o histórico é mantido.', // MT
    de: 'Salden werden als Momentaufnahmen erfasst; die Historie bleibt.', // MT
    fr: 'Les soldes sont enregistrés comme instantanés ; l’historique est conservé.', // MT
  },

  // ── invoices ──────────────────────────────────────────────────────────
  invoices: {
    en: 'Invoices',
    nl: 'Facturen',
    es: 'Facturas', // MT
    pt: 'Faturas', // MT
    de: 'Rechnungen', // MT
    fr: 'Factures', // MT
  },
  ws_invoices_admin_title: {
    en: 'Workspace-wide invoices need an Admin role',
    nl: 'Werkruimtebrede facturen vragen een adminrol',
    es: 'Las facturas del espacio de trabajo requieren rol de admin', // MT
    pt: 'Faturas do espaço de trabalho exigem papel de admin', // MT
    de: 'Workspace-weite Rechnungen erfordern eine Admin-Rolle', // MT
    fr: 'Les factures de tout l’espace de travail demandent un rôle admin', // MT
  },
  all_apps: {
    en: 'All apps',
    nl: 'Alle apps',
    es: 'Todas las apps', // MT
    pt: 'Todos os apps', // MT
    de: 'Alle Apps', // MT
    fr: 'Toutes les apps', // MT
  },
  search_purchases_ph: {
    en: 'Search payer, email or item…',
    nl: 'Zoek op betaler, e-mail of item…',
    es: 'Busca pagador, correo o artículo…', // MT
    pt: 'Busque pagador, e-mail ou item…', // MT
    de: 'Zahler, E-Mail oder Posten suchen…', // MT
    fr: 'Cherche payeur, e-mail ou article…', // MT
  },
  paid: {
    en: 'Paid',
    nl: 'Betaald',
    es: 'Pagado', // MT
    pt: 'Pago', // MT
    de: 'Bezahlt', // MT
    fr: 'Payé', // MT
  },
  pending: {
    en: 'Pending',
    nl: 'Openstaand',
    es: 'Pendiente', // MT
    pt: 'Pendente', // MT
    de: 'Ausstehend', // MT
    fr: 'En attente', // MT
  },
  refunded: {
    en: 'Refunded',
    nl: 'Terugbetaald',
    es: 'Reembolsado', // MT
    pt: 'Reembolsado', // MT
    de: 'Erstattet', // MT
    fr: 'Remboursé', // MT
  },
  platform_fees: {
    en: 'Platform fees',
    nl: 'Platformkosten',
    es: 'Comisiones de plataforma', // MT
    pt: 'Taxas da plataforma', // MT
    de: 'Plattformgebühren', // MT
    fr: 'Frais de plateforme', // MT
  },
  purchase_count_one: {
    en: '1 purchase',
    nl: '1 aankoop',
    es: '1 compra', // MT
    pt: '1 compra', // MT
    de: '1 Kauf', // MT
    fr: '1 achat', // MT
  },
  purchase_count_many: {
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
    pt: 'Ainda não há compras nesta visão.', // MT
    de: 'Noch keine Käufe in dieser Ansicht.', // MT
    fr: 'Pas encore d’achats dans cette vue.', // MT
  },
  method_invoice: {
    en: 'Invoice',
    nl: 'Factuur',
    es: 'Factura', // MT
    pt: 'Fatura', // MT
    de: 'Rechnung', // MT
    fr: 'Facture', // MT
  },
  method_free: {
    en: 'Free (code)',
    nl: 'Gratis (code)',
    es: 'Gratis (código)', // MT
    pt: 'Grátis (código)', // MT
    de: 'Gratis (Code)', // MT
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
  status_pending: {
    en: 'pending',
    nl: 'openstaand',
    es: 'pendiente', // MT
    pt: 'pendente', // MT
    de: 'ausstehend', // MT
    fr: 'en attente', // MT
  },
  status_paid: {
    en: 'paid',
    nl: 'betaald',
    es: 'pagado', // MT
    pt: 'pago', // MT
    de: 'bezahlt', // MT
    fr: 'payé', // MT
  },
  status_refunded: {
    en: 'refunded',
    nl: 'terugbetaald',
    es: 'reembolsado', // MT
    pt: 'reembolsado', // MT
    de: 'erstattet', // MT
    fr: 'remboursé', // MT
  },
  status_failed: {
    en: 'failed',
    nl: 'mislukt',
    es: 'fallido', // MT
    pt: 'falhou', // MT
    de: 'fehlgeschlagen', // MT
    fr: 'échoué', // MT
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
    nl: 'Als betaald markeren',
    es: 'Marcar pagado', // MT
    pt: 'Marcar como pago', // MT
    de: 'Als bezahlt markieren', // MT
    fr: 'Marquer payé', // MT
  },
  send_payment_link: {
    en: 'Send payment link',
    nl: 'Betaallink sturen',
    es: 'Enviar enlace de pago', // MT
    pt: 'Enviar link de pagamento', // MT
    de: 'Zahlungslink senden', // MT
    fr: 'Envoyer le lien de paiement', // MT
  },
  resend_invoice: {
    en: 'Resend invoice',
    nl: 'Factuur opnieuw sturen',
    es: 'Reenviar factura', // MT
    pt: 'Reenviar fatura', // MT
    de: 'Rechnung erneut senden', // MT
    fr: 'Renvoyer la facture', // MT
  },
  link_sent_notice: {
    en: 'Payment link sent to the payer.',
    nl: 'Betaallink naar de betaler gestuurd.',
    es: 'Enlace de pago enviado al pagador.', // MT
    pt: 'Link de pagamento enviado ao pagador.', // MT
    de: 'Zahlungslink an den Zahler gesendet.', // MT
    fr: 'Lien de paiement envoyé au payeur.', // MT
  },
  invoice_sent_notice: {
    en: 'Invoice sent to the payer.',
    nl: 'Factuur naar de betaler gestuurd.',
    es: 'Factura enviada al pagador.', // MT
    pt: 'Fatura enviada ao pagador.', // MT
    de: 'Rechnung an den Zahler gesendet.', // MT
    fr: 'Facture envoyée au payeur.', // MT
  },
  marked_paid_notice: {
    en: 'Marked as paid.',
    nl: 'Gemarkeerd als betaald.',
    es: 'Marcado como pagado.', // MT
    pt: 'Marcado como pago.', // MT
    de: 'Als bezahlt markiert.', // MT
    fr: 'Marqué comme payé.', // MT
  },
  reimbursed_notice: {
    en: 'Reimbursed in full.',
    nl: 'Volledig terugbetaald.',
    es: 'Reembolsado por completo.', // MT
    pt: 'Reembolsado por inteiro.', // MT
    de: 'Vollständig erstattet.', // MT
    fr: 'Remboursé en totalité.', // MT
  },
  split_line: {
    en: 'Split: fee {fee} · organiser {org} · workspace {ws}',
    nl: 'Verdeling: fee {fee} · organisator {org} · werkruimte {ws}',
    es: 'Reparto: comisión {fee} · organizador {org} · espacio de trabajo {ws}', // MT
    pt: 'Divisão: taxa {fee} · organizador {org} · espaço de trabalho {ws}', // MT
    de: 'Aufteilung: Gebühr {fee} · Organisator {org} · Workspace {ws}', // MT
    fr: 'Répartition : frais {fee} · organisateur {org} · espace de travail {ws}', // MT
  },
  refunded_on: {
    en: 'Refunded {d}',
    nl: 'Terugbetaald {d}',
    es: 'Reembolsado el {d}', // MT
    pt: 'Reembolsado em {d}', // MT
    de: 'Erstattet am {d}', // MT
    fr: 'Remboursé le {d}', // MT
  },
  mark_paid_title: {
    en: 'Mark as paid',
    nl: 'Markeren als betaald',
    es: 'Marcar como pagado', // MT
    pt: 'Marcar como pago', // MT
    de: 'Als bezahlt markieren', // MT
    fr: 'Marquer comme payé', // MT
  },
  paid_date: {
    en: 'Paid date',
    nl: 'Betaaldatum',
    es: 'Fecha de pago', // MT
    pt: 'Data de pagamento', // MT
    de: 'Zahldatum', // MT
    fr: 'Date de paiement', // MT
  },
  received_on_account: {
    en: 'Received on account',
    nl: 'Ontvangen op rekening',
    es: 'Recibido en la cuenta', // MT
    pt: 'Recebido na conta', // MT
    de: 'Eingegangen auf Konto', // MT
    fr: 'Reçu sur le compte', // MT
  },
  dont_record: {
    en: "— don't record —",
    nl: '— niet vastleggen —',
    es: '— no registrar —', // MT
    pt: '— não registrar —', // MT
    de: '— nicht erfassen —', // MT
    fr: '— ne pas enregistrer —', // MT
  },
  mark_paid_hint: {
    en: 'Adds a balance snapshot on the chosen account and settles the matching plan line.',
    nl: 'Voegt een saldostand toe op de gekozen rekening en boekt de bijbehorende planregel af.',
    es: 'Añade un registro de saldo en la cuenta elegida y liquida la línea de plan correspondiente.', // MT
    pt: 'Adiciona um registro de saldo na conta escolhida e liquida a linha de plano correspondente.', // MT
    de: 'Fügt einen Saldostand auf dem gewählten Konto hinzu und schließt die passende Planzeile ab.', // MT
    fr: 'Ajoute un relevé de solde sur le compte choisi et solde la ligne de plan correspondante.', // MT
  },
  reimburse_q: {
    en: 'Reimburse this purchase?',
    nl: 'Deze aankoop terugbetalen?',
    es: '¿Reembolsar esta compra?', // MT
    pt: 'Reembolsar esta compra?', // MT
    de: 'Diesen Kauf erstatten?', // MT
    fr: 'Rembourser cet achat ?', // MT
  },
  reimburse_msg: {
    en: '{payer} gets {amount} back in full{via}. There is no partial refund.',
    nl: '{payer} krijgt {amount} volledig terug{via}. Er is geen gedeeltelijke terugbetaling.',
    es: '{payer} recibe {amount} de vuelta al completo{via}. No hay reembolso parcial.', // MT
    pt: '{payer} recebe {amount} de volta por inteiro{via}. Não há reembolso parcial.', // MT
    de: '{payer} erhält {amount} vollständig zurück{via}. Eine Teilerstattung gibt es nicht.', // MT
    fr: '{payer} récupère {amount} en totalité{via}. Il n’y a pas de remboursement partiel.', // MT
  },
  reimburse_via_stripe: {
    en: ' via Stripe (the platform fee is returned too)',
    nl: ' via Stripe (ook de platformfee gaat terug)',
    es: ' vía Stripe (la comisión de plataforma también se devuelve)', // MT
    pt: ' via Stripe (a taxa da plataforma também volta)', // MT
    de: ' über Stripe (auch die Plattformgebühr geht zurück)', // MT
    fr: ' via Stripe (les frais de plateforme sont aussi rendus)', // MT
  },
  reimburse_via_outside: {
    en: ' — recorded here; the money moves outside Stripe',
    nl: ' — hier vastgelegd; het geld beweegt buiten Stripe om',
    es: ' — se registra aquí; el dinero se mueve fuera de Stripe', // MT
    pt: ' — registrado aqui; o dinheiro se move fora do Stripe', // MT
    de: ' — hier erfasst; das Geld bewegt sich außerhalb von Stripe', // MT
    fr: ' — enregistré ici ; l’argent circule hors de Stripe', // MT
  },

  // ── cashflow: tabs, controls, view shell ──────────────────────────────
  cashflows_aria: {
    en: 'Cashflows',
    nl: 'Cashflows',
    es: 'Flujos de caja', // MT
    pt: 'Fluxos de caixa', // MT
    de: 'Cashflows', // MT
    fr: 'Trésoreries', // MT
  },
  filter_invoice_aria: {
    en: 'Filter income rows by invoice status',
    nl: 'Filter inkomstenregels op factuurstatus',
    es: 'Filtra las líneas de ingresos por estado de factura', // MT
    pt: 'Filtre linhas de receita por status de fatura', // MT
    de: 'Einnahmenzeilen nach Rechnungsstatus filtern', // MT
    fr: 'Filtrer les lignes de revenus par statut de facture', // MT
  },
  filter_all: {
    en: 'All',
    nl: 'Alles',
    es: 'Todas', // MT
    pt: 'Todas', // MT
    de: 'Alle', // MT
    fr: 'Toutes', // MT
  },
  only_invoiced: {
    en: 'Only invoiced',
    nl: 'Alleen gefactureerd',
    es: 'Solo facturadas', // MT
    pt: 'Só faturadas', // MT
    de: 'Nur berechnet', // MT
    fr: 'Facturées seulement', // MT
  },
  not_invoiced: {
    en: 'Not invoiced',
    nl: 'Niet gefactureerd',
    es: 'Sin facturar', // MT
    pt: 'Não faturadas', // MT
    de: 'Nicht berechnet', // MT
    fr: 'Non facturées', // MT
  },
  filtered_note: {
    en: '(filtered view — totals cover all rows)',
    nl: '(gefilterde weergave — totalen tellen alle regels)',
    es: '(vista filtrada: los totales cubren todas las líneas)', // MT
    pt: '(visão filtrada — os totais cobrem todas as linhas)', // MT
    de: '(gefilterte Ansicht — Summen umfassen alle Zeilen)', // MT
    fr: '(vue filtrée — les totaux couvrent toutes les lignes)', // MT
  },
  view_aria: {
    en: 'View',
    nl: 'Weergave',
    es: 'Vista', // MT
    pt: 'Visão', // MT
    de: 'Ansicht', // MT
    fr: 'Vue', // MT
  },
  by_contact: {
    en: 'By contact',
    nl: 'Per contact',
    es: 'Por contacto', // MT
    pt: 'Por contato', // MT
    de: 'Nach Kontakt', // MT
    fr: 'Par contact', // MT
  },
  by_period: {
    en: 'By period',
    nl: 'Per periode',
    es: 'Por periodo', // MT
    pt: 'Por período', // MT
    de: 'Nach Periode', // MT
    fr: 'Par période', // MT
  },
  add_income_title: {
    en: 'Add income — a contact and an amount is enough',
    nl: 'Inkomsten toevoegen — een contact en een bedrag is genoeg',
    es: 'Añadir ingreso: basta un contacto y un importe', // MT
    pt: 'Adicionar receita — um contato e um valor bastam', // MT
    de: 'Einnahme hinzufügen — ein Kontakt und ein Betrag genügen', // MT
    fr: 'Ajouter un revenu — un contact et un montant suffisent', // MT
  },
  add_income: {
    en: 'Add income',
    nl: 'Inkomsten toevoegen',
    es: 'Añadir ingreso', // MT
    pt: 'Adicionar receita', // MT
    de: 'Einnahme hinzufügen', // MT
    fr: 'Ajouter un revenu', // MT
  },
  add_cost: {
    en: 'Add a cost',
    nl: 'Kosten toevoegen',
    es: 'Añadir un costo', // MT
    pt: 'Adicionar um custo', // MT
    de: 'Kosten hinzufügen', // MT
    fr: 'Ajouter un coût', // MT
  },
  tab_settings_title: {
    en: '{tab} cashflow settings — banks, reserves, reservations',
    nl: 'Cashflow-instellingen van {tab} — banken, reserves, reserveringen',
    es: 'Ajustes del flujo de caja {tab}: bancos, reservas, reglas de reserva', // MT
    pt: 'Configurações do fluxo de caixa {tab} — bancos, reservas, regras de reserva', // MT
    de: 'Cashflow-Einstellungen von {tab} — Banken, Rücklagen, Reservierungen', // MT
    fr: 'Réglages de la trésorerie {tab} — banques, réserves, règles de réserve', // MT
  },
  counterparty: {
    en: 'Counterparty',
    nl: 'Tegenpartij',
    es: 'Contraparte', // MT
    pt: 'Contraparte', // MT
    de: 'Gegenpartei', // MT
    fr: 'Contrepartie', // MT
  },
  empty_add_first: {
    en: 'Nothing here yet. Add your first with the green + above — a contact and an amount is enough.',
    nl: 'Nog niets hier. Voeg je eerste toe met de groene + hierboven — een contact en een bedrag is genoeg.',
    es: 'Aún no hay nada. Añade el primero con el + verde de arriba: basta un contacto y un importe.', // MT
    pt: 'Nada aqui ainda. Adicione o primeiro com o + verde acima — um contato e um valor bastam.', // MT
    de: 'Noch nichts hier. Füge das Erste mit dem grünen + oben hinzu — ein Kontakt und ein Betrag genügen.', // MT
    fr: 'Rien ici pour l’instant. Ajoute le premier avec le + vert ci-dessus — un contact et un montant suffisent.', // MT
  },

  // ── bank prompt + create bank ─────────────────────────────────────────
  bank_prompt_title: {
    en: 'What does the bank say?',
    nl: 'Wat zegt de bank?',
    es: '¿Qué dice el banco?', // MT
    pt: 'O que o banco diz?', // MT
    de: 'Was sagt die Bank?', // MT
    fr: 'Que dit la banque ?', // MT
  },
  bank_prompt_desc: {
    en: "Today's balances anchor the projection.",
    nl: 'De saldi van vandaag verankeren de projectie.',
    es: 'Los saldos de hoy anclan la proyección.', // MT
    pt: 'Os saldos de hoje ancoram a projeção.', // MT
    de: 'Die heutigen Salden verankern die Projektion.', // MT
    fr: 'Les soldes du jour ancrent la projection.', // MT
  },
  balance_for_aria: {
    en: 'Balance for {name}',
    nl: 'Saldo voor {name}',
    es: 'Saldo de {name}', // MT
    pt: 'Saldo de {name}', // MT
    de: 'Saldo für {name}', // MT
    fr: 'Solde de {name}', // MT
  },
  open_first_visit: {
    en: 'Open on the first visit each day',
    nl: 'Open bij het eerste bezoek van de dag',
    es: 'Abrir en la primera visita de cada día', // MT
    pt: 'Abrir na primeira visita de cada dia', // MT
    de: 'Beim ersten Besuch des Tages öffnen', // MT
    fr: 'Ouvrir à la première visite du jour', // MT
  },
  balances_error: {
    en: 'Could not update the balances — {error}',
    nl: 'Kon de saldi niet bijwerken — {error}',
    es: 'No se pudieron actualizar los saldos: {error}', // MT
    pt: 'Não foi possível atualizar os saldos — {error}', // MT
    de: 'Salden konnten nicht aktualisiert werden — {error}', // MT
    fr: 'Impossible de mettre à jour les soldes — {error}', // MT
  },
  new_reserve: {
    en: 'New reserve',
    nl: 'Nieuwe reserve',
    es: 'Nueva reserva', // MT
    pt: 'Nova reserva', // MT
    de: 'Neue Rücklage', // MT
    fr: 'Nouvelle réserve', // MT
  },
  create_bank: {
    en: 'Create bank',
    nl: 'Bank aanmaken',
    es: 'Crear banco', // MT
    pt: 'Criar banco', // MT
    de: 'Bank anlegen', // MT
    fr: 'Créer une banque', // MT
  },
  create_bank_desc: {
    en: 'A virtual account for the {tab} cashflow — its balance anchors the projection.',
    nl: 'Een virtuele rekening voor de cashflow {tab} — het saldo verankert de projectie.',
    es: 'Una cuenta virtual para el flujo de caja {tab}: su saldo ancla la proyección.', // MT
    pt: 'Uma conta virtual para o fluxo de caixa {tab} — o saldo dela ancora a projeção.', // MT
    de: 'Ein virtuelles Konto für den Cashflow {tab} — sein Saldo verankert die Projektion.', // MT
    fr: 'Un compte virtuel pour la trésorerie {tab} — son solde ancre la projection.', // MT
  },
  give_account_name: {
    en: 'Give the account a name.',
    nl: 'Geef de rekening een naam.',
    es: 'Dale un nombre a la cuenta.', // MT
    pt: 'Dê um nome à conta.', // MT
    de: 'Gib dem Konto einen Namen.', // MT
    fr: 'Donne un nom au compte.', // MT
  },
  tab_bank_name: {
    en: '{tab} bank',
    nl: '{tab} bank',
    es: 'Banco {tab}', // MT
    pt: 'Banco {tab}', // MT
    de: '{tab} Bank', // MT
    fr: 'Banque {tab}', // MT
  },
  tab_reserve_name: {
    en: '{tab} reserve',
    nl: '{tab} reserve',
    es: 'Reserva {tab}', // MT
    pt: 'Reserva {tab}', // MT
    de: '{tab} Rücklage', // MT
    fr: 'Réserve {tab}', // MT
  },

  // ── cashflow settings dialog ──────────────────────────────────────────
  cashflow_settings_title: {
    en: '{tab} · cashflow settings',
    nl: '{tab} · cashflow-instellingen',
    es: '{tab} · ajustes del flujo de caja', // MT
    pt: '{tab} · configurações do fluxo de caixa', // MT
    de: '{tab} · Cashflow-Einstellungen', // MT
    fr: '{tab} · réglages de la trésorerie', // MT
  },
  banks_reserves: {
    en: 'Banks & reserves',
    nl: 'Banken & reserves',
    es: 'Bancos y reservas', // MT
    pt: 'Bancos e reservas', // MT
    de: 'Banken & Rücklagen', // MT
    fr: 'Banques et réserves', // MT
  },
  rule: {
    en: 'Rule',
    nl: 'Regel',
    es: 'Regla', // MT
    pt: 'Regra', // MT
    de: 'Regel', // MT
    fr: 'Règle', // MT
  },
  no_accounts_tab: {
    en: 'No accounts in this cashflow yet — add a bank to anchor its projection.',
    nl: 'Nog geen rekeningen in deze cashflow — voeg een bank toe om de projectie te verankeren.',
    es: 'Aún no hay cuentas en este flujo de caja: añade un banco para anclar su proyección.', // MT
    pt: 'Ainda não há contas neste fluxo de caixa — adicione um banco para ancorar a projeção.', // MT
    de: 'Noch keine Konten in diesem Cashflow — füge eine Bank hinzu, um die Projektion zu verankern.', // MT
    fr: 'Pas encore de comptes dans cette trésorerie — ajoute une banque pour ancrer sa projection.', // MT
  },
  no_rules_tab: {
    en: 'No reservation rules in this cashflow. A rule sets aside a % of income into a reserve bucket.',
    nl: 'Geen reserveringsregels in deze cashflow. Een regel zet een % van de inkomsten apart in een reservepotje.',
    es: 'No hay reglas de reserva en este flujo de caja. Una regla aparta un % de los ingresos en un fondo de reserva.', // MT
    pt: 'Sem regras de reserva neste fluxo de caixa. Uma regra separa um % da receita num pote de reserva.', // MT
    de: 'Keine Reservierungsregeln in diesem Cashflow. Eine Regel legt einen % der Einnahmen in einen Rücklagentopf.', // MT
    fr: 'Pas de règles de réserve dans cette trésorerie. Une règle met de côté un % des revenus dans une enveloppe de réserve.', // MT
  },
  remove_rule_title: {
    en: 'Remove this reservation rule',
    nl: 'Deze reserveringsregel verwijderen',
    es: 'Quitar esta regla de reserva', // MT
    pt: 'Remover esta regra de reserva', // MT
    de: 'Diese Reservierungsregel entfernen', // MT
    fr: 'Retirer cette règle de réserve', // MT
  },
  sharing: {
    en: 'Sharing',
    nl: 'Delen',
    es: 'Compartir', // MT
    pt: 'Compartilhamento', // MT
    de: 'Freigabe', // MT
    fr: 'Partage', // MT
  },
  sharing_desc: {
    en: 'Give a workspace member access to this company cashflow — read, or read & write — without making them an admin.',
    nl: 'Geef een werkruimte-lid toegang tot deze bedrijfscashflow — lezen, of lezen & schrijven — zonder ze admin te maken.',
    es: 'Da a un miembro del espacio de trabajo acceso a este flujo de caja de la empresa (leer, o leer y escribir) sin hacerlo admin.', // MT
    pt: 'Dê a um membro do espaço de trabalho acesso a este fluxo de caixa da empresa — leitura, ou leitura e escrita — sem torná-lo admin.', // MT
    de: 'Gib einem Workspace-Mitglied Zugriff auf diesen Firmen-Cashflow — lesen oder lesen & schreiben — ohne es zum Admin zu machen.', // MT
    fr: 'Donne à un membre de l’espace de travail l’accès à cette trésorerie d’entreprise — lecture, ou lecture et écriture — sans en faire un admin.', // MT
  },
  no_access: {
    en: 'No access',
    nl: 'Geen toegang',
    es: 'Sin acceso', // MT
    pt: 'Sem acesso', // MT
    de: 'Kein Zugriff', // MT
    fr: 'Aucun accès', // MT
  },
  read: {
    en: 'Read',
    nl: 'Lezen',
    es: 'Leer', // MT
    pt: 'Leitura', // MT
    de: 'Lesen', // MT
    fr: 'Lecture', // MT
  },
  read_write: {
    en: 'Read & write',
    nl: 'Lezen & schrijven',
    es: 'Leer y escribir', // MT
    pt: 'Leitura e escrita', // MT
    de: 'Lesen & Schreiben', // MT
    fr: 'Lecture et écriture', // MT
  },
  no_members_invite: {
    en: 'No other members yet — invite people from {host} → Settings → Members.',
    nl: 'Nog geen andere leden — nodig mensen uit via {host} → Instellingen → Leden.',
    es: 'Aún no hay otros miembros: invita gente desde {host} → Ajustes → Miembros.', // MT
    pt: 'Ainda não há outros membros — convide pessoas em {host} → Configurações → Membros.', // MT
    de: 'Noch keine anderen Mitglieder — lade Leute über {host} → Einstellungen → Mitglieder ein.', // MT
    fr: 'Pas encore d’autres membres — invite des gens depuis {host} → Paramètres → Membres.', // MT
  },
  more: {
    en: 'More',
    nl: 'Meer',
    es: 'Más', // MT
    pt: 'Mais', // MT
    de: 'Mehr', // MT
    fr: 'Plus', // MT
  },
  planner_wide_before: {
    en: 'VAT tariffs, time rhythm and invoicing are planner-wide —',
    nl: 'Btw-tarieven, tijdritme en facturatie gelden voor de hele planner —',
    es: 'Los tipos de IVA, el ritmo temporal y la facturación son de todo el planificador:', // MT
    pt: 'Alíquotas de IVA, ritmo de tempo e faturamento valem para todo o planejador —', // MT
    de: 'MwSt-Sätze, Zeitrhythmus und Rechnungsstellung gelten planerweit —', // MT
    fr: 'Les taux de TVA, le rythme temporel et la facturation valent pour tout le planificateur —', // MT
  },
  settings_planner_link: {
    en: 'Settings → Planner',
    nl: 'Instellingen → Planner',
    es: 'Ajustes → Planificador', // MT
    pt: 'Configurações → Planejador', // MT
    de: 'Einstellungen → Planer', // MT
    fr: 'Paramètres → Planificateur', // MT
  },

  // ── org dialog ────────────────────────────────────────────────────────
  n_items_one: {
    en: '1 item',
    nl: '1 item',
    es: '1 elemento', // MT
    pt: '1 item', // MT
    de: '1 Posten', // MT
    fr: '1 élément', // MT
  },
  n_items_many: {
    en: '{n} items',
    nl: '{n} items',
    es: '{n} elementos', // MT
    pt: '{n} itens', // MT
    de: '{n} Posten', // MT
    fr: '{n} éléments', // MT
  },
  net_lc: {
    en: 'net',
    nl: 'netto',
    es: 'neto', // MT
    pt: 'líquido', // MT
    de: 'netto', // MT
    fr: 'net', // MT
  },
  opportunities: {
    en: 'Opportunities',
    nl: 'Kansen',
    es: 'Oportunidades', // MT
    pt: 'Oportunidades', // MT
    de: 'Chancen', // MT
    fr: 'Opportunités', // MT
  },
  invoices_receivables: {
    en: 'Invoices & receivables',
    nl: 'Facturen & te ontvangen',
    es: 'Facturas y cobros pendientes', // MT
    pt: 'Faturas e recebíveis', // MT
    de: 'Rechnungen & Forderungen', // MT
    fr: 'Factures et créances', // MT
  },
  no_pipeline_for_cp: {
    en: 'Nothing in the pipeline for this counterparty.',
    nl: 'Niets in de pipeline voor deze tegenpartij.',
    es: 'Nada en el pipeline para esta contraparte.', // MT
    pt: 'Nada no pipeline para esta contraparte.', // MT
    de: 'Nichts in der Pipeline für diese Gegenpartei.', // MT
    fr: 'Rien dans le pipeline pour cette contrepartie.', // MT
  },
  no_invoices_yet: {
    en: 'No invoices or receivables yet.',
    nl: 'Nog geen facturen of te ontvangen bedragen.',
    es: 'Aún no hay facturas ni cobros pendientes.', // MT
    pt: 'Ainda não há faturas nem recebíveis.', // MT
    de: 'Noch keine Rechnungen oder Forderungen.', // MT
    fr: 'Pas encore de factures ni de créances.', // MT
  },
  invoice_no: {
    en: 'Invoice {no}',
    nl: 'Factuur {no}',
    es: 'Factura {no}', // MT
    pt: 'Fatura {no}', // MT
    de: 'Rechnung {no}', // MT
    fr: 'Facture {no}', // MT
  },
  expected_payment_lc: {
    en: 'expected payment',
    nl: 'verwachte betaling',
    es: 'pago previsto', // MT
    pt: 'pagamento previsto', // MT
    de: 'erwartete Zahlung', // MT
    fr: 'paiement attendu', // MT
  },
  settled_d: {
    en: 'settled {d}',
    nl: 'voldaan {d}',
    es: 'liquidado {d}', // MT
    pt: 'liquidado {d}', // MT
    de: 'beglichen {d}', // MT
    fr: 'réglé {d}', // MT
  },
  invoiced_d: {
    en: 'invoiced {d}',
    nl: 'gefactureerd {d}',
    es: 'facturado {d}', // MT
    pt: 'faturado {d}', // MT
    de: 'berechnet {d}', // MT
    fr: 'facturé {d}', // MT
  },
  expected_d: {
    en: 'expected {d}',
    nl: 'verwacht {d}',
    es: 'previsto {d}', // MT
    pt: 'previsto {d}', // MT
    de: 'erwartet {d}', // MT
    fr: 'attendu {d}', // MT
  },

  // ── combobox ──────────────────────────────────────────────────────────
  create_q: {
    en: 'Create ‘{q}’',
    nl: '‘{q}’ aanmaken',
    es: 'Crear «{q}»', // MT
    pt: 'Criar ‘{q}’', // MT
    de: '‚{q}‘ anlegen', // MT
    fr: 'Créer « {q} »', // MT
  },
  use_q: {
    en: 'Use ‘{q}’',
    nl: '‘{q}’ gebruiken',
    es: 'Usar «{q}»', // MT
    pt: 'Usar ‘{q}’', // MT
    de: '‚{q}‘ verwenden', // MT
    fr: 'Utiliser « {q} »', // MT
  },
  no_matches: {
    en: 'No matches.',
    nl: 'Geen resultaten.',
    es: 'Sin coincidencias.', // MT
    pt: 'Sem correspondências.', // MT
    de: 'Keine Treffer.', // MT
    fr: 'Aucun résultat.', // MT
  },
  creating_requires: {
    en: 'Creating {name} — {field} required.',
    nl: '{name} aanmaken — {field} vereist.',
    es: 'Creando {name}: se requiere {field}.', // MT
    pt: 'Criando {name} — {field} obrigatório.', // MT
    de: '{name} wird angelegt — {field} erforderlich.', // MT
    fr: 'Création de {name} — {field} requis.', // MT
  },
  could_not_create: {
    en: 'Could not create.',
    nl: 'Aanmaken is niet gelukt.',
    es: 'No se pudo crear.', // MT
    pt: 'Não foi possível criar.', // MT
    de: 'Konnte nicht angelegt werden.', // MT
    fr: 'Création impossible.', // MT
  },

  // ── counterparty table ────────────────────────────────────────────────
  click_to_edit: {
    en: 'Click to edit',
    nl: 'Klik om te bewerken',
    es: 'Haz clic para editar', // MT
    pt: 'Clique para editar', // MT
    de: 'Zum Bearbeiten klicken', // MT
    fr: 'Clique pour modifier', // MT
  },
  click_to_change: {
    en: 'Click to change',
    nl: 'Klik om te wijzigen',
    es: 'Haz clic para cambiar', // MT
    pt: 'Clique para mudar', // MT
    de: 'Zum Ändern klicken', // MT
    fr: 'Clique pour changer', // MT
  },
  th_item: {
    en: 'Item',
    nl: 'Item',
    es: 'Elemento', // MT
    pt: 'Item', // MT
    de: 'Posten', // MT
    fr: 'Élément', // MT
  },
  th_no: {
    en: 'No.',
    nl: 'Aantal',
    es: 'Cant.', // MT
    pt: 'Qtd.', // MT
    de: 'Anz.', // MT
    fr: 'Qté', // MT
  },
  th_unit_eur: {
    en: 'Unit €',
    nl: 'Stuks €',
    es: 'Unidad €', // MT
    pt: 'Unitário €', // MT
    de: 'Einzel €', // MT
    fr: 'Unité €', // MT
  },
  th_eq_total: {
    en: '= Total',
    nl: '= Totaal',
    es: '= Total', // MT
    pt: '= Total', // MT
    de: '= Gesamt', // MT
    fr: '= Total', // MT
  },
  th_recurring: {
    en: 'Recurring',
    nl: 'Terugkerend',
    es: 'Recurrente', // MT
    pt: 'Recorrente', // MT
    de: 'Wiederkehrend', // MT
    fr: 'Récurrent', // MT
  },
  th_stage: {
    en: 'Stage',
    nl: 'Fase',
    es: 'Etapa', // MT
    pt: 'Etapa', // MT
    de: 'Phase', // MT
    fr: 'Étape', // MT
  },
  th_prob: {
    en: 'Prob.',
    nl: 'Kans',
    es: 'Prob.', // MT
    pt: 'Prob.', // MT
    de: 'Wahrsch.', // MT
    fr: 'Prob.', // MT
  },
  drag_reorder_group: {
    en: 'Drag to reorder — the whole group moves',
    nl: 'Sleep om te herschikken — de hele groep beweegt mee',
    es: 'Arrastra para reordenar: se mueve todo el grupo', // MT
    pt: 'Arraste para reordenar — o grupo inteiro se move', // MT
    de: 'Zum Umsortieren ziehen — die ganze Gruppe wandert mit', // MT
    fr: 'Glisse pour réordonner — tout le groupe bouge', // MT
  },
  drag_to_reorder: {
    en: 'Drag to reorder',
    nl: 'Sleep om te herschikken',
    es: 'Arrastra para reordenar', // MT
    pt: 'Arraste para reordenar', // MT
    de: 'Zum Umsortieren ziehen', // MT
    fr: 'Glisse pour réordonner', // MT
  },
  fold_name: {
    en: 'Fold {name}',
    nl: '{name} invouwen',
    es: 'Plegar {name}', // MT
    pt: 'Recolher {name}', // MT
    de: '{name} einklappen', // MT
    fr: 'Replier {name}', // MT
  },
  unfold_name: {
    en: 'Unfold {name}',
    nl: '{name} uitvouwen',
    es: 'Desplegar {name}', // MT
    pt: 'Expandir {name}', // MT
    de: '{name} ausklappen', // MT
    fr: 'Déplier {name}', // MT
  },
  open_org_title: {
    en: 'Open — opportunities & invoices',
    nl: 'Openen — kansen & facturen',
    es: 'Abrir: oportunidades y facturas', // MT
    pt: 'Abrir — oportunidades e faturas', // MT
    de: 'Öffnen — Chancen & Rechnungen', // MT
    fr: 'Ouvrir — opportunités et factures', // MT
  },
  label_for_aria: {
    en: 'Label for {label}',
    nl: 'Label van {label}',
    es: 'Etiqueta de {label}', // MT
    pt: 'Rótulo de {label}', // MT
    de: 'Label von {label}', // MT
    fr: 'Libellé de {label}', // MT
  },
  quantity_for_aria: {
    en: 'Quantity for {label}',
    nl: 'Aantal van {label}',
    es: 'Cantidad de {label}', // MT
    pt: 'Quantidade de {label}', // MT
    de: 'Anzahl von {label}', // MT
    fr: 'Quantité de {label}', // MT
  },
  unit_price_for_aria: {
    en: 'Unit price for {label}',
    nl: 'Stukprijs van {label}',
    es: 'Precio unitario de {label}', // MT
    pt: 'Preço unitário de {label}', // MT
    de: 'Einzelpreis von {label}', // MT
    fr: 'Prix unitaire de {label}', // MT
  },
  recurring_for_aria: {
    en: 'Recurring for {label}',
    nl: 'Herhaling van {label}',
    es: 'Recurrencia de {label}', // MT
    pt: 'Recorrência de {label}', // MT
    de: 'Wiederholung von {label}', // MT
    fr: 'Récurrence de {label}', // MT
  },
  stage_for_aria: {
    en: 'Stage for {label}',
    nl: 'Fase van {label}',
    es: 'Etapa de {label}', // MT
    pt: 'Etapa de {label}', // MT
    de: 'Phase von {label}', // MT
    fr: 'Étape de {label}', // MT
  },
  prob_for_aria: {
    en: 'Probability for {label}',
    nl: 'Kans van {label}',
    es: 'Probabilidad de {label}', // MT
    pt: 'Probabilidade de {label}', // MT
    de: 'Wahrscheinlichkeit von {label}', // MT
    fr: 'Probabilité de {label}', // MT
  },
  doesnt_repeat: {
    en: "Doesn't repeat",
    nl: 'Herhaalt niet',
    es: 'No se repite', // MT
    pt: 'Não se repete', // MT
    de: 'Wiederholt sich nicht', // MT
    fr: 'Ne se répète pas', // MT
  },
  committed_full_title: {
    en: 'Committed money counts in full',
    nl: 'Toegezegd geld telt volledig mee',
    es: 'El dinero comprometido cuenta al completo', // MT
    pt: 'Dinheiro comprometido conta por inteiro', // MT
    de: 'Zugesagtes Geld zählt voll', // MT
    fr: 'L’argent engagé compte en entier', // MT
  },
  open_row_aria: {
    en: 'Open {label}',
    nl: '{label} openen',
    es: 'Abrir {label}', // MT
    pt: 'Abrir {label}', // MT
    de: '{label} öffnen', // MT
    fr: 'Ouvrir {label}', // MT
  },
  open_row_title: {
    en: 'Open — payments, counterparty, notes…',
    nl: 'Openen — betalingen, tegenpartij, notities…',
    es: 'Abrir: pagos, contraparte, notas…', // MT
    pt: 'Abrir — pagamentos, contraparte, notas…', // MT
    de: 'Öffnen — Zahlungen, Gegenpartei, Notizen…', // MT
    fr: 'Ouvrir — paiements, contrepartie, notes…', // MT
  },
  total_title_items: {
    en: 'Sum of the offering rows',
    nl: 'Som van de aanbodregels',
    es: 'Suma de las líneas de oferta', // MT
    pt: 'Soma das linhas de oferta', // MT
    de: 'Summe der Angebotszeilen', // MT
    fr: 'Somme des lignes d’offre', // MT
  },
  total_title_qty: {
    en: 'Quantity × unit price',
    nl: 'Aantal × stukprijs',
    es: 'Cantidad × precio unitario', // MT
    pt: 'Quantidade × preço unitário', // MT
    de: 'Anzahl × Einzelpreis', // MT
    fr: 'Quantité × prix unitaire', // MT
  },
  total_title_lines: {
    en: 'Sum of unsettled expected payments',
    nl: 'Som van onvoldane verwachte betalingen',
    es: 'Suma de los pagos previstos sin liquidar', // MT
    pt: 'Soma dos pagamentos previstos não liquidados', // MT
    de: 'Summe der offenen erwarteten Zahlungen', // MT
    fr: 'Somme des paiements attendus non réglés', // MT
  },
  no_counterparty_yet: {
    en: 'No counterparty yet',
    nl: 'Nog geen tegenpartij',
    es: 'Aún sin contraparte', // MT
    pt: 'Ainda sem contraparte', // MT
    de: 'Noch keine Gegenpartei', // MT
    fr: 'Pas encore de contrepartie', // MT
  },
  could_not_save: {
    en: 'Could not save: {error}',
    nl: 'Opslaan is niet gelukt: {error}',
    es: 'No se pudo guardar: {error}', // MT
    pt: 'Não foi possível salvar: {error}', // MT
    de: 'Konnte nicht gespeichert werden: {error}', // MT
    fr: 'Enregistrement impossible : {error}', // MT
  },
  could_not_reorder: {
    en: 'Could not reorder: {error}',
    nl: 'Herschikken is niet gelukt: {error}',
    es: 'No se pudo reordenar: {error}', // MT
    pt: 'Não foi possível reordenar: {error}', // MT
    de: 'Konnte nicht umsortiert werden: {error}', // MT
    fr: 'Réordonnancement impossible : {error}', // MT
  },

  // ── period grid ───────────────────────────────────────────────────────
  overdue: {
    en: 'Overdue',
    nl: 'Achterstallig',
    es: 'Vencido', // MT
    pt: 'Atrasado', // MT
    de: 'Überfällig', // MT
    fr: 'En retard', // MT
  },
  later: {
    en: 'Later',
    nl: 'Later',
    es: 'Después', // MT
    pt: 'Depois', // MT
    de: 'Später', // MT
    fr: 'Plus tard', // MT
  },
  recurring_budget: {
    en: 'Recurring (budget)',
    nl: 'Terugkerend (budget)',
    es: 'Recurrente (presupuesto)', // MT
    pt: 'Recorrente (orçamento)', // MT
    de: 'Wiederkehrend (Budget)', // MT
    fr: 'Récurrent (budget)', // MT
  },
  set_balance: {
    en: 'Set balance',
    nl: 'Saldo instellen',
    es: 'Fijar saldo', // MT
    pt: 'Definir saldo', // MT
    de: 'Saldo setzen', // MT
    fr: 'Définir le solde', // MT
  },
  no_bank_yet: {
    en: 'This cashflow has no bank yet',
    nl: 'Deze cashflow heeft nog geen bank',
    es: 'Este flujo de caja aún no tiene banco', // MT
    pt: 'Este fluxo de caixa ainda não tem banco', // MT
    de: 'Dieser Cashflow hat noch keine Bank', // MT
    fr: 'Cette trésorerie n’a pas encore de banque', // MT
  },
  plus_reserve: {
    en: '+ reserve',
    nl: '+ reserve',
    es: '+ reserva', // MT
    pt: '+ reserva', // MT
    de: '+ Rücklage', // MT
    fr: '+ réserve', // MT
  },
  fill_balances: {
    en: 'Fill in your bank balances →',
    nl: 'Vul je banksaldi in →',
    es: 'Rellena tus saldos bancarios →', // MT
    pt: 'Preencha seus saldos bancários →', // MT
    de: 'Trage deine Kontostände ein →', // MT
    fr: 'Renseigne tes soldes bancaires →', // MT
  },
  update_balances_anchor: {
    en: 'Update the balances — the Bank rows anchor on them.',
    nl: 'Werk de saldi bij — de bankrijen verankeren erop.',
    es: 'Actualiza los saldos: las filas de Banco se anclan en ellos.', // MT
    pt: 'Atualize os saldos — as linhas de Banco se ancoram neles.', // MT
    de: 'Aktualisiere die Salden — die Bank-Zeilen verankern darauf.', // MT
    fr: 'Mets à jour les soldes — les lignes Banque s’y ancrent.', // MT
  },
  as_of_update_title: {
    en: 'as of {d} — update via the Bank popup',
    nl: 'per {d} — bijwerken via de bankpopup',
    es: 'a {d}: actualiza en el popup del banco', // MT
    pt: 'em {d} — atualize no popup do banco', // MT
    de: 'Stand {d} — Aktualisierung über das Bank-Popup', // MT
    fr: 'au {d} — mise à jour via la fenêtre Banque', // MT
  },
  set_balance_title: {
    en: 'Set the balance — opens the Bank popup',
    nl: 'Stel het saldo in — opent de bankpopup',
    es: 'Fija el saldo: abre el popup del banco', // MT
    pt: 'Defina o saldo — abre o popup do banco', // MT
    de: 'Setze den Saldo — öffnet das Bank-Popup', // MT
    fr: 'Définis le solde — ouvre la fenêtre Banque', // MT
  },
  projected_title: {
    en: 'projected — actual + reservations to date',
    nl: 'geprojecteerd — actueel + reserveringen tot nu',
    es: 'proyectado: real + reservas hasta la fecha', // MT
    pt: 'projetado — real + reservas até a data', // MT
    de: 'projiziert — Ist + Reservierungen bis dahin', // MT
    fr: 'projeté — réel + réserves à date', // MT
  },
  repeats_edit_item: {
    en: 'repeats — edit the item',
    nl: 'herhaalt — bewerk het item',
    es: 'se repite: edita el elemento', // MT
    pt: 'repete — edite o item', // MT
    de: 'wiederholt sich — bearbeite den Posten', // MT
    fr: 'se répète — modifie l’élément', // MT
  },
  recurring_edit_budget: {
    en: 'recurring — edit in Budget',
    nl: 'terugkerend — bewerken in Budget',
    es: 'recurrente: edita en Presupuesto', // MT
    pt: 'recorrente — edite no Orçamento', // MT
    de: 'wiederkehrend — bearbeiten im Budget', // MT
    fr: 'récurrent — à modifier dans Budget', // MT
  },
  repeats_drag_title: {
    en: 'Repeats — drag to another period to reschedule the whole series; click to edit.',
    nl: 'Herhaalt — sleep naar een andere periode om de hele reeks te verzetten; klik om te bewerken.',
    es: 'Se repite: arrastra a otro periodo para reprogramar toda la serie; haz clic para editar.', // MT
    pt: 'Repete — arraste para outro período para reprogramar a série inteira; clique para editar.', // MT
    de: 'Wiederholt sich — in eine andere Periode ziehen, um die ganze Serie zu verschieben; zum Bearbeiten klicken.', // MT
    fr: 'Se répète — glisse vers une autre période pour replanifier toute la série ; clique pour modifier.', // MT
  },
  group_drag_one: {
    en: '{name} — drag to retime the 1 expected payment of this period',
    nl: '{name} — sleep om de 1 verwachte betaling van deze periode te verzetten',
    es: '{name}: arrastra para retemporizar el único pago previsto de este periodo', // MT
    pt: '{name} — arraste para reagendar o único pagamento previsto deste período', // MT
    de: '{name} — ziehen, um die 1 erwartete Zahlung dieser Periode zu verschieben', // MT
    fr: '{name} — glisse pour redater le seul paiement attendu de cette période', // MT
  },
  group_drag_many: {
    en: '{name} — drag to retime all {n} expected payments of this period',
    nl: '{name} — sleep om alle {n} verwachte betalingen van deze periode te verzetten',
    es: '{name}: arrastra para retemporizar los {n} pagos previstos de este periodo', // MT
    pt: '{name} — arraste para reagendar os {n} pagamentos previstos deste período', // MT
    de: '{name} — ziehen, um alle {n} erwarteten Zahlungen dieser Periode zu verschieben', // MT
    fr: '{name} — glisse pour redater les {n} paiements attendus de cette période', // MT
  },
  add_rule_tab_title: {
    en: 'Add a reservation rule to the {tab} cashflow',
    nl: 'Voeg een reserveringsregel toe aan de cashflow {tab}',
    es: 'Añade una regla de reserva al flujo de caja {tab}', // MT
    pt: 'Adicione uma regra de reserva ao fluxo de caixa {tab}', // MT
    de: 'Füge dem Cashflow {tab} eine Reservierungsregel hinzu', // MT
    fr: 'Ajoute une règle de réserve à la trésorerie {tab}', // MT
  },
  add_rule_aria: {
    en: 'Add a reservation rule',
    nl: 'Reserveringsregel toevoegen',
    es: 'Añadir una regla de reserva', // MT
    pt: 'Adicionar uma regra de reserva', // MT
    de: 'Reservierungsregel hinzufügen', // MT
    fr: 'Ajouter une règle de réserve', // MT
  },
  plus_income: {
    en: '+ Income',
    nl: '+ Inkomsten',
    es: '+ Ingreso', // MT
    pt: '+ Receita', // MT
    de: '+ Einnahme', // MT
    fr: '+ Revenu', // MT
  },
  plus_cost: {
    en: '+ Cost',
    nl: '+ Kosten',
    es: '+ Costo', // MT
    pt: '+ Custo', // MT
    de: '+ Kosten', // MT
    fr: '+ Coût', // MT
  },
  per_week: {
    en: 'Per week',
    nl: 'Per week',
    es: 'Por semana', // MT
    pt: 'Por semana', // MT
    de: 'Pro Woche', // MT
    fr: 'Par semaine', // MT
  },
  per_fortnight: {
    en: 'Per fortnight',
    nl: 'Per twee weken',
    es: 'Por quincena', // MT
    pt: 'Por quinzena', // MT
    de: 'Pro zwei Wochen', // MT
    fr: 'Par quinzaine', // MT
  },
  per_month: {
    en: 'Per month',
    nl: 'Per maand',
    es: 'Por mes', // MT
    pt: 'Por mês', // MT
    de: 'Pro Monat', // MT
    fr: 'Par mois', // MT
  },
  per_quarter: {
    en: 'Per quarter',
    nl: 'Per kwartaal',
    es: 'Por trimestre', // MT
    pt: 'Por trimestre', // MT
    de: 'Pro Quartal', // MT
    fr: 'Par trimestre', // MT
  },
  show_periods_aria: {
    en: 'Show periods per',
    nl: 'Toon periodes per',
    es: 'Mostrar periodos por', // MT
    pt: 'Mostrar períodos por', // MT
    de: 'Perioden zeigen pro', // MT
    fr: 'Afficher les périodes par', // MT
  },
  fit_to_screen: {
    en: 'Fit to screen',
    nl: 'Passend op het scherm',
    es: 'Ajustar a la pantalla', // MT
    pt: 'Ajustar à tela', // MT
    de: 'An den Bildschirm anpassen', // MT
    fr: 'Adapter à l’écran', // MT
  },
  scrollable_layout: {
    en: 'Scrollable layout',
    nl: 'Scrollbare weergave',
    es: 'Diseño desplazable', // MT
    pt: 'Leiaute rolável', // MT
    de: 'Scrollbares Layout', // MT
    fr: 'Disposition défilante', // MT
  },
  fit_aria_on: {
    en: 'Switch back to the scrollable layout',
    nl: 'Terug naar de scrollbare weergave',
    es: 'Volver al diseño desplazable', // MT
    pt: 'Voltar ao leiaute rolável', // MT
    de: 'Zurück zum scrollbaren Layout', // MT
    fr: 'Revenir à la disposition défilante', // MT
  },
  fit_aria_off: {
    en: 'Fit the table to the screen',
    nl: 'Pas de tabel op het scherm',
    es: 'Ajusta la tabla a la pantalla', // MT
    pt: 'Ajuste a tabela à tela', // MT
    de: 'Tabelle an den Bildschirm anpassen', // MT
    fr: 'Adapter le tableau à l’écran', // MT
  },
  scroll_earlier: {
    en: 'Scroll to earlier periods',
    nl: 'Scroll naar eerdere periodes',
    es: 'Desplázate a periodos anteriores', // MT
    pt: 'Role para períodos anteriores', // MT
    de: 'Zu früheren Perioden scrollen', // MT
    fr: 'Défiler vers les périodes précédentes', // MT
  },
  scroll_later: {
    en: 'Scroll to later periods',
    nl: 'Scroll naar latere periodes',
    es: 'Desplázate a periodos posteriores', // MT
    pt: 'Role para períodos posteriores', // MT
    de: 'Zu späteren Perioden scrollen', // MT
    fr: 'Défiler vers les périodes suivantes', // MT
  },
  new_payment_aria: {
    en: 'New payment amount',
    nl: 'Bedrag van de nieuwe betaling',
    es: 'Importe del nuevo pago', // MT
    pt: 'Valor do novo pagamento', // MT
    de: 'Betrag der neuen Zahlung', // MT
    fr: 'Montant du nouveau paiement', // MT
  },
  add_payment_here: {
    en: 'Click empty space to add a payment here',
    nl: 'Klik op lege ruimte om hier een betaling toe te voegen',
    es: 'Haz clic en el espacio vacío para añadir un pago aquí', // MT
    pt: 'Clique no espaço vazio para adicionar um pagamento aqui', // MT
    de: 'Klicke auf leeren Raum, um hier eine Zahlung hinzuzufügen', // MT
    fr: 'Clique dans l’espace vide pour ajouter un paiement ici', // MT
  },
  chip_title: {
    en: '{label} — expected {date}.',
    nl: '{label} — verwacht {date}.',
    es: '{label}: previsto {date}.', // MT
    pt: '{label} — previsto {date}.', // MT
    de: '{label} — erwartet {date}.', // MT
    fr: '{label} — attendu {date}.', // MT
  },
  chip_title_weighted: {
    en: ' Weighted at {p}% (full {full}).',
    nl: ' Gewogen op {p}% (volledig {full}).',
    es: ' Ponderado al {p}% (completo {full}).', // MT
    pt: ' Ponderado a {p}% (integral {full}).', // MT
    de: ' Gewichtet mit {p}% (voll {full}).', // MT
    fr: ' Pondéré à {p} % (plein {full}).', // MT
  },
  chip_title_invoiced: {
    en: ' Invoiced, awaiting payment.',
    nl: ' Gefactureerd, wacht op betaling.',
    es: ' Facturado, a la espera del pago.', // MT
    pt: ' Faturado, aguardando pagamento.', // MT
    de: ' Berechnet, wartet auf Zahlung.', // MT
    fr: ' Facturé, en attente de paiement.', // MT
  },
  chip_title_actions: {
    en: ' Click to open; drag to another period to retime; ⌥-drag to copy.',
    nl: ' Klik om te openen; sleep naar een andere periode om te verzetten; ⌥-slepen kopieert.',
    es: ' Haz clic para abrir; arrastra a otro periodo para retemporizar; ⌥-arrastrar copia.', // MT
    pt: ' Clique para abrir; arraste para outro período para reagendar; ⌥-arrastar copia.', // MT
    de: ' Klicken zum Öffnen; in eine andere Periode ziehen zum Verschieben; ⌥-Ziehen kopiert.', // MT
    fr: ' Clique pour ouvrir ; glisse vers une autre période pour redater ; ⌥-glisser copie.', // MT
  },
  could_not_move: {
    en: 'Could not move the expected payment: {error}',
    nl: 'Kon de verwachte betaling niet verplaatsen: {error}',
    es: 'No se pudo mover el pago previsto: {error}', // MT
    pt: 'Não foi possível mover o pagamento previsto: {error}', // MT
    de: 'Die erwartete Zahlung konnte nicht verschoben werden: {error}', // MT
    fr: 'Impossible de déplacer le paiement attendu : {error}', // MT
  },
  could_not_move_group: {
    en: "Could not move the group's expected payments: {error}",
    nl: 'Kon de verwachte betalingen van de groep niet verplaatsen: {error}',
    es: 'No se pudieron mover los pagos previstos del grupo: {error}', // MT
    pt: 'Não foi possível mover os pagamentos previstos do grupo: {error}', // MT
    de: 'Die erwarteten Zahlungen der Gruppe konnten nicht verschoben werden: {error}', // MT
    fr: 'Impossible de déplacer les paiements attendus du groupe : {error}', // MT
  },
  could_not_duplicate: {
    en: 'Could not duplicate: {error}',
    nl: 'Dupliceren is niet gelukt: {error}',
    es: 'No se pudo duplicar: {error}', // MT
    pt: 'Não foi possível duplicar: {error}', // MT
    de: 'Konnte nicht dupliziert werden: {error}', // MT
    fr: 'Duplication impossible : {error}', // MT
  },
  could_not_reschedule: {
    en: 'Could not reschedule the series: {error}',
    nl: 'Kon de reeks niet verzetten: {error}',
    es: 'No se pudo reprogramar la serie: {error}', // MT
    pt: 'Não foi possível reprogramar a série: {error}', // MT
    de: 'Die Serie konnte nicht verschoben werden: {error}', // MT
    fr: 'Impossible de replanifier la série : {error}', // MT
  },
  could_not_add_payment: {
    en: 'Could not add the expected payment: {error}',
    nl: 'Kon de verwachte betaling niet toevoegen: {error}',
    es: 'No se pudo añadir el pago previsto: {error}', // MT
    pt: 'Não foi possível adicionar o pagamento previsto: {error}', // MT
    de: 'Die erwartete Zahlung konnte nicht hinzugefügt werden: {error}', // MT
    fr: 'Impossible d’ajouter le paiement attendu : {error}', // MT
  },
  could_not_delete: {
    en: 'Could not delete: {error}',
    nl: 'Verwijderen is niet gelukt: {error}',
    es: 'No se pudo eliminar: {error}', // MT
    pt: 'Não foi possível excluir: {error}', // MT
    de: 'Konnte nicht gelöscht werden: {error}', // MT
    fr: 'Suppression impossible : {error}', // MT
  },

  // ── opportunity dialog ────────────────────────────────────────────────
  edit_income: {
    en: 'Edit income',
    nl: 'Inkomsten bewerken',
    es: 'Editar ingreso', // MT
    pt: 'Editar receita', // MT
    de: 'Einnahme bearbeiten', // MT
    fr: 'Modifier le revenu', // MT
  },
  new_income: {
    en: 'New income',
    nl: 'Nieuwe inkomsten',
    es: 'Nuevo ingreso', // MT
    pt: 'Nova receita', // MT
    de: 'Neue Einnahme', // MT
    fr: 'Nouveau revenu', // MT
  },
  edit_cost: {
    en: 'Edit cost',
    nl: 'Kosten bewerken',
    es: 'Editar costo', // MT
    pt: 'Editar custo', // MT
    de: 'Kosten bearbeiten', // MT
    fr: 'Modifier le coût', // MT
  },
  new_cost: {
    en: 'New cost',
    nl: 'Nieuwe kosten',
    es: 'Nuevo costo', // MT
    pt: 'Novo custo', // MT
    de: 'Neue Kosten', // MT
    fr: 'Nouveau coût', // MT
  },
  personal_cashflow: {
    en: 'Personal cashflow',
    nl: 'Persoonlijke cashflow',
    es: 'Flujo de caja personal', // MT
    pt: 'Fluxo de caixa pessoal', // MT
    de: 'Persönlicher Cashflow', // MT
    fr: 'Trésorerie personnelle', // MT
  },
  team_cashflow: {
    en: '{team} cashflow',
    nl: 'Cashflow {team}',
    es: 'Flujo de caja {team}', // MT
    pt: 'Fluxo de caixa {team}', // MT
    de: 'Cashflow {team}', // MT
    fr: 'Trésorerie {team}', // MT
  },
  organisation: {
    en: 'Organisation',
    nl: 'Organisatie',
    es: 'Organización', // MT
    pt: 'Organização', // MT
    de: 'Organisation', // MT
    fr: 'Organisation', // MT
  },
  person: {
    en: 'Person',
    nl: 'Persoon',
    es: 'Persona', // MT
    pt: 'Pessoa', // MT
    de: 'Person', // MT
    fr: 'Personne', // MT
  },
  loading_company_people: {
    en: 'Loading company people…',
    nl: 'Mensen van het bedrijf laden…',
    es: 'Cargando la gente de la empresa…', // MT
    pt: 'Carregando as pessoas da empresa…', // MT
    de: 'Leute der Firma werden geladen…', // MT
    fr: 'Chargement des personnes de l’entreprise…', // MT
  },
  linked_to: {
    en: 'linked to {org}',
    nl: 'gekoppeld aan {org}',
    es: 'vinculado a {org}', // MT
    pt: 'vinculado a {org}', // MT
    de: 'mit {org} verknüpft', // MT
    fr: 'lié à {org}', // MT
  },
  created_not_linked: {
    en: 'Created, but could not link to {org}: {error}',
    nl: 'Aangemaakt, maar koppelen aan {org} is niet gelukt: {error}',
    es: 'Creado, pero no se pudo vincular a {org}: {error}', // MT
    pt: 'Criado, mas não foi possível vincular a {org}: {error}', // MT
    de: 'Angelegt, aber Verknüpfen mit {org} schlug fehl: {error}', // MT
    fr: 'Créé, mais impossible de lier à {org} : {error}', // MT
  },
  this_person: {
    en: 'This person',
    nl: 'Deze persoon',
    es: 'Esta persona', // MT
    pt: 'Esta pessoa', // MT
    de: 'Diese Person', // MT
    fr: 'Cette personne', // MT
  },
  link_q_1: {
    en: "isn't linked to",
    nl: 'is nog niet gekoppeld aan',
    es: 'no está vinculada a', // MT
    pt: 'não está vinculada a', // MT
    de: 'ist noch nicht verknüpft mit', // MT
    fr: 'n’est pas encore liée à', // MT
  },
  link_q_2: {
    en: 'yet. Link them?',
    nl: '. Koppelen?',
    es: 'todavía. ¿Vincular?', // MT
    pt: 'ainda. Vincular?', // MT
    de: '. Verknüpfen?', // MT
    fr: '. La lier ?', // MT
  },
  link_select: {
    en: 'Link & select',
    nl: 'Koppelen & selecteren',
    es: 'Vincular y seleccionar', // MT
    pt: 'Vincular e selecionar', // MT
    de: 'Verknüpfen & auswählen', // MT
    fr: 'Lier et sélectionner', // MT
  },
  linking: {
    en: 'Linking…',
    nl: 'Koppelen…',
    es: 'Vinculando…', // MT
    pt: 'Vinculando…', // MT
    de: 'Wird verknüpft…', // MT
    fr: 'Liaison…', // MT
  },
  select_without_linking: {
    en: 'Select without linking',
    nl: 'Selecteren zonder koppelen',
    es: 'Seleccionar sin vincular', // MT
    pt: 'Selecionar sem vincular', // MT
    de: 'Auswählen ohne Verknüpfen', // MT
    fr: 'Sélectionner sans lier', // MT
  },
  at_org: {
    en: 'at {org}',
    nl: 'bij {org}',
    es: 'en {org}', // MT
    pt: 'na {org}', // MT
    de: 'bei {org}', // MT
    fr: 'chez {org}', // MT
  },
  not_linked_lc: {
    en: 'not linked',
    nl: 'niet gekoppeld',
    es: 'sin vincular', // MT
    pt: 'não vinculada', // MT
    de: 'nicht verknüpft', // MT
    fr: 'non liée', // MT
  },
  add_person_action: {
    en: 'Add person…',
    nl: 'Persoon toevoegen…',
    es: 'Añadir persona…', // MT
    pt: 'Adicionar pessoa…', // MT
    de: 'Person hinzufügen…', // MT
    fr: 'Ajouter une personne…', // MT
  },
  email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  valid_email_error: {
    en: 'A valid email is required to create a person.',
    nl: 'Een geldig e-mailadres is nodig om een persoon aan te maken.',
    es: 'Se necesita un correo válido para crear una persona.', // MT
    pt: 'Um e-mail válido é necessário para criar uma pessoa.', // MT
    de: 'Zum Anlegen einer Person ist eine gültige E-Mail nötig.', // MT
    fr: 'Un e-mail valide est requis pour créer une personne.', // MT
  },
  income_or_cost_aria: {
    en: 'Income or cost',
    nl: 'Inkomsten of kosten',
    es: 'Ingreso o costo', // MT
    pt: 'Receita ou custo', // MT
    de: 'Einnahme oder Kosten', // MT
    fr: 'Revenu ou coût', // MT
  },
  income_one: {
    en: 'Income',
    nl: 'Inkomsten',
    es: 'Ingreso', // MT
    pt: 'Receita', // MT
    de: 'Einnahme', // MT
    fr: 'Revenu', // MT
  },
  project: {
    en: 'Project',
    nl: 'Project',
    es: 'Proyecto', // MT
    pt: 'Projeto', // MT
    de: 'Projekt', // MT
    fr: 'Projet', // MT
  },
  team_projects: {
    en: 'Team projects',
    nl: 'Teamprojecten',
    es: 'Proyectos del equipo', // MT
    pt: 'Projetos da equipe', // MT
    de: 'Team-Projekte', // MT
    fr: 'Projets de l’équipe', // MT
  },
  other_projects: {
    en: 'Other projects',
    nl: 'Andere projecten',
    es: 'Otros proyectos', // MT
    pt: 'Outros projetos', // MT
    de: 'Andere Projekte', // MT
    fr: 'Autres projets', // MT
  },
  unchanged: {
    en: 'Unchanged',
    nl: 'Ongewijzigd',
    es: 'Sin cambios', // MT
    pt: 'Sem alteração', // MT
    de: 'Unverändert', // MT
    fr: 'Inchangé', // MT
  },
  belongs_team_cashflow: {
    en: 'This item belongs to the {team} cashflow.',
    nl: 'Dit item hoort bij de cashflow {team}.',
    es: 'Este elemento pertenece al flujo de caja {team}.', // MT
    pt: 'Este item pertence ao fluxo de caixa {team}.', // MT
    de: 'Dieser Posten gehört zum Cashflow {team}.', // MT
    fr: 'Cet élément appartient à la trésorerie {team}.', // MT
  },
  showing_all_teams: {
    en: 'Showing all teams — pick the involved teams in Settings → Planner to scope this list.',
    nl: 'Alle teams worden getoond — kies de betrokken teams in Instellingen → Planner om deze lijst in te perken.',
    es: 'Se muestran todos los equipos: elige los implicados en Ajustes → Planificador para acotar esta lista.', // MT
    pt: 'Mostrando todas as equipes — escolha as envolvidas em Configurações → Planejador para restringir esta lista.', // MT
    de: 'Alle Teams werden gezeigt — wähle die beteiligten in Einstellungen → Planer, um die Liste einzugrenzen.', // MT
    fr: 'Toutes les équipes sont affichées — choisis les équipes impliquées dans Paramètres → Planificateur pour restreindre la liste.', // MT
  },
  offer_link: {
    en: 'Offer / quotation link',
    nl: 'Link naar offerte',
    es: 'Enlace a la oferta / presupuesto', // MT
    pt: 'Link da proposta / orçamento', // MT
    de: 'Link zu Angebot / Kostenvoranschlag', // MT
    fr: 'Lien vers l’offre / le devis', // MT
  },
  open_offer_title: {
    en: 'Open the offer',
    nl: 'Open de offerte',
    es: 'Abrir la oferta', // MT
    pt: 'Abrir a proposta', // MT
    de: 'Das Angebot öffnen', // MT
    fr: 'Ouvrir l’offre', // MT
  },
  name_ph_opportunity: {
    en: 'e.g. Website rebuild — phase 2',
    nl: 'bijv. Website-vernieuwing — fase 2',
    es: 'p. ej. Rediseño web — fase 2', // MT
    pt: 'p. ex. Reformulação do site — fase 2', // MT
    de: 'z. B. Website-Neubau — Phase 2', // MT
    fr: 'p. ex. Refonte du site — phase 2', // MT
  },
  expected_date: {
    en: 'Expected date',
    nl: 'Verwachte datum',
    es: 'Fecha prevista', // MT
    pt: 'Data prevista', // MT
    de: 'Erwartetes Datum', // MT
    fr: 'Date attendue', // MT
  },
  stage: {
    en: 'Stage',
    nl: 'Fase',
    es: 'Etapa', // MT
    pt: 'Etapa', // MT
    de: 'Phase', // MT
    fr: 'Étape', // MT
  },
  probability_aria: {
    en: 'Probability %',
    nl: 'Kans %',
    es: 'Probabilidad %', // MT
    pt: 'Probabilidade %', // MT
    de: 'Wahrscheinlichkeit %', // MT
    fr: 'Probabilité %', // MT
  },
  repeats: {
    en: 'Repeats',
    nl: 'Herhaalt',
    es: 'Se repite', // MT
    pt: 'Repete', // MT
    de: 'Wiederholt sich', // MT
    fr: 'Se répète', // MT
  },
  first_on: {
    en: 'First on',
    nl: 'Eerste op',
    es: 'Primera el', // MT
    pt: 'Primeira em', // MT
    de: 'Erste am', // MT
    fr: 'Première le', // MT
  },
  until_optional: {
    en: 'Until (optional)',
    nl: 'Tot (optioneel)',
    es: 'Hasta (opcional)', // MT
    pt: 'Até (opcional)', // MT
    de: 'Bis (optional)', // MT
    fr: 'Jusqu’à (facultatif)', // MT
  },
  costs_full_note: {
    en: 'Costs count in full — no pipeline stage.',
    nl: 'Kosten tellen volledig mee — geen pipelinefase.',
    es: 'Los costos cuentan al completo: sin etapa de pipeline.', // MT
    pt: 'Custos contam por inteiro — sem etapa de pipeline.', // MT
    de: 'Kosten zählen voll — keine Pipeline-Phase.', // MT
    fr: 'Les coûts comptent en entier — pas d’étape de pipeline.', // MT
  },
  costs_repeat_note: {
    en: ' For a repeating cost, set Repeats above.',
    nl: ' Voor terugkerende kosten stel je hierboven Herhaalt in.',
    es: ' Para un costo recurrente, ajusta Se repite arriba.', // MT
    pt: ' Para um custo recorrente, defina Repete acima.', // MT
    de: ' Für wiederkehrende Kosten stelle oben Wiederholt sich ein.', // MT
    fr: ' Pour un coût récurrent, règle Se répète ci-dessus.', // MT
  },
  th_offering: {
    en: 'Offering',
    nl: 'Aanbod',
    es: 'Oferta', // MT
    pt: 'Oferta', // MT
    de: 'Angebot', // MT
    fr: 'Offre', // MT
  },
  th_qty: {
    en: 'Qty',
    nl: 'Aantal',
    es: 'Cant.', // MT
    pt: 'Qtd.', // MT
    de: 'Anz.', // MT
    fr: 'Qté', // MT
  },
  th_price_eur: {
    en: 'Price €',
    nl: 'Prijs €',
    es: 'Precio €', // MT
    pt: 'Preço €', // MT
    de: 'Preis €', // MT
    fr: 'Prix €', // MT
  },
  th_amount: {
    en: 'Amount',
    nl: 'Bedrag',
    es: 'Importe', // MT
    pt: 'Valor', // MT
    de: 'Betrag', // MT
    fr: 'Montant', // MT
  },
  th_expected: {
    en: 'Expected',
    nl: 'Verwacht',
    es: 'Previsto', // MT
    pt: 'Previsto', // MT
    de: 'Erwartet', // MT
    fr: 'Attendu', // MT
  },
  offering_or_desc_ph: {
    en: 'Offering or description',
    nl: 'Aanbod of omschrijving',
    es: 'Oferta o descripción', // MT
    pt: 'Oferta ou descrição', // MT
    de: 'Angebot oder Beschreibung', // MT
    fr: 'Offre ou description', // MT
  },
  repeats_by_cadence: {
    en: 'Repeats — timed by its cadence',
    nl: 'Herhaalt — getimed door zijn ritme',
    es: 'Se repite: sigue su cadencia', // MT
    pt: 'Repete — segue sua cadência', // MT
    de: 'Wiederholt sich — getaktet durch seinen Rhythmus', // MT
    fr: 'Se répète — rythmé par sa cadence', // MT
  },
  row_date_aria: {
    en: 'Expected payment date for this row',
    nl: 'Verwachte betaaldatum voor deze regel',
    es: 'Fecha de pago prevista para esta línea', // MT
    pt: 'Data de pagamento prevista para esta linha', // MT
    de: 'Erwartetes Zahldatum für diese Zeile', // MT
    fr: 'Date de paiement attendue pour cette ligne', // MT
  },
  row_date_title: {
    en: "When this payment is expected (blank = the offer's Expected date)",
    nl: 'Wanneer deze betaling wordt verwacht (leeg = de verwachte datum van de offerte)',
    es: 'Cuándo se espera este pago (vacío = la fecha prevista de la oferta)', // MT
    pt: 'Quando este pagamento é esperado (vazio = a data prevista da proposta)', // MT
    de: 'Wann diese Zahlung erwartet wird (leer = das erwartete Datum des Angebots)', // MT
    fr: 'Quand ce paiement est attendu (vide = la date attendue de l’offre)', // MT
  },
  remove_offering_row: {
    en: 'Remove offering row',
    nl: 'Aanbodregel verwijderen',
    es: 'Quitar línea de oferta', // MT
    pt: 'Remover linha de oferta', // MT
    de: 'Angebotszeile entfernen', // MT
    fr: 'Retirer la ligne d’offre', // MT
  },
  add_offering_lc: {
    en: 'add offering',
    nl: 'aanbod toevoegen',
    es: 'añadir oferta', // MT
    pt: 'adicionar oferta', // MT
    de: 'Angebot hinzufügen', // MT
    fr: 'ajouter une offre', // MT
  },
  plus_add_offering: {
    en: '+ add offering',
    nl: '+ aanbod toevoegen',
    es: '+ añadir oferta', // MT
    pt: '+ adicionar oferta', // MT
    de: '+ Angebot hinzufügen', // MT
    fr: '+ ajouter une offre', // MT
  },
  quantity: {
    en: 'Quantity',
    nl: 'Aantal',
    es: 'Cantidad', // MT
    pt: 'Quantidade', // MT
    de: 'Anzahl', // MT
    fr: 'Quantité', // MT
  },
  unit_price_eur: {
    en: 'Unit price €',
    nl: 'Stukprijs €',
    es: 'Precio unitario €', // MT
    pt: 'Preço unitário €', // MT
    de: 'Einzelpreis €', // MT
    fr: 'Prix unitaire €', // MT
  },
  eq_deal_size: {
    en: '= deal size',
    nl: '= dealgrootte',
    es: '= tamaño del acuerdo', // MT
    pt: '= tamanho do negócio', // MT
    de: '= Dealgröße', // MT
    fr: '= taille de l’affaire', // MT
  },
  weighted: {
    en: 'Weighted',
    nl: 'Gewogen',
    es: 'Ponderado', // MT
    pt: 'Ponderado', // MT
    de: 'Gewichtet', // MT
    fr: 'Pondéré', // MT
  },
  full_price: {
    en: 'Full price',
    nl: 'Volledige prijs',
    es: 'Precio completo', // MT
    pt: 'Preço integral', // MT
    de: 'Voller Preis', // MT
    fr: 'Prix plein', // MT
  },
  no_vat: {
    en: 'No VAT',
    nl: 'Geen btw',
    es: 'Sin IVA', // MT
    pt: 'Sem IVA', // MT
    de: 'Ohne MwSt', // MT
    fr: 'Sans TVA', // MT
  },
  vat_aria: {
    en: 'VAT tariff',
    nl: 'Btw-tarief',
    es: 'Tipo de IVA', // MT
    pt: 'Alíquota de IVA', // MT
    de: 'MwSt-Satz', // MT
    fr: 'Taux de TVA', // MT
  },
  total_incl_vat: {
    en: 'Total incl VAT',
    nl: 'Totaal incl. btw',
    es: 'Total con IVA', // MT
    pt: 'Total com IVA', // MT
    de: 'Gesamt inkl. MwSt', // MT
    fr: 'Total TTC', // MT
  },
  more_options: {
    en: 'More options',
    nl: 'Meer opties',
    es: 'Más opciones', // MT
    pt: 'Mais opções', // MT
    de: 'Mehr Optionen', // MT
    fr: 'Plus d’options', // MT
  },
  offering: {
    en: 'Offering',
    nl: 'Aanbod',
    es: 'Oferta', // MT
    pt: 'Oferta', // MT
    de: 'Angebot', // MT
    fr: 'Offre', // MT
  },
  invoice_date: {
    en: 'Invoice date',
    nl: 'Factuurdatum',
    es: 'Fecha de la factura', // MT
    pt: 'Data da fatura', // MT
    de: 'Rechnungsdatum', // MT
    fr: 'Date de facture', // MT
  },
  turn_into_invoice: {
    en: 'Turn offering into an invoice',
    nl: 'Zet het aanbod om in een factuur',
    es: 'Convertir la oferta en factura', // MT
    pt: 'Transformar a oferta em fatura', // MT
    de: 'Angebot in eine Rechnung umwandeln', // MT
    fr: 'Transformer l’offre en facture', // MT
  },
  save_first_hint: {
    en: 'Save first, then invoice',
    nl: 'Eerst opslaan, dan factureren',
    es: 'Guarda primero, luego factura', // MT
    pt: 'Salve primeiro, depois fature', // MT
    de: 'Erst speichern, dann berechnen', // MT
    fr: 'Enregistre d’abord, puis facture', // MT
  },
  save_first_note: {
    en: 'Save first, then invoice.',
    nl: 'Eerst opslaan, dan factureren.',
    es: 'Guarda primero, luego factura.', // MT
    pt: 'Salve primeiro, depois fature.', // MT
    de: 'Erst speichern, dann berechnen.', // MT
    fr: 'Enregistre d’abord, puis facture.', // MT
  },
  row_fields_error: {
    en: 'Each offering row needs a name, a positive quantity and a price.',
    nl: 'Elke aanbodregel heeft een naam, een positief aantal en een prijs nodig.',
    es: 'Cada línea de oferta necesita un nombre, una cantidad positiva y un precio.', // MT
    pt: 'Cada linha de oferta precisa de um nome, uma quantidade positiva e um preço.', // MT
    de: 'Jede Angebotszeile braucht einen Namen, eine positive Anzahl und einen Preis.', // MT
    fr: 'Chaque ligne d’offre a besoin d’un nom, d’une quantité positive et d’un prix.', // MT
  },
  repeating_deal_error: {
    en: 'A repeating item needs a positive deal size (quantity × unit price).',
    nl: 'Een herhalend item heeft een positieve dealgrootte nodig (aantal × stukprijs).',
    es: 'Un elemento recurrente necesita un tamaño de acuerdo positivo (cantidad × precio unitario).', // MT
    pt: 'Um item recorrente precisa de um tamanho de negócio positivo (quantidade × preço unitário).', // MT
    de: 'Ein wiederkehrender Posten braucht eine positive Dealgröße (Anzahl × Einzelpreis).', // MT
    fr: 'Un élément récurrent a besoin d’une taille d’affaire positive (quantité × prix unitaire).', // MT
  },
  could_not_link: {
    en: 'Could not link the person to {org}: {error}',
    nl: 'Kon de persoon niet aan {org} koppelen: {error}',
    es: 'No se pudo vincular la persona a {org}: {error}', // MT
    pt: 'Não foi possível vincular a pessoa a {org}: {error}', // MT
    de: 'Die Person konnte nicht mit {org} verknüpft werden: {error}', // MT
    fr: 'Impossible de lier la personne à {org} : {error}', // MT
  },

  // ── add-person dialog ─────────────────────────────────────────────────
  add_person: {
    en: 'Add person',
    nl: 'Persoon toevoegen',
    es: 'Añadir persona', // MT
    pt: 'Adicionar pessoa', // MT
    de: 'Person hinzufügen', // MT
    fr: 'Ajouter une personne', // MT
  },
  add_person_desc: {
    en: 'Pick an existing contact or create a new one for {org}.',
    nl: 'Kies een bestaand contact of maak een nieuw aan voor {org}.',
    es: 'Elige un contacto existente o crea uno nuevo para {org}.', // MT
    pt: 'Escolha um contato existente ou crie um novo para {org}.', // MT
    de: 'Wähle einen bestehenden Kontakt oder lege einen neuen für {org} an.', // MT
    fr: 'Choisis un contact existant ou crées-en un nouveau pour {org}.', // MT
  },
  search_contacts_ph: {
    en: 'Search contacts…',
    nl: 'Zoek contacten…',
    es: 'Busca contactos…', // MT
    pt: 'Busque contatos…', // MT
    de: 'Kontakte suchen…', // MT
    fr: 'Cherche des contacts…', // MT
  },
  no_matching_contacts: {
    en: 'No matching contacts.',
    nl: 'Geen contacten gevonden.',
    es: 'No hay contactos que coincidan.', // MT
    pt: 'Nenhum contato correspondente.', // MT
    de: 'Keine passenden Kontakte.', // MT
    fr: 'Aucun contact correspondant.', // MT
  },
  back_to_search: {
    en: '← back to search',
    nl: '← terug naar zoeken',
    es: '← volver a la búsqueda', // MT
    pt: '← voltar à busca', // MT
    de: '← zurück zur Suche', // MT
    fr: '← retour à la recherche', // MT
  },
  create_link_to: {
    en: 'Create & link to {org}',
    nl: 'Aanmaken & koppelen aan {org}',
    es: 'Crear y vincular a {org}', // MT
    pt: 'Criar e vincular a {org}', // MT
    de: 'Anlegen & mit {org} verknüpfen', // MT
    fr: 'Créer et lier à {org}', // MT
  },
  create_new_person: {
    en: '+ Create new person',
    nl: '+ Nieuwe persoon aanmaken',
    es: '+ Crear nueva persona', // MT
    pt: '+ Criar nova pessoa', // MT
    de: '+ Neue Person anlegen', // MT
    fr: '+ Créer une nouvelle personne', // MT
  },
  create_new_person_q: {
    en: '+ Create new person ‘{q}’',
    nl: '+ Nieuwe persoon ‘{q}’ aanmaken',
    es: '+ Crear nueva persona «{q}»', // MT
    pt: '+ Criar nova pessoa ‘{q}’', // MT
    de: '+ Neue Person ‚{q}‘ anlegen', // MT
    fr: '+ Créer la personne « {q} »', // MT
  },
  a_name_required: {
    en: 'A name is required.',
    nl: 'Een naam is verplicht.',
    es: 'Se necesita un nombre.', // MT
    pt: 'Um nome é obrigatório.', // MT
    de: 'Ein Name ist erforderlich.', // MT
    fr: 'Un nom est requis.', // MT
  },
  could_not_create_person: {
    en: 'Could not create the person: {error}',
    nl: 'Kon de persoon niet aanmaken: {error}',
    es: 'No se pudo crear la persona: {error}', // MT
    pt: 'Não foi possível criar a pessoa: {error}', // MT
    de: 'Die Person konnte nicht angelegt werden: {error}', // MT
    fr: 'Impossible de créer la personne : {error}', // MT
  },

  // ── invoice transfer dialog ───────────────────────────────────────────
  create_invoice: {
    en: 'Create invoice',
    nl: 'Factuur aanmaken',
    es: 'Crear factura', // MT
    pt: 'Criar fatura', // MT
    de: 'Rechnung erstellen', // MT
    fr: 'Créer la facture', // MT
  },
  create_and_send: {
    en: 'Create & send',
    nl: 'Aanmaken & versturen',
    es: 'Crear y enviar', // MT
    pt: 'Criar e enviar', // MT
    de: 'Erstellen & senden', // MT
    fr: 'Créer et envoyer', // MT
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…', // MT
    pt: 'Enviando…', // MT
    de: 'Wird gesendet…', // MT
    fr: 'Envoi…', // MT
  },
  invoice_created_prefix: {
    en: 'Invoice',
    nl: 'Factuur',
    es: 'Factura', // MT
    pt: 'Fatura', // MT
    de: 'Rechnung', // MT
    fr: 'Facture', // MT
  },
  invoice_created_suffix: {
    en: 'created.',
    nl: 'aangemaakt.',
    es: 'creada.', // MT
    pt: 'criada.', // MT
    de: 'erstellt.', // MT
    fr: 'créée.', // MT
  },
  sent_to: {
    en: 'Sent to {email}.',
    nl: 'Verstuurd naar {email}.',
    es: 'Enviada a {email}.', // MT
    pt: 'Enviada para {email}.', // MT
    de: 'Gesendet an {email}.', // MT
    fr: 'Envoyée à {email}.', // MT
  },
  the_counterparty: {
    en: 'the counterparty',
    nl: 'de tegenpartij',
    es: 'la contraparte', // MT
    pt: 'a contraparte', // MT
    de: 'die Gegenpartei', // MT
    fr: 'la contrepartie', // MT
  },
  saved_not_sent: {
    en: 'Saved — not sent.',
    nl: 'Opgeslagen — niet verstuurd.',
    es: 'Guardada, sin enviar.', // MT
    pt: 'Salva — não enviada.', // MT
    de: 'Gespeichert — nicht gesendet.', // MT
    fr: 'Enregistrée — non envoyée.', // MT
  },
  invoice_number_hint: {
    en: "The number is assigned from Settings → Planner → Invoicing (next in the sequence). This transfers the opportunity to the invoices ledger and can't be undone here.",
    nl: 'Het nummer komt uit Instellingen → Planner → Facturatie (volgende in de reeks). Dit zet de kans over naar het facturenboek en is hier niet terug te draaien.',
    es: 'El número se asigna desde Ajustes → Planificador → Facturación (siguiente de la secuencia). Esto pasa la oportunidad al libro de facturas y no se puede deshacer aquí.', // MT
    pt: 'O número vem de Configurações → Planejador → Faturamento (próximo da sequência). Isto transfere a oportunidade para o livro de faturas e não pode ser desfeito aqui.', // MT
    de: 'Die Nummer kommt aus Einstellungen → Planer → Rechnungsstellung (nächste der Sequenz). Das überträgt die Chance ins Rechnungsbuch und lässt sich hier nicht rückgängig machen.', // MT
    fr: 'Le numéro vient de Paramètres → Planificateur → Facturation (le prochain de la séquence). Cela transfère l’opportunité au registre des factures et ne peut pas être annulé ici.', // MT
  },
  uses_saved_hint: {
    en: 'Uses the saved opportunity — save your changes first if you edited anything.',
    nl: 'Gebruikt de opgeslagen kans — sla je wijzigingen eerst op als je iets hebt aangepast.',
    es: 'Usa la oportunidad guardada: guarda tus cambios primero si editaste algo.', // MT
    pt: 'Usa a oportunidade salva — salve suas mudanças primeiro se editou algo.', // MT
    de: 'Nutzt die gespeicherte Chance — speichere zuerst, wenn du etwas geändert hast.', // MT
    fr: 'Utilise l’opportunité enregistrée — enregistre d’abord tes modifications si tu as édité quelque chose.', // MT
  },
  no_email_warning: {
    en: 'No email on the contact person — “Create & send” needs one; you can still create the invoice and send it later from the Invoices area.',
    nl: 'Geen e-mailadres bij de contactpersoon — “Aanmaken & versturen” heeft er een nodig; je kunt de factuur wel aanmaken en later versturen vanuit Facturen.',
    es: 'El contacto no tiene correo: «Crear y enviar» necesita uno; aun así puedes crear la factura y enviarla luego desde Facturas.', // MT
    pt: 'O contato não tem e-mail — “Criar e enviar” precisa de um; você ainda pode criar a fatura e enviá-la depois pela área Faturas.', // MT
    de: 'Keine E-Mail bei der Kontaktperson — „Erstellen & senden“ braucht eine; du kannst die Rechnung trotzdem erstellen und später aus dem Bereich Rechnungen senden.', // MT
    fr: 'Pas d’e-mail sur le contact — « Créer et envoyer » en a besoin ; tu peux quand même créer la facture et l’envoyer plus tard depuis Factures.', // MT
  },
  could_not_create_invoice: {
    en: 'Could not create the invoice: {error}',
    nl: 'Kon de factuur niet aanmaken: {error}',
    es: 'No se pudo crear la factura: {error}', // MT
    pt: 'Não foi possível criar a fatura: {error}', // MT
    de: 'Die Rechnung konnte nicht erstellt werden: {error}', // MT
    fr: 'Impossible de créer la facture : {error}', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type UiKey = keyof typeof CATALOG;
