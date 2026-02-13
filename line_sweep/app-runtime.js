import { createOperationRunner } from "../shared/tutorial-core.js";
import { setupRunnerControls } from "../shared/tutorial-bootstrap.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";

const SAMPLE_INTERVALS_TEXT = `1 6
2 7
4 9
8 11
10 13
3 5
12 15`;

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function formatNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatInterval(interval) {
  return `[${formatNumber(interval.left)}, ${formatNumber(interval.right)}]`;
}

function parseIntervalsInput(raw, { maxIntervals = 40 } = {}) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Intervals input cannot be empty." };
  }

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > maxIntervals) {
    return { error: `Use at most ${maxIntervals} lines for readability.` };
  }

  const intervals = [];
  const seen = new Set();
  let removedDuplicates = 0;
  let swappedBounds = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const normalized = lines[i].replaceAll(",", " ");
    const parts = normalized.split(/\s+/).filter(Boolean);

    if (parts.length !== 2) {
      return {
        error: `Line ${i + 1} is invalid. Use exactly two numbers, for example: 2 9`,
      };
    }

    let left = Number(parts[0]);
    let right = Number(parts[1]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return {
        error: `Line ${i + 1} has invalid endpoints. Both values must be finite numbers.`,
      };
    }

    if (left > right) {
      [left, right] = [right, left];
      swappedBounds += 1;
    }

    const key = `${left}|${right}`;
    if (seen.has(key)) {
      removedDuplicates += 1;
      continue;
    }
    seen.add(key);

    const id = intervals.length;
    intervals.push({
      id,
      label: `I${id}`,
      left,
      right,
      row: id,
    });
  }

  if (intervals.length === 0) {
    return { error: "No unique intervals found after removing duplicates." };
  }

  return {
    intervals,
    removedDuplicates,
    swappedBounds,
  };
}

function generateRandomIntervalsText() {
  const count = 7 + Math.floor(Math.random() * 6);
  const used = new Set();
  const intervals = [];

  while (intervals.length < count) {
    const left = -8 + Math.floor(Math.random() * 20);
    const length = 1 + Math.floor(Math.random() * 8);
    const right = left + length;
    const key = `${left}|${right}`;
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    intervals.push({ left, right });
  }

  return intervals.map((interval) => `${interval.left} ${interval.right}`).join("\n");
}

class LineSweepTracer {
  constructor(intervals) {
    this.intervals = intervals.map((interval) => ({ ...interval }));
    this.intervalById = new Map(this.intervals.map((interval) => [interval.id, interval]));

    this.events = [];
    for (const interval of this.intervals) {
      this.events.push({
        intervalId: interval.id,
        type: "start",
        x: interval.left,
        tieValue: interval.right,
      });
      this.events.push({
        intervalId: interval.id,
        type: "end",
        x: interval.right,
        tieValue: interval.left,
      });
    }

    this.events.sort((a, b) => {
      if (a.x !== b.x) {
        return a.x - b.x;
      }

      const typeOrderA = a.type === "start" ? 0 : 1;
      const typeOrderB = b.type === "start" ? 0 : 1;
      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }

      if (a.type === "start" && a.tieValue !== b.tieValue) {
        return a.tieValue - b.tieValue;
      }
      if (a.type === "end" && a.tieValue !== b.tieValue) {
        return b.tieValue - a.tieValue;
      }

      return a.intervalId - b.intervalId;
    });

    this.events = this.events.map((event, index) => ({
      ...event,
      id: index,
    }));

    this.eventById = new Map(this.events.map((event) => [event.id, event]));

    this.intervalEventIds = new Map();
    for (const interval of this.intervals) {
      this.intervalEventIds.set(interval.id, {
        startId: null,
        endId: null,
      });
    }

