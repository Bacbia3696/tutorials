import {
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
import {
  createLabelToIndex,
  parseDirectedEdgesInput,
  parseNodeLabelsInput,
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

const SAMPLE_DAG = {
  nodes: ["A", "B", "C", "D", "E", "F", "G", "H"],
  edgesText: `A C
A D
B D
B E
C F
D F
D G
E G
F H
G H`,
};


function buildGraph(nodes, edges) {
  const adjacency = Array.from({ length: nodes.length }, () => []);
  const baseIndegree = new Array(nodes.length).fill(0);

  for (const edge of edges) {
    adjacency[edge.from].push(edge);
    baseIndegree[edge.to] += 1;
  }

  for (const list of adjacency) {
    list.sort((a, b) => a.to - b.to || a.id - b.id);
  }

  return {
    nodes,
    edges,
    adjacency,
    baseIndegree,
  };
}

class TopologicalTracer {
  constructor(graph) {
    this.graph = graph;
  }

  createInitialSnapshot() {
    const queue = [];
    for (let i = 0; i < this.graph.nodes.length; i += 1) {
      if (this.graph.baseIndegree[i] === 0) {
        queue.push(i);
      }
    }

    return {
      indegree: [...this.graph.baseIndegree],
      queue,
      order: [],
      processed: new Array(this.graph.nodes.length).fill(false),
      currentNode: null,
      activeEdgeId: null,
      cycleDetected: false,
    };
  }

  #snapshot(state, extras = {}) {
    return {
      indegree: [...state.indegree],
      queue: [...state.queue],
      order: [...state.order],
      processed: [...state.processed],
      currentNode: extras.currentNode ?? null,
      activeEdgeId: extras.activeEdgeId ?? null,
      cycleDetected: state.cycleDetected,
    };
  }

  #emit(events, message, line, state, extras = {}) {
    events.push({
      opType: "topo",
      message,
      line,
      snapshot: this.#snapshot(state, extras),
      activeEdgeId: extras.activeEdgeId ?? null,
    });
  }

  generateRun() {
    const labels = this.graph.nodes;
    const state = this.createInitialSnapshot();
    const events = [];

    const queueLabels = state.queue.map((index) => labels[index]).join(", ") || "empty";
    this.#emit(events, `Initialize indegrees and queue: [${queueLabels}].`, 1, state);

    while (state.queue.length > 0) {
      this.#emit(events, `Queue has ${state.queue.length} node(s).`, 2, state);

      const node = state.queue.shift();
      this.#emit(events, `Pop ${labels[node]} from queue.`, 3, state, {
        currentNode: node,
      });

      state.processed[node] = true;
      state.order.push(node);
      this.#emit(events, `Append ${labels[node]} to topological order.`, 4, state, {
        currentNode: node,
      });

      for (const edge of this.graph.adjacency[node]) {
        this.#emit(
          events,
          `Inspect edge ${labels[edge.from]} -> ${labels[edge.to]}.`,
          5,
          state,
          {
            currentNode: node,
            activeEdgeId: edge.id,
          },
        );

        state.indegree[edge.to] -= 1;
        this.#emit(
          events,
          `Decrease indegree[${labels[edge.to]}] to ${state.indegree[edge.to]}.`,
          6,
          state,
          {
            currentNode: node,
            activeEdgeId: edge.id,
          },
        );

        if (state.indegree[edge.to] === 0) {
          state.queue.push(edge.to);
          this.#emit(
            events,
            `${labels[edge.to]} now has indegree 0; enqueue it.`,
            7,
            state,
            {
              currentNode: edge.to,
              activeEdgeId: edge.id,
            },
          );
        }
      }
    }

    let cycleDetected = false;
    if (state.order.length < this.graph.nodes.length) {
      cycleDetected = true;
      state.cycleDetected = true;
      const remaining = labels.filter((_, index) => !state.processed[index]).join(", ");
      this.#emit(
        events,
        `Queue is empty but nodes remain (${remaining}). Cycle detected.`,
        8,
        state,
      );
    } else {
      this.#emit(
        events,
        `Topological order complete: ${state.order.map((index) => labels[index]).join(" -> ")}.`,
        9,
        state,
      );
    }

    const orderLabels = state.order.map((index) => labels[index]);
    const summary = cycleDetected
      ? "Graph contains a cycle. Topological ordering is not possible."
      : `Topological sort complete: ${orderLabels.join(" -> ")}.`;

    this.#emit(events, summary, cycleDetected ? 8 : 9, state);

    return {
      events,
      cycleDetected,
      processedCount: state.order.length,
      orderLabels,
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
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  processedMetric: document.getElementById("processedMetric"),
  orderMetric: document.getElementById("orderMetric"),
  cycleMetric: document.getElementById("cycleMetric"),
  stepCounter: document.getElementById("stepCounter"),
  processViewPanel: document.querySelector(".process-view"),
  graphCanvas: document.getElementById("graphCanvas"),
  queueStrip: document.getElementById("queueStrip"),
  orderStrip: document.getElementById("orderStrip"),
  nodeCards: document.getElementById("nodeCards"),
  edgeRows: document.getElementById("edgeRows"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
};

const state = {
  graph: null,
  tracer: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastCycleDetected: false,
  lastProcessedCount: 0,
  lastOrderLabels: [],
};
const logger = createLogger(elements.logOutput);
const codeHighlighter = createCodeHighlighter(".code-panel");
let operationRunner = null;

function updateStatus(message) {
  elements.statusMessage.textContent = message;
}

function setAnimationEmphasis(enabled) {
  elements.processViewPanel?.classList.toggle("playing", enabled);
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
    indegree: [...snapshot.indegree],
    queue: [...snapshot.queue],
    order: [...snapshot.order],
    processed: [...snapshot.processed],
    currentNode: snapshot.currentNode,
    activeEdgeId: snapshot.activeEdgeId,
    cycleDetected: snapshot.cycleDetected,
  };
}

