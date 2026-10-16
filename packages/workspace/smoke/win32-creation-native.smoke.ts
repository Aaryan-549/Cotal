/** Native Windows cold-profile creation identity. Run only on a Windows runner. */
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nativeWin32CreationToken } from "../src/win32-process.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertRecordIdentity, defaultStartToken, verifyIdentityPin, writePidPair } from "../src/pid.js";
import { coldOsEnvironment } from "../../../scripts/release-cold-environment.mjs";

assert.equal(process.platform, "win32", "this suite requires a native Windows runner");
const root = mkdtempSync(join(tmpdir(), "win32-cold-identity-"));
const before = { ...process.env };
const check = (name: string, condition: boolean): void => {
  if (!condition) console.error(`FAIL ${name}`);
  assert.ok(condition, name);
  console.log(`PASS ${name}`);
};
try {
  const cold = coldOsEnvironment(before);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, cold);
  for (const name of ["home", "local", "roaming", "tmp"]) mkdirSync(join(root, name));
  Object.assign(process.env, { HOME: join(root, "home"), USERPROFILE: join(root, "home"), LOCALAPPDATA: join(root, "local"), APPDATA: join(root, "roaming"), TMPDIR: join(root, "tmp"), TMP: join(root, "tmp"), TEMP: join(root, "tmp") });
  const started = performance.now();
  const token = defaultStartToken(process.pid);
  console.log(JSON.stringify({ firstReadMs: Math.round(performance.now() - started), tokenPresent: token !== undefined }));
  check("W1 a cold Windows process has a native creation token", token !== undefined && /^\d{1,20}$/.test(token));
  const path = join(root, "self.pid");
  writePidPair(path, process.pid);
  const pin = verifyIdentityPin(path);
  check("W2 a cold native Windows pin matches its process", pin.kind === "match" && pin.record.token === token);
  check("W3 native Windows creation identity still refuses a changed token", assertRecordIdentity({ pid: process.pid, token: `${token}0` }).kind === "mismatch");
  // This independent compatibility oracle runs only after the first cold production read.
  // Its startup allowance is not a production timeout, retry or qualification waiver.
  const reference = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    `[System.Diagnostics.Process]::GetProcessById(${process.pid}).StartTime.ToUniversalTime().ToFileTimeUtc()`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000 }).trim();
  check("W4 native FILETIME matches the prior reader without rounding", reference === token);
  check("W5 invalid pids are refused by the actual native binding",
    [0, -1, 1.5, NaN, Infinity, 0x80000000, 0x100000000 + process.pid].every((pid) => nativeWin32CreationToken(pid) === undefined));
  check("W6 inaccessible system process identity stays unverified", nativeWin32CreationToken(4) === undefined);
  const repeated = performance.now();
  check("W7 repeated native reads keep the same creation identity", Array.from({ length: 1000 }, () => defaultStartToken(process.pid)).every((value) => value === token));
  console.log(JSON.stringify({ repeatedNativeReads: 1000, elapsedMs: Math.round(performance.now() - repeated) }));
  const workspace = fileURLToPath(new URL("..", import.meta.url));
  const relocated = join(root, "installation with spaces");
  mkdirSync(join(relocated, "dist"), { recursive: true });
  const module = join(relocated, "dist", "win32-process.mjs");
  copyFileSync(join(workspace, "dist", "win32-process.js"), module);
  const probe = () => spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { nativeWin32CreationToken as read } from ${JSON.stringify(pathToFileURL(module).href)}; console.log(read(process.pid));`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  const missing = probe();
  check("W8 a missing native binding is a loud installation failure", missing.status !== 0 && missing.stderr.includes("could not load the shipped Windows creation identity binding"));
  const nativeDir = join(relocated, "build", "Release", `win32-${process.arch}`);
  mkdirSync(nativeDir, { recursive: true });
  writeFileSync(join(nativeDir, "creation.node"), "not a Windows binding");
  const corrupt = probe();
  check("W9 a corrupt native binding is a loud installation failure", corrupt.status !== 0 && corrupt.stderr.includes("could not load the shipped Windows creation identity binding"));
  copyFileSync(join(workspace, "build", "Release", `win32-${process.arch}`, "creation.node"), join(nativeDir, "creation.node"));
  const valid = probe();
  check("W10 the shipped binding loads from an installation path with spaces", valid.status === 0 && /^\d{1,20}$/.test(valid.stdout.trim()));
  console.log("WINDOWS COLD CREATION OK (10 checks; native Windows only)");
} finally {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, before);
  rmSync(root, { recursive: true, force: true });
}
