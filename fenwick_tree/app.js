import {
  bindShortcutHandler,
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";

class FenwickTracer {
  constructor(values) {
    this.n = values.length;
    this.bit = new Array(this.n + 1).fill(0);
    for (let i = 0; i < values.length; i += 1) {
      this.#internalAdd(i + 1, values[i]);
    }
  }

  #internalAdd(index, delta) {
    let i = index;
    while (i <= this.n) {
      this.bit[i] += delta;
      i += i & -i;
    }
  }

  generatePointUpdate(index, delta) {
    const bit = [...this.bit];
    const events = [];

    const emit = (message, line, activeIndex = null, extras = {}) => {
      events.push({
        opType: "update",
        message,
        line,
        activeIndex,
        bit: [...bit],
        ...extras,
      });
    };

    let i = index;
    emit(`Initialize: i = ${i}, delta = ${delta}`, 1, i);

    while (i <= this.n) {
      const lb = i & -i;
      emit(`Loop check true for i=${i} (lowbit=${lb})`, 2, i);

      bit[i] += delta;
      emit(`Apply bit[${i}] += ${delta} => ${bit[i]}`, 3, i);

      const next = i + lb;
      emit(`Jump i += lowbit(i): ${i} + ${lb} = ${next}`, 4, i);
      i = next;
    }

    emit(`Done update at index ${index}`, 5, null, { done: true });
    this.bit = bit;
    return { events };
  }

  generatePrefixQuery(index) {
    const bit = [...this.bit];
    const events = [];

    const emit = (message, line, activeIndex = null, extras = {}) => {
      events.push({
        opType: "prefix",
        message,
        line,
        activeIndex,
        bit: [...bit],
        ...extras,
      });
    };

    let i = index;
    let sum = 0;
    emit(`Initialize: i = ${i}, sum = 0`, 1, i, { partial: sum });

    while (i > 0) {
      const lb = i & -i;
      emit(`Loop check true for i=${i} (lowbit=${lb})`, 2, i, { partial: sum });

      sum += bit[i];
      emit(`sum += bit[${i}] (${bit[i]}) => ${sum}`, 3, i, { partial: sum });

      const next = i - lb;
      emit(`Jump i -= lowbit(i): ${i} - ${lb} = ${next}`, 4, i, { partial: sum });
      i = next;
    }

    emit(`Return prefix sum = ${sum}`, 5, null, { done: true, result: sum, partial: sum });
    return { events, result: sum };
  }

  generateRangeQuery(left, right) {
    const bit = [...this.bit];
    const events = [];

    const emit = (message, line, activeIndex = null, extras = {}) => {
      events.push({
        opType: "range",
        message,
        line,
        activeIndex,
        bit: [...bit],
        ...extras,
      });
    };

    const tracePrefix = (index, label, line) => {
      let i = index;
      let subtotal = 0;

      emit(`${label}: start with i=${i}`, line, i, { partial: subtotal, label });
      while (i > 0) {
        const lb = i & -i;
        subtotal += bit[i];
        emit(
          `${label}: add bit[${i}] (${bit[i]}), subtotal=${subtotal}; next i=${i - lb}`,
          line,
          i,
          { partial: subtotal, label },
        );
        i -= lb;
      }

      emit(`${label}: subtotal = ${subtotal}`, line, null, { partial: subtotal, label });
      return subtotal;
    };

    emit(`Start range query: prefix(${right}) - prefix(${left - 1})`, 1, null);
    const sumRight = tracePrefix(right, `prefix(${right})`, 2);
    const sumLeft = tracePrefix(left - 1, `prefix(${left - 1})`, 3);
    const result = sumRight - sumLeft;

    emit(`Return ${sumRight} - ${sumLeft} = ${result}`, 4, null, {
      done: true,
      result,
      sumRight,
      sumLeft,
    });

    return { events, result };
  }
}

