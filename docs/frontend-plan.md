# AutoIQ frontend plan

Built in the same Next.js app as the backend (`src/app`), on branch `frontend`. The approved designs in `design/*.dc.html` are the spec.

## Read-through findings

1. All 19 design files share one identical stylesheet (8.6 KB in each `<helmet><style>`). It is ported once to `src/app/globals.css` with the same class names (`.btn`, `.btn-o`, `.sheet`, `.frame`, `.segs`, `.dim`, `.tbl`, `.cal-row`, ...). Page ports keep those class names, so markup converts almost line for line to JSX.
2. Theme in the designs is a `.bp` / `.bp.night` class pair with CSS variables. Ported as `data-theme="light|night"` on `<html>`; same variables.
3. Grid paper is the `.grid` class; it appears only on Main, Report and Blueprint-Sheet, matching the brief.
4. The live site's old frontend is not in this repo (greenfield), so there is no existing routing or auth UI to preserve. Auth.js (Google) from the backend is unchanged; the sign-in page calls `signIn('google')`.
5. Every number the designs show has a backend endpoint already (see `docs/backend-plan.md` section 6). Pages call the real API; fixtures are only used where an endpoint returns nothing in local dev.

## Routes

| Design | Route | Data |
|---|---|---|
| Main | `/` | static copy; sample numbers |
| Appraise-VIN | `/appraise` | `POST /api/vin/decode` |
| Appraise-Details | `/appraise/details` | decoded specs (session storage) + `POST /api/appraisals` |
| Report | `/report/[slug]` | `GET /api/reports/:slug` |
| Garage | `/garage` | `GET /api/vehicles` |
| Garage-Maintenance | `/garage/maintenance` | `/api/service-events`, `/api/maintenance/*` |
| Vehicle | `/garage/[vehicleId]` | `GET /api/vehicles/:id/overview` |
| Value | `/garage/[vehicleId]/value` | `GET /api/vehicles/:id/value`, price watches |
| Sell | `/garage/[vehicleId]/sell` | `POST /api/vehicles/:id/sell-plan` |
| Buy | `/buy` | `POST /api/price-check`, `/api/buy-checks` |
| Market | `/market` | `GET /api/market`, market watches |
| Alerts | `/alerts` | `/api/alerts`, `/api/notification-prefs` |
| Activity | `/history` | `GET /api/appraisals` |
| SignIn | `/sign-in` | Auth.js |
| NotFound | `not-found.tsx` | none |
| Blueprint-Sheet | none | reference for `CarDrawing` and the 3D look |

## Styling

- One global stylesheet ported from the designs, tokens as CSS variables on `:root` and `[data-theme=night]`. No CSS framework.
- Fonts with `next/font/google`: Schibsted Grotesk (everything, `tnum`), B612 Mono (VINs and drawing dimensions only).
- Type scale variables: 13, 15, 17, 22, 28, 36, 64. App page titles use 36; 64 only on the landing headline.
- Theme: a blocking inline script sets `data-theme` before paint from localStorage, else `prefers-color-scheme`. The nav toggle writes localStorage.
- Focus ring 2px cobalt (yellow at night), 3px offset, on every interactive element. 44px minimum targets.
- Phone (under 820px): grids stack, `.scroll-x` wrappers for tables and the calendar, nav links wrap.

## Shared components (`src/components`)

Nav, Footer, ThemeToggle, Logo, Stepper, VinInput, SegmentedControl, Field, Select, Card (frame variant), RangeBar, Calendar, Skeleton, EmptyState, ErrorNote, charts (ValueChart, MarketLine, PriceBuckets, CompsScatter) and CarDrawing (variants gt, muscle, roadster; callouts, markers, animate). `src/lib/client/api.ts` wraps fetch and turns the backend's error JSON into a typed `ApiError`.

`/dev/components` shows each component (development only).

## States the designs do not show

| State | Decision |
|---|---|
| Field errors | `fields` from the 400 shown under each field, first invalid field focused |
| Too few comps | "We found N similar cars near you; we need 8. Try a wider radius." plus the radius control |
| Upstream failure | "The listing service didn't respond." plus Try again |
| Unknown trim | trims seen in listings offered as choices |
| Empty garage, alerts, maintenance, price checks | one sentence plus the action |
| Loading | skeleton blocks at final size, no full-page spinners |
| Signed out on a private page | short note plus Sign in |

## Motion

Only the landing car draw-in (once) and the "How we get to the number" scroll explode. Everything else is static. Reduced motion shows final states (explode: three still states).

## Build order

1. Tokens, fonts, theme, Nav, Footer, shared components, `/dev/components`.
2. Appraisal flow and report on the real endpoints.
3. Garage, maintenance calendar, vehicle, value tracker, sell or trade.
4. Buy, market, alerts, history, sign-in, 404.
5. 3D car: inspect and optimize the GLB, internals, look, motion, fallbacks. Blocked until `assets/models/source/concept-car-002.glb` is added.
6. QA: Playwright screenshots of every route in both themes at 1440 and 390, axe, Lighthouse.

Steps 2 to 4 run in parallel, one agent per page group, after step 1 lands.

## Dependencies

Allowed by the brief: `three`, `@react-three/fiber`, `@react-three/drei`, `@gltf-transform/cli`, plus `@playwright/test` and `@axe-core/playwright` for QA. Charts are hand-written SVG. No other UI dependencies.
