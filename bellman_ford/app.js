import {
  bindShortcutHandler,
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
import {
  computeCircularNodePositions,
  createSvgElement,
} from "../shared/graph-core.js";
import {
  createDirectedPairSet,
  ensureArrowMarker,
  getReverseCurveOffset,
  prepareGraphCanvas,
  renderGraphEdges,
  renderGraphNodes,
} from "../shared/graph-renderer.js";

const SAMPLE_GRAPH = {
  nodes: ["S", "A", "B", "C", "D", "E"],
  edgesText: `S A 4
S E 5
A C 6
B A 3
C B -2
D C 3
D A 10
E D -1`,
};

function normalizeLabel(raw) {
  return raw.trim().toUpperCase();
}

function formatDistance(value) {
  return Number.isFinite(value) ? String(value) : "inf";
}

function parseNodesInput(text) {
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .map((token) => normalizeLabel(token))
    .filter((token) => token.length > 0);

  if (tokens.length < 2) {
    return { error: "Please provide at least 2 nodes." };
  }
  if (tokens.length > 10) {
    return { error: "Please use at most 10 nodes." };
  }

  const nodes = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(token)) {
      return {
        error: `Invalid node label '${token}'. Use letters/numbers/underscore and start with a letter.`,
      };
    }
    if (seen.has(token)) {
      return { error: `Duplicate node label '${token}'.` };
    }
    seen.add(token);
    nodes.push(token);
  }

  return { nodes };
}

function edgeKey(mode, fromIndex, toIndex) {
  if (mode === "directed") {
    return `${fromIndex}->${toIndex}`;
  }
  return fromIndex < toIndex ? `${fromIndex}--${toIndex}` : `${toIndex}--${fromIndex}`;
}

function parseEdgesInput(text, labelToIndex, mode) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return { error: "Please provide at least one edge line." };
  }

  const displayEdges = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split(/[\s,]+/).filter((token) => token.length > 0);
    if (parts.length !== 3) {
      return { error: `Edge line ${i + 1} is invalid. Use: FROM TO WEIGHT` };
    }

    const fromLabel = normalizeLabel(parts[0]);
    const toLabel = normalizeLabel(parts[1]);
    const weight = Number(parts[2]);

    if (!labelToIndex.has(fromLabel)) {
      return { error: `Edge line ${i + 1}: unknown node '${fromLabel}'.` };
    }
    if (!labelToIndex.has(toLabel)) {
      return { error: `Edge line ${i + 1}: unknown node '${toLabel}'.` };
    }
    if (!Number.isFinite(weight) || !Number.isInteger(weight)) {
      return { error: `Edge line ${i + 1}: weight must be an integer.` };
    }

    if (mode === "undirected" && weight < 0) {
      return {
        error:
          "Undirected mode disallows negative weights (it immediately creates a negative cycle). Use directed mode.",
      };
    }

    const from = labelToIndex.get(fromLabel);
    const to = labelToIndex.get(toLabel);
    if (from === to) {
      return { error: `Edge line ${i + 1}: self-loop is not allowed.` };
    }

    const key = edgeKey(mode, from, to);
    if (seen.has(key)) {
      return { error: `Edge line ${i + 1}: duplicate edge '${fromLabel} ${toLabel}'.` };
    }

    seen.add(key);
    displayEdges.push({
      id: displayEdges.length + 1,
      from,
      to,
      weight,
    });
  }

  return { displayEdges };
}

function buildGraph(nodes, displayEdges, mode) {
  const relaxEdges = [];

  for (const edge of displayEdges) {
    relaxEdges.push({
      from: edge.from,
      to: edge.to,
      weight: edge.weight,
      displayId: edge.id,
    });

    if (mode === "undirected") {
      relaxEdges.push({
        from: edge.to,
        to: edge.from,
        weight: edge.weight,
        displayId: edge.id,
      });
    }
  }

  return {
    nodes,
    displayEdges,
    relaxEdges,
    mode,
  };
}

