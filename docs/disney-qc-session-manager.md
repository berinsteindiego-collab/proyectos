# Disney+ QC — Session Manager (implementation plan)

Status: architecture reviewed; no credential or session mutation enabled.

## Existing deployment (preserve)
- Project Control: Next.js on Netlify, currently guarded by shared SITE_PASSWORD.
- QC: render-qc/server.mjs on Render, Chromium headless, one QC at a time.
- Sessions: /etc/secrets/disney-{arg,mx,br}-storage-state.json, generated locally by disney-qc-poc/scripts/export-render-session.mjs.
- Local persistent profiles: disney-qc-poc/auth/profiles/{arg,mx,br}; ignored by Git.
- Do not modify main, the existing QC endpoints, profiles, or Render Secret Files as part of this foundation.

## Access policy
- Every authenticated Project Control user: view market, test-account email, session state; request renewal.
- Administrators only: retrieve or change test-account passwords.
- A shared SITE_PASSWORD cookie is NOT an individual identity or an admin authorization. Do not implement secret reveal until an independently verified server-side admin identity/authorization exists.
- Never put passwords, cookies, tokens, storageState, or authorization headers in Git, Airtable, browser bundles, logs, URLs, or QC results.
- Store credentials in a dedicated secret store with per-role access and audit logging; show password only following explicit admin action, short-lived response and no caching.

## Session states
- connected: authenticated Disney+ home plus verified authorized Explore response.
- login_required: clear login/identity redirect or confirmed authentication rejection.
- service_error: site/bootstrap/network failure without conclusive auth evidence.
- unverified: no recent check, missing secret, or inconclusive check.
- busy: shared Chromium worker already processing QC or a session check.

A captured Authorization header alone is not proof of a valid session. Avoid returning raw URLs, request headers, console text, screenshots, or secret file contents from diagnostic endpoints.

## Renewal architecture (not yet implemented)
The browser used for authentication must update the same durable session state used by Render QC. A popup in the user's local browser cannot directly refresh Render's Secret Files. First select and validate an authorized remote interactive browser/session mechanism, durable storage and atomic replacement strategy; verify Disney+ allows the interaction and any MFA. Do not expose a publicly callable login or secret-management endpoint.

## Rollout
1. Confirm existing local changes are pushed to feature/disney-qc-poc before changing shared files.
2. Add read-only market/account status with non-sensitive emails from server configuration, behind Project Control auth.
3. Add safe diagnostic on Render using the existing qcBusy lock and only coarse status outputs; never run parallel Chromium on Render free tier.
4. Introduce individual/admin identity and server-side authorization, with audit.
5. Validate one end-to-end remote reauthentication on a single test market before rolling out ARG/MX/BR.
6. Integrate secure credential vault and admin-only reveal only after steps 4–5.

## Deployment questions
- Which existing identity provider or user directory can distinguish individual users/admins?
- Is Render service currently persistent beyond Secret Files? Free-tier ephemeral disk cannot be assumed durable.
- Is an approved interactive remote browser available, and is the test-account workflow permitted?
