// The seven PaymentCo 2030 use cases.
// Fraud (#1) uses the professor's lump-sum worked example, Disputes (#2) uses the professor's
// driver model, and Financial Crime (#7) uses our team's driver model. The four deferred use
// cases have simple lump-sum inputs (team placeholders the user can edit).

import type { DriverDef, DriverGroup, DriverUnit, UseCaseDef, UseCaseId, ValueComponents } from './types';

// Source labels shown in tooltips.
const PROF = "Professor's worked example";
const TEAM = 'Team assumption';
const PLACEHOLDER = 'Team placeholder (deferred use case; not in workbook)';
const DECK = 'PaymentCo 2030 Week 2 deck (Oct 20, 2026)';

/** Small helper so each driver fits on one readable line. */
function drv(
  id: string,
  label: string,
  group: DriverGroup,
  value: number,
  unit: DriverUnit,
  source: string,
  opts: Partial<Pick<DriverDef, 'min' | 'max' | 'step' | 'direction' | 'isShare' | 'integration'>> = {},
): DriverDef {
  const isShare = opts.isShare ?? unit === 'pct';
  const costGroup = group === 'opex' || group === 'risk' || group === 'year0';
  return {
    id,
    label,
    group,
    value,
    unit,
    source,
    min: opts.min ?? 0,
    max: opts.max ?? (isShare ? 1 : Math.max(value * 3, 1)),
    step: opts.step ?? (isShare ? 0.01 : unit === 'usd' && value >= 100000 ? 50000 : 1),
    direction: opts.direction ?? (costGroup ? -1 : 1),
    isShare,
    integration: opts.integration,
  };
}

/** Drivers for a lump-sum use case: one input per value-formula line. */
function lumpSumDrivers(
  v: { cs: number; la: number; rev: number; wc: number; op: number; risk: number; y0: number },
  source: string,
): DriverDef[] {
  return [
    drv('CS', 'Cost savings', 'savings', v.cs, 'usd', source, { max: 10_000_000 }),
    drv('LA', 'Loss avoidance', 'loss', v.la, 'usd', source, { max: 10_000_000 }),
    drv('REV', 'Revenue growth', 'revenue', v.rev, 'usd', source, { max: 10_000_000 }),
    drv('WC', 'Working-capital benefit', 'wc', v.wc, 'usd', source, { max: 5_000_000 }),
    drv('OP', 'Operating cost', 'opex', v.op, 'usd', source, { max: 5_000_000 }),
    drv('RISK', 'Expected residual risk cost', 'risk', v.risk, 'usd', source, { max: 3_000_000 }),
    drv('Y0', 'Year-0 investment', 'year0', v.y0, 'usd', source, { max: 10_000_000 }),
  ];
}

/** Lump-sum use cases: no Year-0 breakdown, so we assume half of Year-0 is integration + data work. */
export const LUMP_SUM_INTEGRATION_SHARE = 0.5;

function computeLumpSum(d: Record<string, number>): ValueComponents {
  return {
    costSavings: d.CS,
    lossAvoidance: d.LA,
    revenue: d.REV,
    workingCapital: d.WC,
    operatingCost: d.OP,
    residualRisk: d.RISK,
    year0: d.Y0,
    year0Integration: d.Y0 * LUMP_SUM_INTEGRATION_SHARE,
  };
}

const STD_DOWN = { benefit: -0.4, invest: 0.25 };
const STD_UP = { benefit: 0.3, invest: -0.1 };

