# Frontend build board (agents read this first)

Plan: `docs/frontend-plan.md`. Design spec: `design/*.dc.html` (read `design/README.md`). API: `docs/backend-plan.md` section 6 and the route handlers in `src/app/api/**` (read the handler and its service to learn the exact response shape; never guess).

## Ownership (edit only your own files)

| Agent | Owns |
|---|---|
| lead | `src/app/layout.tsx`, `src/app/globals.css`, `src/components/{ui,Nav,Footer,Logo,ThemeToggle,theme-script,VinInput,RangeBar}.tsx`, `src/lib/client/*`, `src/app/api/**`, `src/app/dev/**`, this file's ownership table |
| landing | `src/app/page.tsx`, `src/app/not-found.tsx`, `src/components/CarDrawing.tsx`, `src/components/landing/**` |
| appraise | `src/app/appraise/**`, `src/app/report/**`, `src/components/appraise/**` (incl. CompsScatter) |
| garage | `src/app/garage/page.tsx`, `src/app/garage/maintenance/**`, `src/app/garage/[vehicleId]/page.tsx`, `src/components/garage/**` (incl. Calendar) |
| tools | `src/app/garage/[vehicleId]/value/**`, `src/app/garage/[vehicleId]/sell/**`, `src/app/buy/**`, `src/app/market/**`, `src/components/charts/**`, `src/components/tools/**` |
| account | `src/app/alerts/**`, `src/app/history/**`, `src/app/sign-in/**`, `src/components/account/**` |

Need a change in a file you do not own (a shared component prop, a CSS rule, an API field)? Message the owner (SendMessage to `lead` or the agent name) with the exact change. Do not edit it yourself. Small page-specific CSS goes in a CSS module next to your page or inline styles, as the designs do.

## How to port a design file

- Markup is inside `<x-dc>` after `</helmet>`. Logic and mock data are in `renderVals()` at the bottom. `{{x}}` = value from renderVals, `<sc-for list="{{items}}" as="item">` = map, `<sc-if value="{{x}}">` = conditional, `onClick="{{fn}}"` = handler.
- Keep the design's class names (`.btn`, `.btn-o`, `.sheet`, `.frame`, `.segs`, `.seg`, `.dim`, `.tbl`, `.num`, `.cell`, `.g2/.g3/.g4`, `.wrap`, `.label`, `.lede`, `.small`, `.mono`, `.vin`, `.cal-row`, `.day`, `.chip`, `.bdg .b1/.b2/.b3`...). They are already in `globals.css`. Convert inline `style="a:b"` to JSX style objects. Keep copy word for word unless a rule below says otherwise.
- Skip the nav, footer and theme toggle: the root layout renders them. Skip the canvas runtime (support.js, x-dc, sc-*, helmet).
- Links between design files map to routes: Main `/`, Appraise-VIN `/appraise`, Appraise-Details `/appraise/details`, Report `/report/[slug]`, Garage `/garage`, Garage-Maintenance `/garage/maintenance`, Vehicle `/garage/[vehicleId]`, Value `/garage/[vehicleId]/value`, Sell `/garage/[vehicleId]/sell`, Buy `/buy`, Market `/market`, Alerts `/alerts`, Activity `/history`, SignIn `/sign-in`. Use `next/link`.
- Replace mock data with the real API through `api()` / `useApi()` from `@/views/components/client/api` (client components, `'use client'`). In local dev the API is signed in as the seeded demo user, so real data exists (3 cars: Mustang GT, MX-5 RF, Supra). Where an endpoint returns less than the design shows, render what exists; never fake numbers in production code.
- Shared components: `Card`, `Field`, `Select`, `SegmentedControl`, `Stepper`, `Skeleton`, `EmptyState`, `ErrorNote`, `PageTitle` (`@/views/components/ui`), `VinInput`, `RangeBar`, `CarDrawing` (props fixed: `variant` gt|muscle|roadster, `label`, `animate`, `callouts`, `markers`). Formatters in `@/views/components/client/format`.

## Rules from the brief (do not break)

1. Cobalt (`var(--blue)`) means "you can act on this" or "this is your car". Everything else is graphite (`--ink`, `--mid`, `--line`).
2. No all-caps labels, no small label above a heading, no "A · B · C" meta strings, no periods at the end of headings. If a design breaks one of these, follow the rule and note it in your report.
3. Numbered markers only for real sequences.
4. Copy is plain and specific. Buttons say what happens. Errors say what went wrong and how to fix it, without apologizing. No em dashes anywhere.
5. Motion: none, except the landing draw-in and the "How we get to the number" scroll explode (landing agent). No fade-ups, no counting numbers, no hover animations beyond the design's color swaps.
6. Accessibility: real `<button>`, `<a>`, `<label>`; visible focus (global rule exists); 44px minimum targets; heading order h1 > h2 > h3; charts get a text summary (`aria-label` or visually hidden table); calendar car badges differ by fill style (`.b1` filled, `.b2` outline, `.b3` dotted), not only color.
7. Phone width (under 820px): grids stack (globals already does `.g2/.g3/.g4`); wrap tables and the calendar in `<div className="scroll-x">`; no horizontal page scroll.
8. Page titles: `<h1 className="title">` (36px). 64px only for the landing headline.
9. Grid paper (`.grid`) and corner marks (`.frame`) only on the landing page, the report and car art.

## States to build where the design is silent

- Loading: `Skeleton` blocks at the final size. No full-page spinners.
- Empty (no cars, no alerts, no maintenance, no saved checks): `EmptyState` with one sentence plus the action.
- 401: `ErrorNote` already shows a sign-in prompt. Other errors: `ErrorNote` with Try again.
- Appraisal errors: field errors inline (`err.fields`), too few comps (`err.details.compCount`, say how many were found and suggest widening the radius), upstream failure (502: "The listing service didn't respond." + Try again), unknown trim (`err.details.trimCandidates`).

## Verify before reporting

- `npx tsc --noEmit` clean (ignore nothing).
- A dev server is already running at http://localhost:3000 (do not start another, do not stop it). Check each of your routes returns 200 with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<route>` and that the API calls your page makes return what you expect (curl the API).
- Do not use the browser pane; the lead does visual QA. Do not commit or push; the lead commits.
- Report: routes built, files created, every place you departed from the design and why, decisions on silent states, anything blocked.

## SendMessage addresses

Use these ids as the `to` value (names alone may not resolve):

| Agent | id |
|---|---|
| landing | a4e7bd7f32dfb0dae |
| appraise | a9028cc129f777d60 |
| garage | aa5f7c39d93a75d2e |
| tools | a2a9ede593244aefd |
| account | ad37b2bd1ede4ec43 |
| lead | the session that spawned you (reply in your final report, or SendMessage to `lead` if supported) |
