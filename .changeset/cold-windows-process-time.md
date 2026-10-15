---
"@cotal-ai/workspace": patch
---

Read Windows process creation time directly through .NET to avoid cold PowerShell cmdlet stalls and preserve native identity pins on fresh setups. Retry a timed-out invocation once with a five-second bound, while other failures and a second timeout leave identity unverified.
