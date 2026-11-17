# AutoIQ backend plan

Living document. Greenfield build (no prior backend code). Frontend pages are in `design/*.dc.html`;
this backend serves the data those pages show.

## 1. Stack (decided)

| Concern | Choice | Cost | Why |
|---|---|---|---|
| App | Next.js 15 App Router, TypeScript, route handlers under `src/app/api` | Free | Same app as the frontend, deploys on Vercel |
| Database | Postgres (Neon via Vercel Marketplace, pooled URL) | Free tier to start | Relational data, JSON for specs/snapshots |
| ORM | Drizzle + drizzle-kit migrations in `drizzle/` | Free | Typed, light on serverless |
| Auth | Auth.js v5, Google provider, Drizzle adapter, database sessions | Free | Keeps Google sign-in; sessions revocable |
| Validation | zod on every input; shared field schemas in `src/lib/validation.ts` | Free | Requirement |
| Rate limiting | Fixed window in Postgres (`rate_limits`, hashed keys) | Free | Works across serverless instances with no new vendor |
| Jobs | Vercel Cron: daily 09:00 UTC, weekly Mon 10:00 UTC | Free on Hobby (once a day max) | No queue needed at this scale |
| Files | Vercel Blob behind a `FileStore` interface | Free allowance, then usage | Receipts and documents |
| Email | Resend (REST) behind `EmailSender` | Free tier | Simple API, good deliverability |
| Push | Web Push with VAPID (`web-push`) | Free | No vendor |
| SMS | Twilio behind `SmsSender`; logs instead of sending until keys are set | Paid per message + 10DLC registration | Only paid piece; off by default |
| Tests | Vitest, PGlite (in-process Postgres with real migrations), recorded NHTSA fixtures, synthetic MarketCheck fixtures in the documented shape | Free | No network in tests |

## 2. Milestone 0 findings (why every appraisal returned 404)

Verified against live NHTSA responses and MarketCheck docs on 2026-11-12:

1. vPIC returns makes in capitals (`TOYOTA`, `FORD`). MarketCheck examples use lowercase. Fixed: lowercase make/model in the query.
2. vPIC returns slash-joined trims (`L/LE/SE/XLE` for a 2018 Camry) and body-suffixed trims (`GT Coupe` for a 2019 Mustang). Sending those as a trim filter matches nothing. Fixed: split into candidates, strip body words, send `trim` only once the user confirms a single value; fall back to no trim filter with down-weighting when trim-filtered comps are too few.
3. MarketCheck caps `rows` at 50 and silently falls back to 10 above that. Fixed: page in rows of 50.
4. Every failure collapsed into one 404. Fixed: 502 `upstream_failed` (status and body logged server side, key scrubbed), 400 `invalid_input` with field errors, 404 `too_few_comps` with the count, 422 `vin_not_decoded`, 503 `not_configured`.
5. Huge mileage caused a 500. Fixed: zod `mileageSchema` (0 to 999,999), 400 with `fields.mileage`.
6. VIN and ZIP were in the query string. Fixed: `POST /api/appraisals`, JSON body only.
7. Mileage 65000 and ZIP 94538 were defaulted. Fixed: both required, never defaulted.
8. Made-up or mistyped VINs fail the check digit (vPIC ErrorCode 1) but still decode. Treated as a warning (`checkDigitValid: false`), not a rejection.

## 3. Data model

`src/lib/db/schema.ts` is the source of truth. Highlights beyond the original proposal:

- `vehicles` adds purchase price/date/odometer (Vehicle page "Since purchase"), `model_key`, and denormalized `last_private_value` for fast garage lists.
- `odometer_readings` (manual, appraisal, service, purchase) drives miles-per-month.
- `appraisals` adds `report_seq` (per-user; code `AQ-10A`, `AQ-10B`, ...; the letter doubles as "Rev" on the Vehicle timeline), `route`, `engine_version`, `expires_at` (anonymous runs).
- `comps` stores the provider listing id, never other people's VINs.
- `market_watches` (Market page "Watch this market"), `alert_deliveries` (outbox with `not_before` for quiet hours), `notification_settings` (digest mode, quiet hours, verified phone, SMS consent text + time), `sms_verifications` (hashed codes), `push_subscriptions`, `rate_limits`.
- Money is whole dollars (integers); service costs are cents.

