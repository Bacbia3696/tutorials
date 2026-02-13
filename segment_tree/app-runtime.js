import { createOperationRunner } from "../shared/tutorial-core.js";
import {
  bindDebouncedResize,
  setupRunnerControls,
} from "../shared/tutorial-bootstrap.js";
import { parseArrayInput, randomIntegerArray } from "../shared/array-input.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";
import { mountAutoFitTree } from "../shared/tree-view.js";

class LazySegTreeTracer {
  constructor(values) {
    this.n = values.length;
    this.tree = new Array(this.n * 4).fill(0);
    this.lazy = new Array(this.n * 4).fill(0);
    this.start = new Array(this.n * 4).fill(null);
    this.end = new Array(this.n * 4).fill(null);
    this.depth = new Array(this.n * 4).fill(0);
    this.nodes = [];
    this.#build(1, 0, this.n - 1, 0, values);
  }

  #build(node, left, right, level, values) {
    this.start[node] = left;
    this.end[node] = right;
    this.depth[node] = level;
    this.nodes.push(node);

    if (left === right) {
      this.tree[node] = values[left];
      return;
    }

    const mid = Math.floor((left + right) / 2);
    this.#build(node * 2, left, mid, level + 1, values);
    this.#build(node * 2 + 1, mid + 1, right, level + 1, values);
    this.tree[node] = this.tree[node * 2] + this.tree[node * 2 + 1];
  }

  generateRangeAdd(qLeft, qRight, delta) {
    const tree = [...this.tree];
    const lazy = [...this.lazy];
    const events = [];

    const emit = (message, node, line, extras = {}) => {
      events.push({
        opType: "update",
        message,
        node,
        line,
        tree: [...tree],
        lazy: [...lazy],
        ...extras,
      });
    };

    const pushDown = (node, left, right) => {
      if (lazy[node] === 0 || left === right) {
        return;
      }
      const pending = lazy[node];
      emit(
        `Resolve pending +${pending} on [${left}, ${right}] before descending`,
        node,
        2,
      );

      const mid = Math.floor((left + right) / 2);
      const leftLength = mid - left + 1;
      const rightLength = right - mid;

      tree[node * 2] += leftLength * pending;
      lazy[node * 2] += pending;
      tree[node * 2 + 1] += rightLength * pending;
      lazy[node * 2 + 1] += pending;
      emit(
        `Push pending +${pending} to children of [${left}, ${right}]`,
        node,
        3,
      );

      lazy[node] = 0;
      emit(`Clear lazy tag at [${left}, ${right}]`, node, 3);
    };

    const update = (node, left, right) => {
      emit(`Visit [${left}, ${right}]`, node, 1);

      if (right < qLeft || left > qRight) {
        emit(`No overlap with query range [${qLeft}, ${qRight}]`, node, 4);
        return;
      }

      if (qLeft <= left && right <= qRight) {
        const length = right - left + 1;
        tree[node] += length * delta;
        if (left !== right) {
          lazy[node] += delta;
        }
        emit(
          `Total overlap: add ${delta} * len(${length}) to [${left}, ${right}], mark node lazy if internal`,
          node,
          5,
        );
        return;
      }

      pushDown(node, left, right);

      const mid = Math.floor((left + right) / 2);
      if (qLeft <= mid) {
        update(node * 2, left, mid);
      }
      if (qRight > mid) {
        update(node * 2 + 1, mid + 1, right);
      }
      tree[node] = tree[node * 2] + tree[node * 2 + 1];
      emit(`Recompute [${left}, ${right}] = leftChild + rightChild`, node, 6);
    };

    update(1, 0, this.n - 1);
    emit(
      `Update complete: added ${delta} to every index in [${qLeft}, ${qRight}]`,
      1,
      0,
      { done: true },
    );

    this.tree = tree;
    this.lazy = lazy;
    return { events };
  }

  generateRangeQuery(qLeft, qRight) {
    const tree = [...this.tree];
    const lazy = [...this.lazy];
    const events = [];

    const emit = (message, node, line, extras = {}) => {
      events.push({
        opType: "query",
        message,
        node,
        line,
        tree: [...tree],
        lazy: [...lazy],
        ...extras,
      });
    };

    const pushDown = (node, left, right) => {
      if (lazy[node] === 0 || left === right) {
        return;
      }
      const pending = lazy[node];
      emit(
        `Resolve pending +${pending} on [${left}, ${right}] before descending`,
        node,
        2,
      );

      const mid = Math.floor((left + right) / 2);
      const leftLength = mid - left + 1;
      const rightLength = right - mid;

      tree[node * 2] += leftLength * pending;
      lazy[node * 2] += pending;
      tree[node * 2 + 1] += rightLength * pending;
      lazy[node * 2 + 1] += pending;
      emit(
        `Push pending +${pending} down from [${left}, ${right}]`,
        node,
        3,
      );

      lazy[node] = 0;
      emit(`Clear lazy tag at [${left}, ${right}]`, node, 3);
    };

    const query = (node, left, right) => {
      emit(`Visit [${left}, ${right}]`, node, 1);

      if (right < qLeft || left > qRight) {
        emit(`No overlap with [${qLeft}, ${qRight}] => return 0`, node, 4, {
          contribution: 0,
        });
        return 0;
      }

      if (qLeft <= left && right <= qRight) {
        emit(
          `Total overlap: contribute sum(${tree[node]}) from [${left}, ${right}]`,
          node,
          5,
          { contribution: tree[node] },
        );
        return tree[node];
      }

      pushDown(node, left, right);

      const mid = Math.floor((left + right) / 2);
      let leftPart = 0;
      let rightPart = 0;
      if (qLeft <= mid) {
        leftPart = query(node * 2, left, mid);
      }
      if (qRight > mid) {
        rightPart = query(node * 2 + 1, mid + 1, right);
      }
      const total = leftPart + rightPart;
      emit(
        `Combine children for [${left}, ${right}] => ${leftPart} + ${rightPart} = ${total}`,
        node,
        6,
        { contribution: total },
      );
      return total;
    };

    const result = query(1, 0, this.n - 1);
    emit(`Query complete: sum[${qLeft}, ${qRight}] = ${result}`, 1, 0, {
      done: true,
      result,
    });

    this.tree = tree;
    this.lazy = lazy;
    return { events, result };
  }
}

