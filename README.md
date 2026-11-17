# AutoIQ

Used car valuation and ownership app. Live at https://autoiq-vinvalue.vercel.app

- `design/`: frontend redesign export, one `.dc.html` per page with mock data inline. `canvas.json` is the canvas index.
- Backend plan: `docs/backend-plan.md` (in progress).

Photo lookup is available at `GET /api/photo` and the server-side MarketCheck image proxy at
`GET /api/photo/image?path=...`. Both endpoints validate inputs, rate-limit requests, and keep
`MARKETCHECK_API_KEY` on the server. Missing keys return a structured 503; upstream failures are
temporary and include `Retry-After: 60`.
