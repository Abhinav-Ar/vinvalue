# Family calibration 2.3.0 — local verification

Baseline commit: 089f996. Node 22.23.5. Local PGlite only; PROVIDERS unset. No provider calls, push or merge. MSRP changes were checked against HEAD: only modelAliases/trimAliases differ. Installed Next 15.5.29 has no node_modules/next/dist/docs directory; no Next APIs or routes were changed.

## Matching

Before: **3640/4714 (77.22%)**; after: **4338/4714 (92.02%)**. Surface-modeled after: 4320 (18 matched references cannot produce a surface). Matching includes all stored samples; CV uses the current month and listing hashes are deduplicated.

All failures in this dataset are trim name mismatches. Ambiguous SRT/LZ engine tiers and unrepresented trims remain excluded. Alias mappings include same-tier packages and renamed trim designations; they are approximations where package MSRP is not separately represented. No MSRP dollar anchors changed.

| Make/model | Before matched / total | After matched / total | Before % | After % |
|---|---:|---:|---:|---:|
| buick/century | 1/1 | 1/1 | 100.0 | 100.0 |
| buick/lacrosse | 23/46 | 23/46 | 50.0 | 50.0 |
| buick/lesabre | 4/4 | 4/4 | 100.0 | 100.0 |
| chevrolet/astro | 2/2 | 2/2 | 100.0 | 100.0 |
| chevrolet/aveo | 2/2 | 2/2 | 100.0 | 100.0 |
| chevrolet/bolt ev | 22/22 | 22/22 | 100.0 | 100.0 |
| chevrolet/camaro | 88/110 | 110/110 | 80.0 | 100.0 |
| chevrolet/cavalier | 1/1 | 1/1 | 100.0 | 100.0 |
| chevrolet/cobalt | 10/10 | 10/10 | 100.0 | 100.0 |
| chevrolet/corvette | 169/317 | 261/317 | 53.3 | 82.3 |
| chevrolet/cruze | 74/74 | 74/74 | 100.0 | 100.0 |
| chevrolet/ss | 3/3 | 3/3 | 100.0 | 100.0 |
| dodge/challenger | 201/290 | 215/290 | 69.3 | 74.1 |
| dodge/charger | 231/320 | 235/320 | 72.2 | 73.4 |
| dodge/viper | 1/16 | 9/16 | 6.2 | 56.2 |
| ford/flex | 20/20 | 20/20 | 100.0 | 100.0 |
| ford/gt | 0/1 | 0/1 | 0.0 | 0.0 |
| gmc/acadia | 165/304 | 288/304 | 54.3 | 94.7 |
| gmc/envoy | 14/14 | 14/14 | 100.0 | 100.0 |
| gmc/sierra 1500 | 1/1 | 1/1 | 100.0 | 100.0 |
| gmc/terrain | 304/316 | 304/316 | 96.2 | 96.2 |
| gmc/yukon xl | 201/219 | 213/219 | 91.8 | 97.3 |
| gmc/yukon | 246/292 | 282/292 | 84.2 | 96.6 |
| honda/cr-v | 546/626 | 612/626 | 87.2 | 97.8 |
| honda/ridgeline | 141/180 | 141/180 | 78.3 | 78.3 |
| jeep/gladiator | 149/178 | 178/178 | 83.7 | 100.0 |
| lexus/ls | 8/24 | 24/24 | 33.3 | 100.0 |
| lexus/nx | 84/144 | 144/144 | 58.3 | 100.0 |
| lexus/rx | 323/339 | 329/339 | 95.3 | 97.1 |
| nissan/frontier | 170/291 | 280/291 | 58.4 | 96.2 |
| nissan/titan | 103/118 | 115/118 | 87.3 | 97.5 |
| ram/1500 | 0/1 | 0/1 | 0.0 | 0.0 |
| toyota/tacoma | 328/420 | 416/420 | 78.1 | 99.0 |
| volkswagen/passat | 5/8 | 5/8 | 62.5 | 62.5 |

Requested large-model coverage: ford/f-150: 0 stored, chevrolet/silverado: 0 stored, gmc/sierra: 0 stored, ram/1500: 1 stored, jeep/wrangler: 0 stored, toyota/4runner: 0 stored, ford/mustang: 0 stored, chevrolet/tahoe: 0 stored, ford/explorer: 0 stored, ford/bronco: 0 stored. Aliases cannot supply absent listings.

### Remaining unmatched (top 20)

