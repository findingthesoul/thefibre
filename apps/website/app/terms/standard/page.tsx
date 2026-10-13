import type { Metadata } from 'next';

// THE STANDARD MEMBERSHIP TERMS — DRAFT, NOT APPROVED.
//
// A workspace selling memberships through The Thread needs something to put in
// front of a person before taking their money. Most will not have written
// terms, so this is the default: a reasonable agreement between the WORKSPACE
// (the seller) and ITS member, which says plainly that The Thread is the
// software underneath and not a party to it.
//
// It is marked DRAFT on the page itself, and the consent records written
// against it carry the version `standard-terms-v1-draft`, so an acceptance can
// always be traced to the words that were shown. Sjoerd approves the text
// before the marker comes off; the existing legal pages were never
// lawyer-reviewed, and this one gets signed by strangers.
//
// When the words change: bump STANDARD_TERMS_VERSION in
// apps/api/src/lib/terms.ts. The consent index keys on the version, so a
// member accepting v2 is recorded beside their v1 acceptance rather than
// colliding with it.

export const metadata: Metadata = {
  title: 'Standard membership terms (draft)',
  description:
    'The default agreement between a community and its members for memberships sold through The Thread.',
  robots: { index: false, follow: false },
};

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: '1. Who this agreement is between',
    p: [
      'This agreement is between you and the community you are joining — the organisation named on the page where you joined, referred to here as “the community”. The community is the seller.',
      'The Thread is the software the community uses to run its membership. The Thread is not a party to this agreement, does not sell you the membership, and is not responsible for what the community provides. Payments are processed by Stripe on the community’s own account.',
    ],
  },
  {
    h: '2. What you are buying',
    p: [
      'A membership of the community, at the tier shown when you joined, for the period shown. What the membership includes is described on that page and may be changed by the community over time; material reductions will be told to you before they take effect.',
      'A membership is personal to you and is not transferable unless the community says otherwise.',
    ],
  },
  {
    h: '3. Payment and renewal',
    p: [
      'You pay the amount shown at checkout, in the currency shown. Unless the page said otherwise, a membership renews automatically at the end of each period at the then-current price, and you are told the renewal date when you join and can see it in your member portal.',
      'If a payment fails, the community may suspend the membership until it is settled.',
    ],
  },
  {
    h: '4. Cancelling, and your right to withdraw',
    p: [
      'You can cancel at any time; the membership then runs to the end of the period you have paid for and does not renew. Payments already made are not refunded except where the law requires it or the community chooses to.',
      'If you are a consumer in the EU, you normally have 14 days to withdraw from a distance contract. Where you ask for the membership to start immediately and it is fully performed within those 14 days, that right does not apply; where it is partly performed, the community may keep a proportionate amount for what you have already received.',
    ],
  },
  {
    h: '5. How you take part',
    p: [
      'Treat other members decently. The community may set its own house rules and may end a membership that breaks them, or that is used to harm, harass or defraud others, with a proportionate refund of any unused period.',
      'Content you share stays yours. You give the community permission to show it to other members where you chose to share it.',
    ],
  },
  {
    h: '6. Liability between you and the community',
    p: [
      'The community is responsible for providing what it described. Neither you nor the community is liable for indirect or consequential loss, and the community’s total liability is limited to what you paid in the twelve months before the claim.',
      'Nothing here limits liability that cannot be limited by law, including for death or personal injury caused by negligence, or for fraud.',
    ],
  },
  {
    h: '7. Your personal data',
    p: [
      'The community decides what is done with your personal data and is the controller for it. The Thread stores and processes that data on the community’s instructions, as its processor, in the EU.',
      'The community’s own privacy notice tells you what it collects and why. You can ask the community for a copy of your data or for it to be deleted, and you can exercise the same rights through your member portal.',
    ],
  },
  {
    h: '8. Which law applies',
    p: [
      'The law of the country where the community is established applies, and its courts have jurisdiction. If you are a consumer, this does not take away the protection of the mandatory law of the country where you live.',
    ],
  },
  {
    h: '9. Changes to these terms',
    p: [
      'These terms may be updated. A new version applies to you from your next renewal, and you are asked to accept it when that happens. The version you accepted, and when, is recorded.',
    ],
  },
];

export default function Page() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        {/* The marker is part of the document, not decoration: anybody who
            reads this before it is approved should know what they are
            reading, and anybody auditing an acceptance recorded against
            `standard-terms-v1-draft` should find the same word here. */}
        <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Draft.</strong> These standard terms have not yet been approved or reviewed by a
          lawyer. They are published here so communities and members can read the wording that is
          proposed; the version recorded against any acceptance is{' '}
          <code>standard-terms-v1-draft</code>.
        </p>
        <h1 className="text-3xl font-medium tracking-tight">Standard membership terms</h1>
        <p className="mt-3 text-base text-ink-subtle leading-relaxed">
          The default agreement between a community and its members, for memberships sold through
          The Thread. A community that has its own terms uses those instead.
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-medium">{s.h}</h2>
              {s.p.map((text) => (
                <p key={text} className="mt-2 text-sm text-ink-subtle leading-relaxed">
                  {text}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
