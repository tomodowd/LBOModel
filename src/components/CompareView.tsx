import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useScenarios } from '../context/ModelContext';
import type { ScenarioWithOutputs } from '../lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Chart colours (one per scenario, up to 6)
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIO_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1a2332',
    border: '1px solid #1e293b',
    borderRadius: 0,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  labelStyle: { color: '#94a3b8' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Metric definitions
// ─────────────────────────────────────────────────────────────────────────────

interface MetricDef {
  label: string;
  extract: (s: ScenarioWithOutputs) => number;
  format: (v: number, cs: string) => string;
  higherIsBetter: boolean;
  isIRR?: boolean;
}

function buildMetrics(cs: string): MetricDef[] {
  return [
    {
      label: 'Entry EV',
      extract: s => s.outputs.sourcesUses.purchasePrice,
      format: v => `${cs}${v.toFixed(1)}m`,
      higherIsBetter: true,
    },
    {
      label: 'Entry Multiple',
      extract: s => s.model.deal.entryMultiple,
      format: v => `${v.toFixed(1)}×`,
      higherIsBetter: false, // lower entry = better
    },
    {
      label: 'Exit Multiple',
      extract: s => s.outputs.exitWaterfall.exitMultiple,
      format: v => `${v.toFixed(1)}×`,
      higherIsBetter: true,
    },
    {
      label: 'Exit EV',
      extract: s => s.outputs.exitWaterfall.exitEV,
      format: v => `${cs}${v.toFixed(1)}m`,
      higherIsBetter: true,
    },
    {
      label: 'Net Debt at Exit',
      extract: s => s.outputs.exitWaterfall.netDebtAtExit,
      format: v => `${cs}${v.toFixed(1)}m`,
      higherIsBetter: false,
    },
    {
      label: 'Exit Equity',
      extract: s => s.outputs.exitWaterfall.exitEquityValue,
      format: v => `${cs}${v.toFixed(1)}m`,
      higherIsBetter: true,
    },
    {
      label: 'Sponsor IRR',
      extract: s => s.outputs.returns.sponsor.irr,
      format: v => `${v.toFixed(1)}%`,
      higherIsBetter: true,
      isIRR: true,
    },
    {
      label: 'Sponsor MoM',
      extract: s => s.outputs.returns.sponsor.mom,
      format: v => `${v.toFixed(2)}×`,
      higherIsBetter: true,
    },
    {
      label: 'Net Leverage (Entry)',
      extract: s => s.outputs.debtSummary[0]?.netLeverage ?? 0,
      format: v => `${v.toFixed(1)}×`,
      higherIsBetter: false,
    },
    {
      label: 'Net Leverage (Exit)',
      extract: s => {
        const hp = s.model.deal.holdPeriod;
        return s.outputs.debtSummary[hp]?.netLeverage ?? 0;
      },
      format: v => `${v.toFixed(1)}×`,
      higherIsBetter: false,
    },
    {
      label: 'Revenue CAGR',
      extract: s => s.model.deal.revenueCAGR,
      format: v => `${v.toFixed(1)}%`,
      higherIsBetter: true,
    },
    {
      label: 'EBITDA Margin (Exit)',
      extract: s => s.model.deal.exitEBITDAMargin,
      format: v => `${v.toFixed(1)}%`,
      higherIsBetter: true,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CompareView() {
  const { allOutputs } = useScenarios();

  // Determine currency from first scenario
  const cs = allOutputs[0]?.model.deal.currency === 'GBP' ? '£' : '$';
  const metrics = useMemo(() => buildMetrics(cs), [cs]);

  // Precompute all metric values and best indices
  const data = useMemo(() => {
    return metrics.map(m => {
      const values = allOutputs.map(s => m.extract(s));
      const bestIdx = m.higherIsBetter
        ? values.indexOf(Math.max(...values))
        : values.indexOf(Math.min(...values));
      return { metric: m, values, bestIdx };
    });
  }, [metrics, allOutputs]);

  // Memoised chart data (stable reference prevents Recharts re-animation)
  const irrData = useMemo(() => {
    return allOutputs.map(s => ({
      name: s.name,
      irr: s.outputs.returns.sponsor.irr,
    }));
  }, [allOutputs]);

  const momData = useMemo(() => {
    return allOutputs.map(s => ({
      name: s.name,
      mom: s.outputs.returns.sponsor.mom,
    }));
  }, [allOutputs]);

  if (allOutputs.length === 0) {
    return (
      <div className="section-container">
        <p className="text-text-muted text-sm">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="section-container">
      <h2 className="section-title">Scenario Comparison</h2>

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="lbo-table">
          <thead>
            <tr>
              <th className="text-left">Metric</th>
              {allOutputs.map((s, i) => (
                <th key={s.id}>
                  <span style={{ color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}>
                    {s.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(({ metric, values, bestIdx }) => (
              <tr key={metric.label}>
                <td className="text-text-secondary font-medium">{metric.label}</td>
                {values.map((v, i) => {
                  // IRR colour coding
                  let irrClass = '';
                  if (metric.isIRR) {
                    if (v < 15) irrClass = 'heat-red';
                    else if (v < 20) irrClass = 'heat-amber';
                    else irrClass = 'heat-green';
                  }
                  const isBest = i === bestIdx;
                  return (
                    <td
                      key={allOutputs[i].id}
                      className={`cell-formula ${irrClass} ${isBest ? 'compare-best' : ''}`}
                    >
                      {metric.format(v, cs)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* IRR Chart */}
        <div>
          <div className="section-subtitle mb-3">Sponsor IRR (%)</div>
          <div className="bg-bg-secondary border border-border p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={irrData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                  tickFormatter={(v: any) => `${v}%`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'IRR']}
                />
                <Bar dataKey="irr" name="Sponsor IRR" isAnimationActive={false}>
                  {irrData.map((_entry, i) => (
                    <Cell key={i} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MoM Chart */}
        <div>
          <div className="section-subtitle mb-3">Sponsor MoM (×)</div>
          <div className="bg-bg-secondary border border-border p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={momData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                  tickFormatter={(v: any) => `${Number(v).toFixed(1)}×`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any) => [`${Number(v).toFixed(2)}×`, 'MoM']}
                />
                <Bar dataKey="mom" name="Sponsor MoM" isAnimationActive={false}>
                  {momData.map((_entry, i) => (
                    <Cell key={i} fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
