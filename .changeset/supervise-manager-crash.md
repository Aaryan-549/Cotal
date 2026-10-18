---
"@cotal-ai/manager": patch
---

A seat spawned with `supervise` now survives its manager's death. When a manager ends without stopping the seat (a crash, or a pty seat that ended with it), the next manager of the same instance restarts the seat under the same name, lifecycle uid, credential, persona and cwd and counts it as one restart of the policy, so a workflow run resumed by that manager finishes its interrupted `turn` instead of failing it with L4002. The manager keeps what that restart needs in `.cotal/seat-records/<space>/<name>.json` while the seat runs. A seat whose budget is spent, or whose persona file or credential changed or expired, is retired as before. A seat resumed from a preserved inventory now also keeps the nkey seed its credential renewal needs: the manager read it with a pattern that matched no real creds file.
