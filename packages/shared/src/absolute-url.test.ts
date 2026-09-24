import { describe, expect, it } from 'vitest';
import { absoluteUrl } from './absolute-url.js';

const ORIGIN = 'https://meet.thethread.app';

describe('absoluteUrl', () => {
  it('resolves a path against the origin', () => {
    expect(absoluteUrl('/sjoerd-luteijn/intro-call', ORIGIN)).toBe(
      'https://meet.thethread.app/sjoerd-luteijn/intro-call',
    );
  });

  it('adds the missing slash rather than gluing the path onto the host', () => {
    expect(absoluteUrl('sjoerd-luteijn/intro-call', ORIGIN)).toBe(
      'https://meet.thethread.app/sjoerd-luteijn/intro-call',
    );
  });

  it('never doubles the slash when the origin carries a trailing one', () => {
    expect(absoluteUrl('/intro', 'https://meet.thethread.app/')).toBe(
      'https://meet.thethread.app/intro',
    );
  });

  it('leaves an absolute URL alone — a public page may live on another host', () => {
    const other = 'https://app.thethread.app/marja/intro';
    expect(absoluteUrl(other, ORIGIN)).toBe(other);
    expect(absoluteUrl('http://localhost:3001/x', ORIGIN)).toBe('http://localhost:3001/x');
  });

  it('treats any scheme as absolute, not just http', () => {
    // A `mailto:` handed to this would otherwise come back as
    // "https://meet.thethread.app/mailto:someone@example.com".
    expect(absoluteUrl('mailto:someone@example.com', ORIGIN)).toBe(
      'mailto:someone@example.com',
    );
  });
});
