# Monthly model accuracy — method 2.3.0

Published CV-improving family corrections; segment fallbacks separately guarded by family-holdout CV.

| Evaluation | n | Median before | Median after | p80 before | p80 after |
|---|---:|---:|---:|---:|---:|
| seen | 4292 | 23.52 | 10.46 | 51.47 | 26.24 |
| unseen | 4320 | 23.64 | 19.29 | 51.74 | 37.32 |

- One month: no temporal validation.
- Five folds balanced within canonical make/model/generation, deduplicated by listing hash.
- Family holdout is stratified by segment and greedily balanced by sample count; indivisible large families cause imbalance.
- CV also selects publication guards; no independent final test. Metrics describe guarded out-of-fit candidates; publication guards reuse CV. Families with fewer than five listings are excluded from seen metrics.
- Dealer asks × configured private-equivalent factor are proxies, not transaction truth.

## Drift versus previous month

No previous month: drift unavailable.