    for (const event of this.events) {
      const pair = this.intervalEventIds.get(event.intervalId);
      if (!pair) {
        continue;
      }
      if (event.type === "start") {
        pair.startId = event.id;
      } else {
        pair.endId = event.id;
      }
    }
  }

  createInitialSnapshot() {
    return {
      sortedEventIds: this.events.map((event) => event.id),
      processedEventIds: [],
      nextEventIndex: 0,
      activeIds: [],
      activeCount: 0,
      maxActive: 0,
      bestXs: [],
      sweepX: null,
      currentEventId: null,
      currentIntervalId: null,
      currentType: null,
    };
  }

  #snapshot(state, extras = {}) {
    const pick = (key, fallback) =>
      Object.prototype.hasOwnProperty.call(extras, key) ? extras[key] : fallback;

    return {
      sortedEventIds: [...state.sortedEventIds],
      processedEventIds: [...state.processedEventIds],
      nextEventIndex: pick("nextEventIndex", state.nextEventIndex),
      activeIds: [...state.activeIds],
      activeCount: pick("activeCount", state.activeCount),
      maxActive: pick("maxActive", state.maxActive),
      bestXs: [...state.bestXs],
      sweepX: pick("sweepX", state.sweepX),
      currentEventId: pick("currentEventId", state.currentEventId),
      currentIntervalId: pick("currentIntervalId", state.currentIntervalId),
      currentType: pick("currentType", state.currentType),
    };
  }

  #emit(events, state, { message, line, nextEventIndex, sweepX, currentEventId, currentIntervalId, currentType }) {
    events.push({
      opType: "sweep",
      line,
      message,
      snapshot: this.#snapshot(state, {
        nextEventIndex,
        sweepX,
        currentEventId,
        currentIntervalId,
        currentType,
      }),
    });
  }

  #eventSummary(event) {
    const interval = this.intervalById.get(event.intervalId);
    if (!interval) {
      return `${event.type} at x=${formatNumber(event.x)}`;
    }
    return `${event.type} ${interval.label} at x=${formatNumber(event.x)}`;
  }

  #intervalList(ids) {
    if (!ids.length) {
      return "none";
    }
    return ids
      .map((id) => {
        const interval = this.intervalById.get(id);
        if (!interval) {
          return `#${id}`;
        }
        return `${interval.label}${formatInterval(interval)}`;
      })
      .join(", ");
  }

  #bestSummary(bestXs) {
    if (!bestXs.length) {
      return "none";
    }
    return bestXs.map((x) => formatNumber(x)).join(", ");
  }

  #sortActive(activeIds) {
    activeIds.sort((aId, bId) => {
      const a = this.intervalById.get(aId);
      const b = this.intervalById.get(bId);
      if (!a || !b) {
        return aId - bId;
      }
      return a.left - b.left || a.right - b.right || a.id - b.id;
    });
  }

  generateRun() {
    const events = [];
    const state = this.createInitialSnapshot();

    this.#emit(events, state, {
      line: 1,
      message:
        `Created ${this.events.length} endpoint events from ${this.intervals.length} intervals ` +
        "(start + end per interval).",
    });

    const orderText = this.events
      .map((event) => `${formatNumber(event.x)}:${event.type[0].toUpperCase()}${event.intervalId}`)
      .join(" | ");
    this.#emit(events, state, {
      line: 2,
      message: `Sorted events: ${orderText}.`,
    });

    this.#emit(events, state, {
      line: 3,
      message: "Initialize active=0, best=0, bestPositions=[].",
    });

    for (let i = 0; i < this.events.length; i += 1) {
      const event = this.events[i];
      const interval = this.intervalById.get(event.intervalId);

      this.#emit(events, state, {
        line: 4,
        currentEventId: event.id,
        currentIntervalId: event.intervalId,
        currentType: event.type,
        sweepX: event.x,
        nextEventIndex: i,
        message: `Process event ${i + 1}/${this.events.length}: ${this.#eventSummary(event)}.`,
      });

      if (event.type === "start") {
        if (!state.activeIds.includes(event.intervalId)) {
          state.activeIds.push(event.intervalId);
        }
      } else {
        const removeIndex = state.activeIds.indexOf(event.intervalId);
        if (removeIndex >= 0) {
          state.activeIds.splice(removeIndex, 1);
        }
      }

      this.#sortActive(state.activeIds);
      state.activeCount = state.activeIds.length;
      state.processedEventIds.push(event.id);
      state.nextEventIndex = i + 1;
      state.currentEventId = event.id;
      state.currentIntervalId = event.intervalId;
      state.currentType = event.type;
      state.sweepX = event.x;

      const delta = event.type === "start" ? "+1" : "-1";
      this.#emit(events, state, {
        line: 5,
        message:
          `${interval ? interval.label : `#${event.intervalId}`} contributes ${delta}. ` +
          `active=${state.activeCount}; active set: ${this.#intervalList(state.activeIds)}.`,
      });

      if (state.activeCount > state.maxActive) {
        state.maxActive = state.activeCount;
        state.bestXs = [event.x];

        this.#emit(events, state, {
          line: 6,
          message:
            `New max overlap ${state.maxActive} at x=${formatNumber(event.x)}. ` +
            "Reset best positions.",
        });
      } else if (state.activeCount === state.maxActive && state.maxActive > 0) {
        const alreadyRecorded = state.bestXs.some((x) => Object.is(x, event.x));
        if (!alreadyRecorded) {
          state.bestXs.push(event.x);
        }

        this.#emit(events, state, {
          line: 7,
          message:
            `Overlap ties max (${state.maxActive}) at x=${formatNumber(event.x)}. ` +
            `Best positions: ${this.#bestSummary(state.bestXs)}.`,
        });
      }
    }

    state.currentEventId = null;
    state.currentIntervalId = null;
    state.currentType = null;

    const summary =
      `Line sweep complete. Max overlap = ${state.maxActive}. ` +
      `Best x positions: ${this.#bestSummary(state.bestXs)}.`;

    this.#emit(events, state, {
      line: 8,
      message: summary,
    });

    return {
      events,
      maxActive: state.maxActive,
      bestXs: [...state.bestXs],
      processedEvents: state.processedEventIds.length,
      summary,
      success: true,
    };
  }
}

