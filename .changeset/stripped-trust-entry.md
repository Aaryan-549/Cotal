---
"@cotal-ai/workspace": patch
---

Use the shared trust-entry check before loading a legacy stripped signer. Dangling and looping split-record links now refuse like other non-regular entries instead of being treated as absent.
