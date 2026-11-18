# Valuation 2.1 calibration update

Production now uses family-separated market calibration. See [calibration report](../../scripts/reference/calibration/REPORT.md) for fitted parameters, holdout tables, measured intervals, exclusions, and remaining limitations. The 2.0 notes below are historical: their retention priors, model interval constants, uncalibrated labeling and command results are superseded. No appreciation or second desirability uplift was introduced.

# Valuation 2.0 implementation and validation notes

The pure surface is `H = MSRP * CPI(asOf)/CPI(msrpModelYear) * R(age,D) * exp(L)`.
Year-range anchors are CPI-shifted to the vehicle model year and then to as-of;
this simplifies to the quoted anchor year's denominator. No second inflation index.
D uses weights E=.25, P=.20, L=.15, I=.20, T=.10, B=.05, H=.05.
Missing facts contribute zero and reduce evidence coverage; missing production counts
never establish scarcity. Only documented US-generation production counts qualify.
Manual preference requires confirmed transmission, not an MSRP row's optional manual.

`f=.12-.04D`, `k=(.14-.06D)*makeSegmentK`,
`F=(.12+.32D²)*makeSegmentF`, `a0=25-10D`,
`g=.03*clamp((D-.60)/.40,0,1)*G`.
Plateau requires D>.60, coverage>=.75 and resolved generation/variant.
R uses the spec exponential decay to F and plateau at a0, with conservative
2x growth and 3x retention limits. G=0 never appreciates.
An evidence-backed config entry keyed by exact make/model/generation may override
onset age, onset retention, growth, growth cap and retention cap; it is honored only
when the generation has G=1 and the override includes source URLs. Onset retention
rescales the continuous eligible curve, rather than introducing a discontinuous jump.
No production override is enabled: URL presence alone is not empirical validation.

Mileage uses the spec shifted-log elasticity with 10k offset, 40k threshold,
12k/year reference use (1-.75D), age saturation at 15, beta=.12+.28D²,
eta=.20D²*min(age/10,1), and caps interpolating from 1.35x to 2.5x.
Residual option effects Q remain zero because the fixed schema provides no validated
paint/package coefficient registry. Own-trim MSRP is never multiplied by equipment tier.

Make/segment retention priors (k multiplier, F multiplier): Toyota midsize (.65,1.5),
Honda midsize (.72,1.4), Lexus luxury (.78,1.4), Toyota SUV (.72,1.5),
Toyota truck (.65,1.6). All other combinations (1,1). Exact ordinary-family segment mappings in config also support Camry, Accord, Altima, RAV4, Tacoma and Lexus ES when no enthusiast generation row exists. These are engineering priors,
not fitted evidence. They change retention, never desirability or collector eligibility.

Comps normalize private-equivalent prices by H_subject/H_comp, plus the spec
shrunken nuisance-normalized trim-log contrast with overlap>=50%, effective group
size>=3, lambda<=.8 and denominator nPair+9. Residual group weights are independent
of subject so pair contrasts reverse sign. Normalization bounds are 1.30x ordinary
and 2x supported performance, reciprocal; oversized corrections are excluded.
No raw trim gap, WLS mileage line or global collector uplift is added in 2.0.
Unknown ordinary trims use a reduced-weight (.35), widened subject-trim scenario,
never an exact match. Unknown performance identity is excluded. Listings cannot
confirm optional transmissions with today's provider schema; those collector
comparisons are conservatively excluded. Public-record zero odometers are excluded
because the current provider maps missing readings to zero.
Condition/title/accident/history adjustments apply once; instant/retail spreads
remain assumptions (-16%/+16%). Round final dollars to $10.

Model intervals use hLog=.20+.15D+.10(1-q)+.12(1-cM)+unknowns+caps+extrapolation+.10,
clamped [.25,.90]. Unknown collector odometer/originality add .05/.08;
unknown preference-sensitive transmission .05; cap .08; age beyond 35 adds .02/year.
Excess model uncertainty returns an unsupported 422 instead of displaying a capped
precise center. Comp intervals use the spec log conversion, prior contrast, evidence
and effective-size penalties, [.05,.70]. They are not calibrated confidence intervals.
Mode, as-of, reference rows, parameters, base, score, factors, interval width and
per-comp ratios persist in confidence JSON. Model comp counts/medians are zero;
the model base is exposed separately, never labeled a weighted comp median.

