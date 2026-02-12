import {
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
import {
  createLabelToIndex,
  edgeKeyForMode,
  parseNodeLabelsInput,
  parseWeightedEdgesInput,
} from "../shared/graph-input.js";
import { setupRunnerControls } from "../shared/tutorial-bootstrap.js";
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
  nodes: ["A", "B", "C", "D", "E", "F"],
  edgesText: `A B 4
A C 2
B C 1
B D 5
C D 8
C E 10
D E 2
D F 6
E F 3`,
};

function formatDistance(value) {
  return Number.isFinite(value) ? String(value) : "inf";
}

function buildGraph(nodes, edges, mode) {
  const adjacency = Array.from({ length: nodes.length }, () => []);

  for (const edge of edges) {
    adjacency[edge.from].push({
      to: edge.to,
      weight: edge.weight,
      edgeId: edge.id,
    });

    if (mode === "undirected") {
      adjacency[edge.to].push({
        to: edge.from,
        weight: edge.weight,
        edgeId: edge.id,
      });
    }
  }

  for (const neighbors of adjacency) {
    neighbors.sort((a, b) => a.to - b.to || a.weight - b.weight);
  }

  return {
    nodes,
    edges,
    adjacency,
    mode,
  };
}

class DijkstraTracer {
  constructor(graph) {
    this.graph = graph;
  }

  createBlankSnapshot(targetIndex = null) {
    const size = this.graph.nodes.length;
    return {
      distances: new Array(size).fill(Infinity),
      previous: new Array(size).fill(null),
      visited: new Array(size).fill(false),
      frontier: [],
      current: null,
      activeEdgeId: null,
      targetIndex,
    };
  }

