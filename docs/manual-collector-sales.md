# Manual collector sales

Humans may transcribe completed sold results from Bring a Trailer and Cars & Bids into `scripts/reference/calibration/manual-sales.csv`. Do not scrape, fetch, crawl or automate either site. This sheet is an offline reference, not wired into calibration. Do not change valuation math to consume it.

Record the source (`Bring a Trailer` or `Cars & Bids`), canonical result URL, sale date (YYYY-MM-DD), make, model, generation, trim, model year, odometer miles, final hammer/sold price in whole USD, transmission and short factual notes. Exclude buyer fees, shipping and taxes from the sale price. Use completed sales only: never “bid to”, reserve-not-met, withdrawn, pending or unsold auctions. Verify the page explicitly says sold; validation cannot verify this for you.

Use the odometer at sale, converting documented kilometres to miles (round to the nearest whole mile and note the conversion). Exclude unknown, ambiguous or true-mileage-unknown cars rather than guessing. Note replacements, modifications and title issues. Do not put seller/buyer names, VINs or other personal data in notes.

Find canonical make/model/generation/trim names in `models/reference/data/msrp.json`. Select an entry whose `yearFrom`–`yearTo` includes the car's model year. Match all four names (case is ignored); do not invent trims. Ask for reference coverage if no entry fits.

Header: `source,url,saleDate,make,model,generation,trim,year,mileage,salePriceUsd,transmission,notes,example`.
Use `manual`, `automatic`, `automated manual`, `cvt` or `single speed` for transmission. Quote CSV cells containing commas or newlines; double embedded quotation marks. Real rows must end in `false`. The three fake demonstration rows end in `true` and are ignored.

Run `node scripts/reference/check-manual-sales.mjs` (or provide a CSV path). Fix every reported row error. Review duplicate URLs and the completed-sale status by hand.

# User-reported outcomes export

Against an explicitly selected local/offline database, run `DATABASE_URL=... npx tsx scripts/export-sale-outcomes.ts /path/to/new-output.csv`. The destination must not already exist. The CSV allowlists `make,model,year,trim,miles,price,route,month` (YYYY-MM). It excludes all IDs, VINs, ZIPs, exact dates and notes. Routes are `private`, `trade`, `instant`, `auction`, and legacy `retail`. Keep route cohorts separate when reviewing calibration data. No production database access is needed for development.
