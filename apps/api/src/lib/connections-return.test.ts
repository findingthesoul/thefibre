import { describe, expect, it } from 'vitest';
import { connectionsSettingsUrl, parseReturnTo } from './connections-return.js';

const ENV = {
  NEXT_PUBLIC_FIBRE_URL: 'https://platform.example',
  NEXT_PUBLIC_THREAD_URL: 'https://thread.example',
  NEXT_PUBLIC_MEET_URL: 'https://meet.example',
};

describe('parseReturnTo', () => {
  it('accepts only thread and fibre', () => {
    expect(parseReturnTo('thread')).toBe('thread');
    expect(parseReturnTo('fibre')).toBe('fibre');
  });
  it('sends everything else to meet', () => {
    expect(parseReturnTo('meet')).toBe('meet');
    expect(parseReturnTo('evil')).toBe('meet');
    expect(parseReturnTo('')).toBe('meet');
    expect(parseReturnTo(undefined)).toBe('meet');
    expect(parseReturnTo(null)).toBe('meet');
  });
});

describe('connectionsSettingsUrl', () => {
  it('returns to the app that started the flow', () => {
    expect(connectionsSettingsUrl('fibre', ENV)).toBe('https://platform.example/settings/connections');
    expect(connectionsSettingsUrl('thread', ENV)).toBe('https://thread.example/settings/connections');
  });
  it('defaults to Meet integrations for a missing or unknown value', () => {
    for (const v of [undefined, null, 'meet', 'other', 42]) {
      expect(connectionsSettingsUrl(v, ENV)).toBe('https://meet.example/settings/integrations');
    }
  });
});
