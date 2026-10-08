/**
 * RFC 4180 CSV scanner.
 *
 * Hand-rolled rather than pulled from a dependency because the tracker exports
 * need three specific behaviours preserved exactly:
 *
 *   - a UTF-8 BOM at the start of the file is stripped, not treated as part of
 *     the first header name;
 *   - records are separated by CRLF, but a bare LF *inside* a quoted field is
 *     literal content and must survive byte-identical;
 *   - empty fields stay empty strings and are never coerced to a default.
 */

const BOM = '\uFEFF';

/** A parsed record: one array of field values per row, in column order. */
export type CsvRecord = string[];

export function parseCsv(input: string): CsvRecord[] {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input;

  const records: CsvRecord[] = [];
  let record: CsvRecord = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = (): void => {
    record.push(field);
    field = '';
  };

  const endRecord = (): void => {
    endField();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote is an escaped literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      // Everything else, newlines included, is literal content.
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }

    if (ch === '\r') {
      endRecord();
      // Consume the LF of a CRLF pair as part of the same separator.
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    if (ch === '\n') {
      endRecord();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  if (inQuotes) {
    throw new Error('[content] CSV ended inside a quoted field (unbalanced quote)');
  }

  // Flush the final record when the file has no trailing newline.
  if (field.length > 0 || record.length > 0) endRecord();

  return records;
}

/** Quotes a value for CSV output only when the content requires it. */
export function quoteCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serialises records back to CSV using CRLF separators, matching the exports. */
export function toCsv(records: readonly CsvRecord[]): string {
  return records.map((r) => r.map(quoteCsvField).join(',')).join('\r\n');
}