  #snapshot(distances, previous, visited, frontier, current, activeEdgeId, targetIndex) {
    return {
      distances: [...distances],
      previous: [...previous],
      visited: [...visited],
      frontier: frontier.map((item) => ({
        node: item.node,
        distance: item.distance,
      })),
      current,
      activeEdgeId,
      targetIndex,
    };
  }

  #emit(events, message, line, state, extras = {}) {
    events.push({
      opType: "dijkstra",
      message,
      line,
      snapshot: this.#snapshot(
        state.distances,
        state.previous,
        state.visited,
        state.frontier,
        extras.current ?? null,
        extras.activeEdgeId ?? null,
        state.targetIndex,
      ),
      activeEdgeId: extras.activeEdgeId ?? null,
      current: extras.current ?? null,
      done: extras.done ?? false,
    });
  }

  #buildPathIndices(previous, sourceIndex, targetIndex) {
    const path = [];
    let cursor = targetIndex;

    while (cursor !== null) {
      path.push(cursor);
      if (cursor === sourceIndex) {
        break;
      }
      cursor = previous[cursor];
    }

    if (path[path.length - 1] !== sourceIndex) {
      return null;
    }

    return path.reverse();
  }

  generateRun(sourceIndex, targetIndex = null) {
    const labels = this.graph.nodes;
    const adjacency = this.graph.adjacency;
    const size = labels.length;

    const state = {
      distances: new Array(size).fill(Infinity),
      previous: new Array(size).fill(null),
      visited: new Array(size).fill(false),
      frontier: [],
      targetIndex,
    };
    const events = [];

    state.distances[sourceIndex] = 0;
    state.frontier.push({ node: sourceIndex, distance: 0 });

    this.#emit(
      events,
      `Initialize distances: dist[${labels[sourceIndex]}] = 0, others = inf. Push source.`,
      1,
      state,
      { current: sourceIndex },
    );

    let stoppedEarly = false;

    while (state.frontier.length > 0) {
      state.frontier.sort((a, b) => a.distance - b.distance || a.node - b.node);
      this.#emit(
        events,
        `Priority queue has ${state.frontier.length} candidate(s).`,
        2,
        state,
      );

      const next = state.frontier.shift();
      const u = next.node;
      this.#emit(
        events,
        `Extract min node ${labels[u]} with tentative distance ${formatDistance(next.distance)}.`,
        3,
        state,
        { current: u },
      );

      if (state.visited[u]) {
        this.#emit(events, `${labels[u]} is already settled. Skip stale queue entry.`, 4, state, {
          current: u,
        });
        continue;
      }

      state.visited[u] = true;
      this.#emit(
        events,
        `Settle ${labels[u]}. Shortest distance fixed at ${formatDistance(state.distances[u])}.`,
        4,
        state,
        { current: u },
      );

      if (targetIndex !== null && u === targetIndex) {
        stoppedEarly = true;
        this.#emit(
          events,
          `Target ${labels[targetIndex]} is settled. Stop early.`,
          9,
          state,
          { current: u },
        );
        break;
      }

      for (const edge of adjacency[u]) {
        const v = edge.to;

        this.#emit(
          events,
          `Inspect edge ${labels[u]} -> ${labels[v]} (w=${edge.weight}).`,
          5,
          state,
          { current: u, activeEdgeId: edge.edgeId },
        );

        if (state.visited[v]) {
          this.#emit(
            events,
            `${labels[v]} is already settled. Skip relaxation.`,
            6,
            state,
            { current: u, activeEdgeId: edge.edgeId },
          );
          continue;
        }

        const candidate = state.distances[u] + edge.weight;
        this.#emit(
          events,
          `Candidate distance to ${labels[v]} is ${formatDistance(
            state.distances[u],
          )} + ${edge.weight} = ${formatDistance(candidate)}.`,
          6,
          state,
          { current: u, activeEdgeId: edge.edgeId },
        );

        if (candidate < state.distances[v]) {
          const oldValue = state.distances[v];
          state.distances[v] = candidate;
          state.previous[v] = u;
          state.frontier.push({ node: v, distance: candidate });
          this.#emit(
            events,
            `Improve ${labels[v]}: dist ${formatDistance(oldValue)} -> ${candidate}; prev=${labels[u]}.`,
            8,
            state,
            { current: v, activeEdgeId: edge.edgeId },
          );
        } else {
          this.#emit(
            events,
            `No improvement for ${labels[v]} (current ${formatDistance(state.distances[v])}).`,
            7,
            state,
            { current: u, activeEdgeId: edge.edgeId },
          );
        }
      }
    }

    if (!stoppedEarly && targetIndex !== null && !Number.isFinite(state.distances[targetIndex])) {
      this.#emit(
        events,
        `Queue exhausted. Target ${labels[targetIndex]} is unreachable from ${labels[sourceIndex]}.`,
        9,
        state,
      );
    }

    this.#emit(events, "Dijkstra run complete.", 9, state, { done: true });

    const settledCount = state.visited.filter(Boolean).length;
    let summary = `Run complete from ${labels[sourceIndex]}. Settled ${settledCount}/${size} nodes.`;
    let targetDistance = null;
    let pathLabels = null;
    let success = true;

    if (targetIndex !== null) {
      targetDistance = state.distances[targetIndex];
      const pathIndices = this.#buildPathIndices(state.previous, sourceIndex, targetIndex);
      if (!Number.isFinite(targetDistance) || pathIndices === null) {
        summary = `No path found from ${labels[sourceIndex]} to ${labels[targetIndex]}.`;
        targetDistance = Infinity;
        pathLabels = null;
        success = false;
      } else {
        pathLabels = pathIndices.map((index) => labels[index]);
        summary = `Shortest path ${labels[sourceIndex]} -> ${labels[targetIndex]}: distance ${targetDistance}, path ${pathLabels.join(" -> ")}.`;
      }
    }

    return {
      events,
      targetDistance,
      pathLabels,
      summary,
      success,
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
  graphViewPanel: document.getElementById("graphViewPanel"),
  sourceSelect: document.getElementById("sourceSelect"),
  targetSelect: document.getElementById("targetSelect"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  settledCount: document.getElementById("settledCount"),
  distanceResult: document.getElementById("distanceResult"),
  pathResult: document.getElementById("pathResult"),
  stepCounter: document.getElementById("stepCounter"),
  graphCanvas: document.getElementById("graphCanvas"),
  nodeCards: document.getElementById("nodeCards"),
  frontierStrip: document.getElementById("frontierStrip"),
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
  lastDistance: null,
  lastPathLabels: null,
};
const logger = createLogger(elements.logOutput);
const codeHighlighter = createCodeHighlighter(".code-panel");
let operationRunner = null;

function setAnimationEmphasis(enabled) {
  elements.graphViewPanel.classList.toggle("playing", enabled);
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

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    distances: [...snapshot.distances],
    previous: [...snapshot.previous],
    visited: [...snapshot.visited],
    frontier: snapshot.frontier.map((item) => ({
      node: item.node,
      distance: item.distance,
    })),
    current: snapshot.current,
    activeEdgeId: snapshot.activeEdgeId,
    targetIndex: snapshot.targetIndex,
  };
}