// ---------------------------------------------------------------------------
// #1 Fraud & Scam Prevention — professor's lump-sum worked example
// ---------------------------------------------------------------------------
const fraud: UseCaseDef = {
  id: 'fraud',
  number: 1,
  name: 'Fraud & Scam Prevention',
  short: 'Fraud',
  defaultFunded: true,
  haircut: 0.2,
  downside: { benefit: -0.4, invest: 0.2 },
  upside: STD_UP,
  scores: [5, 4, 3, 4, 3, 5, 4, 4],
  description: 'Real-time scam and fraud scoring across every client institution; fewer losses and fewer false declines.',
  drivers: [
    drv('CS', 'Cost savings (investigation labor)', 'savings', 1_200_000, 'usd', PROF, { max: 4_000_000 }),
    drv('LA', 'Loss avoidance (fraud losses prevented)', 'loss', 4_500_000, 'usd', PROF, { max: 12_000_000 }),
    drv('REV', 'Revenue growth (fewer false declines)', 'revenue', 1_000_000, 'usd', PROF, { max: 4_000_000 }),
    drv('WC', 'Working-capital benefit', 'wc', 0, 'usd', PROF, { max: 2_000_000 }),
    drv('OP', 'Operating cost', 'opex', 1_500_000, 'usd', PROF, { max: 5_000_000 }),
    drv('RISK', 'Expected residual risk cost', 'risk', 300_000, 'usd', PROF, { max: 2_000_000 }),
    drv('Y0', 'Year-0 investment', 'year0', 3_000_000, 'usd', PROF, { max: 8_000_000 }),
  ],
  compute: computeLumpSum,
};

