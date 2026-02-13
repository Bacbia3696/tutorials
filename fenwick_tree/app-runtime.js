import { createOperationRunner } from '../shared/tutorial-core.js';
import { setupRunnerControls } from '../shared/tutorial-bootstrap.js';
import { createSvgElement } from '../shared/graph-core.js';
import { parseArrayInput, randomIntegerArray } from '../shared/array-input.js';
import { createRuntimeHelpers } from '../shared/runtime-helpers.js';

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
        opType: 'update',
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
        opType: 'prefix',
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
        opType: 'range',
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
  arrayInput: document.getElementById('arrayInput'),
  loadArrayBtn: document.getElementById('loadArrayBtn'),
  randomArrayBtn: document.getElementById('randomArrayBtn'),
  opType: document.getElementById('opType'),
  singleIndexWrap: document.getElementById('singleIndexWrap'),
  singleIndex: document.getElementById('singleIndex'),
  leftWrap: document.getElementById('leftWrap'),
  leftIndex: document.getElementById('leftIndex'),
  rightWrap: document.getElementById('rightWrap'),
  rightIndex: document.getElementById('rightIndex'),
  deltaWrap: document.getElementById('deltaWrap'),
  deltaValue: document.getElementById('deltaValue'),
  animateBtn: document.getElementById('animateBtn'),
  stepBtn: document.getElementById('stepBtn'),
  instantBtn: document.getElementById('instantBtn'),
  finishBtn: document.getElementById('finishBtn'),
  speedRange: document.getElementById('speedRange'),
  speedLabel: document.getElementById('speedLabel'),
  statusMessage: document.getElementById('statusMessage'),
  arrayTotal: document.getElementById('arrayTotal'),
  queryResult: document.getElementById('queryResult'),
  stepCounter: document.getElementById('stepCounter'),
  arrayStrip: document.getElementById('arrayStrip'),
  coverageMap: document.getElementById('coverageMap'),
  jumpCanvas: document.getElementById('jumpCanvas'),
  jumpCaption: document.getElementById('jumpCaption'),
  bitRows: document.getElementById('bitRows'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  logOutput: document.getElementById('logOutput'),
};

const state = {
  values: [],
  fenwick: null,
  speedMs: Number(elements.speedRange.value),
  lastQueryResult: null,
};
const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});
let operationRunner = null;

function renderArray(activeIndex = null) {
  elements.arrayStrip.innerHTML = '';
  const hasActive = Number.isInteger(activeIndex) && activeIndex > 0 && state.fenwick;
  const low = hasActive ? activeIndex & -activeIndex : 0;
  const left = hasActive ? activeIndex - low + 1 : 0;

  state.values.forEach((value, idx) => {
    const oneBased = idx + 1;
    const cell = document.createElement('div');
    cell.className = 'array-cell';
    if (hasActive && oneBased >= left && oneBased <= activeIndex) {
      cell.classList.add('covered');
    }
    if (hasActive && oneBased === activeIndex) {
      cell.classList.add('pivot');
    }
    cell.innerHTML = `<span class="idx">i=${idx + 1}</span><span class="val">${value}</span>`;
    elements.arrayStrip.appendChild(cell);
  });
}

function toBinary(value) {
  return value.toString(2).padStart(4, '0');
}

