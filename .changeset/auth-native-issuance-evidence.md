---
"@cotal-ai/auth": minor
"@cotal-ai/core": minor
---

Every auth-callout success now records its broker-generated user key before the minted JWT leaves. `startAuthCallout` takes a required `recordIssuance`, and refuses to start without one. The authority plane's recorder writes one create-only `natkey.<userNkey>` row in the space's auth bucket with the bearer's own space, owner, actor, lifecycle, credential and view and the minted JWT's `iat`/`exp`, then re-checks the connect authority before the response. A failed write, an existing row for the key, or a revocation seen by that re-check is a signed deny. Core adds `nativeIssuanceKey`. Connections admitted before this change, and static JWTs, have no row.