const elements = {
  arrayInput: document.getElementById("arrayInput"),
  loadArrayBtn: document.getElementById("loadArrayBtn"),
  randomArrayBtn: document.getElementById("randomArrayBtn"),
  opType: document.getElementById("opType"),
  singleIndexWrap: document.getElementById("singleIndexWrap"),
  singleIndex: document.getElementById("singleIndex"),
  leftWrap: document.getElementById("leftWrap"),
  leftIndex: document.getElementById("leftIndex"),
  rightWrap: document.getElementById("rightWrap"),
  rightIndex: document.getElementById("rightIndex"),
  deltaWrap: document.getElementById("deltaWrap"),
  deltaValue: document.getElementById("deltaValue"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  arrayTotal: document.getElementById("arrayTotal"),
  queryResult: document.getElementById("queryResult"),
  stepCounter: document.getElementById("stepCounter"),
  arrayStrip: document.getElementById("arrayStrip"),
  bitRows: document.getElementById("bitRows"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  values: [],
  fenwick: null,
  speedMs: Number(elements.speedRange.value),
  lastQueryResult: null,
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
  if (tokens.length > 20) {
    return { error: "Please use at most 20 values for readability." };
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
  const length = 7 + Math.floor(Math.random() * 6);
  const values = [];
  for (let i = 0; i < length; i += 1) {
    values.push(Math.floor(Math.random() * 12));
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
  state.values.forEach((value, idx) => {
    const cell = document.createElement("div");
    cell.className = "array-cell";
    cell.innerHTML = `<span class="idx">i=${idx + 1}</span><span class="val">${value}</span>`;
    elements.arrayStrip.appendChild(cell);
  });
}

function toBinary(value) {
  return value.toString(2).padStart(4, "0");
}

function renderBit(bitValues, activeIndex = null) {
  if (!state.fenwick) {
    elements.bitRows.innerHTML = "";
    return;
  }

  elements.bitRows.innerHTML = "";
  for (let i = 1; i <= state.fenwick.n; i += 1) {
    const low = i & -i;
    const left = i - low + 1;
    const row = document.createElement("tr");
    if (i === activeIndex) {
      row.classList.add("active");
    }

    row.innerHTML = `
      <td>${i}</td>
      <td>${toBinary(i)}</td>
      <td>${low}</td>
      <td>[${left}, ${i}]</td>
      <td class="bit-value">${bitValues[i] ?? 0}</td>
    `;
    elements.bitRows.appendChild(row);
  }
}

function updateMetrics() {
  const total = state.values.reduce((acc, value) => acc + value, 0);
  elements.arrayTotal.textContent = Number.isFinite(total) ? total : "-";
  elements.queryResult.textContent =
    state.lastQueryResult === null ? "-" : String(state.lastQueryResult);
  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function setIndexBounds() {
  if (!state.fenwick) {
    return;
  }

  const max = state.fenwick.n;
  const fields = [elements.singleIndex, elements.leftIndex, elements.rightIndex];
  for (const field of fields) {
    field.max = String(max);
    const current = Number(field.value);
    if (current > max) {
      field.value = String(max);
    }
    if (current < 1) {
      field.value = "1";
    }
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

  const summary = mismatch
    ? `${meta.summary} (warning: naive check is ${meta.naive})`
    : meta.summary;

  updateStatus(summary);
  appendLog(summary, mismatch ? "" : "ok");

  renderArray();
  renderBit(state.fenwick.bit, null);
  clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderBit(event.bit, event.activeIndex);
  highlightCode(event.opType, event.line);
  updateStatus(event.message);
}

function validateOneBasedIndex(value, size, label) {
  if (!Number.isInteger(value)) {
    return `${label} must be an integer.`;
  }
  if (value < 1 || value > size) {
    return `${label} must be between 1 and ${size}.`;
  }
  return null;
}

function validateRange(left, right, size) {
  const leftError = validateOneBasedIndex(left, size, "Left index");
  if (leftError) {
    return leftError;
  }
  const rightError = validateOneBasedIndex(right, size, "Right index");
  if (rightError) {
    return rightError;
  }
  if (left > right) {
    return "Require l <= r.";
  }
  return null;
}

function prepareOperation() {
  if (!state.fenwick) {
    updateStatus("Load an array first.");
    return null;
  }

  const opType = elements.opType.value;

  if (opType === "update") {
    const index = Number(elements.singleIndex.value);
    const indexError = validateOneBasedIndex(index, state.fenwick.n, "Index i");
    if (indexError) {
      updateStatus(indexError);
      appendLog(indexError);
      return null;
    }

    const delta = Number(elements.deltaValue.value);
    if (!Number.isInteger(delta)) {
      const message = "Delta must be an integer.";
      updateStatus(message);
      appendLog(message);
      return null;
    }

    const trace = state.fenwick.generatePointUpdate(index, delta);
    const nextValues = [...state.values];
    nextValues[index - 1] += delta;

    return {
      opType,
      events: trace.events,
      nextValues,
      summary: `Point update complete: a[${index}] += ${delta}`,
    };
  }

  if (opType === "prefix") {
    const index = Number(elements.singleIndex.value);
    const indexError = validateOneBasedIndex(index, state.fenwick.n, "Index i");
    if (indexError) {
      updateStatus(indexError);
      appendLog(indexError);
      return null;
    }

    const trace = state.fenwick.generatePrefixQuery(index);
    const naive = state.values.slice(0, index).reduce((acc, value) => acc + value, 0);

    return {
      opType,
      events: trace.events,
      result: trace.result,
      naive,
      summary: `Prefix sum(1..${index}) = ${trace.result} (naive: ${naive})`,
    };
  }

  const left = Number(elements.leftIndex.value);
  const right = Number(elements.rightIndex.value);
  const rangeError = validateRange(left, right, state.fenwick.n);
  if (rangeError) {
    updateStatus(rangeError);
    appendLog(rangeError);
    return null;
  }

  const trace = state.fenwick.generateRangeQuery(left, right);
  const naive = state.values.slice(left - 1, right).reduce((acc, value) => acc + value, 0);

  return {
    opType,
    events: trace.events,
    result: trace.result,
    naive,
    summary: `Range sum(${left}..${right}) = ${trace.result} (naive: ${naive})`,
  };
}

function loadArray(values) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.values = [...values];
  state.fenwick = new FenwickTracer(values);
  state.lastQueryResult = null;

  setIndexBounds();
  renderArray();
  renderBit(state.fenwick.bit, null);
  updateMetrics();

  focusCodePanel(elements.opType.value);
  clearCodeHighlights();

  const message = `Loaded ${values.length} values. Fenwick tree built.`;
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
  const opType = elements.opType.value;
  focusCodePanel(opType);
  clearCodeHighlights();

  elements.singleIndexWrap.style.display = opType === "range" ? "none" : "flex";
  elements.leftWrap.style.display = opType === "range" ? "flex" : "none";
  elements.rightWrap.style.display = opType === "range" ? "flex" : "none";
  elements.deltaWrap.style.display = opType === "update" ? "flex" : "none";
}

function setOperationType(opType) {
  elements.opType.value = opType;
  handleOperationTypeChange();
  updateStatus(`Shortcut: switched to ${opType} mode.`);
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
      appendLog(`Prepared ${operation.opType} operation with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      updateStatus("No pending operation to finish.");
    },
  });

  elements.loadArrayBtn.addEventListener("click", handleArrayLoadInput);
  elements.randomArrayBtn.addEventListener("click", handleRandomArray);
  elements.opType.addEventListener("change", handleOperationTypeChange);

  elements.animateBtn.addEventListener("click", () => operationRunner.runAnimated());
  elements.stepBtn.addEventListener("click", () => operationRunner.step());
  elements.instantBtn.addEventListener("click", () => operationRunner.runInstant());
  elements.finishBtn.addEventListener("click", finishCurrentOperation);

  elements.speedRange.addEventListener("input", () => {
    state.speedMs = Number(elements.speedRange.value);
    elements.speedLabel.textContent = `${state.speedMs} ms`;
  });

  elements.clearLogBtn.addEventListener("click", () => {
    logger.clear();
  });

  bindShortcutHandler({
    actions: {
      a: () => operationRunner.runAnimated(),
      s: () => operationRunner.step(),
      i: () => operationRunner.runInstant(),
      f: () => operationRunner.finishCurrent(),
      l: () => handleArrayLoadInput(),
      r: () => handleRandomArray(),
      1: () => setOperationType("update"),
      2: () => setOperationType("prefix"),
      3: () => setOperationType("range"),
    },
  });

  handleOperationTypeChange();
  handleArrayLoadInput();
}

init();