function parsePrefixIndexFromLabel(label) {
  if (typeof label !== 'string') {
    return null;
  }
  const match = label.match(/prefix\((\d+)\)/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function getPreviewStartIndex(opType, label = null) {
  const fromLabel = parsePrefixIndexFromLabel(label);
  if (Number.isInteger(fromLabel)) {
    return fromLabel;
  }

  if (opType === 'update' || opType === 'prefix') {
    const value = Number(elements.singleIndex.value);
    return Number.isInteger(value) ? value : null;
  }

  const right = Number(elements.rightIndex.value);
  return Number.isInteger(right) ? right : null;
}

function buildJumpSequence(startIndex, opType) {
  if (!state.fenwick || !Number.isInteger(startIndex)) {
    return [];
  }

  const n = state.fenwick.n;
  if (startIndex < 0 || startIndex > n) {
    return [];
  }

  const sequence = [];
  const guardLimit = n + 3;

  if (opType === 'update') {
    let i = startIndex;
    let guard = 0;
    while (i >= 1 && i <= n && guard < guardLimit) {
      sequence.push(i);
      i += i & -i;
      guard += 1;
    }
    return sequence;
  }

  let i = startIndex;
  let guard = 0;
  while (i > 0 && i <= n && guard < guardLimit) {
    sequence.push(i);
    i -= i & -i;
    guard += 1;
  }
  sequence.push(0);
  return sequence;
}

function ensureJumpArrowMarker(svgElement) {
  const defs = createSvgElement('defs');
  const marker = createSvgElement('marker', {
    id: 'jump-arrow',
    markerWidth: 8,
    markerHeight: 8,
    refX: 7.2,
    refY: 4,
    orient: 'auto',
    markerUnits: 'strokeWidth',
  });
  marker.appendChild(
    createSvgElement('path', {
      d: 'M 0 0 L 8 4 L 0 8 z',
      fill: 'rgba(31, 71, 61, 0.66)',
    }),
  );
  defs.appendChild(marker);
  svgElement.appendChild(defs);
}

function renderJumpTimeline(activeIndex = null, opType = elements.opType.value, label = null) {
  const svg = elements.jumpCanvas;
  svg.innerHTML = '';
  const jumpWrap = elements.jumpCanvas.closest('.jump-map-wrap');
  if (jumpWrap) {
    jumpWrap.dataset.op = opType;
  }

  if (!state.fenwick) {
    const text = createSvgElement('text', {
      class: 'jump-empty',
      x: 270,
      y: 75,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    text.textContent = 'Load an array to preview jump routes.';
    svg.appendChild(text);
    elements.jumpCaption.textContent = 'Load an array to preview jump routes.';
    return;
  }

  const start = Number.isInteger(activeIndex) ? activeIndex : getPreviewStartIndex(opType, label);
  const sequence = buildJumpSequence(start, opType);
  if (sequence.length === 0) {
    const text = createSvgElement('text', {
      class: 'jump-empty',
      x: 270,
      y: 75,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    text.textContent = 'Choose valid indices to see jump path.';
    svg.appendChild(text);
    elements.jumpCaption.textContent = 'Choose valid indices to see jump path.';
    return;
  }

  const isPreview = !Number.isInteger(activeIndex);
  const width = Math.max(540, 90 + Math.max(0, sequence.length - 1) * 120);
  const height = 150;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  ensureJumpArrowMarker(svg);

  const leftPad = 44;
  const gap = sequence.length > 1 ? (width - leftPad * 2) / (sequence.length - 1) : 0;
  const y = 68;

  for (let idx = 0; idx < sequence.length; idx += 1) {
    const value = sequence[idx];
    const x = leftPad + idx * gap;

    if (idx < sequence.length - 1) {
      const nextX = leftPad + (idx + 1) * gap;
      const edge = createSvgElement('line', {
        class: 'jump-edge',
        x1: x + 16,
        y1: y,
        x2: nextX - 16,
        y2: y,
        'marker-end': 'url(#jump-arrow)',
      });
      if (idx === 0 && Number.isInteger(activeIndex)) {
        edge.classList.add('active');
      }
      svg.appendChild(edge);

      if (value > 0) {
        const delta = value & -value;
        const step = opType === 'update' ? `+${delta}` : `-${delta}`;
        const text = createSvgElement('text', {
          class: 'jump-edge-label',
          x: (x + nextX) / 2,
          y: y - 14,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        });
        text.textContent = step;
        svg.appendChild(text);
      }
    }

    const group = createSvgElement('g', { class: 'jump-node' });
    if (idx === 0 && Number.isInteger(activeIndex)) {
      group.classList.add('active');
    } else if (idx === 0 && isPreview) {
      group.classList.add('preview');
    }
    if (value === 0) {
      group.classList.add('terminal');
    }

    group.appendChild(
      createSvgElement('circle', {
        cx: x,
        cy: y,
        r: 16,
      }),
    );

    const labelNode = createSvgElement('text', {
      x,
      y,
    });
    labelNode.textContent = String(value);
    group.appendChild(labelNode);

    const lb = value > 0 ? value & -value : 0;
    const lowbit = createSvgElement('text', {
      x,
      y: y + 24,
      class: 'jump-edge-label',
    });
    lowbit.textContent = value > 0 ? `lb=${lb}` : 'done';
    group.appendChild(lowbit);

    svg.appendChild(group);
  }

  const route = sequence.join(' -> ');
  const modeText = opType === 'update' ? 'update jumps' : 'query jumps';
  elements.jumpCaption.textContent = isPreview
    ? `Preview ${modeText}: ${route}`
    : `Active ${modeText}: ${route}`;
}

function renderCoverage(bitValues, activeIndex = null, opType = elements.opType.value) {
  if (!state.fenwick) {
    elements.coverageMap.innerHTML = '';
    return;
  }

  elements.coverageMap.dataset.op = opType;
  elements.coverageMap.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'coverage-head';
  head.innerHTML = '<span>BIT i</span><span>Range</span><span>Coverage</span><span>bit[i]</span>';
  elements.coverageMap.appendChild(head);

  const n = state.fenwick.n;
  for (let i = 1; i <= n; i += 1) {
    const low = i & -i;
    const left = i - low + 1;
    const row = document.createElement('div');
    row.className = 'coverage-row';
    if (i === activeIndex) {
      row.classList.add('active');
    }

    const label = document.createElement('span');
    label.className = 'coverage-label';
    label.textContent = `i=${i}`;

    const range = document.createElement('span');
    range.className = 'coverage-range';
    range.textContent = `[${left}, ${i}]`;

    const track = document.createElement('div');
    track.className = 'coverage-track';
    track.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    for (let idx = 1; idx <= n; idx += 1) {
      const cell = document.createElement('div');
      cell.className = 'coverage-cell';
      if (idx >= left && idx <= i) {
        cell.classList.add('covered');
      }
      if (i === activeIndex && idx >= left && idx <= i) {
        cell.classList.add('active');
      }
      track.appendChild(cell);
    }

    const value = document.createElement('span');
    value.className = 'coverage-value';
    value.textContent = String(bitValues[i] ?? 0);

    row.appendChild(label);
    row.appendChild(range);
    row.appendChild(track);
    row.appendChild(value);
    elements.coverageMap.appendChild(row);
  }
}

function renderBit(bitValues, activeIndex = null) {
  if (!state.fenwick) {
    elements.bitRows.innerHTML = '';
    return;
  }

  elements.bitRows.innerHTML = '';
  for (let i = 1; i <= state.fenwick.n; i += 1) {
    const low = i & -i;
    const left = i - low + 1;
    const row = document.createElement('tr');
    if (i === activeIndex) {
      row.classList.add('active');
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
  elements.arrayTotal.textContent = Number.isFinite(total) ? total : '-';
  elements.queryResult.textContent =
    state.lastQueryResult === null ? '-' : String(state.lastQueryResult);
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
      field.value = '1';
    }
  }
}

function finalizePendingOperation(meta) {
  if (meta.nextValues) {
    state.values = meta.nextValues;
  }
  if (typeof meta.result === 'number') {
    state.lastQueryResult = meta.result;
  }

  const mismatch =
    typeof meta.result === 'number' && typeof meta.naive === 'number' && meta.result !== meta.naive;

  const summary = mismatch
    ? `${meta.summary} (warning: naive check is ${meta.naive})`
    : meta.summary;

  helpers.updateStatus(summary);
  helpers.appendLog(summary, mismatch ? '' : 'ok');

  renderArray(null);
  renderCoverage(state.fenwick.bit, null, meta.opType ?? elements.opType.value);
  renderJumpTimeline(null, meta.opType ?? elements.opType.value, null);
  renderBit(state.fenwick.bit, null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderArray(event.activeIndex);
  renderCoverage(event.bit, event.activeIndex, event.opType);
  renderJumpTimeline(event.activeIndex, event.opType, event.label ?? null);
  renderBit(event.bit, event.activeIndex);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
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
  const leftError = validateOneBasedIndex(left, size, 'Left index');
  if (leftError) {
    return leftError;
  }
  const rightError = validateOneBasedIndex(right, size, 'Right index');
  if (rightError) {
    return rightError;
  }
  if (left > right) {
    return 'Require l <= r.';
  }
  return null;
}

function prepareOperation() {
  if (!state.fenwick) {
    helpers.updateStatus('Load an array first.');
    return null;
  }

  const opType = elements.opType.value;

  if (opType === 'update') {
    const index = Number(elements.singleIndex.value);
    const indexError = validateOneBasedIndex(index, state.fenwick.n, 'Index i');
    if (indexError) {
      helpers.updateStatus(indexError);
      helpers.appendLog(indexError);
      return null;
    }

    const delta = Number(elements.deltaValue.value);
    if (!Number.isInteger(delta)) {
      const message = 'Delta must be an integer.';
      helpers.updateStatus(message);
      helpers.appendLog(message);
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

  if (opType === 'prefix') {
    const index = Number(elements.singleIndex.value);
    const indexError = validateOneBasedIndex(index, state.fenwick.n, 'Index i');
    if (indexError) {
      helpers.updateStatus(indexError);
      helpers.appendLog(indexError);
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
    helpers.updateStatus(rangeError);
    helpers.appendLog(rangeError);
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
  renderArray(null);
  renderCoverage(state.fenwick.bit, null, elements.opType.value);
  renderJumpTimeline(null, elements.opType.value, null);
  renderBit(state.fenwick.bit, null);
  updateMetrics();

  helpers.focusCodePanel(elements.opType.value);
  helpers.clearCodeHighlights();

  const message = `Loaded ${values.length} values. Fenwick tree built.`;
  helpers.updateStatus(message);
  helpers.appendLog(`${message} Values: [${values.join(', ')}]`, 'ok');
}

function handleArrayLoadInput() {
  const parsed = parseArrayInput(elements.arrayInput.value, {
    maxValues: 20,
    maxValuesMessage: 'Please use at most 20 values for readability.',
  });
  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }
  loadArray(parsed.values);
}

function handleRandomArray() {
  const values = randomIntegerArray({ minLength: 7, maxLength: 12, maxValue: 12 });
  elements.arrayInput.value = values.join(', ');
  loadArray(values);
}

function handleOperationTypeChange() {
  const opType = elements.opType.value;
  helpers.focusCodePanel(opType);
  helpers.clearCodeHighlights();

  elements.singleIndexWrap.style.display = opType === 'range' ? 'none' : 'flex';
  elements.leftWrap.style.display = opType === 'range' ? 'flex' : 'none';
  elements.rightWrap.style.display = opType === 'range' ? 'flex' : 'none';
  elements.deltaWrap.style.display = opType === 'update' ? 'flex' : 'none';
  renderJumpTimeline(null, opType, null);
}

function setOperationType(opType) {
  elements.opType.value = opType;
  handleOperationTypeChange();
  helpers.updateStatus(`Shortcut: switched to ${opType} mode.`);
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
      helpers.appendLog(
        `Prepared ${operation.opType} operation with ${operation.events.length} trace steps.`,
      );
    },
    onNoPending: () => {
      helpers.updateStatus('No pending operation to finish.');
    },
  });

  elements.loadArrayBtn.addEventListener('click', handleArrayLoadInput);
  elements.randomArrayBtn.addEventListener('click', handleRandomArray);
  elements.opType.addEventListener('change', handleOperationTypeChange);
  elements.singleIndex.addEventListener('input', () =>
    renderJumpTimeline(null, elements.opType.value, null),
  );
  elements.leftIndex.addEventListener('input', () =>
    renderJumpTimeline(null, elements.opType.value, null),
  );
  elements.rightIndex.addEventListener('input', () =>
    renderJumpTimeline(null, elements.opType.value, null),
  );

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
      1: () => setOperationType('update'),
      2: () => setOperationType('prefix'),
      3: () => setOperationType('range'),
    },
  });

  handleOperationTypeChange();
  handleArrayLoadInput();
}

init();
