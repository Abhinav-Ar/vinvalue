# Legacy segment-grid diagnostic proposals

Legacy comparison only; this is not the active correction fitter. See FAMILY_REPORT.md for method 2.3.0 family corrections and balanced five-fold validation. Human review required for these legacy grid proposals. Model config was not modified.

Dealer asking → private party factor: 0.9 (configured, not fitted). Matched 4338/4714 samples; match rate 0.9202375901569793. Unknown or ambiguous trims are dropped.

Training: 86311 rows / 134 families. Holdout: 60651 rows / 134 families. Fixed 50/50 family split, shared across both fits.

Observational comparison only: ask/sale date, condition and trim may differ. Comparable EV cells: 22.

## Current config holdout

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 25.76 | 21.18 |
| suv/0-5 | 7912 | 19.19 | 4.55 |
| ev/0-5 | 18725 | 31.90 | 11.88 |
| economy/6-10 | 493 | 70.33 | 66.82 |
| suv/6-10 | 1125 | 46.32 | 43.28 |
| luxury/0-5 | 181 | 16.08 | -8.55 |
| van/0-5 | 138 | 25.95 | -5.95 |
| ev/6-10 | 5716 | 31.09 | 1.91 |
| economy/11-20 | 62 | 82.30 | 80.28 |
| luxury/6-10 | 5 | 11.97 | -11.97 |
| fullsize/0-5 | 107 | 23.07 | -10.97 |
| truck/0-5 | 436 | 15.90 | 1.95 |
| midsize/0-5 | 6 | 5.83 | 3.08 |
| midsize/6-10 | 3 | 14.00 | 0.90 |
| midsize/11-20 | 9 | 86.65 | 84.42 |
| van/6-10 | 2 | 5.14 | 0.79 |
| van/11-20 | 4 | 16.38 | 7.50 |
| suv/11-20 | 253 | 70.22 | 69.33 |
| truck/6-10 | 245 | 24.76 | 10.21 |
| truck/11-20 | 159 | 34.85 | -7.81 |
| truck/21+ | 27 | 40.38 | -15.41 |
| suv/21+ | 21 | 83.81 | 75.14 |
| sports/6-10 | 102 | 33.26 | -31.78 |
| sports/11-20 | 156 | 46.94 | -45.22 |
| luxury/21+ | 1 | 15.82 | -15.82 |
| luxury/11-20 | 1 | 11.36 | 11.36 |
| sports/21+ | 11 | 26.32 | 0.25 |
| sports/0-5 | 86 | 17.69 | -5.30 |
| midsize/21+ | 3 | 116.32 | 116.32 |
| fullsize/21+ | 4 | 67.47 | 67.47 |
| van/21+ | 2 | 32.50 | -18.45 |
| fullsize/6-10 | 112 | 31.04 | -24.15 |
| fullsize/11-20 | 33 | 26.24 | -12.67 |
| economy/21+ | 1 | 22.59 | -22.59 |

