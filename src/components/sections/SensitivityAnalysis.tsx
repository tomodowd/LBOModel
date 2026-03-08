import { useState, useMemo } from 'react';
import { useModel } from '../../context/ModelContext';
import { computeSensitivity } from '../../lib/lbo-engine';
import type { SensitivityVariable, SensitivityMetric } from '../../lib/types';

const VARIABLE_OPTIONS: { value: SensitivityVariable; label: string; defaultValues: number[] }[] = [
  { value: 'entryMultiple', label: 'Entry Multiple', defaultValues: [7.5, 8.5, 9.5, 10.5, 11.5] },
  { value: 'exitMultiple', label: 'Exit Multiple', defaultValues: [8.0, 9.0, 10.0, 11.0, 12.0] },
  { value: 'revenueCAGR', label: 'Revenue CAGR (%)', defaultValues: [4, 6, 8, 10, 12] },
  { value: 'ebitdaMargin', label: 'Exit EBITDA Margin (%)', defaultValues: [20, 23, 26, 29, 32] },
  { value: 'leverage', label: 'Leverage (Debt/EBITDA)', defaultValues: [3.0, 4.0, 5.0, 6.0, 7.0] },
  { value: 'interestRate', label: 'Base Rate (%)', defaultValues: [2.0, 3.0, 4.0, 5.0, 6.0] },
  { value: 'holdPeriod', label: 'Hold Period (years)', defaultValues: [3, 4, 5, 6, 7] },
];

const METRIC_OPTIONS: { value: SensitivityMetric; label: string; format: (v: number) => string }[] = [
  { value: 'irr', label: 'IRR (%)', format: v => isFinite(v) ? `${v.toFixed(1)}%` : '—' },
  { value: 'mom', label: 'MoM (×)', format: v => isFinite(v) ? `${v.toFixed(2)}×` : '—' },
  { value: 'exitEquityValue', label: 'Exit Equity (£m)', format: v => isFinite(v) ? `${v.toFixed(1)}` : '—' },
  { value: 'netLeverageAtExit', label: 'Net Leverage at Exit (×)', format: v => isFinite(v) ? `${v.toFixed(1)}×` : '—' },
];

export function SensitivityAnalysis() {
  const { model } = useModel();

  const [rowVar, setRowVar] = useState<SensitivityVariable>('exitMultiple');
  const [colVar, setColVar] = useState<SensitivityVariable>('revenueCAGR');
  const [metric, setMetric] = useState<SensitivityMetric>('irr');

  const rowConfig = VARIABLE_OPTIONS.find(v => v.value === rowVar)!;
  const colConfig = VARIABLE_OPTIONS.find(v => v.value === colVar)!;
  const metricConfig = METRIC_OPTIONS.find(m => m.value === metric)!;

  const sensitivity = useMemo(() => {
    return computeSensitivity(
      model, rowVar, colVar, metric,
      rowConfig.defaultValues, colConfig.defaultValues
    );
  }, [model, rowVar, colVar, metric, rowConfig.defaultValues, colConfig.defaultValues]);

  const getHeatClass = (value: number) => {
    if (metric === 'irr') {
      if (value >= 20) return 'heat-green';
      if (value >= 15) return 'heat-amber';
      return 'heat-red';
    }
    if (metric === 'mom') {
      if (value >= 2.5) return 'heat-green';
      if (value >= 2.0) return 'heat-amber';
      return 'heat-red';
    }
    if (metric === 'exitEquityValue') {
      if (value > 0) return 'heat-green';
      return 'heat-red';
    }
    if (metric === 'netLeverageAtExit') {
      if (value <= 3.0) return 'heat-green';
      if (value <= 5.0) return 'heat-amber';
      return 'heat-red';
    }
    return '';
  };

  const formatLabel = (variable: SensitivityVariable, value: number) => {
    if (variable === 'entryMultiple' || variable === 'exitMultiple' || variable === 'leverage')
      return `${value.toFixed(1)}×`;
    if (variable === 'holdPeriod') return `${value}yr`;
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="section-container">
      <h2 className="section-title">Sensitivity Analysis</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Row Variable</label>
          <select
            className="bg-bg-input border border-border text-text-primary text-xs px-3 py-1.5 outline-none focus:border-border-focus"
            value={rowVar}
            onChange={e => setRowVar(e.target.value as SensitivityVariable)}
          >
            {VARIABLE_OPTIONS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Column Variable</label>
          <select
            className="bg-bg-input border border-border text-text-primary text-xs px-3 py-1.5 outline-none focus:border-border-focus"
            value={colVar}
            onChange={e => setColVar(e.target.value as SensitivityVariable)}
          >
            {VARIABLE_OPTIONS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Output Metric</label>
          <select
            className="bg-bg-input border border-border text-text-primary text-xs px-3 py-1.5 outline-none focus:border-border-focus"
            value={metric}
            onChange={e => setMetric(e.target.value as SensitivityMetric)}
          >
            {METRIC_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sensitivity Table */}
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="text-left">{rowConfig.label} ↓ / {colConfig.label} →</th>
              {sensitivity.colValues.map(cv => (
                <th key={cv}>{formatLabel(colVar, cv)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensitivity.rowValues.map((rv, ri) => (
              <tr key={rv}>
                <td className="font-semibold text-text-primary!">{formatLabel(rowVar, rv)}</td>
                {sensitivity.results[ri].map((val, ci) => (
                  <td key={ci} className={`${getHeatClass(val)} font-mono font-semibold text-center`}>
                    {metricConfig.format(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-green" /> Strong</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-amber" /> Moderate</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block heat-red" /> Weak</span>
      </div>

      {/* Info text */}
      <div className="mt-4 text-[11px] text-text-muted">
        Select any two input variables for the axes and choose the output metric. The sensitivity table
        re-computes the full LBO model for each combination, showing how returns change across scenarios.
      </div>
    </div>
  );
}
