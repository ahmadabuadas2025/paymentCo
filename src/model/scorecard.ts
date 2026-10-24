// Portfolio scorecard: 8 criteria scored 1-5 (Risk: 5 = lowest exposure).

import { USE_CASES } from './useCases';
import type { UseCaseId } from './types';

export const CRITERIA = [
  'Value',
  'Customer',
  'Speed',
  'Data',
  'Risk',
  'Scale',
  'Differentiation',
  'Staff',
] as const;

export const CRITERIA_QUESTIONS = [
  'NPV, payback speed, revenue or cost impact',
  'Would customers notice and prefer this?',
  'Can this reach a 90-day pilot?',
  'Does the data already exist and is it governed?',
  'Regulatory, reputational, and model-risk exposure (5 = lowest)',
  'Does it compound across products and clients?',
  'Would competitors struggle to copy it?',
  'Will frontline staff trust and use it?',
];

export function scoreAverage(scores: number[]): number {
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function scorecardRows(): { id: UseCaseId; name: string; scores: number[]; average: number }[] {
  return USE_CASES.map((u) => ({ id: u.id, name: u.name, scores: u.scores, average: scoreAverage(u.scores) }));
}
