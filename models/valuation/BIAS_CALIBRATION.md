# Model correction, method 2.3.0

Run `npx tsx --tsconfig tsconfig.json scripts/calibrate.ts --local-db` with Node 22,
PROVIDERS unset and explicit local DATABASE_URL. Migration 0005 is required.
The command uses stored samples and WA sales only, writes the JSON fallback and
monthly accuracy report, and publishes guarded corrections to the local DB.
The authenticated monthly cron uses the same fitter and row lock. Invalid/old
DB snapshots fall back to the versioned committed JSON; other DB errors propagate.

Fit current-month unique listings against the uncorrected surface (G=0). The
primary unit is canonical make/model/generation. Use median log(private-equivalent
ask / surface) and MAD residual spread. Median sampling variance is approximated
by pi/2 × robust spread squared / n. Segment pooling uses family median precision
weights capped by a 0.01 variance floor. Between-family variance is estimated
empirically after subtracting within-family variance, with a 0.0025 floor.
Segment means shrink toward log(1) under a 0.15 log-scale prior; family medians
shrink toward that segment estimate by between/(between + sampling variance).

Family median intervals are deterministic 300-resample percentile bootstrap 80%
intervals. Factors stay in [0.75,1.25] unless n>=100 and both CI bounds are within
10% of the raw median, permitting [0.5,2]. Segment fallback stays in [0.75,1.25].
Low/high mileage thirds report residual change per 10k miles and flag separated
80% intervals with >10% log change and >=20k mileage separation. These are
confounded diagnostics, not fitted mileage slopes or a causal mileage adjustment.

Five-fold listing CV balances observations within each family. Families with
fewer than five listings are excluded from seen-family error metrics. Separately,
segment-stratified greedy five-fold family holdout evaluates segment fallback on
never-seen generations. Large indivisible families prevent exact fold balance.
Family cells require improving median and non-worsening p80 listing CV errors.
Segment fallback requires at least three families and improving family-holdout
median with non-worsening p80. Guarded predictions are re-evaluated out of fit;
publication also requires overall improvement over neutral and previous active
corrections. Empty/failed months retain the previous snapshot. Guards reuse CV:
this is validation, not an independent final test. Raw and guarded CV are saved.

Only model mode applies the family factor (or accepted segment fallback, else 1)
after the surface, before condition/history adjustments. Comps are market prices
and receive no correction; comp surface normalization also remains uncorrected.
Historical appraisals retain their audit, method version and snapshot timestamp.

Dealer conversion defaults to 0.90. WA overlap needs contemporaneous canonical
make/model/year/10k-mile/month cells, >=5 rows per source/cell, >=10 cells and
>=5 independent EV models with plausible tight family ratios before replacing it.
WA trim/geography limitations and dealer asks versus transactions remain explicit.
Monthly reports include CV, segment/age metrics, mileage diagnostics and drift.
Matching diagnostics list make/model/trim counts, years and exclusion reasons.
