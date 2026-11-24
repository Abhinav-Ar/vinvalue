# Local calibration verification

Runtime: 30.54 seconds. MSRP matches: 3640/4714; modeled: 3622; CPI-ineligible: 18.

Dealer-to-private: 0.90 retained. No supported contemporaneous EV overlap; estimate and uncertainty unavailable. 40,809 WA cells were aggregated.

Holdout absolute percentage error against converted dealer asks: median 20.52% → 18.43%; p80 44.97% → 36.55%.

| Segment | Train n | Holdout n | Applied factor | Decision |
|---|---:|---:|---:|---|
| economy | 13 | 74 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| ev | 0 | 22 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| fullsize | 27 | 231 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| luxury | 8 | 0 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| midsize | 1 | 5 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| sports | 4 | 458 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |
| suv | 955 | 930 | 0.7819 | Accepted: sample, family, cap and holdout guards pass. |
| truck | 244 | 648 | 1.0000 | Retain previous: holdout median or p80 worsened. |
| van | 0 | 2 | 1.0000 | Retain previous: need >=30 observations and >=2 families in EACH partition. |

Truck candidate 0.7787× was rejected: median error 14.02% → 23.72%, p80 27.79% → 37.34%. The data does not support an upward truck/performance correction. Only 32 matched model families contributed to this month; sports training has four cars.

The accepted SUV factor lowers several sanity cars away from the supplied expected ranges. Family holdout improvement against these dealer asks does not establish improved accuracy on every SUV family. This is a material limitation.

| Sanity car (year, trim, miles) | Before | After |
|---|---:|---:|
| [train] 2017 TOYOTA Camry LE 90k | $13,830 | $13,830 |
| [unseen] 2019 FORD Mustang GT 50k | $20,020 | $20,020 |
| [holdout] 2015 NISSAN Altima 2.5 S 120k | $9,560 | $9,560 |
| [train] 2018 FORD F-150 XLT 80k | $19,680 | $19,680 |
| [train] 2020 HONDA CR-V EX 60k | $21,570 | $16,870 |
| [holdout] 2016 JEEP Wrangler Sahara 90k | $14,940 | $11,680 |
| [train] 2001 HONDA S2000 Base 60k | $30,620 | $30,620 |
| [holdout] 2019 TOYOTA Tacoma TRD Off-Road 60k | $26,780 | $26,780 |
| [train] 2010 TOYOTA Corolla LE 150k | $6,420 | $6,420 |
| [holdout] 2008 PORSCHE 911 GT3 30k | $104,310 | $104,310 |
| [holdout] 2013 HONDA Civic LX 110k | $8,110 | $8,110 |
| [train] 2021 TOYOTA RAV4 XLE 40k | $25,720 | $20,110 |

Commands: Node 22; PROVIDERS and MARKETCHECK_API_KEY unset for local calibration. No provider calls, production database access, push or merge. Migration 0005 applied locally.

The first complete optimized run took 22.27 seconds; the final run with expanded rejected-candidate audit took 30.54 seconds while tests were running. The earlier CPU profile of the proposal path took 54.83 seconds.

Verification passed: `npx tsc --noEmit`; `npx vitest run` (32 files, 277 tests); `node scripts/check-architecture.mjs`; `npm run backtest`; `npx next build`. The exact surface equivalence test covers supported MSRP anchors with aliases across three market multipliers. Database tests cover fallback, publication, idempotence and month transitions.
