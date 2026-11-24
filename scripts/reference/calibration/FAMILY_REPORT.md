# Family calibration 2.3.1 — local verification

Implementation base: 23767f5. Node 22.23.5. Local PGlite only; PROVIDERS unset. No provider calls, push or merge. MSRP changes were checked against HEAD: only modelAliases/trimAliases differ. Installed Next 15.5.29 has no node_modules/next/dist/docs directory; no Next APIs or routes were changed.

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

## Sampling and naming

November 2026: 450 calls; 383 (85.11%) reserved for the top 60 supported families by WA registrations, and 67 (14.89%) for the rotating long tail. Every top family receives a call before additional calls are allocated by square-root registrations × existing segment weight. Generation/age cells and eight metros rotate within each family. Coverage of all top 30 is tested across all twelve months. Older-than-2005 families require a generation with E ≥ 0.6.

`registrationRanking.json` is regenerated offline by `npx tsx scripts/reference/build-registration-ranking.ts` from `scripts/reference/ranked-models.csv` and MSRP model aliases. Punctuation and case are normalized. Explicit unsplit registration mappings: SILVERADO → Silverado 1500, SIERRA → Sierra 1500, DODGE RAM → Dodge Ram 1500. Heavy-duty variants receive no invented registration volume. Unsupported registration names are omitted.

Exact query make/model spellings for every supported family are in `models/config/marketcheckNames.json`. The provider retains its tested lowercase serialization. In particular: Ford F-150/F-250/F-350; Chevrolet Silverado 1500; GMC Sierra 1500; RAM 1500/2500/3500; Toyota 4Runner; Jeep Grand Cherokee; Honda CR-V. Wrangler queries explicitly include both `Wrangler,Wrangler Unlimited` (comma-separated model filter). Whether the upstream taxonomy requires the Unlimited value remains unverified: no live requests were made.

Owner-run checker: `npx tsx --env-file=.env.local scripts/check-marketcheck-names.ts --offset=0`, then offsets 15/30/45 only as quota permits. Each invocation attempts at most 15 calls, one per family, rows=1, radius=100, Los Angeles ZIP 90012, all years, no trim. It shares the sampler's monthly usage table, lease, quota reserve and account/rate stop rules. Calls consume sampling quota; checker requests do not advance the sampling cursor or store listings. No retries, transport details or credentials are printed.

| Top registration family | Calls |
|---|---:|
| FORD F-150 | 14 |
| CHEVROLET Silverado 1500 | 13 |
| TOYOTA Camry | 7 |
| HONDA CR-V | 11 |
| TOYOTA RAV4 | 11 |
| HONDA Civic | 9 |
| HONDA Accord | 6 |
| TOYOTA Tacoma | 12 |
| SUBARU Forester | 10 |
| SUBARU Outback | 10 |
| TOYOTA Corolla | 6 |
| DODGE Ram 1500 | 11 |
| TOYOTA Highlander | 8 |
| GMC Sierra 1500 | 10 |
| FORD Escape | 8 |
| TOYOTA 4Runner | 8 |
| FORD Ranger | 9 |
| JEEP Wrangler | 8 |
| TOYOTA Prius | 5 |
| FORD Explorer | 7 |
| FORD F-250 | 9 |
| TOYOTA Tundra | 9 |
| JEEP Grand Cherokee | 7 |
| SUBARU Impreza | 4 |
| SUBARU Legacy | 4 |
| FORD F-350 | 8 |
| TOYOTA Sienna | 4 |
| HONDA Pilot | 7 |
| SUBARU Crosstrek | 7 |
| FORD Focus | 4 |

## Five-fold validation

Seen-family splitting, eligibility and error definitions are unchanged. Family centers now shrink toward 1.0, never toward a pooled segment center. Unsupported or rejected families receive 1.0 even when a legacy snapshot contains segment cells. Published 2.3.1 snapshots contain no segment corrections.

| Evaluation | n | Median absolute % error | p80 absolute % error |
|---|---:|---:|---:|
| Seen neutral | 4292 | 23.52 | 51.47 |
| Seen corrected | 4292 | 10.50 | 26.52 |
| Unseen neutral fallback | 4320 | 23.64 | 51.74 |
| Unseen previous guarded pooled fallback | 4320 | 19.29 | 37.32 |

The previous pooled comparison reproduces the old segment acceptance guards in the same family-held-out folds. It improves this sample aggregate but transfers unsupported GMC-heavy estimates to unsampled families, so it is retired. This is generation-level family holdout, not necessarily holdout of every generation of a model. CV also selects publication guards; there is no independent final test.

The 2.3.0 → 2.3.1 migration validates against neutral rather than treating the retired prior as a publication target. Later 2.3.1 fits retain the existing prior-improvement guard.

## Published family corrections

48 accepted corrections. No segment fallback.

