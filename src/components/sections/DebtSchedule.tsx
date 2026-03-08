import { useModel } from '../../context/ModelContext';
import { InlineInput } from '../common/InlineInput';

export function DebtSchedule() {
  const { model, outputs, dispatch } = useModel();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const hp = model.deal.holdPeriod;
  const years = Array.from({ length: hp + 1 }, (_, i) => i);
  const covenantBreaches = outputs.covenantTests.filter(t => t.inBreach);

  const fmtCurr = (v: number) => {
    if (Math.abs(v) < 0.05) return '—';
    const abs = Math.abs(v);
    return v < 0 ? `(${abs.toFixed(1)})` : abs.toFixed(1);
  };

  const fmtRatio = (v: number) => {
    if (!isFinite(v)) return '—';
    return `${v.toFixed(1)}×`;
  };

  return (
    <div className="section-container">
      <h2 className="section-title">Debt Schedule</h2>

      {!outputs.circularConverged && model.circularDebtSchedule && (
        <div className="warning-banner">
          ⚠ Circular debt schedule did not converge after 100 iterations — results may be inaccurate
        </div>
      )}

      {covenantBreaches.length > 0 && (
        <div className="warning-banner">
          ⚠ Covenant breach detected in {covenantBreaches.map(b => `Year ${b.year}`).join(', ')}
        </div>
      )}

      {/* Per-tranche schedules */}
      {outputs.debtSchedules.map((schedule, ti) => (
        <div key={schedule.trancheId} className="mb-6">
          <div className="section-subtitle">{schedule.trancheName} ({cs}m)</div>
          <div className="overflow-x-auto">
            <table className="lbo-table">
              <thead>
                <tr>
                  <th className="min-w-[160px]"></th>
                  {years.map(y => (
                    <th key={y} className="min-w-[80px]">{y === 0 ? 'Entry' : `Year ${y}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Opening Balance</td>
                  {schedule.years.map((dy, i) => (
                    <td key={i} className="cell-formula">{fmtCurr(dy.openingBalance)}</td>
                  ))}
                </tr>
                <tr>
                  <td>Cash Interest</td>
                  {schedule.years.map((dy, i) => (
                    <td key={i} className="cell-formula cell-negative">
                      {dy.cashInterest > 0.05 ? `(${dy.cashInterest.toFixed(1)})` : '—'}
                    </td>
                  ))}
                </tr>
                {model.debtTranches[ti]?.isPIK && (
                  <tr>
                    <td>PIK Interest</td>
                    {schedule.years.map((dy, i) => (
                      <td key={i} className="cell-formula text-warning">
                        {dy.pikInterest > 0.05 ? dy.pikInterest.toFixed(1) : '—'}
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <td>Mandatory Amortisation</td>
                  {schedule.years.map((dy, i) => (
                    <td key={i} className="cell-formula cell-negative">
                      {dy.mandatoryAmort > 0.05 ? `(${dy.mandatoryAmort.toFixed(1)})` : '—'}
                    </td>
                  ))}
                </tr>
                {model.debtTranches[ti]?.cashSweepPct > 0 && (
                  <tr>
                    <td>Cash Sweep</td>
                    {schedule.years.map((dy, i) => (
                      <td key={i} className="cell-formula cell-negative">
                        {dy.cashSweepRepayment > 0.05 ? `(${dy.cashSweepRepayment.toFixed(1)})` : '—'}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="row-total">
                  <td className="font-bold text-text-primary!">Closing Balance</td>
                  {schedule.years.map((dy, i) => (
                    <td key={i} className="cell-formula font-bold">{fmtCurr(dy.closingBalance)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Summary & Coverage Ratios */}
      <div className="section-subtitle mt-6">Aggregate Debt Summary & Coverage Ratios</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="min-w-[160px]"></th>
              {years.map(y => (
                <th key={y} className="min-w-[80px]">{y === 0 ? 'Entry' : `Year ${y}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-text-primary!">Total Debt</td>
              {outputs.debtSummary.map((ds, i) => (
                <td key={i} className="cell-formula font-semibold">{fmtCurr(ds.totalDebt)}</td>
              ))}
            </tr>
            <tr>
              <td>Total Cash Interest</td>
              {outputs.debtSummary.map((ds, i) => (
                <td key={i} className="cell-formula cell-negative">
                  {ds.totalCashInterest > 0.05 ? `(${ds.totalCashInterest.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Total PIK Interest</td>
              {outputs.debtSummary.map((ds, i) => (
                <td key={i} className="cell-formula text-warning">
                  {ds.totalPIKInterest > 0.05 ? ds.totalPIKInterest.toFixed(1) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Total Amortisation</td>
              {outputs.debtSummary.map((ds, i) => (
                <td key={i} className="cell-formula cell-negative">
                  {ds.totalAmort > 0.05 ? `(${ds.totalAmort.toFixed(1)})` : '—'}
                </td>
              ))}
            </tr>

            {/* Ratios */}
            <tr className="row-header"><td colSpan={hp + 2}>Coverage Ratios</td></tr>
            {/* Ratios rendered below */}
            <tr>
              <td>Interest Coverage (EBITDA / Int.)</td>
              {outputs.debtSummary.map((ds, i) => {
                const covBreach = outputs.covenantTests.find(
                  t => t.year === ds.year && t.covenantId === 'ic-cov' && t.inBreach
                );
                return (
                  <td key={i} className={`cell-formula ${covBreach ? 'cell-negative font-bold' : ''}`}>
                    {i === 0 ? '—' : fmtRatio(ds.interestCoverage)}
                    {covBreach && ' ⚠'}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td>Net Leverage (Net Debt / EBITDA)</td>
              {outputs.debtSummary.map((ds, i) => {
                const covBreach = outputs.covenantTests.find(
                  t => t.year === ds.year && t.covenantId === 'lev-cov' && t.inBreach
                );
                return (
                  <td key={i} className={`cell-formula ${covBreach ? 'cell-negative font-bold' : ''}`}>
                    {fmtRatio(ds.netLeverage)}
                    {covBreach && ' ⚠'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Circularity footnote */}
      {model.circularDebtSchedule && (
        <div className="text-[10px] text-text-muted font-mono mt-2 px-1">
          Circular: converged in {outputs.circularIterations} iteration{outputs.circularIterations !== 1 ? 's' : ''} (tol. £0.001m)
        </div>
      )}

      {/* Covenant Configuration */}
      <div className="section-subtitle mt-6">Covenant Configuration</div>
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th>Covenant</th>
              <th>Type</th>
              <th>Threshold</th>
              <th>Direction</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {model.covenants.map(cov => (
              <tr key={cov.id}>
                <td>
                  <input
                    className="inline-input text-left w-44"
                    value={cov.name}
                    onChange={e => dispatch({ type: 'SET_COVENANT', covenantId: cov.id, field: 'name', value: e.target.value })}
                  />
                </td>
                <td className="cell-formula capitalize">{cov.type}</td>
                <td>
                  <InlineInput
                    value={cov.threshold}
                    onChange={v => dispatch({ type: 'SET_COVENANT', covenantId: cov.id, field: 'threshold', value: v })}
                    suffix="×" decimals={1}
                  />
                </td>
                <td className="text-text-secondary text-xs">
                  {cov.isMaximum ? '≤ Maximum' : '≥ Minimum'}
                </td>
                <td>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_COVENANT', covenantId: cov.id })}
                    className="text-text-muted hover:text-negative text-xs transition-colors"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
