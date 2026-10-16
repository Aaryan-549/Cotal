---
"@cotal-ai/cli": minor
"@cotal-ai/core": patch
"@cotal-ai/auth": patch
---

Allocate a fresh numbered actor for implicit foreground user-auth launches without replacing an existing session or grant. Preserve explicit names, enrollments and managed handoffs, and retry only typed name collisions. Refuse backward connector-store migration even with force or reset, remove unsafe downgrade advice, and make the shell installer identify PATH shadowing and use its absolute installed launcher in next steps.
