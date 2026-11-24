# Market sampling calibration proposals

Human review required. Model config was not modified.

Dealer asking → private party factor: 0.9 (configured, not fitted). Matched 0/0 samples; match rate n/a. Unknown or ambiguous trims are dropped.

Training: 127 rows / 49 families. Holdout: 144 rows / 49 families. Fixed 50/50 family split, shared across both fits.

No comparable WA EV/dealer cells; factor cannot be validated. Comparable EV cells: 0.

## Current config holdout

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| midsize/0-5 | 2 | 5.73 | 3.43 |
| midsize/6-10 | 1 | 10.03 | -10.03 |
| midsize/11-20 | 2 | 21.63 | 21.63 |
| suv/0-5 | 22 | 12.54 | 3.99 |
| suv/6-10 | 14 | 14.20 | 6.22 |
| suv/11-20 | 16 | 22.63 | 14.55 |
| economy/0-5 | 14 | 11.08 | -2.74 |
| economy/6-10 | 7 | 9.00 | -4.47 |
| economy/11-20 | 10 | 9.14 | 4.37 |
| van/0-5 | 4 | 22.95 | -12.20 |
| van/6-10 | 2 | 7.59 | -7.59 |
| van/11-20 | 2 | 21.99 | 12.55 |
| truck/0-5 | 5 | 10.12 | -3.25 |
| truck/6-10 | 4 | 20.50 | -16.27 |
| truck/11-20 | 6 | 11.89 | 6.18 |
| truck/21+ | 2 | 8.73 | 8.73 |
| suv/21+ | 3 | 12.77 | -6.17 |
| sports/6-10 | 2 | 24.72 | -24.72 |
| luxury/21+ | 2 | 12.80 | -12.80 |
| luxury/11-20 | 3 | 8.53 | 8.53 |
| luxury/0-5 | 1 | 1.72 | 1.72 |
| ev/6-10 | 1 | 51.18 | -51.18 |
| sports/21+ | 8 | 27.05 | 9.50 |
| sports/11-20 | 6 | 65.60 | 61.25 |
| sports/0-5 | 4 | 15.07 | -7.44 |

## Fit without dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| midsize/0-5 | 2 | 5.73 | 3.43 |
| midsize/6-10 | 1 | 10.03 | -10.03 |
| midsize/11-20 | 2 | 21.63 | 21.63 |
| suv/0-5 | 22 | 12.54 | 3.99 |
| suv/6-10 | 14 | 14.20 | 6.22 |
| suv/11-20 | 16 | 22.63 | 14.55 |
| economy/0-5 | 14 | 11.08 | -2.74 |
| economy/6-10 | 7 | 9.00 | -4.47 |
| economy/11-20 | 10 | 9.14 | 4.37 |
| van/0-5 | 4 | 22.95 | -12.20 |
| van/6-10 | 2 | 7.59 | -7.59 |
| van/11-20 | 2 | 21.99 | 12.55 |
| truck/0-5 | 5 | 10.60 | 2.55 |
| truck/6-10 | 4 | 21.73 | -11.25 |
| truck/11-20 | 6 | 14.60 | 12.55 |
| truck/21+ | 2 | 15.26 | 15.26 |
| suv/21+ | 3 | 12.77 | -6.17 |
| sports/6-10 | 2 | 24.72 | -24.72 |
| luxury/21+ | 2 | 12.80 | -12.80 |
| luxury/11-20 | 3 | 8.53 | 8.53 |
| luxury/0-5 | 1 | 1.72 | 1.72 |
| ev/6-10 | 1 | 51.18 | -51.18 |
| sports/21+ | 8 | 27.05 | 9.50 |
| sports/11-20 | 6 | 65.60 | 61.25 |
| sports/0-5 | 4 | 15.07 | -7.44 |

## Fit with dealer samples

| Segment / age | n | MAPE % | Signed % |
|---|---:|---:|---:|
| midsize/0-5 | 2 | 5.73 | 3.43 |
| midsize/6-10 | 1 | 10.03 | -10.03 |
| midsize/11-20 | 2 | 21.63 | 21.63 |
| suv/0-5 | 22 | 12.54 | 3.99 |
| suv/6-10 | 14 | 14.20 | 6.22 |
| suv/11-20 | 16 | 22.63 | 14.55 |
| economy/0-5 | 14 | 11.08 | -2.74 |
| economy/6-10 | 7 | 9.00 | -4.47 |
| economy/11-20 | 10 | 9.14 | 4.37 |
| van/0-5 | 4 | 22.95 | -12.20 |
| van/6-10 | 2 | 7.59 | -7.59 |
| van/11-20 | 2 | 21.99 | 12.55 |
| truck/0-5 | 5 | 10.60 | 2.55 |
| truck/6-10 | 4 | 21.73 | -11.25 |
| truck/11-20 | 6 | 14.60 | 12.55 |
| truck/21+ | 2 | 15.26 | 15.26 |
| suv/21+ | 3 | 12.77 | -6.17 |
| sports/6-10 | 2 | 24.72 | -24.72 |
| luxury/21+ | 2 | 12.80 | -12.80 |
| luxury/11-20 | 3 | 8.53 | 8.53 |
| luxury/0-5 | 1 | 1.72 | 1.72 |
| ev/6-10 | 1 | 51.18 | -51.18 |
| sports/21+ | 8 | 27.05 | 9.50 |
| sports/11-20 | 6 | 65.60 | 61.25 |
| sports/0-5 | 4 | 15.07 | -7.44 |

Full proposed segment parameters, source-specific holdout metrics, family split and WA EV factor checks: market-proposals.json.

- WA records lack trims and assume the lowest MSRP tier; interpret their errors and EV overlap accordingly.
- Dealer asks are not sales. Conversion is a configured assumption.
- Only market multipliers are proposed; no automatic config changes.
- 50/50 family holdout shared by both fits; metrics include segment/age cells.
- Sparse segments retain priors; source weighting equalizes source influence.