function renderGraphCanvas(snapshot, activeEdgeId = null) {
  const prepared = prepareGraphCanvas({
    svgElement: elements.graphCanvas,
    fallbackSize: { width: 920, height: 520 },
    hasGraph: Boolean(state.graph),
    emptyMessage: "Load a graph to visualize it.",
  });
  if (!prepared.ready) {
    return;
  }
  const { width, height } = prepared;

  ensureArrowMarker({
    svgElement: elements.graphCanvas,
    id: "topo-arrow",
    markerWidth: 8,
    markerHeight: 8,
    refX: 7.1,
    refY: 4,
    fill: "rgba(59, 101, 129, 0.9)",
  });

  const points = computeCircularNodePositions(state.graph.nodes.length, width, height, {
    marginX: 95,
    marginY: 88,
    minRadiusX: 95,
    minRadiusY: 88,
  });
  const directedPairs = createDirectedPairSet(state.graph.edges);
  renderGraphEdges({
    svgElement: elements.graphCanvas,
    edges: state.graph.edges,
    positions: points,
    nodeRadius: 20,
    directed: true,
    markerId: "topo-arrow",
    activeEdgeId,
    curveOffsetForEdge: (edge) => getReverseCurveOffset(edge, directedPairs, 18),
    labelOffset: 10,
    edgeLabelTextFn: (edge) => String(edge.id),
    edgeLabelWidthFn: (text) => 10 + text.length * 6,
    edgeLabelVerticalOffset: 0.4,
  });

  const queued = new Set(snapshot?.queue ?? []);
  renderGraphNodes({
    svgElement: elements.graphCanvas,
    nodeCount: state.graph.nodes.length,
    positions: points,
    nodeClassFn: (index) => [
      snapshot?.processed[index] ? "processed" : "",
      queued.has(index) ? "queued" : "",
      snapshot?.currentNode === index ? "current" : "",
      snapshot?.cycleDetected && !snapshot?.processed[index] ? "cycle" : "",
    ],
    renderNodeContent: ({ group, index, position }) => {
      if (snapshot?.currentNode === index) {
        const halo = createSvgElement("circle", {
          class: "graph-current-halo",
          cx: position.x,
          cy: position.y,
          r: 28,
        });
        group.appendChild(halo);
      }

      const circle = createSvgElement("circle", {
        cx: position.x,
        cy: position.y,
        r: 20,
      });
      group.appendChild(circle);

      const label = createSvgElement("text", {
        class: "label",
        x: position.x,
        y: position.y - 1,
      });
      label.textContent = state.graph.nodes[index];
      group.appendChild(label);

      const indegree = createSvgElement("text", {
        class: "indegree",
        x: position.x,
        y: position.y + 30,
      });
      indegree.textContent = `in=${snapshot?.indegree[index] ?? state.graph.baseIndegree[index]}`;
      group.appendChild(indegree);
    },
  });
}

