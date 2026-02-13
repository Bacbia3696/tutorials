import { createOperationRunner } from "../shared/tutorial-core.js";
import { setupRunnerControls } from "../shared/tutorial-bootstrap.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";

const SAMPLE_POINTS_TEXT = `-6 -2
-4 4
-1 1
0 -3
2 5
4 2
6 -1
3 -4
-2 -5
1 0
5 4
-5 1`;

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

function formatPoint(point) {
  return `${point.label}(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
}

function parsePointsInput(raw, { maxPoints = 40 } = {}) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Points input cannot be empty." };
  }

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > maxPoints) {
    return { error: `Use at most ${maxPoints} lines for readability.` };
  }

  const points = [];
  const seen = new Set();
  let removedDuplicates = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replaceAll(",", " ");
    const parts = line.split(/\s+/).filter(Boolean);

    if (parts.length !== 2) {
      return {
        error: `Line ${i + 1} is invalid. Use exactly two numbers, for example: 3 -2`,
      };
    }

    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        error: `Line ${i + 1} has invalid coordinates. Both values must be finite numbers.`,
      };
    }

    const key = `${x}|${y}`;
    if (seen.has(key)) {
      removedDuplicates += 1;
      continue;
    }
    seen.add(key);

    const id = points.length;
    points.push({
      id,
      label: `P${id}`,
      x,
      y,
    });
  }

  if (points.length === 0) {
    return { error: "No unique points found after removing duplicates." };
  }

  return {
    points,
    removedDuplicates,
  };
}

function computeProjection(points, width, height, padding = 58) {
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

  const usedWidth = spanX * scale;
  const usedHeight = spanY * scale;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;

  return (point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - (offsetY + (point.y - minY) * scale),
  });
}

class ConvexHullTracer {
  constructor(points) {
    this.points = points;
    this.pointById = new Map(points.map((point) => [point.id, point]));
    this.sortedIds = [...points]
      .sort((a, b) => a.x - b.x || a.y - b.y || a.id - b.id)
      .map((point) => point.id);
  }

  createInitialSnapshot() {
    return {
      sortedIds: [...this.sortedIds],
      lowerStack: [],
      upperStack: [],
      hullIds: [],
      phase: "idle",
      scanIndex: null,
      candidateId: null,
      checkTriple: null,
      checkCount: 0,
    };
  }

  #snapshot(state, extras = {}) {
    const pick = (key, fallback) =>
      Object.prototype.hasOwnProperty.call(extras, key) ? extras[key] : fallback;

    return {
      sortedIds: [...state.sortedIds],
      lowerStack: [...state.lowerStack],
      upperStack: [...state.upperStack],
      hullIds: [...state.hullIds],
      phase: pick("phase", state.phase),
      scanIndex: pick("scanIndex", state.scanIndex),
      candidateId: pick("candidateId", state.candidateId),
      checkTriple: pick("checkTriple", state.checkTriple),
      checkCount: pick("checkCount", state.checkCount),
    };
  }

  #emit(events, state, { message, line, phase, scanIndex, candidateId, checkTriple }) {
    events.push({
      opType: "hull",
      line,
      message,
      snapshot: this.#snapshot(state, {
        phase,
        scanIndex,
        candidateId,
        checkTriple,
      }),
    });
  }

  #cross(aId, bId, cId) {
    const a = this.pointById.get(aId);
    const b = this.pointById.get(bId);
    const c = this.pointById.get(cId);
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  #pointLabel(id) {
    const point = this.pointById.get(id);
    return point ? formatPoint(point) : `#${id}`;
  }

  #hullSummary(hullIds) {
    if (hullIds.length === 0) {
      return "No hull vertices available.";
    }
    return hullIds.map((id) => this.#pointLabel(id)).join(" -> ");
  }

  generateRun() {
    const events = [];
    const state = this.createInitialSnapshot();

    this.#emit(events, state, {
      line: 1,
      phase: "sort",
      message: `Sorted points: ${this.#hullSummary(state.sortedIds)}.`,
    });

    if (state.sortedIds.length === 1) {
      state.phase = "done";
      state.hullIds = [state.sortedIds[0]];
      this.#emit(events, state, {
        line: 9,
        phase: "done",
        message: `Single-point hull: ${this.#hullSummary(state.hullIds)}.`,
      });

      return {
        events,
        hullIds: [...state.hullIds],
        checkCount: state.checkCount,
        summary: `Convex hull complete with ${state.hullIds.length} vertex.`,
        success: true,
      };
    }

    state.phase = "lower";
    for (let i = 0; i < state.sortedIds.length; i += 1) {
      const candidateId = state.sortedIds[i];
      const candidate = this.pointById.get(candidateId);

      this.#emit(events, state, {
        line: 2,
        phase: "lower",
        scanIndex: i,
        candidateId,
        message: `Lower pass: consider ${formatPoint(candidate)}.`,
      });

      while (state.lowerStack.length >= 2) {
        const aId = state.lowerStack[state.lowerStack.length - 2];
        const bId = state.lowerStack[state.lowerStack.length - 1];
        const cross = this.#cross(aId, bId, candidateId);
        const turn = cross > 0 ? "left" : cross < 0 ? "right" : "collinear";

        state.checkCount += 1;
        state.checkTriple = {
          aId,
          bId,
          cId: candidateId,
          cross,
        };

        this.#emit(events, state, {
          line: 3,
          phase: "lower",
          scanIndex: i,
          candidateId,
          checkTriple: state.checkTriple,
          message:
            `Check lower turn ${this.#pointLabel(aId)} -> ${this.#pointLabel(bId)} -> ` +
            `${this.#pointLabel(candidateId)}: ${turn} (cross=${formatNumber(cross)}).`,
        });

        if (cross <= 0) {
          const removedId = state.lowerStack.pop();
          this.#emit(events, state, {
            line: 3,
            phase: "lower",
            scanIndex: i,
            candidateId,
            checkTriple: state.checkTriple,
            message: `Pop ${this.#pointLabel(removedId)} from lower stack (turn is not left).`,
          });
          continue;
        }

        break;
      }

      state.checkTriple = null;
      state.lowerStack.push(candidateId);
      this.#emit(events, state, {
        line: 4,
        phase: "lower",
        scanIndex: i,
        candidateId,
        message: `Push ${formatPoint(candidate)} onto lower stack.`,
      });
    }

    state.phase = "upper";
    for (let i = state.sortedIds.length - 1; i >= 0; i -= 1) {
      const candidateId = state.sortedIds[i];
      const candidate = this.pointById.get(candidateId);

      this.#emit(events, state, {
        line: 5,
        phase: "upper",
        scanIndex: i,
        candidateId,
        message: `Upper pass: consider ${formatPoint(candidate)}.`,
      });

      while (state.upperStack.length >= 2) {
        const aId = state.upperStack[state.upperStack.length - 2];
        const bId = state.upperStack[state.upperStack.length - 1];
        const cross = this.#cross(aId, bId, candidateId);
        const turn = cross > 0 ? "left" : cross < 0 ? "right" : "collinear";

        state.checkCount += 1;
        state.checkTriple = {
          aId,
          bId,
          cId: candidateId,
          cross,
        };

        this.#emit(events, state, {
          line: 6,
          phase: "upper",
          scanIndex: i,
          candidateId,
          checkTriple: state.checkTriple,
          message:
            `Check upper turn ${this.#pointLabel(aId)} -> ${this.#pointLabel(bId)} -> ` +
            `${this.#pointLabel(candidateId)}: ${turn} (cross=${formatNumber(cross)}).`,
        });

        if (cross <= 0) {
          const removedId = state.upperStack.pop();
          this.#emit(events, state, {
            line: 6,
            phase: "upper",
            scanIndex: i,
            candidateId,
            checkTriple: state.checkTriple,
            message: `Pop ${this.#pointLabel(removedId)} from upper stack (turn is not left).`,
          });
          continue;
        }

        break;
      }

      state.checkTriple = null;
      state.upperStack.push(candidateId);
      this.#emit(events, state, {
        line: 7,
        phase: "upper",
        scanIndex: i,
        candidateId,
        message: `Push ${formatPoint(candidate)} onto upper stack.`,
      });
    }

    const mergedHull = state.lowerStack
      .slice(0, Math.max(state.lowerStack.length - 1, 0))
      .concat(state.upperStack.slice(0, Math.max(state.upperStack.length - 1, 0)));

    state.phase = "merge";
    state.scanIndex = null;
    state.candidateId = null;
    state.checkTriple = null;
    state.hullIds = mergedHull.length > 0 ? mergedHull : [...state.sortedIds];

    this.#emit(events, state, {
      line: 8,
      phase: "merge",
      message: `Merge chains: hull = lower[:-1] + upper[:-1]. Vertices so far: ${state.hullIds.length}.`,
    });

    state.phase = "done";
    const hullMessage = this.#hullSummary(state.hullIds);
    this.#emit(events, state, {
      line: 9,
      phase: "done",
      message: `Final hull (CCW): ${hullMessage}.`,
    });

    return {
      events,
      hullIds: [...state.hullIds],
      checkCount: state.checkCount,
      summary: `Convex hull complete with ${state.hullIds.length} vertices.`,
      success: true,
    };
  }
}

