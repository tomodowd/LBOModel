import { useModel } from '../../context/ModelContext';
import { InlineInput } from '../common/InlineInput';
import type { YearlyOverrides } from '../../lib/types';

export function OperatingModel() {
  const { model, outputs, dispatch } = useModel();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const hp = model.deal.holdPeriod;
  const proj = outputs.projections;

  const setOverride = (year: number, field: keyof YearlyOverrides, value: number | undefined) =>
    dispatch({ type: 'SET_YEARLY_OVERRIDE', year, field, value });

  const fmtCurr = (v: number) => {
    const abs = Math.abs(v);
    const s = `${abs.toFixed(1)}`;
    return v < 0 ? `(${s})` : s;
  };

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const years = Array.from({ length: hp + 1 }, (_, i) => i);

  const negClass = (v: number) => v < 0 ? 'cell-negative' : '';

  return (
    <div className="section-container">
      <h2 className="section-title">Operating Model</h2>

      {/* Income Statement */}
      <div className="section-subtitle">Income Statement ({cs}m)</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="min-w-[180px]"></th>
              {years.map(y => (
                <th key={y} className="min-w-[90px]">{y === 0 ? 'LTM' : `Year ${y}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <tr className="row-header"><td colSpan={hp + 2}>Revenue</td></tr>
            <tr>
              <td>Revenue</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula">{fmtCurr(p.revenue)}</td>
              ))}
            </tr>
            <tr>
              <td>YoY Growth (%)</td>
              {proj.map((p, i) => (
                <td key={p.year}>
                  {i === 0 ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <InlineInput
                      value={model.yearlyOverrides[p.year]?.revenueGrowth ?? p.revenueGrowth}
                      onChange={v => setOverride(p.year, 'revenueGrowth', v)}
                      suffix="%" width={65}
                    />
                  )}
                </td>
              ))}
            </tr>

            {/* Profitability */}
            <tr className="row-header"><td colSpan={hp + 2}>Profitability</td></tr>
            <tr>
              <td>Gross Profit</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula">{fmtCurr(p.grossProfit)}</td>
              ))}
            </tr>
            <tr>
              <td>Gross Margin (%)</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula text-text-secondary">{fmtPct(p.grossMargin)}</td>
              ))}
            </tr>
            <tr>
              <td className="font-semibold text-text-primary!">EBITDA</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula font-semibold">{fmtCurr(p.ebitda)}</td>
              ))}
            </tr>
            <tr>
              <td>EBITDA Margin (%)</td>
              {proj.map((p, i) => (
                <td key={p.year}>
                  {i === 0 ? (
                    <span className="cell-formula text-text-secondary">{fmtPct(p.ebitdaMargin)}</span>
                  ) : (
                    <InlineInput
                      value={model.yearlyOverrides[p.year]?.ebitdaMargin ?? p.ebitdaMargin}
                      onChange={v => setOverride(p.year, 'ebitdaMargin', v)}
                      suffix="%" width={65}
                    />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td>D&A</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula ${negClass(-p.da)}`}>({p.da.toFixed(1)})</td>
              ))}
            </tr>
            <tr>
              <td className="font-semibold text-text-primary!">EBIT</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-semibold ${negClass(p.ebit)}`}>{fmtCurr(p.ebit)}</td>
              ))}
            </tr>

            {/* Below EBIT */}
            <tr className="row-header"><td colSpan={hp + 2}>Below the Line</td></tr>
            <tr>
              <td>Interest Expense</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula cell-negative">
                  {p.interestExpense > 0 ? `(${p.interestExpense.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>EBT</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula ${negClass(p.ebt)}`}>{fmtCurr(p.ebt)}</td>
              ))}
            </tr>
            <tr>
              <td>Tax</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula">({p.tax.toFixed(1)})</td>
              ))}
            </tr>
            <tr className="row-total">
              <td className="font-bold text-text-primary!">Net Income</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-bold ${negClass(p.netIncome)}`}>{fmtCurr(p.netIncome)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cash Flow */}
      <div className="section-subtitle mt-6">Cash Flow Statement ({cs}m)</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="min-w-[180px]"></th>
              {years.map(y => (
                <th key={y} className="min-w-[90px]">{y === 0 ? 'LTM' : `Year ${y}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EBITDA</td>
              {proj.map(p => <td key={p.year} className="cell-formula">{fmtCurr(p.ebitda)}</td>)}
            </tr>
            <tr>
              <td>Capex</td>
              {proj.map((p, i) => (
                <td key={p.year}>
                  {i === 0 ? (
                    <span className="cell-formula cell-negative">({p.capex.toFixed(1)})</span>
                  ) : (
                    <span className="cell-formula cell-negative">({p.capex.toFixed(1)})</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td>Working Capital Change</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula ${p.nwcChange > 0 ? 'cell-negative' : ''}`}>
                  {p.nwcChange !== 0 ? `(${p.nwcChange.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Cash Taxes</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula cell-negative">
                  {p.cashTaxes > 0 ? `(${p.cashTaxes.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr className="row-total">
              <td className="font-bold text-text-primary!">Unlevered FCF</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-bold ${negClass(p.unleveredFCF)}`}>{fmtCurr(p.unleveredFCF)}</td>
              ))}
            </tr>
            <tr>
              <td>Interest Paid</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula cell-negative">
                  {p.interestPaid > 0 ? `(${p.interestPaid.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Debt Repayment</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula cell-negative">
                  {p.debtRepayment > 0 ? `(${p.debtRepayment.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Cash Sweep</td>
              {proj.map(p => (
                <td key={p.year} className="cell-formula cell-negative">
                  {p.cashSweep > 0 ? `(${p.cashSweep.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr className="row-total">
              <td className="font-bold text-text-primary!">Levered FCF</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-bold ${negClass(p.leveredFCF)}`}>{fmtCurr(p.leveredFCF)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Balance Sheet */}
      <div className="section-subtitle mt-6">Balance Sheet Summary ({cs}m)</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="min-w-[180px]"></th>
              {years.map(y => (
                <th key={y} className="min-w-[90px]">{y === 0 ? 'LTM' : `Year ${y}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash</td>
              {proj.map(p => <td key={p.year} className="cell-formula">{fmtCurr(p.cash)}</td>)}
            </tr>
            {model.debtTranches.map((t, ti) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                {outputs.debtSchedules[ti]?.years.map((dy, yi) => (
                  <td key={yi} className="cell-formula">{fmtCurr(dy.closingBalance)}</td>
                ))}
              </tr>
            ))}
            <tr className="row-total">
              <td className="font-bold text-text-primary!">Net Debt</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-bold ${negClass(p.netDebt)}`}>{fmtCurr(p.netDebt)}</td>
              ))}
            </tr>
            <tr>
              <td className="font-semibold text-text-primary!">Implied Equity Value</td>
              {proj.map(p => (
                <td key={p.year} className={`cell-formula font-semibold ${p.impliedEquityValue < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(p.impliedEquityValue)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
