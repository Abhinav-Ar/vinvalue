# AutoIQ form filler

Load this directory as an unpacked Chrome MV3 extension. Version 2 uses only the
`storage` permission and seven explicit HTTPS hosts. The AutoIQ deployment remains
`https://autoiq-vinvalue.vercel.app`; change the manifest, popup links, and popup tab
query together when deploying on another host. Localhost is deliberately excluded.

Visit AutoIQ while signed in to sync. The **only HTTP API** the extension calls is
`GET /api/extension/garage`, with same-origin session credentials. It returns a
version-1 account-bound DTO derived from owned vehicles and their latest owned
appraisals, including normalized condition answers. It does not use legacy
`/api/garage`, base64 profiles, or browser-supplied appraisal values. Native web
flows remain `/api/vehicles` and `/api/appraisals`; the extension does not write to
either API.

The content script refreshes on visits, focus, visible-page polling, and garage /
appraisal event hints. Events never supply stored answers. Popup opening asks an
available AutoIQ tab to refresh. Sync failures (including 401), invalid DTOs, and
expired snapshots clear private caches. Cached snapshots expire after five minutes
when no AutoIQ tab is open; they cannot detect a remote logout immediately while
offline. Legacy garage/condition storage is removed during sync.

The explicit **Fill supported fields** button sends an extension-runtime message
to supported buyer content scripts. Page scripts cannot use `autoiq:fill` events
to trigger it. No form is submitted. React-native setters and bounded retries
support dynamic controls. Buyer markup remains heuristic: condition clicks require
a recognized fieldset or ARIA question group and unknown answers are left alone.
Review all populated answers before submitting to a buyer. A clean title never
implies no lien. No vehicle data is logged.
