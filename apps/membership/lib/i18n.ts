// Membership — public-surface translations (i18n P1, 2026-09-05).
//
// THE RULE: every string a visitor or member can see (public join page,
// joined page, embeds, /my portal) lives HERE, in all six languages. The
// catalog is typed so a key missing a translation fails `pnpm typecheck` —
// that is how the list stays complete as the product grows.
//
// Internal/admin UI stays English; this is for the outside world.
// Tier names, descriptions and characteristics are workspace-authored
// CONTENT — never translated here.
//
// Register: informal (je / du / tu / tú / você).
// Lines marked // MT are machine-drafted — native review welcome.
// NL is unmarked: Sjoerd reviews it pre-ship.

import { makeT, type I18nEntry } from '@thefibre/shared/i18n';

// Re-export the shared locale primitives so pages import ONE module.
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  INTL_LOCALES,
  isLocale,
  toLocale,
} from '@thefibre/shared/i18n';
export type { Locale } from '@thefibre/shared/i18n';

const CATALOG = {
  // ── shared ────────────────────────────────────────────────────────────
  powered_by: {
    en: 'Powered by',
    nl: 'Mogelijk gemaakt door',
    es: 'Desarrollado por', // MT
    pt: 'Desenvolvido por', // MT
    de: 'Bereitgestellt von', // MT
    fr: 'Propulsé par', // MT
  },

  // ── public join page ─────────────────────────────────────────────────
  join_headline: {
    en: 'Join {name}',
    nl: 'Word lid van {name}',
    es: 'Únete a {name}', // MT
    pt: 'Junte-se a {name}', // MT
    de: 'Werde Mitglied bei {name}', // MT
    fr: 'Rejoins {name}', // MT
  },
  checkout_cancelled: {
    en: "Checkout was cancelled — nothing was charged. Pick a tier below whenever you're ready.",
    nl: 'De betaling is geannuleerd — er is niets afgeschreven. Kies hieronder een lidmaatschap wanneer je er klaar voor bent.',
    es: 'El pago se canceló — no se cobró nada. Elige un nivel abajo cuando quieras.', // MT
    pt: 'O pagamento foi cancelado — nada foi cobrado. Escolha um nível abaixo quando quiser.', // MT
    de: 'Die Zahlung wurde abgebrochen — es wurde nichts abgebucht. Wähle unten eine Mitgliedschaft, wann immer du bereit bist.', // MT
    fr: 'Le paiement a été annulé — rien n’a été débité. Choisis une formule ci-dessous quand tu es prêt·e.', // MT
  },
  no_tiers: {
    en: 'No membership tiers are available yet — check back soon.',
    nl: 'Er zijn nog geen lidmaatschappen beschikbaar — kom snel terug.',
    es: 'Aún no hay niveles de membresía disponibles — vuelve pronto.', // MT
    pt: 'Ainda não há níveis de associação disponíveis — volte em breve.', // MT
    de: 'Es sind noch keine Mitgliedschaften verfügbar — schau bald wieder vorbei.', // MT
    fr: 'Aucune formule d’adhésion n’est disponible pour le moment — reviens bientôt.', // MT
  },

  // ── tier cards + join form ───────────────────────────────────────────
  country_question: {
    en: 'Where are you based? Prices adjust to your country.',
    nl: 'Waar woon je? De prijzen passen zich aan je land aan.',
    es: '¿Dónde vives? Los precios se ajustan a tu país.', // MT
    pt: 'Onde você mora? Os preços se ajustam ao seu país.', // MT
    de: 'Wo wohnst du? Die Preise passen sich deinem Land an.', // MT
    fr: 'Où habites-tu ? Les prix s’ajustent à ton pays.', // MT
  },
  country_placeholder: {
    en: 'Pick your country…',
    nl: 'Kies je land…',
    es: 'Elige tu país…', // MT
    pt: 'Escolha seu país…', // MT
    de: 'Wähle dein Land…', // MT
    fr: 'Choisis ton pays…', // MT
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
  or_month: {
    en: 'or {price} / month',
    nl: 'of {price} / maand',
    es: 'o {price} / mes', // MT
    pt: 'ou {price} / mês', // MT
    de: 'oder {price} / Monat', // MT
    fr: 'ou {price} / mois', // MT
  },
  price_on_request: {
    en: 'Price on request',
    nl: 'Prijs op aanvraag',
    es: 'Precio a consultar', // MT
    pt: 'Preço sob consulta', // MT
    de: 'Preis auf Anfrage', // MT
    fr: 'Prix sur demande', // MT
  },
  includes: {
    en: 'Includes',
    nl: 'Inclusief',
    es: 'Incluye', // MT
    pt: 'Inclui', // MT
    de: 'Enthält', // MT
    fr: 'Comprend', // MT
  },
  already_member_note: {
    en: "You're already a member — check your email for sign-in.",
    nl: 'Je bent al lid — kijk in je e-mail om in te loggen.',
    es: 'Ya eres miembro — revisa tu correo para iniciar sesión.', // MT
    pt: 'Você já é membro — verifique seu e-mail para entrar.', // MT
    de: 'Du bist bereits Mitglied — sieh in deinem Postfach nach, um dich anzumelden.', // MT
    fr: 'Tu es déjà membre — vérifie tes e-mails pour te connecter.', // MT
  },
  join: {
    en: 'Join',
    nl: 'Word lid',
    es: 'Únete', // MT
    pt: 'Associe-se', // MT
    de: 'Mitglied werden', // MT
    fr: 'Rejoindre', // MT
  },
  your_name: {
    en: 'Your name',
    nl: 'Je naam',
    es: 'Tu nombre', // MT
    pt: 'Seu nome', // MT
    de: 'Dein Name', // MT
    fr: 'Ton nom', // MT
  },
  email_placeholder: {
    en: 'you@example.com',
    nl: 'jij@example.com',
    es: 'tu@example.com', // MT
    pt: 'voce@example.com', // MT
    de: 'du@example.com', // MT
    fr: 'toi@example.com', // MT
  },
  fill_name_email: {
    en: 'Please fill in your name and email.',
    nl: 'Vul je naam en e-mailadres in.',
    es: 'Completa tu nombre y correo electrónico.', // MT
    pt: 'Preencha seu nome e e-mail.', // MT
    de: 'Bitte gib deinen Namen und deine E-Mail-Adresse an.', // MT
    fr: 'Renseigne ton nom et ton adresse e-mail.', // MT
  },
  something_wrong: {
    en: 'Something went wrong — please try again.',
    nl: 'Er ging iets mis — probeer het opnieuw.',
    es: 'Algo salió mal — inténtalo de nuevo.', // MT
    pt: 'Algo deu errado — tente novamente.', // MT
    de: 'Etwas ist schiefgelaufen — bitte versuche es erneut.', // MT
    fr: 'Une erreur s’est produite — réessaie.', // MT
  },
  continue_to_payment: {
    en: 'Continue to payment',
    nl: 'Door naar betalen',
    es: 'Continuar al pago', // MT
    pt: 'Continuar para o pagamento', // MT
    de: 'Weiter zur Zahlung', // MT
    fr: 'Continuer vers le paiement', // MT
  },
  taking_to_payment: {
    en: 'Taking you to payment…',
    nl: 'Je gaat nu naar de betaalpagina…',
    es: 'Te llevamos al pago…', // MT
    pt: 'Levando você para o pagamento…', // MT
    de: 'Du wirst zur Zahlung weitergeleitet…', // MT
    fr: 'Redirection vers le paiement…', // MT
  },
  one_moment: {
    en: 'One moment…',
    nl: 'Een ogenblik…',
    es: 'Un momento…', // MT
    pt: 'Um momento…', // MT
    de: 'Einen Moment…', // MT
    fr: 'Un instant…', // MT
  },
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren',
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Abbrechen', // MT
    fr: 'Annuler', // MT
  },

  // ── à-la-carte products (buy standalone) ─────────────────────────────
  products_headline: {
    en: 'Also available',
    nl: 'Ook verkrijgbaar',
    es: 'También disponible', // MT
    pt: 'Também disponível', // MT
    de: 'Auch erhältlich', // MT
    fr: 'Également disponible', // MT
  },
  one_off: {
    en: 'one-off',
    nl: 'eenmalig',
    es: 'pago único', // MT
    pt: 'pagamento único', // MT
    de: 'einmalig', // MT
    fr: 'paiement unique', // MT
  },
  buy: {
    en: 'Buy',
    nl: 'Kopen',
    es: 'Comprar', // MT
    pt: 'Comprar', // MT
    de: 'Kaufen', // MT
    fr: 'Acheter', // MT
  },
  already_purchased_note: {
    en: 'You already own this — check your email for sign-in.',
    nl: 'Je hebt dit al — kijk in je e-mail om in te loggen.',
    es: 'Ya lo tienes — revisa tu correo para iniciar sesión.', // MT
    pt: 'Você já tem isto — verifique seu e-mail para entrar.', // MT
    de: 'Das gehört dir schon — sieh in deinem Postfach nach, um dich anzumelden.', // MT
    fr: 'Tu le possèdes déjà — vérifie tes e-mails pour te connecter.', // MT
  },

  // ── purchased (success) page ─────────────────────────────────────────
  purchased_thanks: {
    en: 'Thank you for your purchase!',
    nl: 'Bedankt voor je aankoop!',
    es: '¡Gracias por tu compra!', // MT
    pt: 'Obrigado pela sua compra!', // MT
    de: 'Danke für deinen Kauf!', // MT
    fr: 'Merci pour ton achat !', // MT
  },
  purchased_note: {
    en: 'Your purchase is confirmed — a receipt with your access links is on its way to your inbox.',
    nl: 'Je aankoop is bevestigd — een bevestiging met je toegangslinks is onderweg naar je inbox.',
    es: 'Tu compra está confirmada — te llegará un recibo con tus enlaces de acceso al correo.', // MT
    pt: 'Sua compra está confirmada — um recibo com seus links de acesso está a caminho do seu e-mail.', // MT
    de: 'Dein Kauf ist bestätigt — eine Quittung mit deinen Zugangslinks ist auf dem Weg in dein Postfach.', // MT
    fr: 'Ton achat est confirmé — un reçu avec tes liens d’accès arrive dans ta boîte mail.', // MT
  },
  view_purchases: {
    en: 'View your purchases',
    nl: 'Bekijk je aankopen',
    es: 'Ver tus compras', // MT
    pt: 'Ver suas compras', // MT
    de: 'Deine Käufe ansehen', // MT
    fr: 'Voir tes achats', // MT
  },

  // ── joined (success) page ────────────────────────────────────────────
  joined_welcome: {
    en: 'Welcome to {name}!',
    nl: 'Welkom bij {name}!',
    es: '¡Te damos la bienvenida a {name}!', // MT
    pt: 'Boas-vindas a {name}!', // MT
    de: 'Willkommen bei {name}!', // MT
    fr: 'Bienvenue chez {name} !', // MT
  },
  joined_active: {
    en: 'Your membership is active — a confirmation is on its way to your inbox.',
    nl: 'Je lidmaatschap is actief — een bevestiging is onderweg naar je inbox.',
    es: 'Tu membresía está activa — te llegará una confirmación a tu correo.', // MT
    pt: 'Sua associação está ativa — uma confirmação está a caminho do seu e-mail.', // MT
    de: 'Deine Mitgliedschaft ist aktiv — eine Bestätigung ist auf dem Weg in dein Postfach.', // MT
    fr: 'Ton adhésion est active — une confirmation arrive dans ta boîte mail.', // MT
  },
  view_membership: {
    en: 'View your membership',
    nl: 'Bekijk je lidmaatschap',
    es: 'Ver tu membresía', // MT
    pt: 'Ver sua associação', // MT
    de: 'Deine Mitgliedschaft ansehen', // MT
    fr: 'Voir ton adhésion', // MT
  },
  back_to: {
    en: 'Back to {name}',
    nl: 'Terug naar {name}',
    es: 'Volver a {name}', // MT
    pt: 'Voltar para {name}', // MT
    de: 'Zurück zu {name}', // MT
    fr: 'Retour à {name}', // MT
  },

  // ── embeds ───────────────────────────────────────────────────────────
  community_not_found: {
    en: 'This community was not found.',
    nl: 'Deze community is niet gevonden.',
    es: 'No se encontró esta comunidad.', // MT
    pt: 'Esta comunidade não foi encontrada.', // MT
    de: 'Diese Community wurde nicht gefunden.', // MT
    fr: 'Cette communauté est introuvable.', // MT
  },
  no_tiers_short: {
    en: 'No membership tiers are available yet.',
    nl: 'Er zijn nog geen lidmaatschappen beschikbaar.',
    es: 'Aún no hay niveles de membresía disponibles.', // MT
    pt: 'Ainda não há níveis de associação disponíveis.', // MT
    de: 'Es sind noch keine Mitgliedschaften verfügbar.', // MT
    fr: 'Aucune formule d’adhésion n’est disponible pour le moment.', // MT
  },
  become_member: {
    en: 'Become a member',
    nl: 'Word lid',
    es: 'Hazte miembro', // MT
    pt: 'Torne-se membro', // MT
    de: 'Mitglied werden', // MT
    fr: 'Devenir membre', // MT
  },

  // ── /my member portal ────────────────────────────────────────────────
  my_memberships: {
    en: 'My memberships',
    nl: 'Mijn lidmaatschappen',
    es: 'Mis membresías', // MT
    pt: 'Minhas associações', // MT
    de: 'Meine Mitgliedschaften', // MT
    fr: 'Mes adhésions', // MT
  },
  signed_out_note: {
    en: 'Sign in with the email your membership is registered under to see your memberships, invoices and payment settings.',
    nl: 'Log in met het e-mailadres waarop je lidmaatschap staat om je lidmaatschappen, facturen en betaalinstellingen te zien.',
    es: 'Inicia sesión con el correo con el que está registrada tu membresía para ver tus membresías, facturas y ajustes de pago.', // MT
    pt: 'Entre com o e-mail em que sua associação está registrada para ver suas associações, faturas e configurações de pagamento.', // MT
    de: 'Melde dich mit der E-Mail-Adresse an, unter der deine Mitgliedschaft registriert ist, um deine Mitgliedschaften, Rechnungen und Zahlungseinstellungen zu sehen.', // MT
    fr: 'Connecte-toi avec l’adresse e-mail de ton adhésion pour voir tes adhésions, factures et paramètres de paiement.', // MT
  },
  no_memberships: {
    en: 'No memberships are linked to this email yet.',
    nl: 'Er zijn nog geen lidmaatschappen gekoppeld aan dit e-mailadres.',
    es: 'Aún no hay membresías vinculadas a este correo.', // MT
    pt: 'Ainda não há associações vinculadas a este e-mail.', // MT
    de: 'Mit dieser E-Mail-Adresse sind noch keine Mitgliedschaften verknüpft.', // MT
    fr: 'Aucune adhésion n’est encore liée à cette adresse e-mail.', // MT
  },
  renews_on: {
    en: 'Renews on {date}',
    nl: 'Verlengt op {date}',
    es: 'Se renueva el {date}', // MT
    pt: 'Renova em {date}', // MT
    de: 'Verlängert sich am {date}', // MT
    fr: 'Se renouvelle le {date}', // MT
  },
  invoices_count: {
    en: 'Invoices ({n})',
    nl: 'Facturen ({n})',
    es: 'Facturas ({n})', // MT
    pt: 'Faturas ({n})', // MT
    de: 'Rechnungen ({n})', // MT
    fr: 'Factures ({n})', // MT
  },
  view: {
    en: 'View',
    nl: 'Bekijken',
    es: 'Ver', // MT
    pt: 'Ver', // MT
    de: 'Ansehen', // MT
    fr: 'Voir', // MT
  },
  status_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activa', // MT
    pt: 'Ativa', // MT
    de: 'Aktiv', // MT
    fr: 'Active', // MT
  },
  status_grace: {
    en: 'Grace period',
    nl: 'Respijtperiode',
    es: 'Período de gracia', // MT
    pt: 'Período de carência', // MT
    de: 'Nachfrist', // MT
    fr: 'Période de grâce', // MT
  },
  status_lapsed: {
    en: 'Lapsed',
    nl: 'Verlopen',
    es: 'Vencida', // MT
    pt: 'Expirada', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expirée', // MT
  },
  status_cancelled: {
    en: 'Cancelled',
    nl: 'Opgezegd',
    es: 'Cancelada', // MT
    pt: 'Cancelada', // MT
    de: 'Gekündigt', // MT
    fr: 'Annulée', // MT
  },
  my_products: {
    en: 'My products',
    nl: 'Mijn producten',
    es: 'Mis productos', // MT
    pt: 'Meus produtos', // MT
    de: 'Meine Produkte', // MT
    fr: 'Mes produits', // MT
  },
  purchased_on: {
    en: 'Purchased on {date}',
    nl: 'Gekocht op {date}',
    es: 'Comprado el {date}', // MT
    pt: 'Comprado em {date}', // MT
    de: 'Gekauft am {date}', // MT
    fr: 'Acheté le {date}', // MT
  },
  open_link: {
    en: 'Open',
    nl: 'Openen',
    es: 'Abrir', // MT
    pt: 'Abrir', // MT
    de: 'Öffnen', // MT
    fr: 'Ouvrir', // MT
  },
  managed_by_community: {
    en: 'This membership is managed by the community — contact them to make changes.',
    nl: 'Dit lidmaatschap wordt beheerd door de community — neem contact met ze op om iets te wijzigen.',
    es: 'Esta membresía la gestiona la comunidad — contáctalos para hacer cambios.', // MT
    pt: 'Esta associação é gerenciada pela comunidade — entre em contato para fazer alterações.', // MT
    de: 'Diese Mitgliedschaft wird von der Community verwaltet — wende dich für Änderungen an sie.', // MT
    fr: 'Cette adhésion est gérée par la communauté — contacte-la pour toute modification.', // MT
  },
  manage_payment: {
    en: 'Manage payment',
    nl: 'Betaling beheren',
    es: 'Gestionar el pago', // MT
    pt: 'Gerenciar pagamento', // MT
    de: 'Zahlung verwalten', // MT
    fr: 'Gérer le paiement', // MT
  },
  opening: {
    en: 'Opening…',
    nl: 'Openen…',
    es: 'Abriendo…', // MT
    pt: 'Abrindo…', // MT
    de: 'Wird geöffnet…', // MT
    fr: 'Ouverture…', // MT
  },
  session_expired: {
    en: 'Your session expired — reload the page and sign in again.',
    nl: 'Je sessie is verlopen — herlaad de pagina en log opnieuw in.',
    es: 'Tu sesión caducó — recarga la página e inicia sesión de nuevo.', // MT
    pt: 'Sua sessão expirou — recarregue a página e entre novamente.', // MT
    de: 'Deine Sitzung ist abgelaufen — lade die Seite neu und melde dich erneut an.', // MT
    fr: 'Ta session a expiré — recharge la page et reconnecte-toi.', // MT
  },
  portal_error: {
    en: 'Could not open the payment portal — try again shortly.',
    nl: 'Het betaalportaal kon niet worden geopend — probeer het zo opnieuw.',
    es: 'No se pudo abrir el portal de pagos — inténtalo de nuevo en un momento.', // MT
    pt: 'Não foi possível abrir o portal de pagamento — tente novamente em instantes.', // MT
    de: 'Das Zahlungsportal konnte nicht geöffnet werden — versuche es gleich noch einmal.', // MT
    fr: 'Impossible d’ouvrir le portail de paiement — réessaie dans un instant.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const t = makeT(CATALOG);
export type I18nKey = keyof typeof CATALOG;