## Fit without dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 25.14 | 19.18 |
| suv/0-5 | 7912 | 19.94 | 6.52 |
| ev/0-5 | 18725 | 72.13 | 67.56 |
| economy/6-10 | 493 | 65.37 | 60.71 |
| suv/6-10 | 1125 | 48.78 | 46.15 |
| luxury/0-5 | 181 | 16.94 | -10.38 |
| van/0-5 | 138 | 32.19 | 14.74 |
| ev/6-10 | 5716 | 55.70 | 54.90 |
| economy/11-20 | 62 | 75.79 | 73.07 |
| luxury/6-10 | 5 | 13.73 | -13.73 |
| fullsize/0-5 | 107 | 23.07 | -10.97 |
| truck/0-5 | 436 | 40.74 | 36.61 |
| midsize/0-5 | 6 | 21.64 | 21.64 |
| midsize/6-10 | 3 | 19.07 | 19.07 |
| midsize/11-20 | 9 | 117.61 | 117.61 |
| van/6-10 | 2 | 22.96 | 22.96 |
| van/11-20 | 4 | 31.14 | 31.14 |
| suv/11-20 | 253 | 73.42 | 72.72 |
| truck/6-10 | 245 | 48.44 | 47.69 |
| truck/11-20 | 159 | 42.46 | 23.54 |
| truck/21+ | 27 | 40.61 | 13.36 |
| suv/21+ | 21 | 86.54 | 78.64 |
| sports/6-10 | 102 | 33.26 | -31.78 |
| sports/11-20 | 156 | 46.94 | -45.22 |
| luxury/21+ | 1 | 17.50 | -17.50 |
| luxury/11-20 | 1 | 9.14 | 9.14 |
| sports/21+ | 11 | 26.32 | 0.25 |
| sports/0-5 | 86 | 17.69 | -5.30 |
| midsize/21+ | 3 | 155.26 | 155.26 |
| fullsize/21+ | 4 | 67.47 | 67.47 |
| van/21+ | 2 | 39.64 | -0.50 |
| fullsize/6-10 | 112 | 31.04 | -24.15 |
| fullsize/11-20 | 33 | 26.24 | -12.67 |
| economy/21+ | 1 | 25.69 | -25.69 |

## Fit with dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| economy/0-5 | 1417 | 24.95 | 18.18 |
| suv/0-5 | 7912 | 17.89 | -1.38 |
| ev/0-5 | 18725 | 72.13 | 67.56 |
| economy/6-10 | 493 | 63.00 | 57.66 |
| suv/6-10 | 1125 | 39.52 | 34.68 |
| luxury/0-5 | 181 | 25.74 | -23.19 |
| van/0-5 | 138 | 32.19 | 14.74 |
| ev/6-10 | 5716 | 55.70 | 54.90 |
| economy/11-20 | 62 | 72.53 | 69.47 |
| luxury/6-10 | 5 | 26.06 | -26.06 |
| fullsize/0-5 | 107 | 38.69 | -37.68 |
| truck/0-5 | 436 | 16.30 | 3.99 |
| midsize/0-5 | 6 | 21.64 | 21.64 |
| midsize/6-10 | 3 | 19.07 | 19.07 |
| midsize/11-20 | 9 | 117.61 | 117.61 |
| van/6-10 | 2 | 22.96 | 22.96 |
| van/11-20 | 4 | 31.14 | 31.14 |
| suv/11-20 | 253 | 60.93 | 59.17 |
| truck/6-10 | 245 | 25.18 | 12.42 |
| truck/11-20 | 159 | 34.85 | -5.97 |
| truck/21+ | 27 | 39.78 | -13.71 |
| suv/21+ | 21 | 75.64 | 64.63 |
| sports/6-10 | 102 | 30.91 | -29.05 |
| sports/11-20 | 156 | 45.06 | -43.03 |
| luxury/21+ | 1 | 29.29 | -29.29 |
| luxury/11-20 | 1 | 6.46 | -6.46 |
| sports/21+ | 11 | 25.56 | 4.26 |
| sports/0-5 | 86 | 16.90 | -1.51 |
| midsize/21+ | 3 | 155.26 | 155.26 |
| fullsize/21+ | 4 | 29.31 | 17.23 |
| van/21+ | 2 | 39.64 | -0.50 |
| fullsize/6-10 | 112 | 48.67 | -46.91 |
| fullsize/11-20 | 33 | 40.95 | -38.87 |
| economy/21+ | 1 | 27.24 | -27.24 |

Full proposed segment parameters, source-specific holdout metrics, family split and WA EV factor checks: market-proposals.json.

- WA records lack trims and assume the lowest MSRP tier; interpret their errors and EV overlap accordingly.
- Dealer asks are not sales. Conversion is a configured assumption.
- Only market multipliers are proposed; no automatic config changes.
- 50/50 family holdout shared by both fits; metrics include segment/age cells.
- Sparse segments retain priors; source weighting equalizes source influence.
