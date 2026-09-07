// The embed loader is a published integration surface: the string this
// function returns is served verbatim as /embed.js and pasted-by-URL into
// customer sites. A syntax error here is a silent, site-wide embed outage
// — so the emitted JS must at least parse, guard double-include, and carry
// its config.

import { describe, expect, it } from 'vitest';
import { buildEmbedLoader, type EmbedLoaderConfig } from './embed-loader.js';

const cfg: EmbedLoaderConfig = {
  ns: 'thread-embed',
  flag: '__threadEmbedLoaded',
  title: 'The Thread',
  header: '/* usage: <script src=".../embed.js" defer></script> */',
  kinds: {
    list: { path: '/embed/list', params: ['organiser'] } as never,
  },
};

describe('buildEmbedLoader', () => {
  const js = buildEmbedLoader(cfg);

  it('emits syntactically valid JavaScript', () => {
    expect(() => new Function(js)).not.toThrow();
  });

  it('starts with the header comment (the served file is self-documenting)', () => {
    expect(js.startsWith(cfg.header)).toBe(true);
  });

  it('carries the namespace, double-include flag and title in the config', () => {
    expect(js).toContain('"ns":"thread-embed"');
    expect(js).toContain('"flag":"__threadEmbedLoaded"');
    expect(js).toContain('"title":"The Thread"');
  });

  it('derives its origin from its own script src (origin-relative contract)', () => {
    expect(js).toContain('document.currentScript');
    expect(js).toContain('embed\\.js');
  });
});
