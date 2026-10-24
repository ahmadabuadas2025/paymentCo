# PaymentCo 2030 · AI Portfolio Simulator

An interactive, animated dashboard for Group 1's **"Protect the Network First"** AI portfolio
(USF MS FinTech, AI Finance course, PaymentCo 2030 case). PaymentCo has a **$15M, 3-year AI budget**;
we fund **#1 Fraud & Scam Prevention**, **#2 Disputes & Exception Management** and
**#7 Financial Crime & Model Governance**, defer the other four, and pilot **Disputes** first.

Change any assumption and the NPV, payback, risk-adjusted ROI, charts and pilot gates update instantly.
It is built for live use during the board Q&A on **Nov 3, 2026**.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: acceptance table + workbook cross-check
npm run build      # static site in dist/ (host anywhere, or `npm run preview` to view it locally)
```

Requires Node 18 or newer. The build uses relative paths, so `dist/` works from any folder on a static host
(GitHub Pages, Netlify, S3). Browsers block module scripts on `file://`, so serve it rather than double-clicking. There is no backend: all state lives in the browser, and saved scenarios go to
`localStorage`.

**Optional workbook check:** put `AI_Portfolio_Scorecard_Group1.xlsx` in the project root and `npm test`
will parse it with SheetJS and compare every figure on the *Group 1 Portfolio Summary* sheet. The file is
git-ignored; the test is skipped when the file is absent.

## Screens

| # | Screen | What it does |
|---|---|---|
| 1 | **Board view** | Count-up KPI tiles (NPV, payback, risk-adjusted ROI, net value/yr, cost of delay per quarter), value waterfall, downside/base/upside range. **Presentation mode** hides the controls and enlarges the type (Esc to exit). |
| 2 | **Use-case lab** | Every driver for each use case as slider + number input, with its source in a tooltip. Changed inputs are highlighted gold with a reset; live mini-waterfall and metrics. |
| 3 | **Portfolio builder** | Fund or defer any of the 7 use cases; Year-0 vs the $15M and the remaining reserve; payback-vs-NPV bubble chart; scorecard radar; lump-sum inputs for the deferred use cases. |
| 4 | **Scenarios & sensitivity** | Global levers; ±20% tornado (top 10 drivers); Monte Carlo (1,000–10,000 draws) with animated histogram, P10/P50/P90 and P(NPV < 0); save, name and compare up to 4 scenarios, plus presets. |
| 5 | **Approaches** | Build vs buy per use case, pilot order, human-review level, shared data layer, each with its documented effect and NPV impact. |
| 6 | **90-day pilot** | Animated dispute flow (Automate / Augment / Escalate / Humans only), live cycle-time, rework and override charts, Day 30/60/90 gates, STOP banner. |
| 7 | **Budget & roadmap** | Editable 9×3 budget with live $15.0M check, people-and-controls share, tech-heavy warning, stacked bars, animated gated funding timeline. |
| 8 | **Assumptions** | Every input with value, default, source and changed status; a summary of everything that differs from the base case. |

**Header actions:** Copy summary (5 lines for the memo), Export JSON, Export CSV, Import JSON, Present. Every chart card has a **PNG** button.

## The financial model (`src/model/`)

All financial logic is pure TypeScript with no React, so it can be tested directly.

| File | Contents |
|---|---|
| `finance.ts` | The formulas below |
| `useCases.ts` | The 7 use cases: drivers, defaults, sources, and the driver → value-line formulas |
| `portfolio.ts` | Applies approach switches and global levers, then sums the portfolio |
| `budget.ts` / `scorecard.ts` | $15M budget and the 8-criterion scorecard |
| `sensitivity.ts` | Tornado, seeded Monte Carlo, histogram |
| `pilot.ts` | The 90-day pilot simulation |

### Formulas (per use case)

```
Net Annual AI Value = Cost Savings + Loss Avoidance + Revenue Growth + Working-Capital Benefit
                      − Operating Cost − Expected Residual Risk Cost
3-yr NPV            = Net × Σ_{t=1..3} 1/(1+r)^t − Year-0 Investment          (r = 10% default)
Payback (months)    = Year-0 / Net × 12
Risk-adjusted NPV   = Net × (1 − haircut) × Σ 1/(1+r)^t − Year-0
Risk-adjusted ROI   = Risk-adjusted NPV / Year-0
Scenario NPV        = Net × (1 + benefitAdj) × Σ 1/(1+r)^t − Year-0 × (1 + investAdj)
Cost of delay       = Net × months / 12
```

Portfolio = sum over funded use cases. Portfolio payback = Σ Year-0 / Σ Net × 12.
Portfolio risk-adjusted ROI = Σ risk-adjusted NPV / Σ Year-0.

### Use cases

- **#1 Fraud** (professor's worked example, lump sums): savings $1.2M, loss avoidance $4.5M, revenue $1.0M,
  opex $1.5M, residual risk $0.3M, Year-0 $3.0M, haircut 20%; downside −40% / +20%, upside +30% / −10%.
- **#2 Disputes** (professor's driver model):
  savings `D1·D2·D3·D4 + D5·D6·D7·D8`; loss `D1·L1·L3·L4`; revenue `R1·R2`;
  working capital `(D1·L1)·W1·(W2−W3)/365·r`; opex `O1·(D1·D3 + D5·D7) + O3 + O4·O5`;
  risk `(D1·D3 + D5·D7)·X1·X2 + X3`; Year-0 $2.5M; haircut 20%; downside −40% / +25%.
