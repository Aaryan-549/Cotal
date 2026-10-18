/**
 * Process-runtime smoke (no NATS) — run with: pnpm --dir packages/core exec tsx smoke/presence-runtime.smoke.ts
 * Drives the shipped processRuntime(): one observation per process, a new one for a new process,
 * and a start that is the process's own clock origin rather than the time it was first asked.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { processRuntime } from "../src/process-runtime.js";

let checks = 0;
const ok = (value: unknown, message: string): void => { assert.ok(value, message); checks++; };

const first = processRuntime();
const loadedAt = Date.now();
ok(first.source === "endpoint-process", "source is the closed endpoint-process value");
ok(/^[0-9a-f-]{36}$/.test(first.id), "id is an opaque uuid");
ok(Number.isFinite(first.startedAt) && first.startedAt > 0, "startedAt is a finite epoch");
ok(first.startedAt <= loadedAt, "startedAt is not in this process's future");
ok(first.startedAt === Math.floor(performance.timeOrigin), "startedAt is the process clock origin");
ok(Object.isFrozen(first), "the observation cannot be edited in place");

await new Promise((resolve) => setTimeout(resolve, 25));
const later = processRuntime();
ok(later === first, "a later read (activity, reconnect) returns the same observation");
ok(later.startedAt < Date.now() - 20, "the start did not move to the time of the read");

// A new OS process is a new runtime: new id, and a start no earlier than this one's.
const module = fileURLToPath(new URL("../src/process-runtime.ts", import.meta.url));
const child = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
  `const { processRuntime } = await import(${JSON.stringify(module)}); process.stdout.write(JSON.stringify(processRuntime()));`], { encoding: "utf8" })) as ReturnType<typeof processRuntime>;
ok(child.id !== first.id, "a new process mints a new id");
ok(child.startedAt >= first.startedAt, "a new process starts no earlier than its parent");
ok(child.source === "endpoint-process", "the child reports the same source");

console.log(`presence-runtime smoke: ${checks} checks passed`);
