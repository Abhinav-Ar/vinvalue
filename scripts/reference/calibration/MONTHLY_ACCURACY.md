# Monthly model accuracy

Non-worsening overall holdout median and p80.

Errors are percentages against dealer asks converted to private equivalents; family-separated holdout. WA records only inform aggregated EV overlap.

| Bucket | n | Median before | Median after | p80 after |
|---|---:|---:|---:|---:|
| age:0-5 | 1008 | 16.78 | 15.20 | 29.46 |
| age:11-20 | 536 | 31.96 | 29.67 | 49.71 |
| age:21+ | 34 | 39.35 | 37.50 | 64.51 |
| age:6-10 | 792 | 20.11 | 17.29 | 33.00 |
| segment-age:economy/11-20 | 0 |  |  |  |
| segment-age:economy/21+ | 0 |  |  |  |
| segment-age:economy/6-10 | 74 | 18.25 | 18.25 | 49.20 |
| segment-age:ev/0-5 | 9 | 30.19 | 30.19 | 40.01 |
| segment-age:ev/6-10 | 13 | 10.12 | 10.12 | 25.09 |
| segment-age:fullsize/0-5 | 90 | 24.70 | 24.70 | 37.13 |
| segment-age:fullsize/11-20 | 32 | 26.93 | 26.93 | 35.78 |
| segment-age:fullsize/21+ | 0 |  |  |  |
| segment-age:fullsize/6-10 | 109 | 32.58 | 32.58 | 44.23 |
| segment-age:luxury/11-20 | 0 |  |  |  |
| segment-age:luxury/21+ | 0 |  |  |  |
| segment-age:midsize/11-20 | 3 | 193.27 | 193.27 | 262.14 |
| segment-age:midsize/21+ | 2 | 106.34 | 106.34 | 124.33 |
| segment-age:sports/0-5 | 187 | 30.79 | 30.79 | 59.86 |
| segment-age:sports/11-20 | 155 | 45.14 | 45.14 | 55.10 |
| segment-age:sports/21+ | 3 | 8.47 | 8.47 | 24.89 |
| segment-age:sports/6-10 | 113 | 31.11 | 31.11 | 41.13 |
| segment-age:suv/0-5 | 308 | 20.29 | 15.15 | 22.49 |
| segment-age:suv/11-20 | 251 | 17.97 | 21.45 | 36.31 |
| segment-age:suv/21+ | 6 | 102.41 | 58.26 | 134.62 |
| segment-age:suv/6-10 | 365 | 17.60 | 14.06 | 22.09 |
| segment-age:truck/0-5 | 414 | 10.59 | 10.59 | 22.37 |
| segment-age:truck/11-20 | 95 | 37.27 | 37.27 | 47.60 |
| segment-age:truck/21+ | 21 | 32.16 | 32.16 | 61.68 |
| segment-age:truck/6-10 | 118 | 13.78 | 13.78 | 23.56 |
| segment-age:van/21+ | 2 | 32.50 | 32.50 | 43.56 |
| segment:economy | 74 | 18.25 | 18.25 | 49.20 |
| segment:ev | 22 | 24.14 | 24.14 | 31.96 |
| segment:fullsize | 231 | 27.83 | 27.83 | 39.45 |
| segment:luxury | 0 |  |  |  |
| segment:midsize | 5 | 136.33 | 136.33 | 216.22 |
| segment:sports | 458 | 35.67 | 35.67 | 54.59 |
| segment:suv | 930 | 18.88 | 15.67 | 26.54 |
| segment:truck | 648 | 14.02 | 14.02 | 27.79 |
| segment:van | 2 | 32.50 | 32.50 | 43.56 |

Flagged (>15% median): segment:economy, segment:ev, segment:fullsize, segment:midsize, segment:sports, segment:suv, segment:van

## Drift versus previous month

No previous month: drift unavailable.
