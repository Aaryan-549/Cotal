#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { closureFromConfig } from "./verify-publish-closure.mjs";

const root = resolve(import.meta.dirname, "..");
const output = resolve(process.argv[2] ?? "cold-candidate");
mkdirSync(output);
const rows = JSON.parse(execFileSync("pnpm", ["list", "-r", "--depth", "-1", "--json"], { cwd: root, encoding: "utf8" }));
const packages = rows.filter((row) => !JSON.parse(readFileSync(join(row.path, "package.json"), "utf8")).private);
const expected = closureFromConfig(readFileSync(join(root, ".changeset/config.json"), "utf8"));
if (JSON.stringify(packages.map((row) => row.name).sort()) !== JSON.stringify(expected)) throw new Error("cold candidate public package census disagrees with the fixed group");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = { source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), packages: [] };
for (const row of packages) {
  const before = new Set(readdirSync(output));
  execFileSync("pnpm", ["--dir", row.path, "pack", "--pack-destination", output], { cwd: root, stdio: "inherit", timeout: 180_000 });
  const added = readdirSync(output).filter((name) => !before.has(name) && name.endsWith(".tgz"));
  if (added.length !== 1) throw new Error(`cold candidate expected one tarball for ${row.name}`);
  const archive = join(output, added[0]);
  const info = JSON.parse(execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }));
  if (info.name !== row.name || info.version !== row.version) throw new Error("cold candidate package identity mismatch");
  const entries = execFileSync("tar", ["-tf", archive], { encoding: "utf8" }).split("\n").filter((name) => name.startsWith("package/") && !name.endsWith("/"));
  if (!entries.some((name) => name.startsWith("package/dist/"))) throw new Error(`cold candidate ${row.name} has no built distribution`);
  const files = {};
  for (const entry of entries) files[entry.slice("package/".length)] = sha(execFileSync("tar", ["-xOf", archive, entry], { maxBuffer: 16 * 1024 * 1024 }));
  manifest.packages.push({ name: row.name, version: row.version, archive: basename(archive), sha256: sha(readFileSync(archive)), files, sourceManifest: readFileSync(join(row.path, "package.json"), "utf8") });
}
writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(`Cold candidate: ${manifest.packages.length} packages at ${manifest.source}`);
