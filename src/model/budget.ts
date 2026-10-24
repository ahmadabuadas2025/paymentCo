// The $15M, 3-year AI budget (9 categories x 3 years) from the Group 1 Portfolio Summary.

export const BUDGET_TOTAL = 15_000_000;
/** The course warns that a technology-heavy budget fails the COO. */
export const TECH_SHARE_LIMIT = 0.85;

export interface BudgetCategory {
  name: string;
  kind: 'tech' | 'people'; // people-and-controls = training, change, model risk
  note: string;
  defaults: [number, number, number]; // Year 1, 2, 3 in dollars
}

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  { name: 'Data & cloud', kind: 'tech', note: 'Shared risk-data layer across acquired platforms', defaults: [1_200_000, 800_000, 500_000] },
  { name: 'AI platform & models', kind: 'tech', note: 'One approved enterprise LLM platform; fraud models', defaults: [1_200_000, 700_000, 500_000] },
  { name: 'Workflow integration', kind: 'tech', note: 'Case management, network dispute APIs, monitoring', defaults: [2_000_000, 800_000, 500_000] },
  { name: 'Cybersecurity', kind: 'tech', note: 'Prompt-injection testing, access control, logging', defaults: [400_000, 300_000, 300_000] },
  { name: 'Model-risk management', kind: 'people', note: 'SR 26-2 validation, AI inventory, monitoring', defaults: [800_000, 400_000, 300_000] },
  { name: 'Employee training', kind: 'people', note: 'Role-based training for analysts and leads', defaults: [500_000, 400_000, 300_000] },
  { name: 'Change management', kind: 'people', note: 'Adoption team, communication, redeployment', defaults: [500_000, 400_000, 300_000] },
  { name: 'External vendors', kind: 'tech', note: 'AML scoring, document AI; two-vendor bake-off', defaults: [400_000, 300_000, 300_000] },
  { name: 'Internal AI teams', kind: 'tech', note: 'AI product owner and ML engineers', defaults: [300_000, 300_000, 300_000] },
];

export function defaultBudget(): number[][] {
  return BUDGET_CATEGORIES.map((c) => [...c.defaults]);
}

export interface BudgetSummary {
  yearTotals: number[];
  total: number;
  balanced: boolean; // sums to $15.0M (within $1)
  peopleShare: number; // training + change + model risk
  techShare: number;
  techHeavy: boolean;
}

export function summarizeBudget(budget: number[][]): BudgetSummary {
  const yearTotals = [0, 1, 2].map((y) => budget.reduce((s, row) => s + (row[y] ?? 0), 0));
  const total = yearTotals.reduce((a, b) => a + b, 0);
  const people = budget.reduce(
    (s, row, i) => s + (BUDGET_CATEGORIES[i].kind === 'people' ? row.reduce((a, b) => a + b, 0) : 0),
    0,
  );
  const peopleShare = total > 0 ? people / total : 0;
  const techShare = total > 0 ? 1 - peopleShare : 0;
  return {
    yearTotals,
    total,
    balanced: Math.abs(total - BUDGET_TOTAL) < 1,
    peopleShare,
    techShare,
    techHeavy: techShare > TECH_SHARE_LIMIT,
  };
}
