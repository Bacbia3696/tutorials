import { createOperationRunner } from '../shared/tutorial-core.js';
import {
  createLabelToIndex,
  edgeKeyForMode,
  normalizeGraphLabel,
  parseNodeLabelsInput,
} from '../shared/graph-input.js';
import { setupRunnerControls } from '../shared/tutorial-bootstrap.js';
import { computeCircularNodePositions, createSvgElement } from '../shared/graph-core.js';
import {
  prepareGraphCanvas,
  renderGraphEdges,
  renderGraphNodes,
} from '../shared/graph-renderer.js';
import { createRuntimeHelpers } from '../shared/runtime-helpers.js';

const SAMPLE_GRAPH = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edgesText: `A B
B C
C D
D E
E F
F C
C A`,
};

function otherEndpoint(edge, nodeIndex) {
  return edge.from === nodeIndex ? edge.to : edge.from;
}

function parseUndirectedEdgesInput(
  text,
  {
    labelToIndex,
    lineFormatMessage = (lineNumber) =>
      `Edge line ${lineNumber} is invalid. Format must be: FROM TO.`,
    unknownNodeMessage = (lineNumber, label) => `Edge line ${lineNumber}: unknown node '${label}'.`,
    selfLoopMessage = (lineNumber) => `Edge line ${lineNumber}: self-loops are not allowed.`,
    duplicateEdgeMessage = (lineNumber, fromLabel, toLabel) =>
      `Edge line ${lineNumber}: duplicate undirected edge '${fromLabel} ${toLabel}'.`,
  } = {},
) {
  if (!(labelToIndex instanceof Map)) {
    return { error: 'Internal error: labelToIndex map is required.' };
  }

  const lines = String(text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) {
    return { error: 'Please provide at least one edge line.' };
  }

  const seen = new Set();
  const edges = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const parts = lines[i].split(/[\s,]+/).filter((token) => token.length > 0);
    if (parts.length !== 2) {
      return { error: lineFormatMessage(lineNumber) };
    }

    const fromLabel = normalizeGraphLabel(parts[0]);
    const toLabel = normalizeGraphLabel(parts[1]);

    if (!labelToIndex.has(fromLabel)) {
      return { error: unknownNodeMessage(lineNumber, fromLabel) };
    }
    if (!labelToIndex.has(toLabel)) {
      return { error: unknownNodeMessage(lineNumber, toLabel) };
    }

    const from = labelToIndex.get(fromLabel);
    const to = labelToIndex.get(toLabel);

    if (from === to) {
      return { error: selfLoopMessage(lineNumber, fromLabel) };
    }

    const key = edgeKeyForMode('undirected', from, to);
    if (seen.has(key)) {
      return { error: duplicateEdgeMessage(lineNumber, fromLabel, toLabel) };
    }

    seen.add(key);
    edges.push({
      id: edges.length + 1,
      from,
      to,
    });
  }

  return { edges };
}

function buildGraph(nodes, edges) {
  const adjacency = Array.from({ length: nodes.length }, () => []);
  const edgeById = new Map();

  for (const edge of edges) {
    edgeById.set(edge.id, edge);
    adjacency[edge.from].push(edge.id);
    adjacency[edge.to].push(edge.id);
  }

  for (const incident of adjacency) {
    incident.sort((a, b) => a - b);
  }

  const degree = adjacency.map((incident) => incident.length);

  return {
    nodes,
    edges,
    adjacency,
    edgeById,
    degree,
  };
}

function edgeStatusForSnapshot(snapshot, edgeId) {
  if (!snapshot) {
    return 'unused';
  }

  const used = new Set(snapshot.usedEdgeIds);
  return used.has(edgeId) ? 'used' : 'unused';
}

function computeParityLabel(degree) {
  return degree % 2 === 0 ? 'even' : 'odd';
}

class EulerianPathTracer {
  constructor(graph) {
    this.graph = graph;
  }

  createBlankSnapshot() {
    const oddNodes = this.graph.degree
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value % 2 === 1)
      .map((entry) => entry.index);

