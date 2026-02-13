import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function importBrowserModule(absolutePath) {
  const source = await fs.readFile(absolutePath, 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

const thisFile = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFile);
const sharedDir = path.resolve(testsDir, '..');

const graphInput = await importBrowserModule(path.join(sharedDir, 'graph-input.js'));
const tutorialCore = await importBrowserModule(path.join(sharedDir, 'tutorial-core.js'));

const {
  createLabelToIndex,
  edgeKeyForMode,
  parseDirectedEdgesInput,
  parseNodeLabelsInput,
  parseWeightedEdgesInput,
} = graphInput;
const { createOperationRunner } = tutorialCore;

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('parseNodeLabelsInput normalizes labels and validates size', () => {
  assert.deepEqual(parseNodeLabelsInput('a, b c', { maxNodes: 5 }), {
    nodes: ['A', 'B', 'C'],
  });
  assert.equal(parseNodeLabelsInput('a, a', { maxNodes: 5 }).error, "Duplicate node label 'A'.");
});

test('parseWeightedEdgesInput enforces dijkstra-style constraints', () => {
  const labelToIndex = createLabelToIndex(['A', 'B', 'C']);
  const parsed = parseWeightedEdgesInput('A B 3\nB C 4', {
    labelToIndex,
    mode: 'undirected',
    requirePositiveInteger: true,
  });
  assert.ok(!parsed.error);
  assert.deepEqual(parsed.edges, [
    { id: 1, from: 0, to: 1, weight: 3 },
    { id: 2, from: 1, to: 2, weight: 4 },
  ]);

  const duplicate = parseWeightedEdgesInput('A B 3\nB A 7', {
    labelToIndex,
    mode: 'undirected',
    requirePositiveInteger: true,
  });
  assert.equal(duplicate.error, "Edge line 2: duplicate edge 'B A'.");
});

test('parseDirectedEdgesInput parses DAG edge lines', () => {
  const labelToIndex = createLabelToIndex(['A', 'B', 'C']);
  const parsed = parseDirectedEdgesInput('A B\nB C', { labelToIndex });
  assert.ok(!parsed.error);
  assert.deepEqual(parsed.edges, [
    { id: 1, from: 0, to: 1 },
    { id: 2, from: 1, to: 2 },
  ]);

  const withSelfLoop = parseDirectedEdgesInput('A A', {
    labelToIndex,
    allowSelfLoops: true,
  });
  assert.ok(!withSelfLoop.error);
  assert.deepEqual(withSelfLoop.edges, [{ id: 1, from: 0, to: 0 }]);
});

test('edgeKeyForMode handles directed and undirected uniqueness', () => {
  assert.equal(edgeKeyForMode('directed', 1, 2), '1->2');
  assert.equal(edgeKeyForMode('undirected', 1, 2), '1--2');
  assert.equal(edgeKeyForMode('undirected', 2, 1), '1--2');
});

test('createOperationRunner step and finishCurrent are deterministic', () => {
  const applied = [];
  let finalizeCount = 0;

  const runner = createOperationRunner({
    getSpeedMs: () => 0,
    prepareOperation: () => ({
      opType: 'demo',
      events: [1, 2, 3],
    }),
    applyEvent: (event) => applied.push(event),
    finalizeOperation: () => {
      finalizeCount += 1;
    },
  });

  runner.step();
  runner.finishCurrent();

  assert.deepEqual(applied, [1, 3]);
  assert.equal(finalizeCount, 1);
  assert.equal(runner.hasPending, false);
});

test('createOperationRunner runAnimated applies all events and finalizes once', async () => {
  const applied = [];
  let finalizeCount = 0;

  const runner = createOperationRunner({
    getSpeedMs: () => 0,
    prepareOperation: () => ({
      opType: 'demo',
      events: [10, 20],
    }),
    applyEvent: (event) => applied.push(event),
    finalizeOperation: () => {
      finalizeCount += 1;
    },
  });

  runner.runAnimated();
  await wait(40);

  assert.deepEqual(applied, [10, 20]);
  assert.equal(finalizeCount, 1);
  assert.equal(runner.hasPending, false);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
