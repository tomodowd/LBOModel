import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ComposedChart, Line,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useModel } from '../../context/ModelContext';
import { computeSensitivity } from '../../lib/lbo-engine';
import type { LBOModel } from '../../lib/types';

const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
  grey: '#64748b',
  darkBlue: '#1e40af',
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtCurrency = (cs: string) => (v: any) => `${cs}${Number(v).toFixed(1)}m`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMultiple = (v: any) => `${Number(v).toFixed(1)}×`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtPct = (v: any) => `${Number(v).toFixed(1)}%`;

export function Dashboard() {
  const { model, outputs } = useModel();
  const cs = model.deal.currency === 'GBP' ? '£' : '$';
  const hp = model.deal.holdPeriod;
  const fmt = fmtCurrency(cs);

  // ── Data prep ──────────────────────────────────────────────────────────

  const suData = [
    { name: 'Purchase Price', value: outputs.sourcesUses.purchasePrice, type: 'use' },
    { name: 'Txn Fees', value: outputs.sourcesUses.transactionFees, type: 'use' },
    { name: 'Fin Fees', value: outputs.sourcesUses.financingFees, type: 'use' },
    { name: 'Cash to BS', value: outputs.sourcesUses.cashToBS, type: 'use' },
    ...model.debtTranches.map(t => ({ name: t.name.replace('Senior ', ''), value: t.amount, type: 'source' })),
    { name: 'Sponsor Eq.', value: outputs.sourcesUses.sponsorEquity, type: 'source' },
    { name: 'Mgmt Roll.', value: outputs.sourcesUses.managementRollover, type: 'source' },
  ];

  const entryEBITDA = outputs.projections[0].ebitda;
  const exitEBITDA = outputs.projections[hp].ebitda;
  const ebitdaBridge = [
    { name: 'Entry EBITDA', value: entryEBITDA },
    { name: 'Rev Growth', value: (outputs.projections[hp].revenue - outputs.projections[0].revenue) * (outputs.projections[0].ebitdaMargin / 100) },
    { name: 'Margin Exp.', value: exitEBITDA - entryEBITDA - (outputs.projections[hp].revenue - outputs.projections[0].revenue) * (outputs.projections[0].ebitdaMargin / 100) },
    { name: 'Exit EBITDA', value: exitEBITDA },
  ];

  const debtPaydownData = outputs.projections.map((_p, i) => {
    const row: Record<string, unknown> = { year: i === 0 ? 'Entry' : `Y${i}` };
    outputs.debtSchedules.forEach(s => {
      row[s.trancheName] = s.years[i]?.closingBalance ?? 0;
    });
    return row;
  });

  const fcfData = outputs.projections.slice(1).map(p => ({
    year: `Y${p.year}`,
    unleveredFCF: p.unleveredFCF,
    leveredFCF: p.leveredFCF,
  }));

  const leverageData = outputs.debtSummary.map((ds, i) => ({
    year: i === 0 ? 'Entry' : `Y${i}`,
    leverage: isFinite(ds.netLeverage) ? ds.netLeverage : 0,
    covenant: model.covenants.find(c => c.type === 'leverage')?.threshold ?? 5.5,
  }));

  const attrData = [
    { name: 'Rev. Growth', value: outputs.irrAttribution.revenueGrowth },
    { name: 'Margin Exp.', value: outputs.irrAttribution.marginExpansion },
    { name: 'Deleverage', value: outputs.irrAttribution.deleveraging },
    { name: 'Mult. Exp.', value: outputs.irrAttribution.multipleExpansion },
  ];

  const cfWaterfall = outputs.projections.slice(1).map(p => ({
    year: `Y${p.year}`,
    ebitda: p.ebitda,
    capex: -p.capex,
    nwc: -p.nwcChange,
    tax: -p.cashTaxes,
    interest: -p.interestPaid,
    debtRepay: -(p.debtRepayment + p.cashSweep),
  }));

  return (
    <div className="section-container">
      <h2 className="section-title">Visualisations Dashboard</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <ChartCard title="Sources & Uses">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={suData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={75} />
              <Tooltip {...tooltipStyle} formatter={fmt} />
              <Bar dataKey="value" name={`${cs}m`}>
                {suData.map((entry, i) => (
                  <Cell key={i} fill={entry.type === 'use' ? CHART_COLORS.red : CHART_COLORS.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="EBITDA Bridge">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ebitdaBridge} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmt} />
              <Bar dataKey="value" name={`${cs}m`}>
                {ebitdaBridge.map((entry, i) => (
                  <Cell key={i} fill={
                    i === 0 || i === ebitdaBridge.length - 1 ? CHART_COLORS.blue :
                    entry.value >= 0 ? CHART_COLORS.green : CHART_COLORS.red
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Debt Paydown by Tranche">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={debtPaydownData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmt} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {outputs.debtSchedules.map((s, i) => (
                <Area
                  key={s.trancheId}
                  type="monotone"
                  dataKey={s.trancheName}
                  stackId="1"
                  fill={[CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.purple, CHART_COLORS.cyan][i % 4]}
                  stroke={[CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.purple, CHART_COLORS.cyan][i % 4]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Free Cash Flow — Unlevered vs Levered">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={fcfData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmt} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="unleveredFCF" name="Unlevered FCF" fill={CHART_COLORS.blue} />
              <Bar dataKey="leveredFCF" name="Levered FCF" fill={CHART_COLORS.green} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Net Leverage with Covenant Line">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={leverageData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmtMultiple} />
              <Bar dataKey="leverage" name="Net Leverage" fill={CHART_COLORS.blue} fillOpacity={0.7} />
              <Line
                type="monotone" dataKey="covenant" name="Covenant"
                stroke={CHART_COLORS.red} strokeDasharray="5 5" strokeWidth={2}
                dot={false}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Returns Attribution — IRR Decomposition">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={attrData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmtPct} />
              <Bar dataKey="value" name="IRR Contribution (%)">
                {attrData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.value >= 0
                      ? [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.amber][i]
                      : CHART_COLORS.red
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="IRR by Exit Multiple">
          <IRRSensitivityChart model={model} />
        </ChartCard>

        <ChartCard title="Levered FCF Composition by Year">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cfWaterfall} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip {...tooltipStyle} formatter={fmt} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="ebitda" name="EBITDA" stackId="a" fill={CHART_COLORS.blue} />
              <Bar dataKey="capex" name="Capex" stackId="a" fill={CHART_COLORS.red} />
              <Bar dataKey="nwc" name="NWC" stackId="a" fill={CHART_COLORS.amber} />
              <Bar dataKey="tax" name="Tax" stackId="a" fill={CHART_COLORS.grey} />
              <Bar dataKey="interest" name="Interest" stackId="a" fill={CHART_COLORS.purple} />
              <Bar dataKey="debtRepay" name="Debt Repay" stackId="a" fill={CHART_COLORS.darkBlue} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function IRRSensitivityChart({ model }: { model: LBOModel }) {
  const data = useMemo(() => {
    const exitMults = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5];
    const sens = computeSensitivity(model, 'exitMultiple', 'holdPeriod', 'irr', exitMults, [model.deal.holdPeriod]);
    return exitMults.map((mult, i) => ({
      multiple: `${mult.toFixed(1)}×`,
      irr: sens.results[i][0],
    }));
  }, [model]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="multiple" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #1e293b', borderRadius: 0, fontSize: 11, fontFamily: 'JetBrains Mono' }}
          formatter={fmtPct}
        />
        <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="5 5" label={{ value: '20% target', position: 'right', fill: '#22c55e', fontSize: 9 }} />
        <Bar dataKey="irr" name="Sponsor IRR">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.irr >= 20 ? CHART_COLORS.green : entry.irr >= 15 ? CHART_COLORS.amber : CHART_COLORS.red} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-secondary border border-border p-4">
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
}
