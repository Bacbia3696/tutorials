#!/usr/bin/env bash
set -euo pipefail

MODULES=(
  trie
  segment_tree
  sparse_segment_tree
  fenwick_tree
  dsu
  dijkstra
  bellman_ford
  topological_sort
)

for module in "${MODULES[@]}"; do
  node --input-type=module --check < "${module}/app.js"
  node --input-type=module --check < "${module}/app-runtime.js"
done

node --input-type=module --check < shared/lit.js
node --input-type=module --check < shared/tutorial-lit-host.js
node --input-type=module --check < shared/tutorial-app.js
node --input-type=module --check < shared/tutorial-registry.js
node --input-type=module --check < shared/tutorial-page.js
node --input-type=module --check < shared/landing-page.js
node --input-type=module --check < shared/array-input.js
node shared/tests/shared-logic.test.mjs

echo "ok - smoke-check passed"
