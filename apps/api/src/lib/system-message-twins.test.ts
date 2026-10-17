import { describe, expect, it } from 'vitest';
import { adoptable, defaultTitles, isTwin, twinsOf, type MessageRow } from './system-message-twins.js';

const row = (over: Partial<MessageRow>): MessageRow => ({
  id: 'x',
  type: 'message',
  title: "You're enrolled: {title}",
  trigger_kind: 'on_enrolment',
  system_role: null,
  ...over,
});

describe('a copy of the automatic welcome (2026-10-17)', () => {
  it('knows the default title in every language', () => {
    const t = defaultTitles('enrolment_confirmed');
    expect(t.has("You're enrolled: {title}")).toBe(true);
    expect(t.has('Je bent ingeschreven: {title}')).toBe(true);
    expect(t.size).toBe(6);
  });

  it('is an ordinary message with the default title on a matching trigger', () => {
    expect(isTwin(row({}), 'enrolment_confirmed')).toBe(true);
    expect(isTwin(row({ trigger_kind: 'on_approval', title: 'Je bent ingeschreven: {title}' }), 'enrolment_confirmed')).toBe(true);
    expect(isTwin(row({ title: '  Du bist angemeldet: {title} ' }), 'enrolment_confirmed')).toBe(true);
  });

  it('is never the organiser’s own message, another trigger, another type, or a system row', () => {
    expect(isTwin(row({ title: 'Welcome to the fellowship!' }), 'enrolment_confirmed')).toBe(false);
    expect(isTwin(row({ trigger_kind: 'fixed' }), 'enrolment_confirmed')).toBe(false);
    expect(isTwin(row({ trigger_kind: 'on_application' }), 'enrolment_confirmed')).toBe(false);
    expect(isTwin(row({ type: 'event' }), 'enrolment_confirmed')).toBe(false);
    expect(isTwin(row({ system_role: 'enrolment_confirmed' }), 'enrolment_confirmed')).toBe(false);
  });

  it('the received message has its own title and trigger', () => {
    expect(isTwin(row({ title: 'Request received: {title}', trigger_kind: 'on_application' }), 'enrolment_received')).toBe(true);
    expect(isTwin(row({ title: 'Request received: {title}', trigger_kind: 'on_enrolment' }), 'enrolment_received')).toBe(false);
  });

  it('adoptable finds the copy, or nothing', () => {
    expect(adoptable([row({ id: 'own', title: 'Hi!' }), row({ id: 'copy' })], 'enrolment_confirmed')?.id).toBe('copy');
    expect(adoptable([row({ id: 'own', title: 'Hi!' })], 'enrolment_confirmed')).toBeNull();
  });

  it('twinsOf flags a copy only when the thread HAS that system message', () => {
    const sys = row({ id: 'sys', system_role: 'enrolment_confirmed' });
    expect([...twinsOf([sys, row({ id: 'copy' })])]).toEqual([['copy', 'enrolment_confirmed']]);
    expect(twinsOf([row({ id: 'copy' })]).size).toBe(0);
    expect(twinsOf([sys, row({ id: 'own', title: 'Hi!' })]).size).toBe(0);
  });
});
