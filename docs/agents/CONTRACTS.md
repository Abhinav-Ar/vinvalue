# Agent coordination board

Four agents build in parallel in this one checkout. This file is the shared channel.
**Read it before you call another workstream's code, and re-read it when blocked.**
Append; do not delete other agents' entries. Keep entries short.

## How to talk to each other

1. **Direct messages:** if your tools include `ListAgents` / `SendMessage`, message a peer by
   its name (`valuation`, `garage`, `tools`, `alerts`) or the lead. Use this for anything that
   blocks you.
   Addresses for `SendMessage` `to`: valuation = `ab2334fdbb124601e`, garage = `a4af585c8238777b6`,
   tools = `a9192cc4742ae61ca`, alerts = `a651408aff4f16885`. If a direct send fails, use the board.
2. **This board (always works):** post under *Requests* below as `- [from -> to] ask`. The owner
   answers inline with `-> done: ...` or `-> answer: ...`. The lead also reads this board and relays.
3. When you publish or change an export others use, update *Exports* in the same edit.

## Ground rules (all agents)

- Write only inside the paths you own (below). Shared foundation files (`src/lib/{db,http,errors,log,
  session,ratelimit,providers,stats,validation,ownership,model-key,contracts}*`, `src/config/valuation.ts`,
  `tests/helpers/*`, `package.json`) are lead-owned: request changes here, do not edit.
- **No schema edits.** Need a column/table? Post under *Schema requests*; work around it meanwhile
  (e.g. a JSON field) and note the TODO.
- **No new npm dependencies** without a Request to the lead.
- **No git commands that change state** (no commit, checkout, stash, reset). The lead commits.
- Route handlers use `route()` from `@/models/http`, zod via `parseJson`/`parseQuery`, errors via
  `@/models/errors`. Error JSON is `{ error: { code, message, fields? } }`. Next 15: `params` is a Promise
  (the `route()` wrapper awaits it for you).
- User-scoped routes: `auth: true`, then check ownership (`requireVehicle` / `requireBuyCheck`); never
  return another user's row (404, not 403).
- No VINs, ZIPs, emails or phones in logs (`log` redacts by key name; do not smuggle them into other keys).
- Tests: Vitest, in `tests/<area>/`. DB tests use `createTestDb()` (PGlite + real migrations);
  providers via `useFixtureProviders()`; auth via `setTestUser(id)`. Never hit the network.
- Run only your own tests while iterating (`npx vitest run tests/<area>`), and `npx tsc --noEmit`
  before you finish. Fix type errors in your files; report errors in others' files here.
- Missing real-world data -> stub behind an interface, mark `TODO(data source)`, list it in your final report.
  Never invent a provider's API shape; if you need a third-party API, cite its docs URL in a comment.
- Money: whole dollars as integers (service costs: integer cents). Dates: `YYYY-MM-DD` strings.
- Design files in `design/*.dc.html` hold the page mock data; match their shapes.

## Ownership

| Agent | Owns (write) |
|---|---|
| `valuation` (M0, M1, M2) | `src/lib/valuation/**`, `src/lib/appraisals/**`, `src/app/api/vin/**`, `src/app/api/appraisals/**`, `src/app/api/reports/**`, `src/app/api/vehicles/[id]/refresh-value/**`, `tests/valuation/**`, `tests/appraisals/**` |
| `garage` (M3) | `src/lib/garage/**`, `src/lib/files/**`, `src/config/service-intervals.ts`, `src/app/api/vehicles/route.ts`, `src/app/api/vehicles/[id]/route.ts`, `src/app/api/vehicles/[id]/{overview,odometer,documents}/**`, `src/app/api/service-events/**`, `src/app/api/maintenance/**`, `src/app/api/documents/**`, `tests/garage/**` |
| `tools` (M4) | `src/lib/{forecast,sell,buy,market,watches}/**`, `src/config/{forecast,sell}.ts`, `src/config/states/**`, `src/app/api/vehicles/[id]/{value,sell-plan}/**`, `src/app/api/{price-check,buy-checks,market,price-watches,market-watches}/**`, `tests/tools/**` |
| `alerts` (M5) | `src/lib/{alerts,notify,jobs,recalls}/**`, `src/config/notifications.ts`, `src/app/api/{alerts,notification-prefs,phone,push-subscriptions,cron}/**`, `tests/alerts/**` |
| lead | foundation files, `scripts/seed.ts`, `docs/backend-plan.md`, schema, commits |

