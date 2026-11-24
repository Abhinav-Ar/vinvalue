# Model correction, method 2.2.0

Run locally with Node 22, PROVIDERS unset and an explicit local DATABASE_URL:
`npx tsx scripts/calibrate.ts --local-db`. Apply migration 0005 first.
This command never invokes a provider. It writes the versioned JSON fallback,
monthly JSON/Markdown reports, and the local DB active snapshot/report.

The monthly authenticated cron at /api/cron/calibrate runs on day 17 after the
sampling window. It uses stored samples only, serializes publication with a row
lock, and is idempotent per month. It stores JSON, Markdown and drift in
valuation_accuracy_reports; Vercel never writes files. The local script forces
recomputation for reproducibility. Deployment must apply 0005; 0004 is reserved
for the separate sale-feedback branch. Export a reviewed DB snapshot to update
the repository fallback in subsequent months.

Only current-month, uniquely joined MSRP samples enter fitting. Exact make/model,
model aliases, year, trim aliases and transmission constraints are honored.
Unknown/ambiguous trims are excluded. Each make/model family is deterministically
assigned to exactly one of two equally sized family partitions. No brand or age
terms are fitted; segment-only cells avoid small-cell overfitting.

Training medians of log(private-equivalent ask / uncorrected surface) are shrunk
by n/(n+60), then exponentiated and clamped to [0.75, 1.25]. Each partition needs
30 observations and two families in the segment. Candidate holdout median and
p80 percentage errors must both be no worse than the active correction. Overall
holdout median and p80 must also be non-worsening. Failed cells retain their
previous correction; absent cells use 1.0. Reports record decisions and candidate
metrics, including retained cells. The same holdout is used to guard publication,
so it is a validation set, not an untouched estimate of future accuracy.

Apply the correction after the surface only in model mode, before history
adjustments and rounding. Comp normalization never uses it. Appraisals read the
validated DB snapshot and fall back to committed JSON for missing/invalid rows
or a missing migration table. Other DB failures propagate. Report notes include
the factor and snapshot timestamp. Historical appraisals retain their audit.

Dealer conversion defaults to 0.90. WA comparison uses medians in canonical
make/model/year/10,000-mile/calendar-month cells, requiring five observations on
each side. At least ten overlapping cells and five independent EV families,
a family-ratio range no wider than 0.10, and a plausible estimate are necessary
to replace 0.90. The family range is a conservative uncertainty interval, not a
causal confidence interval. WA lacks trims and is geographically restricted.
There is no supported inference when contemporary overlap is absent.

Monthly errors are absolute percentage errors against converted asks. Metrics
include median/p80 by segment, age and segment/age on held-out families, month
over month percentage-point drift, and flags for segment median error >15%.
No prior month means unavailable drift, never zero drift.

The legacy proposal comparison retains original observation weights and exact
grid arithmetic. Per-observation joins/surface components are computed once;
only the final market multiplier varies in the grid. WA medians are used by
the new bias/dealer-factor pipeline, not substituted into the legacy objective
(which would change its numerical results). MSRP lookup is indexed by canonical
make and model aliases; reference snapshots must be treated as immutable.
Skipped proposal rows are summarized by reason instead of repeating DMV hashes.
