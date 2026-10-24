// Exports: scenario JSON / CSV, chart PNG and the 5-line memo summary.
import { toPng } from 'html-to-image';
import { BUDGET_CATEGORIES, summarizeBudget } from '../model/budget';
import { USE_CASES, getUseCase } from '../model/useCases';
import type { PortfolioResult, ScenarioState } from '../model/types';
import { fmtM, fmtMonths, fmtPct } from './format';

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';

export function exportJson(state: ScenarioState) {
  download(`paymentco-${slug(state.name)}.json`, new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with three sections: results, every input, and the budget. */
export function exportCsv(state: ScenarioState, result: PortfolioResult) {
  const rows: (string | number)[][] = [];
  rows.push(['Scenario', state.name]);
  rows.push([]);
  rows.push(['RESULTS', 'Funded', 'Year-0', 'Net/yr', '3-yr NPV', 'Payback (mo)', 'Risk-adj NPV', 'Risk-adj ROI', 'Downside NPV', 'Upside NPV']);
  for (const r of result.useCases) {
    rows.push([getUseCase(r.id).name, r.funded ? 'yes' : 'no', r.year0, r.net, r.npv, r.payback, r.riskAdjNpv, r.riskAdjRoi, r.downsideNpv, r.upsideNpv]);
  }
  const t = result.totals;
  rows.push(['Portfolio', '', t.year0, t.net, t.npv, t.payback, t.riskAdjNpv, t.riskAdjRoi, t.downsideNpv, t.upsideNpv]);
  rows.push([]);
  rows.push(['INPUTS', 'Driver', 'Label', 'Value', 'Default', 'Changed', 'Source']);
  for (const u of USE_CASES) {
    for (const d of u.drivers) {
      const v = state.drivers[u.id][d.id];
      rows.push([u.name, d.id, d.label, v, d.value, v !== d.value ? 'yes' : 'no', d.source]);
    }
  }
  rows.push([]);
  rows.push(['GLOBALS', ...Object.keys(state.globals)]);
  rows.push(['', ...Object.values(state.globals)]);
  rows.push(['APPROACHES', 'Pilot first', state.approaches.pilotFirst, 'Human review', state.approaches.humanReview, 'Shared data layer', String(state.approaches.sharedDataLayer)]);
  rows.push(['SOURCING', ...USE_CASES.map((u) => `${u.short}: ${state.approaches.sourcing[u.id]}`)]);
  rows.push([]);
  rows.push(['BUDGET', 'Year 1', 'Year 2', 'Year 3']);
  state.budget.forEach((row, i) => rows.push([BUDGET_CATEGORIES[i].name, ...row]));
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  download(`paymentco-${slug(state.name)}.csv`, new Blob([csv], { type: 'text/csv' }));
}

export async function exportPng(node: HTMLElement, name: string) {
  const bg = getComputedStyle(document.body).backgroundColor;
  const dataUrl = await toPng(node, { backgroundColor: bg, pixelRatio: 2 });
  const blob = await (await fetch(dataUrl)).blob();
  download(`${slug(name)}.png`, blob);
}

/** Five lines for the board memo. */
export function buildSummary(state: ScenarioState, result: PortfolioResult): string {
  const t = result.totals;
  const funded = result.funded.map((r) => getUseCase(r.id).short).join(' + ');
  const budget = summarizeBudget(state.budget);
  const g = state.globals;
  return [
    `PaymentCo 2030 — "${state.name}" scenario: fund ${funded} (Year-0 ${fmtM(t.year0)} of the $15.0M budget).`,
    `Net annual AI value ${fmtM(t.net)}; 3-year NPV ${fmtM(t.npv)} at ${fmtPct(g.discountRate)}; portfolio payback ${fmtMonths(t.payback)}.`,
    `Risk-adjusted NPV ${fmtM(t.riskAdjNpv)} (ROI ${fmtPct(t.riskAdjRoi)}); downside ${fmtM(t.downsideNpv)} to upside ${fmtM(t.upsideNpv)}.`,
    `Every quarter of delay costs ${fmtM(t.costOfDelayQuarter)} in forgone value; Year-1 adoption ramp ${fmtPct(g.adoptionRamp)}, delay ${g.delayMonths} mo.`,
    `Budget ${fmtM(budget.total)} with ${fmtPct(budget.peopleShare)} on people and controls; first 90-day pilot: ${state.approaches.pilotFirst === 'disputes' ? 'Disputes' : 'Fraud'}.`,
  ].join('\n');
}
