import { useMemo } from 'react';
import { useModel } from '../../context/ModelContext';
import { computeSensitivity } from '../../lib/lbo-engine';

export function ReturnsAnalysis() {
  const { model, outputs } = useModel();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const ew = outputs.exitWaterfall;
  const ret = outputs.returns;
  const attr = outputs.irrAttribution;

  const fmtCurr = (v: number) => {
    const abs = Math.abs(v);
    const s = `${cs}${abs.toFixed(1)}m`;
    return v < 0 ? `(${s})` : s;
  };

  // IRR sensitivity: exit multiple (rows) × hold period (cols)
  const irrSensitivity = useMemo(() => {
    const exitMults = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5];
    const holdPeriods = [3, 4, 5, 6, 7];
    return computeSensitivity(model, 'exitMultiple', 'holdPeriod', 'irr', exitMults, holdPeriods);
  }, [model]);

  const getHeatClass = (irr: number) => {
    if (irr >= 20) return 'heat-green';
    if (irr >= 15) return 'heat-amber';
    return 'heat-red';
  };

  return (
    <div className="section-container">
      <h2 className="section-title">Returns Analysis</h2>

      {ew.exitEquityValue < 0 && (
        <div className="warning-banner">
          ⚠ Negative equity at exit — deal is underwater. Exit equity: {fmtCurr(ew.exitEquityValue)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exit Waterfall */}
        <div>
          <div className="section-subtitle">Exit Waterfall</div>
          <table className="lbo-table">
            <thead>
              <tr><th>Item</th><th>{cs}m</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Exit EBITDA</td>
                <td className="cell-formula">{fmtCurr(ew.exitEBITDA)}</td>
              </tr>
              <tr>
                <td>Exit Multiple</td>
                <td className="cell-formula">{ew.exitMultiple.toFixed(1)}×</td>
              </tr>
              <tr className="row-header">
                <td>Exit Enterprise Value</td>
                <td className="cell-formula font-bold">{fmtCurr(ew.exitEV)}</td>
              </tr>
              <tr>
                <td>Less: Net Debt at Exit</td>
                <td className="cell-formula cell-negative">({Math.abs(ew.netDebtAtExit).toFixed(1)})</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary!">Exit Equity Value</td>
                <td className={`cell-formula font-bold ${ew.exitEquityValue < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(ew.exitEquityValue)}
                </td>
              </tr>
              <tr>
                <td>Less: Management Proceeds</td>
                <td className="cell-formula">({ew.managementProceeds.toFixed(1)})</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary!">Sponsor Proceeds</td>
                <td className={`cell-formula font-bold ${ew.sponsorProceeds < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(ew.sponsorProceeds)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Returns Table */}
        <div>
          <div className="section-subtitle">Returns Summary</div>
          <table className="lbo-table">
            <thead>
              <tr><th>Metric</th><th>Sponsor</th><th>Management</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Equity Invested</td>
                <td className="cell-formula">{fmtCurr(ret.sponsor.equityInvested)}</td>
                <td className="cell-formula">{fmtCurr(ret.management.equityInvested)}</td>
                <td className="cell-formula">{fmtCurr(ret.total.equityInvested)}</td>
              </tr>
              <tr>
                <td>Equity Returned</td>
                <td className={`cell-formula ${ret.sponsor.equityReturned < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(ret.sponsor.equityReturned)}
                </td>
                <td className={`cell-formula ${ret.management.equityReturned < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(ret.management.equityReturned)}
                </td>
                <td className={`cell-formula ${ret.total.equityReturned < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {fmtCurr(ret.total.equityReturned)}
                </td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary!">MoM</td>
                <td className="cell-formula font-bold">{ret.sponsor.mom.toFixed(2)}×</td>
                <td className="cell-formula font-bold">{ret.management.mom.toFixed(2)}×</td>
                <td className="cell-formula font-bold">{ret.total.mom.toFixed(2)}×</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary!">IRR</td>
                <td className={`cell-formula font-bold ${ret.sponsor.irr >= 20 ? 'cell-positive' : ret.sponsor.irr < 0 ? 'cell-negative' : ''}`}>
                  {ret.sponsor.irr.toFixed(1)}%
                </td>
                <td className={`cell-formula font-bold ${ret.management.irr >= 20 ? 'cell-positive' : ret.management.irr < 0 ? 'cell-negative' : ''}`}>
                  {ret.management.irr.toFixed(1)}%
                </td>
                <td className={`cell-formula font-bold ${ret.total.irr >= 20 ? 'cell-positive' : ret.total.irr < 0 ? 'cell-negative' : ''}`}>
                  {ret.total.irr.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td>Hold Period</td>
                <td className="cell-formula">{ret.sponsor.holdPeriod} years</td>
                <td className="cell-formula">{ret.management.holdPeriod} years</td>
                <td className="cell-formula">{ret.total.holdPeriod} years</td>
              </tr>
              <tr>
                <td>DPI</td>
                <td className="cell-formula">{ret.sponsor.dpi.toFixed(2)}×</td>
                <td className="cell-formula">{ret.management.dpi.toFixed(2)}×</td>
                <td className="cell-formula">{ret.total.dpi.toFixed(2)}×</td>
              </tr>
            </tbody>
          </table>

          {/* IRR Attribution */}
          <div className="section-subtitle mt-4">IRR Attribution</div>
          <table className="lbo-table">
            <thead>
              <tr><th>Driver</th><th>Contribution</th><th>% of Total</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Revenue Growth</td>
                <td className="cell-formula">{attr.revenueGrowth.toFixed(1)}%</td>
                <td className="cell-formula">{attr.total > 0 ? (attr.revenueGrowth / attr.total * 100).toFixed(0) : 0}%</td>
              </tr>
              <tr>
                <td>Margin Expansion</td>
                <td className="cell-formula">{attr.marginExpansion.toFixed(1)}%</td>
                <td className="cell-formula">{attr.total > 0 ? (attr.marginExpansion / attr.total * 100).toFixed(0) : 0}%</td>
              </tr>
              <tr>
                <td>Deleveraging</td>
                <td className="cell-formula">{attr.deleveraging.toFixed(1)}%</td>
                <td className="cell-formula">{attr.total > 0 ? (attr.deleveraging / attr.total * 100).toFixed(0) : 0}%</td>
              </tr>
              <tr>
                <td>Multiple Expansion</td>
                <td className="cell-formula">{attr.multipleExpansion.toFixed(1)}%</td>
                <td className="cell-formula">{attr.total > 0 ? (attr.multipleExpansion / attr.total * 100).toFixed(0) : 0}%</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary!">Total IRR</td>
                <td className="cell-formula font-bold">{attr.total.toFixed(1)}%</td>
                <td className="cell-formula font-bold">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* IRR Sensitivity Heatmap */}
      <div className="section-subtitle mt-6">IRR Sensitivity — Exit Multiple × Hold Period</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="text-left">Exit Mult. ↓ / Hold →</th>
              {irrSensitivity.colValues.map(cv => (
                <th key={cv}>{cv} yr</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {irrSensitivity.rowValues.map((rv, ri) => (
              <tr key={rv}>
                <td className="font-semibold text-text-primary!">{rv.toFixed(1)}×</td>
                {irrSensitivity.results[ri].map((irr, ci) => (
                  <td key={ci} className={`${getHeatClass(irr)} font-semibold text-center`}>
                    {isFinite(irr) ? `${irr.toFixed(1)}%` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-green" /> ≥ 20% IRR</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-amber" /> 15–20% IRR</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-red" /> &lt; 15% IRR</span>
      </div>
    </div>
  );
}