## Compatibility and remaining integration limits

The fixed reference schema was not changed. It cannot express inferred base-anchor
option decompositions, residual paint coefficients, validated cross-performance
contrasts or generation curve overrides; unsupported features are excluded/zero,
and generation overrides live in config. There is no fuzzy substring identity rule.
Aliases come from scoped trimAliases in the fixed contract; make/model use exact
case-insensitive vPIC names. Arbitrary make/model synonym dictionaries are not inferred.

When an anchor is unavailable but legacy comps are sufficient, the explicitly
versioned 1.2.0 comp replay remains available; it is never called model mode or
relabeled 2.0. Insufficient comps without a surface return NotEnoughDataError
(422 invalid_input, reason=needs_reference), serialized by the existing controller
route error mapper. This preserves existing comp consumers while references arrive.

The offline calibration adapter currently reads the ingest's normalized table because
models/publicRecords has no exported calibration reader. It also joins private-route
sale_outcomes to appraisal specs. Ambiguous unknown trims/absent odometers are skipped;
a unique exact family/year anchor can support unknown-trim calibration rows.
Row hashes cannot identify repeated WA vehicles, so real vehicle-group leakage control
requires a suitable privacy-preserving upstream key before promotion.

Calibration uses an 80% temporal split with groups kept together, fits a coarse k/F
multiplier grid per segment with >=20 training predictions, and prints training and
held-out MAPE by segment/age. No proposal is applied. It does not identify separate
age/period/cohort effects. CLI connects only with explicit --local-db and a local URL.
No database or remote data was used during implementation. Default labeled-sales
fixture is intentionally empty, not fabricated. Real-data accuracy remains unmeasured.

Legacy synthetic LOO is explicitly a 1.2.0 mechanics regression gate; it does not
validate 2.0 market accuracy. The model backtest prints eight arithmetic scenarios
and separately scores any provided labels without fitting on them.

## Worked-example change (illustrative inflation-adjusted anchors)

| Example | Spec | Reviewed implementation |
| --- | ---: | ---: |
| Mustang GT | $26,730 | $26,730 |
| Mustang EcoBoost | $18,270 | $18,270 |
| S2000 | $42,160 | $42,160 |
| 911 GT3 | $126,640 | $126,640 |
| Camry LE | $9,950 | $14,580 |
| Camry XSE | $11,610 | $17,010 |
| Supra Turbo manual | $69,930 | $199,220 in hypothetical evidenced-override scenario |
| Altima | $8,240 | $8,240 |

Supra sensitivity uses a0=12, onset retention=.8, growth=.04, growth cap=4,
retention cap=3. Its unchanged conservative scenario remains $69,930.
These are arithmetic demonstrations, not sales labels or tuned production parameters.

## Command results

- `npx tsc --noEmit`: passed.
- `node scripts/check-architecture.mjs`: passed.
- `npm run backtest`: passed; legacy gated median APE 1.55%, 3.42%, 5.38%, 3.60%, 2.30%. Added an 80% prediction-coverage gate.
- `npx next build`: passed.
- `npx vitest run --maxWorkers=1`: 234 passed, one test failed plus one suite failed outside implementation ownership: `tests/collection/security.test.ts` fails because the public-record provider eagerly opens a production-disallowed PGlite DB; `tests/reference/data.test.ts` cannot load absent `models/reference/data/msrp.json`. Neither was edited.
- Focused implementation tests: 66 passed across four valuation/appraisal test files.
- `npx tsx scripts/calibrate.ts`: passed; zero genuine labels supplied, no proposals or measured MAPE. No DB connection.

The installed Next 15.5.29 package does not contain the requested `node_modules/next/dist/docs/` directory. No app adapters or Next APIs were changed.