class BellmanFordTracer {
  constructor(graph) {
    this.graph = graph;
  }

  createBlankSnapshot() {
    const n = this.graph.nodes.length;
    return {
      distances: new Array(n).fill(Infinity),
      previous: new Array(n).fill(null),
      updatedNode: null,
      activeDisplayEdgeId: null,
      passIndex: 0,
      maxPass: Math.max(0, n - 1),
      relaxCount: 0,
      cycleDetected: false,
    };
  }

  #snapshot(state, extras = {}) {
    return {
      distances: [...state.distances],
      previous: [...state.previous],
      updatedNode: extras.updatedNode ?? null,
      activeDisplayEdgeId: extras.activeDisplayEdgeId ?? null,
      passIndex: state.passIndex,
      maxPass: state.maxPass,
      relaxCount: state.relaxCount,
      cycleDetected: state.cycleDetected,
    };
  }

  #emit(events, message, line, state, extras = {}) {
    events.push({
      opType: "bellman",
      message,
      line,
      snapshot: this.#snapshot(state, extras),
      activeDisplayEdgeId: extras.activeDisplayEdgeId ?? null,
    });
  }

  generateRun(sourceIndex) {
    const labels = this.graph.nodes;
    const n = labels.length;

    const state = {
      distances: new Array(n).fill(Infinity),
      previous: new Array(n).fill(null),
      passIndex: 0,
      maxPass: Math.max(0, n - 1),
      relaxCount: 0,
      cycleDetected: false,
    };
    const events = [];

    state.distances[sourceIndex] = 0;
    this.#emit(
      events,
      `Initialize distances: dist[${labels[sourceIndex]}] = 0, all others = inf.`,
      1,
      state,
      { updatedNode: sourceIndex },
    );

    for (let pass = 1; pass <= n - 1; pass += 1) {
      state.passIndex = pass;
      let updatedInPass = false;
      this.#emit(events, `Start pass ${pass} of ${n - 1}.`, 2, state);

      for (const edge of this.graph.relaxEdges) {
        const fromLabel = labels[edge.from];
        const toLabel = labels[edge.to];
        this.#emit(
          events,
          `Inspect edge ${fromLabel} -> ${toLabel} (w=${edge.weight}).`,
          3,
          state,
          { activeDisplayEdgeId: edge.displayId },
        );

        if (!Number.isFinite(state.distances[edge.from])) {
          this.#emit(
            events,
            `Skip: dist[${fromLabel}] is inf, so no candidate for ${toLabel}.`,
            4,
            state,
            { activeDisplayEdgeId: edge.displayId },
          );
          continue;
        }

        const candidate = state.distances[edge.from] + edge.weight;
        if (candidate < state.distances[edge.to]) {
          const oldValue = state.distances[edge.to];
          state.distances[edge.to] = candidate;
          state.previous[edge.to] = edge.from;
          state.relaxCount += 1;
          updatedInPass = true;
          this.#emit(
            events,
            `Relax ${toLabel}: ${formatDistance(oldValue)} -> ${candidate}; prev=${fromLabel}.`,
            5,
            state,
            {
              updatedNode: edge.to,
              activeDisplayEdgeId: edge.displayId,
            },
          );
        } else {
          this.#emit(
            events,
            `No improvement for ${toLabel}; current dist is ${formatDistance(state.distances[edge.to])}.`,
            4,
            state,
            { activeDisplayEdgeId: edge.displayId },
          );
        }
      }

      if (!updatedInPass) {
        this.#emit(
          events,
          `No updates on pass ${pass}. Stop early.`,
          6,
          state,
        );
        break;
      }

      this.#emit(events, `Pass ${pass} completed with updates.`, 2, state);
    }

    state.passIndex = n;
    let cycleDetected = false;
    let cycleEdgeDisplayId = null;

    for (const edge of this.graph.relaxEdges) {
      const fromDist = state.distances[edge.from];
      const toDist = state.distances[edge.to];
      const candidate = fromDist + edge.weight;
      this.#emit(
        events,
        `Cycle-check edge ${labels[edge.from]} -> ${labels[edge.to]} (w=${edge.weight}).`,
        7,
        state,
        { activeDisplayEdgeId: edge.displayId },
      );

      if (Number.isFinite(fromDist) && candidate < toDist) {
        cycleDetected = true;
        cycleEdgeDisplayId = edge.displayId;
        state.cycleDetected = true;
        this.#emit(
          events,
          `Negative cycle detected: edge ${labels[edge.from]} -> ${labels[edge.to]} can still relax.`,
          7,
          state,
          { activeDisplayEdgeId: edge.displayId },
        );
        break;
      }
    }

    if (!cycleDetected) {
      this.#emit(events, "Cycle-check pass found no further relaxation.", 7, state);
    }

    const reachable = state.distances.filter((distance) => Number.isFinite(distance)).length;
    const summary = cycleDetected
      ? `Negative cycle detected from source ${labels[sourceIndex]}. Distances are not well-defined.`
      : `Bellman-Ford complete from ${labels[sourceIndex]}. Reachable nodes: ${reachable}/${n}.`;

    this.#emit(events, summary, 7, state, {
      activeDisplayEdgeId: cycleEdgeDisplayId,
    });

    return {
      events,
      cycleDetected,
      relaxCount: state.relaxCount,
      distances: state.distances,
      previous: state.previous,
      summary,
      success: !cycleDetected,
    };
  }
}

