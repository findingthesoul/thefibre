import Link from 'next/link';
import { ENTITY } from '@thefibre/shared';
import { DocHeader, H2, P, List, Item, Rows, Row } from '../prose';

export const metadata = {
  title: 'Support — The Fibre',
  description: 'How to get help with The Fibre.',
};

export default function SupportPage() {
  return (
    <>
      <DocHeader
        title="Support"
        standfirst="Something not working, or a question about your data? Write to a human."
      />

      <H2>Email us</H2>
      <Rows>
        <Row term="General support">
          <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
            {ENTITY.supportEmail}
          </a>
          <br />
          Problems, questions, bugs, and anything about your account.
        </Row>
        <Row term="Privacy and your data">
          <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
            {ENTITY.supportEmail}
          </a>
          <br />
          Access, correction and erasure requests. Put &ldquo;privacy&rdquo; in the subject line and
          we will treat it as a formal request under the GDPR.
        </Row>
        <Row term="Not receiving our email?">
          Add{' '}
          <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.whitelistEmail}`}>
            {ENTITY.whitelistEmail}
          </a>{' '}
          to your address book. Sign-in links and invitations are the messages most often caught by
          spam filters.
        </Row>
      </Rows>

      <H2>Before you write</H2>
      <P>Two things solve most of what reaches us:</P>
      <List>
        <Item>
          <strong className="font-medium text-neutral-900">Can&rsquo;t sign in?</strong> The Fibre
          is invitation-only. If you have never been invited, ask the admin of the workspace you
          are joining, or{' '}
          <Link className="underline hover:text-neutral-900" href="/request-access">
            request access
          </Link>
          . If you have been invited and the link does not work, it may have expired — ask for a
          fresh one, they are single-use.
        </Item>
        <Item>
          <strong className="font-medium text-neutral-900">
            Signed in, but an app is missing?
          </strong>{' '}
          Each app has to be switched on for your workspace <em>and</em> you have to be a member of
          it. Both are set by a workspace admin, under Settings.
        </Item>
      </List>

      <H2>If you are signed in</H2>
      <P>
        Every app has a <strong className="font-medium text-neutral-900">Help</strong> page at the
        bottom of its sidebar, describing what each part of that app is for. The platform also
        explains itself in full under Settings &rarr; How The Fibre works: what is stored, what
        crosses between apps, and what anything built on top of it is allowed to reach.
      </P>
      <P>
        Your own data is under Privacy: the consents you have given, a complete export of
        everything held about you, and a way to ask for erasure.
      </P>

      <H2>Response times</H2>
      <P>
        We are a small team and answer support email within a few working days. Formal data-subject
        requests are answered within the one-month period the GDPR allows, and usually much sooner.
        We do not run a telephone helpdesk.
      </P>

      <H2>Reporting something serious</H2>
      <P>
        If you believe you have found a security vulnerability, or that personal data has been
        exposed, write to{' '}
        <a className="underline hover:text-neutral-900" href={`mailto:${ENTITY.supportEmail}`}>
          {ENTITY.supportEmail}
        </a>{' '}
        with &ldquo;security&rdquo; in the subject line and we will come back to you quickly.
        Please give us a reasonable chance to fix it before publishing.
      </P>
    </>
  );
}
