import { useMemo } from 'react';
import { useModel } from '../../context/ModelContext';
import { InlineInput } from '../common/InlineInput';
import { computeModel } from '../../lib/lbo-engine';
import type { Currency } from '../../lib/types';

export function DealOverview() {
  const { model, outputs, dispatch } = useModel();
  const d = model.deal;
  const cs = d.currency === 'GBP' ? '£' : '$';

  const setField = (field: string, value: unknown) =>
    dispatch({ type: 'SET_DEAL_FIELD', field, value });

  // Compute simple-mode IRR for delta indicator (only when circular is ON)
  const simpleIRR = useMemo(() => {
    if (!model.circularDebtSchedule) return null;
    const simpleModel = { ...model, circularDebtSchedule: false };
    const simpleOutputs = computeModel(simpleModel);
    return simpleOutputs.returns.sponsor.irr;
  }, [model]);

  const irrDelta = simpleIRR !== null
    ? outputs.returns.sponsor.irr - simpleIRR
    : null;

  return (
    <div className="section-container">
      <h2 className="section-title">Deal Overview</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="bg-bg-secondary border border-border p-4">
          <div className="section-subtitle">Company Information</div>
          <div className="space-y-3 mt-3">
            <InputRow label="Company Name">
              <input
                className="inline-input w-48 text-left"
                value={d.companyName}
                onChange={e => setField('companyName', e.target.value)}
              />
            </InputRow>
            <InputRow label="Sector">
              <input
                className="inline-input w-48 text-left"
                value={d.sector}
                onChange={e => setField('sector', e.target.value)}
              />
            </InputRow>
            <InputRow label="Deal Date">
              <input
                type="date"
                className="inline-input w-36"
                value={d.dealDate}
                onChange={e => setField('dealDate', e.target.value)}
              />
            </InputRow>
            <InputRow label="Currency">
              <select
                className="inline-input w-24 text-left bg-bg-input"
                value={d.currency}
                onChange={e => setField('currency', e.target.value as Currency)}
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
              </select>
            </InputRow>
            <InputRow label="Circular Debt Schedule">
              <button
                onClick={() => dispatch({ type: 'SET_CIRCULAR', value: !model.circularDebtSchedule })}
                className={`px-3 py-0.5 text-[10px] font-mono font-bold tracking-wider border transition-colors ${
                  model.circularDebtSchedule
                    ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                    : 'bg-bg-tertiary border-border text-text-muted'
                }`}
              >
                {model.circularDebtSchedule ? 'ON' : 'OFF'}
              </button>
            </InputRow>
          </div>
        </div>

        {/* Entry Assumptions */}
        <div className="bg-bg-secondary border border-border p-4">
          <div className="section-subtitle">Entry Assumptions</div>
          <div className="space-y-3 mt-3">
            <InputRow label={`Entry EBITDA (${cs}m)`}>
              <InlineInput value={d.entryEBITDA} onChange={v => setField('entryEBITDA', v)} min={0} />
            </InputRow>
            <InputRow label="Entry EV/EBITDA (×)">
              <InlineInput value={d.entryMultiple} onChange={v => setField('entryMultiple', v)} decimals={1} min={0} step={0.5} suffix="×" />
            </InputRow>
            <InputRow label={`Enterprise Value (${cs}m)`}>
              <span className="cell-formula font-mono text-xs">{cs}{(d.entryEBITDA * d.entryMultiple).toFixed(1)}m</span>
            </InputRow>
            <InputRow label={`Entry Revenue (${cs}m)`}>
              <span className="cell-formula font-mono text-xs">{cs}{d.entryRevenue.toFixed(1)}m</span>
            </InputRow>
          </div>
        </div>

        {/* Capital Structure */}
        <div className="bg-bg-secondary border border-border p-4">
          <div className="section-subtitle">Capital Structure</div>
          <div className="space-y-3 mt-3">
            <InputRow label="Equity (% of EV)">
              <InlineInput value={d.equityPct} onChange={v => setField('equityPct', v)} suffix="%" min={0} max={100} />
            </InputRow>
            <InputRow label="Debt (% of EV)">
              <span className="cell-formula font-mono text-xs">{d.debtPct.toFixed(1)}%</span>
            </InputRow>
            <InputRow label="Management Rollover (% of equity)">
              <InlineInput value={d.managementRolloverPct} onChange={v => setField('managementRolloverPct', v)} suffix="%" min={0} max={100} />
            </InputRow>
            <InputRow label="Transaction Fees (% of EV)">
              <InlineInput value={d.transactionFeesPct} onChange={v => setField('transactionFeesPct', v)} suffix="%" decimals={1} min={0} />
            </InputRow>
            <InputRow label="Financing Fees (% of Debt)">
              <InlineInput value={d.financingFeesPct} onChange={v => setField('financingFeesPct', v)} suffix="%" decimals={1} min={0} />
            </InputRow>
            <InputRow label={`Cash to Balance Sheet (${cs}m)`}>
              <InlineInput value={d.cashToBS} onChange={v => setField('cashToBS', v)} min={0} />
            </InputRow>
          </div>

          {/* Visual bar */}
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden">
              <div className="bg-accent-blue" style={{ width: `${d.equityPct}%` }} title={`Equity: ${d.equityPct.toFixed(1)}%`} />
              <div className="bg-accent-amber" style={{ width: `${d.debtPct}%` }} title={`Debt: ${d.debtPct.toFixed(1)}%`} />
            </div>
            <div className="flex justify-between text-[9px] text-text-muted mt-1">
              <span>Equity {d.equityPct.toFixed(0)}%</span>
              <span>Debt {d.debtPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Exit & Operating */}
        <div className="bg-bg-secondary border border-border p-4">
          <div className="section-subtitle">Exit & Operating Assumptions</div>
          <div className="space-y-3 mt-3">
            <InputRow label="Hold Period (years)">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={3} max={7} step={1}
                  value={d.holdPeriod}
                  onChange={e => setField('holdPeriod', parseInt(e.target.value))}
                  className="w-24 accent-accent-blue"
                />
                <span className="cell-input font-mono text-xs">{d.holdPeriod}yr</span>
              </div>
            </InputRow>
            <InputRow label="Exit Multiple (×)">
              <div className="flex items-center gap-2">
                <InlineInput
                  value={d.linkExitToEntry ? d.entryMultiple : d.exitMultiple}
                  onChange={v => setField('exitMultiple', v)}
                  decimals={1} suffix="×" step={0.5}
                  className={d.linkExitToEntry ? 'opacity-50' : ''}
                />
                <label className="flex items-center gap-1 text-[10px] text-text-muted">
                  <input
                    type="checkbox"
                    checked={d.linkExitToEntry}
                    onChange={e => setField('linkExitToEntry', e.target.checked)}
                    className="accent-accent-blue"
                  />
                  = Entry
                </label>
              </div>
            </InputRow>
            <InputRow label="Revenue CAGR (%)">
              <InlineInput value={d.revenueCAGR} onChange={v => setField('revenueCAGR', v)} suffix="%" />
            </InputRow>
            <InputRow label="EBITDA Margin at Entry (%)">
              <InlineInput value={d.entryEBITDAMargin} onChange={v => setField('entryEBITDAMargin', v)} suffix="%" />
            </InputRow>
            <InputRow label="EBITDA Margin at Exit (%)">
              <InlineInput value={d.exitEBITDAMargin} onChange={v => setField('exitEBITDAMargin', v)} suffix="%" />
            </InputRow>
            <InputRow label="Gross Margin (%)">
              <InlineInput value={d.grossMargin} onChange={v => setField('grossMargin', v)} suffix="%" />
            </InputRow>
            <InputRow label="Tax Rate (%)">
              <InlineInput value={d.taxRate} onChange={v => setField('taxRate', v)} suffix="%" />
            </InputRow>
            <InputRow label="D&A (% of Revenue)">
              <InlineInput value={d.daPercent} onChange={v => setField('daPercent', v)} suffix="%" />
            </InputRow>
            <InputRow label="Capex (% of Revenue)">
              <InlineInput value={d.capexPercent} onChange={v => setField('capexPercent', v)} suffix="%" />
            </InputRow>
            <InputRow label="NWC Change (% of Rev Δ)">
              <InlineInput value={d.nwcPercent} onChange={v => setField('nwcPercent', v)} suffix="%" />
            </InputRow>
          </div>
        </div>
      </div>

      {/* Quick Returns Summary */}
      <div className="mt-6 bg-bg-secondary border border-border p-4">
        <div className="section-subtitle">Quick Returns Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mt-3">
          <StatCard label="Enterprise Value" value={`${cs}${outputs.sourcesUses.purchasePrice.toFixed(1)}m`} />
          <StatCard label="Total Debt" value={`${cs}${outputs.sourcesUses.totalDebt.toFixed(1)}m`} />
          <StatCard label="Sponsor Equity" value={`${cs}${outputs.sourcesUses.sponsorEquity.toFixed(1)}m`} />
          <StatCard label="Sponsor IRR" value={`${outputs.returns.sponsor.irr.toFixed(1)}%`}
            color={outputs.returns.sponsor.irr >= 20 ? 'green' : outputs.returns.sponsor.irr >= 15 ? 'amber' : 'red'}
            delta={irrDelta} />
          <StatCard label="Sponsor MoM" value={`${outputs.returns.sponsor.mom.toFixed(2)}×`} />
          <StatCard label="Exit Equity" value={`${cs}${outputs.exitWaterfall.exitEquityValue.toFixed(1)}m`}
            color={outputs.exitWaterfall.exitEquityValue >= 0 ? 'green' : 'red'} />
        </div>
      </div>
    </div>
  );
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-xs text-text-secondary whitespace-nowrap">{label}</label>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function StatCard({ label, value, color, delta }: { label: string; value: string; color?: 'green' | 'amber' | 'red'; delta?: number | null }) {
  const colorClass = color === 'green' ? 'text-positive' : color === 'amber' ? 'text-warning' : color === 'red' ? 'text-negative' : 'text-text-primary';
  return (
    <div className="bg-bg-tertiary p-3">
      <div className="text-[9px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`font-mono font-semibold text-sm mt-1 ${colorClass}`}>
        {value}
        {delta != null && Math.abs(delta) >= 0.01 && (
          <span className="text-[9px] font-normal text-text-muted ml-1" title="Delta vs simple (non-circular) mode">
            ({delta > 0 ? '+' : ''}{delta.toFixed(2)}% circ.)
          </span>
        )}
      </div>
    </div>
  );
}
