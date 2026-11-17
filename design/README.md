# AutoIQ design export

One file per page, exported from the "AutoIQ Blueprint Redesign" design canvas.

- Each `.dc.html` file has the page markup (inside `<x-dc>`), its styles (inside `<helmet>`) and its logic and mock data (the `<script type="text/x-dc">` block at the bottom). `{{name}}` placeholders are filled from `renderVals()` in that script.
- These files rely on the canvas runtime (`support.js`), so they will not render on their own in a browser. Treat them as the spec for layout, copy, styles and the data each page needs.
- `canvas.json` lists every page and its title.

Pages: Main (landing), Appraise-VIN, Appraise-Details, Report, Garage, Garage-Maintenance, Vehicle, Value, Sell, Buy, Market, Alerts, Activity, SignIn, NotFound, Blueprint-Sheet (car drawing), plus dark mode versions of Main, Report and Blueprint-Sheet.
