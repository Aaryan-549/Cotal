---
"@cotal-ai/cli": patch
---

`cotal join` under a provisioned credential now prints each channel post once. Such a join holds a durable delivery backstop for its channel, so every post reached it twice under the same message id, once on the live channel subscription and once from the backstop, and the join printed both. It now deduplicates by message id as the protocol requires of a receiver, acks the second copy, and never treats an empty id as a key.
