# Remaining schema diagnostics

This broker-free diagnostic runs the pinned Ajv 8.20.0 public 2020-12 entry through the standard Node test runner. It differs from the maintained upstream Mocha harness. It does not call `compileContract` or establish its conformance, profile bounds, branding, error compatibility or browser acceptance.

From the core package directory:

```sh
node --test --test-concurrency=1 smoke/schema-remaining15-diagnostic.test.mjs
```

The 197 tests comprise one corpus census and four configurations, each with fifteen retained official witnesses, thirty-three independent controls and one authored-ID/retrieval-alias pointer test. The official witnesses come from JSON-Schema-Test-Suite revision `7de0e6a06031ede80028583dd45d0cd41105ae5b`. Predicate bodies and input bytes are preserved from the upstream-oriented diagnostic. Only the test registration, imports and counter instrumentation differ.

Every synchronous exception is recorded and rethrown. The terminal JSON reports observed test starts, completions, passes, failures and assertion attempts, including per-test rows. A valid census requires `complete: true`, 197 started and ended tests, matching totals and the native runner output and exit status. Suite-container totals are separate from the 197 test callbacks. Missing output, import failures, incomplete execution and hook errors are setup failures or unknown results, never a successful diagnostic.

Known wrong verdicts remain failing tests. No TODO, skip, expected-failure conversion or exit masking is used. Assertion counts are measured, not inferred from the theoretical maximum of 975. The four configurations are diagnostic controls, not proposed changes to the shipped compiler options. Actual execution results are pending. The fifteen unresolved cases, adjacent `__proto__` schema filter and browser acceptance remain outside the five-case own-member repair.
