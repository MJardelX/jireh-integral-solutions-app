import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Recibo PDF
import jsPDF from 'jspdf';

export async function generarReciboPDF({
  cliente,
  monto,
  metodo,
  fecha,
  notas,
  id,
  meses,
}: {
  cliente: string;
  monto: number;
  metodo: string;
  fecha: string;
  notas?: string;
  id: string;
  meses: string[];
}) {
  const doc = new jsPDF();

  const logoUrl = '/jireh_logo.png';
  const logoData = await fetch(logoUrl).then(r => r.blob()).then(blob =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    })
  );

  // Layout constants
  const PW = 210;
  const M = 20;
  const CW = PW - M * 2;
  const RX = PW - M;

  // Color palette — matches app design system (#dd6900, #7f9d32, etc.)
  type RGB = [number, number, number];
  const ORANGE: RGB  = [221, 105,   0];
  const GREEN: RGB   = [127, 157,  50];
  const DARK: RGB    = [ 17,  24,  39];
  const MUTED: RGB   = [107, 114, 128];
  const BG: RGB      = [249, 250, 251];
  const BORDER: RGB  = [229, 231, 235];
  const WHITE: RGB   = [255, 255, 255];

  const fill  = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const text  = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-GT', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  const fmtMonthLabel = (d: string) => {
    const s = new Date(d + 'T00:00:00').toLocaleDateString('es-GT', {
      month: 'long', year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);

  // ── Orange top strip ─────────────────────────────────────────────────
  fill(ORANGE);
  doc.rect(0, 0, PW, 4, 'F');

  // ── Logo (proportional) ──────────────────────────────────────────────
  const logoImg = new Image();
  logoImg.src = logoData;
  await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); });
  const LOGO_H = 18;
  const LOGO_W = (logoImg.naturalWidth / logoImg.naturalHeight) * LOGO_H;
  doc.addImage(logoData, 'PNG', M, 14, LOGO_W, LOGO_H);

  // ── Title block (right-aligned) ───────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  text(DARK);
  doc.text('RECIBO DE PAGO', RX, 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  text(MUTED);
  doc.text(`Nº ${id.slice(0, 8).toUpperCase()}`, RX, 26, { align: 'right' });
  doc.text(fmtDate(fecha), RX, 32, { align: 'right' });

  // ── Accent line ───────────────────────────────────────────────────────
  stroke(ORANGE);
  doc.setLineWidth(0.7);
  doc.line(M, 40, RX, 40);

  // ── Client card ───────────────────────────────────────────────────────
  let cy = 48;
  fill(BG); stroke(BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(M, cy, CW, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  text(MUTED);
  doc.text('CLIENTE', M + 6, cy + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  text(DARK);
  doc.text(cliente, M + 6, cy + 16);

  // ── Payment details card ──────────────────────────────────────────────
  cy += 28;

  // Pre-calculate meses text for dynamic card height
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const mesesStr = meses.length > 0 ? meses.map(fmtMonthLabel).join(' · ') : '—';
  const mesesLines = doc.splitTextToSize(mesesStr, 100) as string[];
  const mesesExtraH = Math.max(0, (mesesLines.length - 1) * 5);
  const DCARD_H = 69 + mesesExtraH;

  fill(WHITE); stroke(BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(M, cy, CW, DCARD_H, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  text(MUTED);
  doc.text('DETALLES DEL PAGO', M + 6, cy + 8);

  stroke(BORDER); doc.setLineWidth(0.2);
  doc.line(M + 6, cy + 10, RX - 6, cy + 10);

  // Row: Método de pago
  const R1Y = cy + 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  text(MUTED);
  doc.text('Método de pago', M + 6, R1Y);
  doc.setFont('helvetica', 'bold');
  text(DARK);
  doc.text(metodo, RX - 6, R1Y, { align: 'right' });
  stroke(BORDER); doc.setLineWidth(0.2);
  doc.line(M + 6, R1Y + 3, RX - 6, R1Y + 3);

  // Row: Fecha de pago
  const R2Y = cy + 33;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  text(MUTED);
  doc.text('Fecha de pago', M + 6, R2Y);
  doc.setFont('helvetica', 'bold');
  text(DARK);
  doc.text(fmtDate(fecha), RX - 6, R2Y, { align: 'right' });
  stroke(BORDER); doc.setLineWidth(0.2);
  doc.line(M + 6, R2Y + 3, RX - 6, R2Y + 3);

  // Row: Períodos pagados
  const R3Y = cy + 46;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  text(MUTED);
  doc.text('Períodos pagados', M + 6, R3Y);
  doc.setFont('helvetica', 'bold');
  text(DARK);
  doc.text(mesesLines, RX - 6, R3Y, { align: 'right' });
  stroke(ORANGE); doc.setLineWidth(0.4);
  doc.line(M + 6, R3Y + 3 + mesesExtraH, RX - 6, R3Y + 3 + mesesExtraH);

  // Row: Total pagado (prominent)
  const R4Y = cy + 59 + mesesExtraH;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  text(MUTED);
  doc.text('TOTAL PAGADO', M + 6, R4Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  text(GREEN);
  doc.text(fmtCurrency(monto), RX - 6, R4Y + 1, { align: 'right' });

  // ── Facturas aplicadas ────────────────────────────────────────────────
  cy += DCARD_H + 8;

  if (meses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text(MUTED);
    doc.text('FACTURAS APLICADAS', M, cy);
    stroke(BORDER); doc.setLineWidth(0.3);
    doc.line(M, cy + 2, RX, cy + 2);
    cy += 8;

    for (const mes of meses) {
      fill(BG); stroke(BORDER); doc.setLineWidth(0.2);
      doc.roundedRect(M, cy, CW, 10, 1.5, 1.5, 'FD');
      fill(ORANGE);
      doc.circle(M + 6, cy + 5, 1.2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      text(DARK);
      doc.text(fmtMonthLabel(mes), M + 11, cy + 6.5);
      cy += 13;
    }

    cy += 2;
  }

  // ── Notas ────────────────────────────────────────────────────────────
  if (notas?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text(MUTED);
    doc.text('NOTAS', M, cy);
    stroke(BORDER); doc.setLineWidth(0.3);
    doc.line(M, cy + 2, RX, cy + 2);
    cy += 8;

    const lines = doc.splitTextToSize(notas.trim(), CW - 12);
    const notesH = Math.max(14, lines.length * 5 + 8);
    fill(BG); stroke(BORDER); doc.setLineWidth(0.2);
    doc.roundedRect(M, cy, CW, notesH, 2, 2, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    text(DARK);
    doc.text(lines, M + 6, cy + 7);
  }

  // ── Footer ───────────────────────────────────────────────────────────
  stroke(ORANGE); doc.setLineWidth(0.7);
  doc.line(M, 277, RX, 277);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  text(ORANGE);
  doc.text('Jireh', PW / 2, 283, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  text(MUTED);
  doc.text('Gracias por su pago. Este documento es su comprobante oficial.', PW / 2, 289, { align: 'center' });

  doc.save(`recibo_pago_${id}.pdf`);
}

