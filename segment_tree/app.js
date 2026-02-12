import {
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
import {
  bindDebouncedResize,
  setupRunnerControls,
} from "../shared/tutorial-bootstrap.js";

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

    const resolveLazy = (node, left, right) => {
      if (lazy[node] === 0) {
        return;
      }
      const pending = lazy[node];
      tree[node] += (right - left + 1) * pending;
      emit(
        `Resolve pending +${pending} on [${left}, ${right}], update node sum`,
        node,
        2,
      );

      if (left !== right) {
        lazy[node * 2] += pending;
        lazy[node * 2 + 1] += pending;
        emit(
          `Push pending +${pending} to children of [${left}, ${right}]`,
          node,
          3,
        );
      }

      lazy[node] = 0;
      emit(`Clear lazy tag at [${left}, ${right}]`, node, 3);
    };

    const update = (node, left, right) => {
      emit(`Visit [${left}, ${right}]`, node, 1);
      resolveLazy(node, left, right);

      if (right < qLeft || left > qRight) {
        emit(`No overlap with query range [${qLeft}, ${qRight}]`, node, 4);
        return;
      }

      if (qLeft <= left && right <= qRight) {
        tree[node] += (right - left + 1) * delta;
        emit(
          `Total overlap: add ${delta} * len(${right - left + 1}) to [${left}, ${right}]`,
          node,
          5,
        );
        if (left !== right) {
          lazy[node * 2] += delta;
          lazy[node * 2 + 1] += delta;
          emit(
            `Mark children lazy += ${delta} for segment [${left}, ${right}]`,
            node,
            5,
          );
        }
        return;
      }

      const mid = Math.floor((left + right) / 2);
      update(node * 2, left, mid);
      update(node * 2 + 1, mid + 1, right);
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

    const resolveLazy = (node, left, right) => {
      if (lazy[node] === 0) {
        return;
      }
      const pending = lazy[node];
      tree[node] += (right - left + 1) * pending;
      emit(
        `Resolve pending +${pending} on [${left}, ${right}] before query`,
        node,
        2,
      );

      if (left !== right) {
        lazy[node * 2] += pending;
        lazy[node * 2 + 1] += pending;
        emit(
          `Push pending +${pending} down from [${left}, ${right}]`,
          node,
          3,
        );
      }

      lazy[node] = 0;
      emit(`Clear lazy tag at [${left}, ${right}]`, node, 3);
    };

    const query = (node, left, right) => {
      emit(`Visit [${left}, ${right}]`, node, 1);
      resolveLazy(node, left, right);

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

      const mid = Math.floor((left + right) / 2);
      const leftPart = query(node * 2, left, mid);
      const rightPart = query(node * 2 + 1, mid + 1, right);
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

const appState = {
  values: [],
  segTree: null,
  speedMs: Number(elements.speedRange.value),
  lastQueryResult: null,
  lastRenderedTree: null,
  lastRenderedLazy: null,
  lastActiveNode: null,
};
const logger = createLogger(elements.logOutput);
const codeHighlighter = createCodeHighlighter(".code-panel");
let operationRunner = null;

function parseArrayInput(text) {
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { error: "Array cannot be empty." };
  }
  if (tokens.length > 16) {
    return { error: "Please use at most 16 values so the tree stays readable." };
  }

  const values = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { error: `Invalid integer: ${token}` };
    }
    values.push(value);
  }

  return { values };
}

function randomArray() {
  const length = 6 + Math.floor(Math.random() * 5);
  const values = [];
  for (let i = 0; i < length; i += 1) {
    values.push(Math.floor(Math.random() * 10));
  }
  return values;
}

function updateStatus(message) {
  elements.statusMessage.textContent = message;
}

function appendLog(message, tone = "") {
  logger.append(message, tone);
}

function clearCodeHighlights() {
  codeHighlighter.clear();
}

function focusCodePanel(opType) {
  codeHighlighter.focus(opType);
}

function highlightCode(opType, line) {
  codeHighlighter.highlight(opType, line);
}

function renderArray() {
  elements.arrayStrip.innerHTML = "";
  appState.values.forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "array-cell";
    cell.innerHTML = `<span class="idx">i=${index}</span><span class="val">${value}</span>`;
    elements.arrayStrip.appendChild(cell);
  });
}

