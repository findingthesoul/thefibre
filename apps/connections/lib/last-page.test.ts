import { describe, expect, it } from 'vitest';
import { landingPath, sectionOf } from './last-page';

describe('where Connect opens', () => {
  it('is Today for somebody who has never been here', () => {
    expect(landingPath(undefined)).toBe('/today');
    expect(landingPath('')).toBe('/today');
  });

  it('is the section you were last in', () => {
    expect(landingPath('map')).toBe('/map');
    expect(landingPath('/landscape')).toBe('/landscape');
  });

  it('forgets the detail and returns to the section', () => {
    // Being put back on one person's page is not "where I was".
    expect(sectionOf('/people/9f3c-abc')).toBe('people');
    expect(landingPath('people/9f3c-abc')).toBe('/people');
  });

  it('refuses anything that is not a section, because a cookie is not trusted', () => {
    // The tell that matters: a redirect built from a cookie is a redirect
    // anybody can aim, so the value is matched against a list, never used.
    expect(landingPath('//evil.example.com')).toBe('/today');
    expect(landingPath('https://evil.example.com')).toBe('/today');
    expect(landingPath('../../etc/passwd')).toBe('/today');
    expect(landingPath('admin')).toBe('/today');
  });

  it('knows nothing outside the sidebar', () => {
    expect(sectionOf('/')).toBeNull();
    expect(sectionOf('/no-access')).toBeNull();
  });
});
