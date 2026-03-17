// ─────────────────────────────────────────────────────────────────────────────
// Excel Export — 6-tab professionally formatted workbook
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import type { LBOModel, LBOModelOutputs } from './types';
import { computeSensitivity } from './lbo-engine';

// ── Styling helpers ──────────────────────────────────────────────────────────

const NAVY = '1A2332';
const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: 'center' } };
const labelStyle = { font: { bold: true } };
const pctFmt = '0.0%';
const currFmt = '#,##0.0';
const multFmt = '0.00"×"';

function applyHeaderRow(ws: XLSX.WorkSheet, row: number, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    ws[addr].s = headerStyle;
  }
}

function autoWidth(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cols: XLSX.ColInfo[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxW = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell?.v != null) {
        const len = String(cell.v).length;
        if (len + 2 > maxW) maxW = Math.min(len + 2, 30);
      }
    }
    cols.push({ wch: maxW });
  }
  ws['!cols'] = cols;
}

// ── Main export function ─────────────────────────────────────────────────────

export function exportToExcel(model: LBOModel, outputs: LBOModelOutputs) {
  const wb = XLSX.utils.book_new();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const hp = model.deal.holdPeriod;
  const exportDate = new Date().toLocaleDateString('en-GB');

  // ── 1. Summary ────────────────────────────────────────────────────────
  {
    const data = [
      [`${model.deal.companyName} — LBO Model Summary`, '', '', `Exported: ${exportDate}`],
      [],
      ['DEAL OVERVIEW'],
      ['Company Name', model.deal.companyName],
      ['Sector', model.deal.sector],
      ['Deal Date', model.deal.dealDate],
      ['Currency', model.deal.currency],
      [],
      ['ENTRY METRICS'],
      ['Enterprise Value', outputs.sourcesUses.purchasePrice],
      ['Entry EBITDA', model.deal.entryEBITDA],
      ['Entry Multiple', model.deal.entryMultiple],
      ['Entry Revenue', model.deal.entryRevenue],
      [],
      ['EXIT METRICS'],
      ['Exit EBITDA', outputs.exitWaterfall.exitEBITDA],
      ['Exit Multiple', outputs.exitWaterfall.exitMultiple],
      ['Exit EV', outputs.exitWaterfall.exitEV],
      ['Net Debt at Exit', outputs.exitWaterfall.netDebtAtExit],
      ['Exit Equity Value', outputs.exitWaterfall.exitEquityValue],
      [],
      ['RETURNS', 'Sponsor', 'Management', 'Total'],
      ['IRR', outputs.returns.sponsor.irr / 100, outputs.returns.management.irr / 100, outputs.returns.total.irr / 100],
      ['MoM', outputs.returns.sponsor.mom, outputs.returns.management.mom, outputs.returns.total.mom],
      ['Equity Invested', outputs.returns.sponsor.equityInvested, outputs.returns.management.equityInvested, outputs.returns.total.equityInvested],
      ['Equity Returned', outputs.returns.sponsor.equityReturned, outputs.returns.management.equityReturned, outputs.returns.total.equityReturned],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format currency cells
    [9, 10, 12, 15, 17, 18, 19, 24, 25].forEach(r => {
      for (let c = 1; c <= 3; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = currFmt;
      }
    });
    // Format IRR as %
    [22].forEach(r => {
      for (let c = 1; c <= 3; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = pctFmt;
      }
    });
    // Format MoM
    [23].forEach(r => {
      for (let c = 1; c <= 3; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = multFmt;
      }
    });
    // Format multiple
    [11, 16].forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws[addr]?.t === 'n') ws[addr].z = '0.0"×"';
    });

    // Bold section headers
    [0, 2, 8, 14, 20].forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) ws[addr].s = labelStyle;
    });
    applyHeaderRow(ws, 21, 4);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  // ── 2. Sources & Uses ─────────────────────────────────────────────────
  {
    const su = outputs.sourcesUses;
    const data = [
      [`${model.deal.companyName} — Sources & Uses`, '', '', `Exported: ${exportDate}`],
      [],
      ['USES', `${cs}m`, '% of Total'],
      ['Purchase Price (EV)', su.purchasePrice, su.purchasePrice / su.totalUses],
      ['Transaction Fees', su.transactionFees, su.transactionFees / su.totalUses],
      ['Financing Fees', su.financingFees, su.financingFees / su.totalUses],
      ['Cash to Balance Sheet', su.cashToBS, su.cashToBS / su.totalUses],
      ['Total Uses', su.totalUses, 1],
      [],
      ['SOURCES', `${cs}m`, '% of Total'],
      ...model.debtTranches.map(t => [t.name, t.amount, t.amount / su.totalSources]),
      ['Sponsor Equity', su.sponsorEquity, su.sponsorEquity / su.totalSources],
      ['Management Rollover', su.managementRollover, su.managementRollover / su.totalSources],
      ['Total Sources', su.totalSources, 1],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format amounts and percentages
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = 3; r <= range.e.r; r++) {
      const c1 = XLSX.utils.encode_cell({ r, c: 1 });
      const c2 = XLSX.utils.encode_cell({ r, c: 2 });
      if (ws[c1]?.t === 'n') ws[c1].z = currFmt;
      if (ws[c2]?.t === 'n') ws[c2].z = pctFmt;
    }
    applyHeaderRow(ws, 2, 3);
    applyHeaderRow(ws, 9, 3);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Sources & Uses');
  }

  // ── 3. Operating Model ────────────────────────────────────────────────
  {
    const yearHeaders = ['', ...outputs.projections.map((_, i) => i === 0 ? 'LTM' : `Year ${i}`)];
    const numCols = hp + 2; // label + years

    const data: (string | number)[][] = [
      [`${model.deal.companyName} — Operating Model`, ...Array(hp + 1).fill(''), `Exported: ${exportDate}`],
      [],
      ['INCOME STATEMENT', ...Array(hp + 1).fill('')],
      yearHeaders,
      ['Revenue', ...outputs.projections.map(p => p.revenue)],
      ['Revenue Growth (%)', ...outputs.projections.map(p => p.revenueGrowth / 100)],
      ['Gross Profit', ...outputs.projections.map(p => p.grossProfit)],
      ['EBITDA', ...outputs.projections.map(p => p.ebitda)],
      ['EBITDA Margin (%)', ...outputs.projections.map(p => p.ebitdaMargin / 100)],
      ['D&A', ...outputs.projections.map(p => -p.da)],
      ['EBIT', ...outputs.projections.map(p => p.ebit)],
      ['Interest Expense', ...outputs.projections.map(p => -p.interestExpense)],
      ['PIK Interest', ...outputs.projections.map(p => -p.pikInterest)],
      ['EBT', ...outputs.projections.map(p => p.ebt)],
      ['Tax', ...outputs.projections.map(p => -p.tax)],
      ['Net Income', ...outputs.projections.map(p => p.netIncome)],
      [],
      ['CASH FLOW', ...Array(hp + 1).fill('')],
      yearHeaders,
      ['EBITDA', ...outputs.projections.map(p => p.ebitda)],
      ['Capex', ...outputs.projections.map(p => -p.capex)],
      ['NWC Change', ...outputs.projections.map(p => -p.nwcChange)],
      ['Cash Taxes', ...outputs.projections.map(p => -p.cashTaxes)],
      ['Unlevered FCF', ...outputs.projections.map(p => p.unleveredFCF)],
      ['Interest Paid', ...outputs.projections.map(p => -p.interestPaid)],
      ['Debt Repayment', ...outputs.projections.map(p => -p.debtRepayment)],
      ['Cash Sweep', ...outputs.projections.map(p => -p.cashSweep)],
      ['Levered FCF', ...outputs.projections.map(p => p.leveredFCF)],
      [],
      ['BALANCE SHEET (KEY ITEMS)', ...Array(hp + 1).fill('')],
      yearHeaders,
      ['Cash', ...outputs.projections.map(p => p.cash)],
      ['Net Debt', ...outputs.projections.map(p => p.netDebt)],
      ['Implied Equity Value', ...outputs.projections.map(p => p.impliedEquityValue)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format: currency for most rows, % for growth/margin rows
    const pctRows = new Set([5, 8]);
    const allRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = 4; r <= allRange.e.r; r++) {
      for (let c = 1; c <= hp + 1; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') {
          ws[addr].z = pctRows.has(r) ? pctFmt : currFmt;
        }
      }
    }
    applyHeaderRow(ws, 3, numCols);
    applyHeaderRow(ws, 18, numCols);
    applyHeaderRow(ws, 30, numCols);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Operating Model');
  }

  // ── 4. Debt Schedule ──────────────────────────────────────────────────
  {
    const yearHeaders = ['', ...outputs.projections.map((_, i) => i === 0 ? 'LTM' : `Year ${i}`)];
    const data: (string | number)[][] = [
      [`${model.deal.companyName} — Debt Schedule`, '', '', '', '', `Exported: ${exportDate}`],
      [],
    ];

    outputs.debtSchedules.forEach(schedule => {
      data.push([schedule.trancheName, ...Array(hp + 1).fill('')]);
      const headerRow = data.length;
      data.push(yearHeaders);
      data.push(['Opening Balance', ...schedule.years.map(y => y.openingBalance)]);
      data.push(['Cash Interest', ...schedule.years.map(y => -y.cashInterest)]);
      data.push(['PIK Interest', ...schedule.years.map(y => y.pikInterest)]);
      data.push(['Mandatory Amort', ...schedule.years.map(y => -y.mandatoryAmort)]);
      data.push(['Cash Sweep', ...schedule.years.map(y => -y.cashSweepRepayment)]);
      data.push(['Closing Balance', ...schedule.years.map(y => y.closingBalance)]);
      data.push([]);
      // Will apply header style after creating worksheet
      void headerRow;
    });

    data.push(['COVERAGE RATIOS', ...Array(hp + 1).fill('')]);
    const ratioHeader = data.length;
    data.push(yearHeaders);
    data.push(['Interest Coverage', ...outputs.debtSummary.map(d => isFinite(d.interestCoverage) ? d.interestCoverage : 0)]);
    data.push(['Net Leverage', ...outputs.debtSummary.map(d => isFinite(d.netLeverage) ? d.netLeverage : 0)]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format all numeric cells as currency
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = 2; r <= range.e.r; r++) {
      for (let c = 1; c <= hp + 1; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = currFmt;
      }
    }
    // Ratio rows: format as multiple
    for (let r = ratioHeader; r <= range.e.r; r++) {
      for (let c = 1; c <= hp + 1; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = '0.0"×"';
      }
    }

    // Apply header styles to tranche header rows
    let row = 3;
    outputs.debtSchedules.forEach(() => {
      applyHeaderRow(ws, row, hp + 2);
      row += 9; // 1 name + 1 header + 6 data + 1 blank
    });
    applyHeaderRow(ws, ratioHeader, hp + 2);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Debt Schedule');
  }

  // ── 5. Returns Analysis (sensitivity grid) ────────────────────────────
  {
    const data: (string | number)[][] = [
      [`${model.deal.companyName} — Returns Analysis`, '', '', '', '', '', `Exported: ${exportDate}`],
      [],
    ];

    // IRR sensitivity: Exit Multiple × Hold Period
    const exitMults = [
      Math.max(model.deal.exitMultiple - 2, 3),
      model.deal.exitMultiple - 1,
      model.deal.exitMultiple,
      model.deal.exitMultiple + 1,
      model.deal.exitMultiple + 2,
    ];
    const holdPeriods = [3, 4, 5, 6, 7];

    const irrSens = computeSensitivity(model, 'exitMultiple', 'holdPeriod', 'irr', exitMults, holdPeriods);

    data.push(['SPONSOR IRR (%) — Exit Multiple vs Hold Period']);
    const irrHeaderRow = data.length;
    data.push(['Exit Multiple \\ Hold Period', ...holdPeriods.map(h => `${h}yr`)]);
    irrSens.results.forEach((row, ri) => {
      data.push([`${exitMults[ri].toFixed(1)}×`, ...row.map(v => isFinite(v) ? v / 100 : 0)]);
    });
    data.push([]);

    // MoM sensitivity: Exit Multiple × Revenue CAGR
    const cagrs = [4, 6, 8, 10, 12];
    const momSens = computeSensitivity(model, 'exitMultiple', 'revenueCAGR', 'mom', exitMults, cagrs);

    data.push(['SPONSOR MoM (×) — Exit Multiple vs Revenue CAGR']);
    const momHeaderRow = data.length;
    data.push(['Exit Multiple \\ Revenue CAGR', ...cagrs.map(c => `${c}%`)]);
    momSens.results.forEach((row, ri) => {
      data.push([`${exitMults[ri].toFixed(1)}×`, ...row.map(v => isFinite(v) ? v : 0)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format IRR cells as percentage
    for (let r = irrHeaderRow + 1; r <= irrHeaderRow + exitMults.length; r++) {
      for (let c = 1; c <= holdPeriods.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = pctFmt;
      }
    }
    // Format MoM cells as multiple
    for (let r = momHeaderRow + 1; r <= momHeaderRow + exitMults.length; r++) {
      for (let c = 1; c <= cagrs.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]?.t === 'n') ws[addr].z = multFmt;
      }
    }

    applyHeaderRow(ws, irrHeaderRow, holdPeriods.length + 1);
    applyHeaderRow(ws, momHeaderRow, cagrs.length + 1);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Returns Analysis');
  }

  // ── 6. Assumptions ────────────────────────────────────────────────────
  {
    const d = model.deal;
    const data: (string | number | boolean)[][] = [
      [`${model.deal.companyName} — Assumptions`, '', `Exported: ${exportDate}`],
      [],
      ['DEAL ASSUMPTIONS'],
      ['Parameter', 'Value'],
      ['Company Name', d.companyName],
      ['Sector', d.sector],
      ['Deal Date', d.dealDate],
      ['Currency', d.currency],
      ['Deal Type', d.dealType],
      ['Entry EBITDA (m)', d.entryEBITDA],
      ['Entry Multiple (×)', d.entryMultiple],
      ['Enterprise Value (m)', d.enterpriseValue],
      [],
      ['CAPITAL STRUCTURE'],
      ['Parameter', 'Value'],
      ['Equity (% of EV)', d.equityPct / 100],
      ['Debt (% of EV)', d.debtPct / 100],
      ['Management Rollover (% of equity)', d.managementRolloverPct / 100],
      ['Transaction Fees (% of EV)', d.transactionFeesPct / 100],
      ['Financing Fees (% of debt)', d.financingFeesPct / 100],
      ['Cash to Balance Sheet (m)', d.cashToBS],
      [],
      ['OPERATING ASSUMPTIONS'],
      ['Parameter', 'Value'],
      ['Revenue CAGR', d.revenueCAGR / 100],
      ['Entry EBITDA Margin', d.entryEBITDAMargin / 100],
      ['Exit EBITDA Margin', d.exitEBITDAMargin / 100],
      ['Gross Margin', d.grossMargin / 100],
      ['Tax Rate', d.taxRate / 100],
      ['D&A (% of revenue)', d.daPercent / 100],
      ['Capex (% of revenue)', d.capexPercent / 100],
      ['NWC (% of revenue delta)', d.nwcPercent / 100],
      [],
      ['EXIT ASSUMPTIONS'],
      ['Parameter', 'Value'],
      ['Hold Period (years)', d.holdPeriod],
      ['Exit Multiple (×)', d.exitMultiple],
      ['Link Exit to Entry', d.linkExitToEntry ? 'Yes' : 'No'],
      [],
      ['DEBT TRANCHES'],
      ['Name', 'Amount (m)', 'Rate Type', 'Rate/Spread', 'Amort (%)', 'Tenor', 'PIK', 'Undrawn'],
    ];

    model.debtTranches.forEach(t => {
      const rate = t.rateType === 'fixed' ? `${t.fixedRate.toFixed(2)}%` : `SONIA + ${t.floatingSpread}bps`;
      data.push([t.name, t.amount, t.rateType, rate, t.amortisationPct, t.tenor, t.isPIK ? 'Yes' : 'No', t.isUndrawn ? 'Yes' : 'No']);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Format percentage cells
    const pctCells = [15, 16, 17, 18, 19, 24, 25, 26, 27, 28, 29, 30, 31];
    pctCells.forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws[addr]?.t === 'n') ws[addr].z = pctFmt;
    });
    // Format currency cells
    [9, 11, 20].forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws[addr]?.t === 'n') ws[addr].z = currFmt;
    });
    // Format multiples
    [10, 36].forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws[addr]?.t === 'n') ws[addr].z = '0.0"×"';
    });

    applyHeaderRow(ws, 3, 2);
    applyHeaderRow(ws, 14, 2);
    applyHeaderRow(ws, 23, 2);
    applyHeaderRow(ws, 34, 2);
    applyHeaderRow(ws, 40, 8);
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Assumptions');
  }

  // ── Download ──────────────────────────────────────────────────────────
  const filename = `${model.deal.companyName.replace(/\s+/g, '_')}_LBO_Model.xlsx`;
  XLSX.writeFile(wb, filename);
}