function generateRandomPointsText() {
  const targetCount = 8 + Math.floor(Math.random() * 7);
  const used = new Set();
  const points = [];

  while (points.length < targetCount) {
    const x = -14 + Math.floor(Math.random() * 29);
    const y = -12 + Math.floor(Math.random() * 25);
    const key = `${x}|${y}`;
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    points.push({ x, y });
  }

  return points.map((point) => `${point.x} ${point.y}`).join("\n");
}

const elements = {
  pointsInput: document.getElementById("pointsInput"),
  loadPointsBtn: document.getElementById("loadPointsBtn"),
  samplePointsBtn: document.getElementById("samplePointsBtn"),
  randomPointsBtn: document.getElementById("randomPointsBtn"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  geometryViewPanel: document.querySelector(".geometry-view"),
  hullCanvas: document.getElementById("hullCanvas"),
  sortedStrip: document.getElementById("sortedStrip"),
  lowerStrip: document.getElementById("lowerStrip"),
  upperStrip: document.getElementById("upperStrip"),
  hullStrip: document.getElementById("hullStrip"),
  pointRows: document.getElementById("pointRows"),
  statusMessage: document.getElementById("statusMessage"),
  pointsMetric: document.getElementById("pointsMetric"),
  hullMetric: document.getElementById("hullMetric"),
  checksMetric: document.getElementById("checksMetric"),
  stepCounter: document.getElementById("stepCounter"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  points: [],
  pointById: new Map(),
  tracer: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastHullIds: [],
  lastCheckCount: 0,
};

const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});

