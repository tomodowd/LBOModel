import { useModel } from '../../context/ModelContext';
import { InlineInput } from '../common/InlineInput';
import { formatDealType } from '../../lib/deal-presets';
import type { DebtTranche, RateType } from '../../lib/types';

export function SourcesUses() {
  const { model, outputs, dispatch } = useModel();
  const su = outputs.sourcesUses;
  const deal = model.deal;
  const ev = deal.entryEBITDA * deal.entryMultiple;
  const cs = deal.currency === 'GBP' ? '£' : '$';

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
      isUndrawn: false,
      commitmentFeePct: 0,
    };
    dispatch({ type: 'ADD_DEBT_TRANCHE', tranche: newTranche });
  };

  const fmtCurr = (v: number) => {
    const abs = Math.abs(v);
    const s = `${cs}${abs.toFixed(1)}m`;
    return v < 0 ? `(${s})` : s;
  };

  const pctOfEV = (v: number) => ev > 0 ? (v / ev * 100).toFixed(1) : '0.0';
  const pctOfTotal = (v: number, total: number) => total > 0 ? (v / total * 100).toFixed(1) : '0.0';

  // Resolve the actual £m amount for a tranche (mirrors engine logic)
  const resolveAmount = (t: DebtTranche) =>
    t.amountAsPctOfEV ? ev * (t.amountPct / 100) : t.amount;

  // Net leverage at entry
  const entryLeverage = deal.entryEBITDA > 0 ? (su.totalDebt - deal.cashToBS) / deal.entryEBITDA : 0;

  const hasGap = Math.abs(su.debtGap) > 0.1;

  return (
    <div className="section-container">
      <h2 className="section-title">Sources & Uses</h2>

      {/* ─── Summary Bar ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value text-sm">{fmtCurr(su.totalDebt)}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{pctOfEV(su.totalDebt)}% of EV</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Equity</div>
          <div className="stat-value text-sm">{fmtCurr(su.totalEquity)}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{pctOfEV(su.totalEquity)}% of EV</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Leverage</div>
          <div className="stat-value text-sm">{entryLeverage.toFixed(1)}x</div>
          <div className="text-[10px] text-text-muted mt-0.5">Net Debt / EBITDA</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deal Type</div>
          <div className="stat-value text-sm">{formatDealType(deal.dealType)}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{deal.debtPct}% / {deal.equityPct}% split</div>
        </div>
        <div className={`stat-card ${hasGap ? 'border-accent-amber/40' : ''}`}>
          <div className="stat-label">Debt Gap</div>
          <div className={`stat-value text-sm ${hasGap ? 'text-accent-amber' : 'text-positive'}`}>
            {hasGap ? fmtCurr(su.debtGap) : 'Balanced'}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {hasGap ? (su.debtGap > 0 ? 'Under-levered' : 'Over-levered') : 'Target = Actual'}
          </div>
        </div>
      </div>

      {/* ─── Balance Warning ─── */}
      {!su.isBalanced && (
        <div className="warning-banner">
          ⚠ Sources ({fmtCurr(su.totalSources)}) ≠ Uses ({fmtCurr(su.totalUses)}) — the deal does not balance.
        </div>
      )}

      {hasGap && (
        <div className="warning-banner" style={{ borderColor: 'var(--accent-amber)', background: 'rgba(251, 191, 36, 0.06)' }}>
          ⚠ Debt tranches sum to {fmtCurr(su.totalDebt)} vs target of {fmtCurr(su.targetDebt)} ({deal.debtPct}% × {fmtCurr(ev)}).
          Gap of {fmtCurr(su.debtGap)}. Re-apply preset or adjust tranche amounts.
        </div>
      )}

      {/* ─── Uses & Sources Tables ─── */}
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
                <td className="cell-formula">{pctOfTotal(su.purchasePrice, su.totalUses)}%</td>
              </tr>
              <tr>
                <td>Transaction Fees</td>
                <td className="cell-formula">{fmtCurr(su.transactionFees)}</td>
                <td className="cell-formula">{pctOfTotal(su.transactionFees, su.totalUses)}%</td>
              </tr>
              <tr>
                <td>Financing Fees</td>
                <td className="cell-formula">{fmtCurr(su.financingFees)}</td>
                <td className="cell-formula">{pctOfTotal(su.financingFees, su.totalUses)}%</td>
              </tr>
              <tr>
                <td>Cash to Balance Sheet</td>
                <td className="cell-formula">{fmtCurr(su.cashToBS)}</td>
                <td className="cell-formula">{pctOfTotal(su.cashToBS, su.totalUses)}%</td>
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
              <tr><th>Item</th><th>{cs}m</th><th>% of EV</th><th>% of Total</th></tr>
            </thead>
            <tbody>
              {/* Drawn debt tranches — editable */}
              {su.debtTranches.map(t => {
                const amt = resolveAmount(t);
                return (
                  <tr key={t.id}>
                    <td className="text-accent-blue">{t.name}</td>
                    <td>
                      <InlineInput
                        value={amt}
                        onChange={v => setTranche(t.id, 'amount', v)}
                        prefix={cs}
                        suffix="m"
                        width={90}
                        className="cell-input"
                      />
                    </td>
                    <td>
                      <InlineInput
                        value={t.amountAsPctOfEV ? t.amountPct : (ev > 0 ? amt / ev * 100 : 0)}
                        onChange={v => setTranche(t.id, 'amountPct', v)}
                        suffix="%"
                        width={60}
                        className="cell-input"
                      />
                    </td>
                    <td className="cell-formula">{pctOfTotal(amt, su.totalSources)}%</td>
                  </tr>
                );
              })}

              {/* RCF (undrawn) — read-only, dimmed */}
              {su.rcfTranches.map(t => {
                const committed = resolveAmount(t);
                return (
                  <tr key={t.id} style={{ opacity: 0.6 }}>
                    <td>
                      <span className="text-text-muted">{t.name}</span>
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted uppercase tracking-wider">
                        Committed, undrawn
                      </span>
                    </td>
                    <td className="cell-formula text-text-muted">{fmtCurr(committed)}</td>
                    <td className="cell-formula text-text-muted">
                      {ev > 0 ? (committed / ev * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="cell-formula text-text-muted">—</td>
                  </tr>
                );
              })}

              {/* Subtotal Debt */}
              <tr className="border-t border-border-subtle">
                <td className="text-text-secondary font-medium">Total Debt (Drawn)</td>
                <td className="cell-formula">{fmtCurr(su.totalDebt)}</td>
                <td className="cell-formula">{pctOfEV(su.totalDebt)}%</td>
                <td className="cell-formula">{pctOfTotal(su.totalDebt, su.totalSources)}%</td>
              </tr>

              {/* Equity */}
              <tr>
                <td>Sponsor Equity</td>
                <td className="cell-formula">{fmtCurr(su.sponsorEquity)}</td>
                <td className="cell-formula">{pctOfEV(su.sponsorEquity)}%</td>
                <td className="cell-formula">{pctOfTotal(su.sponsorEquity, su.totalSources)}%</td>
              </tr>
              <tr>
                <td>Management Rollover</td>
                <td className="cell-formula">{fmtCurr(su.managementRollover)}</td>
                <td className="cell-formula">{pctOfEV(su.managementRollover)}%</td>
                <td className="cell-formula">{pctOfTotal(su.managementRollover, su.totalSources)}%</td>
              </tr>
              <tr className="row-total">
                <td className="font-bold text-text-primary">Total Sources</td>
                <td className={`cell-formula ${!su.isBalanced ? 'cell-negative' : ''}`}>{fmtCurr(su.totalSources)}</td>
                <td className="cell-formula">{pctOfEV(su.totalSources)}%</td>
                <td className="cell-formula">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Action Buttons ─── */}
      <div className="flex items-center gap-3 mt-6 mb-2">
        <button
          onClick={() => dispatch({ type: 'APPLY_DEAL_PRESET' })}
          className="text-[10px] text-accent-blue hover:text-blue-300 uppercase tracking-wider px-3 py-1.5 border border-accent-blue/30 hover:border-accent-blue/60 transition-colors"
          title="Re-generate tranches from current deal type and leverage"
        >
          Re-apply {formatDealType(deal.dealType)} Preset
        </button>
        <button
          onClick={() => dispatch({ type: 'RESET_MARKET_RATES' })}
          className="text-[10px] text-text-secondary hover:text-text-primary uppercase tracking-wider px-3 py-1.5 border border-border-subtle hover:border-border-default transition-colors"
          title="Reset all tranche rates to current market benchmarks"
        >
          Reset to Market Rates
        </button>
        <div className="flex-1" />
        <button
          onClick={addTranche}
          className="text-[10px] text-accent-blue hover:text-blue-300 uppercase tracking-wider px-3 py-1.5 border border-accent-blue/30 hover:border-accent-blue/60 transition-colors"
        >
          + Add Tranche
        </button>
      </div>

      {/* ─── Debt Tranche Configuration ─── */}
      <div className="mt-2">
        <div className="section-subtitle">Debt Tranche Configuration</div>
        <div className="overflow-x-auto mt-2">
          <table className="lbo-table">
            <thead>
              <tr>
                <th>Tranche</th>
                <th>Amount ({cs}m)</th>
                <th>% of EV</th>
                <th>Rate Type</th>
                <th>Rate / Spread</th>
                <th>Amort (% p.a.)</th>
                <th>Cash Sweep (%)</th>
                <th>PIK</th>
                <th>Undrawn</th>
                <th>Tenor (yr)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.debtTranches.map(t => {
                const amt = resolveAmount(t);
                return (
                  <tr key={t.id} style={t.isUndrawn ? { opacity: 0.7 } : undefined}>
                    <td>
                      <input
                        className="inline-input text-left w-40"
                        value={t.name}
                        onChange={e => setTranche(t.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <InlineInput value={amt} onChange={v => setTranche(t.id, 'amount', v)} min={0} />
                    </td>
                    <td>
                      <InlineInput
                        value={t.amountAsPctOfEV ? t.amountPct : (ev > 0 ? amt / ev * 100 : 0)}
                        onChange={v => setTranche(t.id, 'amountPct', v)}
                        suffix="%"
                        width={60}
                      />
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
                      <input
                        type="checkbox"
                        checked={t.isUndrawn}
                        onChange={e => setTranche(t.id, 'isUndrawn', e.target.checked)}
                        className="accent-accent-amber"
                        title="Committed but undrawn at close (e.g. RCF)"
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
