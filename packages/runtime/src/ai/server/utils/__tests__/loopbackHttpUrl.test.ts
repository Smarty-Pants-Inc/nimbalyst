import { describe, expect, it } from 'vitest';
import { normalizeLoopbackHttpUrl } from '../loopbackHttpUrl';

describe('normalizeLoopbackHttpUrl', () => {
  it('accepts and normalizes loopback HTTP URLs', () => {
    expect(normalizeLoopbackHttpUrl(' http://127.0.0.1:8788/// ', 'http://127.0.0.1:8788', 'test URL'))
      .toBe('http://127.0.0.1:8788');
    expect(normalizeLoopbackHttpUrl('http://127.10.20.30:8788/v1', 'http://127.0.0.1:8788', 'test URL'))
      .toBe('http://127.10.20.30:8788/v1');
    expect(normalizeLoopbackHttpUrl('http://localhost:8788', 'http://127.0.0.1:8788', 'test URL'))
      .toBe('http://localhost:8788');
    expect(normalizeLoopbackHttpUrl('http://[::1]:8788', 'http://127.0.0.1:8788', 'test URL'))
      .toBe('http://[::1]:8788');
  });

  it('uses the fallback for blank values', () => {
    expect(normalizeLoopbackHttpUrl('  ', 'http://127.0.0.1:8788', 'test URL'))
      .toBe('http://127.0.0.1:8788');
  });

  it('rejects non-loopback, wildcard, malformed, credentialed, query, and fragment URLs', () => {
    for (const value of [
      'https://api.openai.com/v1',
      'http://192.168.1.10:8788',
      'http://0.0.0.0:8788',
      'http://[::]:8788',
      'http://host.docker.internal:8788',
      'http://127.0.0.1.evil.com:8788',
      'not a url',
      'file:///tmp/socket',
      'http://user:pass@127.0.0.1:8788',
      'http://127.0.0.1:8788?token=secret',
      'http://127.0.0.1:8788/#fragment',
    ]) {
      expect(() => normalizeLoopbackHttpUrl(value, 'http://127.0.0.1:8788', 'test URL'))
        .toThrow(/loopback|credentials|query|fragment|http/i);
    }
  });
});
