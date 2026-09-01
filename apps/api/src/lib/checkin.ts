// Check-in tickets: the QR, and the two wallet passes.
//
// The check-in code (thread_enrolment.checkin_code) is a capability with a
// deliberately small blast radius: everything it unlocks is READ — the QR
// image, a wallet pass carrying the same QR, the check-in page. Actually
// checking someone in always requires a signed-in organiser with authority
// on the thread. Leak a ticket and the worst outcome is that a stranger can
// see the page a door volunteer sees.
//
// Both wallet integrations are env-gated because their credentials are
// issuer accounts only Sjoerd can create (an Apple Pass Type ID certificate;
// a Google Wallet issuer + service account). Same pattern as the Stripe
// webhook secret: the code path ships ready, the email only offers the
// buttons once the platform can honour them. Setup steps live in
// docs/build-plan.md.

import { SignJWT, importPKCS8 } from 'jose';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type AppleWalletConfig = {
  certPem: string;
  keyPem: string;
  keyPassphrase: string | undefined;
  wwdrPem: string;
  passTypeId: string;
  teamId: string;
};

export function appleWalletConfig(): AppleWalletConfig | null {
  const {
    APPLE_WALLET_CERT_PEM: certPem,
    APPLE_WALLET_KEY_PEM: keyPem,
    APPLE_WALLET_WWDR_PEM: wwdrPem,
    APPLE_WALLET_PASS_TYPE_ID: passTypeId,
    APPLE_WALLET_TEAM_ID: teamId,
  } = process.env;
  if (!certPem || !keyPem || !wwdrPem || !passTypeId || !teamId) return null;
  return {
    certPem,
    keyPem,
    keyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE || undefined,
    wwdrPem,
    passTypeId,
    teamId,
  };
}

export type GoogleWalletConfig = {
  issuerId: string;
  saEmail: string;
  saKeyPem: string;
};

export function googleWalletConfig(): GoogleWalletConfig | null {
  const {
    GOOGLE_WALLET_ISSUER_ID: issuerId,
    GOOGLE_WALLET_SA_EMAIL: saEmail,
    GOOGLE_WALLET_SA_KEY_PEM: saKeyPem,
  } = process.env;
  if (!issuerId || !saEmail || !saKeyPem) return null;
  return { issuerId, saEmail, saKeyPem };
}

// ---------------------------------------------------------------------------
// The ticket, described once — both passes and the email render this.
// ---------------------------------------------------------------------------

export type Ticket = {
  /** thread_enrolment.checkin_code */
  code: string;
  participantName: string;
  threadTitle: string;
  organiserName: string;
  startsOn: string | null; // YYYY-MM-DD
  location: string | null;
  /** What the QR encodes — the check-in page URL. */
  checkinUrl: string;
};

// ---------------------------------------------------------------------------
// Apple — a .pkpass event ticket.
// ---------------------------------------------------------------------------

// pkpass requires an icon; a plain brand-yellow square, embedded so the
// bundle needs no asset pipeline.
const ICON_29 =
  'iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAIAAADZ8fBYAAAAJklEQVR4nGN4tZmDFohh1NxRc0fNHTV31NxRc0fNHTV31NxBZS4AKWRnWduzAf8AAAAASUVORK5CYII=';
const ICON_58 =
  'iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAIAAABu2d1/AAAATUlEQVR4nO3OQQ0AMAgEMJ74tzJXUzEL+x0kTSqgdU8vUvGB7hi6urq6urq6urppurq6urq6urq6abq6urq6urq6umm6urq6urq6uj8eeH6dcKnY1gwAAAAASUVORK5CYII=';

export async function appleWalletPass(cfg: AppleWalletConfig, t: Ticket): Promise<Buffer> {
  const { PKPass } = await import('passkit-generator');

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    organizationName: t.organiserName || 'Thread',
    serialNumber: t.code,
    description: t.threadTitle,
    foregroundColor: 'rgb(23,23,23)',
    backgroundColor: 'rgb(250,250,249)',
    labelColor: 'rgb(82,82,82)',
    eventTicket: {
      primaryFields: [{ key: 'event', label: 'EVENT', value: t.threadTitle }],
      secondaryFields: [
        { key: 'name', label: 'NAME', value: t.participantName },
        ...(t.startsOn ? [{ key: 'date', label: 'DATE', value: t.startsOn }] : []),
      ],
      auxiliaryFields: t.location
        ? [{ key: 'where', label: 'WHERE', value: t.location }]
        : [],
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: t.checkinUrl,
        messageEncoding: 'iso-8859-1',
        altText: t.code.slice(0, 8),
      },
    ],
  };

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': Buffer.from(ICON_29, 'base64'),
      'icon@2x.png': Buffer.from(ICON_58, 'base64'),
    },
    {
      wwdr: cfg.wwdrPem,
      signerCert: cfg.certPem,
      signerKey: cfg.keyPem,
      ...(cfg.keyPassphrase ? { signerKeyPassphrase: cfg.keyPassphrase } : {}),
    },
  );
  return pass.getAsBuffer();
}

// ---------------------------------------------------------------------------
// Google — a "Save to Google Wallet" URL. The whole object rides inside a
// signed JWT; no Wallet API round-trip, no state on Google's side until the
// user saves it.
// ---------------------------------------------------------------------------

export async function googleWalletSaveUrl(cfg: GoogleWalletConfig, t: Ticket): Promise<string> {
  const classId = `${cfg.issuerId}.the_thread_ticket`;
  const objectId = `${cfg.issuerId}.${t.code}`;

  const payload = {
    eventTicketClasses: [
      {
        id: classId,
        issuerName: 'Thread',
        eventName: { defaultValue: { language: 'en', value: t.threadTitle } },
        reviewStatus: 'UNDER_REVIEW',
      },
    ],
    eventTicketObjects: [
      {
        id: objectId,
        classId,
        state: 'ACTIVE',
        ticketHolderName: t.participantName,
        hexBackgroundColor: '#fafaf9',
        barcode: { type: 'QR_CODE', value: t.checkinUrl, alternateText: t.code.slice(0, 8) },
        textModulesData: [
          { header: 'Event', body: t.threadTitle, id: 'event' },
          ...(t.startsOn ? [{ header: 'Date', body: t.startsOn, id: 'date' }] : []),
          ...(t.location ? [{ header: 'Where', body: t.location, id: 'where' }] : []),
        ],
      },
    ],
  };

  const key = await importPKCS8(cfg.saKeyPem.replace(/\\n/g, '\n'), 'RS256');
  const jwt = await new SignJWT({ payload, typ: 'savetowallet', origins: [] })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(cfg.saEmail)
    .setAudience('google')
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
