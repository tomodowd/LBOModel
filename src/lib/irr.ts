// ─────────────────────────────────────────────────────────────────────────────
// IRR Calculation — Newton-Raphson Method
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates Internal Rate of Return using Newton-Raphson method.
 * Cash flows: array where cf[0] is the initial investment (negative),
 * and subsequent entries are periodic cash flows.
 * Returns IRR as a decimal (e.g., 0.25 = 25%).
 */
export function calculateIRR(cashFlows: number[], guess = 0.1, maxIterations = 1000, tolerance = 1e-10): number {
  if (cashFlows.length < 2) return 0;
  // Check if all cash flows are the same sign — no IRR exists
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  if (!hasPositive || !hasNegative) return NaN;

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    const { npv, dnpv } = npvAndDerivative(cashFlows, rate);

    if (Math.abs(npv) < tolerance) return rate;
    if (Math.abs(dnpv) < tolerance) {
      // Derivative too small, try bisection fallback
      return calculateIRRBisection(cashFlows);
    }

    const newRate = rate - npv / dnpv;

    // Guard against divergence
    if (newRate < -0.999) {
      return calculateIRRBisection(cashFlows);
    }

    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;
  }

  // Newton-Raphson didn't converge, fall back to bisection
  return calculateIRRBisection(cashFlows);
}

/**
 * NPV and its derivative with respect to rate.
 * NPV = Σ cf[t] / (1 + r)^t
 * dNPV/dr = Σ -t * cf[t] / (1 + r)^(t+1)
 */
function npvAndDerivative(cashFlows: number[], rate: number): { npv: number; dnpv: number } {
  let npv = 0;
  let dnpv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const discountFactor = Math.pow(1 + rate, t);
    if (discountFactor === 0) continue;
    npv += cashFlows[t] / discountFactor;
    dnpv -= t * cashFlows[t] / (discountFactor * (1 + rate));
  }
  return { npv, dnpv };
}

/**
 * Bisection method fallback for IRR calculation.
 * Searches between -99% and 1000% for rate where NPV = 0.
 */
function calculateIRRBisection(cashFlows: number[], tolerance = 1e-10, maxIterations = 1000): number {
  let low = -0.99;
  let high = 10.0;

  const npvAtRate = (r: number) => {
    let sum = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      sum += cashFlows[t] / Math.pow(1 + r, t);
    }
    return sum;
  };

  let npvLow = npvAtRate(low);

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = npvAtRate(mid);

    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      return mid;
    }

    if (npvMid * npvLow < 0) {
      high = mid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return (low + high) / 2;
}

/**
 * Calculate NPV at a given discount rate.
 */
export function calculateNPV(cashFlows: number[], rate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return npv;
}

/**
 * Calculate Money-on-Money (MoM) multiple.
 */
export function calculateMoM(invested: number, returned: number): number {
  if (invested === 0) return 0;
  return returned / invested;
}