const elements = {
  arrayInput: document.getElementById("arrayInput"),
  loadArrayBtn: document.getElementById("loadArrayBtn"),
  randomArrayBtn: document.getElementById("randomArrayBtn"),
  opType: document.getElementById("opType"),
  leftIndex: document.getElementById("leftIndex"),
  rightIndex: document.getElementById("rightIndex"),
  deltaValue: document.getElementById("deltaValue"),
  deltaWrap: document.getElementById("deltaWrap"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  rootSum: document.getElementById("rootSum"),
  queryResult: document.getElementById("queryResult"),
  stepCounter: document.getElementById("stepCounter"),
  arrayStrip: document.getElementById("arrayStrip"),
  treeContainer: document.getElementById("treeContainer"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  values: [],
  segTree: null,
  speedMs: Number(elements.speedRange.value),
  lastQueryResult: null,
  lastRenderedTree: null,
  lastRenderedLazy: null,
  lastActiveNode: null,
};
const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});
let operationRunner = null;


function renderArray() {
  elements.arrayStrip.innerHTML = "";
  state.values.forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "array-cell";
    cell.innerHTML = `<span class="idx">i=${index}</span><span class="val">${value}</span>`;
    elements.arrayStrip.appendChild(cell);
  });
}

function renderTree(treeValues, lazyValues, activeNode = null) {
  state.lastRenderedTree = treeValues;
  state.lastRenderedLazy = lazyValues;
  state.lastActiveNode = activeNode;
  elements.treeContainer.innerHTML = "";

  if (!state.segTree) {
    return;
  }

  const nodes = state.segTree.nodes.filter((node) => state.segTree.start[node] !== null);
  const maxDepth = Math.max(...nodes.map((node) => state.segTree.depth[node]));
  const rowHeight = 120;
  const nodeHeight = 84;
  const topPadding = 14;
  const bottomPadding = 14;
  const panelWidth = Math.max(elements.treeContainer.clientWidth - 8, 620);
  const nodeWidth =
    state.segTree.n <= 10 ? 98 : state.segTree.n <= 14 ? 92 : 86;
  const sidePadding = Math.ceil(nodeWidth / 2) + 10;
  const minSpacingWidth = sidePadding * 2 + state.segTree.n * 64;
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
  for (const node of nodes) {
    const left = state.segTree.start[node];
    const right = state.segTree.end[node];
    const depth = state.segTree.depth[node];
    const centerIndex = (left + right + 1) / 2;
    const usableWidth = diagramWidth - sidePadding * 2;
    const x = sidePadding + (centerIndex / state.segTree.n) * usableWidth;
    const y = topPadding + depth * rowHeight;
    coords.set(node, { x, y });
  }

  for (const node of nodes) {
    const parent = coords.get(node);
    const leftChild = node * 2;
    const rightChild = node * 2 + 1;

    if (coords.has(leftChild)) {
      const child = coords.get(leftChild);
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      edge.setAttribute("x1", String(parent.x));
      edge.setAttribute("y1", String(parent.y + nodeHeight - 6));
      edge.setAttribute("x2", String(child.x));
      edge.setAttribute("y2", String(child.y + 4));
      edge.setAttribute("class", "tree-edge");
      svg.appendChild(edge);
    }

    if (coords.has(rightChild)) {
      const child = coords.get(rightChild);
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
    const card = document.createElement("div");
    const left = state.segTree.start[node];
    const right = state.segTree.end[node];
    const sum = treeValues[node] ?? 0;
    const lazy = lazyValues[node] ?? 0;
    const { x, y } = coords.get(node);

    card.className = "node-card tree-node";
    if (lazy !== 0) {
      card.classList.add("has-lazy");
    }
    if (activeNode === node) {
      card.classList.add("active");
    }
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;

    card.innerHTML = `
      <div class="node-head">#${node} [${left},${right}]</div>
      <div class="node-sum">sum: ${sum}</div>
      <div class="node-lazy">lazy: ${lazy}</div>
    `;
    diagram.appendChild(card);
  }

  mountAutoFitTree(elements.treeContainer, diagram);
}

function rerenderTreeForResize() {
  if (!state.segTree || !state.lastRenderedTree || !state.lastRenderedLazy) {
    return;
  }
  renderTree(state.lastRenderedTree, state.lastRenderedLazy, state.lastActiveNode);
}

function updateMetrics() {
  elements.rootSum.textContent = state.segTree ? state.segTree.tree[1] : "-";
  elements.queryResult.textContent =
    state.lastQueryResult === null ? "-" : state.lastQueryResult;
  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function setRangeBounds() {
  if (!state.segTree) {
    return;
  }

  const maxIndex = state.segTree.n - 1;
  elements.leftIndex.max = String(maxIndex);
  elements.rightIndex.max = String(maxIndex);

  if (Number(elements.leftIndex.value) > maxIndex) {
    elements.leftIndex.value = String(maxIndex);
  }
  if (Number(elements.rightIndex.value) > maxIndex) {
    elements.rightIndex.value = String(maxIndex);
  }
}

function finalizePendingOperation(meta) {
  if (meta.nextValues) {
    state.values = meta.nextValues;
  }
  if (typeof meta.result === "number") {
    state.lastQueryResult = meta.result;
  }

  const mismatch =
    typeof meta.result === "number" &&
    typeof meta.naive === "number" &&
    meta.result !== meta.naive;

  const text = mismatch
    ? `${meta.summary} (warning: naive check is ${meta.naive})`
    : meta.summary;

  helpers.updateStatus(text);
  helpers.appendLog(text, mismatch ? "" : "ok");

  renderArray();
  renderTree(state.segTree.tree, state.segTree.lazy, null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderTree(event.tree, event.lazy, event.node);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
}

function validateRange(left, right, size) {
  if (!Number.isInteger(left) || !Number.isInteger(right)) {
    return "L and R must be integers.";
  }
  if (left < 0 || right < 0) {
    return "L and R must be non-negative.";
  }
  if (left > right) {
    return "Require L <= R.";
  }
  if (right >= size) {
    return `R is out of range. Max index is ${size - 1}.`;
  }
  return null;
}

function prepareOperation() {
  if (!state.segTree) {
    helpers.updateStatus("Load an array first.");
    return null;
  }

  const opType = elements.opType.value;
  const left = Number(elements.leftIndex.value);
  const right = Number(elements.rightIndex.value);
  const rangeError = validateRange(left, right, state.segTree.n);

  if (rangeError) {
    helpers.updateStatus(rangeError);
    helpers.appendLog(rangeError);
    return null;
  }

  if (opType === "update") {
    const delta = Number(elements.deltaValue.value);
    if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
      const message = "Delta must be an integer.";
      helpers.updateStatus(message);
      helpers.appendLog(message);
      return null;
    }

    const trace = state.segTree.generateRangeAdd(left, right, delta);
    const nextValues = [...state.values];
    for (let i = left; i <= right; i += 1) {
      nextValues[i] += delta;
    }

    return {
      opType,
      events: trace.events,
      summary: `Update applied: added ${delta} to [${left}, ${right}]`,
      nextValues,
    };
  }

  const trace = state.segTree.generateRangeQuery(left, right);
  const naive = state.values
    .slice(left, right + 1)
    .reduce((acc, value) => acc + value, 0);

  return {
    opType,
    events: trace.events,
    summary: `Query result for [${left}, ${right}] is ${trace.result} (naive: ${naive})`,
    result: trace.result,
    naive,
  };
}

function loadArray(values) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.values = [...values];
  state.segTree = new LazySegTreeTracer(values);
  state.lastQueryResult = null;

  setRangeBounds();
  renderArray();
  renderTree(state.segTree.tree, state.segTree.lazy, null);
  updateMetrics();

  const opType = elements.opType.value;
  helpers.focusCodePanel(opType);
  helpers.clearCodeHighlights();

  const message = `Loaded array of length ${values.length}. Ready for operations.`;
  helpers.updateStatus(message);
  helpers.appendLog(`${message} Values: [${values.join(", ")}]`, "ok");
}

function handleArrayLoadInput() {
  const parsed = parseArrayInput(elements.arrayInput.value, {
    maxValues: 16,
    maxValuesMessage: "Please use at most 16 values so the tree stays readable.",
  });
  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }
  loadArray(parsed.values);
}

function handleRandomArray() {
  const values = randomIntegerArray({ minLength: 6, maxLength: 10, maxValue: 10 });
  elements.arrayInput.value = values.join(", ");
  loadArray(values);
}

function handleOperationTypeChange() {
  const isUpdate = elements.opType.value === "update";
  elements.deltaWrap.style.display = isUpdate ? "flex" : "none";
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

  elements.loadArrayBtn.addEventListener("click", handleArrayLoadInput);
  elements.randomArrayBtn.addEventListener("click", handleRandomArray);

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
      l: () => handleArrayLoadInput(),
      r: () => handleRandomArray(),
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
  handleArrayLoadInput();
}

init();