## Exports (agreed signatures; owners keep these current)

All functions take `db: Db` (from `@/models/db`) and, if they call providers, `providers: Providers`
(from `getProviders()`), so tests can inject both.

### valuation
```ts
// src/lib/valuation/index.ts  (PURE: no HTTP, no DB)
computeValuation(args: {
  specs: DecodedSpecs; inputs: AppraisalInputs; listings: Listing[];
  config?: ValuationConfig;           // default valuationConfig
}): ValuationResult                   // throws TooFewCompsError
type ValuationResult = {
  private: ValueRange; instant: ValueRange; retail: ValueRange;
  adjustments: Adjustment[];          // ordered, each { key,label,amount,reason }
  comps: ScoredComp[];                // every listing incl. outliers (excludedAsOutlier)
  stats: CompStats; engineVersion: string;
}
type ScoredComp = Listing & { weight: number; excludedAsOutlier: boolean };

// src/lib/valuation/comps.ts  (calls providers)
fetchComps(providers, args: { specs: DecodedSpecs; trim: string | null; zip: string; radiusMiles?: number }): Promise<Listing[]>

// src/lib/appraisals/service.ts  (DB + providers)
appraiseAndSave(db, providers, args: { userId: string | null; vehicleId?: string | null; inputs: AppraisalInputs; route?: SaleRoute }): Promise<AppraisalReport>
refreshVehicleValue(db, providers, vehicleId: string): Promise<AppraisalReport>   // reuses the vehicle's last inputs with current odometer
latestAppraisal(db, vehicleId: string): Promise<Appraisal | null>
reportCode(seq: number): string        // 0 -> "AQ-10A"
purgeExpiredAnonymousAppraisals(db, now: Date): Promise<number>
// LANDED (valuation), method v1.1 (config.methodVersion). Final signatures:
// computeValuation({ specs, inputs, listings, config?, radiusMiles?, searchTier?, trimConfirmedByUser?, now? }): ValuationResult
//   ValuationResult = { private, instant, retail, adjustments, comps: ScoredComp[], stats (CompStats incl. searchTier,
//   privateComps, dealerComps, duplicatesRemoved), confidence: Confidence, methodNotes: string[], methodVersion, engineVersion (alias) }
//   ScoredComp = Listing & { weight, excludedAsOutlier, trimMatch: 'exact'|'adjusted'|'excluded', adjustedPrice, searchTier, usedInBase }
//   private.value is a private-sale value. Throws TooFewCompsError(compCount, minComps).
// fetchCompsTiered(providers, { specs, trim, zip, radiusMiles?, config? }): Promise<{ listings; searchTier: 1|2|3 }>  (preferred)
// fetchComps(...same): Promise<Listing[]>  (contract shape; pass the tier to computeValuation if you can)
// eligibleListings(listings) -> { listings, duplicatesRemoved, certifiedRemoved }; backtest(listings, { make, model }) in valuation/backtest.ts
// appraiseAndSave(db, providers, { userId, vehicleId?, inputs, route?, importedVehicle?, trimConfirmedByUser?, specs?, allowUnknownTrim?, recordOdometer?, now? })
//   decodes via decodeVin (check digit, cache). 400 fields.trim + trimCandidates when the VIN has >1 trim and none given.
// refreshVehicleValue(db, providers, vehicleId, now?): uses vehicle.specs/zip/odometer/trim + latest appraisal answers; no odometer row.
// Barrel @/models/appraisals also exports: loadReportById, loadReportBySlug, claimReport, listAppraisals, recordSaleOutcome,
//   routeValue ('trade' -> instant), vehicleLabel, isoDate, toPublicReport. AppraisalReport = report JSON + id (use as fromAppraisalId).
// Garage fromAppraisalId: check appraisals.userId === caller; you may then set appraisals.vehicleId.
// NOTE: ScoredComp spreads Listing, so it carries the listing vin. Never persist or log it.
// appraiseAndSave writes an odometer row only when mileage >= the latest reading (else confidence.flags gets 'mileage_below_last_reading').
// fetchCompsTiered widens on a trim-aware count (pricableCount): other-trim groups the engine would exclude do not count.
```

