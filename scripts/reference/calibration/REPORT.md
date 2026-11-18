# Valuation 2.1 calibration — 2026-11-17

Reproduce with `npx tsx --tsconfig tsconfig.json scripts/reference/calibration/fit.ts --apply`. The explicit flag updates fitted config; neither mode writes reference data or database tables. The database is the exact local `.data/pglite` path and the query runs in a read-only transaction.

## Method and limitations

269 of 271 approximate CSV labels were usable. Excluded: TOYOTA/4Runner/2025: missing CPI 2025; BMW/X3/2025: missing CPI 2025. CPI is intentionally not extrapolated. WA uses only 2026 sales to match the late-2026 regime, positive actual odometers, $1,000+ prices, <=300k miles, and cells with at least 10 sales. Only families explicitly classified EV and present in MSRP are used (including Volt PHEV); other PHEVs with combustion-model MSRP cannot be joined safely. Each make/model/year/20k-mile-band cell supplies median price and median miles. Trim is unavailable: the lowest-tier, lowest-priced anchor is the base proxy. No inferred trim premium is added.

Families are stratified by segment and median-age bucket, ordered by deterministic FNV1a hash, then alternated globally across train/holdout: 51/50 families, 235/236 observations. A family never occurs in both sets. Singleton strata cannot individually be halved. Fit uses train only, Huber log-price loss (delta .2), confidence weights 1/.6/.3, equal aggregate influence for CSV and WA sources, and log-ridge penalties (.002 brand; .0002 segment). This shrinks thin brands toward 1. Unseen brands use 1. Market/k/floor effects are correlated: these data cannot identify causal post-2021 regime effects independently of age/cohort. Market factors apply only as of 2021 or later.

The repository supplies no numeric specification for new market/brand fitting bounds. Explicit conservative search bounds are recorded in results.json; they are assumptions, not claimed spec-derived limits. Existing caps and evidence gates are unchanged. No supplied reference or generation is edited, and no appreciation is enabled. Fullsize has zero labels and keeps neutral factors; this segment is classified but cannot honestly be called fitted. Some parameters hit bounds (betaD2, sports/EV floor); this exposes limited identifiability/model fit.

The 12 sanity cases were never used by the optimizer. They are post-fit checks, not statistically independent for families already in train. Mustang is wholly unseen, not train or holdout. Several supplied references conflict with the informal sanity ranges: F-150 2020 XLT $22,600 and 2015 XLT $13,400; S2000 2009 $8,000–8,300 versus 2002 $31,000. No GT3 label exists. Residual undervaluation must not be hidden by tuning to the sanity table.

## Fitted parameters

`k=(.14-.06D)*segment.k*brand`; `F=clamp((.12+.5301D²)*segment.floor/brand,0,1)`. Thus smaller brand values mean better retention. Market multiplies the surface once, so cancels in same-segment comp ratios.

Mileage `beta=.2414+.8D²`; eligible collector onset `29.766-17.056D` years; floor desirability coefficient `.5301`. Collector eligibility, coverage, mileage caps and G gates stay intact. G=0 curves flatten without appreciation.

| Segment | Market K | k multiplier | F multiplier | baseline log half-width | Typical approximate-anchor range* |
|---|---:|---:|---:|---:|---|
| economy | 1.3094 | 0.9246 | 0.5350 | 0.1934 | −19%/+24% |
| midsize | 1.0884 | 0.8782 | 0.8075 | 0.2017 | −20%/+25% |
| fullsize | 1.0000 | 1.0000 | 1.0000 | 0.3764 | −33%/+49% |
| suv | 1.3302 | 0.9493 | 0.7150 | 0.3191 | −29%/+40% |
| truck | 1.1989 | 0.8637 | 1.0800 | 0.2988 | −27%/+38% |
| van | 0.9701 | 0.8666 | 0.6575 | 0.2923 | −27%/+37% |
| luxury | 1.1144 | 1.0928 | 1.4475 | 0.3764 | −33%/+49% |
| sports | 1.6695 | 1.5655 | 0.5000 | 0.4900 | −40%/+67% |
| ev | 1.1508 | 1.3784 | 0.5000 | 0.4081 | −35%/+53% |

*Before collector/unknown originality, transmission, mileage-cap and extrapolation penalties. Camry: −20%/+25%. Baseline is measured p80 absolute log residual by segment (>=8 holdout cells), else pooled holdout p80 (fullsize/luxury). No manual width target is fitted. Additive evidence penalties remain: approximate anchor .015 log; missing coverage up to .005 log, reduced because the holdout baseline already includes approximate-anchor and missing-feature error. The interval is symmetric in log dollars, not equal-tailed. Width calibration reuses the heldout errors; 80% is empirical calibration coverage, not an independently verified guarantee.

