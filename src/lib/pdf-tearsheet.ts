// ─────────────────────────────────────────────────────────────────────────────
// PDF Tear Sheet — 2-page client-ready LBO deal summary
// Uses jsPDF for layout + Chart.js for charts rendered to off-screen canvas
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import { Chart, registerables } from 'chart.js';
import type { LBOModel, LBOModelOutputs } from './types';
import { computeSensitivity } from './lbo-engine';

Chart.register(...registerables);

// ── Colours ──────────────────────────────────────────────────────────────────

const NAVY   = '#0D1F3C';
const NAVY2  = '#1A3A5C';
const BLUE   = '#1E5FA8';
const LBLUE  = '#E8F0FA';
const TEAL   = '#0FA8A8';
const GREEN  = '#27AE60';
const LGREEN = '#EBF5EC';
const AMBER  = '#F39C12';
const RED    = '#C0392B';
const LRED   = '#FDECEA';
const LGREY  = '#F4F6F9';
const MGREY  = '#BDC3C7';
const DGREY  = '#7F8C8D';

// ── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v: number, d = 1) => `£${v.toFixed(d)}m`;
const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`;
const fmtMult = (v: number) => `${v.toFixed(2)}x`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function setFill(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRGB(hex);
  doc.setFillColor(r, g, b);
}

function setTextCol(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRGB(hex);
  doc.setTextColor(r, g, b);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, hex: string) {
  setFill(doc, hex);
  doc.rect(x, y, w, h, 'F');
}

// ── Chart rendering (off-screen canvas → PNG → jsPDF) ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChartToImage(config: any, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;   // 2× for retina sharpness
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);

    const merged = {
      ...config,
      options: {
        ...(config.options || {}),
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
      },
    };
    const chart = new Chart(ctx, merged);

    // Chart.js renders synchronously when animation is false
    requestAnimationFrame(() => {
      const img = canvas.toDataURL('image/png');
      chart.destroy();
      resolve(img);
    });
  });
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportTearSheet(model: LBOModel, outputs: LBOModelOutputs) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;     // A4 width
  const H = 297;     // A4 height
  const M = 12;      // margin
  const CW = W - 2 * M; // content width

  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const hp = model.deal.holdPeriod;
  const projections = outputs.projections.slice(1); // skip LTM (year 0)
  const yearLabels = projections.map(p => `Year ${p.year}`);

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: Deal Summary
  // ─────────────────────────────────────────────────────────────────────────

  // 1.1 Header Banner
  drawRect(doc, 0, 0, W, 16, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setTextCol(doc, '#FFFFFF');
  doc.text(model.deal.companyName, M, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setTextCol(doc, '#A8C4E0');
  doc.text(`${model.deal.sector}  ·  ${model.deal.dealDate}`, W - M, 10.5, { align: 'right' });

  // 1.2 Returns Hero Row
  let y = 20;
  const boxW = CW / 5;
  const boxH = 22;

  const heroBoxes = [
    {
      label: 'Sponsor IRR',
      value: fmtPct(outputs.returns.sponsor.irr),
      sub: `${hp}-year hold`,
      valuCol: GREEN,
      bg: LBLUE,
      border: GREEN,
    },
    {
      label: 'Money-on-Money',
      value: fmtMult(outputs.returns.sponsor.mom),
      sub: `vs ${fmt(outputs.returns.sponsor.equityInvested)} invested`,
      valuCol: BLUE,
      bg: LBLUE,
      border: BLUE,
    },
    {
      label: 'Entry EV',
      value: fmt(outputs.sourcesUses.purchasePrice),
      sub: `${fmtMult(model.deal.entryMultiple)} EV/EBITDA`,
      valuCol: NAVY,
      bg: '#FFFFFF',
      border: MGREY,
    },
    {
      label: 'Exit EV',
      value: fmt(outputs.exitWaterfall.exitEV),
      sub: `${fmtMult(outputs.exitWaterfall.exitMultiple)} EV/EBITDA`,
      valuCol: NAVY,
      bg: '#FFFFFF',
      border: MGREY,
    },
    {
      label: 'Equity Proceeds',
      value: fmt(outputs.exitWaterfall.sponsorProceeds),
      sub: `vs ${fmt(outputs.returns.sponsor.equityInvested)} invested`,
      valuCol: TEAL,
      bg: '#FFFFFF',
      border: MGREY,
    },
  ];

  heroBoxes.forEach((box, i) => {
    const bx = M + i * boxW;
    drawRect(doc, bx, y, boxW - 1, boxH, box.bg);
    // Border top
    drawRect(doc, bx, y, boxW - 1, 0.8, box.border);

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    setTextCol(doc, DGREY);
    doc.text(box.label.toUpperCase(), bx + boxW / 2 - 0.5, y + 5, { align: 'center' });

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setTextCol(doc, box.valuCol);
    doc.text(box.value, bx + boxW / 2 - 0.5, y + 14, { align: 'center' });

    // Sub
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    setTextCol(doc, DGREY);
    doc.text(box.sub, bx + boxW / 2 - 0.5, y + 19, { align: 'center' });
  });

  y += boxH + 4;

  // 1.3 Transaction Summary + Capital Structure
  const leftW = CW * 0.40;
  const rightW = CW * 0.55;
  const gapW = CW * 0.05;

  // ── Transaction Summary (left) ──
  drawRect(doc, M, y, leftW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextCol(doc, '#FFFFFF');
  doc.text('TRANSACTION SUMMARY', M + 2, y + 4.2);

  const txRows = [
    ['Entry Enterprise Value', fmt(outputs.sourcesUses.purchasePrice), true],
    ['Entry EBITDA', fmt(model.deal.entryEBITDA), false],
    ['Entry Revenue', fmt(model.deal.entryRevenue), false],
    ['Entry EV/EBITDA', fmtMult(model.deal.entryMultiple), true],
    ['Entry EV/Revenue', fmtMult(outputs.sourcesUses.purchasePrice / model.deal.entryRevenue), false],
    ['EBITDA Margin', fmtPct(model.deal.entryEBITDAMargin), false],
    ['Revenue CAGR', fmtPct(model.deal.revenueCAGR), false],
    ['Hold Period', `${hp} years`, false],
    ['Exit Multiple', `${fmtMult(model.deal.exitMultiple)} EV/EBITDA`, true],
  ] as const;

  let ty = y + 7;
  txRows.forEach(([label, value, bold], ri) => {
    const rowY = ty + ri * 5.5;
    if (ri % 2 === 0) drawRect(doc, M, rowY - 3.5, leftW, 5.5, LGREY);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7);
    setTextCol(doc, NAVY);
    doc.text(String(label), M + 2, rowY);
    doc.text(String(value), M + leftW - 2, rowY, { align: 'right' });
  });

  // ── Capital Structure (right) ──
  const rx = M + leftW + gapW;
  drawRect(doc, rx, y, rightW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextCol(doc, '#FFFFFF');
  doc.text('CAPITAL STRUCTURE', rx + 2, y + 4.2);

  // Column headers
  const capY = y + 7;
  drawRect(doc, rx, capY - 3.5, rightW, 5.5, NAVY2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setTextCol(doc, '#FFFFFF');

  const capCols = [rx + 2, rx + rightW * 0.45, rx + rightW * 0.62, rx + rightW * 0.78];
  doc.text('Instrument', capCols[0], capY);
  doc.text('Amount', capCols[1], capY);
  doc.text('% Cap', capCols[2], capY);
  doc.text('Rate', capCols[3], capY);

  let cy = capY + 5.5;
  const totalDebt = outputs.sourcesUses.totalDebt;
  const totalSources = outputs.sourcesUses.totalSources;

  model.debtTranches.forEach((t, ri) => {
    if (ri % 2 === 0) drawRect(doc, rx, cy - 3.5, rightW, 5.5, LGREY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setTextCol(doc, NAVY);
    doc.text(t.name, capCols[0], cy);
    doc.text(fmt(t.amount), capCols[1], cy);
    doc.text(fmtPct(t.amount / totalSources * 100, 0), capCols[2], cy);
    const rate = t.rateType === 'fixed'
      ? `${t.fixedRate.toFixed(1)}% fixed`
      : `S+${t.floatingSpread}bps`;
    doc.text(rate, capCols[3], cy);
    cy += 5.5;
  });

  // Sponsor equity row
  drawRect(doc, rx, cy - 3.5, rightW, 5.5, LGREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setTextCol(doc, GREEN);
  doc.text('Sponsor Equity', capCols[0], cy);
  doc.text(fmt(outputs.sourcesUses.sponsorEquity), capCols[1], cy);
  doc.text(fmtPct(outputs.sourcesUses.sponsorEquity / totalSources * 100, 0), capCols[2], cy);
  doc.text('', capCols[3], cy);
  cy += 5.5;

  // Management rollover row (if any)
  if (outputs.sourcesUses.managementRollover > 0) {
    drawRect(doc, rx, cy - 3.5, rightW, 5.5, LGREEN);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setTextCol(doc, GREEN);
    doc.text('Mgmt Rollover', capCols[0], cy);
    doc.text(fmt(outputs.sourcesUses.managementRollover), capCols[1], cy);
    doc.text(fmtPct(outputs.sourcesUses.managementRollover / totalSources * 100, 0), capCols[2], cy);
    doc.text('', capCols[3], cy);
    cy += 5.5;
  }

  // Total row
  drawRect(doc, rx, cy - 3.5, rightW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setTextCol(doc, '#FFFFFF');
  doc.text('Total', capCols[0], cy);
  doc.text(fmt(totalSources), capCols[1], cy);
  doc.text('100%', capCols[2], cy);
  doc.text(`${(totalDebt / model.deal.entryEBITDA).toFixed(1)}x EBITDA lev.`, capCols[3], cy);

  const endOfTables = Math.max(ty + txRows.length * 5.5, cy + 6) + 3;
  y = endOfTables;

  // 1.4 Charts Row (3 side by side)
  const chartH = 40;
  const chart1W = CW * 0.38;
  const chart2W = CW * 0.38;
  const chart3W = CW * 0.24;

  // Chart 1 — Revenue & EBITDA (grouped bar)
  const chart1Img = await renderChartToImage({
    type: 'bar',
    data: {
      labels: yearLabels,
      datasets: [
        {
          label: `Revenue (${cs}m)`,
          data: projections.map(p => p.revenue),
          backgroundColor: BLUE,
          barPercentage: 0.7,
        },
        {
          label: `EBITDA (${cs}m)`,
          data: projections.map(p => p.ebitda),
          backgroundColor: TEAL,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 9 }, padding: 6 } },
        title: { display: false },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 8 } } },
        y: { beginAtZero: true, ticks: { font: { size: 8 }, callback: (v: number | string) => `${cs}${v}m` } },
      },
    },
  }, 380, 220);

  // Chart 2 — Debt Paydown (stacked bar)
  const debtDatasets = outputs.debtSchedules
    .filter(s => {
      const tranche = model.debtTranches.find(t => t.id === s.trancheId);
      return tranche && !tranche.isUndrawn;
    })
    .map((schedule, i) => ({
      label: schedule.trancheName,
      data: schedule.years.slice(1).map(y => y.closingBalance),
      backgroundColor: i === 0 ? BLUE : i === 1 ? TEAL : AMBER,
    }));

  const chart2Img = await renderChartToImage({
    type: 'bar',
    data: { labels: yearLabels, datasets: debtDatasets },
    options: {
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 8 }, padding: 4 } },
        title: { display: false },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 8 } } },
        y: { stacked: true, beginAtZero: true, ticks: { font: { size: 8 }, callback: (v: number | string) => `${cs}${v}m` } },
      },
    },
  }, 380, 220);

  // Chart 3 — Exit Waterfall (bar)
  const chart3Img = await renderChartToImage({
    type: 'bar',
    data: {
      labels: ['Exit EV', 'Net Debt', 'Equity'],
      datasets: [{
        data: [
          outputs.exitWaterfall.exitEV,
          outputs.exitWaterfall.netDebtAtExit,
          outputs.exitWaterfall.exitEquityValue,
        ],
        backgroundColor: [BLUE, RED, GREEN],
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { beginAtZero: true, ticks: { font: { size: 8 }, callback: (v: number | string) => `${cs}${v}m` } },
      },
    },
  }, 240, 220);

  doc.addImage(chart1Img, 'PNG', M, y, chart1W, chartH);
  doc.addImage(chart2Img, 'PNG', M + chart1W, y, chart2W, chartH);
  doc.addImage(chart3Img, 'PNG', M + chart1W + chart2W, y, chart3W, chartH);

  y += chartH + 4;

  // 1.5 IRR Sensitivity Heatmap
  drawRect(doc, M, y, CW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextCol(doc, '#FFFFFF');
  doc.text('RETURNS SENSITIVITY — IRR (%)', M + 2, y + 4.2);
  y += 8;

  const holdPeriods = [3, 4, 5, 6, 7];
  const exitMults = [
    Math.max(model.deal.exitMultiple - 1.0, 3),
    model.deal.exitMultiple - 0.5,
    model.deal.exitMultiple,
    model.deal.exitMultiple + 0.5,
    model.deal.exitMultiple + 1.0,
  ];

  const senResult = computeSensitivity(model, 'exitMultiple', 'holdPeriod', 'irr', exitMults, holdPeriods);

  const colW = (CW - 22) / holdPeriods.length;
  const rowH = 7;

  // Column headers
  drawRect(doc, M, y - 3.5, CW, rowH, NAVY2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setTextCol(doc, '#FFFFFF');
  doc.text('Exit Mult \\ Hold', M + 2, y);
  holdPeriods.forEach((hp, ci) => {
    doc.text(`${hp}yr`, M + 22 + ci * colW + colW / 2, y, { align: 'center' });
  });
  y += rowH;

  // Data rows
  senResult.results.forEach((row, ri) => {
    const rowY = y + ri * rowH;
    // Row header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setTextCol(doc, NAVY);
    doc.text(`${exitMults[ri].toFixed(1)}x`, M + 2, rowY);

    // Cells
    row.forEach((val, ci) => {
      const cx = M + 22 + ci * colW;
      const irr = val;
      let bg: string;
      let fg: string;
      if (irr >= 35) { bg = '#1E8449'; fg = '#FFFFFF'; }
      else if (irr >= 25) { bg = GREEN; fg = '#FFFFFF'; }
      else if (irr >= 20) { bg = AMBER; fg = '#FFFFFF'; }
      else { bg = RED; fg = '#FFFFFF'; }

      drawRect(doc, cx, rowY - 3.5, colW - 0.5, rowH, bg);

      // Base case highlight
      if (Math.abs(exitMults[ri] - model.deal.exitMultiple) < 0.01 &&
          holdPeriods[ci] === model.deal.holdPeriod) {
        doc.setDrawColor(...hexToRGB(NAVY));
        doc.setLineWidth(0.5);
        doc.rect(cx, rowY - 3.5, colW - 0.5, rowH, 'S');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      setTextCol(doc, fg);
      const display = isFinite(irr) ? `${irr.toFixed(1)}%` : '—';
      doc.text(display, cx + colW / 2 - 0.25, rowY, { align: 'center' });
    });
  });

  y += exitMults.length * rowH + 2;

  // Footer (page 1)
  drawFooter(doc, W, H, M);

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2: Financial Projections
  // ─────────────────────────────────────────────────────────────────────────

  doc.addPage();

  // 2.1 Header
  drawRect(doc, 0, 0, W, 16, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setTextCol(doc, '#FFFFFF');
  doc.text(model.deal.companyName, M, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setTextCol(doc, '#A8C4E0');
  const yearRange = `Year 1–${hp}`;
  doc.text(`Financial Projections  ·  ${yearRange}`, W - M, 10.5, { align: 'right' });

  y = 20;

  // 2.2 Income Statement & Cash Flow Table
  const labelColW = CW * 0.30;
  const yearColW = (CW - labelColW) / hp;

  // Table header
  drawRect(doc, M, y, CW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setTextCol(doc, '#FFFFFF');
  doc.text('INCOME STATEMENT & CASH FLOW', M + 2, y + 4.2);
  projections.forEach((p, i) => {
    doc.text(`Year ${p.year}`, M + labelColW + i * yearColW + yearColW / 2, y + 4.2, { align: 'center' });
  });
  y += 7;

  interface TableRow {
    label: string;
    values: (string | number)[];
    bold?: boolean;
    indent?: boolean;
    bg?: string;
    textColor?: string;
  }

  const isTableRows: TableRow[] = [
    { label: 'Revenue', values: projections.map(p => fmt(p.revenue)), bold: true, bg: LBLUE },
    { label: '  YoY Growth', values: projections.map(p => fmtPct(p.revenueGrowth)), indent: true, textColor: DGREY },
    { label: 'EBITDA', values: projections.map(p => fmt(p.ebitda)), bold: true, bg: LBLUE },
    { label: '  EBITDA Margin', values: projections.map(p => fmtPct(p.ebitdaMargin)), indent: true, textColor: DGREY },
    { label: 'D&A', values: projections.map(p => fmt(-p.da)) },
    { label: 'EBIT', values: projections.map(p => fmt(p.ebit)), bold: true },
    { label: 'Interest Expense', values: projections.map(p => fmt(-p.interestExpense)) },
    { label: 'EBT', values: projections.map(p => fmt(p.ebt)) },
    { label: 'Tax', values: projections.map(p => fmt(-p.tax)) },
    { label: 'Net Income', values: projections.map(p => fmt(p.netIncome)), bold: true },
    { label: '', values: [] },
    { label: 'Capex', values: projections.map(p => fmt(-p.capex)) },
    { label: 'NWC Change', values: projections.map(p => fmt(-p.nwcChange)) },
    { label: 'Free Cash Flow', values: projections.map(p => fmt(p.leveredFCF)), bold: true, bg: LGREEN, textColor: GREEN },
    { label: '', values: [] },
    { label: 'Net Debt', values: projections.map(p => fmt(p.netDebt)), bold: true },
    {
      label: 'Net Leverage',
      values: projections.map(p => p.ebitda > 0 ? `${(p.netDebt / p.ebitda).toFixed(1)}x` : '—'),
      bold: true,
    },
    {
      label: 'Interest Coverage',
      values: outputs.debtSummary.slice(1).map(d => isFinite(d.interestCoverage) ? `${d.interestCoverage.toFixed(1)}x` : '—'),
    },
  ];

  isTableRows.forEach((row) => {
    if (!row.label) { y += 2; return; }
    const trH = 5.2;
    if (row.bg) drawRect(doc, M, y - 3.2, CW, trH, row.bg);

    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    setTextCol(doc, row.textColor || NAVY);
    doc.text(row.label, M + 2, y);

    row.values.forEach((val, i) => {
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.text(String(val), M + labelColW + i * yearColW + yearColW - 2, y, { align: 'right' });
    });
    y += trH;
  });

  y += 4;

  // 2.3 Debt Schedule Table
  drawRect(doc, M, y, CW, 6, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setTextCol(doc, '#FFFFFF');
  doc.text('DEBT SCHEDULE', M + 2, y + 4.2);
  projections.forEach((p, i) => {
    doc.text(`Year ${p.year}`, M + labelColW + i * yearColW + yearColW / 2, y + 4.2, { align: 'center' });
  });
  y += 7;

  outputs.debtSchedules.forEach((schedule) => {
    const tranche = model.debtTranches.find(t => t.id === schedule.trancheId);
    if (tranche?.isUndrawn) return; // skip RCF if undrawn

    const years = schedule.years.slice(1); // skip year 0

    const debtRows: TableRow[] = [
      { label: `${schedule.trancheName} Opening`, values: years.map(y => fmt(y.openingBalance)) },
      { label: '  Repayment', values: years.map(y => fmt(-(y.mandatoryAmort + y.cashSweepRepayment))), indent: true, textColor: DGREY },
      { label: `${schedule.trancheName} Closing`, values: years.map(y => fmt(y.closingBalance)), bold: true, bg: LBLUE },
    ];

    debtRows.forEach((row) => {
      const trH = 5.2;
      if (row.bg) drawRect(doc, M, y - 3.2, CW, trH, row.bg);
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.setFontSize(6.5);
      setTextCol(doc, row.textColor || NAVY);
      doc.text(row.label, M + 2, y);

      row.values.forEach((val, i) => {
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.text(String(val), M + labelColW + i * yearColW + yearColW - 2, y, { align: 'right' });
      });
      y += trH;
    });
    y += 1;
  });

  // Total Net Debt row
  drawRect(doc, M, y - 3.2, CW, 5.5, LRED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setTextCol(doc, RED);
  doc.text('Total Net Debt', M + 2, y);
  projections.forEach((p, i) => {
    doc.text(fmt(p.netDebt), M + labelColW + i * yearColW + yearColW - 2, y, { align: 'right' });
  });

  // Footer (page 2)
  drawFooter(doc, W, H, M);

  // ── Save ──────────────────────────────────────────────────────────────
  const safeName = model.deal.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`${safeName}-lbo-tearsheet-${dateStr}.pdf`);
}

// ── Footer helper ────────────────────────────────────────────────────────────

function drawFooter(doc: jsPDF, W: number, H: number, M: number) {
  const fy = H - 8;
  doc.setDrawColor(...hexToRGB(MGREY));
  doc.setLineWidth(0.2);
  doc.line(M, fy, W - M, fy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  setTextCol(doc, DGREY);
  doc.text('CONFIDENTIAL — For illustrative purposes only. Not for distribution.', M, fy + 3.5);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}  ·  lbo-model-tau.vercel.app`, W - M, fy + 3.5, { align: 'right' });
}
