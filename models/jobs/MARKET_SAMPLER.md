# Monthly MarketCheck research sampling

Apply migration `0003_market_samples.sql` through the normal deployment process.
No database migrations or live requests were run during implementation.
`market_samples` stores normalized asks and a SHA-256 VIN (preferred) or listing-id
hash, unique per month. No raw VIN, dealer name, address, media or response body is
stored. `market_sample_usage` persists calls, cursor, stop reason, response quotas
and a tokenized 70-second lease. Call reservations are atomic, before requests;
crashes spend the reservation and may repeat the page after lease expiry.

Cron: `/api/cron/sample-market`, `0 11 2-16 * *` (11:00 UTC).
This is a monthly campaign in 15 resumable chunks, at most 35 calls/45 seconds each,
inside the route's 60-second limit. Runs after completion/budget/stop are no-ops.
Existing CRON_SECRET auth applies. Local command uses the same DB budget:
`npx tsx --env-file=.env.local scripts/sample-market.ts`.
Do not run this until the key, migration and target DATABASE_URL are reviewed.

Default cap 450 attempted calls/calendar month UTC; configurable downward in
`models/config/marketSampling.ts`, always hard-clamped to 450. Retries spend calls.
Full-budget allocation: trucks 135; SUVs/off-roaders 112; performance 90; luxury 45;
mainstream control 68. Retries can reduce completed queries in each segment.
Eight rotating ZIPs: Seattle, Los Angeles, Phoenix, Denver, Dallas, Chicago,
Atlanta, New York. Anchored individual years rotate across 1–4, 5–9, 10–15 and
16–25 year age buckets. Only make/model/year combinations in msrp.json qualify.
One 50-row first page per query favors breadth over deeply paging one metro.

Radius is always 1–100 miles. Requests are serial, paced 250 ms apart; only network
and 5xx failures retry (twice, with one-second spacing). All responses record
quota-remaining, ratelimit-remaining and ratelimit-reset-time. Quota <=50,
401/402/403/429 and quota/payment/subscription/retired-key bodies persist a stop for
the month. Other 4xx/malformed payloads stop without retry. Rate exhaustion ends
the run and subsequent runs honor the recorded reset time (unknown reset fails
closed). A new month gets a new budget. Do not clear a stop without investigating.

Live appraisals do not import this job. MARKET_DATA_PROVIDER remains opt-in and
unchanged. Tests use injected recorded-style responses and an in-memory PGlite.
Calibration writes reviewable proposals, never changes production parameters.
