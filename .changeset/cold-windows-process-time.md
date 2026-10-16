---
"@cotal-ai/workspace": patch
---

Read Windows process creation time through a bundled x64 or arm64 Node-API binding instead of starting PowerShell. Preserve every FILETIME digit and keep access-denied identities unverified. Missing or damaged native bindings fail loudly without a subprocess fallback.
