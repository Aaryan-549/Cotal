---
"@cotal-ai/auth": minor
---

The auth service serves `POST /manager-instances` on both faces: the signed-in human's own Manager instances, read-only. It verifies the same IdP proof the human exchange verifies, derives the owner the same way, and answers `{ v: 1, owner, complete: true, instances }`, each instance with its placement and the verdict selection reads (`candidate`, `not open`, `not registered`, `not this owner's`, `unknown`). Selection is now built on the same list, and the plane `openAuthAuthorityPlane` returns gains `listManagerInstances`. A listed candidate is registration evidence, not proof that the instance answers. Browser-origin requests are refused as on every exchange route, and a failed gate read answers 503, never an empty list.