function getSelectedSourceIndex() {
  const value = Number(elements.sourceSelect.value);
  if (!Number.isInteger(value)) {
    return null;
  }
  return value;
}

function getSelectedTargetIndex() {
  const value = elements.targetSelect.value;
  if (value === "") {
    return null;
  }
  const index = Number(value);
  return Number.isInteger(index) ? index : null;
}

function applyModeUi(mode) {
  const isDirected = mode === "directed";
  elements.graphViewPanel.classList.toggle("mode-directed", isDirected);
  elements.graphViewPanel.classList.toggle("mode-undirected", !isDirected);
}

function getPathEdgeIds(snapshot) {
  const pathEdgeIds = new Set();
  if (!state.graph || !snapshot || snapshot.targetIndex === null) {
    return pathEdgeIds;
  }

  const target = snapshot.targetIndex;
  if (!Number.isFinite(snapshot.distances[target])) {
    return pathEdgeIds;
  }

  let cursor = target;
  let guard = 0;
  while (snapshot.previous[cursor] !== null && guard <= state.graph.nodes.length) {
    guard += 1;
    const parent = snapshot.previous[cursor];
    const edge = state.graph.edges.find((candidate) => {
      if (state.mode === "directed") {
        return candidate.from === parent && candidate.to === cursor;
      }
      return (
        (candidate.from === parent && candidate.to === cursor) ||
        (candidate.from === cursor && candidate.to === parent)
      );
    });

    if (edge) {
      pathEdgeIds.add(edge.id);
    }
    cursor = parent;
  }

  return pathEdgeIds;
}


function renderGraphCanvas(snapshot, activeEdgeId = null) {
  elements.graphCanvas.classList.toggle("has-active-edge", activeEdgeId !== null);
  elements.graphCanvas.classList.toggle("has-current-node", snapshot?.current !== null);

  const prepared = prepareGraphCanvas({
    svgElement: elements.graphCanvas,
    fallbackSize: { width: 980, height: 560 },
    hasGraph: Boolean(state.graph),
    emptyMessage: "Load a graph to visualize it.",
  });
  if (!prepared.ready) {
    return;
  }
  const { width, height } = prepared;

  const nodeRadius = state.graph.nodes.length <= 7 ? 26 : 24;
  const positions = computeCircularNodePositions(state.graph.nodes.length, width, height, {
    marginX: state.graph.nodes.length <= 5 ? 86 : 96,
    marginY: state.graph.nodes.length <= 5 ? 96 : 110,
    minRadiusX: 90,
    minRadiusY: 86,
  });
  const pathEdgeIds = getPathEdgeIds(snapshot);
  const drawDirected = state.mode === "directed";

  if (drawDirected) {
    ensureArrowMarker({
      svgElement: elements.graphCanvas,
      id: "graph-arrow",
      markerWidth: 9,
      markerHeight: 9,
      refX: 8,
      refY: 4.5,
      fill: "rgba(57, 89, 121, 0.9)",
    });
  }

  const directedPairs = createDirectedPairSet(state.graph.edges);
  renderGraphEdges({
    svgElement: elements.graphCanvas,
    edges: state.graph.edges,
    positions,
    nodeRadius,
    directed: drawDirected,
    markerId: "graph-arrow",
    activeEdgeId,
    curveOffsetForEdge: (edge) =>
      drawDirected ? getReverseCurveOffset(edge, directedPairs, 22) : 0,
    labelOffset: 12,
    edgeClassFn: (edge) => (pathEdgeIds.has(edge.id) ? ["path"] : []),
    edgeLabelTextFn: (edge) => String(edge.weight),
    edgeLabelWidthFn: (text) => 10 + text.length * 7,
    edgeLabelBgClassFn: (_edge, isActive) =>
      isActive ? ["graph-edge-label-bg", "active"] : "graph-edge-label-bg",
    edgeLabelClassFn: (_edge, isActive) =>
      isActive ? ["graph-edge-label", "active"] : "graph-edge-label",
  });

  const frontierSet = new Set(snapshot?.frontier.map((item) => item.node) ?? []);
  const sourceIndex = getSelectedSourceIndex();
  renderGraphNodes({
    svgElement: elements.graphCanvas,
    nodeCount: state.graph.nodes.length,
    positions,
    nodeClassFn: (index) => [
      frontierSet.has(index) ? "frontier" : "",
      snapshot?.visited[index] ? "visited" : "",
      snapshot?.current === index ? "current" : "",
      snapshot?.targetIndex === index ? "target" : "",
      sourceIndex === index ? "source" : "",
    ],
    renderNodeContent: ({ group, index, position }) => {
      if (snapshot?.current === index) {
        const halo = createSvgElement("circle", {
          class: "graph-current-halo",
          cx: position.x,
          cy: position.y,
          r: nodeRadius + 8,
        });
        group.appendChild(halo);
      }

      const circle = createSvgElement("circle", {
        cx: position.x,
        cy: position.y,
        r: nodeRadius,
      });
      group.appendChild(circle);

      const label = createSvgElement("text", {
        x: position.x,
        y: position.y,
      });
      label.textContent = state.graph.nodes[index];
      group.appendChild(label);

      const distLabel = createSvgElement("text", {
        class: "graph-dist",
        x: position.x,
        y: position.y + 36,
      });
      distLabel.textContent = `d=${formatDistance(snapshot?.distances[index] ?? Infinity)}`;
      group.appendChild(distLabel);
    },
  });
}

