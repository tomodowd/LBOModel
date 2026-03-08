import { useModel } from '../../context/ModelContext';
import { InlineInput } from '../common/InlineInput';
import type { DebtTranche, RateType } from '../../lib/types';

export function SourcesUses() {
  const { model, outputs, dispatch } = useModel();
  const su = outputs.sourcesUses;
  const cs = model.deal.currency === 'GBP' ? '£' : '$';

  const setTranche = (id: string, field: string, value: unknown) =>
    dispatch({ type: 'SET_DEBT_TRANCHE', trancheId: id, field, value });

  const addTranche = () => {
    const newTranche: DebtTranche = {
      id: `tranche-${Date.now()}`,
      name: 'New Tranche',
      amount: 50,
      amountAsPctOfEV: false,
      amountPct: 0,
      rateType: 'floating',
      fixedRate: 5,
      floatingSpread: 400,
      baseRate: 4.5,
      amortisationPct: 0,
      cashSweepPct: 0,
      isPIK: false,
      tenor: 5,
    };
    dispatch({ type: 'ADD_DEBT_TRANCHE', tranche: newTranche });
  };

  const fmtCurr = (v: number) => {
    const abs = Math.abs(v);
    const s = `${cs}${abs.toFixed(1)}m`;
    return v < 0 ? `(${s})` : s;
  };

  return (
    <div className="section-container">
      <h2 className="section-title">Sources & Uses</h2>

      {!su.isBalanced && (
        <div className="warning-banner">
          ⚠ Sources ({fmtCurr(su.totalSources)}) ≠ Uses ({fmtCurr(su.totalUses)}) — the deal does not balance.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uses */}
        <div>
          <div className="section-subtitle">Uses of Funds</div>
          <table className="lbo-table">
            <thead>
              <tr><th>Item</th><th>{cs}m</th><th>% of Total</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Purchase Price (EV)</td>
                <td className="cell-formula">{fmtCurr(su.purchasePrice)}</td>
                <td className="cell-formula">{(su.purchasePrice / su.totalUses * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Transaction Fees</td>
                <td className="cell-formula">{fmtCurr(su.transactionFees)}</td>
                <td className="cell-formula">{(su.transactionFees / su.totalUses * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Financing Fees</td>
                <td className="cell-formula">{fmtCurr(su.financingFees)}</td>
                <td className="cell-formula">{(su.financingFees / su.totalUses * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Cash to Balance Sheet</td>
                <td className="cell-formula">{fmtCurr(su.cashToBS)}</td>
                <td className="cell-formula">{(su.cashToBS / su.totalUses * 100).toFixed(1)}%</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary">Total Uses</td>
                <td className="cell-formula">{fmtCurr(su.totalUses)}</td>
                <td className="cell-formula">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sources */}
        <div>
          <div className="section-subtitle">Sources of Funds</div>
          <table className="lbo-table">
            <thead>
              <tr><th>Item</th><th>{cs}m</th><th>% of Total</th></tr>
            </thead>
            <tbody>
              {model.debtTranches.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="cell-formula">{fmtCurr(t.amount)}</td>
                  <td className="cell-formula">{(t.amount / su.totalSources * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr>
                <td>Sponsor Equity</td>
                <td className="cell-formula">{fmtCurr(su.sponsorEquity)}</td>
                <td className="cell-formula">{(su.sponsorEquity / su.totalSources * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Management Rollover</td>
                <td className="cell-formula">{fmtCurr(su.managementRollover)}</td>
                <td className="cell-formula">{(su.managementRollover / su.totalSources * 100).toFixed(1)}%</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary">Total Sources</td>
                <td className={`cell-formula ${!su.isBalanced ? 'cell-negative' : ''}`}>{fmtCurr(su.totalSources)}</td>
                <td className="cell-formula">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Debt Tranche Configuration */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="section-subtitle">Debt Tranche Configuration</div>
          <button
            onClick={addTranche}
            className="text-[10px] text-accent-blue hover:text-blue-300 uppercase tracking-wider px-2 py-1 border border-accent-blue/30 hover:border-accent-blue/60 transition-colors"
          >
            + Add Tranche
          </button>
        </div>
        <div className="overflow-x-auto mt-2">
          <table className="lbo-table">
            <thead>
              <tr>
                <th>Tranche</th>
                <th>Amount ({cs}m)</th>
                <th>Rate Type</th>
                <th>Rate / Spread</th>
                <th>Amort (% p.a.)</th>
                <th>Cash Sweep (%)</th>
                <th>PIK</th>
                <th>Tenor (yr)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.debtTranches.map(t => (
                <tr key={t.id}>
                  <td>
                    <input
                      className="inline-input text-left w-40"
                      value={t.name}
                      onChange={e => setTranche(t.id, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <InlineInput value={t.amount} onChange={v => setTranche(t.id, 'amount', v)} min={0} />
                  </td>
                  <td>
                    <select
                      className="inline-input w-20 bg-bg-input text-left"
                      value={t.rateType}
                      onChange={e => setTranche(t.id, 'rateType', e.target.value as RateType)}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="floating">Float</option>
                    </select>
                  </td>
                  <td>
                    {t.rateType === 'fixed' ? (
                      <InlineInput value={t.fixedRate} onChange={v => setTranche(t.id, 'fixedRate', v)} suffix="%" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <InlineInput value={t.baseRate} onChange={v => setTranche(t.id, 'baseRate', v)} suffix="%" width={50} />
                        <span className="text-text-muted text-[10px]">+</span>
                        <InlineInput value={t.floatingSpread} onChange={v => setTranche(t.id, 'floatingSpread', v)} suffix="bp" width={60} decimals={0} />
                      </div>
                    )}
                  </td>
                  <td>
                    <InlineInput value={t.amortisationPct} onChange={v => setTranche(t.id, 'amortisationPct', v)} suffix="%" min={0} max={100} />
                  </td>
                  <td>
                    <InlineInput value={t.cashSweepPct} onChange={v => setTranche(t.id, 'cashSweepPct', v)} suffix="%" min={0} max={100} decimals={0} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.isPIK}
                      onChange={e => setTranche(t.id, 'isPIK', e.target.checked)}
                      className="accent-accent-amber"
                    />
                  </td>
                  <td>
                    <InlineInput value={t.tenor} onChange={v => setTranche(t.id, 'tenor', v)} suffix="yr" decimals={0} min={1} max={10} />
                  </td>
                  <td>
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_DEBT_TRANCHE', trancheId: t.id })}
                      className="text-text-muted hover:text-negative text-xs transition-colors"
                      title="Remove tranche"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
