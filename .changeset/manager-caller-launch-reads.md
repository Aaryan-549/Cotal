---
"@cotal-ai/core": minor
"@cotal-ai/manager": minor
---

A person who may spawn on their own Manager can now read what a launch there needs. A `manager-caller` view whose actor holds `spawn` carries the Manager's `status`, `models` and `resolve-cwd` commands on its one pinned instance. Before, those reads needed `admin`, and no view carried `resolve-cwd`, so a launch dialog that reads the Manager's connectors, model catalogs and a working directory was refused at the broker. A `run`-only or no-scope view gains nothing, `ps` and `slots` stay with `admin`, and the standing `spawn` set that reaches every Manager on the class rail is unchanged.

A user mesh's co-located Manager answers every owner's view, so its `status` now counts only the caller's own seats, as `ps` would list them, unless the caller holds `admin`. A remote Manager's seats all belong to its owner, and its count is unchanged. The auth service mints the view, so the new reads arrive with its upgrade. On a self-hosted user mesh, restart the Manager on this release with or before the auth service, so the count is bounded before the reads are minted.
