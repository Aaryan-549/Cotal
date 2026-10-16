---
"@cotal-ai/core": patch
"@cotal-ai/seat": patch
"@cotal-ai/connector-claude-code": patch
"@cotal-ai/manager": patch
---

A detached Claude Code spawn into a folder Claude has not trusted no longer fails its startup confirmation when Claude draws the trust dialog as a numbered list with Yes first and selected. The managed launch now confirms that layout with Enter, and still answers the layout with No first by moving to Yes before confirming. It never confirms while No is selected. A startup choice can now be marked `optional`, so a choice that never appears does not block the next one. A custom runtime that answers `LaunchSpec.confirmBefore` with its own matcher must honour that flag; runtimes that use the core or seat startup sequence get it already.
