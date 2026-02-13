import { createOperationRunner } from "../shared/tutorial-core.js";
import {
  bindDebouncedResize,
  setupRunnerControls,
} from "../shared/tutorial-bootstrap.js";
import { parseArrayInput, randomIntegerArray } from "../shared/array-input.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";
import { mountAutoFitTree } from "../shared/tree-view.js";

class SparseSegTreeTracer {
  constructor(left, right) {
    this.leftBound = left;
    this.rightBound = right;
    this.nextNodeId = 1;
    this.nodesById = new Map();
    this.root = this.#createNode(left, right, 0, null);
  }

  #createNode(left, right, depth, parentId) {
    const node = {
      id: this.nextNodeId,
      left,
      right,
      depth,
      parentId,
      sum: 0,
      lazy: 0,
      leftChild: null,
      rightChild: null,
    };
    this.nextNodeId += 1;
    this.nodesById.set(node.id, node);
    return node;
  }

  get nodeCount() {
    return this.nodesById.size;
  }

  snapshot() {
    const nodes = Array.from(this.nodesById.values()).map((node) => ({
      id: node.id,
      left: node.left,
      right: node.right,
      depth: node.depth,
      parentId: node.parentId,
      sum: node.sum,
      lazy: node.lazy,
      leftChildId: node.leftChild ? node.leftChild.id : null,
      rightChildId: node.rightChild ? node.rightChild.id : null,
    }));

    nodes.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      if (a.left !== b.left) {
        return a.left - b.left;
      }
      return a.id - b.id;
    });

    return nodes;
  }

  #midpoint(node) {
    return Math.floor((node.left + node.right) / 2);
  }

  #ensureLeftChild(node, mid = this.#midpoint(node)) {
    if (!node.leftChild) {
      node.leftChild = this.#createNode(node.left, mid, node.depth + 1, node.id);
    }
    return node.leftChild;
  }

  #ensureRightChild(node, mid = this.#midpoint(node)) {
    if (!node.rightChild) {
      node.rightChild = this.#createNode(mid + 1, node.right, node.depth + 1, node.id);
    }
    return node.rightChild;
  }

  #recompute(node) {
    const leftSum = node.leftChild ? node.leftChild.sum : 0;
    const rightSum = node.rightChild ? node.rightChild.sum : 0;
    node.sum = leftSum + rightSum;
  }

  #pushLazy(node, emit) {
    if (node.lazy === 0 || node.left === node.right) {
      return;
    }

    const pending = node.lazy;
    emit(
      `Resolve pending +${pending} on [${node.left}, ${node.right}]`,
      2,
      node,
    );

    const mid = this.#midpoint(node);
    const leftChild = this.#ensureLeftChild(node, mid);
    const rightChild = this.#ensureRightChild(node, mid);
    const leftLength = mid - node.left + 1;
    const rightLength = node.right - mid;

    leftChild.sum += leftLength * pending;
    leftChild.lazy += pending;
    rightChild.sum += rightLength * pending;
    rightChild.lazy += pending;
    emit(
      `Push pending +${pending} to children of [${node.left}, ${node.right}]`,
      3,
      node,
    );

    node.lazy = 0;
    emit(`Clear lazy tag at [${node.left}, ${node.right}]`, 3, node);
  }

  #pushLazyImmediate(node) {
    if (node.lazy === 0 || node.left === node.right) {
      return;
    }

    const pending = node.lazy;
    const mid = this.#midpoint(node);
    const leftChild = this.#ensureLeftChild(node, mid);
    const rightChild = this.#ensureRightChild(node, mid);
    const leftLength = mid - node.left + 1;
    const rightLength = node.right - mid;

    leftChild.sum += leftLength * pending;
    leftChild.lazy += pending;
    rightChild.sum += rightLength * pending;
    rightChild.lazy += pending;
    node.lazy = 0;
  }

  generateRangeAdd(queryLeft, queryRight, delta) {
    const events = [];

    const emit = (message, line, activeNode, extras = {}) => {
      events.push({
        opType: "update",
        message,
        line,
        activeNodeId: activeNode ? activeNode.id : null,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    const update = (node, left, right) => {
      emit(`Visit node [${node.left}, ${node.right}]`, 1, node);

      if (right < queryLeft || left > queryRight) {
        emit(`No overlap with [${queryLeft}, ${queryRight}]`, 4, node, { contribution: 0 });
        return;
      }

      if (queryLeft <= left && right <= queryRight) {
        const length = right - left + 1;
        node.sum += length * delta;
        if (left !== right) {
          node.lazy += delta;
          emit(
            `Total overlap: add ${delta} * len(${length}) on [${left}, ${right}] and mark lazy`,
            5,
            node,
          );
        } else {
          emit(`Leaf overlap at index ${left}: sum becomes ${node.sum}`, 5, node);
        }
        return;
      }

      this.#pushLazy(node, emit);

      const mid = Math.floor((left + right) / 2);
      if (queryLeft <= mid) {
        const leftChild = this.#ensureLeftChild(node, mid);
        emit(`Recurse into left child [${left}, ${mid}]`, 6, leftChild);
        update(leftChild, left, mid);
      }
      if (queryRight > mid) {
        const rightChild = this.#ensureRightChild(node, mid);
        emit(`Recurse into right child [${mid + 1}, ${right}]`, 6, rightChild);
        update(rightChild, mid + 1, right);
      }

      this.#recompute(node);
      emit(
        `Recompute [${left}, ${right}] from children, sum=${node.sum}`,
        6,
        node,
      );
    };

    update(this.root, this.leftBound, this.rightBound);
    emit(
      `Update complete: added ${delta} to every index in [${queryLeft}, ${queryRight}]`,
      0,
      this.root,
      { done: true },
    );

    return { events };
  }

  applyRangeAdd(queryLeft, queryRight, delta) {
    if (
      !Number.isSafeInteger(queryLeft) ||
      !Number.isSafeInteger(queryRight) ||
      queryLeft > queryRight
    ) {
      return;
    }
    if (queryLeft < this.leftBound || queryRight > this.rightBound) {
      return;
    }
    if (!Number.isSafeInteger(delta) || delta === 0) {
      return;
    }

    const update = (node, left, right) => {
      if (right < queryLeft || left > queryRight) {
        return;
      }

      if (queryLeft <= left && right <= queryRight) {
        const length = right - left + 1;
        node.sum += length * delta;
        if (left !== right) {
          node.lazy += delta;
        }
        return;
      }

      this.#pushLazyImmediate(node);

      const mid = Math.floor((left + right) / 2);
      if (queryLeft <= mid) {
        const leftChild = this.#ensureLeftChild(node, mid);
        update(leftChild, left, mid);
      }
      if (queryRight > mid) {
        const rightChild = this.#ensureRightChild(node, mid);
        update(rightChild, mid + 1, right);
      }
      this.#recompute(node);
    };

    update(this.root, this.leftBound, this.rightBound);
  }

  generateRangeQuery(queryLeft, queryRight) {
    const events = [];

    const emit = (message, line, activeNode, extras = {}) => {
      events.push({
        opType: "query",
        message,
        line,
        activeNodeId: activeNode ? activeNode.id : null,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    const query = (node, left, right) => {
      if (right < queryLeft || left > queryRight) {
        emit(`No overlap for [${left}, ${right}]`, 4, node, { contribution: 0 });
        return 0;
      }

      if (!node) {
        emit(
          `Node [${left}, ${right}] was never created, contribution is 0`,
          1,
          null,
          { contribution: 0 },
        );
        return 0;
      }

      emit(`Visit materialized node [${left}, ${right}] with sum=${node.sum}`, 1, node);

      if (queryLeft <= left && right <= queryRight) {
        emit(
          `Total overlap for [${left}, ${right}], contribute ${node.sum}`,
          5,
          node,
          { contribution: node.sum },
        );
        return node.sum;
      }

      this.#pushLazy(node, emit);

      const mid = Math.floor((left + right) / 2);
      emit(`Partial overlap at [${left}, ${right}], recurse both halves`, 6, node);

      const leftPart = query(node.leftChild, left, mid);
      const rightPart = query(node.rightChild, mid + 1, right);
      const total = leftPart + rightPart;

      emit(
        `Combine [${left}, ${right}] => ${leftPart} + ${rightPart} = ${total}`,
        6,
        node,
        { contribution: total },
      );
      return total;
    };

    const result = query(this.root, this.leftBound, this.rightBound);
    emit(`Query complete: sum[${queryLeft}, ${queryRight}] = ${result}`, 0, this.root, {
      done: true,
      result,
    });

    return { events, result };
  }

  getPointValue(index) {
    if (!Number.isSafeInteger(index) || index < this.leftBound || index > this.rightBound) {
      return 0;
    }

    const queryPoint = (node, left, right, carry) => {
      if (index < left || index > right) {
        return 0;
      }
      if (!node) {
        return carry;
      }
      if (left === right) {
        return node.sum + carry;
      }

      const nextCarry = carry + node.lazy;
      const mid = Math.floor((left + right) / 2);
      if (index <= mid) {
        return queryPoint(node.leftChild, left, mid, nextCarry);
      }
      return queryPoint(node.rightChild, mid + 1, right, nextCarry);
    };

    return queryPoint(this.root, this.leftBound, this.rightBound, 0);
  }
}

const elements = {
  initialValuesInput: document.getElementById("initialValuesInput"),
  loadInitialBtn: document.getElementById("loadInitialBtn"),
  randomInitialBtn: document.getElementById("randomInitialBtn"),
  boundLeft: document.getElementById("boundLeft"),
  boundRight: document.getElementById("boundRight"),
  resetTreeBtn: document.getElementById("resetTreeBtn"),
  opType: document.getElementById("opType"),
  deltaWrap: document.getElementById("deltaWrap"),
  deltaValue: document.getElementById("deltaValue"),
  leftWrap: document.getElementById("leftWrap"),
  leftIndex: document.getElementById("leftIndex"),
  rightWrap: document.getElementById("rightWrap"),
  rightIndex: document.getElementById("rightIndex"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  rootSum: document.getElementById("rootSum"),
  nodeCount: document.getElementById("nodeCount"),
  queryResult: document.getElementById("queryResult"),
  stepCounter: document.getElementById("stepCounter"),
  pointStrip: document.getElementById("pointStrip"),
  treeContainer: document.getElementById("treeContainer"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  speedMs: Number(elements.speedRange.value),
  tracer: null,
  probeIndices: new Set(),
  lastQueryResult: null,
  lastSnapshot: null,
  lastActiveNodeId: null,
  leftBound: 0,
  rightBound: 0,
};

const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});
let operationRunner = null;
const MAX_INITIAL_VALUES = 24;
const MAX_PROBE_POINTS = 120;

function registerProbeIndex(index) {
  if (!Number.isSafeInteger(index)) {
    return;
  }
  if (index < state.leftBound || index > state.rightBound) {
    return;
  }
  if (!state.probeIndices.has(index) && state.probeIndices.size >= MAX_PROBE_POINTS) {
    return;
  }
  state.probeIndices.add(index);
}

function registerProbeRange(left, right) {
  registerProbeIndex(left);
  registerProbeIndex(right);
  registerProbeIndex(Math.floor((left + right) / 2));
}

function renderPoints() {
  elements.pointStrip.innerHTML = "";
  if (!state.tracer) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Reset or load the tree to start probing sample indices.";
    elements.pointStrip.appendChild(message);
    return;
  }

  const indices = Array.from(state.probeIndices).sort((a, b) => a - b);
  if (indices.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "No probe points selected yet.";
    elements.pointStrip.appendChild(message);
    return;
  }

  for (const index of indices) {
    const value = state.tracer.getPointValue(index);
    const cell = document.createElement("div");
    cell.className = "point-cell";
    cell.innerHTML = `<span class="idx">i=${index}</span><span class="val">${value}</span>`;
    elements.pointStrip.appendChild(cell);
  }
}

function renderTree(snapshot, activeNodeId = null) {
  state.lastSnapshot = snapshot;
  state.lastActiveNodeId = activeNodeId;
  elements.treeContainer.innerHTML = "";

  if (!snapshot || snapshot.length === 0) {
    return;
  }

  const nodes = [...snapshot];
  const maxDepth = Math.max(...nodes.map((node) => node.depth));
  const depthToNodes = new Map();

  for (const node of nodes) {
    if (!depthToNodes.has(node.depth)) {
      depthToNodes.set(node.depth, []);
    }
    depthToNodes.get(node.depth).push(node);
  }

  for (const [depth, group] of depthToNodes.entries()) {
    group.sort((a, b) => {
      if (a.left !== b.left) {
        return a.left - b.left;
      }
      if (a.right !== b.right) {
        return a.right - b.right;
      }
      return a.id - b.id;
    });
    depthToNodes.set(depth, group);
  }

  const rowHeight = 118;
  const nodeHeight = 84;
  const topPadding = 14;
  const bottomPadding = 14;
  const panelWidth = Math.max(elements.treeContainer.clientWidth - 8, 620);
  const maxNodesInRow = Math.max(...Array.from(depthToNodes.values()).map((row) => row.length));
  const nodeWidth = 122;
  const sidePadding = Math.ceil(nodeWidth / 2) + 12;
  const minSpacingWidth = sidePadding * 2 + maxNodesInRow * 150;
  const diagramHeight = topPadding + bottomPadding + (maxDepth + 1) * rowHeight;
  const diagramWidth = Math.max(panelWidth, minSpacingWidth);

  const diagram = document.createElement("div");
  diagram.className = "tree-diagram";
  diagram.style.width = `${diagramWidth}px`;
  diagram.style.height = `${diagramHeight}px`;
  diagram.style.setProperty("--tree-node-width", `${nodeWidth}px`);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tree-links");
  svg.setAttribute("viewBox", `0 0 ${diagramWidth} ${diagramHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const coords = new Map();
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const row = depthToNodes.get(depth) ?? [];
    const usableWidth = diagramWidth - sidePadding * 2;
    for (let i = 0; i < row.length; i += 1) {
      const node = row[i];
      const x = sidePadding + ((i + 1) / (row.length + 1)) * usableWidth;
      const y = topPadding + depth * rowHeight;
      coords.set(node.id, { x, y });
    }
  }

  for (const node of nodes) {
    const parent = coords.get(node.id);
    if (!parent) {
      continue;
    }

    if (node.leftChildId && coords.has(node.leftChildId)) {
      const child = coords.get(node.leftChildId);
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      edge.setAttribute("x1", String(parent.x));
      edge.setAttribute("y1", String(parent.y + nodeHeight - 6));
      edge.setAttribute("x2", String(child.x));
      edge.setAttribute("y2", String(child.y + 4));
      edge.setAttribute("class", "tree-edge");
      svg.appendChild(edge);
    }

    if (node.rightChildId && coords.has(node.rightChildId)) {
      const child = coords.get(node.rightChildId);
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      edge.setAttribute("x1", String(parent.x));
      edge.setAttribute("y1", String(parent.y + nodeHeight - 6));
      edge.setAttribute("x2", String(child.x));
      edge.setAttribute("y2", String(child.y + 4));
      edge.setAttribute("class", "tree-edge");
      svg.appendChild(edge);
    }
  }

  diagram.appendChild(svg);

  for (const node of nodes) {
    const position = coords.get(node.id);
    if (!position) {
      continue;
    }

    const card = document.createElement("div");
    card.className = "node-card tree-node";
    if (node.lazy !== 0) {
      card.classList.add("has-lazy");
    }
    if (node.id === activeNodeId) {
      card.classList.add("active");
    }
    card.style.left = `${position.x}px`;
    card.style.top = `${position.y}px`;

    const leftChildLabel = node.leftChildId ? `L:${node.leftChildId}` : "L:-";
    const rightChildLabel = node.rightChildId ? `R:${node.rightChildId}` : "R:-";

    card.innerHTML = `
      <div class="node-head">#${node.id} [${node.left},${node.right}]</div>
      <div class="node-sum">sum: ${node.sum}</div>
      <div class="node-lazy">lazy: ${node.lazy}</div>
      <div class="node-children">${leftChildLabel} | ${rightChildLabel}</div>
    `;

    diagram.appendChild(card);
  }

  mountAutoFitTree(elements.treeContainer, diagram);
}

function rerenderTreeForResize() {
  if (!state.lastSnapshot) {
    return;
  }
  renderTree(state.lastSnapshot, state.lastActiveNodeId);
}

function updateMetrics() {
  elements.rootSum.textContent = state.tracer ? state.tracer.root.sum : "-";
  elements.nodeCount.textContent = state.tracer ? String(state.tracer.nodeCount) : "0";
  elements.queryResult.textContent =
    state.lastQueryResult === null ? "-" : String(state.lastQueryResult);

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function parseBoundsInputs() {
  const left = elements.boundLeft.valueAsNumber;
  const right = elements.boundRight.valueAsNumber;

  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    return { error: "Universe bounds must be safe integers." };
  }
  if (left > right) {
    return { error: "Universe requires left <= right." };
  }
  if (right - left > 1_000_000_000) {
    return { error: "Universe span is too large. Keep (R - L) <= 1,000,000,000." };
  }

  return { left, right };
}

function parseInitialValuesInput(left, right, { allowEmpty = true } = {}) {
  const text = String(elements.initialValuesInput.value ?? "").trim();
  if (text.length === 0) {
    if (allowEmpty) {
      return { values: [] };
    }
    return { error: "Initial values cannot be empty." };
  }

  const parsed = parseArrayInput(text, {
    maxValues: MAX_INITIAL_VALUES,
    maxValuesMessage: `Please use at most ${MAX_INITIAL_VALUES} initial values.`,
  });
  if (parsed.error) {
    return parsed;
  }

  for (const value of parsed.values) {
    if (!Number.isSafeInteger(value)) {
      return { error: `Initial value ${value} is outside the safe integer range.` };
    }
  }

  const universeSize = right - left + 1;
  if (parsed.values.length > universeSize) {
    return {
      error:
        `Initial values length (${parsed.values.length}) exceeds universe size ` +
        `(${universeSize}) for [${left}, ${right}].`,
    };
  }

  return { values: parsed.values };
}

function syncInputBounds() {
  const min = String(state.leftBound);
  const max = String(state.rightBound);

  elements.leftIndex.min = min;
  elements.leftIndex.max = max;
  elements.rightIndex.min = min;
  elements.rightIndex.max = max;
}

function clampToBounds(value) {
  if (!Number.isFinite(value)) {
    return state.leftBound;
  }
  return Math.min(state.rightBound, Math.max(state.leftBound, Math.trunc(value)));
}

function loadTree(left, right, initialValues = []) {
  if (operationRunner) {
    operationRunner.stop();
    operationRunner.ensureNoPending();
  }

  state.leftBound = left;
  state.rightBound = right;
  state.tracer = new SparseSegTreeTracer(left, right);
  state.probeIndices = new Set();
  for (let offset = 0; offset < initialValues.length; offset += 1) {
    const value = initialValues[offset];
    if (value === 0) {
      continue;
    }
    const index = left + offset;
    state.tracer.applyRangeAdd(index, index, value);
    registerProbeIndex(index);
  }
  registerProbeRange(left, right);
  state.lastQueryResult = null;

  syncInputBounds();

  const leftCandidate = elements.leftIndex.valueAsNumber;
  const rightCandidate = elements.rightIndex.valueAsNumber;
  const defaultRight = Math.min(right, left + Math.floor((right - left) / 4));

  elements.leftIndex.value = String(
    clampToBounds(Number.isFinite(leftCandidate) ? leftCandidate : left),
  );
  elements.rightIndex.value = String(
    clampToBounds(Number.isFinite(rightCandidate) ? rightCandidate : defaultRight),
  );

  if (Number(elements.leftIndex.value) > Number(elements.rightIndex.value)) {
    elements.rightIndex.value = elements.leftIndex.value;
  }

  renderPoints();
  renderTree(state.tracer.snapshot(), null);
  updateMetrics();

  helpers.focusCodePanel(elements.opType.value);
  helpers.clearCodeHighlights();

  const initialCount = initialValues.length;
  const message =
    initialCount === 0
      ? `Sparse tree reset for universe [${left}, ${right}].`
      : `Sparse tree loaded for [${left}, ${right}] with ${initialCount} initial values.`;
  helpers.updateStatus(message);
  helpers.appendLog(message, "ok");
}

function handleResetTree() {
  const parsed = parseBoundsInputs();
  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }

  loadTree(parsed.left, parsed.right, []);
}

function handleLoadInitialValues() {
  const parsedBounds = parseBoundsInputs();
  if (parsedBounds.error) {
    helpers.updateStatus(parsedBounds.error);
    helpers.appendLog(parsedBounds.error);
    return;
  }

  const parsedInitial = parseInitialValuesInput(parsedBounds.left, parsedBounds.right, {
    allowEmpty: false,
  });
  if (parsedInitial.error) {
    helpers.updateStatus(parsedInitial.error);
    helpers.appendLog(parsedInitial.error);
    return;
  }

  loadTree(parsedBounds.left, parsedBounds.right, parsedInitial.values);
}

function handleRandomInitialValues() {
  const parsedBounds = parseBoundsInputs();
  if (parsedBounds.error) {
    helpers.updateStatus(parsedBounds.error);
    helpers.appendLog(parsedBounds.error);
    return;
  }

  const universeSize = parsedBounds.right - parsedBounds.left + 1;
  const maxLength = Math.max(1, Math.min(10, universeSize, MAX_INITIAL_VALUES));
  const minLength = Math.min(6, maxLength);
  const values = randomIntegerArray({
    minLength,
    maxLength,
    maxValue: 10,
  });

  elements.initialValuesInput.value = values.join(", ");
  loadTree(parsedBounds.left, parsedBounds.right, values);
}

function handleOperationTypeChange() {
  const isUpdate = elements.opType.value === "update";

  elements.deltaWrap.style.display = isUpdate ? "flex" : "none";
  elements.leftWrap.style.display = "flex";
  elements.rightWrap.style.display = "flex";

  helpers.focusCodePanel(elements.opType.value);
  helpers.clearCodeHighlights();
}

function setOperationType(opType) {
  elements.opType.value = opType;
  handleOperationTypeChange();
  helpers.updateStatus(
    opType === "update"
      ? "Shortcut: switched to Range Add Update mode."
      : "Shortcut: switched to Range Sum Query mode.",
  );
}

function validateRange(left, right) {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    return "L and R must be integers.";
  }
  if (left > right) {
    return "Require L <= R.";
  }
  if (left < state.leftBound || right > state.rightBound) {
    return `Query range must stay within [${state.leftBound}, ${state.rightBound}].`;
  }
  return null;
}

function prepareOperation() {
  if (!state.tracer) {
    const message = "Reset the sparse tree first.";
    helpers.updateStatus(message);
    helpers.appendLog(message);
    return null;
  }

  const opType = elements.opType.value;
  const left = elements.leftIndex.valueAsNumber;
  const right = elements.rightIndex.valueAsNumber;
  const rangeError = validateRange(left, right);
  if (rangeError) {
    helpers.updateStatus(rangeError);
    helpers.appendLog(rangeError);
    return null;
  }
  registerProbeRange(left, right);

  if (opType === "update") {
    const delta = elements.deltaValue.valueAsNumber;

    if (!Number.isSafeInteger(delta)) {
      const message = "Delta must be an integer.";
      helpers.updateStatus(message);
      helpers.appendLog(message);
      return null;
    }

    const trace = state.tracer.generateRangeAdd(left, right, delta);

    return {
      opType,
      events: trace.events,
      summary: `Update applied: added ${delta} to [${left}, ${right}]`,
    };
  }

  const trace = state.tracer.generateRangeQuery(left, right);

  return {
    opType,
    events: trace.events,
    summary: `Query result for [${left}, ${right}] is ${trace.result}`,
    result: trace.result,
  };
}

function finalizePendingOperation(meta) {
  if (typeof meta.result === "number") {
    state.lastQueryResult = meta.result;
  }

  const text = meta.summary;

  helpers.updateStatus(text);
  helpers.appendLog(text, "ok");

  renderPoints();
  renderTree(state.tracer.snapshot(), null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderTree(event.snapshot, event.activeNodeId);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
}

function finishCurrentOperation() {
  operationRunner.finishCurrent();
}

function init() {
  operationRunner = createOperationRunner({
    getSpeedMs: () => state.speedMs,
    prepareOperation,
    applyEvent,
    updateMetrics,
    finalizeOperation: finalizePendingOperation,
    onPrepared: (operation) => {
      helpers.appendLog(`Prepared ${operation.opType} with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      helpers.updateStatus("No pending operation to finish.");
    },
  });

  elements.resetTreeBtn.addEventListener("click", handleResetTree);
  elements.loadInitialBtn.addEventListener("click", handleLoadInitialValues);
  elements.randomInitialBtn.addEventListener("click", handleRandomInitialValues);
  elements.opType.addEventListener("change", handleOperationTypeChange);

  setupRunnerControls({
    elements,
    runAnimated: () => operationRunner.runAnimated(),
    runStep: () => operationRunner.step(),
    runInstant: () => operationRunner.runInstant(),
    runFinish: finishCurrentOperation,
    getSpeedMs: () => state.speedMs,
    setSpeedMs: (speedMs) => {
      state.speedMs = speedMs;
    },
    clearLog: () => helpers.clearLog(),
    extraShortcuts: {
      b: () => handleResetTree(),
      l: () => handleLoadInitialValues(),
      r: () => handleRandomInitialValues(),
      u: () => setOperationType("update"),
      q: () => setOperationType("query"),
    },
  });

  bindDebouncedResize({
    onResize: () => {
      rerenderTreeForResize();
    },
    delayMs: 120,
  });

  handleOperationTypeChange();
  handleLoadInitialValues();
}

init();
