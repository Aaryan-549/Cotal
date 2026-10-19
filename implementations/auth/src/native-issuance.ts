/**
 * Native-key issuance evidence (SPEC 13.1 `natkey.`): one create-only row per callout success,
 * keyed by the broker-generated per-connection user public key and bound to the validated
 * bearer's own signed, row-checked claims. It is what lets a later revocation name the exact
 * native key a lifecycle was issued under. It is evidence of an issuance only: a row whose write
 * threw, or whose JWT was never answered, proves nothing about a client or an accepted connection.
 *
 * Coverage is honest and partial: connections admitted before this record existed, responders
 * that do not write it, and static (non-callout) JWTs have no row and are never inferred.
 */
import type { KV } from "@nats-io/kv";
import { fromPublic } from "@nats-io/nkeys";
import { nativeIssuanceKey } from "@cotal-ai/core";
import type { ValidatedUserToken } from "./token.js";
import { registryStores, type LifecycleRegistry } from "./lifecycle-registry.js";

/** The closed v1 record. `connId` is the client's inbox nonce: an attribute, never an identity. */
export interface NativeIssuanceRecord {
  v: 1;
  space: string;
  owner: string;
  actor: string;
  lifecycleUid: string;
  credentialId: string;
  view: string;
  connId: string;
  /** The minted inner JWT's own `iat` and `exp` (seconds); a session-caller's is its grant's. */
  iat: number;
  exp: number;
}

/** One callout success, handed to the recorder after the mint and before the response. */
export interface NativeIssuance {
  userNkey: string;
  token: ValidatedUserToken;
  connId: string;
  iat: number;
  exp: number;
}

export type NativeIssuanceRecorder = (issuance: NativeIssuance) => Promise<void>;

const FIELDS = ["v", "space", "owner", "actor", "lifecycleUid", "credentialId", "view", "connId", "iat", "exp"] as const;

function assertUserNkey(userNkey: string): string {
  const key = nativeIssuanceKey(userNkey);
  fromPublic(userNkey); // the stock nkey codec: checksum and public-key prefix
  return key;
}

function assertSeconds(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0) throw new Error(`natkey: ${what} must be a positive integer of seconds`);
  return v;
}

/** Build the record from the validated token alone: never from a fresh alias lookup. */
export function nativeIssuanceRecord(space: string, i: NativeIssuance): NativeIssuanceRecord {
  const t = i.token;
  if (t.space !== space) throw new Error(`natkey: the bearer's space ${JSON.stringify(t.space)} is not this callout's space`);
  const { lifecycleUid, credentialId } = t.act;
  if (lifecycleUid === undefined || credentialId === undefined) throw new Error("natkey: the bearer carries no lifecycle or credential claim; an issuance is recorded only against both");
  const iat = assertSeconds(i.iat, "iat"), exp = assertSeconds(i.exp, "exp");
  if (exp <= iat) throw new Error("natkey: exp must follow iat");
  return { v: 1, space, owner: t.owner, actor: t.act.actor, lifecycleUid, credentialId, view: t.act.view ?? "agent", connId: i.connId, iat, exp };
}

/** Parse a stored row; anything but the closed v1 shape refuses. */
export function parseNativeIssuanceRecord(raw: unknown): NativeIssuanceRecord {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("natkey: record is not an object");
  const keys = Object.keys(raw);
  if (keys.length !== FIELDS.length || !FIELDS.every((f) => keys.includes(f))) throw new Error(`natkey: record fields ${JSON.stringify(keys.sort())} are not the closed v1 set`);
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) throw new Error("natkey: record version is not 1");
  for (const f of ["space", "owner", "actor", "lifecycleUid", "credentialId", "view", "connId"] as const)
    if (typeof r[f] !== "string" || r[f] === "") throw new Error(`natkey: record ${f} is not a non-empty string`);
  assertSeconds(r.iat, "iat");
  assertSeconds(r.exp, "exp");
  return r as unknown as NativeIssuanceRecord;
}

/**
 * The callout recorder: create-only write in the auth bucket (an existing row for the key, under
 * any lifecycle, refuses), then `fence` re-reads the lifecycle and credential authority in the
 * same stream. Any throw is the caller's signed deny; a row written before a throw stays as
 * harmless evidence of an issuance that was never released.
 */
export function makeNativeIssuanceRecorder(registry: LifecycleRegistry, fence: (t: ValidatedUserToken) => Promise<void>): NativeIssuanceRecorder {
  const { authKv, space } = registryStores(registry);
  return async (i) => {
    const key = assertUserNkey(i.userNkey);
    const record = nativeIssuanceRecord(space, i);
    await authKv.create(key, new TextEncoder().encode(JSON.stringify(record)));
    await fence(i.token);
  };
}

/** Leader-read one key's evidence (the auth bucket is not Direct-capable). Absent is `undefined`. */
export async function readNativeIssuance(kv: KV, userNkey: string): Promise<NativeIssuanceRecord | undefined> {
  const entry = await kv.get(assertUserNkey(userNkey));
  if (!entry || entry.operation !== "PUT") return undefined;
  return parseNativeIssuanceRecord(entry.json());
}
