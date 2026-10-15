---
"@cotal-ai/workspace": patch
"@cotal-ai/cli": patch
"@cotal-ai/manager": patch
"@cotal-ai/delivery": patch
---

Stop local Windows managers and delivery daemons through an authenticated process-bound cleanup request, so immediate restart can acquire leases released by the previous generation. Keep identity checks, stop reservations and the existing one-shot agent-reap policy. Refuse older Windows daemons without this capability instead of force-terminating them without cleanup.
