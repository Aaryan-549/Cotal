---
"@cotal-ai/core": patch
"@cotal-ai/runtime": patch
---

A run that names a placement instance now sends its placed seats' turns to that instance. Before, those turns went out on the class rail, where only the hosting manager maps the seat, so a live seat could be reported down once the re-issue budget ran out. The run host credential gains owner-pinned `turn` on that one instance only. Unplaced runs keep their class-rail reach, and their L4002 message no longer claims more than the members the call reached.