    return {
      degrees: [...this.graph.degree],
      oddNodes,
      connected: null,
      hasEulerPath: null,
      startNode: null,
      stack: [],
      pathBacktrack: [],
      usedEdgeIds: [],
      activeEdgeId: null,
      currentNode: null,
    };
  }

  #snapshot(state, extras = {}) {
    const oddNodes = [...state.oddNodes].sort((a, b) => a - b);
    const usedEdgeIds =
      state.usedEdgeIds instanceof Set
        ? [...state.usedEdgeIds].sort((a, b) => a - b)
        : [...state.usedEdgeIds].sort((a, b) => a - b);

    return {
      degrees: [...state.degrees],
      oddNodes,
      connected: extras.connected ?? state.connected ?? null,
      hasEulerPath: extras.hasEulerPath ?? state.hasEulerPath ?? null,
      startNode: extras.startNode ?? state.startNode ?? null,
      stack: [...state.stack],
      pathBacktrack: [...state.pathBacktrack],
      usedEdgeIds,
      activeEdgeId: extras.activeEdgeId ?? state.activeEdgeId ?? null,
      currentNode: extras.currentNode ?? state.currentNode ?? null,
    };
  }

  #emit(events, message, line, state, extras = {}) {
    const snapshot = this.#snapshot(state, extras);
    events.push({
      opType: 'eulerian',
      message,
      line,
      snapshot,
      activeEdgeId: snapshot.activeEdgeId,
    });
  }

  #findUnusedEdge(nodeIndex, usedEdgeIds) {
    const incident = this.graph.adjacency[nodeIndex] ?? [];
    for (const edgeId of incident) {
      if (!usedEdgeIds.has(edgeId)) {
        return this.graph.edgeById.get(edgeId) ?? null;
      }
    }
    return null;
  }

  #checkConnectivity(activeVertices) {
    if (activeVertices.length <= 1) {
      return true;
    }

    const start = activeVertices[0];
    const queue = [start];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const node = queue.shift();
      const incident = this.graph.adjacency[node] ?? [];

      for (const edgeId of incident) {
        const edge = this.graph.edgeById.get(edgeId);
        if (!edge) {
          continue;
        }
        const next = otherEndpoint(edge, node);
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        queue.push(next);
      }
    }

    return activeVertices.every((vertex) => visited.has(vertex));
  }

  generateRun() {
    const labels = this.graph.nodes;
    const oddNodes = this.graph.degree
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value % 2 === 1)
      .map((entry) => entry.index);

    const state = {
      degrees: [...this.graph.degree],
      oddNodes,
      connected: null,
      hasEulerPath: null,
      startNode: null,
      stack: [],
      pathBacktrack: [],
      usedEdgeIds: new Set(),
      activeEdgeId: null,
      currentNode: null,
    };
    const events = [];

    const oddLabels = oddNodes.map((index) => labels[index]).join(', ') || 'none';
    this.#emit(events, `Compute degrees. Odd-degree vertices: ${oddLabels}.`, 1, state);

    const activeVertices = state.degrees
      .map((degree, index) => ({ degree, index }))
      .filter((entry) => entry.degree > 0)
      .map((entry) => entry.index);

    const connected = this.#checkConnectivity(activeVertices);
    state.connected = connected;
    this.#emit(
      events,
      connected
        ? 'All non-zero-degree vertices are connected.'
        : 'Non-zero-degree vertices are disconnected.',
      2,
      state,
    );

    const oddCount = oddNodes.length;
    const validOddCount = oddCount === 0 || oddCount === 2;

    if (!connected || !validOddCount) {
      state.hasEulerPath = false;
      const reasons = [];
      if (!connected) {
        reasons.push('graph is disconnected on non-zero-degree vertices');
      }
      if (!validOddCount) {
        reasons.push(`odd-degree count is ${oddCount} (must be 0 or 2)`);
      }

      const summary = `No Eulerian path: ${reasons.join('; ')}.`;
      this.#emit(events, summary, 3, state);
      return {
        events,
        hasEulerPath: false,
        pathLabels: null,
        summary,
        success: false,
      };
    }

    state.hasEulerPath = true;

    const startNode =
      oddCount === 2 ? oddNodes[0] : activeVertices.length > 0 ? activeVertices[0] : 0;

    state.startNode = startNode;
    state.currentNode = startNode;
    this.#emit(events, `Choose start vertex ${labels[startNode]}.`, 4, state);

    state.stack.push(startNode);
    this.#emit(events, `Initialize stack with ${labels[startNode]}.`, 5, state);

    while (state.stack.length > 0) {
      const node = state.stack[state.stack.length - 1];
      state.currentNode = node;

      const nextEdge = this.#findUnusedEdge(node, state.usedEdgeIds);
      if (nextEdge) {
        const nextNode = otherEndpoint(nextEdge, node);
        state.usedEdgeIds.add(nextEdge.id);
        state.activeEdgeId = nextEdge.id;
        state.stack.push(nextNode);
        state.currentNode = nextNode;

        this.#emit(
          events,
          `Traverse edge ${labels[nextEdge.from]}-${labels[nextEdge.to]}: push ${labels[nextNode]}.`,
          7,
          state,
          { activeEdgeId: nextEdge.id, currentNode: nextNode },
        );
      } else {
        const popped = state.stack.pop();
        state.pathBacktrack.push(popped);
        state.activeEdgeId = null;
        state.currentNode = state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;

        this.#emit(
          events,
          `No unused edge from ${labels[popped]}. Pop and append to path.`,
          8,
          state,
        );
      }
    }

    const finalPathIndices = [...state.pathBacktrack].reverse();
    const pathLabels = finalPathIndices.map((index) => labels[index]);

    if (finalPathIndices.length !== this.graph.edges.length + 1) {
      state.hasEulerPath = false;
      const summary = `Traversal ended with ${finalPathIndices.length} vertices, expected ${this.graph.edges.length + 1}. No Eulerian path.`;
      this.#emit(events, summary, 9, state, { hasEulerPath: false });

      return {
        events,
        hasEulerPath: false,
        pathLabels: null,
        summary,
        success: false,
      };
    }

    const summary = `Eulerian path found: ${pathLabels.join(' -> ')}.`;
    this.#emit(events, summary, 9, state, { hasEulerPath: true });

    return {
      events,
      hasEulerPath: true,
      pathLabels,
      summary,
      success: true,
    };
  }
}

