import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/**
 * Generated placeholder "site photo" (no copyrighted images): a simple
 * building drawing with floors filled up to the given level, plus a caption.
 */
export async function placeholderPhoto(opts: { title: string; subtitle: string; floorsDone: number; totalFloors: number; hue: number }) {
  const w = 1280;
  const h = 853;
  const floors = Math.max(1, opts.totalFloors + 1);
  const fh = 44;
  const bw = 360;
  const bx = (w - bw) / 2;
  const by = h - 120;
  let blocks = '';
  for (let i = 0; i < floors; i++) {
    const y = by - (i + 1) * fh;
    const done = i < opts.floorsDone;
    blocks += `<rect x="${bx}" y="${y}" width="${bw}" height="${fh - 4}" rx="3" fill="${done ? '#8a8f98' : 'none'}" stroke="${done ? '#5b616b' : '#b9bec7'}" stroke-dasharray="${done ? '0' : '6 6'}" stroke-width="2"/>`;
    if (done)
      for (let k = 0; k < 5; k++)
        blocks += `<rect x="${bx + 24 + k * 68}" y="${y + 10}" width="36" height="${fh - 24}" fill="#3d434c" opacity="0.55"/>`;
  }
  const crane = `<line x1="${bx + bw + 80}" y1="${by}" x2="${bx + bw + 80}" y2="${by - floors * fh - 90}" stroke="#C8A24A" stroke-width="8"/>
    <line x1="${bx - 40}" y1="${by - floors * fh - 80}" x2="${bx + bw + 160}" y2="${by - floors * fh - 80}" stroke="#C8A24A" stroke-width="8"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${opts.hue},45%,78%)"/><stop offset="1" stop-color="hsl(${opts.hue},35%,93%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#sky)"/>
    <rect y="${by}" width="${w}" height="${h - by}" fill="#a58c6b"/>
    ${crane}${blocks}
    <rect x="0" y="0" width="${w}" height="92" fill="#1F2A37" opacity="0.85"/>
    <text x="40" y="56" font-family="Arial, sans-serif" font-size="34" fill="#fff" font-weight="bold">${esc(opts.title)}</text>
    <text x="${w - 40}" y="56" font-family="Arial, sans-serif" font-size="24" fill="#C8A24A" text-anchor="end">${esc(opts.subtitle)}</text>
    <text x="40" y="${h - 30}" font-family="Arial, sans-serif" font-size="20" fill="#fff" opacity="0.9">Demo placeholder image · BuildTrack</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

/** Simple text PDF for demo documents (uses pdfkit). */
export function simplePdf(title: string, paragraphs: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title, Producer: 'BuildTrack demo seed' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1F2A37').text(title);
    doc.moveDown();
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    for (const p of paragraphs) doc.text(p, { align: 'left' }).moveDown(0.6);
    doc.end();
  });
}
