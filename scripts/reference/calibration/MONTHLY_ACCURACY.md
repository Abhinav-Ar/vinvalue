# Monthly model accuracy — method 2.3.1

Published CV-improving family corrections shrunk toward 1.0; unsupported families use 1.0.

| Evaluation | n | Median before | Median after | p80 before | p80 after |
|---|---:|---:|---:|---:|---:|
| seen | 4292 | 23.52 | 10.50 | 51.47 | 26.52 |
| unseen | 4320 | 23.64 | 23.64 | 51.74 | 51.74 |

Unseen fallback comparison (same family-held-out folds): {"neutral":{"n":4320,"median":23.643723841723684,"p80":51.73756742761992},"previousPooled":{"n":4320,"median":19.294212040378163,"p80":37.324204248717066}}

- One month: no temporal validation.
- Five folds balanced within canonical make/model/generation, deduplicated by listing hash.
- Family holdout is stratified by segment and greedily balanced by sample count; indivisible large families cause imbalance.
- CV also selects publication guards; no independent final test. Metrics describe guarded out-of-fit candidates; publication guards reuse CV. Families with fewer than five listings are excluded from seen metrics.
- Dealer asks × configured private-equivalent factor are proxies, not transaction truth.

## Drift versus previous month

No previous month: drift unavailable.
