#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isMainEntry } from "./main-entry.mjs";
import { preflightFromRepository } from "./preflight-npm-publish.mjs";
import { verifyColdResults } from "./verify-cold-results.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function coldPublicationInputs(manifest, rows, source, directory) {
  assert.equal(manifest.source, source, "publication candidate belongs to another source");
  assert.deepEqual(manifest.packages.map((pkg) => pkg.name).sort(), rows.map((pkg) => pkg.name).sort(), "publication candidate is not the complete release census");
  const guarded = [];
  const archives = new Set();
  const inputs = rows.map((row) => {
    const pkg = manifest.packages.find((entry) => entry.name === row.name);
    const current = JSON.parse(readFileSync(join(row.path, "package.json"), "utf8"));
    assert.deepEqual(JSON.parse(pkg.sourceManifest), current, "publication package policy or version differs from qualification");
    assert.equal(pkg.version, row.version, "publication version differs from qualification");
    assert.equal(current.name, row.name);
    assert.equal(current.version, row.version);
    if (current.scripts?.prepublishOnly) guarded.push(row.name);
    assert(typeof pkg.archive === "string" && /^[^/\\]+\.tgz$/.test(pkg.archive) && !archives.has(pkg.archive), "publication archive path is invalid or repeated");
    archives.add(pkg.archive);
    assert(/^[a-f0-9]{64}$/.test(pkg.sha256), "publication archive lacks its qualified hash");
    const archive = join(directory, pkg.archive);
    assert(lstatSync(archive).isFile(), "publication archive must be a regular file");
    assert.equal(sha(readFileSync(archive)), pkg.sha256, "publication archive differs from qualified bytes");
    return { ...pkg, archive };
  });
  assert.deepEqual(manifest.prepublishOnly, guarded.sort(), "publication candidate omitted a prepublish guard");
  return inputs;
}

export async function publishColdCandidate({
  root = resolve(import.meta.dirname, ".."),
  directory = process.env.COLD_CANDIDATE,
  results = process.env.COLD_RESULTS,
  tag = "latest",
  env = process.env,
  exec = execFileSync,
  preflight = preflightFromRepository,
} = {}) {
  assert(directory && results, "publication needs the qualified candidate and all native receipts");
  assert(/^[a-z][a-z0-9._-]*$/i.test(tag), "publication dist-tag is invalid");
  directory = resolve(directory);
  const bytes = readFileSync(join(directory, "manifest.json"));
  const manifest = JSON.parse(bytes.toString("utf8"));
  const source = exec("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(manifest.source, source, "publication candidate belongs to another source");
  verifyColdResults(results, source, sha(bytes));
  const census = await preflight({ root, env, exec });
  if (census.state === "nothing-to-publish") return [];
  assert.equal(census.state, "ready", "publication preflight returned an unsupported state");
  // Validate the entire set before the first write, then recheck each archive at its write boundary.
  const inputs = coldPublicationInputs(manifest, census.rows, source, directory);
  for (const pkg of inputs) {
    assert.equal(sha(readFileSync(pkg.archive)), pkg.sha256, "publication archive changed after preflight");
    exec("pnpm", ["publish", pkg.archive, "--provenance", "--access=public", "--no-git-checks", "--ignore-scripts", "--tag", tag], { cwd: root, env, stdio: "inherit" });
  }
  return inputs.map(({ name, version }) => ({ name, version }));
}

if (isMainEntry(import.meta.url)) {
  publishColdCandidate({ tag: process.argv[2] ?? "latest" }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