const elements = {
  nodesInput: document.getElementById("nodesInput"),
  edgesInput: document.getElementById("edgesInput"),
  loadGraphBtn: document.getElementById("loadGraphBtn"),
  sampleGraphBtn: document.getElementById("sampleGraphBtn"),
  randomGraphBtn: document.getElementById("randomGraphBtn"),
  graphMode: document.getElementById("graphMode"),
  sourceSelect: document.getElementById("sourceSelect"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  passMetric: document.getElementById("passMetric"),
  relaxMetric: document.getElementById("relaxMetric"),
  cycleMetric: document.getElementById("cycleMetric"),
  stepCounter: document.getElementById("stepCounter"),
  graphViewPanel: document.getElementById("graphViewPanel"),
  modeIndicator: document.getElementById("modeIndicator"),
  graphCanvas: document.getElementById("graphCanvas"),
  passStrip: document.getElementById("passStrip"),
  distanceCards: document.getElementById("distanceCards"),
  edgeRows: document.getElementById("edgeRows"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  graph: null,
  tracer: null,
  mode: elements.graphMode.value,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastRelaxCount: 0,
  lastCycleDetected: false,
};
const logger = createLogger(elements.logOutput);
const codeHighlighter = createCodeHighlighter(".code-panel");
let operationRunner = null;

function updateStatus(message) {
  elements.statusMessage.textContent = message;
}

function setAnimationEmphasis(enabled) {
  elements.graphViewPanel.classList.toggle("playing", enabled);
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

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }
  return {
    distances: [...snapshot.distances],
    previous: [...snapshot.previous],
    updatedNode: snapshot.updatedNode,
    activeDisplayEdgeId: snapshot.activeDisplayEdgeId,
    passIndex: snapshot.passIndex,
    maxPass: snapshot.maxPass,
    relaxCount: snapshot.relaxCount,
    cycleDetected: snapshot.cycleDetected,
  };
}

function getSelectedSourceIndex() {
  const value = Number(elements.sourceSelect.value);
  return Number.isInteger(value) ? value : null;
}

function applyModeUi(mode) {
  const directed = mode === "directed";
  elements.graphViewPanel.classList.toggle("mode-directed", directed);
  elements.graphViewPanel.classList.toggle("mode-undirected", !directed);
  elements.modeIndicator.textContent = directed
    ? "Directed mode: edges are relaxed one-way."
    : "Undirected mode: each edge is treated as two directed relaxations.";
}

function getTreeEdgeIds(snapshot) {
  const ids = new Set();
  if (!state.graph || !snapshot) {
    return ids;
  }

  for (let node = 0; node < snapshot.previous.length; node += 1) {
    const parent = snapshot.previous[node];
    if (parent === null) {
      continue;
    }
    const match = state.graph.displayEdges.find((edge) => {
      if (state.mode === "directed") {
        return edge.from === parent && edge.to === node;
      }
      return (
        (edge.from === parent && edge.to === node) ||
        (edge.from === node && edge.to === parent)
      );
    });
    if (match) {
      ids.add(match.id);
    }
  }

  return ids;
}

function renderGraphCanvas(snapshot, activeDisplayEdgeId = null) {
  const prepared = prepareGraphCanvas({
    svgElement: elements.graphCanvas,
    fallbackSize: { width: 900, height: 520 },
    hasGraph: Boolean(state.graph),
    emptyMessage: "Load a graph to visualize it.",
  });
  if (!prepared.ready) {
    return;
  }
  const { width, height } = prepared;

  const positions = computeCircularNodePositions(state.graph.nodes.length, width, height, {
    marginX: 90,
    marginY: 90,
    minRadiusX: 90,
    minRadiusY: 88,
  });
  const treeEdgeIds = getTreeEdgeIds(snapshot);
  const sourceIndex = getSelectedSourceIndex();
  const drawDirected = state.mode === "directed";

  if (drawDirected) {
    ensureArrowMarker({
      svgElement: elements.graphCanvas,
      id: "bf-arrow",
      markerWidth: 8,
      markerHeight: 8,
      refX: 7.2,
      refY: 4,
      fill: "rgba(124, 85, 64, 0.9)",
    });
  }

  const directedPairs = createDirectedPairSet(state.graph.displayEdges);
  renderGraphEdges({
    svgElement: elements.graphCanvas,
    edges: state.graph.displayEdges,
    positions,
    nodeRadius: 23,
    directed: drawDirected,
    markerId: "bf-arrow",
    activeEdgeId: activeDisplayEdgeId,
    curveOffsetForEdge: (edge) =>
      drawDirected ? getReverseCurveOffset(edge, directedPairs, 22) : 0,
    labelOffset: 11,
    edgeClassFn: (edge) => (treeEdgeIds.has(edge.id) ? ["tree"] : []),
    edgeLabelTextFn: (edge) => String(edge.weight),
    edgeLabelWidthFn: (text) => 10 + text.length * 7,
    edgeLabelVerticalOffset: 0.4,
  });

  renderGraphNodes({
    svgElement: elements.graphCanvas,
    nodeCount: state.graph.nodes.length,
    positions,
    nodeClassFn: (index) => [
      sourceIndex === index ? "source" : "",
      !Number.isFinite(snapshot?.distances[index]) ? "unreachable" : "",
      snapshot?.updatedNode === index ? "updated" : "",
      snapshot?.cycleDetected && snapshot?.updatedNode === index ? "cycle" : "",
    ],
    renderNodeContent: ({ group, index, position }) => {
      if (snapshot?.updatedNode === index) {
        const halo = createSvgElement("circle", {
          class: "graph-current-halo",
          cx: position.x,
          cy: position.y,
          r: 31,
        });
        group.appendChild(halo);
      }

      const circle = createSvgElement("circle", {
        cx: position.x,
        cy: position.y,
        r: 23,
      });
      group.appendChild(circle);

      const name = createSvgElement("text", {
        class: "label",
        x: position.x,
        y: position.y - 1,
      });
      name.textContent = state.graph.nodes[index];
      group.appendChild(name);

      const dist = createSvgElement("text", {
        class: "dist",
        x: position.x,
        y: position.y + 34,
      });
      dist.textContent = `d=${formatDistance(snapshot?.distances[index] ?? Infinity)}`;
      group.appendChild(dist);
    },
  });
}

function renderPassStrip(snapshot) {
  elements.passStrip.innerHTML = "";

  if (!state.graph) {
    const idle = document.createElement("span");
    idle.className = "pass-chip idle";
    idle.textContent = "Load a graph first";
    elements.passStrip.appendChild(idle);
    return;
  }

  const maxPass = Math.max(0, state.graph.nodes.length - 1);
  const currentPass = snapshot?.passIndex ?? 0;

  for (let pass = 1; pass <= maxPass; pass += 1) {
    const chip = document.createElement("span");
    chip.className = "pass-chip";
    chip.textContent = `pass ${pass}`;

    if (currentPass > pass || currentPass > maxPass) {
      chip.classList.add("done");
    }
    if (currentPass === pass) {
      chip.classList.add("current");
    }

    elements.passStrip.appendChild(chip);
  }

  const cycleChip = document.createElement("span");
  cycleChip.className = "pass-chip cycle";
  cycleChip.textContent = "check n";
  if (currentPass >= state.graph.nodes.length) {
    cycleChip.classList.add("current");
  }
  if (snapshot?.cycleDetected) {
    cycleChip.classList.add("done");
  }
  elements.passStrip.appendChild(cycleChip);
}

function renderDistances(snapshot) {
  elements.distanceCards.innerHTML = "";
  if (!state.graph || !snapshot) {
    return;
  }

  for (let i = 0; i < state.graph.nodes.length; i += 1) {
    const card = document.createElement("article");
    card.className = "distance-card";

    const isUnreachable = !Number.isFinite(snapshot.distances[i]);
    if (isUnreachable) {
      card.classList.add("unreachable");
    }
    if (snapshot.updatedNode === i) {
      card.classList.add("updated", "current");
    }

    const sourceIndex = getSelectedSourceIndex();
    let nodeState = "stable";
    if (sourceIndex === i) {
      nodeState = "source";
    } else if (isUnreachable) {
      nodeState = "unseen";
    }

    const prev = snapshot.previous[i] === null ? "-" : state.graph.nodes[snapshot.previous[i]];

    card.innerHTML = `
      <div class="distance-head">
        <span class="node-name">${state.graph.nodes[i]}</span>
        <span class="node-state">${nodeState}</span>
      </div>
      <div class="dist-value">dist: ${formatDistance(snapshot.distances[i])}</div>
      <div class="prev-value">prev: ${prev}</div>
    `;

    elements.distanceCards.appendChild(card);
  }
}

function renderEdges(activeDisplayEdgeId = null) {
  elements.edgeRows.innerHTML = "";
  if (!state.graph) {
    return;
  }

  const arrow = state.mode === "directed" ? "->" : "<->";

  for (const edge of state.graph.displayEdges) {
    const row = document.createElement("tr");
    if (activeDisplayEdgeId !== null && edge.id === activeDisplayEdgeId) {
      row.classList.add("active-edge");
    }

    row.innerHTML = `
      <td>${edge.id}</td>
      <td>${state.graph.nodes[edge.from]} ${arrow} ${state.graph.nodes[edge.to]}</td>
      <td>${edge.weight}</td>
    `;

    elements.edgeRows.appendChild(row);
  }
}

function renderSnapshot(snapshot, activeDisplayEdgeId = null) {
  renderGraphCanvas(snapshot, activeDisplayEdgeId);
  renderPassStrip(snapshot);
  renderDistances(snapshot);
  renderEdges(activeDisplayEdgeId);
}

function updateMetrics() {
  const maxPass = state.graph ? Math.max(0, state.graph.nodes.length - 1) : 0;
  const passIndex = state.lastSnapshot ? state.lastSnapshot.passIndex : 0;
  if (passIndex === 0) {
    elements.passMetric.textContent = `0 / ${maxPass}`;
  } else if (passIndex <= maxPass) {
    elements.passMetric.textContent = `${passIndex} / ${maxPass}`;
  } else {
    elements.passMetric.textContent = `${maxPass} / ${maxPass} + check`;
  }

  elements.relaxMetric.textContent = String(state.lastRelaxCount);
  elements.cycleMetric.textContent = state.lastCycleDetected ? "Yes" : "No";

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  state.lastRelaxCount = event.snapshot.relaxCount;
  state.lastCycleDetected = event.snapshot.cycleDetected;

  renderSnapshot(state.lastSnapshot, event.activeDisplayEdgeId ?? null);
  highlightCode(event.opType, event.line);
  updateStatus(event.message);
  updateMetrics();
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);
  state.lastRelaxCount = meta.relaxCount;
  state.lastCycleDetected = meta.cycleDetected;

  updateStatus(meta.summary);
  appendLog(meta.summary, meta.success ? "ok" : "");

  renderSnapshot(state.lastSnapshot, null);
  clearCodeHighlights();
  updateMetrics();
}