const elements = {
  intervalsInput: document.getElementById("intervalsInput"),
  loadIntervalsBtn: document.getElementById("loadIntervalsBtn"),
  sampleIntervalsBtn: document.getElementById("sampleIntervalsBtn"),
  randomIntervalsBtn: document.getElementById("randomIntervalsBtn"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  sweepViewPanel: document.querySelector(".sweep-view"),
  timelineCanvas: document.getElementById("timelineCanvas"),
  eventStrip: document.getElementById("eventStrip"),
  activeStrip: document.getElementById("activeStrip"),
  intervalRows: document.getElementById("intervalRows"),
  statusMessage: document.getElementById("statusMessage"),
  intervalsMetric: document.getElementById("intervalsMetric"),
  eventsMetric: document.getElementById("eventsMetric"),
  activeMetric: document.getElementById("activeMetric"),
  maxMetric: document.getElementById("maxMetric"),
  stepCounter: document.getElementById("stepCounter"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  intervals: [],
  intervalById: new Map(),
  tracer: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastMaxActive: 0,
  lastBestXs: [],
};

const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});

let operationRunner = null;

function setAnimationEmphasis(enabled) {
  elements.sweepViewPanel?.classList.toggle("playing", enabled);
}

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    sortedEventIds: [...snapshot.sortedEventIds],
    processedEventIds: [...snapshot.processedEventIds],
    nextEventIndex: snapshot.nextEventIndex,
    activeIds: [...snapshot.activeIds],
    activeCount: snapshot.activeCount,
    maxActive: snapshot.maxActive,
    bestXs: [...snapshot.bestXs],
    sweepX: snapshot.sweepX,
    currentEventId: snapshot.currentEventId,
    currentIntervalId: snapshot.currentIntervalId,
    currentType: snapshot.currentType,
  };
}

function getIntervalById(id) {
  return state.intervalById.get(id) ?? null;
}

function getEventById(id) {
  if (!state.tracer) {
    return null;
  }
  return state.tracer.eventById.get(id) ?? null;
}

function getIntervalState(interval, snapshot) {
  if (!state.tracer) {
    return "pending";
  }

  const pair = state.tracer.intervalEventIds.get(interval.id);
  if (!pair) {
    return "pending";
  }

  const activeSet = new Set(snapshot?.activeIds ?? []);
  if (activeSet.has(interval.id)) {
    return "active";
  }

  const processedSet = new Set(snapshot?.processedEventIds ?? []);
  const started = pair.startId !== null && processedSet.has(pair.startId);
  const ended = pair.endId !== null && processedSet.has(pair.endId);

  if (!started) {
    return "pending";
  }
  if (ended) {
    return "closed";
  }
  return "active";
}

