import { randomUUID } from "node:crypto";
import type { PresenceRuntime } from "./types.js";

/** This process's own {@link PresenceRuntime}, observed once when core loads. `performance.timeOrigin`
 *  is the epoch time the process started, so the value is the OS process start as the process itself
 *  saw it; every endpoint in the process publishes the same id and start, and a new process gets new
 *  ones. Nothing here is read from a request, a registration or a heartbeat. */
const own: PresenceRuntime = Object.freeze({
  id: randomUUID(),
  startedAt: Math.floor(performance.timeOrigin),
  source: "endpoint-process",
});

export function processRuntime(): PresenceRuntime {
  return own;
}