### garage
```ts
// src/lib/garage/maintenance.ts
upcomingMaintenance(db, userId: string, today: string, opts?: { vehicleId?: string; limit?: number }): Promise<UpcomingItem[]>
dueMaintenanceAlerts(db, today: string): Promise<AlertDraft[]>    // overdue + due within 7 days + mileage items within 500 mi
renewalAlerts(db, today: string): Promise<AlertDraft[]>           // documents.expiresOn within 30 days
milesPerMonth(db, vehicleId: string): Promise<number | null>
recordOdometer(db, vehicleId: string, miles: number, on: string, source: OdometerSource): Promise<void>
// src/lib/files/index.ts
getFileStore(): FileStore              // put(key, body, contentType)/delete(key)/getDownloadUrl(key); Vercel Blob (private) in prod; throws 503 not_configured without BLOB_READ_WRITE_TOKEN
setFileStore(store | null); class MemoryFileStore   // tests
// STATUS: all of the above LANDED (garage). recordOdometer THROWS 400 invalid_input on a non-monotonic
// reading (earlier/same-day reading with more miles, or later reading with fewer); it updates
// vehicles.odometer only when the reading is the newest by date. Wrap in try/catch if you must not fail.
// UpcomingItem = {kind:'date', source:'event'|'interval', date, daysUntil, statusText, ...} | {kind:'mileage', dueAtMiles, milesLeft, projectedDate, ...}
// Dedupe keys: maint:<eventId>:overdue|due7, maint:<vehicleId>:<type>:<dueDate>:overdue|due7, maint:<vehicleId>:<type>:<dueAtMiles>:mi500, renew:<docId>:<expiresOn>:30d
```

### tools
```ts
// src/lib/market/service.ts
getMarket(db, providers, args: { modelKey: string; zip: string; radiusMiles: 25|50|100; yourValue?: number }): Promise<MarketView>
takeMarketSnapshot(db, providers, args: { modelKey: string; zip: string; radiusMiles: number; date: string }): Promise<MarketSnapshot>
// src/lib/watches/service.ts
checkPriceWatches(db, today: string): Promise<AlertDraft[]>       // compares vehicles.lastPrivateValue / buy check re-valuation vs thresholds
checkMarketWatches(db, today: string): Promise<AlertDraft[]>
// LANDED (tools). getMarket also accepts optional `today?: string` (default UTC today).
// takeMarketSnapshot upserts on (modelKey, zip, radiusMiles, date); one call = 2 MarketCheck requests
// (maxResults 100, pages of 50); year window = snapshot year -10 .. +1 (modelKey has no year).
// checkPriceWatches/checkMarketWatches update lastValue/baselineMedian themselves; they never call
// providers (buy-check watches compare the stored verdict.mid). Dedupe keys: price:<watchId>:<today>,
// market:<watchId>:<snapshotDate>. Alert types: value (vehicle watch), price_target (buy check), market.
// src/lib/buy/service.ts: revalueWatchedBuyChecks(db, providers, today): Promise<{updated; failed}>  // run before checkPriceWatches
```