## 4. VIN accuracy

What a VIN tells us reliably (vPIC): make, model, year, body, engine, plant. What it does not: trim options, accidents, title brands, mileage, owners. Each fact carries its source.

1. Format check in zod (17 chars, no I/O/Q), then the position-9 check digit (`src/lib/vin.ts`). A mismatch is a 400 on `fields.vin` ("Check character 9 should be X") unless the request says `importedVehicle: true`, which downgrades it to a warning. The design's sample VIN `1FA6P8CF0K5123456` fails; demo and seed data use `1FA6P8CF9K5123456`.
2. vPIC's ErrorCode drives `decodeStatus`: `clean` (0), `check_digit_mismatch` (1 only), `partial` (anything else; shown as "needs your confirmation", never as fact). No make/model/year: 422 `vin_not_decoded`.
3. Model year sanity: later than next year or before 1981 is flagged.
4. Trim: vPIC's raw trim (`L/LE/SE/XLE`, `GT Coupe`, `Supra 3.0`) is split into candidates (body and model words removed). The user picks one; the confirmed trim is stored separately from `specs.trimRaw`. Option packages need paid build-sheet data: TODO(data source).
5. Names: make/model queries use vPIC's values (vPIC says "Supra"; the recalls API returns 0 for "GR Supra" and 8 for "Supra").
6. Cache: `vin_decodes` holds the raw vPIC row and timestamp per VIN; a VIN is decoded once (`src/lib/vin-decode.ts`, the only decode entry point). Logs carry codes and status, never the VIN.
7. Sources shown to the user:

| Fact | Source | Shown as |
|---|---|---|
| Specs | NHTSA vPIC | decoded |
| Recalls | NHTSA recalls API (make/model/year) | "may apply to your model year; confirm by VIN at nhtsa.gov/recalls" |
| Title brands | NMVTIS-approved provider | TODO(data source) |
| Mileage | User | flagged above 25k mi/yr for its age; readings can never go backwards |
| Accidents, owners, condition | User | "you reported" |

## 5. Valuation engine (method 1.1.0)

Pure module `src/lib/valuation/` (no HTTP, no DB); every knob in `src/config/valuation.ts` with its rationale.

1. Comps from MarketCheck, widened step by step and recorded as `searchTier`: (1) year +-1 within 100 mi, (2) year +-1 within 250 mi, (3) year +-2 within 250 mi.
2. Clean the set: de-duplicate by VIN (same car on several sites), drop certified (CPO) listings, drop price outliers with 1.5 x IQR (kept and flagged).
3. Trim: other-trim comps are shifted by the measured trim gap (`trimMatch: adjusted`) or excluded when the gap cannot be measured.
4. Asking is not selling: private value comes from private-seller comps when there are at least 5; otherwise dealer asks are converted with a dealer-to-private spread (-10%, open decision). Stale listings (90+ days) are down-weighted.
5. Weights: mileage closeness, other model year, staleness, trim adjustment. Base = weighted median.
6. Adjustments, one line each: mileage (weighted least squares price-vs-miles slope fitted on the comps; fixed % fallback when the fit is unreliable), regional demand (only when the search widened past the local radius: local vs wider median), condition, accidents, title, and when provided service history, owners, keys, warning lights. Condition/title/accident percentages are documented assumptions.
7. Range from the comps' weighted IQR, widened for few comps, search tier, unconfirmed trim, self-reported condition and missing title data, each reason listed on the report. Instant and retail from configured spreads.
8. Every appraisal stores `methodVersion` and a confidence block (decode status, trim confirmed, self-reported inputs, flags, range reasons, search tier).
9. Accuracy: leave-one-out backtest on the fixtures (median absolute % error must stay under 12%), plus `sale_outcomes` ("what did you get?") to calibrate spreads and the dealer-to-private discount.

