---
"@cotal-ai/core": minor
---

Presence can carry `runtime: { id, startedAt, source: "endpoint-process" }`: the OS process holding the mesh connection reports its own start from `performance.timeOrigin`. Each process and lifecycle scope has its own opaque id, stable across status, activity, heartbeats and in-process reconnects. Endpoints in the same process share its start even when their lifecycles register later. The value does not date a separate parent, model harness or lifecycle. Runtime-only changes notify presence observers. Older publishers omit the field, which means unknown.
