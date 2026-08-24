import Link from 'next/link';
import { ENTITY } from '@thefibre/shared';
import { DocHeader, H2, P, List, Item, Rows, Row } from '../prose';

// ⚠️ NOT LEGALLY REVIEWED. Written 2026-08-24 from what the platform actually
// does — the sub-processor list, the retention behaviour and the rights
// described here are all things you can go and read in the code. Every
// enrolee on a Thread has to tick "I accept the privacy policy" against this
// document (apps/thread/lib/policies.ts), so keep it TRUE: if the platform
// starts doing something this page does not say, this page is the bug.
// Bump POLICY_UPDATED and POLICIES[].version together when it changes.
const POLICY_UPDATED = '2026-08-24';

export const metadata = {
  title: 'Privacy statement — The Fibre',
  description: 'What The Fibre holds about you, why, where, and what you can do about it.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <DocHeader
        title="Privacy statement"
        standfirst="What we hold about you, why we hold it, where it lives, and what you can do about it."
        updated={POLICY_UPDATED}
      />

      <H2 id="roles">1. Who is responsible</H2>
      <P>
        There are two answers, and the difference matters.
      </P>
      <List>
        <Item>
          <strong className="font-medium text-neutral-900">Your account.</strong> For the data that
          exists because you have an account with us — your identity, sign-in, and the record of
          your consents — {ENTITY.name}, {ENTITY.address}, is the controller.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">
            The records an organisation keeps about you.
          </strong>{' '}
          When an organisation uses The Fibre to run its courses, meetings or programmes, that
          organisation decides what it records about you and why. It is the controller; we are its
          processor. Ask them first about anything they have entered; ask us and we will help.
        </Item>
      </List>

      <H2 id="what">2. What we hold</H2>
      <P>
        The governing rule is that a field only exists because a specific app needs it. There is no
        general notes box quietly filling up. In practice we hold:
      </P>
      <Rows>
        <Row term="Identity">
          Name, email address, and optionally language, country, postal address and links to
          organisations you belong to.
        </Row>
        <Row term="Per-app records">
          Whatever the app you are using needs — a booking, an enrolment, a task in a flow, a
          budget line. Each app keeps its own, and each shows up as its own tab on your profile.
        </Row>
        <Row term="Activity">
          A thin log: that something happened, its type, a one-line title and a date.
          &ldquo;Attended the Athens session&rdquo; — never what was said, written or attached. It
          cannot be edited afterwards; a mistake is corrected by adding a line, not rewriting one.
        </Row>
        <Row term="Purchases">
          Where you have paid for something: amount, currency, what it was for, and the invoice.
          Card details never reach us — see sub-processors below.
        </Row>
        <Row term="Consents">
          What you agreed to, when, and against which version of which document. Withdrawals are
          recorded the same way.
        </Row>
        <Row term="Technical">
          Server logs needed to keep the service running and secure. No advertising identifiers, no
          profiling, no third-party trackers.
        </Row>
      </Rows>

      <H2 id="wall">3. What does not move between apps</H2>
      <P>
        Each app on the platform keeps its own content in its own place, and there are no
        connecting doors. Exactly three kinds of thing cross between them: the thin activity log
        described above, purchase records, and the links that say two apps are talking about the
        same person. The contents of a message, a note, a reflection or a document never cross. The
        thinness is deliberate: it makes leaking between apps impossible rather than merely
        discouraged.
      </P>

      <H2 id="why">4. Why we are allowed to hold it</H2>
      <List>
        <Item>
          <strong className="font-medium text-neutral-900">Contract</strong> — to give you the
          service you or your organisation signed up for: your account, your bookings, your
          enrolments, the emails that make them work.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">Consent</strong> — for anything
          optional: newsletters, appearing in a cohort directory, learning analytics. You can
          withdraw these at any time on your Privacy page, and withdrawal is as easy as giving it.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">Legitimate interest</strong> — keeping
          the platform secure and working, and defending legal claims.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">Legal obligation</strong> — invoices and
          accounting records we are required to keep.
        </Item>
      </List>

      <H2 id="where">5. Where it lives</H2>
      <P>
        In the European Union, and it stays there. The database and sign-in run in Ireland; the API
        runs in Frankfurt. The web front end holds no personal data at all — it asks the EU API for
        everything, every time.
      </P>

      <H2 id="processors">6. Who else touches it</H2>
      <P>These are our sub-processors. There is nobody else.</P>
      <Rows>
        <Row term="Supabase">Database and authentication. Hosted in Ireland (EU).</Row>
        <Row term="Fly.io">The API. Hosted in Frankfurt (EU).</Row>
        <Row term="Vercel">
          Serving the web interface, from Frankfurt (EU). It is stateless — no personal data is
          stored there.
        </Row>
        <Row term="Resend">
          Sending transactional email — sign-in links, invitations, receipts.
        </Row>
        <Row term="Stripe">
          Card payments, where an organiser takes them. Card numbers go to Stripe directly and
          never reach us; we see the amount, the outcome and the invoice.
        </Row>
        <Row term="Google">
          Only if you choose it: signing in with a Google account, or connecting your calendar so
          Fibre Meet can read your availability. Disconnecting revokes it.
        </Row>
      </Rows>

      <H2 id="retention">7. How long we keep it</H2>
      <P>
        For as long as your account exists, or as long as the organisation that entered a record
        has a reason to keep it. When something is deleted we mark it deleted rather than
        scrubbing the row immediately, so that a mistaken deletion can be undone and so the audit
        trail stays honest — but a marked record is out of use and out of sight. On an erasure
        request we zero the personal content across every app within 30 days. Invoices are kept for
        as long as tax law requires, and the activity log keeps the fact that something happened
        even after its personal content is gone.
      </P>

      <H2 id="rights">8. Your rights</H2>
      <P>
        You have the full set under the GDPR: to see what we hold, to correct it, to have it
        erased, to restrict or object to how it is used, and to take it elsewhere. Two of them are
        buttons rather than requests:
      </P>
      <List>
        <Item>
          <strong className="font-medium text-neutral-900">Export (Article 15)</strong> — download
          everything held about you as JSON, from the Privacy page when signed in.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">Erasure (Article 17)</strong> — request
          it from the same page; we act on it within 30 days.
        </Item>
      </List>
      <P>
        For anything else, write to{' '}
        <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
          {ENTITY.supportEmail}
        </a>{' '}
        with &ldquo;privacy&rdquo; in the subject. We answer within one month. If you are unhappy
        with how we handle it you can complain to your national data protection authority — in the
        Netherlands, the Autoriteit Persoonsgegevens.
      </P>

      <H2 id="cookies">9. Cookies</H2>
      <P>
        Three kinds, all strictly necessary or functional, which is why you are not being asked to
        dismiss a banner: the cookie that keeps you signed in, and two that remember your theme and
        sidebar preference across the Fibre apps. There are no advertising or analytics cookies,
        and no third party sets a cookie through us.
      </P>

      <H2 id="changes">10. Changes</H2>
      <P>
        We will update this page when what we do changes, and move the date at the top. Where you
        have accepted this statement as part of enrolling in something, the version you accepted is
        recorded against that enrolment.
      </P>

      <H2 id="contact">11. Contact</H2>
      <P>
        {ENTITY.name}, {ENTITY.address}.{' '}
        <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
          {ENTITY.supportEmail}
        </a>
        . The rules of use are in the{' '}
        <Link className="underline hover:text-neutral-900" href="/terms">
          terms
        </Link>
        .
      </P>
    </>
  );
}
