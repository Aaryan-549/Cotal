#!/usr/bin/env node
// Synthetic publication controls only. The native matrix and real-pnpm archive probe are separate.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coldPublicationInputs, publishColdCandidate } from "./publish-cold-candidate.mjs";

const root = mkdtempSync(join(tmpdir(), "cold-publication-contract-"));
const source = "a".repeat(40);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
try {
  const rows = ["one", "two"].map((name) => {
    const path = join(root, name); mkdirSync(path);
    writeFileSync(join(path, "package.json"), JSON.stringify({ name, version: "1.0.0", scripts: { prepublishOnly: "fixture-guard" } }));
    return { name, version: "1.0.0", path };
  });
  const manifest = { source, prepublishOnly: ["one", "two"], packages: rows.map((row) => {
    const archive = row.name + ".tgz";
    const bytes = Buffer.from("synthetic archive fixture " + row.name); writeFileSync(join(root, archive), bytes);
    return { name: row.name, version: row.version, sourceManifest: readFileSync(join(row.path, "package.json"), "utf8"), archive, sha256: sha(bytes) };
  }) };
  const bytes = JSON.stringify(manifest); writeFileSync(join(root, "manifest.json"), bytes);
  const checks = ["cold restart replaces every process generation", "native process identity round-trips before daemon startup"];
  for (const round of [0, 1]) for (const name of ["Manager, delivery and broker survive startup", "native Manager control answers", "empty Manager roster is an empty JSONL stream", "native shutdown policy is accepted once", "owned broker listener closed"]) checks.push(`round ${round} ${name}`);
  for (const round of [0, 1]) for (const component of ["manager", "delivery"]) checks.push(`round ${round} Windows ${component} cleanup handler ran`);
  let firstReceipt;
  for (const [runner, platform, arch] of [["ubuntu-latest", "linux", "x64"], ["ubuntu-24.04-arm", "linux", "arm64"], ["macos-15-intel", "darwin", "x64"], ["macos-15", "darwin", "arm64"], ["windows-latest", "win32", "x64"], ["windows-11-arm", "win32", "arm64"]]) {
    for (const node of [22, 24, 26]) {
      const dir = join(root, `cold-result-${runner}-node${node}`); mkdirSync(dir);
      const file = join(dir, "cold-result.json"); firstReceipt ??= file;
      writeFileSync(file, JSON.stringify({ source, candidateSha256: sha(bytes), platform, arch, node: `v${node}.0.0`, complete: true, assertions: checks.length, checks, generations: [0, 1].map((round) => ["nats", "manager", "delivery"].map((name, index) => ({ name: name + ".pid", pid: 100 + index + round * 10, token: `fixture-${round}` }))) }));
    }
  }
  await check("publication validates the complete synthetic archive set", () => assert.equal(coldPublicationInputs(manifest, rows, source, root).length, 2));
  for (const [name, mutate] of [
    ["source mismatch", (m) => { m.source = "b".repeat(40); }],
    ["missing package", (m) => { m.packages.pop(); }],
    ["duplicate package", (m) => { m.packages[1] = m.packages[0]; }],
    ["changed policy", (m) => { const p = JSON.parse(m.packages[0].sourceManifest); p.scripts.prepublishOnly = "different"; m.packages[0].sourceManifest = JSON.stringify(p); }],
    ["changed version", (m) => { m.packages[0].version = "2.0.0"; }],
    ["archive path escape", (m) => { m.packages[0].archive = "../one.tgz"; }],
    ["changed archive bytes", (m) => { m.packages[0].sha256 = "b".repeat(64); }],
    ["omitted prepublish guard", (m) => { m.prepublishOnly.pop(); }],
  ]) await check(`publication refuses ${name}`, () => { const copy = structuredClone(manifest); mutate(copy); assert.throws(() => coldPublicationInputs(copy, rows, source, root)); });
  const calls = [];
  const options = { root, directory: root, results: root, env: {}, exec: (file, args) => {
    if (file === "git") { assert.deepEqual(args, ["rev-parse", "HEAD"]); return source + "\n"; }
    assert.equal(file, "pnpm"); calls.push(args);
  }, preflight: async () => ({ state: "ready", rows }) };
  await check("publisher sends only qualified archive paths with provenance and no hooks", async () => {
    assert.equal((await publishColdCandidate(options)).length, 2);
    assert.deepEqual(calls, manifest.packages.map((pkg) => ["publish", join(root, pkg.archive), "--provenance", "--access=public", "--no-git-checks", "--ignore-scripts", "--tag", "latest"]));
  });
  calls.length = 0;
  await check("all-present secure preflight remains a no-op", async () => {
    assert.deepEqual(await publishColdCandidate({ ...options, preflight: async () => ({ state: "nothing-to-publish", rows }) }), []);
    assert.equal(calls.length, 0);
  });
  await check("secure preflight refusal prevents every publication", async () => {
    await assert.rejects(() => publishColdCandidate({ ...options, preflight: async () => { throw new Error("fixture authority refusal"); } }), /fixture authority refusal/);
    assert.equal(calls.length, 0);
  });
  const last = join(root, "two.tgz"), originalArchive = readFileSync(last);
  await check("a corrupt last archive prevents even the first publication", async () => {
    writeFileSync(last, "corrupt synthetic archive");
    try { await assert.rejects(() => publishColdCandidate(options), /publication archive differs from qualified bytes/); assert.equal(calls.length, 0); }
    finally { writeFileSync(last, originalArchive); }
  });
  await check("archive changes between writes prevent the changed publication", async () => {
    try {
      await assert.rejects(() => publishColdCandidate({ ...options, exec: (file, args) => {
        const result = options.exec(file, args);
        if (file === "pnpm") writeFileSync(last, "changed during synthetic first write");
        return result;
      } }), /publication archive changed after preflight/);
      assert.equal(calls.length, 1);
    } finally { writeFileSync(last, originalArchive); calls.length = 0; }
  });
  await check("missing native receipt prevents preflight and publication", async () => {
    const receipt = readFileSync(firstReceipt); rmSync(firstReceipt);
    try { await assert.rejects(() => publishColdCandidate({ ...options, preflight: async () => { assert.fail("must not preflight an unqualified candidate"); } }), /ENOENT/); assert.equal(calls.length, 0); }
    finally { writeFileSync(firstReceipt, receipt); }
  });
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`COLD PUBLICATION CONTRACT OK (${passed} checks; synthetic fixtures only)`);
