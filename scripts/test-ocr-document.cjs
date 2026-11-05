#!/usr/bin/env node
// Real macOS Vision on real rendering: small print must be sharp, and a turned page upright.
// Slow (model loading), so it stands apart from the unit tests. node scripts/test-ocr-document.cjs
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
if (process.platform !== 'darwin') { console.log('skipped: macOS only'); process.exit(0); }
function pdf(rotate) {
  const lines = ['Startovne 350 Kc do 15.3.2027', 'Prezentace 8:30 a start 10:15', 'Poradatel Cyklo Klub Testov'];
  const content = `BT /F1 7 Tf 40 700 Td 12 TL ${lines.map(line => `(${line}) Tj T*`).join(' ')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Rotate ${rotate} /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let body = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return body;
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'letsrace-ocr-test-'));
try {
  const binary = path.join(folder, 'ocr');
  cp.execFileSync('/usr/bin/swiftc', [path.resolve(__dirname, 'ocr-document.swift'), '-o', binary], { stdio: 'ignore' });
  for (const rotate of [0, 90]) {
    const file = path.join(folder, `page-${rotate}.pdf`); fs.writeFileSync(file, pdf(rotate), 'latin1');
    const [lines] = JSON.parse(cp.execFileSync(binary, [file], { encoding: 'utf8', timeout: 180000 }));
    const text = lines.map(line => line.text).join('\n');
    for (const expected of ['350 Kc', '15.3.2027', '8:30', '10:15', 'Cyklo Klub Testov']) assert.ok(text.includes(expected), `rotate ${rotate}: "${expected}" missing from:\n${text}`);
  }
  console.log('ok: small print and a turned page are read');
} finally { fs.rmSync(folder, { recursive: true, force: true }); }
