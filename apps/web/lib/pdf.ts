function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxLen: number) {
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= maxLen) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function chunkLines(lines: string[], maxLen: number) {
  return lines.flatMap((line) => (line ? wrapLine(line, maxLen) : ['']));
}

export function renderSimplePdf(lines: string[], options?: { title?: string }) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 72;
  const fontSize = 11;
  const lineHeight = 14;
  const maxChars = 90;
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);

  const normalizedLines = chunkLines(lines, maxChars);
  const pages: string[][] = [];
  for (let i = 0; i < normalizedLines.length; i += linesPerPage) {
    pages.push(normalizedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];

  const addObject = (content: string) => {
    objects.push(content);
  };

  addObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  const kids = pages.map((_, idx) => `${idx + 3} 0 R`).join(' ');
  addObject(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`);

  const fontObjId = 3 + pages.length * 2;

  pages.forEach((pageLines, idx) => {
    const pageObj = idx + 3;
    const contentObj = idx + 3 + pages.length;
    addObject(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj`
    );
  });

  pages.forEach((pageLines, idx) => {
    const contentObj = idx + 3 + pages.length;
    let stream = `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n`;
    pageLines.forEach((line, lineIdx) => {
      const escaped = escapePdfText(line || ' ');
      stream += `${lineIdx === 0 ? '' : 'T*\n'}(${escaped}) Tj\n`;
    });
    stream += 'ET';
    const length = Buffer.byteLength(stream, 'utf8');
    addObject(
      `${contentObj} 0 obj\n<< /Length ${length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  });

  addObject(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
