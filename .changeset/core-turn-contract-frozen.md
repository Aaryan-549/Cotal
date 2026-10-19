---
"@cotal-ai/core": patch
---

`TURN_INPUT_SCHEMA` and `TURN_OUTPUT_SCHEMA` are now deep-frozen at their declaration, like the other collections core exports. They were plain objects, so an importer could change the `turn` contract a manager serves and validates against. Their contents and contract digests are unchanged. The frozen-exports smoke now also admits the `./browser-control` and `./browser-validators-build` entries. Each declares the functions it adds beyond the barrel and exposes no other new export.
