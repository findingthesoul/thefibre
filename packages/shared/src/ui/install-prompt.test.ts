import { describe, expect, it } from 'vitest';
import { isIosSafari } from './install-prompt.js';

// Which browser gets the iPhone steps. Only Safari itself: Chrome, Firefox and
// Edge on iOS wrap the same engine and say "Safari" in their user agent, but
// their Share sheet is not Safari's, and steps naming buttons that are not
// there are worse than no bar.
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('isIosSafari', () => {
  it('is true for Safari on an iPhone', () => {
    expect(isIosSafari(SAFARI)).toBe(true);
  });

  it('is false for the other iPhone browsers, which say Safari too', () => {
    expect(isIosSafari(SAFARI.replace('Version/17.5', 'CriOS/126.0'))).toBe(false);
    expect(isIosSafari(SAFARI.replace('Version/17.5', 'FxiOS/127.0'))).toBe(false);
    expect(isIosSafari(SAFARI.replace('Version/17.5', 'EdgiOS/126.0'))).toBe(false);
    expect(isIosSafari(`${SAFARI} GSA/330.0`)).toBe(false);
  });

  it('is false for Android and desktop', () => {
    expect(isIosSafari('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')).toBe(false);
    expect(isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15')).toBe(false);
  });
});
