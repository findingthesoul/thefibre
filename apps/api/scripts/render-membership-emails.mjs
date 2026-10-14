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

// THE REAL CARD, not a plausible one. Copied from the production public
// catalogue on 2026-10-14 so the sample shows what an invitee will actually
// read: seven long items, each ending in a semicolon, which looks nothing
// like three tidy invented ones. A template that only reads well with
// content we wrote ourselves has not been tested.
const SOUL_CHARACTERISTICS = [
  'Meaningful Conversations exploring soul.com ideas, models and emerging learning;',
  'Quarterly Community Gatherings connecting members with developments across soul.com;',
  'an Annual Harvest bringing together learning from the year;',
  'intentional introductions to other members;',
  'an orientation to soul.com and the membership community;',
  'individual accompaniment within the boundaries of the membership offer;',
  'and information about opportunities for deeper participation within soul.com;',
];
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
      characteristics: SOUL_CHARACTERISTICS,
      calendarTeamNames: ['soul.com'],
      portalUrl: 'https://my.thethread.app/memberships',
      email: 'marja@example.com',
      locale: 'en',
      brand: BRAND,
    }),
  },
  {
    // THE OTHER TRIGGER: a member an admin added by hand, who paid nothing.
    // Same template, same size, same portal, same renewal date, same
    // calendars — the ONE difference is that no invoice is promised, because
    // nobody was billed. Rendered beside the paid one on purpose, because
    // "one welcome, two triggers" is a claim that should be checkable by
    // putting them side by side, and in v1.186.0 it was true of the layout
    // while the content still differed in two places.
    //
    // The name is the email's LOCAL PART, which is what a person row created
    // from an address carries. It is capitalised in the greeting; a name
    // somebody actually typed is left exactly as they wrote it.
    file: 'welcome-en-added-by-hand',
    msg: membershipWelcome({
      name: 'sjoerd',
      communityName: COMMUNITY,
      tierName: 'Community member',
      renewsAt: '2027-10-14T05:03:20Z',
      tierDescription: 'Membership of the soul.com community.',
      characteristics: SOUL_CHARACTERISTICS,
      // TWO calendars, which is the real production shape and the reason the
      // option is a list: soul.com's Fellowship product grants two teams'
      // calendars. The sentence is possessive ("{team}'s calendar"), so this
      // renders one sentence each rather than joining the names — and
      // rendering it is what makes that a checkable claim.
      calendarTeamNames: ['soul.com', 'Fellowship'],
      portalUrl: 'https://my.thethread.app/memberships',
      email: 'sjoerd+invitetest@soul.com',
      invoiceFollows: false,
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
      // The same seven items: the community has not translated its card, so a
      // Dutch reader sees the English text inside a Dutch frame. That is what
      // will really happen, and the sample should not hide it.
      characteristics: SOUL_CHARACTERISTICS,
      calendarTeamNames: ['soul.com'],
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
