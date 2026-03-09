// ─────────────────────────────────────────────────────────────────────────────
// LBO Calculation Engine
// Pure functions — no side effects, fully unit-testable
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LBOModel, LBOModelOutputs, SourcesUses, YearlyProjection,
  DebtTrancheSchedule, DebtScheduleSummary,
  CovenantTest, ExitWaterfall, Returns, ReturnMetrics,
  IRRAttribution, SensitivityResult, SensitivityVariable,
  SensitivityMetric, DebtTranche,
} from './types';
import { calculateIRR, calculateMoM } from './irr';

// ─────────────────────────────────────────────────────────────────────────────
// Main computation — takes model inputs, returns all computed outputs
// ─────────────────────────────────────────────────────────────────────────────

export function computeModel(model: LBOModel): LBOModelOutputs {
  const sourcesUses = computeSourcesUses(model);
  const { projections, debtSchedules, debtSummary, circularConverged, circularIterations } =
    computeProjections(model, sourcesUses);
  const covenantTests = computeCovenantTests(model, debtSummary, projections);
  const exitWaterfall = computeExitWaterfall(model, projections);
  const returns = computeReturns(model, sourcesUses, exitWaterfall);
  const irrAttribution = computeIRRAttribution(model, projections, exitWaterfall, returns);

  return {
    sourcesUses,
    projections,
    debtSchedules,
    debtSummary,
    covenantTests,
    exitWaterfall,
    returns,
    irrAttribution,
    circularConverged,
    circularIterations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sources & Uses
// ─────────────────────────────────────────────────────────────────────────────

export function computeSourcesUses(model: LBOModel): SourcesUses {
  const { deal, debtTranches } = model;
  const ev = deal.entryEBITDA * deal.entryMultiple;

  // Separate drawn vs undrawn (RCF)
  const drawnTranches = debtTranches.filter(t => !t.isUndrawn);
  const rcfTranches = debtTranches.filter(t => t.isUndrawn);

  // Uses
  const purchasePrice = ev;
  const transactionFees = ev * (deal.transactionFeesPct / 100);
  const totalDebt = drawnTranches.reduce((sum, t) => sum + resolveTrancheAmount(t, ev), 0);
  const financingFees = totalDebt * (deal.financingFeesPct / 100);
  const cashToBS = deal.cashToBS;
  const totalUses = purchasePrice + transactionFees + financingFees + cashToBS;

  // Sources (equity is the plug)
  const totalEquity = totalUses - totalDebt;
  const managementRollover = totalEquity * (deal.managementRolloverPct / 100);
  const sponsorEquity = totalEquity - managementRollover;

  // Gap tracking
  const targetDebt = ev * (deal.debtPct / 100);
  const debtGap = targetDebt - totalDebt;

  return {
    purchasePrice,
    transactionFees,
    financingFees,
    cashToBS,
    totalUses,
    debtTranches: drawnTranches,
    rcfTranches,
    totalDebt,
    sponsorEquity,
    managementRollover,
    totalEquity,
    totalSources: totalDebt + totalEquity,
    isBalanced: Math.abs(totalUses - (totalDebt + totalEquity)) < 0.01,
    targetDebt,
    debtGap,
  };
}

function resolveTrancheAmount(tranche: DebtTranche, ev: number): number {
  if (tranche.amountAsPctOfEV) {
    return ev * (tranche.amountPct / 100);
  }
  return tranche.amount;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operating Model + Debt Schedule (computed together — they're interdependent)
// ─────────────────────────────────────────────────────────────────────────────

export function computeProjections(
  model: LBOModel,
  sourcesUses: SourcesUses
): {
  projections: YearlyProjection[];
  debtSchedules: DebtTrancheSchedule[];
  debtSummary: DebtScheduleSummary[];
  circularConverged: boolean;
  circularIterations: number;
} {
  const { deal, debtTranches, yearlyOverrides } = model;
  const hp = deal.holdPeriod;
  const ev = deal.entryEBITDA * deal.entryMultiple;
  const circular = model.circularDebtSchedule;

  const MAX_ITERATIONS = 100;
  const TOLERANCE = 0.001; // £m

  // Initialise debt schedules
  const debtSchedules: DebtTrancheSchedule[] = debtTranches.map(t => ({
    trancheId: t.id,
    trancheName: t.name,
    years: [],
  }));

  // Current debt balances (mutable during projection loop)
  const currentBalances: Record<string, number> = {};
  debtTranches.forEach(t => {
    currentBalances[t.id] = t.isUndrawn ? 0 : resolveTrancheAmount(t, ev);
  });

  const projections: YearlyProjection[] = [];
  const debtSummary: DebtScheduleSummary[] = [];

  // EBITDA margin interpolation: linearly from entry to exit over hold period
  const marginStep = (deal.exitEBITDAMargin - deal.entryEBITDAMargin) / hp;

  // Year 0 = LTM (entry financials)
  const entryRevenue = deal.entryEBITDA / (deal.entryEBITDAMargin / 100);

  let prevRevenue = entryRevenue;
  let cash = sourcesUses.cashToBS;
  let maxIterationsUsed = 0;
  let allConverged = true;

  for (let year = 0; year <= hp; year++) {
    const ov = yearlyOverrides[year] || {};
    const isLTM = year === 0;

    // Revenue
    const growthRate = isLTM ? 0 : (ov.revenueGrowth ?? deal.revenueCAGR);
    const revenue = isLTM ? entryRevenue : prevRevenue * (1 + growthRate / 100);
    const revenueGrowth = isLTM ? 0 : growthRate;

    // Margins
    const ebitdaMargin = isLTM
      ? deal.entryEBITDAMargin
      : (ov.ebitdaMargin ?? (deal.entryEBITDAMargin + marginStep * year));
    const ebitda = revenue * (ebitdaMargin / 100);

    const gm = ov.ebitdaMargin !== undefined ? ebitdaMargin + 10 : deal.grossMargin;
    const grossProfit = revenue * (gm / 100);

    // D&A
    const daPct = ov.daPercent ?? deal.daPercent;
    const da = revenue * (daPct / 100);
    const ebit = ebitda - da;

    // Cash Flow (non-debt components — invariant across iterations)
    const capexPct = ov.capexPercent ?? deal.capexPercent;
    const capex = revenue * (capexPct / 100);
    const nwcPct = ov.nwcPercent ?? deal.nwcPercent;
    const nwcChange = isLTM ? 0 : (revenue - prevRevenue) * (nwcPct / 100);

    // ── Debt schedule for this year ──
    let totalCashInterest = 0;
    let totalPIKInterest = 0;
    let totalAmort = 0;
    let totalCashSweep = 0;

    // Per-tranche results for this year (overwritten each iteration)
    interface TrancheYearResult {
      openBal: number; cashInterest: number; pikInterest: number;
      mandatoryAmort: number; cashSweepRepayment: number; closingBalance: number;
    }
    let trancheResults: TrancheYearResult[] = [];

    if (!isLTM) {
      // Previous closing balances for avg-debt calculation
      const prevClosing: Record<string, number> = {};
      debtTranches.forEach(t => { prevClosing[t.id] = currentBalances[t.id]; });

      let converged = false;
      let iterations = 0;

      // Seed: initial interest guess = interest on opening balance (simple mode)
      for (iterations = 0; iterations < (circular ? MAX_ITERATIONS : 1); iterations++) {
        totalCashInterest = 0;
        totalPIKInterest = 0;
        totalAmort = 0;
        totalCashSweep = 0;
        trancheResults = [];

        for (let ti = 0; ti < debtTranches.length; ti++) {
          const tranche = debtTranches[ti];
          const openBal = currentBalances[tranche.id];
          if (openBal <= 0) {
            trancheResults.push({
              openBal: 0, cashInterest: 0, pikInterest: 0,
              mandatoryAmort: 0, cashSweepRepayment: 0, closingBalance: 0,
            });
            continue;
          }

          // Interest rate
          const rate = tranche.rateType === 'fixed'
            ? tranche.fixedRate / 100
            : (tranche.baseRate + tranche.floatingSpread / 100) / 100;

          // In circular mode after first iteration, use average debt for interest
          let interestBasis: number;
          if (circular && iterations > 0) {
            const prevClose = prevClosing[tranche.id];
            interestBasis = (openBal + prevClose) / 2;
          } else {
            interestBasis = openBal;
          }
          const interest = interestBasis * rate;

          let cashInterest: number;
          let pikInterest: number;
          if (tranche.isPIK) {
            cashInterest = 0;
            pikInterest = interest;
          } else {
            cashInterest = interest;
            pikInterest = 0;
          }

          // Mandatory amortisation
          const originalAmount = resolveTrancheAmount(tranche, ev);
          const mandatoryAmort = Math.min(
            originalAmount * (tranche.amortisationPct / 100),
            openBal + pikInterest
          );

          const closingBeforeSweep = openBal + pikInterest - mandatoryAmort;

          totalCashInterest += cashInterest;
          totalPIKInterest += pikInterest;
          totalAmort += mandatoryAmort;

          trancheResults.push({
            openBal, cashInterest, pikInterest,
            mandatoryAmort, cashSweepRepayment: 0,
            closingBalance: closingBeforeSweep,
          });
        }

        // Compute tax and FCF using this iteration's interest
        const iterInterestExpense = totalCashInterest + totalPIKInterest;
        const iterEBT = ebit - iterInterestExpense;
        const iterTax = Math.max(0, iterEBT * (deal.taxRate / 100));
        const iterUnleveredFCF = ebitda - capex - nwcChange - iterTax;
        const leveredFCF = iterUnleveredFCF - totalCashInterest - totalAmort;

        // Cash sweep
        totalCashSweep = 0;
        if (leveredFCF > 0) {
          let excessCash = leveredFCF;
          for (let ti = 0; ti < debtTranches.length; ti++) {
            const tranche = debtTranches[ti];
            if (tranche.cashSweepPct <= 0 || tranche.isPIK) continue;
            const tr = trancheResults[ti];
            const sweepAmount = Math.min(
              excessCash * (tranche.cashSweepPct / 100),
              tr.closingBalance
            );
            if (sweepAmount > 0) {
              tr.cashSweepRepayment = sweepAmount;
              tr.closingBalance -= sweepAmount;
              totalCashSweep += sweepAmount;
              excessCash -= sweepAmount;
            }
          }
        }

        // Check convergence: compare new closing balances to previous iteration
        if (circular && iterations > 0) {
          let maxDelta = 0;
          for (let ti = 0; ti < debtTranches.length; ti++) {
            const delta = Math.abs(trancheResults[ti].closingBalance - prevClosing[debtTranches[ti].id]);
            maxDelta = Math.max(maxDelta, delta);
          }
          if (maxDelta < TOLERANCE) {
            converged = true;
            iterations++;
            break;
          }
        }

        // Store this iteration's closing balances for next iteration's avg-debt calc
        for (let ti = 0; ti < debtTranches.length; ti++) {
          prevClosing[debtTranches[ti].id] = trancheResults[ti].closingBalance;
        }

        // Non-circular mode: single pass, always "converged"
        if (!circular) {
          converged = true;
          iterations = 1;
          break;
        }
      }

      if (!converged) allConverged = false;
      maxIterationsUsed = Math.max(maxIterationsUsed, iterations);

      // Push finalised tranche data
      for (let ti = 0; ti < debtTranches.length; ti++) {
        const tr = trancheResults[ti];
        debtSchedules[ti].years.push({
          year,
          openingBalance: tr.openBal,
          cashInterest: tr.cashInterest,
          pikInterest: tr.pikInterest,
          mandatoryAmort: tr.mandatoryAmort,
          cashSweepRepayment: tr.cashSweepRepayment,
          closingBalance: tr.closingBalance,
        });
      }
    } else {
      // Year 0 — just record opening balances
      for (let ti = 0; ti < debtTranches.length; ti++) {
        const tranche = debtTranches[ti];
        debtSchedules[ti].years.push({
          year: 0,
          openingBalance: currentBalances[tranche.id],
          cashInterest: 0,
          pikInterest: 0,
          mandatoryAmort: 0,
          cashSweepRepayment: 0,
          closingBalance: currentBalances[tranche.id],
        });
      }
    }

    // Update balances for next year
    if (!isLTM) {
      for (let ti = 0; ti < debtTranches.length; ti++) {
        const yearData = debtSchedules[ti].years[debtSchedules[ti].years.length - 1];
        currentBalances[debtTranches[ti].id] = Math.max(0, yearData.closingBalance);
      }
    }

    // Interest expense for P&L
    const interestExpense = totalCashInterest + totalPIKInterest;
    const ebt = ebit - interestExpense;
    const tax = Math.max(0, ebt * (deal.taxRate / 100));
    const netIncome = ebt - tax;
    const cashTaxes = tax;

    const unleveredFCF = ebitda - capex - nwcChange - cashTaxes;
    const leveredFCF = unleveredFCF - totalCashInterest - totalAmort;

    // Total debt & net debt
    const totalDebt = Object.values(currentBalances).reduce((a, b) => a + b, 0);
    cash = isLTM ? sourcesUses.cashToBS : cash + leveredFCF - totalCashSweep;
    const netDebt = totalDebt - Math.max(0, cash);

    // Exit EV for implied equity (using current year EBITDA and exit multiple)
    const impliedEV = ebitda * deal.exitMultiple;
    const impliedEquityValue = impliedEV - netDebt;

    projections.push({
      year,
      revenue,
      revenueGrowth,
      grossProfit,
      grossMargin: gm,
      ebitda,
      ebitdaMargin,
      da,
      ebit,
      interestExpense,
      pikInterest: totalPIKInterest,
      ebt,
      tax,
      netIncome,
      capex,
      nwcChange,
      cashTaxes,
      unleveredFCF,
      interestPaid: totalCashInterest,
      debtRepayment: totalAmort,
      cashSweep: totalCashSweep,
      leveredFCF,
      cash: Math.max(0, cash),
      netDebt,
      impliedEquityValue,
    });

    // Debt summary
    debtSummary.push({
      year,
      totalDebt,
      totalCashInterest,
      totalPIKInterest,
      totalAmort,
      totalCashSweep,
      interestCoverage: totalCashInterest > 0 ? ebitda / totalCashInterest : Infinity,
      netLeverage: ebitda > 0 ? netDebt / ebitda : Infinity,
    });

    prevRevenue = revenue;
  }

  return {
    projections,
    debtSchedules,
    debtSummary,
    circularConverged: allConverged,
    circularIterations: maxIterationsUsed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Covenant Tests
// ─────────────────────────────────────────────────────────────────────────────

export function computeCovenantTests(
  model: LBOModel,
  debtSummary: DebtScheduleSummary[],
  _projections: unknown[]
): CovenantTest[] {
  const tests: CovenantTest[] = [];
  for (const cov of model.covenants) {
    for (let i = 1; i < debtSummary.length; i++) {
      const ds = debtSummary[i];
      const actual = cov.type === 'leverage'
        ? ds.netLeverage
        : ds.interestCoverage;
      const inBreach = cov.isMaximum
        ? actual > cov.threshold
        : actual < cov.threshold;
      tests.push({
        covenantId: cov.id,
        year: ds.year,
        actual,
        threshold: cov.threshold,
        inBreach,
      });
    }
  }
  return tests;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Waterfall
// ─────────────────────────────────────────────────────────────────────────────

export function computeExitWaterfall(
  model: LBOModel,
  projections: YearlyProjection[]
): ExitWaterfall {
  const exitYear = projections[projections.length - 1];
  const exitMultiple = model.deal.linkExitToEntry ? model.deal.entryMultiple : model.deal.exitMultiple;
  const exitEBITDA = exitYear.ebitda;
  const exitEV = exitEBITDA * exitMultiple;
  const netDebtAtExit = exitYear.netDebt;
  const exitEquityValue = exitEV - netDebtAtExit;

  const mgmtPct = model.deal.managementRolloverPct / 100;
  const managementProceeds = exitEquityValue * mgmtPct;
  const sponsorProceeds = exitEquityValue - managementProceeds;

  return {
    exitEV,
    exitEBITDA,
    exitMultiple,
    netDebtAtExit,
    exitEquityValue,
    managementProceeds,
    sponsorProceeds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Returns Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function computeReturns(
  model: LBOModel,
  sourcesUses: SourcesUses,
  exitWaterfall: ExitWaterfall
): Returns {
  const hp = model.deal.holdPeriod;

  // Sponsor
  const sponsorInvested = sourcesUses.sponsorEquity;
  const sponsorReturned = exitWaterfall.sponsorProceeds;
  const sponsorCFs = [-sponsorInvested, ...Array(hp - 1).fill(0), sponsorReturned];

  const sponsor: ReturnMetrics = {
    equityInvested: sponsorInvested,
    equityReturned: sponsorReturned,
    mom: calculateMoM(sponsorInvested, sponsorReturned),
    irr: calculateIRR(sponsorCFs) * 100,
    holdPeriod: hp,
    dpi: calculateMoM(sponsorInvested, sponsorReturned),
  };

  // Management
  const mgmtInvested = sourcesUses.managementRollover;
  const mgmtReturned = exitWaterfall.managementProceeds;
  const mgmtCFs = [-mgmtInvested, ...Array(hp - 1).fill(0), mgmtReturned];

  const management: ReturnMetrics = {
    equityInvested: mgmtInvested,
    equityReturned: mgmtReturned,
    mom: calculateMoM(mgmtInvested, mgmtReturned),
    irr: mgmtInvested > 0 ? calculateIRR(mgmtCFs) * 100 : 0,
    holdPeriod: hp,
    dpi: calculateMoM(mgmtInvested, mgmtReturned),
  };

  // Total
  const totalInvested = sourcesUses.totalEquity;
  const totalReturned = exitWaterfall.exitEquityValue;
  const totalCFs = [-totalInvested, ...Array(hp - 1).fill(0), totalReturned];

  const total: ReturnMetrics = {
    equityInvested: totalInvested,
    equityReturned: totalReturned,
    mom: calculateMoM(totalInvested, totalReturned),
    irr: calculateIRR(totalCFs) * 100,
    holdPeriod: hp,
    dpi: calculateMoM(totalInvested, totalReturned),
  };

  return { sponsor, management, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// IRR Attribution Analysis
// Decomposes return into: revenue growth, margin expansion, deleveraging,
// multiple expansion/contraction
// ─────────────────────────────────────────────────────────────────────────────

export function computeIRRAttribution(
  model: LBOModel,
  projections: YearlyProjection[],
  exitWaterfall: ExitWaterfall,
  returns: Returns
): IRRAttribution {
  const hp = model.deal.holdPeriod;
  if (projections.length < 2) {
    return { revenueGrowth: 0, marginExpansion: 0, deleveraging: 0, multipleExpansion: 0, total: 0 };
  }

  const entryProj = projections[0];
  const exitProj = projections[hp];
  const entryMultiple = model.deal.entryMultiple;
  const exitMultiple = exitWaterfall.exitMultiple;

  // Entry equity = S&U total equity
  const entryEquity = model.deal.entryEBITDA * model.deal.entryMultiple *
    (model.deal.equityPct / 100);

  // 1. Revenue growth contribution: holding margin and multiple constant
  const revGrowthEBITDA = exitProj.revenue * (entryProj.ebitdaMargin / 100);
  const revGrowthEV = revGrowthEBITDA * entryMultiple;
  const revGrowthEquity = revGrowthEV - exitProj.netDebt;
  const revGrowthMoM = safeDivide(revGrowthEquity, entryEquity);

  // 2. Margin expansion: difference between actual margin and entry margin, at exit rev
  const marginExpEBITDA = exitProj.revenue * (exitProj.ebitdaMargin / 100) - revGrowthEBITDA;
  const marginExpEV = marginExpEBITDA * entryMultiple;
  const marginExpMoM = safeDivide(marginExpEV, entryEquity);

  // 3. Multiple expansion
  const multipleExpEV = exitProj.ebitda * (exitMultiple - entryMultiple);
  const multipleExpMoM = safeDivide(multipleExpEV, entryEquity);

  // 4. Deleveraging: debt paydown
  const entryDebt = entryProj.netDebt;
  const exitDebt = exitProj.netDebt;
  const deleveragingValue = entryDebt - exitDebt;
  const deleveragingMoM = safeDivide(deleveragingValue, entryEquity);

  const total = revGrowthMoM + marginExpMoM + multipleExpMoM + deleveragingMoM;

  // Normalise to sum to total IRR
  const totalIRR = returns.total.irr;

  return {
    revenueGrowth: total > 0 ? (revGrowthMoM / total) * totalIRR : 0,
    marginExpansion: total > 0 ? (marginExpMoM / total) * totalIRR : 0,
    deleveraging: total > 0 ? (deleveragingMoM / total) * totalIRR : 0,
    multipleExpansion: total > 0 ? (multipleExpMoM / total) * totalIRR : 0,
    total: totalIRR,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity Analysis
// ─────────────────────────────────────────────────────────────────────────────

export function computeSensitivity(
  baseModel: LBOModel,
  rowVar: SensitivityVariable,
  colVar: SensitivityVariable,
  metric: SensitivityMetric,
  rowValues: number[],
  colValues: number[]
): SensitivityResult {
  const results: number[][] = [];

  for (const rv of rowValues) {
    const row: number[] = [];
    for (const cv of colValues) {
      const tweaked = applyVariableOverride(
        applyVariableOverride(structuredClone(baseModel), rowVar, rv),
        colVar,
        cv
      );
      // Recompute EV if entry multiple or EBITDA changed
      tweaked.deal.enterpriseValue = tweaked.deal.entryEBITDA * tweaked.deal.entryMultiple;

      const outputs = computeModel(tweaked);
      row.push(extractMetric(outputs, metric));
    }
    results.push(row);
  }

  return { rowVariable: rowVar, colVariable: colVar, metric, rowValues, colValues, results };
}

function applyVariableOverride(model: LBOModel, variable: SensitivityVariable, value: number): LBOModel {
  switch (variable) {
    case 'entryMultiple':
      model.deal.entryMultiple = value;
      model.deal.enterpriseValue = model.deal.entryEBITDA * value;
      break;
    case 'exitMultiple':
      model.deal.exitMultiple = value;
      break;
    case 'revenueCAGR':
      model.deal.revenueCAGR = value;
      break;
    case 'ebitdaMargin':
      model.deal.exitEBITDAMargin = value;
      break;
    case 'leverage':
      // Adjust debt split to target leverage
      model.deal.debtPct = value / model.deal.entryMultiple * 100;
      model.deal.equityPct = 100 - model.deal.debtPct;
      break;
    case 'interestRate':
      // Shift all floating spreads
      model.debtTranches.forEach(t => {
        if (t.rateType === 'floating') t.baseRate = value;
      });
      break;
    case 'holdPeriod':
      model.deal.holdPeriod = Math.round(value);
      break;
  }
  return model;
}

function extractMetric(outputs: LBOModelOutputs, metric: SensitivityMetric): number {
  switch (metric) {
    case 'irr': return outputs.returns.sponsor.irr;
    case 'mom': return outputs.returns.sponsor.mom;
    case 'exitEquityValue': return outputs.exitWaterfall.exitEquityValue;
    case 'netLeverageAtExit':
      return outputs.debtSummary[outputs.debtSummary.length - 1]?.netLeverage ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

export function safeDivide(a: number, b: number, fallback = 0): number {
  if (b === 0 || !isFinite(b)) return fallback;
  return a / b;
}

export function formatValue(value: number, type: 'currency' | 'percent' | 'multiple' | 'ratio', currencySymbol = '£'): string {
  if (!isFinite(value) || isNaN(value)) return '—';

  switch (type) {
    case 'currency': {
      const abs = Math.abs(value);
      const formatted = `${currencySymbol}${abs.toFixed(1)}m`;
      return value < 0 ? `(${formatted})` : formatted;
    }
    case 'percent': {
      const abs = Math.abs(value);
      const formatted = `${abs.toFixed(1)}%`;
      return value < 0 ? `(${formatted})` : formatted;
    }
    case 'multiple':
      return `${value.toFixed(2)}×`;
    case 'ratio': {
      if (value === Infinity) return '∞';
      const abs = Math.abs(value);
      const formatted = `${abs.toFixed(1)}×`;
      return value < 0 ? `(${formatted})` : formatted;
    }
  }
}
