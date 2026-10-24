// App state: the current scenario (a reducer), saved scenarios and presentation mode.
// Everything persists to localStorage; reads and writes are wrapped so private windows still work.
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { defaultBudget } from '../model/budget';
import { computePortfolio, defaultScenario } from '../model/portfolio';
import { getUseCase } from '../model/useCases';
import type { Approaches, Globals, PortfolioResult, ScenarioState, Sourcing, UseCaseId } from '../model/types';

export type Action =
  | { type: 'setDriver'; id: UseCaseId; key: string; value: number }
  | { type: 'resetDriver'; id: UseCaseId; key: string }
  | { type: 'resetUseCase'; id: UseCaseId }
  | { type: 'setFunded'; id: UseCaseId; value: boolean }
  | { type: 'setGlobal'; key: keyof Globals; value: number }
  | { type: 'setApproach'; patch: Partial<Omit<Approaches, 'sourcing'>> }
  | { type: 'setSourcing'; id: UseCaseId; value: Sourcing }
  | { type: 'setBudget'; row: number; year: number; value: number }
  | { type: 'resetBudget' }
  | { type: 'rename'; name: string }
  | { type: 'load'; state: ScenarioState }
  | { type: 'resetAll' };

function reducer(s: ScenarioState, a: Action): ScenarioState {
  switch (a.type) {
    case 'setDriver':
      return { ...s, drivers: { ...s.drivers, [a.id]: { ...s.drivers[a.id], [a.key]: a.value } } };
    case 'resetDriver': {
      const d = getUseCase(a.id).drivers.find((x) => x.id === a.key)!;
      return reducer(s, { type: 'setDriver', id: a.id, key: a.key, value: d.value });
    }
    case 'resetUseCase':
      return { ...s, drivers: { ...s.drivers, [a.id]: defaultScenario().drivers[a.id] } };
    case 'setFunded':
      return { ...s, funded: { ...s.funded, [a.id]: a.value } };
    case 'setGlobal':
      return { ...s, globals: { ...s.globals, [a.key]: a.value } };
    case 'setApproach':
      return { ...s, approaches: { ...s.approaches, ...a.patch } };
    case 'setSourcing':
      return { ...s, approaches: { ...s.approaches, sourcing: { ...s.approaches.sourcing, [a.id]: a.value } } };
    case 'setBudget': {
      const budget = s.budget.map((row) => [...row]);
      budget[a.row][a.year] = a.value;
      return { ...s, budget };
    }
    case 'resetBudget':
      return { ...s, budget: defaultBudget() };
    case 'rename':
      return { ...s, name: a.name };
    case 'load':
      return sanitize(a.state);
    case 'resetAll':
      return defaultScenario();
  }
}

/** Merge a possibly stale or hand-edited scenario onto the defaults so missing fields can't crash the app. */
export function sanitize(raw: unknown): ScenarioState {
  const base = defaultScenario();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ScenarioState>;
  const drivers = { ...base.drivers };
  for (const id of Object.keys(base.drivers) as UseCaseId[]) {
    const row = r.drivers?.[id];
    if (row) {
      drivers[id] = { ...base.drivers[id] };
      for (const k of Object.keys(base.drivers[id])) if (typeof row[k] === 'number' && Number.isFinite(row[k])) drivers[id][k] = row[k];
    }
  }
  const budget = Array.isArray(r.budget) && r.budget.length === base.budget.length
    ? base.budget.map((row, i) => row.map((v, y) => (typeof r.budget![i]?.[y] === 'number' ? r.budget![i][y] : v)))
    : base.budget;
  return {
    name: typeof r.name === 'string' ? r.name : base.name,
    drivers,
    funded: { ...base.funded, ...(r.funded ?? {}) },
    globals: { ...base.globals, ...(r.globals ?? {}) },
    approaches: {
      ...base.approaches,
      ...(r.approaches ?? {}),
      sourcing: { ...base.approaches.sourcing, ...(r.approaches?.sourcing ?? {}) },
    },
    budget,
  };
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export const MAX_SAVED = 4;

interface Ctx {
  state: ScenarioState;
  result: PortfolioResult;
  dispatch: React.Dispatch<Action>;
  saved: ScenarioState[];
  saveScenario: (name: string) => void;
  deleteSaved: (index: number) => void;
  presenting: boolean;
  setPresenting: (v: boolean) => void;
}

const ScenarioCtx = createContext<Ctx | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => sanitize(readStorage('pc-current', null)));
  const [saved, setSaved] = useState<ScenarioState[]>(() => readStorage<unknown[]>('pc-scenarios', []).map(sanitize).slice(0, MAX_SAVED));
  const [presenting, setPresenting] = useState(false);

  const result = useMemo(() => computePortfolio(state), [state]);

  useEffect(() => writeStorage('pc-current', state), [state]);
  useEffect(() => writeStorage('pc-scenarios', saved), [saved]);

  const saveScenario = (name: string) => {
    const snapshot = { ...state, name };
    dispatch({ type: 'rename', name });
    setSaved((list) => {
      const i = list.findIndex((x) => x.name === name);
      if (i >= 0) return list.map((x, j) => (j === i ? snapshot : x));
      return [...list, snapshot].slice(-MAX_SAVED);
    });
  };
  const deleteSaved = (index: number) => setSaved((list) => list.filter((_, i) => i !== index));

  return (
    <ScenarioCtx.Provider value={{ state, result, dispatch, saved, saveScenario, deleteSaved, presenting, setPresenting }}>
      {children}
    </ScenarioCtx.Provider>
  );
}

export function useScenario(): Ctx {
  const c = useContext(ScenarioCtx);
  if (!c) throw new Error('useScenario must be used inside ScenarioProvider');
  return c;
}