let operationRunner = null;

function setAnimationEmphasis(enabled) {
  elements.geometryViewPanel?.classList.toggle("playing", enabled);
}

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    sortedIds: [...snapshot.sortedIds],
    lowerStack: [...snapshot.lowerStack],
    upperStack: [...snapshot.upperStack],
    hullIds: [...snapshot.hullIds],
    phase: snapshot.phase,
    scanIndex: snapshot.scanIndex,
    candidateId: snapshot.candidateId,
    checkTriple: snapshot.checkTriple
      ? {
          aId: snapshot.checkTriple.aId,
          bId: snapshot.checkTriple.bId,
          cId: snapshot.checkTriple.cId,
          cross: snapshot.checkTriple.cross,
        }
      : null,
    checkCount: snapshot.checkCount,
  };
}

function getPointById(id) {
  return state.pointById.get(id) ?? null;
}

function renderStrip(container, ids, { emptyText, variant, activeId, checkTriple }) {
  container.innerHTML = "";

  if (!ids || ids.length === 0) {
    const empty = document.createElement("span");
    empty.className = "pill empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const checkIds = new Set(
    checkTriple ? [checkTriple.aId, checkTriple.bId, checkTriple.cId] : [],
  );

  for (const id of ids) {
    const point = getPointById(id);
    if (!point) {
      continue;
    }

    const pill = document.createElement("span");
    pill.className = `pill ${variant}`;
    pill.textContent = `${point.label} (${formatNumber(point.x)}, ${formatNumber(point.y)})`;

    if (id === activeId) {
      pill.classList.add("active");
    }
    if (checkIds.has(id)) {
      pill.classList.add("check");
    }

    container.appendChild(pill);
  }
}