function renderEventStrip(snapshot) {
  elements.eventStrip.innerHTML = "";

  if (!state.tracer || !snapshot || snapshot.sortedEventIds.length === 0) {
    const empty = document.createElement("span");
    empty.className = "event-pill empty";
    empty.textContent = "Load intervals to generate events.";
    elements.eventStrip.appendChild(empty);
    return;
  }

  const processedSet = new Set(snapshot.processedEventIds);
  const currentEventId = snapshot.currentEventId;

  for (const eventId of snapshot.sortedEventIds) {
    const event = getEventById(eventId);
    if (!event) {
      continue;
    }

    const interval = getIntervalById(event.intervalId);
    const pill = document.createElement("span");
    pill.className = `event-pill ${event.type}`;

    if (eventId === currentEventId) {
      pill.classList.add("current");
    } else if (processedSet.has(eventId)) {
      pill.classList.add("processed");
    } else {
      pill.classList.add("pending");
    }

    const opSign = event.type === "start" ? "+" : "-";
    pill.textContent = `${formatNumber(event.x)} ${opSign}${interval ? interval.label : `#${event.intervalId}`}`;
    elements.eventStrip.appendChild(pill);
  }
}

function renderActiveStrip(snapshot) {
  elements.activeStrip.innerHTML = "";

  const activeIds = snapshot?.activeIds ?? [];
  if (activeIds.length === 0) {
    const empty = document.createElement("span");
    empty.className = "active-pill empty";
    empty.textContent = "No active intervals.";
    elements.activeStrip.appendChild(empty);
    return;
  }

  for (const intervalId of activeIds) {
    const interval = getIntervalById(intervalId);
    if (!interval) {
      continue;
    }

    const pill = document.createElement("span");
    pill.className = "active-pill";
    if (snapshot?.currentIntervalId === intervalId) {
      pill.classList.add("current");
    }
    pill.textContent = `${interval.label} ${formatInterval(interval)}`;
    elements.activeStrip.appendChild(pill);
  }
}

function renderIntervalTable(snapshot) {
  elements.intervalRows.innerHTML = "";

  if (!state.intervals.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="3" class="empty-row">Load intervals to inspect state.</td>';
    elements.intervalRows.appendChild(row);
    return;
  }

  for (const interval of state.intervals) {
    const row = document.createElement("tr");
    const intervalState = getIntervalState(interval, snapshot);

    if (interval.id === snapshot?.currentIntervalId) {
      row.classList.add("row-current");
    }

    row.classList.add(`row-${intervalState}`);

    row.innerHTML = `
      <td>${interval.label}</td>
      <td>${formatInterval(interval)}</td>
      <td>${intervalState}</td>
    `;

    elements.intervalRows.appendChild(row);
  }
}

