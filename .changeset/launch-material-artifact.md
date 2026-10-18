---
"@cotal-ai/connector-core": minor
"@cotal-ai/connector-claude-code": patch
"@cotal-ai/connector-codex": patch
"@cotal-ai/connector-hermes": patch
"@cotal-ai/connector-jcode": patch
"@cotal-ai/connector-opencode": patch
"@cotal-ai/pi": patch
"@cotal-ai/core": patch
---

A seat's launch-material directory (`cotal-launch-*` in the OS temp dir, holding the broker URL, the creds path and the control token) is now removed when the seat's process exits. Before this change a Claude seat left it behind after `cotal stop`, while the persona file and control socket of the same launch were removed. `materialEnv` in `@cotal-ai/connector-core` now takes the launch's artifact array as a second, required argument and appends the material's private directory to it, and every connector returns that array on `LaunchSpec.artifacts`, so the manager, the pty runtime and the foreground `cotal spawn` remove it the way they remove a persona file. Each connector now writes the material after its last refusal, so a refused launch leaves no material file behind. The second material file the Hermes launcher writes for its gateway child is not covered by this change.
