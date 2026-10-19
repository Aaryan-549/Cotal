---
"@cotal-ai/core": minor
"@cotal-ai/cli": patch
---

`cotal send`, `cotal endpoints`, `cotal personas list --running`, `cotal channels list` and the name check in `cotal spawn` no longer leave consumers on the broker. Each one opened a transient endpoint that watched the presence bucket and the channel registry, and the operator credential cannot delete those consumers, so every command left one consumer on each bucket for five minutes. Five shells sending in a loop reached the broker's limit of 1000 consumers per stream, and further sends failed with `maximum consumers limit reached`. With a static or open-mesh credential the transient endpoint now reads both buckets once with a batched Direct Get and binds no consumer. `cotal channels list` reads the registry the same way through the new `directGet` option of `readChannelRegistry`. `@cotal-ai/core` adds the `readOnce` endpoint option and `lastKvEntries`, and the `operator` profile gains the Direct Get row on both buckets. On a user-auth mesh these commands still run on the user's bearer and keep their consumers.