function renderTimeline(snapshot) {
  const svg = elements.timelineCanvas;
  svg.replaceChildren();

  if (!state.intervals.length) {
    svg.setAttribute("viewBox", "0 0 920 420");
    const empty = createSvgElement("text", {
      x: 460,
      y: 210,
      class: "timeline-empty",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    });
    empty.textContent = "Load intervals to visualize the sweep line.";
    svg.appendChild(empty);
    return;
  }

  const width = 920;
  const top = 42;
  const rowGap = 28;
  const baseHeight = Math.max(360, top + state.intervals.length * rowGap + 96);
  const height = Math.min(baseHeight, 640);
  const axisY = height - 44;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  let minX = state.intervals[0].left;
  let maxX = state.intervals[0].right;
  for (const interval of state.intervals) {
    minX = Math.min(minX, interval.left);
    maxX = Math.max(maxX, interval.right);
  }

  if (Object.is(minX, maxX)) {
    minX -= 1;
    maxX += 1;
  }

  const leftPad = 78;
  const rightPad = 54;
  const projectX = (x) =>
    leftPad + ((x - minX) / Math.max(maxX - minX, 1)) * (width - leftPad - rightPad);

  const axis = createSvgElement("line", {
    x1: leftPad,
    y1: axisY,
    x2: width - rightPad,
    y2: axisY,
    class: "axis-line",
  });
  svg.appendChild(axis);

  const markerValues = new Set([minX, maxX]);
  const eventCoords = state.tracer ? state.tracer.events.map((event) => event.x) : [];
  if (eventCoords.length <= 12) {
    for (const x of eventCoords) {
      markerValues.add(x);
    }
  }

  if (snapshot?.sweepX !== null && snapshot?.sweepX !== undefined) {
    markerValues.add(snapshot.sweepX);
  }

  for (const x of state.lastBestXs) {
    markerValues.add(x);
  }

  const markerList = [...markerValues].sort((a, b) => a - b);
  for (const x of markerList) {
    const projectedX = projectX(x);
    const tick = createSvgElement("line", {
      x1: projectedX,
      y1: axisY,
      x2: projectedX,
      y2: axisY + 7,
      class: "axis-tick",
    });
    svg.appendChild(tick);

    const label = createSvgElement("text", {
      x: projectedX,
      y: axisY + 20,
      class: "axis-label",
      "text-anchor": "middle",
    });
    label.textContent = formatNumber(x);
    svg.appendChild(label);
  }

  const activeSet = new Set(snapshot?.activeIds ?? []);
  const currentIntervalId = snapshot?.currentIntervalId ?? null;

  for (const interval of state.intervals) {
    const y = top + interval.row * rowGap;

    const stateClass = getIntervalState(interval, snapshot);
    const classes = ["interval-segment", stateClass];
    if (interval.id === currentIntervalId) {
      classes.push("current");
    }

    const segment = createSvgElement("line", {
      x1: projectX(interval.left),
      y1: y,
      x2: projectX(interval.right),
      y2: y,
      class: classes.join(" "),
    });
    svg.appendChild(segment);

    const startDot = createSvgElement("circle", {
      cx: projectX(interval.left),
      cy: y,
      r: 3.8,
      class: `endpoint ${activeSet.has(interval.id) ? "active" : ""}`,
    });
    svg.appendChild(startDot);

    const endDot = createSvgElement("circle", {
      cx: projectX(interval.right),
      cy: y,
      r: 3.8,
      class: `endpoint ${activeSet.has(interval.id) ? "active" : ""}`,
    });
    svg.appendChild(endDot);

    const label = createSvgElement("text", {
      x: 10,
      y: y + 4,
      class: "interval-label",
    });
    label.textContent = `${interval.label} ${formatInterval(interval)}`;
    svg.appendChild(label);
  }

  for (const x of state.lastBestXs) {
    const marker = createSvgElement("circle", {
      cx: projectX(x),
      cy: axisY,
      r: 5,
      class: "best-marker",
    });
    svg.appendChild(marker);
  }

  if (snapshot?.sweepX !== null && snapshot?.sweepX !== undefined) {
    const sweepX = projectX(snapshot.sweepX);
    const sweepLine = createSvgElement("line", {
      x1: sweepX,
      y1: top - 14,
      x2: sweepX,
      y2: axisY + 2,
      class: "sweep-line",
    });
    svg.appendChild(sweepLine);

    const sweepLabel = createSvgElement("text", {
      x: sweepX + 8,
      y: top - 16,
      class: "sweep-label",
    });
    sweepLabel.textContent = `sweep x=${formatNumber(snapshot.sweepX)}`;
    svg.appendChild(sweepLabel);
  }
}

function renderSnapshot(snapshot) {
  renderTimeline(snapshot);
  renderEventStrip(snapshot);
  renderActiveStrip(snapshot);
  renderIntervalTable(snapshot);
}

function updateMetrics() {
  const processedCount = state.lastSnapshot ? state.lastSnapshot.processedEventIds.length : 0;
  const totalEvents = state.tracer ? state.tracer.events.length : 0;
  const activeCount = state.lastSnapshot ? state.lastSnapshot.activeCount : 0;

  elements.intervalsMetric.textContent = String(state.intervals.length);
  elements.eventsMetric.textContent = `${processedCount} / ${totalEvents}`;
  elements.activeMetric.textContent = String(activeCount);
  elements.maxMetric.textContent = String(state.lastMaxActive);

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  state.lastMaxActive = event.snapshot.maxActive;
  state.lastBestXs = [...event.snapshot.bestXs];

  renderSnapshot(state.lastSnapshot);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
  updateMetrics();
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);

  state.lastMaxActive = meta.maxActive;
  state.lastBestXs = [...meta.bestXs];

  helpers.updateStatus(meta.summary);
  helpers.appendLog(meta.summary, meta.success ? "ok" : "");
  helpers.clearCodeHighlights();

  renderSnapshot(state.lastSnapshot);
  updateMetrics();
}