| Make/model | Trim | n | Reason |
|---|---|---:|---|
| Dodge Challenger | SRT | 45 | trim name mismatch |
| Dodge Charger | GT | 45 | trim name mismatch |
| Chevrolet Corvette | 3LZ | 36 | trim name mismatch |
| Dodge Challenger | GT | 30 | trim name mismatch |
| Honda Ridgeline | Sport | 22 | trim name mismatch |
| Dodge Charger | SRT | 19 | trim name mismatch |
| Dodge Charger | Police | 17 | trim name mismatch |
| Honda CR-V | SE | 14 | trim name mismatch |
| Honda Ridgeline | TrailSport | 13 | trim name mismatch |
| GMC Acadia | AT4 | 11 | trim name mismatch |
| GMC Terrain | AT4 | 11 | trim name mismatch |
| Chevrolet Corvette | 2LZ | 9 | trim name mismatch |
| Lexus RX | 350 F SPORT | 9 | trim name mismatch |
| Chevrolet Corvette | 1LZ | 7 | trim name mismatch |
| Nissan Frontier | SL | 7 | trim name mismatch |
| GMC Yukon | Elevation | 7 | trim name mismatch |
| Buick LaCrosse | Premium 1 | 6 | trim name mismatch |
| Dodge Viper | (missing) | 6 | trim name mismatch |
| GMC Acadia | SL | 5 | trim name mismatch |
| Buick LaCrosse | Leather | 5 | trim name mismatch |

Full counts, years and reasons: matching-before.json / matching-after.json. Reproduce with matching-diagnostics.ts.

## Five-fold validation

Before means neutral corrections (not the old segment snapshot). CI below is for the raw family median private-equivalent / engine ratio, not the shrunk factor. Dealer factor remains 0.90; unsupported WA overlap did not replace it.

| Evaluation | n | Median before | Median after | p80 before | p80 after |
|---|---:|---:|---:|---:|---:|
| seen | 4292 | 23.52% | 10.46% | 51.47% | 26.24% |
| unseen | 4320 | 23.64% | 19.29% | 51.74% | 37.32% |

Guards reuse CV, so these are validation results, not an untouched final test. Seen metrics exclude families with <5 rows. Family holdout hides make/model/generation; another generation of the model may remain in training. Sparse singleton segments have no useful unseen support and retain neutral fallback. Monthly bucket metrics are raw candidate CV; the aggregate CV table uses guarded candidates.

| Evaluation/fold | Train | Test | Train families | Test families |
|---|---:|---:|---:|---:|
| seen/0 | 3426 | 894 | 62 | 66 |
| seen/1 | 3442 | 878 | 66 | 62 |
| seen/2 | 3458 | 862 | 66 | 58 |
| seen/3 | 3472 | 848 | 66 | 54 |
| seen/4 | 3482 | 838 | 66 | 53 |
| unseen/0 | 3084 | 1236 | 55 | 11 |
| unseen/1 | 3523 | 797 | 53 | 13 |
| unseen/2 | 3551 | 769 | 53 | 13 |
| unseen/3 | 3553 | 767 | 51 | 15 |
| unseen/4 | 3569 | 751 | 52 | 14 |

## Family correction table

48 accepted family corrections. Rejected families use an accepted segment fallback, otherwise 1.0. Final publication passed the overall CV guard against both neutral and active prior corrections.

