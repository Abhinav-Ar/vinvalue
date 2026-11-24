# Market sampling calibration proposals

Human review required. Model config was not modified.

Dealer asking → private party factor: 0.9 (configured, not fitted). Matched 3640/4714 samples; match rate 0.7721680101824353. Unknown or ambiguous trims are dropped.

Training: 86096 rows / 134 families. Holdout: 60168 rows / 134 families. Fixed 50/50 family split, shared across both fits.

Observational comparison only: ask/sale date, condition and trim may differ. Comparable EV cells: 22.

## Current config holdout

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 25.76 | 21.18 |
| suv/0-5 | 7852 | 19.22 | 4.50 |
| ev/0-5 | 18725 | 31.90 | 11.88 |
| economy/6-10 | 493 | 70.33 | 66.82 |
| suv/6-10 | 1007 | 44.25 | 40.85 |
| luxury/0-5 | 181 | 16.08 | -8.55 |
| van/0-5 | 138 | 25.95 | -5.95 |
| ev/6-10 | 5716 | 31.09 | 1.91 |
| economy/11-20 | 62 | 82.30 | 80.28 |
| luxury/6-10 | 5 | 11.97 | -11.97 |
| fullsize/0-5 | 107 | 23.07 | -10.97 |
| truck/0-5 | 384 | 16.96 | 2.20 |
| midsize/0-5 | 6 | 5.83 | 3.08 |
| midsize/6-10 | 3 | 14.00 | 0.90 |
| midsize/11-20 | 9 | 86.65 | 84.42 |
| van/6-10 | 2 | 5.14 | 0.79 |
| van/11-20 | 4 | 16.38 | 7.50 |
| suv/11-20 | 206 | 60.01 | 58.99 |
| truck/6-10 | 134 | 30.42 | 14.56 |
| truck/11-20 | 112 | 35.44 | -22.94 |
| truck/21+ | 27 | 40.38 | -15.41 |
| suv/21+ | 21 | 83.81 | 75.14 |
| sports/6-10 | 89 | 32.57 | -30.88 |
| sports/11-20 | 125 | 46.70 | -44.56 |
| luxury/21+ | 1 | 15.82 | -15.82 |
| luxury/11-20 | 1 | 11.36 | 11.36 |
| sports/21+ | 11 | 26.32 | 0.25 |
| sports/0-5 | 86 | 17.69 | -5.30 |
| midsize/21+ | 3 | 116.32 | 116.32 |
| fullsize/21+ | 4 | 67.47 | 67.47 |
| van/21+ | 2 | 32.50 | -18.45 |
| fullsize/6-10 | 109 | 31.11 | -24.04 |
| fullsize/11-20 | 32 | 26.89 | -12.89 |
| economy/21+ | 1 | 22.59 | -22.59 |

## Fit without dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 25.14 | 19.18 |
| suv/0-5 | 7852 | 19.96 | 6.47 |
| ev/0-5 | 18725 | 72.13 | 67.56 |
| economy/6-10 | 493 | 65.37 | 60.71 |
| suv/6-10 | 1007 | 46.61 | 43.67 |
| luxury/0-5 | 181 | 16.94 | -10.38 |
| van/0-5 | 138 | 32.19 | 14.74 |
| ev/6-10 | 5716 | 55.70 | 54.90 |
| economy/11-20 | 62 | 75.79 | 73.07 |
| luxury/6-10 | 5 | 13.73 | -13.73 |
| fullsize/0-5 | 107 | 23.07 | -10.97 |
| truck/0-5 | 384 | 41.64 | 36.95 |
| midsize/0-5 | 6 | 21.64 | 21.64 |
| midsize/6-10 | 3 | 19.07 | 19.07 |
| midsize/11-20 | 9 | 117.61 | 117.61 |
| van/6-10 | 2 | 22.96 | 22.96 |
| van/11-20 | 4 | 31.14 | 31.14 |
| suv/11-20 | 206 | 62.99 | 62.17 |
| truck/6-10 | 134 | 54.70 | 53.50 |
| truck/11-20 | 112 | 30.06 | 3.26 |
| truck/21+ | 27 | 40.61 | 13.36 |
| suv/21+ | 21 | 86.54 | 78.64 |
| sports/6-10 | 89 | 32.57 | -30.88 |
| sports/11-20 | 125 | 46.70 | -44.56 |
| luxury/21+ | 1 | 17.50 | -17.50 |
| luxury/11-20 | 1 | 9.14 | 9.14 |
| sports/21+ | 11 | 26.32 | 0.25 |
| sports/0-5 | 86 | 17.69 | -5.30 |
| midsize/21+ | 3 | 155.26 | 155.26 |
| fullsize/21+ | 4 | 67.47 | 67.47 |
| van/21+ | 2 | 39.64 | -0.50 |
| fullsize/6-10 | 109 | 31.11 | -24.04 |
| fullsize/11-20 | 32 | 26.89 | -12.89 |
| economy/21+ | 1 | 25.69 | -25.69 |

## Fit with dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 24.95 | 18.18 |
| suv/0-5 | 7852 | 17.92 | -1.43 |
| ev/0-5 | 18725 | 72.13 | 67.56 |
| economy/6-10 | 493 | 63.00 | 57.66 |
| suv/6-10 | 1007 | 37.78 | 32.40 |
| luxury/0-5 | 181 | 25.74 | -23.19 |
| van/0-5 | 138 | 32.19 | 14.74 |
| ev/6-10 | 5716 | 55.70 | 54.90 |
| economy/11-20 | 62 | 72.53 | 69.47 |
| luxury/6-10 | 5 | 26.06 | -26.06 |
| fullsize/0-5 | 107 | 38.69 | -37.68 |
| truck/0-5 | 384 | 17.40 | 4.25 |
| midsize/0-5 | 6 | 21.64 | 21.64 |
| midsize/6-10 | 3 | 19.07 | 19.07 |
| midsize/11-20 | 9 | 117.61 | 117.61 |
| van/6-10 | 2 | 22.96 | 22.96 |
| van/11-20 | 4 | 31.14 | 31.14 |
| suv/11-20 | 206 | 51.49 | 49.45 |
| truck/6-10 | 134 | 31.02 | 16.85 |
| truck/11-20 | 112 | 34.70 | -21.40 |
| truck/21+ | 27 | 39.78 | -13.71 |
| suv/21+ | 21 | 75.64 | 64.63 |
| sports/6-10 | 89 | 32.57 | -30.88 |
| sports/11-20 | 125 | 46.70 | -44.56 |
| luxury/21+ | 1 | 29.29 | -29.29 |
| luxury/11-20 | 1 | 6.46 | -6.46 |
| sports/21+ | 11 | 26.32 | 0.25 |
| sports/0-5 | 86 | 17.69 | -5.30 |
| midsize/21+ | 3 | 155.26 | 155.26 |
| fullsize/21+ | 4 | 29.31 | 17.23 |
| van/21+ | 2 | 39.64 | -0.50 |
| fullsize/6-10 | 109 | 48.63 | -46.82 |
| fullsize/11-20 | 32 | 41.17 | -39.02 |
| economy/21+ | 1 | 27.24 | -27.24 |

Full proposed segment parameters, source-specific holdout metrics, family split and WA EV factor checks: market-proposals.json.

- WA records lack trims and assume the lowest MSRP tier; interpret their errors and EV overlap accordingly.
- Dealer asks are not sales. Conversion is a configured assumption.
- Only market multipliers are proposed; no automatic config changes.
- 50/50 family holdout shared by both fits; metrics include segment/age cells.
- Sparse segments retain priors; source weighting equalizes source influence.