function prepareOperation() {
  if (!state.tracer || state.intervals.length === 0) {
    const message = "Load intervals first.";
    helpers.updateStatus(message);
    helpers.appendLog(message);
    return null;
  }

  return state.tracer.generateRun();
}

function loadIntervals(intervals, { message }) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.intervals = intervals.map((interval, row) => ({
    ...interval,
    row,
  }));
  state.intervalById = new Map(state.intervals.map((interval) => [interval.id, interval]));
  state.tracer = new LineSweepTracer(state.intervals);
  state.lastSnapshot = state.tracer.createInitialSnapshot();
  state.lastMaxActive = 0;
  state.lastBestXs = [];

  renderSnapshot(state.lastSnapshot);
  helpers.focusCodePanel("sweep");
  helpers.clearCodeHighlights();
  helpers.updateStatus(message);
  helpers.appendLog(message, "ok");
  updateMetrics();
}

function loadIntervalsFromInput() {
  setAnimationEmphasis(false);

  const parsed = parseIntervalsInput(elements.intervalsInput.value, {
    maxIntervals: 40,
  });

  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }

  const notes = [];
  if (parsed.removedDuplicates > 0) {
    notes.push(
      `${parsed.removedDuplicates} duplicate interval${parsed.removedDuplicates === 1 ? "" : "s"} removed`,
    );
  }
  if (parsed.swappedBounds > 0) {
    notes.push(
      `${parsed.swappedBounds} bound pair${parsed.swappedBounds === 1 ? "" : "s"} reordered`,
    );
  }

  const suffix = notes.length > 0 ? ` (${notes.join("; ")})` : "";
  loadIntervals(parsed.intervals, {
    message: `Loaded ${parsed.intervals.length} unique intervals${suffix}.`,
  });
}

function loadSampleIntervals() {
  elements.intervalsInput.value = SAMPLE_INTERVALS_TEXT;
  loadIntervalsFromInput();
}

function loadRandomIntervals() {
  elements.intervalsInput.value = generateRandomIntervalsText();
  loadIntervalsFromInput();
}

function init() {
  operationRunner = createOperationRunner({
    getSpeedMs: () => state.speedMs,
    prepareOperation,
    applyEvent,
    updateMetrics,
    finalizeOperation: finalizePendingOperation,
    onPrepared: (operation) => {
      helpers.appendLog(`Prepared line sweep run with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      setAnimationEmphasis(false);
      helpers.updateStatus("No pending operation to finish.");
    },
  });

  elements.loadIntervalsBtn.addEventListener("click", loadIntervalsFromInput);
  elements.sampleIntervalsBtn.addEventListener("click", loadSampleIntervals);
  elements.randomIntervalsBtn.addEventListener("click", loadRandomIntervals);

  setupRunnerControls({
    elements,
    runAnimated: () => {
      setAnimationEmphasis(true);
      operationRunner.runAnimated();
      if (!operationRunner.hasPending) {
        setAnimationEmphasis(false);
      }
    },
    runStep: () => {
      setAnimationEmphasis(false);
      operationRunner.step();
    },
    runInstant: () => {
      setAnimationEmphasis(false);
      operationRunner.runInstant();
    },
    runFinish: () => {
      setAnimationEmphasis(false);
      operationRunner.finishCurrent();
    },
    getSpeedMs: () => state.speedMs,
    setSpeedMs: (speedMs) => {
      state.speedMs = speedMs;
    },
    clearLog: () => helpers.clearLog(),
    extraShortcuts: {
      l: () => loadIntervalsFromInput(),
      m: () => loadSampleIntervals(),
      r: () => loadRandomIntervals(),
    },
  });

  helpers.focusCodePanel("sweep");
  loadSampleIntervals();
}

init();