function renderFrontier(snapshot) {
  elements.frontierStrip.innerHTML = "";
  if (!snapshot || snapshot.frontier.length === 0) {
    const empty = document.createElement("span");
    empty.className = "frontier-empty";
    empty.textContent = "queue is empty";
    elements.frontierStrip.appendChild(empty);
    return;
  }

  const items = [...snapshot.frontier].sort(
    (a, b) => a.distance - b.distance || a.node - b.node,
  );
  for (const item of items) {
    const pill = document.createElement("span");
    pill.className = "frontier-pill";
    if (snapshot.visited[item.node]) {
      pill.classList.add("stale");
    }
    const label = state.graph.nodes[item.node];
    pill.textContent = `${label}(${formatDistance(item.distance)})`;
    elements.frontierStrip.appendChild(pill);
  }
}

function renderNodes(snapshot) {
  elements.nodeCards.innerHTML = "";
  if (!state.graph || !snapshot) {
    return;
  }

  const frontierSet = new Set(snapshot.frontier.map((item) => item.node));
  for (let i = 0; i < state.graph.nodes.length; i += 1) {
    const card = document.createElement("article");
    card.className = "node-card";

    if (snapshot.visited[i]) {
      card.classList.add("visited");
    }
    if (frontierSet.has(i)) {
      card.classList.add("frontier");
    }
    if (snapshot.current === i) {
      card.classList.add("current");
    }
    if (snapshot.targetIndex === i) {
      card.classList.add("target");
    }

    const status = snapshot.visited[i] ? "settled" : frontierSet.has(i) ? "queued" : "unseen";
    const previous = snapshot.previous[i] === null ? "-" : state.graph.nodes[snapshot.previous[i]];
    const distance = formatDistance(snapshot.distances[i]);

    card.innerHTML = `
      <div class="node-top">
        <span class="node-label">${state.graph.nodes[i]}</span>
        <span class="node-status">${status}</span>
      </div>
      <div class="node-distance">dist: ${distance}</div>
      <div class="node-prev">prev: ${previous}</div>
    `;

    elements.nodeCards.appendChild(card);
  }
}

function renderEdges(activeEdgeId = null) {
  elements.edgeRows.innerHTML = "";
  if (!state.graph) {
    return;
  }

  for (const edge of state.graph.edges) {
    const row = document.createElement("tr");
    if (activeEdgeId !== null && edge.id === activeEdgeId) {
      row.classList.add("active-edge");
    }

    const left = state.graph.nodes[edge.from];
    const right = state.graph.nodes[edge.to];
    const arrow = state.mode === "directed" ? "->" : "<->";

    row.innerHTML = `
      <td>${edge.id}</td>
      <td>${left} ${arrow} ${right}</td>
      <td>${edge.weight}</td>
    `;

    elements.edgeRows.appendChild(row);
  }
}

