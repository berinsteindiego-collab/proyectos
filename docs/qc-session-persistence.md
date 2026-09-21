# QC session persistence (implementation stage)

The existing three Render Secret Files remain the default and are not changed.
The backend now supports an OPTIONAL durable store in a **separate PRIVATE GitHub repository**.
This is groundwork for browser-based renewal, NOT a completed login popup.

## Server-only environment variables (Render, never NEXT_PUBLIC_*)
- QC_SESSION_REPO: owner/private-repo (must be a separate private repository)
- QC_SESSION_TOKEN: fine-grained token scoped to that repository with Contents read/write
- QC_SESSION_KEY: random 32-byte key encoded as base64; keep and back up securely

All three must be configured to enable the durable store. Otherwise, the existing
Secret Files remain the source of truth, with no change to current deployments.
A missing market file falls back to its existing Render Secret File.

The server writes only AES-256-GCM encrypted storageState to
qc-sessions/arg.json.enc, mx.json.enc, br.json.enc in the private repository.
The key and token must never be committed or exposed to the browser.
If the private repository is misconfigured or inaccessible, session loading fails
closed rather than silently using an old file. Do not use the public application
repository, even for encrypted sessions.

## Next stage (not yet implemented)
- authenticated, short-lived renewal flow with server-controlled browser;
- user interacts with the real Disney+ login, not a password form on our site;
- saveSession(market, storageState) after verifying the Disney+ session;
- session-status and QC then read the newly saved session.

The current browser-test is only a Chromium smoke test. There is NO working
login popup or renewal action yet. Never send passwords or storageState via chat.
