---
"@cotal-ai/core": minor
---

Presence now carries `runtime: { id, startedAt, source: "endpoint-process" }`: the publishing process's own start, read once in-process from `performance.timeOrigin`, with an opaque per-process id. Status, activity, heartbeats and in-process reconnects leave it unchanged and a new process publishes a new one, so an observer can show how long an agent's process has been running without guessing from activity, heartbeat or launch times. Older publishers omit it, which reads as unknown.