| Make/model/generation | n | Fitted factor | Raw median 80% CI | Accepted | Applied factor |
|---|---:|---:|---|---|---:|
| buick/century/gen6 | 1 | 0.750 | 0.423–0.423 | no | 0.750 |
| buick/lacrosse/gen1 | 10 | 0.799 | 0.607–0.897 | no | 1.000 |
| buick/lacrosse/gen2 | 8 | 0.750 | 0.504–0.620 | yes | 0.750 |
| buick/lacrosse/gen3 | 5 | 0.824 | 0.713–0.886 | yes | 0.824 |
| buick/lesabre/gen8 | 4 | 0.750 | 0.488–0.795 | no | 1.000 |
| chevrolet/astro/gen2 | 2 | 1.022 | 0.877–2.038 | no | 1.000 |
| chevrolet/aveo/t250 | 2 | 1.135 | 1.049–1.354 | no | 1.000 |
| chevrolet/bolt ev/gen1 | 22 | 0.841 | 0.796–0.913 | yes | 0.841 |
| chevrolet/camaro/gen5 | 89 | 1.250 | 1.848–2.060 | yes | 1.250 |
| chevrolet/camaro/gen6 | 21 | 1.250 | 1.661–1.722 | yes | 1.250 |
| chevrolet/cavalier/j-body gen3 | 1 | 1.250 | 1.292–1.292 | no | 1.000 |
| chevrolet/cobalt/delta | 10 | 1.246 | 1.130–1.665 | yes | 1.246 |
| chevrolet/corvette/c5 | 26 | 1.040 | 1.031–1.088 | yes | 1.040 |
| chevrolet/corvette/c6 | 68 | 1.250 | 1.241–1.288 | yes | 1.250 |
| chevrolet/corvette/c7 | 57 | 1.250 | 1.335–1.390 | yes | 1.250 |
| chevrolet/corvette/c8 | 110 | 0.671 | 0.645–0.684 | yes | 0.671 |
| chevrolet/cruze/j400 | 74 | 0.888 | 0.835–0.923 | no | 1.000 |
| chevrolet/ss/vf | 3 | 1.250 | 1.636–2.456 | no | 1.000 |
| dodge/challenger/lc | 215 | 1.388 | 1.350–1.453 | yes | 1.388 |
| dodge/charger/lb | 3 | 0.750 | 0.543–0.732 | no | 1.000 |
| dodge/charger/ld | 225 | 1.355 | 1.293–1.386 | yes | 1.355 |
| dodge/charger/lx | 7 | 1.048 | 0.859–1.253 | no | 1.000 |
| dodge/viper/zb i | 1 | 1.069 | 1.068–1.068 | no | 1.000 |
| dodge/viper/zb ii | 8 | 1.250 | 2.649–3.271 | yes | 1.250 |
| ford/flex/d471 | 20 | 0.750 | 0.511–0.589 | yes | 0.750 |
| gmc/acadia/c1xx | 162 | 0.647 | 0.633–0.652 | yes | 0.647 |
| gmc/acadia/gen3 | 36 | 0.831 | 0.801–0.855 | yes | 0.831 |
| gmc/acadia/lambda | 90 | 0.750 | 0.445–0.484 | yes | 0.750 |
| gmc/envoy/gmt360 | 14 | 0.750 | 0.408–0.569 | yes | 0.750 |
| gmc/sierra 1500/gmt900 | 1 | 1.101 | 1.104–1.104 | no | 0.962 |
| gmc/terrain/gen1 | 75 | 0.750 | 0.541–0.583 | yes | 0.750 |
| gmc/terrain/gen2 | 211 | 0.668 | 0.660–0.682 | yes | 0.668 |
| gmc/yukon xl/gmt800 | 3 | 0.750 | 0.440–0.764 | no | 0.750 |
| gmc/yukon xl/gmt900 | 17 | 0.750 | 0.420–0.507 | yes | 0.750 |
| gmc/yukon xl/k2xx | 80 | 0.750 | 0.537–0.561 | yes | 0.750 |
| gmc/yukon xl/t1 | 113 | 0.817 | 0.811–0.826 | yes | 0.817 |
| gmc/yukon/gmt800 | 6 | 0.750 | 0.627–0.704 | no | 0.750 |
| gmc/yukon/gmt900 | 21 | 0.750 | 0.498–0.675 | yes | 0.750 |
| gmc/yukon/k2xx | 112 | 0.631 | 0.621–0.647 | yes | 0.631 |
| gmc/yukon/t1 | 143 | 0.852 | 0.843–0.864 | yes | 0.852 |
| honda/cr-v/re | 22 | 0.822 | 0.741–0.925 | yes | 0.822 |
| honda/cr-v/rm | 184 | 0.928 | 0.905–0.938 | yes | 0.928 |
| honda/cr-v/rs | 142 | 0.915 | 0.900–0.923 | yes | 0.915 |
| honda/cr-v/rw | 264 | 0.896 | 0.888–0.907 | yes | 0.896 |
| honda/ridgeline/yk1 | 17 | 0.750 | 0.603–0.770 | yes | 0.750 |
| honda/ridgeline/yk2 | 124 | 0.759 | 0.731–0.766 | yes | 0.759 |
| jeep/gladiator/jt | 178 | 0.838 | 0.818–0.845 | yes | 0.838 |
| lexus/ls/xf30 | 8 | 0.750 | 0.396–0.478 | yes | 0.750 |
| lexus/ls/xf40 | 16 | 0.750 | 0.396–0.623 | yes | 0.750 |
| lexus/nx/az10 | 97 | 0.837 | 0.825–0.850 | yes | 0.837 |
| lexus/nx/az20 | 47 | 0.943 | 0.924–0.956 | yes | 0.943 |
| lexus/rx/al10 | 86 | 0.794 | 0.785–0.820 | yes | 0.794 |
| lexus/rx/al20 | 116 | 0.866 | 0.857–0.875 | yes | 0.866 |
| lexus/rx/ala10 | 81 | 0.961 | 0.946–0.978 | yes | 0.961 |
| lexus/rx/xu10 | 2 | 0.750 | 0.444–0.549 | no | 0.750 |
| lexus/rx/xu30 | 44 | 0.750 | 0.584–0.697 | yes | 0.750 |
| nissan/frontier/d40 | 118 | 0.899 | 0.876–0.933 | yes | 0.899 |
| nissan/frontier/d41 | 162 | 0.972 | 0.963–0.983 | yes | 0.972 |
| nissan/titan/a60 | 21 | 0.816 | 0.710–0.877 | yes | 0.816 |
| nissan/titan/a61 | 94 | 0.750 | 0.693–0.736 | yes | 0.750 |
| toyota/tacoma/n140 | 19 | 1.250 | 1.304–1.654 | yes | 1.250 |
| toyota/tacoma/n220 | 88 | 1.250 | 1.504–1.669 | yes | 1.250 |
| toyota/tacoma/n300 | 243 | 1.100 | 1.089–1.108 | yes | 1.100 |
| toyota/tacoma/n400 | 66 | 0.998 | 0.970–1.035 | no | 0.962 |
| volkswagen/passat/b5 | 2 | 0.750 | 0.423–0.567 | no | 0.750 |
| volkswagen/passat/b6 | 3 | 0.750 | 0.245–0.743 | no | 0.750 |