function populateSourceSelect(nodes) {
  const previousValue = elements.sourceSelect.value;
  elements.sourceSelect.innerHTML = "";

  nodes.forEach((label, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = label;
    elements.sourceSelect.appendChild(option);
  });

  const hasPrevious = nodes.some((_, index) => String(index) === previousValue);
  elements.sourceSelect.value = hasPrevious ? previousValue : "0";
}

function clearGraphState() {
  setAnimationEmphasis(false);
  state.graph = null;
  state.tracer = null;
  state.lastRelaxCount = 0;
  state.lastCycleDetected = false;
  state.lastSnapshot = null;
  renderSnapshot(null, null);
  clearCodeHighlights();
  updateMetrics();
}

function loadGraphFromInputs() {
  setAnimationEmphasis(false);
  operationRunner.stop();
  operationRunner.ensureNoPending();

  const parsedNodes = parseNodesInput(elements.nodesInput.value);
  if (parsedNodes.error) {
    clearGraphState();
    updateStatus(parsedNodes.error);
    appendLog(parsedNodes.error);
    return false;
  }

  const labelToIndex = new Map();
  parsedNodes.nodes.forEach((label, index) => {
    labelToIndex.set(label, index);
  });

  const parsedEdges = parseEdgesInput(elements.edgesInput.value, labelToIndex, state.mode);
  if (parsedEdges.error) {
    clearGraphState();
    updateStatus(parsedEdges.error);
    appendLog(parsedEdges.error);
    return false;
  }

  state.graph = buildGraph(parsedNodes.nodes, parsedEdges.displayEdges, state.mode);
  state.tracer = new BellmanFordTracer(state.graph);

  populateSourceSelect(state.graph.nodes);

  state.lastRelaxCount = 0;
  state.lastCycleDetected = false;
  state.lastSnapshot = state.tracer.createBlankSnapshot();

  renderSnapshot(state.lastSnapshot, null);
  focusCodePanel("bellman");
  clearCodeHighlights();
  updateMetrics();

  const message = `Loaded ${state.graph.nodes.length} nodes and ${state.graph.displayEdges.length} edges in ${state.mode} mode.`;
  updateStatus(message);
  appendLog(message, "ok");
  return true;
}

