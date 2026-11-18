# AutoIQ

Used car valuation and ownership app. Live at https://autoiq-vinvalue.vercel.app

- `design/`: frontend redesign export, one `.dc.html` per page with mock data inline. `canvas.json` is the canvas index.
- Backend plan: `docs/backend-plan.md` (in progress).

Photo lookup is available at `GET /api/photo` and the server-side MarketCheck image proxy at
`GET /api/photo/image?path=...`. Both endpoints validate inputs, rate-limit requests, and keep
`MARKETCHECK_API_KEY` on the server. Missing keys return a structured 503; upstream failures are
temporary and include `Retry-After: 60`.
# Free public-record data

AutoIQ uses Washington EV title-sale records (`rpr4-cgyd`) as a filtered, coarse recorded-sale signal and refreshes registration popularity aggregates from Washington (`brw6-jymh`) and New York (`w4pv-hbkt`). The default listings provider is free and returns no rows for non-EV vehicles. Set `MARKET_DATA_PROVIDER=marketcheck` explicitly to opt into the paid MarketCheck provider.