| Family | n | Factor |
|---|---:|---:|
| honda/ridgeline/yk2 | 124 | 0.7588 |
| honda/ridgeline/yk1 | 17 | 0.7500 |
| jeep/gladiator/jt | 178 | 0.8383 |
| nissan/frontier/d41 | 162 | 0.9725 |
| nissan/frontier/d40 | 118 | 0.8991 |
| nissan/titan/a61 | 94 | 0.7500 |
| nissan/titan/a60 | 21 | 0.8174 |
| toyota/tacoma/n300 | 243 | 1.0997 |
| toyota/tacoma/n220 | 88 | 1.2500 |
| toyota/tacoma/n140 | 19 | 1.2500 |
| ford/flex/d471 | 20 | 0.7500 |
| gmc/acadia/c1xx | 162 | 0.6475 |
| gmc/acadia/gen3 | 36 | 0.8321 |
| gmc/acadia/lambda | 90 | 0.7500 |
| gmc/envoy/gmt360 | 14 | 0.7500 |
| lexus/nx/az20 | 47 | 0.9441 |
| gmc/terrain/gen2 | 211 | 0.6685 |
| gmc/terrain/gen1 | 75 | 0.7500 |
| lexus/nx/az10 | 97 | 0.8384 |
| gmc/yukon/t1 | 143 | 0.8525 |
| gmc/yukon/k2xx | 112 | 0.6324 |
| lexus/rx/al20 | 116 | 0.8667 |
| gmc/yukon/gmt900 | 21 | 0.7500 |
| lexus/rx/ala10 | 81 | 0.9620 |
| gmc/yukon xl/t1 | 113 | 0.8171 |
| gmc/yukon xl/k2xx | 80 | 0.7500 |
| lexus/rx/al10 | 86 | 0.7961 |
| gmc/yukon xl/gmt900 | 17 | 0.7500 |
| honda/cr-v/rw | 264 | 0.8966 |
| honda/cr-v/rs | 142 | 0.9154 |
| lexus/rx/xu30 | 44 | 0.7500 |
| honda/cr-v/re | 22 | 0.8386 |
| honda/cr-v/rm | 184 | 0.9289 |
| chevrolet/camaro/gen5 | 89 | 1.2500 |
| chevrolet/camaro/gen6 | 21 | 1.2500 |
| chevrolet/corvette/c8 | 110 | 0.6703 |
| chevrolet/corvette/c7 | 57 | 1.2500 |
| chevrolet/corvette/c6 | 68 | 1.2500 |
| chevrolet/corvette/c5 | 26 | 1.0388 |
| dodge/challenger/lc | 215 | 1.3868 |
| dodge/viper/zb ii | 8 | 1.2500 |
| lexus/ls/xf40 | 16 | 0.9354 |
| lexus/ls/xf30 | 8 | 0.8320 |
| buick/lacrosse/gen3 | 5 | 0.8277 |
| buick/lacrosse/gen2 | 8 | 0.7500 |
| dodge/charger/ld | 225 | 1.3557 |
| chevrolet/cobalt/delta | 10 | 1.2034 |
| chevrolet/bolt ev/gen1 | 22 | 0.8886 |

## Sanity cars

Model-only values at 2026-11-16. These are checks of behavior, not accuracy labels. Camry and Altima return to their pre-correction values. Informal expectations in the script do not tune the model. S2000 and GT3 remain unsupported by these samples.

| Car | 2.3.0 | 2.3.1 |
|---|---:|---:|
| 2017 TOYOTA Camry LE 90k | $10,370 | $13,830 |
| 2019 FORD Mustang GT 50k | $20,020 | $20,020 |
| 2015 NISSAN Altima 2.5 S 120k | $7,170 | $9,560 |
| 2018 FORD F-150 XLT 80k | $18,930 | $19,680 |
| 2020 HONDA CR-V EX 60k | $19,340 | $19,340 |
| 2016 JEEP Wrangler Sahara 90k | $11,210 | $14,940 |
| 2001 HONDA S2000 Base 60k | $30,620 | $30,620 |
| 2019 TOYOTA Tacoma TRD Off-Road 60k | $29,450 | $29,450 |
| 2010 TOYOTA Corolla LE 150k | $6,420 | $6,420 |
| 2008 PORSCHE 911 GT3 30k | $104,310 | $104,310 |
| 2013 HONDA Civic LX 110k | $8,110 | $8,110 |
| 2021 TOYOTA RAV4 XLE 40k | $19,290 | $25,720 |

Full intervals: sanity-after.txt. Detailed CV and mileage diagnostics: monthly-accuracy.json.

## Required checks

Passed: `npx tsc --noEmit`, `npx vitest run` (32 files, 282 tests), `node scripts/check-architecture.mjs`, `npm run backtest`, `npx next build`. The backtest has no labeled model sales; arithmetic examples are not accuracy evidence. All execution uses Node 22, local PGlite and PROVIDERS unset. No live MarketCheck calls, push or merge.