## 6. Endpoints

All errors: `{ error: { code, message, fields? } }`. User-scoped routes check ownership and answer 404 for other users' rows.

| Page | Endpoints |
|---|---|
| Identify / Details / Report | `POST /api/vin/decode`, `POST /api/appraisals`, `GET /api/reports/:slug` (public), `POST /api/reports/:slug/claim`, `GET /api/appraisals` (Activity) |
| Garage | `GET/POST /api/vehicles`, `GET/PATCH/DELETE /api/vehicles/:id`, `GET /api/vehicles/:id/overview`, `POST /api/vehicles/:id/odometer`, `POST /api/vehicles/:id/refresh-value` |
| Maintenance + calendar | `GET/POST /api/service-events`, `PATCH/DELETE /api/service-events/:id`, `GET /api/maintenance/{upcoming,log,spend,intervals}` |
| Documents | `GET/POST /api/vehicles/:id/documents`, `DELETE /api/documents/:id` |
| Value tracker | `GET /api/vehicles/:id/value?milesPerYear=`, `GET/POST /api/price-watches`, `DELETE /api/price-watches/:id` |
| Sell or trade | `POST /api/vehicles/:id/sell-plan` |
| Buy | `POST /api/price-check` (public), `GET/POST /api/buy-checks`, `DELETE /api/buy-checks/:id`, `GET /api/buy-checks/compare?ids=` |
| Market | `GET /api/market?modelKey&zip&radius`, `GET/POST /api/market-watches`, `DELETE /api/market-watches/:id` |
| Alerts | `GET /api/alerts`, `PATCH /api/alerts/:id/read`, `POST /api/alerts/read-all`, `GET/PUT /api/notification-prefs`, `POST /api/phone/{send-code,verify}`, `DELETE /api/phone`, `POST/DELETE /api/push-subscriptions` |
| Cron | `GET /api/cron/daily`, `GET /api/cron/weekly` (Bearer `CRON_SECRET`) |

Rate limited (per IP, or per user when signed in): decode 30 / 10 min, appraise 10 / 10 min, price check 10 / 10 min, market 30 / 10 min, SMS code 3 / hour.

## 7. Background jobs

- Daily: refresh garage values (value-change alerts), price watches, market snapshots per garage model/ZIP, market watches, maintenance-due and renewal alerts, deliver queued notifications, purge expired anonymous appraisals and rate-limit rows.
- Weekly: recall check per vehicle, weekly email digest.
- Delivery: in-app always; email (instant or weekly digest), push and SMS per prefs; quiet hours in the user's time zone, except recalls; SMS only to verified numbers with recorded consent.

## 8. Milestones

| # | Scope | Status |
|---|---|---|
| F | Foundation: scaffold, schema, providers + fixtures, errors/http/log, auth, rate limit | done |
| 0 | Appraisal bugs (validation, POST, error mapping, multi-trim) | done |
| 1 | DB, auth, vehicles, appraisal history, share links | done |
| 2 | Valuation engine with tests and fixtures | done |
| 3 | Garage, maintenance, calendar, documents | done |
| 4 | Value tracker, sell or trade, price check, market | done |
| 5 | Alerts, notification prefs, background jobs | done |

212 tests (Vitest + PGlite) pass; `tsc --noEmit` is clean including Next's generated route types.

Work runs in parallel by four agents with file ownership and a shared contract board (`docs/agents/CONTRACTS.md`).

## 9. Decisions I made (you can override)

1. Recalls are checked by make/model/model year (the public NHTSA API does not take a VIN). The UI copy "checked by VIN weekly" should become "checked for your model year weekly", and alerts tell the user to confirm by VIN at nhtsa.gov/recalls.
2. Owners, keys and warning lights do adjust value (small, configurable percentages).
3. Anonymous appraisals are stored for 90 days with a share link, then deleted unless claimed.
4. Public share links show the full VIN (buyers need it) but never the owner.
5. Quiet hours use a per-user IANA time zone (default America/Chicago, editable).
6. The sell planner ships with California rules only; other states get a generic checklist and `stateRulesAvailable: false`.
7. SMS stays in log-only mode until Twilio keys exist.