- **#7 Financial Crime & Model Governance** (team driver model):
  savings `F1·F2·F3·F4 + F5·F6·F7·F8 + F9·F10·F11·F12`; loss `L1·L2·L3`; opex `O1 + O2 + O3·O4`;
  risk `X1·X2·X3 + X4`; Year-0 $1.8M; haircut 25% (high-risk tier); downside −40% / +25%.

### Acceptance (base case; enforced by `src/model/portfolio.test.ts`)

| | Net / yr | 3-yr NPV | Payback | Downside NPV | Upside NPV |
|---|---|---|---|---|---|
| Fraud | $4.90M | $9.19M | 7.3 mo | $3.71M | $13.14M |
| Disputes | $3.79M | $6.93M | 7.9 mo | $2.53M | $10.01M |
| Fin Crime | $1.17M | $1.10M | 18.5 mo | −$0.51M | $2.16M |
| **Portfolio** | **$9.86M** | **$17.22M** | **8.9 mo** | **$5.74M** | **$25.31M** |

Portfolio risk-adjusted NPV $12.17M; risk-adjusted ROI 167%.

### Levers and switches (all neutral at default, so the base case is unchanged)

| Control | Effect |
|---|---|
| Discount rate | `r` everywhere, including the Disputes working-capital line |
| Haircut change | Added to every use case's haircut |
| Benefit / investment adjustment | Scales every net value / Year-0 |
| Adoption ramp | Share of value reached in Year 1 (Years 2–3 = 100%). The pilot-first use case reaches the ramp; later ones reach ramp² |
| Months of delay | Removes months/12 of Year-1 value |
| Buy (per use case) | Year-0 × 0.7, operating cost × 1.25, +20 pts Year-1 adoption |
| Pilot order | Which use case leads the ramp (Disputes or Fraud) |
| Human review | Every case: ×1 / ×1. Sampled: opex × 0.9, risk × 1.4. Auto-route low-risk: opex × 0.8, risk × 2.0 |
| Shared data layer | Use cases after the pilot need 15% less integration + data Year-0 (I1 + I2; half of Year-0 for lump-sum cases) |

### Monte Carlo

Each driver of each funded use case gets an independent triangular multiplier. Value drivers use the
benefit bounds (for example 0.6× / 1× / 1.3×); cost drivers use the investment bounds (0.9× / 1× / 1.2–1.25×).
Shares are capped at 100%. Runs are seeded, so the same inputs give the same chart.

Note: the downside bounds are wider than the upside bounds and several drivers are multiplied together,
so the simulated median sits below the base case.

### 90-day pilot model (illustrative, not from the workbook)

- AI coverage = 1.45 − confidence threshold (85% → 60% of disputes, matching driver D3)
- Learning curve L = 1 − e^(−day/18); AI-assisted share = coverage × L
- Escalated share = 8% + 15% × (1 − coverage)
- Effort per case: manual 1.0, AI-assisted 0.35 (+0.5 × override rate), escalated 1.8; capacity = analysts × 31
- Cycle time = (3.0 − 3.0 × AI share) handling days + 0.36 × ρ/(1−ρ) queue days + backlog / capacity
- Rework = 18% × (1 − 1.1 × AI share × quality) + rush penalty (load > 90%) + rubber-stamp penalty (overrides < 2%)
- Reg E miss when cycle time > 8 days
- **Stop rules:** a Reg E miss; override rate outside 2–25% (after Day 7); 7-day average rework rising by more than 0.5 pt (after Day 14)
- **Gates:** Day 30 (cycle ≤ 4 d, rework ≤ 12%), Day 60 (≤ 3 d, ≤ 10%), Day 90 (≤ 2 d, ≤ 8%)

Defaults (300 disputes/day, 85% threshold, 12 analysts, 10% override tendency) go from about 5.1 days to 1.9 days
and from 18% to 6.6% rework, passing all three gates.

## Team greeter

Every time you switch the main tab, the next Group 1 member (Ahmad → Nicholas → Bolotbek → Huei-En) pops up in the
bottom-right corner for 5 seconds saying "Hi, I am …" (click to dismiss; hidden in presentation mode).
The character images go in `public/team/` (`ahmad.png`, `nicholas.png`, `bolotbek.png`, `huei-en.png`).
They are **git-ignored** because they are stock / clip-art without a licence for a public repo; without them the
greeter shows each member's initials instead.

## Design notes

- Brand: deep green `#0F3B2E`, cream `#F6F5EF`, gold `#C9A227`; red for stop states. The app is dark-mode only.
- Status always pairs colour with an icon and a word (✓ / ✕ / ▲ / ▼).
- Chart hues were checked for colour-blind separation and contrast in both themes.
- Animations run for 300–600 ms and respect `prefers-reduced-motion`.
- The layout is designed for a 1280×720 projector.

## Assumptions added by this simulator

1. Deferred use cases (Contact Center, Client Growth, Product Dev, Finance Intel) use **team placeholder** lump sums; replace them with your classmates' numbers.
2. The adoption ramp, pilot-order lag (ramp²), buy effects (×0.7 Year-0, ×1.25 opex, +20 pts ramp), human-review multipliers and the 50% integration share for lump-sum use cases are **team assumptions** made for this tool.
3. Payback uses the brief's formula (Year-0 / Net × 12) and ignores the ramp.
4. Monte Carlo draws are independent (no correlation between drivers).
5. The pilot simulator is an illustrative operations model calibrated to the case targets, not a forecast.
