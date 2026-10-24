// 90-day Disputes pilot simulator.
//
// This is an illustrative operations model (not from the workbook) built to show how the
// pilot gates behave. It is deterministic for a given seed so the board sees the same run.
//
//   - AI coverage: share of disputes whose AI confidence clears the threshold.
//     coverage = 1.45 − threshold, so a 0.85 threshold covers 60% (matches driver D3).
//   - Learning: the model and the team mature over time: L(day) = 1 − e^(−day/18).
//   - Workload: AI-assisted cases take 35% of the manual effort (plus extra work when the
//     analyst overrides), escalated cases take 1.8x. Capacity = analysts × 31 cases/day.
//   - Cycle time = handling days + queue days. Queue days follow a simple queueing curve
//     ρ/(1−ρ); if demand exceeds capacity, a backlog builds and adds waiting time.
//   - Rework falls as more cases get good AI evidence, rises if analysts are rushed (ρ > 0.9)
//     or rubber-stamp the AI (override rate under 2%).
//   - A Reg E deadline is missed when cycle time passes 8 days (simulated).

import { mulberry32 } from './sensitivity';

export interface PilotParams {
  dailyVolume: number; // disputes per day in the pilot queue
  confidenceThreshold: number; // 0.5 - 0.99
  analysts: number;
  overrideRate: number; // analysts' baseline tendency to override the AI (0 - 0.5)
}

export const DEFAULT_PILOT: PilotParams = {
  dailyVolume: 300,
  confidenceThreshold: 0.85,
  analysts: 12,
  overrideRate: 0.1,
};

export const PILOT_TARGETS = {
  baselineCycle: 5.2,
  targetCycle: 2,
  baselineRework: 0.18,
  targetRework: 0.08,
  overrideLow: 0.02,
  overrideHigh: 0.25,
  regEDays: 8,
};

/** Gate criteria at Day 30, 60 and 90. */
export const GATES = [
  { day: 30, maxCycle: 4.0, maxRework: 0.12, label: 'Day 30: workflow stable' },
  { day: 60, maxCycle: 3.0, maxRework: 0.1, label: 'Day 60: value showing' },
  { day: 90, maxCycle: 2.0, maxRework: 0.08, label: 'Day 90: scale decision' },
];

export interface PilotDay {
  day: number;
  volume: number;
  aiShare: number; // share of disputes AI-assisted
  escalatedShare: number; // share sent to the specialist lane
  utilization: number; // demand / capacity
  cycleTime: number; // days
  rework: number; // share of cases reworked
  overrideRate: number; // observed analyst override rate
  regEMisses: number; // cases past the simulated Reg E deadline
  backlog: number;
}

export type StopReason = 'rework-rising' | 'override-out-of-band' | 'reg-e-miss';

export interface GateResult {
  day: number;
  label: string;
  pass: boolean;
  reasons: string[];
}

export interface PilotRun {
  days: PilotDay[];
  gates: GateResult[];
  stop: { day: number; reason: StopReason; message: string } | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Simulate the full 90 days. The UI reveals the result day by day. */
export function simulatePilot(p: PilotParams, seed = 90): PilotRun {
  const rand = mulberry32(seed);
  const capacityPerAnalyst = 31;
  const days: PilotDay[] = [];
  let backlog = 0;

  for (let day = 1; day <= 90; day++) {
    const learning = 1 - Math.exp(-day / 18);
    const coverage = clamp(1.45 - p.confidenceThreshold, 0.1, 0.95);
    const aiShare = coverage * learning;
    const escalatedShare = 0.08 + (1 - coverage) * 0.15;

    // Observed overrides: lower thresholds send weaker recommendations, so more overrides;
    // trust builds as the model learns.
    const noise = 1 + (rand() - 0.5) * 0.08;
    const overrideRate = clamp(
      p.overrideRate * (1 + (0.85 - p.confidenceThreshold) * 2.5) * (1 - 0.35 * learning) * noise,
      0,
      1,
    );

    // Workload in "manual-case equivalents".
    const volume = Math.round(p.dailyVolume * (1 + (rand() - 0.5) * 0.1));
    const aiUnits = 0.35 + overrideRate * 0.5;
    const unitsPerCase = escalatedShare * 1.8 + (1 - escalatedShare) * (aiShare * aiUnits + (1 - aiShare));
    const capacity = Math.max(1, p.analysts) * capacityPerAnalyst;
    const demand = volume * unitsPerCase;
    backlog = Math.max(0, backlog + demand - capacity);
    const utilization = demand / capacity;

    const rho = Math.min(utilization, 0.95);
    const handlingDays = 3.0 - 3.0 * aiShare;
    const queueDays = 0.36 * (rho / (1 - rho)) + backlog / capacity;
    const cycleTime = handlingDays + queueDays;

    // Rework: AI evidence quality depends on the confidence threshold.
    const quality = clamp(0.3 + (p.confidenceThreshold - 0.5) * 1.9, 0.2, 1.1);
    const rushPenalty = Math.max(0, utilization - 0.9) * 0.5;
    const rubberPenalty = overrideRate < PILOT_TARGETS.overrideLow ? (PILOT_TARGETS.overrideLow - overrideRate) * 3 : 0;
    const rework = clamp(PILOT_TARGETS.baselineRework * (1 - 1.1 * aiShare * quality) + rushPenalty + rubberPenalty, 0.01, 0.6);

    const regEMisses = cycleTime > PILOT_TARGETS.regEDays ? Math.round(volume * Math.min(1, (cycleTime - PILOT_TARGETS.regEDays) * 0.05)) : 0;

    days.push({ day, volume, aiShare, escalatedShare, utilization, cycleTime, rework, overrideRate, regEMisses, backlog });
  }

  // Stop rules: first day any one fires.
  let stop: PilotRun['stop'] = null;
  for (const d of days) {
    if (d.regEMisses > 0) {
      stop = { day: d.day, reason: 'reg-e-miss', message: `Reg E deadline missed on Day ${d.day} (${d.regEMisses} cases)` };
    } else if (d.day >= 7 && (d.overrideRate < PILOT_TARGETS.overrideLow || d.overrideRate > PILOT_TARGETS.overrideHigh)) {
      stop = { day: d.day, reason: 'override-out-of-band', message: `Override rate ${(d.overrideRate * 100).toFixed(1)}% is outside the 2–25% safe zone (Day ${d.day})` };
    } else if (d.day >= 14) {
      const recent = avg(days.slice(d.day - 7, d.day).map((x) => x.rework));
      const prior = avg(days.slice(d.day - 14, d.day - 7).map((x) => x.rework));
      if (recent > prior + 0.005) {
        stop = { day: d.day, reason: 'rework-rising', message: `Rework is rising: 7-day average ${(recent * 100).toFixed(1)}% vs ${(prior * 100).toFixed(1)}% (Day ${d.day})` };
      }
    }
    if (stop) break;
  }

  const gates: GateResult[] = GATES.map((g) => {
    const d = days[g.day - 1];
    const reasons: string[] = [];
    if (d.cycleTime > g.maxCycle) reasons.push(`Cycle time ${d.cycleTime.toFixed(1)}d > ${g.maxCycle}d`);
    if (d.rework > g.maxRework) reasons.push(`Rework ${(d.rework * 100).toFixed(1)}% > ${(g.maxRework * 100).toFixed(0)}%`);
    if (stop && stop.day <= g.day) reasons.push('Stop rule fired');
    return { day: g.day, label: g.label, pass: reasons.length === 0, reasons };
  });

  return { days, gates, stop };
}
