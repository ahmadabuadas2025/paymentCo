// Screen 1 — Board view: headline KPIs, the portfolio value waterfall and the NPV range.
import { RangeBar, Waterfall } from '../components/charts';
import { Card, ChartCard, KpiTile, StatusPill } from '../components/ui';
import { fmtM, fmtMonths, fmtPct } from '../lib/format';
import { summarizeBudget } from '../model/budget';
import { getUseCase } from '../model/useCases';
import { useScenario } from '../state/ScenarioContext';

export default function BoardView() {
  const { state, result, presenting, setPresenting } = useScenario();
  const t = result.totals;
  const budget = summarizeBudget(state.budget);
  const big = presenting;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">PaymentCo 2030 · Board of Directors · Nov 3, 2026</p>
          <h1 className={`font-bold text-brand dark:text-[#E8ECE9] ${big ? 'text-5xl' : 'text-3xl'}`}>Protect the Network First</h1>
          <p className={`muted mt-1 ${big ? 'text-xl' : ''}`}>
            Fund {result.funded.map((r) => getUseCase(r.id).short).join(', ') || 'nothing yet'} with {fmtM(t.year0)} of Year-0 investment from a $15.0M, 3-year AI budget.
          </p>
        </div>
        {presenting ? (
          <button className="btn" onClick={() => setPresenting(false)}>✕ Exit presentation (Esc)</button>
        ) : (
          <button className="btn-primary" onClick={() => setPresenting(true)}>▶ Presentation mode</button>
        )}
      </div>

      <div className={`grid gap-4 ${big ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-5'}`}>
        <KpiTile big={big} label="3-yr portfolio NPV" value={t.npv} format={(v) => fmtM(v, 2)}
          tone={t.npv > 0 ? 'good' : 'bad'} toneLabel={t.npv > 0 ? 'Creates value' : 'Destroys value'}
          info="Σ over funded use cases of Net × Σ 1/(1+r)^t − Year-0, at the discount rate on the Scenarios tab." />
        <KpiTile big={big} label="Portfolio payback" value={t.payback} format={fmtMonths}
          tone={t.payback <= 12 ? 'good' : 'bad'} toneLabel={t.payback <= 12 ? 'Under 12 months' : 'Over 12 months'}
          info="Total Year-0 investment ÷ total net annual value × 12." />
        <KpiTile big={big} label="Risk-adjusted ROI" value={t.riskAdjRoi} format={(v) => fmtPct(v)}
          tone={t.riskAdjRoi > 0 ? 'good' : 'bad'} note={`Risk-adj NPV ${fmtM(t.riskAdjNpv, 2)}`}
          info="Σ risk-adjusted NPV ÷ Σ Year-0. Haircut 20% (Fraud, Disputes), 25% (Fin Crime, high-risk tier)." />
        <KpiTile big={big} label="Net value per year" value={t.net} format={(v) => fmtM(v, 2)}
          note="savings + losses avoided + revenue + working capital − run cost − risk"
          info="Net Annual AI Value summed across funded use cases." />
        <KpiTile big={big} label="Cost of delay / quarter" value={t.costOfDelayQuarter} format={(v) => fmtM(v, 2)}
          tone="bad" toneLabel="Forgone value"
          info="Net annual value × 3 / 12: what a one-quarter slip gives up." />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title="Where the annual value comes from" subtitle="Portfolio AI value formula: green adds value, red subtracts it, the dark bar is the net.">
          <Waterfall components={t.components} height={big ? 360 : 300} />
        </ChartCard>
        <ChartCard className="lg:col-span-2" title="NPV range: downside, base, upside" subtitle="Downside: benefits −40%, investment +20–25%. Upside: benefits +30%, investment −10%.">
          <div className="px-2 pt-4">
            <RangeBar down={t.downsideNpv} base={t.npv} up={t.upsideNpv} riskAdj={t.riskAdjNpv} big={big} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {result.funded.map((r) => (
              <div key={r.id} className="rounded-lg bg-cream p-2 dark:bg-night">
                <div className="label">{getUseCase(r.id).short}</div>
                <div className={`font-serif font-bold ${big ? 'text-2xl' : 'text-lg'}`}>{fmtM(r.npv, 2)}</div>
                <div className="text-xs text-ink-muted">payback {fmtMonths(r.payback)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm">
            <span className="inline-block h-4 w-0.5 bg-gold" aria-hidden="true" />
            Gold tick: risk-adjusted NPV <strong className="tabular-nums">{fmtM(t.riskAdjNpv, 2)}</strong>
          </p>
          <p className="muted mt-1 text-sm">
            {t.downsideNpv > 0
              ? 'Even the downside case returns more than it costs.'
              : 'Warning: the downside case loses money. Consider gating spend.'}
          </p>
        </ChartCard>
      </div>

      {!presenting && (
        <Card title="Board checklist" subtitle="The three things the board will ask about, and where this scenario stands.">
          <ul className="grid gap-3 text-sm md:grid-cols-3">
            <li className="flex items-start gap-2">
              <StatusPill ok={budget.balanced} okText="Balanced" badText="Off" />
              <span>Budget totals {fmtM(budget.total)} of $15.0M ({fmtPct(budget.peopleShare)} on people and controls).</span>
            </li>
            <li className="flex items-start gap-2">
              <StatusPill ok={t.year0 <= 15_000_000} okText="Within budget" badText="Over" />
              <span>Year-0 builds use {fmtM(t.year0)}; {fmtM(15_000_000 - t.year0)} stays in reserve for scale-up.</span>
            </li>
            <li className="flex items-start gap-2">
              <StatusPill ok={t.downsideNpv > 0} okText="Resilient" badText="At risk" />
              <span>Downside NPV {fmtM(t.downsideNpv, 2)}; risk-adjusted NPV {fmtM(t.riskAdjNpv, 2)}.</span>
            </li>
          </ul>
        </Card>
      )}
    </div>
  );
}
