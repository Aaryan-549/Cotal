---
"@cotal-ai/core": patch
"@cotal-ai/seat": patch
"@cotal-ai/connector-claude-code": patch
"@cotal-ai/manager": patch
"@cotal-ai/tmux": patch
"@cotal-ai/cmux": patch
"@cotal-ai/orca": patch
"@cotal-ai/herdr": patch
---

A detached Claude Code spawn no longer fails its startup confirmation when Claude skips the development-channels warning and opens its input screen. Claude 2.1.301 does that when channels are off for the session, for example under a Team or Enterprise organization that has not set `channelsEnabled: true` in managed settings. Such a seat now stays up, and gets mesh messages through its hooks only, so a message does not wake it while it is idle. When the warning appears it is still answered with one Enter, and an unknown startup dialog still gets no key and fails within 15 seconds. A launch recipe can now declare `LaunchSpec.confirmReady`, texts that show the harness reached its input screen. Seeing one on two screen reads in a row ends the startup watch with no key. The PTY, tmux, cmux, Orca and Herdr runtimes honour it; a custom runtime that ignores it keeps failing such a launch as before.
