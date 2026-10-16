import { describe, expect, it, vi } from 'vitest';

// next/headers is the server's; only the pure half is under test here.
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('./session', () => ({ loadFrame: vi.fn() }));

import { pickLocale } from './locale';

describe('my.thread’s language', () => {
  it('takes this browser’s choice first', () => {
    expect(pickLocale({ cookie: 'nl', nav: { locale: 'de' }, acceptLanguage: 'fr' })).toBe('nl');
  });

  it('then the person’s own language, from /me/nav', () => {
    expect(pickLocale({ nav: { locale: 'de' }, acceptLanguage: 'fr' })).toBe('de');
  });

  // The batch window: the web is newer than the API, or /me/nav fell back to
  // /me/portal. Neither sends `locale`, and neither may break the page.
  it('treats an API that does not send locale as no choice made', () => {
    expect(pickLocale({ nav: {} as { locale?: string | null }, acceptLanguage: 'fr' })).toBe('fr');
    expect(pickLocale({ cookie: 'es', nav: {} as { locale?: string | null } })).toBe('es');
    expect(pickLocale({ nav: null, acceptLanguage: 'pt-BR,pt;q=0.9' })).toBe('pt');
  });

  it('is English when nobody has said anything we speak', () => {
    expect(pickLocale({})).toBe('en');
    expect(pickLocale({ nav: { locale: null }, acceptLanguage: 'ja,zh;q=0.8' })).toBe('en');
  });
});
