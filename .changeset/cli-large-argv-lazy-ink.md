---
"@cotal-ai/cli": patch
---

A `cotal` command started with a few hundred KB of argv, such as `cotal send dm <name> "<480 KB text>"`, no longer exits 13 before it runs. The CLI loaded Ink and its wasm layout engine at startup for every command, and on macOS that engine's init never finished with an argv that large. Ink and the console UI now load only when `cotal console` runs.
