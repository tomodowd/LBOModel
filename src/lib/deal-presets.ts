// ─────────────────────────────────────────────────────────────────────────────
// Deal Type Presets — generates debt tranche structures from market benchmarks
// ─────────────────────────────────────────────────────────────────────────────

import type { DebtTranche, DealType, RateType } from './types';

// Current market reference rates (as of March 2026)
export const MARKET_RATES = {
  sonia: 3.73,
  tla_spread: 325,       // bps
  tlb_spread: 450,
  hy_fixed: 8.50,        // %
  unitranche_spread: 550,
  second_lien_spread: 750,
  pik_fixed: 12.00,
  rcf_spread: 325,
  rcf_commitment: 1.20,  // %
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Preset generation
// ─────────────────────────────────────────────────────────────────────────────

export function generatePresetTranches(
  dealType: DealType,
  debtPct: number
): DebtTranche[] {
  switch (dealType) {
    case 'mid-market-bsl':
      return generateMidMarketBSL(debtPct);
    case 'large-cap-bsl':
      return generateLargeCapBSL(debtPct);
    case 'direct-lending':
      return generateDirectLending(debtPct);
  }
}

function generateMidMarketBSL(debtPct: number): DebtTranche[] {
  const tlaPct = Math.min(15, debtPct);
  const tlbPct = Math.max(0, debtPct - 15);

  return [
    makeTranche({
      id: 'rcf', name: 'Revolving Credit Facility',
      amountPct: 8, rateType: 'floating', floatingSpread: MARKET_RATES.rcf_spread,
      tenor: 5, isUndrawn: true, commitmentFeePct: MARKET_RATES.rcf_commitment,
    }),
    makeTranche({
      id: 'tla', name: 'Senior Term Loan A',
      amountPct: tlaPct, rateType: 'floating', floatingSpread: MARKET_RATES.tla_spread,
      amortisationPct: 5, tenor: 5,
    }),
    makeTranche({
      id: 'tlb', name: 'Senior Term Loan B',
      amountPct: tlbPct, rateType: 'floating', floatingSpread: MARKET_RATES.tlb_spread,
      amortisationPct: 1, cashSweepPct: 75, tenor: 7,
    }),
  ];
}

function generateLargeCapBSL(debtPct: number): DebtTranche[] {
  const hasPIK = debtPct > 55;
  const pikPct = hasPIK ? 5 : 0;
  const tlbPct = Math.min(35, debtPct);
  const hyPct = Math.max(0, debtPct - tlbPct - pikPct);

  return [
    makeTranche({
      id: 'rcf', name: 'Revolving Credit Facility',
      amountPct: 8, rateType: 'floating', floatingSpread: MARKET_RATES.rcf_spread,
      tenor: 5, isUndrawn: true, commitmentFeePct: MARKET_RATES.rcf_commitment,
    }),
    makeTranche({
      id: 'tlb', name: 'Senior Term Loan B',
      amountPct: tlbPct, rateType: 'floating', floatingSpread: MARKET_RATES.tlb_spread,
      amortisationPct: 1, cashSweepPct: 75, tenor: 7,
    }),
    makeTranche({
      id: 'hy', name: 'High Yield Bond',
      amountPct: hyPct, rateType: 'fixed', fixedRate: MARKET_RATES.hy_fixed,
      tenor: 8,
    }),
    ...(hasPIK ? [makeTranche({
      id: 'pik', name: 'PIK Notes',
      amountPct: pikPct, rateType: 'fixed', fixedRate: MARKET_RATES.pik_fixed,
      isPIK: true, tenor: 7,
    })] : []),
  ];
}

function generateDirectLending(debtPct: number): DebtTranche[] {
  const hasPIK = debtPct > 50;
  const pikPct = hasPIK ? 5 : 0;

  return [
    makeTranche({
      id: 'rcf', name: 'Revolving Credit Facility',
      amountPct: 5, rateType: 'floating', floatingSpread: MARKET_RATES.rcf_spread,
      tenor: 5, isUndrawn: true, commitmentFeePct: MARKET_RATES.rcf_commitment,
    }),
    makeTranche({
      id: 'unitranche', name: 'Unitranche',
      amountPct: debtPct, rateType: 'floating', floatingSpread: MARKET_RATES.unitranche_spread,
      amortisationPct: 1, tenor: 7,
    }),
    ...(hasPIK ? [makeTranche({
      id: 'pik-second', name: 'PIK / Second Out',
      amountPct: pikPct, rateType: 'fixed', fixedRate: MARKET_RATES.pik_fixed,
      isPIK: true, tenor: 7,
    })] : []),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Market rate reset
// ─────────────────────────────────────────────────────────────────────────────

const RATE_MAP: Record<string, { rateType: RateType; spread?: number; fixed?: number }> = {
  rcf:          { rateType: 'floating', spread: MARKET_RATES.rcf_spread },
  tla:          { rateType: 'floating', spread: MARKET_RATES.tla_spread },
  tlb:          { rateType: 'floating', spread: MARKET_RATES.tlb_spread },
  hy:           { rateType: 'fixed', fixed: MARKET_RATES.hy_fixed },
  unitranche:   { rateType: 'floating', spread: MARKET_RATES.unitranche_spread },
  'second-lien': { rateType: 'floating', spread: MARKET_RATES.second_lien_spread },
  pik:          { rateType: 'fixed', fixed: MARKET_RATES.pik_fixed },
  'pik-second': { rateType: 'fixed', fixed: MARKET_RATES.pik_fixed },
};

export function resetToMarketRates(tranches: DebtTranche[]): DebtTranche[] {
  return tranches.map(t => {
    const defaults = RATE_MAP[t.id];
    if (!defaults) return t; // custom tranche, leave as-is
    const updated = { ...t, baseRate: MARKET_RATES.sonia };
    if (defaults.rateType === 'floating' && defaults.spread !== undefined) {
      updated.rateType = 'floating';
      updated.floatingSpread = defaults.spread;
    } else if (defaults.rateType === 'fixed' && defaults.fixed !== undefined) {
      updated.rateType = 'fixed';
      updated.fixedRate = defaults.fixed;
    }
    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

interface MakeTrancheParams {
  id: string;
  name: string;
  amountPct: number;
  rateType: RateType;
  fixedRate?: number;
  floatingSpread?: number;
  amortisationPct?: number;
  cashSweepPct?: number;
  isPIK?: boolean;
  tenor: number;
  isUndrawn?: boolean;
  commitmentFeePct?: number;
}

function makeTranche(p: MakeTrancheParams): DebtTranche {
  return {
    id: p.id,
    name: p.name,
    amount: 0,                          // resolved dynamically via amountPct
    amountAsPctOfEV: true,
    amountPct: p.amountPct,
    rateType: p.rateType,
    fixedRate: p.fixedRate ?? 0,
    floatingSpread: p.floatingSpread ?? 0,
    baseRate: MARKET_RATES.sonia,
    amortisationPct: p.amortisationPct ?? 0,
    cashSweepPct: p.cashSweepPct ?? 0,
    isPIK: p.isPIK ?? false,
    tenor: p.tenor,
    isUndrawn: p.isUndrawn ?? false,
    commitmentFeePct: p.commitmentFeePct ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatDealType(dt: DealType): string {
  switch (dt) {
    case 'mid-market-bsl': return 'Mid-Market BSL';
    case 'large-cap-bsl': return 'Large-Cap BSL';
    case 'direct-lending': return 'Direct Lending';
  }
}
