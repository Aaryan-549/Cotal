# Validator comparison lock acquisition

The CI workflow has one manual choice, `validators-0155`. It generates a lock for the four fixed comparison dependencies on a fresh hosted checkout. All ordinary CI jobs are excluded from that event. Push and pull-request jobs keep their existing behavior.

The source manifest, lock and browser cases stay unchanged in this commit. A later admitted manual job can run stock Node 22 and pnpm 11.28.2 with lock-only resolution, disabled lifecycle scripts, a 1440-minute strict release-age floor and no missing-time waiver. It keeps the repository registry and build policy. Package hooks, auth or execution overrides, installed dependencies, unexpected workspace edits and reused output directories refuse the run.

Stock pnpm still runs its resolver/config code and can fetch metadata and store data. Version 11.28.2 makes lock-only force ignoreScripts and excludes linking and post-install builds. This is source inspection, not proof that a future job is inert or admitted. The fixed code explicitly disables scripts and refuses configured package hooks rather than bypassing them.

Four allowlisted artifacts contain the generated core manifest, whole lock, diff and checkout/tool/policy receipt. Every file must exist and stay within its bound before upload. The job has read-only repository permission, no persisted checkout credential and no production secrets. Failure prevents an output-success claim. All resolved packages, peer copies, registry integrities and importer changes require separate graph review before any frozen install or diagnostic execution.

Other workflows do not subscribe to this CI manual event or its completion. Push and pull-request paths run on committed unchanged manifests and cannot read the ephemeral generated artifacts. Normal CI can run historical browser diagnostics on its existing graph. A manual acquisition result does not select those tests, install generated dependencies, adopt an engine or qualify browser/CSP behavior.

Error capture requirements are unchanged. Native whole-error JSON fidelity, absent/undefined/null distinctions and unsupported results stay visible. No serializer, error adapter or profile narrowing is added.

The ordinary unit job runs the seven source controls after its frozen install and unit tests. Four controls execute early refusal guards through the shipped script. Three structural checks parse the real workflow with the existing root yaml dependency and enumerate every job and dispatch input. Commented gates and unexpected jobs cannot stand in for active gates. The maintained four-guard mutation fixture requires each named runtime control to redden and reruns the full controls after every source restoration. None proves a valid acquisition. Manual acquisition still needs its own guard proof, current pair, current-main integration and separate admission.

The runner preserves other package manifests and policy files. It permits the complete generated lock to change, including other importer entries. Those changes require later whole-graph review and are not rejected by manifest fingerprints alone.
