---
"@cotal-ai/workspace": patch
---

Read a process identity pin whose start token has spaces. On macOS the token is `ps -o lstart=` output, such as `Thu Oct 15 21:16:51 2026`, and the pin parser accepted only two whitespace-separated fields. Every pin written on a Mac therefore read back as unattributable: the manager stopped right after boot when it failed its own pin, and `cotal down` refused to stop any component. The parser now reads the pid and keeps the rest of the line as the token, unchanged. Pins written by processes that are already running read correctly once this release is installed.
