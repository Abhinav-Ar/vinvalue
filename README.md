# AutoIQ

AutoIQ estimates trade-in, private-sale, and dealer-retail value from current comparable listings. It decodes VINs with NHTSA data and explains the evidence and adjustments behind each range.

## Local setup

Use Node.js 20.9 or newer, then install dependencies and create `.env.local`:

```env
AUTH_SECRET=generate-a-long-random-value
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
DATABASE_URL=your-postgres-connection-string
MARKETCHECK_API_KEY=your-marketcheck-key
```

Google OAuth must include this local redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Production currently uses:

```text
https://autoiq-vinvalue.vercel.app/api/auth/callback/google
```

Run the application:

```bash
npm run dev
```

## Verification

```bash
npm run lint
npm run build
```

## Data semantics

- Prices are estimates based on active asking-price comparables, not guaranteed offers or completed-sale prices.
- NHTSA model-level recall campaigns are shown as campaigns to verify. They are not represented as VIN-specific open recalls.
- Market listing photos are representative unless explicitly supplied by the owner.
- Shared seller reports contain seller-provided condition information and should not be described as independently verified.

The schema required by Auth.js and AutoIQ is in `supabase/schema.sql`. Any PostgreSQL provider can be used; Supabase is not required by the application code.
