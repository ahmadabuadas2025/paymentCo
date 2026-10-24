// App shell: header, tab navigation and the active screen.
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { buildSummary, exportCsv, exportJson } from './lib/export';
import { sanitize, useScenario } from './state/ScenarioContext';
import BoardView from './screens/BoardView';
import UseCaseLab from './screens/UseCaseLab';
import PortfolioBuilder from './screens/PortfolioBuilder';
import Scenarios from './screens/Scenarios';
import ApproachesScreen from './screens/Approaches';
import PilotSimulator from './screens/PilotSimulator';
import BudgetRoadmap from './screens/BudgetRoadmap';
import Assumptions from './screens/Assumptions';

const TABS = [
  { id: 'board', label: 'Board view', el: BoardView },
  { id: 'lab', label: 'Use-case lab', el: UseCaseLab },
  { id: 'portfolio', label: 'Portfolio builder', el: PortfolioBuilder },
  { id: 'scenarios', label: 'Scenarios & sensitivity', el: Scenarios },
  { id: 'approaches', label: 'Approaches', el: ApproachesScreen },
  { id: 'pilot', label: '90-day pilot', el: PilotSimulator },
  { id: 'budget', label: 'Budget & roadmap', el: BudgetRoadmap },
  { id: 'assumptions', label: 'Assumptions', el: Assumptions },
] as const;

type TabId = (typeof TABS)[number]['id'];

function initialTab(): TabId {
  const h = window.location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? 'board') as TabId;
}

export default function App() {
  const { state, result, dispatch, dark, setDark, presenting, setPresenting } = useScenario();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPresenting(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPresenting]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const copySummary = async () => {
    const text = buildSummary(state, result);
    try {
      await navigator.clipboard.writeText(text);
      flash('Summary copied to clipboard');
    } catch {
      window.prompt('Copy the summary:', text);
    }
  };

  const importJson = async (file: File) => {
    try {
      dispatch({ type: 'load', state: sanitize(JSON.parse(await file.text())) });
      flash(`Loaded "${file.name}"`);
    } catch {
      flash('That file is not a valid scenario JSON');
    }
  };

  const Active = presenting ? BoardView : TABS.find((t) => t.id === tab)!.el;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        {!presenting && (
          <header className="sticky top-0 z-20 border-b border-black/5 bg-brand text-white shadow-sm dark:border-night-line dark:bg-[#0A2A20]">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
                  <rect width="32" height="32" rx="7" fill="#C9A227" />
                  <path d="M8 22 L14 14 L18 18 L24 9" stroke="#0F3B2E" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                <div>
                  <div className="font-serif text-lg font-bold leading-tight">PaymentCo 2030 · AI Portfolio Simulator</div>
                  <div className="text-xs text-white/70">
                    Group 1 · “Protect the Network First” · Scenario: <span className="font-semibold text-gold">{state.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={copySummary}>Copy summary</button>
                <button className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => exportJson(state)}>Export JSON</button>
                <button className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => exportCsv(state, result)}>Export CSV</button>
                <button className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => fileRef.current?.click()}>Import</button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
                <button
                  className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
                  onClick={() => setDark(!dark)}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {dark ? '☀ Light' : '☾ Dark'}
                </button>
                <button className="rounded-lg bg-gold px-3 py-1.5 font-semibold text-brand hover:brightness-105" onClick={() => setPresenting(true)}>
                  ▶ Present
                </button>
              </div>
            </div>
            <nav className="mx-auto max-w-[1440px] overflow-x-auto px-2" aria-label="Screens">
              <ul className="flex min-w-max gap-1" role="tablist">
                {TABS.map((t, i) => (
                  <li key={t.id}>
                    <button
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={`relative px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'text-white' : 'text-white/65 hover:text-white'}`}
                    >
                      <span className="mr-1 text-white/40">{i + 1}</span>
                      {t.label}
                      {tab === t.id && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-[3px] rounded-t bg-gold" />}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
        )}

        <main className={`mx-auto max-w-[1440px] px-4 ${presenting ? 'py-6' : 'py-5'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={presenting ? 'present' : tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Active />
            </motion.div>
          </AnimatePresence>
        </main>

        {!presenting && (
          <footer className="mx-auto max-w-[1440px] px-4 pb-6 text-xs text-ink-muted dark:text-[#9AA39E]">
            USF MS FinTech · AI Finance · PaymentCo 2030 case (fictional). Board presentation Nov 3, 2026. Figures are planning estimates, not forecasts.
          </footer>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg dark:bg-[#E8ECE9] dark:text-night"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