// ---------------------------------------------------------------------------
// #2 Disputes & Exception Management — professor's driver model
// ---------------------------------------------------------------------------
const disputes: UseCaseDef = {
  id: 'disputes',
  number: 2,
  name: 'Disputes & Exception Management',
  short: 'Disputes',
  defaultFunded: true,
  haircut: 0.2,
  downside: STD_DOWN,
  upside: STD_UP,
  scores: [4, 4, 4, 4, 3, 4, 3, 4],
  description: 'AI evidence-building, recommendations and exception repair for card disputes and ACH/RTP breaks. The first 90-day pilot.',
  drivers: [
    drv('D1', 'Annual card disputes handled', 'savings', 600_000, 'count', 'McKinsey & Co.; Visa press release; Team assumption', { step: 10_000, max: 1_500_000 }),
    drv('D2', 'Cost per dispute', 'savings', 20, 'usd', 'McKinsey & Co. ($10–$50); Mastercard', { max: 60 }),
    drv('D3', 'Share of disputes AI-assisted', 'savings', 0.6, 'pct', 'Visa press release; Team assumption'),
    drv('D4', 'Time saved on AI-assisted disputes', 'savings', 0.4, 'pct', 'HCLTech (40%); FINBOA (50%); McKinsey (25–40%)'),
    drv('D5', 'Annual payment exceptions', 'savings', 400_000, 'count', TEAM, { step: 10_000, max: 1_200_000 }),
    drv('D6', 'Cost per exception', 'savings', 12, 'usd', TEAM, { max: 40 }),
    drv('D7', 'Share of exceptions AI-assisted', 'savings', 0.5, 'pct', TEAM),
    drv('D8', 'Time saved on AI-assisted exceptions', 'savings', 0.35, 'pct', 'Bain & Company; Team assumption'),
    drv('L1', 'Average disputed amount', 'loss', 110, 'usd', 'Mastercard (avg US chargeback $110)', { max: 400 }),
    drv('L3', 'Baseline loss rate on disputed value', 'loss', 0.08, 'pct', 'McKinsey & Co.; Mastercard; Team assumption', { max: 0.3 }),
    drv('L4', 'Loss reduction from AI', 'loss', 0.18, 'pct', 'Stripe Sessions 2026 (+18% recovered); Visa', { max: 0.6 }),
    drv('R1', 'Clients on premium AI-disputes tier', 'revenue', 10, 'count', 'Visa press release; Team assumption', { max: 50 }),
    drv('R2', 'Annual fee per premium client', 'revenue', 50_000, 'usd', TEAM, { step: 5_000, max: 200_000 }),
    drv('W1', 'Share of disputed value given provisional credit', 'wc', 0.6, 'pct', 'Reg E (12 CFR 1005.11); Team assumption'),
    drv('W2', 'Days provisional credit outstanding today', 'wc', 40, 'days', 'Reg E 45-day ceiling; Team assumption', { max: 90 }),
    drv('W3', 'Days outstanding with AI', 'wc', 25, 'days', 'McKinsey & Co.; Team assumption', { max: 90, direction: -1 }),
    drv('O1', 'Inference cost per AI-assisted item', 'opex', 0.5, 'usd', TEAM, { step: 0.05, max: 3 }),
    drv('O3', 'Platform / vendor licences', 'opex', 500_000, 'usd', 'Visa press release; Team assumption', { max: 2_000_000 }),
    drv('O4', 'QA and model-monitoring staff', 'opex', 3, 'fte', TEAM, { max: 15 }),
    drv('O5', 'Cost per QA FTE', 'opex', 135_000, 'usd', TEAM, { step: 5_000, max: 250_000 }),
    drv('X1', 'AI error rate needing remediation', 'risk', 0.005, 'pct', 'McKinsey & Co.; Team assumption', { step: 0.001, max: 0.05 }),
    drv('X2', 'Remediation cost per error', 'risk', 100, 'usd', TEAM, { max: 500 }),
    drv('X3', 'Regulatory / UDAAP reserve', 'risk', 75_000, 'usd', 'Reg E (12 CFR 1005.11); Team assumption', { step: 5_000, max: 500_000 }),
    drv('I1', 'Workflow integration', 'year0', 1_000_000, 'usd', `${DECK}; ${TEAM}`, { integration: true, max: 3_000_000 }),
    drv('I2', 'Platform set-up and data preparation', 'year0', 700_000, 'usd', `${DECK}; ${TEAM}`, { integration: true, max: 2_000_000 }),
    drv('I3', 'Model-risk validation and controls', 'year0', 300_000, 'usd', DECK, { max: 1_000_000 }),
    drv('I4', 'Training and change management', 'year0', 300_000, 'usd', DECK, { max: 1_000_000 }),
    drv('I5', 'Contingency', 'year0', 200_000, 'usd', TEAM, { max: 1_000_000 }),
  ],
  compute: (d, rate) => {
    const aiItems = d.D1 * d.D3 + d.D5 * d.D7; // O2: AI-assisted items per year
    const disputedValue = d.D1 * d.L1; // L2: total disputed value per year
    return {
      costSavings: d.D1 * d.D2 * d.D3 * d.D4 + d.D5 * d.D6 * d.D7 * d.D8,
      lossAvoidance: disputedValue * d.L3 * d.L4,
      revenue: d.R1 * d.R2,
      workingCapital: ((disputedValue * d.W1 * (d.W2 - d.W3)) / 365) * rate,
      operatingCost: d.O1 * aiItems + d.O3 + d.O4 * d.O5,
      residualRisk: aiItems * d.X1 * d.X2 + d.X3,
      year0: d.I1 + d.I2 + d.I3 + d.I4 + d.I5,
      year0Integration: d.I1 + d.I2,
    };
  },
};

