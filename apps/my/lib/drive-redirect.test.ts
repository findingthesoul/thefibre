// The Drive download route redirects only to the API's own download stream.
import { describe, expect, it } from 'vitest';
import { safeDriveDownloadUrl } from './drive-redirect';

const BASE = 'https://thefibre-api-staging.fly.dev';
const ok = (host: string) => `https://${host}/api/v1/me/portal/drive-download?token=abc.def`;

describe('safeDriveDownloadUrl', () => {
  it('accepts the API download stream on this app’s API host or a known public API host', () => {
    expect(safeDriveDownloadUrl(ok('thefibre-api-staging.fly.dev'), BASE)).toBe(ok('thefibre-api-staging.fly.dev'));
    expect(safeDriveDownloadUrl(ok('api.thethread.app'), BASE)).toBe(ok('api.thethread.app'));
  });
  it('refuses any other host, path, scheme, credentials or junk', () => {
    for (const bad of [
      'https://evil.example/api/v1/me/portal/drive-download?token=x',
      'https://api.thethread.app.evil.example/api/v1/me/portal/drive-download',
      'https://api.thethread.app/somewhere/else',
      'http://api.thethread.app/api/v1/me/portal/drive-download?token=x',
      'https://user:pw@api.thethread.app/api/v1/me/portal/drive-download',
      'javascript:alert(1)',
      '//evil.example',
      '',
      42,
      null,
    ]) {
      expect(safeDriveDownloadUrl(bad, BASE), String(bad)).toBeNull();
    }
  });
  it('allows plain http only on localhost (local development)', () => {
    expect(safeDriveDownloadUrl('http://localhost:8080/api/v1/me/portal/drive-download?token=x', 'http://localhost:8080')).not.toBeNull();
  });
});
