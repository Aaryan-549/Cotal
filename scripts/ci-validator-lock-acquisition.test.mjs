// Shipped-path admission controls. These never acquire packages or import validators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { acquisitionToolResult } from './ci-validator-lock-acquisition-observation.mjs';

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

// These drive the same result handler called by the shipped run(), never a copied classifier.
function observedRefusal(t, fields) {
  const records = [];
  const log = t.mock.method(console, 'log', value => records.push(value));
  try {
    assert.throws(() => acquisitionToolResult({ status: 1, signal: null, stdout: '', stderr: '', ...fields }),
      { message: 'Acquisition tool refused or exceeded its bound' });
    assert.equal(records.length, 1);
    assert.ok(Buffer.byteLength(records[0], 'utf8') <= 2048);
    return { record: JSON.parse(records[0]), serialized: records[0] };
  } finally { log.mock.restore(); }
}
test('shipped acquisition refusal retains closed pinned pnpm header shapes without captured tokens', t => {
  const shapes = [
    ['[ERR_PNPM_MISSING_TIME] ', 'PNPM_MISSING_TIME_HEADER'],
    ['[ERR_PNPM_NO_MATURE_MATCHING_VERSION] ', 'PNPM_NO_MATURE_VERSION_HEADER'],
    ['[ERR_PNPM_NO_MATCHING_VERSION] ', 'PNPM_NO_MATCHING_VERSION_HEADER'],
    ['[ERR_PNPM_FETCH_401] ', 'PNPM_FETCH_401_HEADER'],
    ['[ERR_PNPM_FETCH_403] ', 'PNPM_FETCH_403_HEADER'],
    ['[ERR_PNPM_CONFIG_CONFLICT_LOCKFILE_ONLY_WITH_NO_LOCKFILE] ', 'PNPM_LOCKFILE_CONFLICT_HEADER'],
  ];
  for (const [header, label] of shapes) {
    const { record, serialized } = observedRefusal(t, { stderr: `\x1b[31m${header}\x1b[0msecret-sentinel /private/path argv auth\n` });
    assert.deepEqual(record.stderr.categories, ['PNPM_CODE_HEADER', label]);
    assert.equal(record.stderr.codeHeaders, 1);
    assert.equal(record.cause, 'UNKNOWN');
    for (const token of ['secret-sentinel', '/private/path', 'argv', 'auth', header.trim()])
      assert.equal(serialized.includes(token), false);
  }
  const { record, serialized } = observedRefusal(t, {
    stdout: "[ERROR] Unknown options: 'secret-flag', 'token'\n[ERROR] generic secret\n[ERR_PNPM_SECRET_CANARY] arbitrary\n" });
  assert.deepEqual(record.stdout.categories, ['PNPM_CODE_HEADER', 'PNPM_GENERIC_HEADER', 'PNPM_UNKNOWN_OPTION_HEADER']);
  assert.equal(record.stdout.genericHeaders, 2);
  assert.equal(record.stdout.unknownOptionHeaders, 1);
  for (const token of ['secret-flag', 'SECRET_CANARY', 'arbitrary']) assert.equal(serialized.includes(token), false);
  const singular = observedRefusal(t, { stderr: "[ERROR] Unknown option: 'secret'\n" }).record.stderr;
  assert.deepEqual(singular.categories, ['PNPM_GENERIC_HEADER', 'PNPM_UNKNOWN_OPTION_HEADER']);
  assert.equal(singular.unknownOptionHeaders, 1);
  const mixed = observedRefusal(t, { stderr: shapes.map(([header]) => `  ${header}secret`).join('\n') }).record.stderr;
  assert.deepEqual(mixed.categories, ['PNPM_CODE_HEADER', ...shapes.map(([, label]) => label)]);
  assert.equal(mixed.codeHeaders, 6);
});
test('shipped acquisition refusal uses UNKNOWN for unsupported, wrapped and unrecognized output', t => {
  for (const stderr of ['ERR_PNPM_MISSING_TIME without brackets', 'prefix [ERROR] Unknown option: secret',
    '[ERROR]Unknown option: secret', '\x1b[2J[ERROR] secret', '{"code":"ERR_PNPM_MISSING_TIME"}',
    'secret bytes only', '', null, undefined, Buffer.from('[ERROR] secret'), 7]) {
    const { record, serialized } = observedRefusal(t, { stderr });
    assert.deepEqual(record.stderr.categories, ['UNKNOWN']);
    assert.equal(record.stderr.codeHeaders + record.stderr.genericHeaders + record.stderr.unknownOptionHeaders, 0);
    assert.equal(record.cause, 'UNKNOWN');
    assert.equal(serialized.includes('secret'), false);
  }
});
test('shipped acquisition refusal keeps returned streams separate and absence distinct from empty text', t => {
  const { record } = observedRefusal(t, { stdout: '[ERR_PNPM_', stderr: 'MISSING_TIME] secret' });
  assert.deepEqual(record.stdout.categories, ['UNKNOWN']);
  assert.deepEqual(record.stderr.categories, ['UNKNOWN']);
  assert.equal(observedRefusal(t, { stdout: null }).record.stdout.state, 'ABSENT');
  assert.equal(observedRefusal(t, { stdout: '' }).record.stdout.state, 'TEXT');
  assert.equal(observedRefusal(t, { stdout: '' }).record.stdout.scanComplete, true);
  assert.equal(observedRefusal(t, { stdout: null }).record.stdout.scanComplete, false);
  assert.equal(observedRefusal(t, { stdout: {} }).record.stdout.state, 'UNSUPPORTED');
});
test('shipped acquisition refusal bounds scanning and saturates counters without denying omitted shapes', t => {
  const { record } = observedRefusal(t, { stderr: '[ERROR] x\n'.repeat(2000) });
  assert.equal(record.stderr.genericHeaders, 1024);
  assert.equal(record.stderr.scanComplete, true);
  const omitted = observedRefusal(t, { stdout: 'x'.repeat(65536) + '\n[ERR_PNPM_MISSING_TIME] secret' }).record.stdout;
  assert.equal(omitted.characters, 65536);
  assert.equal(omitted.scanComplete, false);
  assert.deepEqual(omitted.categories, ['UNKNOWN']);
  const cut = observedRefusal(t, { stderr: 'x'.repeat(65530) + '\n[ERROR] secret' }).record.stderr;
  assert.equal(cut.scanComplete, false);
  assert.deepEqual(cut.categories, ['UNKNOWN']);
});
test('shipped acquisition refusal keeps error precedence and emits only closed returned status fields', t => {
  for (const fields of [
    { status: 1, signal: null, error: undefined },
    { status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT', message: 'secret', stack: 'secret' } },
    { status: 0, error: { code: 'ENOBUFS' } },
    { status: 999, signal: 'secret-signal', error: { code: 'secret-code', message: 'secret' } },
  ]) {
    const { record, serialized } = observedRefusal(t, fields);
    assert.equal(record.cause, 'UNKNOWN');
    assert.equal(serialized.includes('secret'), false);
    assert.equal(record.status, fields.status === 999 ? 'OTHER' : fields.status);
    assert.equal(record.signal, fields.signal === 'secret-signal' ? 'OTHER' : fields.signal ?? null);
    assert.equal(record.errorCode, fields.error?.code === 'secret-code' ? 'OTHER' : fields.error?.code ?? null);
  }
  // Integration guard: the entry feeds the actual returned object to this shipped handler.
  assert.match(source, /return acquisitionToolResult\(result\);/);
});
test('shipped acquisition success returns original stdout without emitting a refusal', t => {
  const log = t.mock.method(console, 'log', () => { assert.fail('Success must not emit a refusal'); });
  try {
    for (const stdout of ['literal success\n', '', null])
      assert.equal(acquisitionToolResult({ status: 0, signal: null, stdout, stderr: '[ERROR] ignored' }), stdout);
    assert.equal(log.mock.callCount(), 0);
  } finally { log.mock.restore(); }
});