// ---------------------------------------------------------------------------
// #7 Financial Crime & Model Governance — our team's driver model
// ---------------------------------------------------------------------------
const fincrime: UseCaseDef = {
  id: 'fincrime',
  number: 7,
  name: 'Financial Crime & Model Governance',
  short: 'Fin Crime',
  defaultFunded: true,
  haircut: 0.25, // high-risk tier
  downside: STD_DOWN,
  upside: STD_UP,
  scores: [3, 3, 4, 3, 3, 5, 4, 4],
  description: 'AML alert-triage copilot, KYC review assist and an SR 26-2 model inventory shared by every AI use case.',
  drivers: [
    drv('F1', 'AML / financial-crime analysts', 'savings', 60, 'fte', 'McKinsey & Co. (10–15% of FTEs); Team assumption', { max: 200 }),
    drv('F2', 'Cost per analyst', 'savings', 95_000, 'usd', TEAM, { step: 5_000, max: 200_000 }),
    drv('F3', 'Share of analyst work AI-assisted', 'savings', 0.75, 'pct', 'Columbia SIPA (90–95% false positives); Team assumption'),
    drv('F4', 'Time saved on AI-assisted work', 'savings', 0.4, 'pct', 'McKinsey 2025 (agentic AI in financial crime)'),
    drv('F5', 'KYC reviews per year', 'savings', 12_000, 'count', TEAM, { step: 500, max: 50_000 }),
    drv('F6', 'Cost per KYC review', 'savings', 100, 'usd', TEAM, { max: 400 }),
    drv('F7', 'Share of KYC reviews AI-assisted', 'savings', 0.8, 'pct', 'McKinsey & Co.; Team assumption'),
    drv('F8', 'Time saved per KYC review', 'savings', 0.35, 'pct', 'McKinsey & Co.; Team assumption'),
    drv('F9', 'Models in inventory', 'savings', 40, 'count', 'SR 26-2 (Apr 2026); Team assumption', { max: 150 }),
    drv('F10', 'Documentation hours per model per year', 'savings', 80, 'hours', TEAM, { max: 300 }),
    drv('F11', 'Cost per model-risk hour', 'savings', 120, 'usd', TEAM, { max: 300 }),
    drv('F12', 'Time saved by auto-drafted documentation', 'savings', 0.5, 'pct', TEAM),
    drv('L1', 'Annual probability of an enforcement finding', 'loss', 0.05, 'pct', 'FinCEN enforcement history; Team assumption', { step: 0.005, max: 0.3 }),
    drv('L2', 'Cost of a finding', 'loss', 8_000_000, 'usd', 'FinCEN; Team assumption', { step: 250_000, max: 30_000_000 }),
    drv('L3', 'Reduction in that probability from AI', 'loss', 0.5, 'pct', TEAM),
    drv('O1', 'Vendor licences (AML scoring, AI inventory)', 'opex', 500_000, 'usd', TEAM, { max: 2_000_000 }),
    drv('O2', 'Cloud and LLM usage', 'opex', 200_000, 'usd', TEAM, { step: 10_000, max: 1_000_000 }),
    drv('O3', 'QA and model-monitoring staff', 'opex', 2, 'fte', TEAM, { max: 15 }),
    drv('O4', 'Cost per QA FTE', 'opex', 135_000, 'usd', TEAM, { step: 5_000, max: 250_000 }),
    drv('X1', 'AI-assisted alerts and cases per year', 'risk', 250_000, 'count', TEAM, { step: 10_000, max: 1_000_000 }),
    drv('X2', 'Error rate after human review', 'risk', 0.002, 'pct', TEAM, { step: 0.0005, max: 0.02 }),
    drv('X3', 'Remediation cost per error', 'risk', 300, 'usd', TEAM, { max: 2_000 }),
    drv('X4', 'Regulatory / model-risk reserve', 'risk', 150_000, 'usd', 'Input Guide; SR 26-2; Team assumption', { step: 10_000, max: 1_000_000 }),
    drv('I1', 'Integration with case management and monitoring', 'year0', 600_000, 'usd', TEAM, { integration: true, max: 2_000_000 }),
    drv('I2', 'Data preparation and entity resolution', 'year0', 400_000, 'usd', 'PaymentCo 2030 Week 1 deck; Team assumption', { integration: true, max: 2_000_000 }),
    drv('I3', 'Model-risk validation (SR 26-2)', 'year0', 300_000, 'usd', `SR 26-2; ${DECK}`, { max: 1_000_000 }),
    drv('I4', 'Training and change management', 'year0', 300_000, 'usd', DECK, { max: 1_000_000 }),
    drv('I5', 'Contingency', 'year0', 200_000, 'usd', TEAM, { max: 1_000_000 }),
  ],
  compute: (d) => ({
    costSavings: d.F1 * d.F2 * d.F3 * d.F4 + d.F5 * d.F6 * d.F7 * d.F8 + d.F9 * d.F10 * d.F11 * d.F12,
    lossAvoidance: d.L1 * d.L2 * d.L3,
    revenue: 0,
    workingCapital: 0,
    operatingCost: d.O1 + d.O2 + d.O3 * d.O4,
    residualRisk: d.X1 * d.X2 * d.X3 + d.X4,
    year0: d.I1 + d.I2 + d.I3 + d.I4 + d.I5,
    year0Integration: d.I1 + d.I2,
  }),
};