Brand factors: acura 0.65750, audi 0.82150, bmw 1.25725, chevrolet 1.18375, dodge 1.28050, ford 1.10200, gmc 1.04725, honda 0.94375, hyundai 1.04425, jeep 1.04500, kia 0.98425, land rover 1.18675, lexus 1.00450, lincoln 0.75475, mazda 0.94225, mercedes-benz 1.13875, nissan 1.02100, porsche 1.07875, tesla 0.95725, toyota 0.86875, volkswagen 0.96625.

## Holdout error

Unweighted per-label/per-cell absolute percentage errors. WA sales counts describe support; cells are weighted equally in the metrics. Empty buckets are not zero-error results.

### Approximate references

| Group | n labels/cells | underlying sales | median APE % | p80 % | p90 % |
|---|---:|---:|---:|---:|---:|
| All | 133 | 133 | 16.4 | 32.7 | 46.4 |
| economy | 17 | 17 | 8.3 | 19.2 | 32.2 |
| midsize | 11 | 11 | 16.0 | 22.3 | 30.4 |
| fullsize | 0 | 0 | — | — | — |
| suv | 54 | 54 | 16.4 | 31.9 | 52.2 |
| truck | 25 | 25 | 14.7 | 32.4 | 37.3 |
| van | 8 | 8 | 16.1 | 28.2 | 33.2 |
| luxury | 5 | 5 | 15.8 | 24.5 | 35.6 |
| sports | 12 | 12 | 26.2 | 45.1 | 56.5 |
| ev | 1 | 1 | 51.2 | 51.2 | 51.2 |
| Age 0-5 | 47 | 47 | 13.8 | 23.3 | 29.4 |
| Age 6-10 | 27 | 27 | 16.6 | 33.8 | 42.2 |
| Age 11-20 | 47 | 47 | 17.3 | 45.1 | 67.6 |
| Age 21+ | 12 | 12 | 22.1 | 41.2 | 56.1 |

### WA EV medians

| Group | n labels/cells | underlying sales | median APE % | p80 % | p90 % |
|---|---:|---:|---:|---:|---:|
| All | 103 | 5287 | 18.7 | 48.0 | 82.2 |
| ev | 103 | 5287 | 18.7 | 48.0 | 82.2 |
| Age 0-5 | 46 | 4090 | 10.6 | 18.9 | 35.4 |
| Age 6-10 | 44 | 920 | 21.9 | 32.9 | 71.9 |
| Age 11-20 | 13 | 277 | 89.1 | 147.5 | 171.0 |
| Age 21+ | 0 | 0 | — | — | — |

## Sanity checks after fitting

| Vehicle | Family split | Before $ | After $ | After interval $ |
|---|---|---:|---:|---|
| 2017 TOYOTA Camry LE 90k | train | 14,940 | 13,830 | 11,080–17,260 |
| 2019 FORD Mustang GT 50k | unseen | 20,300 | 20,020 | 11,480–34,920 |
| 2015 NISSAN Altima 2.5 S 120k | holdout | 8,320 | 9,560 | 7,660–11,930 |
| 2018 FORD F-150 XLT 80k | train | 15,630 | 19,680 | 14,350–26,990 |
| 2020 HONDA CR-V EX 60k | train | 15,320 | 21,570 | 15,370–30,280 |
| 2016 JEEP Wrangler Sahara 90k | holdout | 11,800 | 14,940 | 10,670–20,910 |
| 2001 HONDA S2000 Base 60k | train | 24,520 | 30,620 | 16,220–57,820 |
| 2019 TOYOTA Tacoma TRD Off-Road 60k | holdout | 23,980 | 26,780 | 19,550–36,680 |
| 2010 TOYOTA Corolla LE 150k | train | 4,520 | 6,420 | 5,190–7,950 |
| 2008 PORSCHE 911 GT3 30k | holdout | 78,790 | 104,310 | 55,240–196,980 |
| 2013 HONDA Civic LX 110k | holdout | 6,050 | 8,110 | 6,570–10,010 |
| 2021 TOYOTA RAV4 XLE 40k | train | 20,730 | 25,720 | 18,320–36,100 |

## Tests and integration

Changed expectations: `tests/appraisals/model.test.ts` now expects persisted method 2.1.0. `tests/valuation/surface.test.ts` replaces the old high/low >1.7 requirement with lower/upper bounds .75/1.26 of center, reflecting calibrated Camry uncertainty. No worked-example dollar targets were changed: those remain historical arithmetic illustrations, not price labels. New coverage checks verify every MSRP family has a supported segment, near-equal family partitions, and no G=0 collector appreciation. The fitter asserts every cached prediction equals the production surface.

Validation passed: `npx tsc --noEmit`; `npx vitest run` (29 files, 251 tests); `node scripts/check-architecture.mjs`; `npm run backtest` (all legacy accuracy and coverage gates); `npx next build`.
