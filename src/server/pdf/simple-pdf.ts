const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LINES_PER_PAGE = 44;

function escapePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/gu, "?")
    .replace(/([\\()])/gu, "\\$1");
}

function contentStream(title: string, lines: string[]) {
  const commands = [
    "BT",
    "/F1 16 Tf",
    `50 ${PAGE_HEIGHT - 52} Td`,
    `(${escapePdfText(title)}) Tj`,
    "/F1 9 Tf",
    "0 -28 Td",
  ];
  for (const line of lines) {
    commands.push(`(${escapePdfText(line)}) Tj`, "0 -16 Td");
  }
  commands.push("ET");
  return commands.join("\n");
}

export function createTextPdf(title: string, lines: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < Math.max(lines.length, 1); index += LINES_PER_PAGE) {
    chunks.push(lines.slice(index, index + LINES_PER_PAGE));
  }
  if (!chunks.length) chunks.push(["No items."]);

  const objects: string[] = [];
  const fontId = 3 + chunks.length * 2;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = chunks.map((_, index) => 3 + index * 2);
  objects[2] = `<< /Type /Pages /Count ${chunks.length} /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;

  chunks.forEach((chunk, index) => {
    const pageId = 3 + index * 2;
    const streamId = pageId + 1;
    const stream = contentStream(
      chunks.length > 1 ? `${title} (${index + 1}/${chunks.length})` : title,
      chunk,
    );
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n%HOMI\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "binary");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}