function renderTree(treeValues, lazyValues, activeNode = null) {
  appState.lastRenderedTree = treeValues;
  appState.lastRenderedLazy = lazyValues;
  appState.lastActiveNode = activeNode;
  elements.treeContainer.innerHTML = "";

  if (!appState.segTree) {
    return;
  }

  const nodes = appState.segTree.nodes.filter((node) => appState.segTree.start[node] !== null);
  const maxDepth = Math.max(...nodes.map((node) => appState.segTree.depth[node]));
  const rowHeight = 120;
  const nodeHeight = 84;
  const topPadding = 14;
  const bottomPadding = 14;
  const panelWidth = Math.max(elements.treeContainer.clientWidth - 8, 620);
  const nodeWidth =
    appState.segTree.n <= 10 ? 98 : appState.segTree.n <= 14 ? 92 : 86;
  const sidePadding = Math.ceil(nodeWidth / 2) + 10;
  const minSpacingWidth = sidePadding * 2 + appState.segTree.n * 64;
  const diagramHeight = topPadding + bottomPadding + (maxDepth + 1) * rowHeight;
  const diagramWidth = Math.max(panelWidth, minSpacingWidth);

  const scroll = document.createElement("div");
  scroll.className = "tree-scroll";

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
    const left = appState.segTree.start[node];
    const right = appState.segTree.end[node];
    const depth = appState.segTree.depth[node];
    const centerIndex = (left + right + 1) / 2;
    const usableWidth = diagramWidth - sidePadding * 2;
    const x = sidePadding + (centerIndex / appState.segTree.n) * usableWidth;
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
    const left = appState.segTree.start[node];
    const right = appState.segTree.end[node];
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

  scroll.appendChild(diagram);
  elements.treeContainer.appendChild(scroll);
}

function rerenderTreeForResize() {
  if (!appState.segTree || !appState.lastRenderedTree || !appState.lastRenderedLazy) {
    return;
  }
  renderTree(appState.lastRenderedTree, appState.lastRenderedLazy, appState.lastActiveNode);
}

function updateMetrics() {
  elements.rootSum.textContent = appState.segTree ? appState.segTree.tree[1] : "-";
  elements.queryResult.textContent =
    appState.lastQueryResult === null ? "-" : appState.lastQueryResult;
  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function setRangeBounds() {
  if (!appState.segTree) {
    return;
  }

  const maxIndex = appState.segTree.n - 1;
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
    appState.values = meta.nextValues;
  }
  if (typeof meta.result === "number") {
    appState.lastQueryResult = meta.result;
  }

  const mismatch =
    typeof meta.result === "number" &&
    typeof meta.naive === "number" &&
    meta.result !== meta.naive;

  const text = mismatch
    ? `${meta.summary} (warning: naive check is ${meta.naive})`
    : meta.summary;

  updateStatus(text);
  appendLog(text, mismatch ? "" : "ok");

  renderArray();
  renderTree(appState.segTree.tree, appState.segTree.lazy, null);
  clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderTree(event.tree, event.lazy, event.node);
  highlightCode(event.opType, event.line);
  updateStatus(event.message);
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
  if (!appState.segTree) {
    updateStatus("Load an array first.");
    return null;
  }

  const opType = elements.opType.value;
  const left = Number(elements.leftIndex.value);
  const right = Number(elements.rightIndex.value);
  const rangeError = validateRange(left, right, appState.segTree.n);

  if (rangeError) {
    updateStatus(rangeError);
    appendLog(rangeError);
    return null;
  }

  if (opType === "update") {
    const delta = Number(elements.deltaValue.value);
    if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
      const message = "Delta must be an integer.";
      updateStatus(message);
      appendLog(message);
      return null;
    }

    const trace = appState.segTree.generateRangeAdd(left, right, delta);
    const nextValues = [...appState.values];
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

  const trace = appState.segTree.generateRangeQuery(left, right);
  const naive = appState.values
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

  appState.values = [...values];
  appState.segTree = new LazySegTreeTracer(values);
  appState.lastQueryResult = null;

  setRangeBounds();
  renderArray();
  renderTree(appState.segTree.tree, appState.segTree.lazy, null);
  updateMetrics();

  const opType = elements.opType.value;
  focusCodePanel(opType);
  clearCodeHighlights();

  const message = `Loaded array of length ${values.length}. Ready for operations.`;
  updateStatus(message);
  appendLog(`${message} Values: [${values.join(", ")}]`, "ok");
}

function handleArrayLoadInput() {
  const parsed = parseArrayInput(elements.arrayInput.value);
  if (parsed.error) {
    updateStatus(parsed.error);
    appendLog(parsed.error);
    return;
  }
  loadArray(parsed.values);
}

function handleRandomArray() {
  const values = randomArray();
  elements.arrayInput.value = values.join(", ");
  loadArray(values);
}

function handleOperationTypeChange() {
  const isUpdate = elements.opType.value === "update";
  elements.deltaWrap.style.display = isUpdate ? "flex" : "none";
  focusCodePanel(elements.opType.value);
  clearCodeHighlights();
}

function setOperationType(opType) {
  elements.opType.value = opType;
  handleOperationTypeChange();
  updateStatus(
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
    getSpeedMs: () => appState.speedMs,
    prepareOperation,
    applyEvent,
    updateMetrics,
    finalizeOperation: finalizePendingOperation,
    onPrepared: (operation) => {
      appendLog(`Prepared ${operation.opType} with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      updateStatus("No pending operation to finish.");
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
    getSpeedMs: () => appState.speedMs,
    setSpeedMs: (speedMs) => {
      appState.speedMs = speedMs;
    },
    clearLog: () => logger.clear(),
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