Segment fallbacks: truck ×0.962, suv ×0.750, midsize ×0.750. Other segments use 1.0.

## Mileage diagnostics

These are low/high mileage thirds, with >=20k separation, >0.10 absolute log difference and nonoverlapping bootstrap 80% intervals. They are confounded by year/trim and are reported rather than fitted into a mileage correction. A single family intercept cannot resolve them.

| Family | n | Residual log change / 10k miles |
|---|---:|---:|
| chevrolet/camaro/gen5 | 89 | -0.0181 |
| chevrolet/corvette/c6 | 68 | +0.0135 |
| chevrolet/corvette/c7 | 57 | +0.0212 |
| chevrolet/cruze/j400 | 74 | -0.0688 |
| dodge/challenger/lc | 215 | +0.0227 |
| gmc/acadia/c1xx | 162 | -0.0284 |
| gmc/acadia/gen3 | 36 | +0.0594 |
| gmc/acadia/lambda | 90 | -0.0652 |
| gmc/terrain/gen1 | 75 | -0.0466 |
| gmc/yukon xl/k2xx | 80 | -0.0358 |
| gmc/yukon/k2xx | 112 | -0.0253 |
| honda/cr-v/rm | 184 | -0.0237 |
| honda/cr-v/rs | 142 | +0.0313 |
| lexus/rx/al10 | 86 | -0.0363 |
| lexus/rx/ala10 | 81 | +0.0380 |
| lexus/rx/xu30 | 44 | -0.0333 |
| nissan/frontier/d40 | 118 | -0.0198 |
| nissan/frontier/d41 | 162 | +0.0253 |
| nissan/titan/a61 | 94 | -0.0223 |
| toyota/tacoma/n220 | 88 | -0.0290 |
| toyota/tacoma/n400 | 66 | +0.0603 |

## Sanity cars

Before uses the committed 2.2.0 segment correction; after uses the new 2.3.0 snapshot. The script's train/holdout labels refer to an older static reference split, not the new CV. Dollar ranges are informal guesses, not labels. We do not tune to them. Camry, F-150 and Wrangler have no direct family support here; their shifts reflect segment fallback. RAV4 also lacks direct matched family support. S2000/GT3 remain uncalibrated; no claim that these samples establish collector prices.

| Car | Before | After |
|---|---:|---:|
| 2017 TOYOTA Camry LE 90k | $13,830 | $10,370 |
| 2019 FORD Mustang GT 50k | $20,020 | $20,020 |
| 2015 NISSAN Altima 2.5 S 120k | $9,560 | $7,170 |
| 2018 FORD F-150 XLT 80k | $19,680 | $18,930 |
| 2020 HONDA CR-V EX 60k | $16,870 | $19,340 |
| 2016 JEEP Wrangler Sahara 90k | $11,680 | $11,210 |
| 2001 HONDA S2000 Base 60k | $30,620 | $30,620 |
| 2019 TOYOTA Tacoma TRD Off-Road 60k | $26,780 | $29,450 |
| 2010 TOYOTA Corolla LE 150k | $6,420 | $6,420 |
| 2008 PORSCHE 911 GT3 30k | $104,310 | $104,310 |
| 2013 HONDA Civic LX 110k | $8,110 | $8,110 |
| 2021 TOYOTA RAV4 XLE 40k | $20,110 | $19,290 |

Full intervals and informal expectations: sanity-before.txt / sanity-after.txt.

## Required checks

`npx tsc --noEmit`, `npx vitest run`, `node scripts/check-architecture.mjs`, `npm run backtest`, and `npx next build` pass. The backtest reports no labeled model sales; its arithmetic examples are not an accuracy validation. The empirical CV above is the accuracy evidence.