function clearGraphState() {
  state.graph = null;
  state.tracer = null;
  state.lastDistance = null;
  state.lastPathLabels = null;
  state.lastSnapshot = null;
  renderSnapshot(null, null);
  renderEdges(null);
  clearCodeHighlights();
  updateMetrics();
}

function renderSnapshot(snapshot, activeEdgeId = null) {
  renderGraphCanvas(snapshot, activeEdgeId);
  renderNodes(snapshot);
  renderFrontier(snapshot);
}

function updateMetrics() {
  const totalNodes = state.graph ? state.graph.nodes.length : 0;
  const settled = state.lastSnapshot ? state.lastSnapshot.visited.filter(Boolean).length : 0;
  elements.settledCount.textContent = `${settled} / ${totalNodes}`;

  if (state.lastDistance === null) {
    elements.distanceResult.textContent = "-";
  } else if (Number.isFinite(state.lastDistance)) {
    elements.distanceResult.textContent = String(state.lastDistance);
  } else {
    elements.distanceResult.textContent = "unreachable";
  }

  elements.pathResult.textContent = state.lastPathLabels ? state.lastPathLabels.join(" -> ") : "-";

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  renderSnapshot(state.lastSnapshot, event.activeEdgeId ?? null);
  renderEdges(event.activeEdgeId ?? null);
  highlightCode(event.opType, event.line);
  updateStatus(event.message);
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);
  state.lastDistance = meta.targetSpecified ? meta.targetDistance : null;
  state.lastPathLabels = meta.targetSpecified ? meta.pathLabels : null;

  updateStatus(meta.summary);
  appendLog(meta.summary, meta.success ? "ok" : "");

  renderSnapshot(state.lastSnapshot, null);
  renderEdges(null);
  clearCodeHighlights();
  updateMetrics();
}

function populateSourceAndTargetSelects(nodes) {
  const previousSource = elements.sourceSelect.value;
  const previousTarget = elements.targetSelect.value;

  elements.sourceSelect.innerHTML = "";
  elements.targetSelect.innerHTML = "";

  nodes.forEach((label, index) => {
    const sourceOption = document.createElement("option");
    sourceOption.value = String(index);
    sourceOption.textContent = label;
    elements.sourceSelect.appendChild(sourceOption);
  });

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None (settle all)";
  elements.targetSelect.appendChild(noneOption);

  nodes.forEach((label, index) => {
    const targetOption = document.createElement("option");
    targetOption.value = String(index);
    targetOption.textContent = label;
    elements.targetSelect.appendChild(targetOption);
  });

  const hasSource = nodes.some((_, index) => String(index) === previousSource);
  elements.sourceSelect.value = hasSource ? previousSource : "0";

  const hasTarget = previousTarget === "" || nodes.some((_, index) => String(index) === previousTarget);
  if (hasTarget && previousTarget !== "") {
    elements.targetSelect.value = previousTarget;
  } else if (nodes.length > 1) {
    elements.targetSelect.value = String(nodes.length - 1);
  } else {
    elements.targetSelect.value = "";
  }
}

