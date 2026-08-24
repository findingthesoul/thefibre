import Link from 'next/link';
import { ENTITY } from '@thefibre/shared';
import { DocHeader, H2, P, List, Item } from '../prose';

// ⚠️ NOT LEGALLY REVIEWED. Written 2026-08-24 from what the platform actually
// does, because every transactional email footers a "Legal" link here and the
// route 404'd. It is accurate about the product and conservative about legal
// claims — it invents no warranty, no liability cap and no arbitration clause.
// Have a Dutch lawyer read it before relying on it commercially, and bump
// TERMS_UPDATED when the text changes materially.
const TERMS_UPDATED = '2026-08-24';

export const metadata = {
  title: 'Terms of use — The Fibre',
  description: 'The rules for using The Fibre.',
};

export default function TermsPage() {
  return (
    <>
      <DocHeader
        title="Terms of use"
        standfirst="The agreement between you and Solidarity Lab B.V. for the use of The Fibre and the apps that run on it."
        updated={TERMS_UPDATED}
      />

      <H2 id="who">1. Who you are agreeing with</H2>
      <P>
        The Fibre is operated by {ENTITY.name}, a private limited company established in{' '}
        {ENTITY.address}. In these terms, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean{' '}
        {ENTITY.name}; &ldquo;the platform&rdquo; means thefibre.app together with the apps served
        from its subdomains; and &ldquo;you&rdquo; means the person using it.
      </P>
      <P>
        Where you use The Fibre as part of an organisation, that organisation&rsquo;s workspace
        admins control your access, and any separate agreement between us and that organisation
        takes precedence over these terms where the two differ.
      </P>

      <H2 id="access">2. Access and accounts</H2>
      <List>
        <Item>
          Access is by invitation. An account exists because a workspace admin created it or
          because you enrolled in something run on the platform.
        </Item>
        <Item>
          You sign in with a single-use link sent to your email address, or with a connected Google
          account. Keep control of whichever you use — anyone with access to your inbox can reach
          your account.
        </Item>
        <Item>
          Accounts are personal. Do not share sign-in links, and tell us if you believe someone
          else has used your account.
        </Item>
        <Item>
          A workspace admin can remove your access to a workspace at any time. That removes your
          access, not your rights over your own personal data, which are set out in the{' '}
          <Link className="underline hover:text-neutral-900" href="/privacy-policy">
            privacy statement
          </Link>
          .
        </Item>
      </List>

      <H2 id="use">3. Acceptable use</H2>
      <P>
        The Fibre holds information about real people, much of it entered by you about someone
        else. That places a duty on you as well as on us. You agree not to:
      </P>
      <List>
        <Item>
          record personal data about someone without a lawful basis for doing so, or beyond what
          the app you are using needs;
        </Item>
        <Item>
          use the platform to send unsolicited bulk messages, or to contact people who have
          withdrawn consent;
        </Item>
        <Item>
          attempt to reach data belonging to another workspace, bypass access controls, or probe
          the API beyond the permissions your key or account carries;
        </Item>
        <Item>
          scrape, resell or redistribute the contact records of people you did not collect
          yourself;
        </Item>
        <Item>use the platform unlawfully, or to harass, defraud or endanger anyone.</Item>
      </List>
      <P>
        We may suspend an account or a workspace that is doing any of the above, and will say why
        when we do.
      </P>

      <H2 id="content">4. Your content, and who owns it</H2>
      <P>
        The records a workspace puts into The Fibre belong to that workspace. We do not claim
        ownership of them, we do not use them to train anything, we do not profile the people in
        them, and we do not sell or share them for anyone else&rsquo;s purposes. We process them to
        run the service for you, and for nothing else.
      </P>
      <P>
        You can take them out at any time. Any person with an account can download everything held
        about them as JSON from the Privacy page, and can request erasure there.
      </P>

      <H2 id="apps">5. Apps</H2>
      <P>
        The platform is deliberately split: it holds identity, the contact graph, a thin activity
        log and consent, while each app holds its own content. Apps we build ourselves and apps
        built by others reach the platform through the same wall, using a key limited to the
        permissions their published manifest asked for.
      </P>
      <P>
        Switching a third-party app on for your workspace is a decision by a workspace admin, and
        it gives that app access to the data its manifest describes. We review apps before they can
        be installed at all, but an app you switch on is a relationship between you and its
        developer: what they then do with the data they are given is governed by their terms, not
        ours. Switching an app off closes its access; it does not delete what the platform holds.
      </P>

      <H2 id="payments">6. Payments</H2>
      <P>
        Where the platform is used to take payment — for a course, an event or a booking — the
        money is collected through Stripe into the account of the organiser, not into ours. The
        organiser is the seller and the counterparty for that purchase; questions about a
        particular payment, refund or invoice go to them. We may charge the organiser a fee on such
        transactions, which is disclosed to them before it applies.
      </P>
      <P>
        Refunds and reimbursements are handled by the organiser through the platform. Consumer
        rights that apply to a purchase apply against the organiser as seller.
      </P>

      <H2 id="availability">7. Availability</H2>
      <P>
        The Fibre is actively developed and released frequently. We aim to keep it available and to
        take backups, but at this stage we do not offer a guaranteed uptime level, and features may
        change or be withdrawn. We will give reasonable notice before a change that removes
        something you depend on, and we will not delete workspace data without warning.
      </P>

      <H2 id="liability">8. Liability</H2>
      <P>
        The platform is provided as it is. To the extent the law allows, we are not liable for
        indirect or consequential loss, for loss of profit or business, or for data lost through
        something outside our control. Nothing here limits our liability for damage caused
        intentionally or by gross negligence, for death or personal injury, or for anything else
        that cannot be limited under Dutch law.
      </P>

      <H2 id="ending">9. Ending it</H2>
      <P>
        You may stop using the platform at any time, and ask for your personal data to be erased.
        An organisation may end its use of The Fibre and take its records with it. We may end or
        suspend access where these terms are breached, where an account is dormant and unpaid, or
        where we discontinue the service — in the last case, with enough notice to export
        everything first.
      </P>

      <H2 id="changes">10. Changes to these terms</H2>
      <P>
        We will update this page when the terms change and move the date at the top. For a change
        that materially affects your rights, we will tell account holders by email rather than
        relying on you to check.
      </P>

      <H2 id="law">11. Law and disputes</H2>
      <P>
        Dutch law applies. If we cannot resolve a dispute between us, it goes to the competent
        court in Rotterdam, the Netherlands — without prejudice to any right you have as a consumer
        to bring proceedings where you live.
      </P>

      <H2 id="contact">12. Contact</H2>
      <P>
        {ENTITY.name}, {ENTITY.address}.{' '}
        <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
          {ENTITY.supportEmail}
        </a>
        . For anything about personal data, see the{' '}
        <Link className="underline hover:text-neutral-900" href="/privacy-policy">
          privacy statement
        </Link>
        .
      </P>
    </>
  );
}
