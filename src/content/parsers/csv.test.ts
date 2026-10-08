import { describe, expect, it } from 'vitest';
import { parseCsv, quoteCsvField, toCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple record', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']]);
  });

  it('strips a UTF-8 BOM from the first field', () => {
    expect(parseCsv('\uFEFFS.N,Category')).toEqual([['S.N', 'Category']]);
  });

  it('treats CRLF as a single record separator', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('accepts bare LF and bare CR as record separators', () => {
    expect(parseCsv('a\nb')).toEqual([['a'], ['b']]);
    expect(parseCsv('a\rb')).toEqual([['a'], ['b']]);
  });

  it('keeps a bare LF inside a quoted field as literal content', () => {
    expect(parseCsv('"one\ntwo",next')).toEqual([['one\ntwo', 'next']]);
  });

  it('keeps a trailing newline inside a quoted field', () => {
    // Exactly the shape of ST-09's Implementation Item.
    expect(parseCsv('"Edge Security, WAF & Ingress Rate Limiting\n",x')).toEqual([
      ['Edge Security, WAF & Ingress Rate Limiting\n', 'x'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"Golden Signals, SLIs & SLO Tracking",P2')).toEqual([
      ['Golden Signals, SLIs & SLO Tracking', 'P2'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('preserves empty fields rather than dropping them', () => {
    expect(parseCsv('a,,b,')).toEqual([['a', '', 'b', '']]);
  });

  it('emits the final record when the file has no trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d')).toHaveLength(2);
  });

  it('does not emit a phantom record for a trailing newline', () => {
    expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
  });

  it('rejects an unbalanced quote instead of guessing', () => {
    expect(() => parseCsv('"unterminated,x')).toThrow(/unbalanced quote/);
  });
});

describe('quoteCsvField', () => {
  it('leaves plain values unquoted', () => {
    expect(quoteCsvField('Not Started')).toBe('Not Started');
  });

  it('quotes values containing a comma, quote, CR or LF', () => {
    expect(quoteCsvField('a,b')).toBe('"a,b"');
    expect(quoteCsvField('a"b')).toBe('"a""b"');
    expect(quoteCsvField('a\nb')).toBe('"a\nb"');
  });
});

describe('toCsv', () => {
  it('round-trips through parseCsv, newlines in fields included', () => {
    const records = [
      ['S.N', 'Implementation Item'],
      ['ST-09', 'Edge Security, WAF & Ingress Rate Limiting\n'],
      ['ST-20', ''],
    ];
    expect(parseCsv(toCsv(records))).toEqual(records);
  });

  it('separates records with CRLF, matching the source exports', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb');
  });
});