function loadGraphFromInputs() {
  setAnimationEmphasis(false);
  operationRunner.stop();
  operationRunner.ensureNoPending();

  const nodesParsed = parseNodeLabelsInput(elements.nodesInput.value, {
    maxNodes: 10,
    invalidLabelMessage: (label) =>
      `Invalid node label '${label}'. Use alphanumeric labels starting with a letter.`,
  });
  if (nodesParsed.error) {
    clearGraphState();
    updateStatus(nodesParsed.error);
    appendLog(nodesParsed.error);
    return false;
  }

  const labelToIndex = createLabelToIndex(nodesParsed.nodes);
  const edgesParsed = parseWeightedEdgesInput(elements.edgesInput.value, {
    labelToIndex,
    mode: state.mode,
    lineFormatMessage: (lineNumber) =>
      `Edge line ${lineNumber} is invalid. Format must be: FROM TO WEIGHT`,
    requirePositiveInteger: true,
    duplicateEdgeMessage: (lineNumber, fromLabel, toLabel, mode) =>
      `Edge line ${lineNumber}: duplicate edge '${fromLabel} ${toLabel}' for ${mode} mode.`,
    selfLoopMessage: (lineNumber) => `Edge line ${lineNumber}: self-loops are not allowed.`,
  });
  if (edgesParsed.error) {
    clearGraphState();
    updateStatus(edgesParsed.error);
    appendLog(edgesParsed.error);
    return false;
  }

  state.graph = buildGraph(nodesParsed.nodes, edgesParsed.edges, state.mode);
  state.tracer = new DijkstraTracer(state.graph);

  populateSourceAndTargetSelects(state.graph.nodes);

  state.lastDistance = null;
  state.lastPathLabels = null;
  state.lastSnapshot = state.tracer.createBlankSnapshot(getSelectedTargetIndex());

  renderSnapshot(state.lastSnapshot, null);
  renderEdges(null);
  focusCodePanel("dijkstra");
  clearCodeHighlights();
  updateMetrics();

  const message = `Loaded ${state.graph.nodes.length} nodes and ${state.graph.edges.length} edges in ${state.mode} mode.`;
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

function generateRandomGraph(mode) {
  const size = 5 + Math.floor(Math.random() * 3);
  const labels = [];
  for (let i = 0; i < size; i += 1) {
    labels.push(String.fromCharCode(65 + i));
  }

  const edges = [];
  const seen = new Set();
  const targetCount = size - 1 + (size + Math.floor(Math.random() * size));

  const tryAddEdge = (from, to) => {
    if (from === to) {
      return false;
    }
    const key = edgeKeyForMode(mode, from, to);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    edges.push({
      from,
      to,
      weight: 1 + Math.floor(Math.random() * 14),
    });
    return true;
  };

  for (let i = 1; i < size; i += 1) {
    const parent = Math.floor(Math.random() * i);
    if (mode === "directed") {
      tryAddEdge(parent, i);
    } else {
      tryAddEdge(parent, i);
    }
  }

  let guard = 0;
  while (edges.length < targetCount && guard < 400) {
    guard += 1;
    const from = Math.floor(Math.random() * size);
    const to = Math.floor(Math.random() * size);
    tryAddEdge(from, to);
  }

  const edgeLines = edges.map((edge) => `${labels[edge.from]} ${labels[edge.to]} ${edge.weight}`);
  return { nodes: labels, edgeLines };
}

function loadSampleGraph() {
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

function syncTargetInSnapshot() {
  if (!state.lastSnapshot) {
    return;
  }
  state.lastSnapshot.targetIndex = getSelectedTargetIndex();
  renderSnapshot(state.lastSnapshot, null);
  updateMetrics();
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

  const targetIndex = getSelectedTargetIndex();
  if (targetIndex !== null && (targetIndex < 0 || targetIndex >= state.graph.nodes.length)) {
    const message = "Choose a valid target node.";
    updateStatus(message);
    appendLog(message);
    return null;
  }

  const trace = state.tracer.generateRun(sourceIndex, targetIndex);
  return {
    opType: "dijkstra",
    events: trace.events,
    targetSpecified: targetIndex !== null,
    targetDistance: trace.targetDistance,
    pathLabels: trace.pathLabels,
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
      appendLog(`Prepared ${operation.opType} with ${operation.events.length} trace steps.`);
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
  elements.targetSelect.addEventListener("change", syncTargetInSnapshot);
  elements.sourceSelect.addEventListener("change", () => {
    updateStatus(`Source set to ${elements.sourceSelect.options[elements.sourceSelect.selectedIndex]?.text ?? "-"}.`);
  });

  setupRunnerControls({
    elements,
    runAnimated: runAnimatedOperation,
    runStep: runStepOperation,
    runInstant: runInstantOperation,
    runFinish: finishCurrentOperation,
    getSpeedMs: () => state.speedMs,
    setSpeedMs: (speedMs) => {
      state.speedMs = speedMs;
    },
    clearLog: () => logger.clear(),
    extraShortcuts: {
      l: () => loadGraphFromInputs(),
      m: () => loadSampleGraph(),
      r: () => loadRandomGraph(),
      u: () => applyModeAndReload("undirected"),
      d: () => applyModeAndReload("directed"),
    },
  });

  focusCodePanel("dijkstra");
  applyModeUi(state.mode);
  loadSampleGraph();
}

init();
