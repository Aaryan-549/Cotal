// Shipped-path admission controls. These never acquire packages or import validators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./ci-validator-lock-acquisition.mjs', import.meta.url));
const source = readFileSync(script, 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const refuse = (message, env, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes('OUTPUT COMPLETE'), false);
  assert.equal(result.stderr.includes(message), true, 'Must fail on the designated admission guard');
};
test('the shipped acquisition path refuses local execution', () => refuse('Acquisition requires GitHub Actions', {}));
test('the shipped acquisition path refuses a nonmanual event', () =>
  refuse('Acquisition requires manual dispatch', { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }));
test('the shipped acquisition path refuses an unknown acquisition mode', () =>
  refuse('Unknown acquisition mode', { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', ACQUISITION_MODE: 'other' }));
test('the shipped acquisition path accepts no command or package argument', () => refuse('No command or package inputs are supported', {}, ['z-schema@latest']));
test('only the fixed package pins and lock-only lifecycle flags are shipped', () => {
  for (const literal of ["'z-schema': '12.5.0'", "'@hyperjump/json-schema': '1.18.0'",
    "'@hyperjump/browser': '1.5.1'", "'json-schema-library': '11.6.6'",
    "'--lockfile-only'", "'--ignore-scripts'", "'--minimum-release-age=1440'",
    "'--minimum-release-age-strict'", "'--minimum-release-age-ignore-missing-time=false'"])
    assert.equal(source.includes(literal), true, literal);
  assert.equal(source.includes("run('pnpm', command)"), true);
  assert.equal(source.includes('await import('), false);
});
test('the manual acquisition excludes all eight ordinary CI jobs including always aggregate', () => {
  for (const job of ['unit', 'smoke', 'live', 'seat-native-linux-x64', 'seat-native-linux-arm64', 'seat-pack', 'seat-linux-arm64'])
    assert.equal(workflow.includes(`  ${job}:\n    if: \${{ github.event_name != 'workflow_dispatch' }}`), true, job);
  assert.equal(workflow.includes("if: ${{ always() && github.event_name != 'workflow_dispatch' }}"), true);
  assert.equal(workflow.includes("if: ${{ github.event_name == 'workflow_dispatch' && inputs.acquisition == 'validators-0155' }}"), true);
});
test('the fixed output upload has no wildcard and refuses missing output', () => {
  const acquisition = workflow.split('  validator-lock-acquisition:')[1];
  assert.ok(acquisition);
  const files = ['core-package.json', 'pnpm-lock.yaml', 'source.diff', 'receipt.json'];
  for (const file of files) assert.equal(acquisition.includes(`/${file}`), true);
  assert.equal(acquisition.includes('/*'), false);
  assert.equal(acquisition.includes('if-no-files-found: error'), true);
  assert.equal(acquisition.includes('persist-credentials: false'), true);
  assert.equal(acquisition.includes('run_install: false'), true);
});
