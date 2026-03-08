import { useModel } from '../../context/ModelContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export function Export() {
  const { model, outputs } = useModel();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sources & Uses sheet
    const suData = [
      ['SOURCES & USES', '', ''],
      ['', `${cs}m`, '% of Total'],
      ['USES', '', ''],
      ['Purchase Price (EV)', outputs.sourcesUses.purchasePrice, outputs.sourcesUses.purchasePrice / outputs.sourcesUses.totalUses],
      ['Transaction Fees', outputs.sourcesUses.transactionFees, outputs.sourcesUses.transactionFees / outputs.sourcesUses.totalUses],
      ['Financing Fees', outputs.sourcesUses.financingFees, outputs.sourcesUses.financingFees / outputs.sourcesUses.totalUses],
      ['Cash to Balance Sheet', outputs.sourcesUses.cashToBS, outputs.sourcesUses.cashToBS / outputs.sourcesUses.totalUses],
      ['Total Uses', outputs.sourcesUses.totalUses, 1],
      ['', '', ''],
      ['SOURCES', '', ''],
      ...model.debtTranches.map(t => [t.name, t.amount, t.amount / outputs.sourcesUses.totalSources]),
      ['Sponsor Equity', outputs.sourcesUses.sponsorEquity, outputs.sourcesUses.sponsorEquity / outputs.sourcesUses.totalSources],
      ['Management Rollover', outputs.sourcesUses.managementRollover, outputs.sourcesUses.managementRollover / outputs.sourcesUses.totalSources],
      ['Total Sources', outputs.sourcesUses.totalSources, 1],
    ];
    const suWs = XLSX.utils.aoa_to_sheet(suData);
    XLSX.utils.book_append_sheet(wb, suWs, 'Sources & Uses');

    // P&L sheet
    const hp = model.deal.holdPeriod;
    const headers = ['', ...outputs.projections.map((_p, i) => i === 0 ? 'LTM' : `Year ${i}`)];
    const plData = [
      ['INCOME STATEMENT', ...Array(hp + 1).fill('')],
      headers,
      ['Revenue', ...outputs.projections.map(p => p.revenue)],
      ['Revenue Growth (%)', ...outputs.projections.map(p => p.revenueGrowth / 100)],
      ['EBITDA', ...outputs.projections.map(p => p.ebitda)],
      ['EBITDA Margin (%)', ...outputs.projections.map(p => p.ebitdaMargin / 100)],
      ['D&A', ...outputs.projections.map(p => -p.da)],
      ['EBIT', ...outputs.projections.map(p => p.ebit)],
      ['Interest Expense', ...outputs.projections.map(p => -p.interestExpense)],
      ['EBT', ...outputs.projections.map(p => p.ebt)],
      ['Tax', ...outputs.projections.map(p => -p.tax)],
      ['Net Income', ...outputs.projections.map(p => p.netIncome)],
      ['', ...Array(hp + 1).fill('')],
      ['CASH FLOW', ...Array(hp + 1).fill('')],
      ['EBITDA', ...outputs.projections.map(p => p.ebitda)],
      ['Capex', ...outputs.projections.map(p => -p.capex)],
      ['NWC Change', ...outputs.projections.map(p => -p.nwcChange)],
      ['Unlevered FCF', ...outputs.projections.map(p => p.unleveredFCF)],
      ['Interest Paid', ...outputs.projections.map(p => -p.interestPaid)],
      ['Debt Repayment', ...outputs.projections.map(p => -p.debtRepayment)],
      ['Cash Sweep', ...outputs.projections.map(p => -p.cashSweep)],
      ['Levered FCF', ...outputs.projections.map(p => p.leveredFCF)],
    ];
    const plWs = XLSX.utils.aoa_to_sheet(plData);
    XLSX.utils.book_append_sheet(wb, plWs, 'Operating Model');

    // Debt Schedule sheet
    const debtData: (string | number)[][] = [['DEBT SCHEDULE']];
    outputs.debtSchedules.forEach(schedule => {
      debtData.push([]);
      debtData.push([schedule.trancheName]);
      debtData.push(headers);
      debtData.push(['Opening Balance', ...schedule.years.map(y => y.openingBalance)]);
      debtData.push(['Cash Interest', ...schedule.years.map(y => -y.cashInterest)]);
      debtData.push(['PIK Interest', ...schedule.years.map(y => y.pikInterest)]);
      debtData.push(['Mandatory Amort', ...schedule.years.map(y => -y.mandatoryAmort)]);
      debtData.push(['Cash Sweep', ...schedule.years.map(y => -y.cashSweepRepayment)]);
      debtData.push(['Closing Balance', ...schedule.years.map(y => y.closingBalance)]);
    });
    debtData.push([]);
    debtData.push(['COVERAGE RATIOS']);
    debtData.push(headers);
    debtData.push(['Interest Coverage', ...outputs.debtSummary.map(d => isFinite(d.interestCoverage) ? d.interestCoverage : 'N/A')]);
    debtData.push(['Net Leverage', ...outputs.debtSummary.map(d => isFinite(d.netLeverage) ? d.netLeverage : 'N/A')]);

    const debtWs = XLSX.utils.aoa_to_sheet(debtData);
    XLSX.utils.book_append_sheet(wb, debtWs, 'Debt Schedule');

    // Returns sheet
    const retData = [
      ['RETURNS ANALYSIS'],
      [''],
      ['Exit Waterfall'],
      ['Exit EBITDA', outputs.exitWaterfall.exitEBITDA],
      ['Exit Multiple', outputs.exitWaterfall.exitMultiple],
      ['Exit EV', outputs.exitWaterfall.exitEV],
      ['Net Debt at Exit', outputs.exitWaterfall.netDebtAtExit],
      ['Exit Equity Value', outputs.exitWaterfall.exitEquityValue],
      ['Management Proceeds', outputs.exitWaterfall.managementProceeds],
      ['Sponsor Proceeds', outputs.exitWaterfall.sponsorProceeds],
      [''],
      ['Returns', 'Sponsor', 'Management', 'Total'],
      ['Equity Invested', outputs.returns.sponsor.equityInvested, outputs.returns.management.equityInvested, outputs.returns.total.equityInvested],
      ['Equity Returned', outputs.returns.sponsor.equityReturned, outputs.returns.management.equityReturned, outputs.returns.total.equityReturned],
      ['MoM', outputs.returns.sponsor.mom, outputs.returns.management.mom, outputs.returns.total.mom],
      ['IRR', outputs.returns.sponsor.irr / 100, outputs.returns.management.irr / 100, outputs.returns.total.irr / 100],
      ['Hold Period', outputs.returns.sponsor.holdPeriod, outputs.returns.management.holdPeriod, outputs.returns.total.holdPeriod],
    ];
    const retWs = XLSX.utils.aoa_to_sheet(retData);
    XLSX.utils.book_append_sheet(wb, retWs, 'Returns');

    XLSX.writeFile(wb, `${model.deal.companyName.replace(/\s+/g, '_')}_LBO_Model.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    const ret = outputs.returns;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(model.deal.companyName, 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`LBO Deal Tear Sheet  |  ${model.deal.sector}  |  ${model.deal.dealDate}`, 14, 22);

    // Line
    doc.setDrawColor(100);
    doc.line(14, 25, w - 14, 25);

    let y = 32;

    // Deal Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Deal Summary', 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const summaryItems = [
      [`Enterprise Value: ${cs}${outputs.sourcesUses.purchasePrice.toFixed(1)}m`, `Entry Multiple: ${model.deal.entryMultiple.toFixed(1)}x`],
      [`Total Debt: ${cs}${outputs.sourcesUses.totalDebt.toFixed(1)}m`, `Exit Multiple: ${model.deal.exitMultiple.toFixed(1)}x`],
      [`Sponsor Equity: ${cs}${outputs.sourcesUses.sponsorEquity.toFixed(1)}m`, `Hold Period: ${model.deal.holdPeriod} years`],
      [`Entry EBITDA: ${cs}${model.deal.entryEBITDA.toFixed(1)}m`, `Revenue CAGR: ${model.deal.revenueCAGR.toFixed(1)}%`],
      [`EBITDA Margin: ${model.deal.entryEBITDAMargin.toFixed(1)}% → ${model.deal.exitEBITDAMargin.toFixed(1)}%`, ''],
    ];

    summaryItems.forEach(([left, right]) => {
      doc.text(left, 14, y);
      doc.text(right, w / 2, y);
      y += 5;
    });

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Returns', 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Returns table
    const retHeaders = ['', 'Sponsor', 'Management', 'Total'];
    const retRows = [
      ['MoM', `${ret.sponsor.mom.toFixed(2)}x`, `${ret.management.mom.toFixed(2)}x`, `${ret.total.mom.toFixed(2)}x`],
      ['IRR', `${ret.sponsor.irr.toFixed(1)}%`, `${ret.management.irr.toFixed(1)}%`, `${ret.total.irr.toFixed(1)}%`],
      ['Equity Invested', `${cs}${ret.sponsor.equityInvested.toFixed(1)}m`, `${cs}${ret.management.equityInvested.toFixed(1)}m`, `${cs}${ret.total.equityInvested.toFixed(1)}m`],
      ['Equity Returned', `${cs}${ret.sponsor.equityReturned.toFixed(1)}m`, `${cs}${ret.management.equityReturned.toFixed(1)}m`, `${cs}${ret.total.equityReturned.toFixed(1)}m`],
    ];

    doc.setFont('helvetica', 'bold');
    retHeaders.forEach((h, i) => doc.text(h, 14 + i * 50, y));
    y += 4;
    doc.setFont('helvetica', 'normal');
    retRows.forEach(row => {
      row.forEach((cell, i) => doc.text(cell, 14 + i * 50, y));
      y += 4;
    });

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Exit Waterfall', 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const wfItems = [
      ['Exit EV', `${cs}${outputs.exitWaterfall.exitEV.toFixed(1)}m`],
      ['Net Debt at Exit', `${cs}${outputs.exitWaterfall.netDebtAtExit.toFixed(1)}m`],
      ['Exit Equity Value', `${cs}${outputs.exitWaterfall.exitEquityValue.toFixed(1)}m`],
      ['Sponsor Proceeds', `${cs}${outputs.exitWaterfall.sponsorProceeds.toFixed(1)}m`],
    ];
    wfItems.forEach(([label, val]) => {
      doc.text(label, 14, y);
      doc.text(val, 80, y);
      y += 5;
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleDateString()} — LBO Model`, 14, doc.internal.pageSize.getHeight() - 8);

    doc.save(`${model.deal.companyName.replace(/\s+/g, '_')}_Tear_Sheet.pdf`);
  };

  const copyReturns = () => {
    const ret = outputs.returns;
    const text = [
      `${model.deal.companyName} — LBO Returns Summary`,
      `${'─'.repeat(50)}`,
      `                  Sponsor    Mgmt       Total`,
      `MoM               ${ret.sponsor.mom.toFixed(2)}×      ${ret.management.mom.toFixed(2)}×      ${ret.total.mom.toFixed(2)}×`,
      `IRR               ${ret.sponsor.irr.toFixed(1)}%     ${ret.management.irr.toFixed(1)}%     ${ret.total.irr.toFixed(1)}%`,
      `Eq. Invested      ${cs}${ret.sponsor.equityInvested.toFixed(1)}m   ${cs}${ret.management.equityInvested.toFixed(1)}m   ${cs}${ret.total.equityInvested.toFixed(1)}m`,
      `Eq. Returned      ${cs}${ret.sponsor.equityReturned.toFixed(1)}m  ${cs}${ret.management.equityReturned.toFixed(1)}m  ${cs}${ret.total.equityReturned.toFixed(1)}m`,
      `Hold Period       ${ret.sponsor.holdPeriod} years`,
      `${'─'.repeat(50)}`,
      `Exit EV: ${cs}${outputs.exitWaterfall.exitEV.toFixed(1)}m (${outputs.exitWaterfall.exitMultiple.toFixed(1)}× EBITDA)`,
    ].join('\n');

    navigator.clipboard.writeText(text);
  };

  return (
    <div className="section-container">
      <h2 className="section-title">Export</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ExportCard
          title="Excel Export"
          description="Full model: Sources & Uses, P&L, Debt Schedule, Returns. Multi-tab workbook with all projections."
          buttonText="Download .xlsx"
          icon="↓"
          onClick={exportExcel}
        />
        <ExportCard
          title="PDF Tear Sheet"
          description="One-page deal summary with key metrics: returns, exit waterfall, and deal parameters."
          buttonText="Download .pdf"
          icon="↓"
          onClick={exportPDF}
        />
        <ExportCard
          title="Copy to Clipboard"
          description="Formatted returns table ready to paste into emails, presentations, or chat."
          buttonText="Copy Returns"
          icon="⎘"
          onClick={copyReturns}
        />
      </div>

      {/* Preview of what gets exported */}
      <div className="mt-8">
        <div className="section-subtitle">Export Preview — Key Metrics</div>
        <div className="bg-bg-secondary border border-border p-4 font-mono text-xs whitespace-pre leading-relaxed text-text-secondary">
{`${model.deal.companyName} — LBO Returns Summary
${'─'.repeat(50)}
                  Sponsor    Mgmt       Total
MoM               ${outputs.returns.sponsor.mom.toFixed(2)}×      ${outputs.returns.management.mom.toFixed(2)}×      ${outputs.returns.total.mom.toFixed(2)}×
IRR               ${outputs.returns.sponsor.irr.toFixed(1)}%     ${outputs.returns.management.irr.toFixed(1)}%     ${outputs.returns.total.irr.toFixed(1)}%
Eq. Invested      ${cs}${outputs.returns.sponsor.equityInvested.toFixed(1)}m   ${cs}${outputs.returns.management.equityInvested.toFixed(1)}m   ${cs}${outputs.returns.total.equityInvested.toFixed(1)}m
Eq. Returned      ${cs}${outputs.returns.sponsor.equityReturned.toFixed(1)}m  ${cs}${outputs.returns.management.equityReturned.toFixed(1)}m  ${cs}${outputs.returns.total.equityReturned.toFixed(1)}m
Hold Period       ${outputs.returns.sponsor.holdPeriod} years
${'─'.repeat(50)}
Exit EV: ${cs}${outputs.exitWaterfall.exitEV.toFixed(1)}m (${outputs.exitWaterfall.exitMultiple.toFixed(1)}× EBITDA)`}
        </div>
      </div>
    </div>
  );
}

function ExportCard({ title, description, buttonText, icon, onClick }: {
  title: string; description: string; buttonText: string; icon: string; onClick: () => void;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5 flex flex-col justify-between">
      <div>
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="text-xs text-text-muted mt-2 leading-relaxed">{description}</div>
      </div>
      <button
        onClick={onClick}
        className="mt-4 w-full py-2 px-4 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue text-xs font-semibold uppercase tracking-wider hover:bg-accent-blue/30 transition-colors flex items-center justify-center gap-2"
      >
        <span>{icon}</span> {buttonText}
      </button>
    </div>
  );
}