function setGraphMode(mode) {
  state.mode = mode;
  elements.graphMode.value = mode;
  applyModeUi(mode);
}

function applyModeAndReload(mode) {
  setGraphMode(mode);
  const ok = loadGraphFromInputs();
  if (!ok) {
    updateStatus(
      `Graph mode switched to ${mode}, but current inputs are invalid for this mode. Fix input and load again.`,
    );
  }
}

function randomWeight(mode) {
  if (mode === "directed") {
    return -3 + Math.floor(Math.random() * 12);
  }
  return 1 + Math.floor(Math.random() * 12);
}

function generateRandomGraph(mode) {
  const size = 5 + Math.floor(Math.random() * 3);
  const nodes = [];
  for (let i = 0; i < size; i += 1) {
    nodes.push(String.fromCharCode(65 + i));
  }

  const edges = [];
  const seen = new Set();
  const targetEdges = size - 1 + Math.floor(Math.random() * (size + 1));

  const addEdge = (from, to) => {
    if (from === to) {
      return false;
    }
    const key = edgeKey(mode, from, to);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    edges.push({ from, to, weight: randomWeight(mode) });
    return true;
  };

  for (let i = 0; i < size - 1; i += 1) {
    addEdge(i, i + 1);
  }

  let guard = 0;
  while (edges.length < targetEdges && guard < 400) {
    guard += 1;
    const from = Math.floor(Math.random() * size);
    const to = Math.floor(Math.random() * size);
    addEdge(from, to);
  }

  return {
    nodes,
    edgeLines: edges.map((edge) => `${nodes[edge.from]} ${nodes[edge.to]} ${edge.weight}`),
  };
}