// ---------------------------------------------------------------------------
// Deferred use cases — lump-sum placeholders the team can overwrite
// ---------------------------------------------------------------------------
function deferred(
  id: UseCaseId,
  number: number,
  name: string,
  short: string,
  scores: number[],
  description: string,
  v: { cs: number; la: number; rev: number; wc: number; op: number; risk: number; y0: number },
  haircut = 0.2,
): UseCaseDef {
  return {
    id,
    number,
    name,
    short,
    defaultFunded: false,
    haircut,
    downside: STD_DOWN,
    upside: STD_UP,
    scores,
    description,
    drivers: lumpSumDrivers(v, PLACEHOLDER),
    compute: computeLumpSum,
  };
}

const contact = deferred('contact', 3, 'AI-Enabled Contact Center', 'Contact Center', [4, 4, 4, 3, 3, 4, 2, 2],
  'Agent assist and member self-service. Deferred: low staff acceptance and low differentiation.',
  { cs: 2_000_000, la: 0, rev: 300_000, wc: 0, op: 900_000, risk: 250_000, y0: 2_200_000 });
const growth = deferred('growth', 5, 'Client Growth & Personalization', 'Client Growth', [4, 3, 2, 2, 3, 3, 4, 4],
  'Next-best-product insights for client credit unions. Deferred: data not ready, slow to pilot.',
  { cs: 200_000, la: 0, rev: 2_000_000, wc: 0, op: 600_000, risk: 200_000, y0: 2_500_000 }, 0.25);
const product = deferred('product', 4, 'Product-Development Acceleration', 'Product Dev', [2, 2, 4, 4, 4, 3, 2, 4],
  'Coding and testing copilots for the product teams. Deferred: low financial and customer value.',
  { cs: 1_000_000, la: 0, rev: 300_000, wc: 0, op: 400_000, risk: 100_000, y0: 1_500_000 });
const finintel = deferred('finintel', 6, 'Finance & Profitability Intelligence', 'Finance Intel', [3, 1, 3, 2, 4, 3, 2, 4],
  'Automated close, client profitability and forecasting. Deferred: lowest scorecard average.',
  { cs: 600_000, la: 0, rev: 0, wc: 200_000, op: 300_000, risk: 50_000, y0: 1_200_000 });

/** All seven use cases in display order (funded first). */
export const USE_CASES: UseCaseDef[] = [fraud, disputes, fincrime, contact, growth, product, finintel];

export const USE_CASE_IDS: UseCaseId[] = USE_CASES.map((u) => u.id);

export function getUseCase(id: UseCaseId): UseCaseDef {
  const u = USE_CASES.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown use case ${id}`);
  return u;
}

/** Default driver values for one use case, keyed by driver id. */
export function defaultDrivers(u: UseCaseDef): Record<string, number> {
  return Object.fromEntries(u.drivers.map((d) => [d.id, d.value]));
}

export const GROUP_LABELS: Record<DriverGroup, string> = {
  savings: 'Cost savings',
  loss: 'Loss avoidance',
  revenue: 'Revenue growth',
  wc: 'Working capital',
  opex: 'Operating cost',
  risk: 'Residual risk',
  year0: 'Year-0 investment',
};