const elements = {
  nodesInput: document.getElementById('nodesInput'),
  edgesInput: document.getElementById('edgesInput'),
  loadGraphBtn: document.getElementById('loadGraphBtn'),
  sampleGraphBtn: document.getElementById('sampleGraphBtn'),
  randomGraphBtn: document.getElementById('randomGraphBtn'),
  animateBtn: document.getElementById('animateBtn'),
  stepBtn: document.getElementById('stepBtn'),
  instantBtn: document.getElementById('instantBtn'),
  finishBtn: document.getElementById('finishBtn'),
  speedRange: document.getElementById('speedRange'),
  speedLabel: document.getElementById('speedLabel'),
  statusMessage: document.getElementById('statusMessage'),
  oddMetric: document.getElementById('oddMetric'),
  usedMetric: document.getElementById('usedMetric'),
  resultMetric: document.getElementById('resultMetric'),
  pathMetric: document.getElementById('pathMetric'),
  stepCounter: document.getElementById('stepCounter'),
  graphViewPanel: document.getElementById('graphViewPanel'),
  graphCanvas: document.getElementById('graphCanvas'),
  stackStrip: document.getElementById('stackStrip'),
  pathStrip: document.getElementById('pathStrip'),
  nodeCards: document.getElementById('nodeCards'),
  edgeRows: document.getElementById('edgeRows'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  logOutput: document.getElementById('logOutput'),
};

const state = {
  graph: null,
  tracer: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastHasEulerPath: null,
  lastPathLabels: null,
};
const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});
let operationRunner = null;

