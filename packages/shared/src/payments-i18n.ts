// The payments settings copy, once, for every app that shows it.
//
// Sjoerd, 2026-09-23: *"the settings for my company: payment etc. is needed in
// 4 apps, but it does not show in the fibre settings... I expect that reusable
// items are always there."* The DATA has been platform-level since
// 2026-07-04 — personal on user_profile, workspace on the workspace row — and
// the FORM became shared on 2026-09-24. The strings were the last copy: four
// catalogues holding the same sentences under different key names, which is
// why the shared form takes a typed object instead of doing a key lookup.
//
// Lifted verbatim from apps/thread (design-leading, per CLAUDE.md) so nothing
// is retranslated and nothing drifts. An app adopting this drops 37 keys from
// its own catalogue; none has to, and none is touched here.

import type { Locale } from './index.js';

type Entry = Record<Locale, string>;

const COPY: Record<string, Entry> = {
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
  personal_account: {
    en: 'Personal account',
    nl: 'Persoonlijk account',
    es: 'Cuenta personal', // MT
    pt: 'Conta pessoal', // MT
    de: 'Persönliches Konto', // MT
    fr: 'Compte personnel', // MT
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
  saving: {
    en: 'Saving…',
    nl: 'Opslaan…',
    es: 'Guardando…', // MT
    pt: 'Salvando…', // MT
    de: 'Wird gespeichert…', // MT
    fr: 'Enregistrement…', // MT
  },
  save: {
    en: 'Save',
    nl: 'Opslaan',
    es: 'Guardar', // MT
    pt: 'Salvar', // MT
    de: 'Speichern', // MT
    fr: 'Enregistrer', // MT
  },
  saved: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
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
  connect_stripe: {
    en: 'Connect Stripe',
    nl: 'Stripe koppelen',
    es: 'Conectar Stripe', // MT
    pt: 'Conectar o Stripe', // MT
    de: 'Stripe verbinden', // MT
    fr: 'Connecter Stripe', // MT
  },
  connect_stripe_change: {
    en: 'Connect a different account',
    nl: 'Een andere rekening koppelen',
    es: 'Conectar otra cuenta', // MT
    pt: 'Ligar outra conta', // MT
    de: 'Ein anderes Konto verbinden', // MT
    fr: 'Connecter un autre compte', // MT
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
};

/** Every string the shared PaymentsForm needs, in one call. */
export function paymentsStrings(locale: Locale) {
  const s = (k: string) => COPY[k]?.[locale] ?? COPY[k]?.en ?? k;
  return {
    personalAccount: s('personal_account'),
    personalAccountDesc: s('my_account_desc'),
    workspaceAccount: s('workspace_account'),
    workspaceAccountDesc: s('workspace_account_desc'),
    methodsHintWorkspace: s('methods_hint_workspace'),
    methodsHintPersonal: s('methods_hint_personal'),
    managedByAdmins: s('managed_by_admins'),
    stripeNote1: s('stripe_note_1'),
    stripeNote2: s('stripe_note_2'),
    whatIsThis: s('what_is_this'),
    connected: s('connected'),
    notConnected: s('not_connected'),
    stripeAccountId: s('stripe_account_id'),
    legalName: s('legal_name_on_invoices'),
    taxNumber: s('tax_vat_number'),
    address: s('address_on_invoices'),
    vatOnSales: s('vat_on_sales'),
    vatRegistered: s('vat_registered_label'),
    rate: s('rate'),
    vatIncludedNote: s('vat_included_note'),
    defaultPaymentOptions: s('default_payment_options'),
    payOnlineCard: s('pay_online_card'),
    payPerInvoice: s('pay_per_invoice'),
    saving: s('saving'),
    save: s('save'),
    saved: s('saved'),
    errAcctPrefix: s('err_acct_prefix'),
    errKeepOneMethod: s('err_keep_one_method'),
    errVatRate: s('err_vat_rate'),
    connectStripe: s('connect_stripe'),
    connectStripeChange: s('connect_stripe_change'),
    connectStripeNote: s('connect_stripe_note'),
    opening: s('opening'),
    stripeUnreachable: s('stripe_unreachable'),
    stripeUnreachableNote: s('stripe_unreachable_note'),
    stripeChargesDisabled: s('stripe_charges_disabled'),
    errConnectFailed: s('err_connect_failed'),
    website: s('website_on_invoices'),
    tabPersonal: s('tab_personal_organiser'),
    tabWorkspace: s('workspace_account'),
    tabWorkspaceOf: s('tab_workspace_of'),
    testPaymentTitle: s('test_payment_title'),
    testPaymentNote: s('test_payment_note'),
    testPaymentAmount: s('test_payment_amount'),
    testPayment: s('test_payment'),
    testPaymentOpening: s('test_payment_opening'),
    errTestPayment: s('err_test_payment'),
  };
}