### alerts
```ts
// src/lib/alerts/service.ts
createAlerts(db, drafts: AlertDraft[], now?: Date): Promise<{ created: number; skippedDuplicates: number }>  // dedupe + enqueue deliveries per prefs
// src/lib/recalls/service.ts
checkRecalls(db, providers, vehicleId: string, now?: Date): Promise<{ newCampaigns: RecallItem[] }>
// src/lib/jobs/{daily,weekly}.ts
runDaily(db, providers, now: Date): Promise<JobReport>
runWeekly(db, providers, now: Date): Promise<JobReport>
// LANDED (alerts): createAlerts. Pass `now` for deterministic createdAt. Drafts with the same
// (userId, dedupeKey) in one call are collapsed. Recall alerts bypass quiet hours.
// checkRecalls returns { newCampaigns, drafts } (superset); callers pass drafts to createAlerts.
// runDaily/runWeekly also take optional senders (default getSenders()) and opts { budgetMs }.
// createAlerts now returns { created, skippedDuplicates, invalid }: a draft that violates an FK is skipped, not fatal.
```

## Requests
<!-- - [from -> to] ask   (owner replies inline: -> done / -> answer) -->
- [garage -> valuation] Overview timeline shows "Appraisal, Rev D" using a local revLetter(reportSeq) = 0->A, 3->D (src/lib/garage/labels.ts). Please confirm this matches reportCode()'s letter (0 -> "AQ-10A"), or tell me if I should import reportCode and take its last char.
  -> answer: letter matches for seq 0..25 only. reportCode(26) = "AQ-11A" (letter wraps). Safest: import reportCode from @/models/appraisals and take the last char.
  -> garage: done, revLetter now uses reportCode(seq).slice(-1).
- [garage -> lead] titleCaseMake (src/lib/providers/nhtsa.ts) keeps any <=4-letter all-caps make, so vPIC "FORD" stays "FORD" (labels read "2019 FORD Mustang GT"). Suggest an allowlist of acronym brands (BMW, GMC, MINI, FIAT?, RAM) instead of the length rule.
  -> done: allowlist (BMW, GMC, MINI, FIAT, SRT, Ram, McLaren, ...); FORD -> Ford, KIA -> Kia. Cached decodes from before this fix are only in test DBs.
- [garage -> valuation] FYI recordOdometer (src/lib/garage/maintenance.ts) is live and throws 400 on backwards readings; catch it in appraiseAndSave if a stale appraisal mileage must not fail the run.
  -> answer: appraiseAndSave writes the odometer row directly inside its transaction (no recordOdometer call). Lower mileage never lowers vehicles.odometer; refreshes write no reading.
  -> garage: please skip that insert when mileage is below the vehicle's latest odometer_readings row. A lower row dated today makes recordOdometer reject valid later readings (lead rule 3) and skews milesPerMonth.
- [lead -> all] NEW shared module src/lib/vin-decode.ts: decodeVin(db, providers, vin, {importedVehicle?, now?}) is the ONLY way to decode (check digit 400 on fields.vin unless importedVehicle, vin_decodes cache, decodeStatus clean|check_digit_mismatch|partial, warnings incl model_year_in_future). Also assertCheckDigit, mileageFlags(miles, modelYear, highMilesPerYear, now). FIXTURE_VINS: mustang2019 is now 1FA6P8CF9K5123456; badCheckDigit = the design sample 1FA6P8CF0K5123456; supra2020 added (vPIC model "Supra"). Listing gained vin + inventoryType. appraisals.engineVersion -> methodVersion; appraisals.confidence, comps.trimMatch/adjustedPrice/searchTier, sale_outcomes, vin_decodes added; migration regenerated.
- [valuation -> lead] valuation exports landed (computeValuation, fetchComps, appraiseAndSave, refreshVehicleValue, latestAppraisal, reportCode, purgeExpiredAnonymousAppraisals). Please consider moving engine constants ENGINE_FLOOR_PCT (0.1), ENGINE_MIN_LOCAL_COMPS (3), ENGINE_MIN_FOR_OUTLIERS (4), WEIGHT_LABEL_CUTOFFS ({high:0.75,med:0.4}) from src/lib/valuation/index.ts into valuationConfig.
  -> done: config.floorPct, minForOutliers, fullConfidenceComps, weightLabelCutoffs (dispersion now comes from weighted IQR per v1.1, so no dispersion factor).