function setAnimationEmphasis(enabled) {
  elements.graphViewPanel.classList.toggle('playing', enabled);
}

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    degrees: [...snapshot.degrees],
    oddNodes: [...snapshot.oddNodes],
    connected: snapshot.connected,
    hasEulerPath: snapshot.hasEulerPath,
    startNode: snapshot.startNode,
    stack: [...snapshot.stack],
    pathBacktrack: [...snapshot.pathBacktrack],
    usedEdgeIds: [...snapshot.usedEdgeIds],
    activeEdgeId: snapshot.activeEdgeId,
    currentNode: snapshot.currentNode,
  };
}

function renderGraphCanvas(snapshot, activeEdgeId = null) {
  elements.graphCanvas.classList.toggle('has-active-edge', activeEdgeId !== null);

  const prepared = prepareGraphCanvas({
    svgElement: elements.graphCanvas,
    fallbackSize: { width: 980, height: 560 },
    hasGraph: Boolean(state.graph),
    emptyMessage: 'Load a graph to visualize Eulerian traversal.',
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

  renderGraphEdges({
    svgElement: elements.graphCanvas,
    edges: state.graph.edges,
    positions,
    nodeRadius,
    directed: false,
    activeEdgeId,
    labelOffset: 12,
    edgeClassFn: (edge) => edgeStatusForSnapshot(snapshot, edge.id),
    edgeLabelTextFn: (edge) => `#${edge.id}`,
    edgeLabelWidthFn: (text) => 12 + text.length * 7,
    edgeLabelBgClassFn: (_edge, isActive) =>
      isActive ? ['graph-edge-label-bg', 'active'] : 'graph-edge-label-bg',
    edgeLabelClassFn: (_edge, isActive) =>
      isActive ? ['graph-edge-label', 'active'] : 'graph-edge-label',
  });

  const oddSet = new Set(snapshot?.oddNodes ?? []);
  const stackSet = new Set(snapshot?.stack ?? []);

  renderGraphNodes({
    svgElement: elements.graphCanvas,
    nodeCount: state.graph.nodes.length,
    positions,
    nodeClassFn: (index) => [
      oddSet.has(index) ? 'odd' : '',
      snapshot?.currentNode === index ? 'current' : '',
      snapshot?.startNode === index ? 'start' : '',
      stackSet.has(index) ? 'stacked' : '',
    ],
    renderNodeContent: ({ group, index, position }) => {
      if (snapshot?.currentNode === index) {
        const halo = createSvgElement('circle', {
          class: 'graph-current-halo',
          cx: position.x,
          cy: position.y,
          r: nodeRadius + 8,
        });
        group.appendChild(halo);
      }

      const circle = createSvgElement('circle', {
        cx: position.x,
        cy: position.y,
        r: nodeRadius,
      });
      group.appendChild(circle);

      const label = createSvgElement('text', {
        x: position.x,
        y: position.y,
      });
      label.textContent = state.graph.nodes[index];
      group.appendChild(label);

      const degreeLabel = createSvgElement('text', {
        class: 'graph-degree',
        x: position.x,
        y: position.y + 35,
      });
      degreeLabel.textContent = `deg=${snapshot?.degrees[index] ?? state.graph.degree[index]}`;
      group.appendChild(degreeLabel);
    },
  });
}

function renderStrip(stripElement, nodes, emptyText, emphasizeLast = false) {
  stripElement.innerHTML = '';

  if (!state.graph || nodes.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'strip-empty';
    empty.textContent = emptyText;
    stripElement.appendChild(empty);
    return;
  }

  nodes.forEach((nodeIndex, index) => {
    const pill = document.createElement('span');
    pill.className = 'strip-pill';
    if (emphasizeLast && index === nodes.length - 1) {
      pill.classList.add('top');
    }
    pill.textContent = state.graph.nodes[nodeIndex];
    stripElement.appendChild(pill);
  });
}

function renderNodes(snapshot) {
  elements.nodeCards.innerHTML = '';

  if (!state.graph || !snapshot) {
    return;
  }

  const oddSet = new Set(snapshot.oddNodes);
  const stackSet = new Set(snapshot.stack);

  for (let i = 0; i < state.graph.nodes.length; i += 1) {
    const card = document.createElement('article');
    card.className = 'node-card';

    if (oddSet.has(i)) {
      card.classList.add('odd');
    }
    if (snapshot.startNode === i) {
      card.classList.add('start');
    }
    if (snapshot.currentNode === i) {
      card.classList.add('current');
    }
    if (stackSet.has(i)) {
      card.classList.add('stacked');
    }

    const onStack = stackSet.has(i) ? 'yes' : 'no';
    const parity = computeParityLabel(snapshot.degrees[i]);

    card.innerHTML = `
      <div class="node-top">
        <span class="node-label">${state.graph.nodes[i]}</span>
        <span class="node-status">${parity}</span>
      </div>
      <div class="node-line">degree: ${snapshot.degrees[i]}</div>
      <div class="node-line">on stack: ${onStack}</div>
      <div class="node-line">role: ${snapshot.startNode === i ? 'start' : 'normal'}</div>
    `;

    elements.nodeCards.appendChild(card);
  }
}

function renderEdges(snapshot, activeEdgeId = null) {
  elements.edgeRows.innerHTML = '';

  if (!state.graph) {
    return;
  }

  for (const edge of state.graph.edges) {
    const status = edgeStatusForSnapshot(snapshot, edge.id);
    const row = document.createElement('tr');
    row.classList.add(`status-${status}`);

    if (activeEdgeId !== null && edge.id === activeEdgeId) {
      row.classList.add('active-edge');
    }

    const left = state.graph.nodes[edge.from];
    const right = state.graph.nodes[edge.to];

    row.innerHTML = `
      <td>${edge.id}</td>
      <td>${left} - ${right}</td>
      <td>${status}</td>
    `;

    elements.edgeRows.appendChild(row);
  }
}

function renderSnapshot(snapshot, activeEdgeId = null) {
  renderGraphCanvas(snapshot, activeEdgeId);
  renderStrip(elements.stackStrip, snapshot?.stack ?? [], 'stack is empty', true);
  renderStrip(elements.pathStrip, snapshot?.pathBacktrack ?? [], 'path is empty', false);
  renderNodes(snapshot);
}

function clearGraphState() {
  state.graph = null;
  state.tracer = null;
  state.lastSnapshot = null;
  state.lastHasEulerPath = null;
  state.lastPathLabels = null;

  renderSnapshot(null, null);
  renderEdges(null, null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function updateMetrics() {
  const totalEdges = state.graph ? state.graph.edges.length : 0;
  const oddCount = state.lastSnapshot ? state.lastSnapshot.oddNodes.length : 0;
  const usedEdges = state.lastSnapshot ? state.lastSnapshot.usedEdgeIds.length : 0;

  elements.oddMetric.textContent = String(oddCount);
  elements.usedMetric.textContent = `${usedEdges} / ${totalEdges}`;

  if (state.lastHasEulerPath === null) {
    elements.resultMetric.textContent = '-';
  } else {
    elements.resultMetric.textContent = state.lastHasEulerPath ? 'Path exists' : 'No Eulerian path';
  }

  elements.pathMetric.textContent = state.lastPathLabels ? state.lastPathLabels.join(' -> ') : '-';

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const totalSteps = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${totalSteps}`;
}

function applyEvent(event) {
  state.lastSnapshot = cloneSnapshot(event.snapshot);
  renderSnapshot(state.lastSnapshot, event.activeEdgeId ?? null);
  renderEdges(state.lastSnapshot, event.activeEdgeId ?? null);

  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
}

function finalizePendingOperation(meta) {
  setAnimationEmphasis(false);
  state.lastHasEulerPath = meta.hasEulerPath;
  state.lastPathLabels = meta.pathLabels;

  helpers.updateStatus(meta.summary);
  helpers.appendLog(meta.summary, meta.success ? 'ok' : '');

  renderSnapshot(state.lastSnapshot, null);
  renderEdges(state.lastSnapshot, null);
  helpers.clearCodeHighlights();
  updateMetrics();
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
    helpers.updateStatus(nodesParsed.error);
    helpers.appendLog(nodesParsed.error);
    return false;
  }

  const labelToIndex = createLabelToIndex(nodesParsed.nodes);
  const edgesParsed = parseUndirectedEdgesInput(elements.edgesInput.value, {
    labelToIndex,
  });
  if (edgesParsed.error) {
    clearGraphState();
    helpers.updateStatus(edgesParsed.error);
    helpers.appendLog(edgesParsed.error);
    return false;
  }

  state.graph = buildGraph(nodesParsed.nodes, edgesParsed.edges);
  state.tracer = new EulerianPathTracer(state.graph);
  state.lastHasEulerPath = null;
  state.lastPathLabels = null;
  state.lastSnapshot = state.tracer.createBlankSnapshot();

  renderSnapshot(state.lastSnapshot, null);
  renderEdges(state.lastSnapshot, null);
  helpers.focusCodePanel('eulerian');
  helpers.clearCodeHighlights();
  updateMetrics();

  const message = `Loaded ${state.graph.nodes.length} nodes and ${state.graph.edges.length} undirected edges.`;
  helpers.updateStatus(message);
  helpers.appendLog(message, 'ok');
  return true;
}

function generateRandomEulerianGraph() {
  const size = 5 + Math.floor(Math.random() * 4);
  const labels = [];
  for (let i = 0; i < size; i += 1) {
    labels.push(String.fromCharCode(65 + i));
  }

  const order = [...Array(size).keys()];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = order[i];
    order[i] = order[j];
    order[j] = temp;
  }

  const makeCycle = Math.random() < 0.5;
  const edges = [];
  const seen = new Set();

  const addEdge = (from, to) => {
    if (from === to) {
      return;
    }
    const key = edgeKeyForMode('undirected', from, to);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    edges.push({ from, to });
  };

  for (let i = 0; i < size - 1; i += 1) {
    addEdge(order[i], order[i + 1]);
  }

  if (makeCycle) {
    addEdge(order[size - 1], order[0]);
  }

  return {
    nodes: labels,
    edgeLines: edges.map((edge) => `${labels[edge.from]} ${labels[edge.to]}`),
  };
}

function loadSampleGraph() {
  elements.nodesInput.value = SAMPLE_GRAPH.nodes.join(', ');
  elements.edgesInput.value = SAMPLE_GRAPH.edgesText;
  loadGraphFromInputs();
}

function loadRandomGraph() {
  const randomGraph = generateRandomEulerianGraph();
  elements.nodesInput.value = randomGraph.nodes.join(', ');
  elements.edgesInput.value = randomGraph.edgeLines.join('\n');
  loadGraphFromInputs();
}

function prepareOperation() {
  if (!state.graph || !state.tracer) {
    helpers.updateStatus('Load a graph first.');
    return null;
  }

  const trace = state.tracer.generateRun();
  return {
    opType: 'eulerian',
    events: trace.events,
    hasEulerPath: trace.hasEulerPath,
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
      helpers.appendLog(
        `Prepared ${operation.opType} with ${operation.events.length} trace steps.`,
      );
    },
    onNoPending: () => {
      setAnimationEmphasis(false);
      helpers.updateStatus('No pending operation to finish.');
    },
  });

  elements.loadGraphBtn.addEventListener('click', loadGraphFromInputs);
  elements.sampleGraphBtn.addEventListener('click', loadSampleGraph);
  elements.randomGraphBtn.addEventListener('click', loadRandomGraph);

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
    clearLog: () => helpers.clearLog(),
    extraShortcuts: {
      l: () => loadGraphFromInputs(),
      m: () => loadSampleGraph(),
      r: () => loadRandomGraph(),
    },
  });

  helpers.focusCodePanel('eulerian');
  loadSampleGraph();
}

init();