function loadSampleGraph() {
  setGraphMode("directed");
  elements.nodesInput.value = SAMPLE_GRAPH.nodes.join(", ");
  elements.edgesInput.value = SAMPLE_GRAPH.edgesText;
  loadGraphFromInputs();
}

function loadRandomGraph() {
  const random = generateRandomGraph(state.mode);
  elements.nodesInput.value = random.nodes.join(", ");
  elements.edgesInput.value = random.edgeLines.join("\n");
  loadGraphFromInputs();
}

function prepareOperation() {
  if (!state.tracer || !state.graph) {
    updateStatus("Load a graph first.");
    return null;
  }

  const sourceIndex = getSelectedSourceIndex();
  if (sourceIndex === null || sourceIndex < 0 || sourceIndex >= state.graph.nodes.length) {
    const message = "Choose a valid source node.";
    updateStatus(message);
    appendLog(message);
    return null;
  }

  const trace = state.tracer.generateRun(sourceIndex);
  return {
    opType: "bellman",
    events: trace.events,
    cycleDetected: trace.cycleDetected,
    relaxCount: trace.relaxCount,
    summary: trace.summary,
    success: trace.success,
  };
}

function init() {
  const runAnimatedOperation = () => {
    setAnimationEmphasis(true);
    operationRunner.runAnimated();
    if (!operationRunner.hasPending) {
      setAnimationEmphasis(false);
    }
  };
  const runStepOperation = () => {
    setAnimationEmphasis(false);
    operationRunner.step();
  };
  const runInstantOperation = () => {
    setAnimationEmphasis(false);
    operationRunner.runInstant();
  };
  const finishCurrentOperation = () => {
    setAnimationEmphasis(false);
    operationRunner.finishCurrent();
  };

  operationRunner = createOperationRunner({
    getSpeedMs: () => state.speedMs,
    prepareOperation,
    applyEvent,
    updateMetrics,
    finalizeOperation: finalizePendingOperation,
    onPrepared: (operation) => {
      appendLog(`Prepared ${operation.opType} run with ${operation.events.length} trace steps.`);
    },
    onNoPending: () => {
      setAnimationEmphasis(false);
      updateStatus("No pending operation to finish.");
    },
  });

  elements.loadGraphBtn.addEventListener("click", loadGraphFromInputs);
  elements.sampleGraphBtn.addEventListener("click", loadSampleGraph);
  elements.randomGraphBtn.addEventListener("click", loadRandomGraph);

  elements.graphMode.addEventListener("change", () => {
    applyModeAndReload(elements.graphMode.value);
  });

  elements.animateBtn.addEventListener("click", runAnimatedOperation);
  elements.stepBtn.addEventListener("click", runStepOperation);
  elements.instantBtn.addEventListener("click", runInstantOperation);
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
      a: () => runAnimatedOperation(),
      s: () => runStepOperation(),
      i: () => runInstantOperation(),
      f: () => finishCurrentOperation(),
      l: () => loadGraphFromInputs(),
      m: () => loadSampleGraph(),
      r: () => loadRandomGraph(),
      d: () => applyModeAndReload("directed"),
      u: () => applyModeAndReload("undirected"),
    },
  });

  focusCodePanel("bellman");
  applyModeUi(state.mode);
  loadSampleGraph();
}

init();
