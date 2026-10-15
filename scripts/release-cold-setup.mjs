#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

const [input, output] = process.argv.slice(2);
assert(input && output, "usage: npm run test:release-cold -- <candidate-directory> <receipt.json>");
const packs = resolve(input);
const receipt = resolve(output);
assert(!existsSync(receipt), "cold setup receipt already exists");
const manifest = JSON.parse(readFileSync(join(packs, "manifest.json"), "utf8"));
const npmCli = process.env.npm_execpath;
assert(npmCli && /npm-cli\.js$/.test(npmCli), "run this gate through npm run so the real npm CLI is explicit");
const base = realpathSync(mkdtempSync(join(tmpdir(), "cotal-release-cold-")));
const installed = join(base, "installed");
const home = join(base, "home");
const root = join(base, "mesh");
const logs = receipt + ".logs";
for (const dir of [installed, home, root, join(base, "tmp"), logs]) mkdirSync(dir, { recursive: true });
mkdirSync(join(root, ".cotal"));
writeFileSync(join(installed, "package.json"), JSON.stringify({ private: true, type: "module" }));
writeFileSync(join(base, "user.npmrc"), "");
writeFileSync(join(base, "global.npmrc"), "");
const env = {};
for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "PATHEXT", "LANG", "LC_ALL", "CI", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"]) {
  if (process.env[key] !== undefined) env[key] = process.env[key];
}
Object.assign(env, {
  HOME: home, USERPROFILE: home, COTAL_HOME: join(home, ".cotal"), XDG_CONFIG_HOME: join(home, "xdg"),
  APPDATA: join(home, "AppData/Roaming"), LOCALAPPDATA: join(home, "AppData/Local"),
  TMPDIR: join(base, "tmp"), TMP: join(base, "tmp"), TEMP: join(base, "tmp"),
  npm_config_cache: join(base, "npm-cache"), npm_config_userconfig: join(base, "user.npmrc"),
  npm_config_globalconfig: join(base, "global.npmrc"), NO_COLOR: "1",
});
const checks = [];
const check = (name, ok) => { assert(ok, name); checks.push(name); console.log(`PASS ${name}`); };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let command = 0;
const run = (label, args, cwd = root, timeout = 120_000) => {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024 });
  const prefix = join(logs, String(++command).padStart(2, "0") + "-" + label);
  writeFileSync(prefix + ".stdout", result.stdout ?? "");
  writeFileSync(prefix + ".stderr", result.stderr ?? "");
  writeFileSync(prefix + ".json", JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message }) + "\n");
  assert(!result.error && !result.signal && result.status === 0, `${label} failed; see retained command logs`);
  return result.stdout;
};
const port = await new Promise((done, reject) => {
  const server = createServer(); server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const number = server.address().port; server.close(() => done(number)); });
});
const address = `nats://127.0.0.1:${port}`;
const space = "release-cold";
const cli = join(installed, "node_modules/cotal-ai/dist/cotal.js");
const inspect = join(import.meta.dirname, "release-cold-inspect.mjs");
const generations = [];
let started = false;
let complete = false;
const closedPort = () => new Promise((done) => {
  const socket = createConnection({ host: "127.0.0.1", port });
  socket.setTimeout(2000);
  socket.once("connect", () => { socket.destroy(); done(false); });
  socket.once("error", (error) => { socket.destroy(); done(error.code === "ECONNREFUSED"); });
  socket.once("timeout", () => { socket.destroy(); done(false); });
});
try {
  assert(manifest.packages.length >= 1 && /^[a-f0-9]{40}$/.test(manifest.source));
  const archives = [];
  const names = new Set();
  for (const pkg of manifest.packages) {
    assert(!names.has(pkg.name)); names.add(pkg.name);
    assert(!isAbsolute(pkg.archive) && !pkg.archive.includes("/") && !pkg.archive.includes("\\"));
    const file = join(packs, pkg.archive); assert(sha(readFileSync(file)) === pkg.sha256, "candidate tarball hash mismatch"); archives.push(file);
  }
  check("candidate contains the complete declared CLI and workspace closure", names.has("cotal-ai") && names.has("@cotal-ai/workspace") && names.has("@cotal-ai/manager"));
  run("install", [npmCli, "install", "--no-audit", "--no-fund", "--strict-peer-deps", "--foreground-scripts", "--loglevel=info", ...archives], installed, 300_000);
  for (const pkg of manifest.packages) {
    const dir = join(installed, "node_modules", pkg.name);
    const actual = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    check(`installed candidate version ${pkg.name}`, actual.version === pkg.version);
    for (const [file, expected] of Object.entries(pkg.files)) {
      const target = resolve(dir, file);
      assert(target.startsWith(resolve(dir) + sep), "candidate manifest escapes package");
      assert(sha(readFileSync(target)) === expected, `installed candidate bytes differ: ${pkg.name}/${file}`);
    }
    check(`installed candidate distribution ${pkg.name}`, Object.keys(pkg.files).length > 0);
  }
  const version = manifest.packages.find((pkg) => pkg.name === "cotal-ai").version;
  check("installed CLI version", run("version", [cli, "--version"]).trim() === `cotal-ai ${version}`);
  run("help", [cli, "--help"]);
  check("fresh home has no existing Cotal state", !existsSync(env.COTAL_HOME));
  const native = JSON.parse(run("native-process-identity", [inspect, installed, root, "self"]));
  check("native process identity round-trips before daemon startup", native.nativeIdentity === true);
  run("seed", [cli, "ext", "seed"]);
  for (let round = 0; round < 2; round++) {
    // Explicit target plus an existing owned .cotal directory prevents cwd fallback to an operator mesh.
    assert(realpathSync(root) === root && existsSync(join(root, ".cotal")));
    started = true;
    run(`up-${round}`, [cli, "up", "--detach", "--space", space, "--server", address, "--host", "127.0.0.1"]);
    const first = JSON.parse(run(`identity-${round}`, [inspect, installed, root, "running"]));
    await new Promise((done) => setTimeout(done, 3000));
    const stable = JSON.parse(run(`stable-${round}`, [inspect, installed, root, "running"]));
    check(`round ${round} Manager, delivery and broker survive startup`, first.length >= 3 && JSON.stringify(first) === JSON.stringify(stable));
    const ps = run(`ps-${round}`, [cli, "ps", "--space", space]);
    check(`round ${round} native Manager control answers`, ps.trim() === "(no managed agents)");
    const json = run(`ps-json-${round}`, [cli, "ps", "--space", space, "--json"]);
    check(`round ${round} empty Manager roster is an empty JSONL stream`, json.trim() === "");
    const policy = JSON.parse(run(`policy-${round}`, [inspect, installed, root, "policy", space]));
    check(`round ${round} native shutdown policy is accepted once`, policy.nativeTokensAccepted === true && policy.oneShot === true);
    const file = join(logs, `generation-${round}.json`); writeFileSync(file, JSON.stringify(stable) + "\n");
    if (generations.length) check("cold restart replaces every process generation", stable.every((row) => !generations[0].some((old) => old.pid === row.pid && old.token === row.token)));
    generations.push(stable);
    run(`down-${round}`, [cli, "down", "manager", "delivery", "nats"]);
    run(`stopped-${round}`, [inspect, installed, root, "stopped", file]);
    check(`round ${round} owned broker listener closed`, await closedPort());
    started = false;
  }
  complete = true;
} finally {
  if (started) {
    try { run("cleanup", [cli, "down", "manager", "delivery", "nats"]); } catch (error) { console.error(error.message); }
  }
  const result = { source: manifest.source, platform: process.platform, arch: process.arch, node: process.version, complete, assertions: checks.length, checks, generations, logsRetained: true };
  mkdirSync(dirname(receipt), { recursive: true }); writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  // A failed lifecycle retains its state for attribution; never remove a potentially live process's root.
  if (complete) rmSync(base, { recursive: true, force: true });
  else console.error(`Cold setup state retained at ${base}`);
}