function renderPointTable(snapshot) {
  elements.pointRows.innerHTML = "";

  if (!state.points.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="3" class="empty-row">Load points to inspect table state.</td>`;
    elements.pointRows.appendChild(row);
    return;
  }

  const lowerSet = new Set(snapshot?.lowerStack ?? []);
  const upperSet = new Set(snapshot?.upperStack ?? []);
  const hullSet = new Set(snapshot?.hullIds ?? state.lastHullIds);

  for (const point of state.points) {
    const row = document.createElement("tr");

    if (snapshot?.candidateId === point.id) {
      row.classList.add("row-current");
    }

    let role = "inside";
    if (hullSet.has(point.id)) {
      role = "hull";
    } else if (lowerSet.has(point.id)) {
      role = "lower";
    } else if (upperSet.has(point.id)) {
      role = "upper";
    }

    row.innerHTML = `
      <td>${point.label}</td>
      <td>(${formatNumber(point.x)}, ${formatNumber(point.y)})</td>
      <td>${role}</td>
    `;

    elements.pointRows.appendChild(row);
  }
}

function drawPolyline(svg, ids, project, className) {
  if (!ids || ids.length < 2) {
    return;
  }

  const pointsText = ids
    .map((id) => getPointById(id))
    .filter(Boolean)
    .map((point) => {
      const projected = project(point);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");

  const polyline = createSvgElement("polyline", {
    points: pointsText,
    class: className,
  });
  svg.appendChild(polyline);
}

function drawPolygon(svg, ids, project, className) {
  if (!ids || ids.length < 3) {
    return;
  }

  const pointsText = ids
    .map((id) => getPointById(id))
    .filter(Boolean)
    .map((point) => {
      const projected = project(point);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");

  const polygon = createSvgElement("polygon", {
    points: pointsText,
    class: className,
  });
  svg.appendChild(polygon);
}

function renderHullCanvas(snapshot) {
  const svg = elements.hullCanvas;
  svg.replaceChildren();

  if (!state.points.length) {
    const empty = createSvgElement("text", {
      x: 460,
      y: 260,
      class: "canvas-empty",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    });
    empty.textContent = "Load points to visualize convex hull construction.";
    svg.appendChild(empty);
    return;
  }

  const width = 920;
  const height = 520;
  const project = computeProjection(state.points, width, height);

  const hullIds = snapshot?.hullIds ?? state.lastHullIds;
  drawPolygon(svg, hullIds, project, "hull-polygon");
  drawPolyline(svg, snapshot?.lowerStack ?? [], project, "lower-path");
  drawPolyline(svg, snapshot?.upperStack ?? [], project, "upper-path");

  if (snapshot?.checkTriple) {
    const a = getPointById(snapshot.checkTriple.aId);
    const b = getPointById(snapshot.checkTriple.bId);
    const c = getPointById(snapshot.checkTriple.cId);
    if (a && b && c) {
      const pa = project(a);
      const pb = project(b);
      const pc = project(c);
      const check = createSvgElement("polyline", {
        points: `${pa.x},${pa.y} ${pb.x},${pb.y} ${pc.x},${pc.y}`,
        class: snapshot.checkTriple.cross > 0 ? "turn-check left" : "turn-check non-left",
      });
      svg.appendChild(check);

      const crossTag = createSvgElement("text", {
        x: pb.x + 10,
        y: pb.y - 10,
        class: "cross-label",
      });
      crossTag.textContent = `cross=${formatNumber(snapshot.checkTriple.cross)}`;
      svg.appendChild(crossTag);
    }
  }

  const hullSet = new Set(hullIds ?? []);
  const lowerSet = new Set(snapshot?.lowerStack ?? []);
  const upperSet = new Set(snapshot?.upperStack ?? []);

  const rankMap = new Map();
  (snapshot?.sortedIds ?? []).forEach((id, index) => {
    rankMap.set(id, index + 1);
  });

  for (const point of state.points) {
    const position = project(point);
    const classes = ["point-node"];

    if (hullSet.has(point.id)) {
      classes.push("hull");
    }
    if (lowerSet.has(point.id)) {
      classes.push("lower");
    }
    if (upperSet.has(point.id)) {
      classes.push("upper");
    }
    if (snapshot?.candidateId === point.id) {
      classes.push("candidate");
    }

    if (
      snapshot?.checkTriple &&
      (snapshot.checkTriple.aId === point.id ||
        snapshot.checkTriple.bId === point.id ||
        snapshot.checkTriple.cId === point.id)
    ) {
      classes.push("check");
    }

    const group = createSvgElement("g", {
      class: classes.join(" "),
    });

    const circle = createSvgElement("circle", {
      cx: position.x,
      cy: position.y,
      r: 9,
    });
    group.appendChild(circle);

    const label = createSvgElement("text", {
      x: position.x + 12,
      y: position.y - 10,
      class: "point-label",
    });
    label.textContent = point.label;
    group.appendChild(label);

    if (rankMap.has(point.id)) {
      const rank = createSvgElement("text", {
        x: position.x,
        y: position.y + 1,
        class: "point-rank",
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      });
      rank.textContent = String(rankMap.get(point.id));
      group.appendChild(rank);
    }

    svg.appendChild(group);
  }
}

function renderSnapshot(snapshot) {
  renderHullCanvas(snapshot);

  renderStrip(elements.sortedStrip, snapshot?.sortedIds ?? [], {
    emptyText: "sorted order unavailable",
    variant: "sorted",
    activeId: snapshot?.candidateId ?? null,
    checkTriple: snapshot?.checkTriple ?? null,
  });

  renderStrip(elements.lowerStrip, snapshot?.lowerStack ?? [], {
    emptyText: "lower stack is empty",
    variant: "lower",
    activeId: snapshot?.candidateId ?? null,
    checkTriple: snapshot?.checkTriple ?? null,
  });

  renderStrip(elements.upperStrip, snapshot?.upperStack ?? [], {
    emptyText: "upper stack is empty",
    variant: "upper",
    activeId: snapshot?.candidateId ?? null,
    checkTriple: snapshot?.checkTriple ?? null,
  });

  renderStrip(elements.hullStrip, snapshot?.hullIds ?? state.lastHullIds, {
    emptyText: "hull not merged yet",
    variant: "hull",
    activeId: null,
    checkTriple: null,
  });

  renderPointTable(snapshot);
}

function updateMetrics() {
  elements.pointsMetric.textContent = String(state.points.length);
  elements.hullMetric.textContent = String(state.lastHullIds.length);
  elements.checksMetric.textContent = String(state.lastCheckCount);

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  state.lastHullIds = [...event.snapshot.hullIds];
  state.lastCheckCount = event.snapshot.checkCount;

  renderSnapshot(state.lastSnapshot);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
  updateMetrics();
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);
  state.lastHullIds = [...meta.hullIds];
  state.lastCheckCount = meta.checkCount;

  helpers.updateStatus(meta.summary);
  helpers.appendLog(meta.summary, meta.success ? "ok" : "");
  helpers.clearCodeHighlights();

  renderSnapshot(state.lastSnapshot);
  updateMetrics();
}

function prepareOperation() {
  if (!state.tracer || state.points.length === 0) {
    const message = "Load points first.";
    helpers.updateStatus(message);
    helpers.appendLog(message);
    return null;
  }

  return state.tracer.generateRun();
}

function loadPoints(points, { message }) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.points = points.map((point) => ({ ...point }));
  state.pointById = new Map(state.points.map((point) => [point.id, point]));
  state.tracer = new ConvexHullTracer(state.points);
  state.lastSnapshot = state.tracer.createInitialSnapshot();
  state.lastHullIds = [];
  state.lastCheckCount = 0;

  renderSnapshot(state.lastSnapshot);
  helpers.focusCodePanel("hull");
  helpers.clearCodeHighlights();
  helpers.updateStatus(message);
  helpers.appendLog(message, "ok");
  updateMetrics();
}

function loadPointsFromInput() {
  setAnimationEmphasis(false);

  const parsed = parsePointsInput(elements.pointsInput.value, {
    maxPoints: 40,
  });

  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }

  const duplicateNote =
    parsed.removedDuplicates > 0
      ? ` (${parsed.removedDuplicates} duplicate point${parsed.removedDuplicates === 1 ? "" : "s"} removed)`
      : "";

  loadPoints(parsed.points, {
    message: `Loaded ${parsed.points.length} unique points${duplicateNote}.`,
  });
}

function loadSamplePoints() {
  elements.pointsInput.value = SAMPLE_POINTS_TEXT;
  loadPointsFromInput();
}

function loadRandomPoints() {
  elements.pointsInput.value = generateRandomPointsText();
  loadPointsFromInput();
}

function init() {
  operationRunner = createOperationRunner({
    getSpeedMs: () => state.speedMs,
    prepareOperation,
    applyEvent,
    updateMetrics,
    finalizeOperation: finalizePendingOperation,
    onPrepared: (operation) => {
      helpers.appendLog(`Prepared hull run with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      setAnimationEmphasis(false);
      helpers.updateStatus("No pending operation to finish.");
    },
  });

  elements.loadPointsBtn.addEventListener("click", loadPointsFromInput);
  elements.samplePointsBtn.addEventListener("click", loadSamplePoints);
  elements.randomPointsBtn.addEventListener("click", loadRandomPoints);

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
      l: () => loadPointsFromInput(),
      m: () => loadSamplePoints(),
      r: () => loadRandomPoints(),
    },
  });

  helpers.focusCodePanel("hull");
  loadSamplePoints();
}

init();
