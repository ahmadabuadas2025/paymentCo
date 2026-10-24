// Optional cross-check against the class workbook (SheetJS).
// Skipped automatically if AI_Portfolio_Scorecard_Group1.xlsx is not in the project folder.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { computePortfolio, defaultScenario } from './portfolio';
import { summarizeBudget } from './budget';

const FILE = 'AI_Portfolio_Scorecard_Group1.xlsx';
const present = existsSync(FILE);

describe.skipIf(!present)('cross-check against AI_Portfolio_Scorecard_Group1.xlsx', () => {
  const wb = present ? XLSX.read(readFileSync(FILE)) : null;
  const sheet = wb?.Sheets['Group 1 Portfolio Summary'];
  const cell = (ref: string) => Number(sheet?.[ref]?.v);
  const state = defaultScenario();
  const result = computePortfolio(state);
  const find = (id: string) => result.useCases.find((x) => x.id === id)!;

  // Rows 5-7 of the summary sheet: Fraud, Disputes, Fin Crime. Row 8 is the portfolio.
  const rows = [
    { row: 5, r: find('fraud') },
    { row: 6, r: find('disputes') },
    { row: 7, r: find('fincrime') },
  ];

  it('per-use-case Year-0, net, NPV, payback, risk-adjusted, downside and upside', () => {
    for (const { row, r } of rows) {
      expect(r.year0).toBeCloseTo(cell(`C${row}`), 2);
      expect(r.net).toBeCloseTo(cell(`D${row}`), 2);
      expect(r.npv).toBeCloseTo(cell(`E${row}`), 2);
      expect(r.payback).toBeCloseTo(cell(`F${row}`), 6);
      expect(r.riskAdjNpv).toBeCloseTo(cell(`G${row}`), 2);
      expect(r.riskAdjRoi).toBeCloseTo(cell(`H${row}`), 6);
      expect(r.downsideNpv).toBeCloseTo(cell(`I${row}`), 2);
      expect(r.upsideNpv).toBeCloseTo(cell(`J${row}`), 2);
    }
  });

  it('portfolio totals', () => {
    const t = result.totals;
    expect(t.year0).toBeCloseTo(cell('C8'), 2);
    expect(t.net).toBeCloseTo(cell('D8'), 2);
    expect(t.npv).toBeCloseTo(cell('E8'), 2);
    expect(t.payback).toBeCloseTo(cell('F8'), 6);
    expect(t.riskAdjNpv).toBeCloseTo(cell('G8'), 2);
    expect(t.riskAdjRoi).toBeCloseTo(cell('H8'), 6);
    expect(t.downsideNpv).toBeCloseTo(cell('I8'), 2);
    expect(t.upsideNpv).toBeCloseTo(cell('J8'), 2);
  });

  it('budget table and people-and-controls share', () => {
    state.budget.forEach((row, i) => {
      row.forEach((v, y) => expect(v).toBe(cell(`${'BCD'[y]}${13 + i}`)));
    });
    const s = summarizeBudget(state.budget);
    expect(s.total).toBe(cell('E22'));
    expect(s.peopleShare).toBeCloseTo(cell('E23'), 6);
  });
});