## 10. Missing data sources (TODO(data source))

Ranked by how much each one moves accuracy or trust.

| # | Gap | Today | Fix |
|---|---|---|---|
| 1 | Sold prices | Asking prices only; dealer asks converted with a fixed -10% | MarketCheck historical/sold listings (plan dependent) plus `sale_outcomes` from users |
| 2 | Model-name mapping vPIC to MarketCheck | Queries use vPIC names ("MX-5", "Supra"); MarketCheck may list "MX-5 Miata RF", "GR Supra". Fixtures match loosely, so tests cannot catch it | Mapping table per make/model, or MarketCheck VIN decode for the query names. Verify with a live key before launch |
| 3 | Title brands, accidents, owners | User-reported, flagged on every report | NMVTIS-approved history provider (`src/lib/buy/service.ts`) |
| 4 | Trim and options | vPIC often returns one trim (2019 Mustang: "GT" only; design shows four) | Build-sheet data, or offer trims seen in local listings (already returned on a trim miss) |
| 5 | VIN-level recall status | Model-year recalls ("may apply") | NHTSA VIN lookup is not in the public API; needs a licensed source (`src/lib/recalls/service.ts`) |
| 6 | Depreciation curve and seasonality | Configured national table (`src/config/forecast.ts`) | Price index or fit per segment from snapshots and sale outcomes |
| 7 | Trade-in spread | Fixed % below instant (`src/config/sell.ts`) | Dealer trade data or user outcomes |
| 8 | Manufacturer maintenance schedules | Generic intervals (`src/config/service-intervals.ts`) | OEM schedule data source |
| 9 | State sell rules | California only | Add `src/config/states/<xx>.ts` per state |

## 11. Open decisions (yours)

1. MarketCheck plan: does it include historical/sold listings? Decides whether the dealer-to-private spread stays a constant.
2. Dealer-to-private spread value (-10% now). Calibrate from `sale_outcomes` once there are ~50.
3. Paid services: Twilio (SMS, plus 10DLC registration), Resend tier, Vercel Blob usage, Neon tier. All are off or free until keys are set.
4. Recall copy: change "checked by VIN" to "checked for your model year" in the design.
5. Public share links show the full VIN. Keep, or mask the last 6?
6. Anonymous appraisal retention (90 days).

## 12. Bug hunt against the running app (2026-11-13)

Exercised every endpoint in a browser against `next dev` with the seeded garage. Fixed, each with a regression test (`tests/bughunt.test.ts`):

1. Unknown trim ("Shelby GT500" on a GT VIN) answered 404 "only 0 comparable listings". Now 400 on `fields.trim` with the trims seen in listings.
2. Missing fields showed zod internals ("expected string, received undefined"). Now "Required." unless the schema has its own message.
3. `PATCH /api/vehicles/:id` with a lower odometer blamed `purchaseOdometer`. Now 400 on `fields.odometer`; conflicts cite the highest reading.
4. Sell plan required `loanPayoff`; now defaults to 0.
5. Market counts included the same car listed on two sites and CPO listings; now de-duplicated like the engine.
6. Watching the same market twice created two watches (double alerts); now returns the existing one.
7. Daily job did not re-value watched buy checks before checking price watches; now it does.
8. `next build` would have failed: the route wrapper's optional `params` broke Next's generated route type check. Fixed.
9. 429 responses now carry `Retry-After`; cron 401 says "Missing or wrong cron secret."
10. Dev only: fixture decoder handles sibling VINs (seeded buy checks), and log-only SMS shows the text in `next dev` so phone verification can be finished locally.

Known, not fixed: seed values are hand-written, so the first daily run moves them to engine values and creates value-change alerts.
