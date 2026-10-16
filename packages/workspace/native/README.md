# Windows creation identity

`win32-process.c` uses the stable Node-API C interface and Windows process-query APIs. It returns the creation FILETIME as a decimal string. It has no runtime dependency or PowerShell fallback.

Build on native Windows x64 and arm64 in the matching MSVC Developer Command Prompt with `pnpm --filter @cotal-ai/workspace build:native`. The script downloads only the checksum-pinned Node headers and import library in `node-sdk.json`. It records source, SDK, compiler and binary provenance beside the output. An existing binary must verify before reuse; stale output is an error.

Both architecture directories and their receipts must be assembled under `build/Release` before packing or publishing workspace. Customer installation uses these prebuilt files and runs no compiler or native download. The native CI suite runs the same Node-API 8 binaries on Node 22, 24 and 26. Its PowerShell compatibility oracle is test-only and runs after the first cold production read.
