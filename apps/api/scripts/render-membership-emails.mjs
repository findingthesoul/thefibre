// Render the membership emails to files, so somebody can LOOK at them.
//
//   node apps/api/scripts/render-membership-emails.mjs [outDir]
//
// WHY A SCRIPT. These are the first things a new member receives, and until
// now the only way to see one was to join something — which sends a real
// email to a real address. This renders them from the templates with no
// network, no database and nothing sent, so the welcome can be read and
// argued about before anybody gets it.
//
// The sample is Sjoerd's own production tier (soul.com, "Community member"),
// because a template that reads well with invented content is not evidence
// about the content it will actually carry.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  membershipWelcome,
  membershipRenewalReminder,
} from '../dist/lib/email/membership-templates.js';

const outDir = process.argv[2] ?? 'email-samples';
mkdirSync(outDir, { recursive: true });

const COMMUNITY = 'soul.com';
const BRAND = { logoUrl: '', name: COMMUNITY };

const samples = [
  {
    file: 'welcome-en',
    msg: membershipWelcome({
      name: 'Marja',
      communityName: COMMUNITY,
      tierName: 'Community member',
      renewsAt: '2027-01-01T00:00:00Z',
      tierDescription: 'Membership of the soul.com community.',
      characteristics: [
        'Access to the member list',
        'The community calendar, with everything you can join',
        'A members-only rate on every programme',
      ],
      calendarTeamName: 'soul.com',
      portalUrl: 'https://my.thethread.app/memberships',
      email: 'marja@example.com',
      locale: 'en',
      brand: BRAND,
    }),
  },
  {
    // The same email with nothing optional filled in: no description, no
    // ticks, no calendar, no portal URL. This is the one that shows whether
    // the template holds together when a community has written little — the
    // version a careless reading would never check.
    file: 'welcome-en-bare',
    msg: membershipWelcome({
      name: 'Marja',
      communityName: COMMUNITY,
      tierName: 'Community member',
      renewsAt: null,
      locale: 'en',
      brand: BRAND,
    }),
  },
  {
    file: 'welcome-nl',
    msg: membershipWelcome({
      name: 'Marja',
      communityName: COMMUNITY,
      tierName: 'Community member',
      renewsAt: '2027-01-01T00:00:00Z',
      tierDescription: 'Lidmaatschap van de soul.com-community.',
      characteristics: ['Toegang tot de ledenlijst', 'De agenda van de community'],
      calendarTeamName: 'soul.com',
      portalUrl: 'https://my.thethread.app/memberships',
      email: 'marja@example.com',
      locale: 'nl',
      brand: BRAND,
    }),
  },
  {
    file: 'renewal-en',
    msg: membershipRenewalReminder({
      name: 'Marja',
      communityName: COMMUNITY,
      tierName: 'Community member',
      renewsAt: '2027-01-01T00:00:00Z',
      amountCents: 249320,
      currency: 'EUR',
      locale: 'en',
      brand: BRAND,
    }),
  },
];

for (const { file, msg } of samples) {
  writeFileSync(join(outDir, `${file}.html`), msg.html, 'utf8');
  writeFileSync(join(outDir, `${file}.txt`), `Subject: ${msg.subject}\n\n${msg.text}`, 'utf8');
  console.log(`${file}: "${msg.subject}"  (${msg.html.length} bytes html, ${msg.text.length} text)`);
}
console.log(`\nwritten to ${outDir}/ — open the .html files in a browser.`);
