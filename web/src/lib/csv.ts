// Small RFC 4180 CSV reader/writer (quoted fields, embedded commas/quotes/newlines, CRLF, UTF-8 BOM).

const needsQuoting = /[",\r\n]|^\s|\s$/;

export function toCsv(rows: string[][]): string {
  const body = rows
    .map((row) => row.map((cell) => (needsQuoting.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\r\n");
  // BOM so Excel opens UTF-8 (₹, accents) correctly.
  return `﻿${body}\r\n`;
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** First row is the header; returns one object per data row keyed by header text. */
export function parseCsvObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [headerRow = [], ...data] = parseCsv(text);
  const headers = headerRow.map((h) => h.trim());
  const rows = data.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
  return { headers, rows };
}

/** Triggers a browser download (the OpenExt iframe allows downloads). */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