function renderQueue(snapshot) {
  elements.queueStrip.innerHTML = "";
  if (!state.graph || !snapshot || snapshot.queue.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-pill";
    empty.textContent = "queue is empty";
    elements.queueStrip.appendChild(empty);
    return;
  }

  for (const node of snapshot.queue) {
    const pill = document.createElement("span");
    pill.className = "queue-pill";
    pill.textContent = state.graph.nodes[node];
    elements.queueStrip.appendChild(pill);
  }
}

function renderOrder(snapshot) {
  elements.orderStrip.innerHTML = "";
  if (!state.graph || !snapshot || snapshot.order.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-pill";
    empty.textContent = "order not built yet";
    elements.orderStrip.appendChild(empty);
    return;
  }

  snapshot.order.forEach((node, index) => {
    const pill = document.createElement("span");
    pill.className = "order-pill";
    pill.textContent = `${index + 1}:${state.graph.nodes[node]}`;
    elements.orderStrip.appendChild(pill);
  });
}

function renderNodes(snapshot) {
  elements.nodeCards.innerHTML = "";
  if (!state.graph || !snapshot) {
    return;
  }

  const queued = new Set(snapshot.queue);
  for (let i = 0; i < state.graph.nodes.length; i += 1) {
    const card = document.createElement("article");
    card.className = "node-card";

    if (snapshot.processed[i]) {
      card.classList.add("processed");
    }
    if (queued.has(i)) {
      card.classList.add("queued");
    }
    if (snapshot.currentNode === i) {
      card.classList.add("current");
    }

    let stateLabel = "waiting";
    if (snapshot.processed[i]) {
      stateLabel = "done";
    } else if (queued.has(i)) {
      stateLabel = "queued";
    } else if (snapshot.indegree[i] === 0) {
      stateLabel = "ready";
    }

    card.innerHTML = `
      <div class="node-head">
        <span class="node-label">${state.graph.nodes[i]}</span>
        <span class="node-state">${stateLabel}</span>
      </div>
      <div class="node-degree">in-degree: ${snapshot.indegree[i]}</div>
      <div class="node-note">processed: ${snapshot.processed[i] ? "yes" : "no"}</div>
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

    row.innerHTML = `
      <td>${edge.id}</td>
      <td>${state.graph.nodes[edge.from]} -> ${state.graph.nodes[edge.to]}</td>
    `;

    elements.edgeRows.appendChild(row);
  }
}

function renderSnapshot(snapshot, activeEdgeId = null) {
  renderGraphCanvas(snapshot, activeEdgeId);
  renderQueue(snapshot);
  renderOrder(snapshot);
  renderNodes(snapshot);
  renderEdges(activeEdgeId);
}

function updateMetrics() {
  const totalNodes = state.graph ? state.graph.nodes.length : 0;
  elements.processedMetric.textContent = `${state.lastProcessedCount} / ${totalNodes}`;
  elements.orderMetric.textContent = String(state.lastOrderLabels.length);
  elements.cycleMetric.textContent = state.lastCycleDetected ? "Yes" : "No";

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  state.lastCycleDetected = event.snapshot.cycleDetected;
  state.lastProcessedCount = event.snapshot.order.length;
  state.lastOrderLabels = event.snapshot.order.map((index) => state.graph.nodes[index]);

  renderSnapshot(state.lastSnapshot, event.activeEdgeId ?? null);
  highlightCode(event.opType, event.line);
  updateStatus(event.message);
  updateMetrics();
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);
  state.lastCycleDetected = meta.cycleDetected;
  state.lastProcessedCount = meta.processedCount;
  state.lastOrderLabels = meta.orderLabels;

  updateStatus(meta.summary);
  appendLog(meta.summary, meta.success ? "ok" : "");

  renderSnapshot(state.lastSnapshot, null);
  clearCodeHighlights();
  updateMetrics();
}

function loadGraphFromInputs() {
  setAnimationEmphasis(false);
  operationRunner.stop();
  operationRunner.ensureNoPending();

  const parsedNodes = parseNodeLabelsInput(elements.nodesInput.value, {
    maxNodes: 12,
  });
  if (parsedNodes.error) {
    updateStatus(parsedNodes.error);
    appendLog(parsedNodes.error);
    return;
  }

  const labelToIndex = createLabelToIndex(parsedNodes.nodes);
  const parsedEdges = parseDirectedEdgesInput(elements.edgesInput.value, {
    labelToIndex,
    lineFormatMessage: (lineNumber) => `Edge line ${lineNumber} is invalid. Use: FROM TO`,
    allowSelfLoops: true,
  });
  if (parsedEdges.error) {
    updateStatus(parsedEdges.error);
    appendLog(parsedEdges.error);
    return;
  }

  state.graph = buildGraph(parsedNodes.nodes, parsedEdges.edges);
  state.tracer = new TopologicalTracer(state.graph);

  state.lastCycleDetected = false;
  state.lastProcessedCount = 0;
  state.lastOrderLabels = [];
  state.lastSnapshot = state.tracer.createInitialSnapshot();

  renderSnapshot(state.lastSnapshot, null);
  focusCodePanel("topo");
  clearCodeHighlights();
  updateMetrics();

  const message = `Loaded ${state.graph.nodes.length} nodes and ${state.graph.edges.length} directed edges.`;
  updateStatus(message);
  appendLog(message, "ok");
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateRandomGraph() {
  const size = 5 + Math.floor(Math.random() * 4);
  const nodes = [];
  for (let i = 0; i < size; i += 1) {
    nodes.push(String.fromCharCode(65 + i));
  }

  const permutation = shuffle([...Array(size).keys()]);
  const edges = [];
  const seen = new Set();

  const addEdge = (from, to) => {
    const key = `${from}->${to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    edges.push({ from, to });
    return true;
  };

  for (let i = 0; i < size - 1; i += 1) {
    addEdge(permutation[i], permutation[i + 1]);
  }

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      if (Math.random() < 0.28) {
        addEdge(permutation[i], permutation[j]);
      }
    }
  }

  if (size >= 4 && Math.random() < 0.35) {
    const late = 2 + Math.floor(Math.random() * (size - 2));
    const early = Math.floor(Math.random() * late);
    addEdge(permutation[late], permutation[early]);
  }

  return {
    nodes,
    edgeLines: edges.map((edge) => `${nodes[edge.from]} ${nodes[edge.to]}`),
  };
}

function loadSampleGraph() {
  elements.nodesInput.value = SAMPLE_DAG.nodes.join(", ");
  elements.edgesInput.value = SAMPLE_DAG.edgesText;
  loadGraphFromInputs();
}

function loadRandomGraph() {
  const random = generateRandomGraph();
  elements.nodesInput.value = random.nodes.join(", ");
  elements.edgesInput.value = random.edgeLines.join("\n");
  loadGraphFromInputs();
}

function prepareOperation() {
  if (!state.tracer || !state.graph) {
    updateStatus("Load a graph first.");
    return null;
  }

  const trace = state.tracer.generateRun();
  return {
    opType: "topo",
    events: trace.events,
    cycleDetected: trace.cycleDetected,
    processedCount: trace.processedCount,
    orderLabels: trace.orderLabels,
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
    },
  });

  focusCodePanel("topo");
  loadSampleGraph();
}

init();
