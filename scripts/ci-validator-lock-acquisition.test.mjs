// Shipped-path admission controls. These never acquire packages or import validators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const script = fileURLToPath(new URL('./ci-validator-lock-acquisition.mjs', import.meta.url));
const source = readFileSync(script, 'utf8');
const document = parseDocument(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  { uniqueKeys: true });
assert.deepEqual(document.errors, [], 'Workflow must parse without duplicate keys or recovery');
const workflow = document.toJS({ maxAliasCount: 0 });
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
  const ordinary = ['unit', 'smoke', 'live', 'seat-native-linux-x64', 'seat-native-linux-arm64', 'seat-pack', 'seat-linux-arm64', 'ci-ok'];
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [...ordinary, 'validator-lock-acquisition'].sort());
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepEqual(workflow.on.workflow_dispatch, { inputs: { acquisition: {
    description: 'Generate the fixed validator comparison lock for source review only',
    required: true, type: 'choice', options: ['validators-0155'],
  } } });
  for (const job of ordinary) assert.equal(workflow.jobs[job].if, job === 'ci-ok'
    ? "${{ always() && github.event_name != 'workflow_dispatch' }}"
    : "${{ github.event_name != 'workflow_dispatch' }}", job);
  assert.equal(workflow.jobs['validator-lock-acquisition'].if,
    "${{ github.event_name == 'workflow_dispatch' && inputs.acquisition == 'validators-0155' }}");
  const step = workflow.jobs.unit.steps.filter(step => step.name === 'Validator lock acquisition source controls');
  assert.equal(step.length, 1);
  assert.equal(step[0].run,
    'node --test --test-reporter=tap --test-concurrency=1 scripts/ci-validator-lock-acquisition.test.mjs');
  assert.equal(step[0].if, undefined, 'Normal default-success step, not an acquisition override');
});
test('the fixed output upload has no wildcard and refuses missing output', () => {
  const acquisition = workflow.jobs['validator-lock-acquisition'];
  assert.ok(acquisition);
  assert.deepEqual(acquisition.permissions, { contents: 'read' });
  const uploads = acquisition.steps.filter(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(uploads.length, 1);
  const prefix = '${{ runner.temp }}/validator-lock-${{ github.run_id }}-${{ github.run_attempt }}';
  assert.deepEqual(uploads[0].with.path.trim().split('\n'),
    ['core-package.json', 'pnpm-lock.yaml', 'source.diff', 'receipt.json'].map(file => `${prefix}/${file}`));
  assert.equal(uploads[0].with['if-no-files-found'], 'error');
  const checkout = acquisition.steps.filter(step => step.uses === 'actions/checkout@v6');
  assert.equal(checkout.length, 1);
  assert.equal(checkout[0].with['persist-credentials'], false);
  const pnpm = acquisition.steps.filter(step => step.uses === 'pnpm/action-setup@v6.0.8');
  assert.equal(pnpm.length, 1);
  assert.equal(pnpm[0].with.run_install, false);
  assert.equal(pnpm[0].with.version, '11.28.2');
  const node = acquisition.steps.filter(step => step.uses === 'actions/setup-node@v6');
  assert.equal(node.length, 1);
  assert.equal(node[0].with['node-version'], 22);
  const runs = acquisition.steps.filter(step => Object.hasOwn(step, 'run'));
  assert.equal(runs.length, 1, 'No extra executable step or normal install in acquisition');
  assert.equal(runs[0].run, 'node scripts/ci-validator-lock-acquisition.mjs');
  assert.deepEqual(runs[0].env, { ACQUISITION_MODE: '${{ inputs.acquisition }}' });
});
