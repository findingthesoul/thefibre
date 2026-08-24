import Link from 'next/link';
import { APPS, ENTITY } from '@thefibre/shared';
import { DocHeader, H2, P, List, Item, Rows, Row } from '../prose';

export const metadata = {
  title: 'About — The Fibre',
  description: 'Who builds The Fibre, and what it is for.',
};

const LIVE = ['fibre-meet', 'the-thread', 'fibre-flow', 'fibre-pulse'] as const;

export default function AboutPage() {
  return (
    <>
      <DocHeader
        title="About The Fibre"
        standfirst="A platform for the people, organisations and programmes behind purpose-driven work — built so that holding data about people stays a deliberate act."
      />

      <H2>What it is</H2>
      <P>
        Most software that tracks relationships accumulates. A field gets added because it might be
        useful, a note gets written because there was a box, and five years later nobody can say
        what is held about whom, or why. The Fibre is built the other way round: every field stored
        about a person exists because a specific app needs it for a specific job, and when that app
        goes, the field goes with it.
      </P>
      <P>
        Underneath sits one identity per person — the same contact across a meeting, a course, a
        journey and an invoice — kept in the EU and owned by the organisation that collected it,
        not by us.
      </P>

      <H2>The apps</H2>
      <P>
        The platform holds identity, the contact graph, a thin log of what happened, and the record
        of who consented to what. Around it sit apps, each keeping its own files in its own
        database schema:
      </P>
      <Rows>
        {LIVE.map((slug) => (
          <Row key={slug} term={APPS[slug].name}>
            {APPS[slug].tagline}
          </Row>
        ))}
      </Rows>
      <P>
        There are no connecting doors between them. When two apps need to know the same thing, that
        thing either belongs to the platform or it crosses through one of three named openings —
        and adding a fourth is a decision somebody has to argue for, not a line of code anyone can
        write. Apps built outside our own codebase go through the same wall, with a key that
        carries only the permissions their published manifest asked for.
      </P>

      <H2>Who builds it</H2>
      <P>
        The Fibre is built and operated by {ENTITY.name}, based in {ENTITY.address}. It is
        independently owned and funded by the people who use it. There is no advertising business
        attached to it, no profiling, no third-party trackers, and nothing about the people in your
        workspace is sold or shared for anyone else&rsquo;s purposes.
      </P>
      <P>
        Access is by invitation while we onboard partner and pilot organisations.{' '}
        <Link className="underline hover:text-neutral-900" href="/request-access">
          Request access
        </Link>{' '}
        if you would like to be part of that.
      </P>

      <H2>How to reach us</H2>
      <List>
        <Item>
          Questions and problems:{' '}
          <Link className="underline hover:text-neutral-900" href="/support">
            support
          </Link>
          .
        </Item>
        <Item>
          What we do with data, in full:{' '}
          <Link className="underline hover:text-neutral-900" href="/privacy-policy">
            privacy statement
          </Link>
          .
        </Item>
        <Item>
          The rules of use:{' '}
          <Link className="underline hover:text-neutral-900" href="/terms">
            terms
          </Link>
          .
        </Item>
      </List>
    </>
  );
}
