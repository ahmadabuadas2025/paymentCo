// Core finance formulas from the course's Financial Case Calculator.
// Each function is a direct translation of one line of the brief.

/** Σ_{t=1..years} 1/(1+r)^t  — the 3-year discount (annuity) factor. */
export function annuityFactor(rate: number, years = 3): number {
  let sum = 0;
  for (let t = 1; t <= years; t++) sum += 1 / Math.pow(1 + rate, t);
  return sum;
}

/**
 * Discount factor that also allows a ramp: Σ share_t / (1+r)^t.
 * With shares [1, 1, 1] this equals annuityFactor(rate, 3).
 */
export function rampedFactor(rate: number, shares: number[]): number {
  return shares.reduce((sum, share, i) => sum + share / Math.pow(1 + rate, i + 1), 0);
}

/** Net Annual AI Value = savings + loss avoidance + revenue + working capital − opex − residual risk. */
export function netAnnualValue(c: {
  costSavings: number;
  lossAvoidance: number;
  revenue: number;
  workingCapital: number;
  operatingCost: number;
  residualRisk: number;
}): number {
  return (
    c.costSavings + c.lossAvoidance + c.revenue + c.workingCapital - c.operatingCost - c.residualRisk
  );
}

/** 3-yr NPV = Net × Σ 1/(1+r)^t − Year-0. */
export function npv(net: number, year0: number, rate: number, shares = [1, 1, 1]): number {
  return net * rampedFactor(rate, shares) - year0;
}

/** Payback (months) = Year-0 / Net × 12. Infinite if the use case never pays back. */
export function paybackMonths(year0: number, net: number): number {
  return net > 0 ? (year0 / net) * 12 : Infinity;
}

/** Risk-adjusted NPV = Net × (1 − haircut) × Σ 1/(1+r)^t − Year-0. */
export function riskAdjustedNpv(
  net: number,
  haircut: number,
  year0: number,
  rate: number,
  shares = [1, 1, 1],
): number {
  return net * (1 - haircut) * rampedFactor(rate, shares) - year0;
}

/** Risk-adjusted ROI = Risk-adjusted NPV / Year-0. */
export function riskAdjustedRoi(riskAdjNpv: number, year0: number): number {
  return year0 > 0 ? riskAdjNpv / year0 : 0;
}

/** Scenario NPV = Net × (1 + benefitAdj) × Σ 1/(1+r)^t − Year-0 × (1 + investAdj). */
export function scenarioNpv(
  net: number,
  year0: number,
  rate: number,
  benefitAdj: number,
  investAdj: number,
  shares = [1, 1, 1],
): number {
  return net * (1 + benefitAdj) * rampedFactor(rate, shares) - year0 * (1 + investAdj);
}

/** Cost of delay = Net × months / 12. */
export function costOfDelay(net: number, months: number): number {
  return (net * months) / 12;
}
