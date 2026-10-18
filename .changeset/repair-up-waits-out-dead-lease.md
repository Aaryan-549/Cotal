---
"@cotal-ai/core": patch
"@cotal-ai/manager": patch
"@cotal-ai/cli": patch
---

A repair `cotal up` after a crash now restores the manager and the delivery daemon in one run. A
manager or delivery daemon that is killed, or a daemon that exits because its broker went away,
cannot release its lease, and a replacement started inside the lease TTL used to lose the create and
make `up` exit 1. The new manager now waits out a lease row that names its workspace root and a pid
that is not running on the host, and `up` waits out a delivery lease held by the credential the
folder gave its previous daemon while no daemon is recorded running. The wait never writes the
lease: a row that is written again during it has a live holder and is refused, and a row held by
anyone else is refused at once as before.
