// The thread's intention in the platform's own enrolment confirmation
// (Sjoerd, production, 2026-10-17: the "You're enrolled: Community agenda
// 2027" mail showed "<p></p><p><b>The membership rhythm combines…" as text).
import { describe, expect, it } from 'vitest';
import { enrolmentConfirmation, intentionForMail } from './thread-templates.js';

const RICH =
  '<p></p><p><b>The membership rhythm combines</b> three things:</p><ol><li><span><i>Quarterly Community Gatherings:</i> in person</span></li><li>Monthly calls</li></ol><script>alert(1)</script><p onclick="x()">End</p>';

const mail = (intention: string | null) =>
  enrolmentConfirmation({
    participantName: 'Ann Lee',
    threadTitle: 'Community agenda 2027',
    intention,
    organiserName: 'Soul',
    startsOn: null,
    threadUrl: 'https://my.example/x',
    locale: 'en',
    ticket: null,
    note: null,
  } as Parameters<typeof enrolmentConfirmation>[0]);

describe('a rich intention in the enrolment confirmation', () => {
  it('renders as HTML in the html part — never as escaped tags', () => {
    const { html } = mail(RICH);
    expect(html).toContain('<b>The membership rhythm combines</b>');
    expect(html).toContain('<ol><li>');
    expect(html).not.toContain('&lt;p&gt;');
    expect(html).not.toContain('&lt;b&gt;');
  });

  it('is clean text in the text part: no tags, list items on their own lines', () => {
    const { text } = mail(RICH);
    expect(text).not.toMatch(/<[a-z/]/i);
    expect(text).toContain('The membership rhythm combines three things:');
    expect(text).toMatch(/Quarterly Community Gatherings: in person/);
    expect(text).toMatch(/\n.*Monthly calls/);
  });

  it('strips a script and an event handler', () => {
    const { html, text } = mail(RICH);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('onclick');
    expect(text).not.toContain('alert(1)');
  });

  it('a plain intention (from before it was rich) stays the organiser’s words', () => {
    const r = intentionForMail('Bring a notebook.\nAnd <curiosity> & time.');
    expect(r.text).toBe('Bring a notebook.\nAnd <curiosity> & time.');
    expect(r.html).toBe('Bring a notebook.<br />And &lt;curiosity&gt; &amp; time.');
  });

  it('nothing, or an intention that is empty once cleaned, adds nothing', () => {
    expect(intentionForMail(null)).toEqual({ html: '', text: '' });
    expect(intentionForMail('<p></p><p> </p>')).toEqual({ html: '', text: '' });
    const { html, text } = mail('<p></p>');
    expect(html).not.toContain('color:#525252;">\n');
    expect(text).not.toContain('<p>');
  });
});
