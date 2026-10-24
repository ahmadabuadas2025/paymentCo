// Shared types for the PaymentCo 2030 financial model.
// Everything in src/model is plain TypeScript with no React, so it can be unit-tested.

export type UseCaseId =
  | 'fraud'
  | 'disputes'
  | 'fincrime'
  | 'contact'
  | 'growth'
  | 'product'
  | 'finintel';

/** Which line of the AI value formula a driver feeds. */
export type DriverGroup =
  | 'savings'
  | 'loss'
  | 'revenue'
  | 'wc'
  | 'opex'
  | 'risk'
  | 'year0';

/** How a driver value is stored and shown. Percentages are stored as fractions (0.4 = 40%). */
export type DriverUnit = 'usd' | 'pct' | 'count' | 'days' | 'fte' | 'hours';

export interface DriverDef {
  id: string; // e.g. "D1"
  label: string;
  group: DriverGroup;
  value: number; // default (base case) value
  unit: DriverUnit;
  min: number;
  max: number;
  step: number;
  source: string; // where the default comes from (shown in tooltips)
  /** +1 if raising the driver raises net value, -1 if it lowers it. Used by Monte Carlo. */
  direction: 1 | -1;
  /** True for shares/percentages that can never exceed 100%. */
  isShare?: boolean;
  /** True for Year-0 lines that count as integration or data work (shared data layer discount). */
  integration?: boolean;
}

/** The six lines of the AI value formula plus the Year-0 investment. */
export interface ValueComponents {
  costSavings: number;
  lossAvoidance: number;
  revenue: number;
  workingCapital: number;
  operatingCost: number;
  residualRisk: number;
  year0: number;
  /** Part of year0 that is integration + data work (used by the shared-data-layer switch). */
  year0Integration: number;
}

export interface ScenarioBounds {
  benefit: number; // e.g. -0.4 for downside, +0.3 for upside
  invest: number; // e.g. +0.2 for downside, -0.1 for upside
}

export interface UseCaseDef {
  id: UseCaseId;
  number: number; // case numbering (#1 ... #7)
  name: string;
  short: string;
  /** Funded in the team's "Protect the Network First" portfolio. */
  defaultFunded: boolean;
  haircut: number;
  downside: ScenarioBounds;
  upside: ScenarioBounds;
  drivers: DriverDef[];
  /** Turn driver values into the value-formula lines. `rate` is the discount rate. */
  compute: (d: Record<string, number>, rate: number) => ValueComponents;
  /** Scorecard: Value, Customer, Speed, Data, Risk, Scale, Differentiation, Staff (1-5). */
  scores: number[];
  description: string;
}

export type Sourcing = 'build' | 'buy';
export type HumanReview = 'all' | 'sampled' | 'auto';

export interface Globals {
  discountRate: number; // 0.10
  haircutDelta: number; // added to every use case's haircut (percentage points as fraction)
  benefitAdj: number; // global benefit adjustment (e.g. -0.1 = 10% less net value)
  investAdj: number; // global Year-0 adjustment
  adoptionRamp: number; // share of value achieved in Year 1 (0.3 - 1.0)
  delayMonths: number; // months of delay before value starts (0 - 12)
}

export interface Approaches {
  sourcing: Record<UseCaseId, Sourcing>;
  pilotFirst: 'disputes' | 'fraud';
  humanReview: HumanReview;
  sharedDataLayer: boolean;
}

export interface ScenarioState {
  name: string;
  drivers: Record<UseCaseId, Record<string, number>>;
  funded: Record<UseCaseId, boolean>;
  globals: Globals;
  approaches: Approaches;
  /** $15M budget: 9 categories x 3 years, in dollars. */
  budget: number[][];
}

export interface UseCaseResult {
  id: UseCaseId;
  funded: boolean;
  components: ValueComponents; // after approach switches
  net: number; // net annual AI value (after global benefit adjustment)
  year0: number; // Year-0 investment (after global investment adjustment)
  yearShares: number[]; // share of full annual value achieved in Years 1..3
  npv: number;
  payback: number; // months
  haircut: number;
  riskAdjNpv: number;
  riskAdjRoi: number;
  downsideNpv: number;
  upsideNpv: number;
  costOfDelayQuarter: number;
}

export interface PortfolioResult {
  useCases: UseCaseResult[];
  funded: UseCaseResult[];
  totals: {
    net: number;
    year0: number;
    npv: number;
    payback: number;
    riskAdjNpv: number;
    riskAdjRoi: number;
    downsideNpv: number;
    upsideNpv: number;
    costOfDelayQuarter: number;
    components: ValueComponents;
  };
}