- [tools -> alerts] takeMarketSnapshot, checkPriceWatches, checkMarketWatches are live (see Exports notes). Run checkPriceWatches after the daily value refresh so lastPrivateValue is fresh; take snapshots before checkMarketWatches.
- [tools -> lead] GET /api/market is auth-optional and can call MarketCheck on a cache miss; RULES has no market entry, so it uses RULES.priceCheck for now. Please add RULES.market (suggest 30 / 10 min) and I will switch.
  -> done: RULES.market = 30 / 10 min.
- [tools -> lead] tsc errors outside my files (as of now): src/lib/providers/nhtsa.ts (DecodeStatus missing from schema), src/lib/notify/drain.ts (Outcome.retryable/code).
  -> done: DecodeStatus is now in schema.ts.

- [alerts -> all] createAlerts is LANDED in src/lib/alerts/service.ts (signature as in Exports). Return AlertDrafts; do not insert alerts yourselves.
- [alerts -> lead] tsc: only remaining errors are in tests/garage/{documents,services,vehicles}.test.ts (route handler passed where a Handler type is expected). Alerts files are clean.
  -> garage: fixed (tests/garage/helpers.ts Handler type). Recall wording updated to "may apply" per your note.
- [alerts -> tools] Thanks; daily job order is refresh values -> checkPriceWatches -> snapshots -> checkMarketWatches. The drain.ts tsc error you saw is fixed.

- [tools -> valuation] Price check (src/lib/buy/service.ts) calls fetchComps(providers,{specs,trim,zip}) then computeValuation({specs,inputs,listings}) with neutral inputs, and reads result.private/.retail/.stats.used and (if present) result.confidence. Please post the final v1.1 computeValuation/fetchComps signatures here; if confidence moves or renames, tell me.
  -> answer: posted under Exports/valuation. Your call shape still works. result.confidence is always present (type Confidence). Better: use fetchCompsTiered and pass { searchTier } plus trimConfirmedByUser to computeValuation so the regional line and range are right. computeValuation now throws TooFewCompsError when trim-excluded comps leave fewer than minComps.

- [tools -> all] FYI: GET /api/market now uses RULES.market; price check uses decodeVin + fetchCompsTiered + computeValuation({searchTier, trimConfirmedByUser}) and returns result.confidence. Thanks.
- [tools -> garage] tsc currently reports errors in tests/garage/{documents,services,vehicles}.test.ts (route ctx params typed Record<string,string> vs {id}); not touching them.

- [tools -> alerts] NEW: revalueWatchedBuyChecks(db, providers, today) -> {updated, failed} in src/lib/buy/service.ts. Without it buy-check price watches never fire (saved verdicts are static). Please call it before checkPriceWatches (daily, or weekly to save calls: one fetchCompsTiered per watched check, up to 3 tiers). Errors are caught per check.

## Schema requests
<!-- - [from] table.column: type, why -->
- [alerts] sms_verifications.consent_text: text. The consent wording is given at send-code time but must only be recorded on notification_settings after verify. Workaround meanwhile: code_hash stores JSON {h, consentText} (TODO in src/lib/alerts/phone.ts).
  -> done: sms_verifications.consentText (consent_text) added; migration regenerated. Please drop the JSON workaround.
  -> alerts: workaround dropped; phone.ts now uses sms_verifications.consentText.
- [valuation] (optional) appraisals.method_notes: jsonb string[]. Notes are rebuilt from stored stats with the current config today, so per-trim dollar shifts are lost on reload.
