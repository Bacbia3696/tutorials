import { createOperationRunner } from '../shared/tutorial-core.js';
import {
  createLabelToIndex,
  edgeKeyForMode,
  parseNodeLabelsInput,
  parseWeightedEdgesInput,
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
  nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  edgesText: `A B 7
A D 5
B C 8
B D 9
B E 7
C E 5
D E 15
D F 6
E F 8
E G 9
F G 11`,
};

function buildGraph(nodes, edges) {
  const sortedEdges = [...edges].sort(
    (a, b) => a.weight - b.weight || a.from - b.from || a.to - b.to || a.id - b.id,
  );

  const edgeOrderById = new Map();
  sortedEdges.forEach((edge, index) => {
    edgeOrderById.set(edge.id, index + 1);
  });

  return {
    nodes,
    edges,
    sortedEdges,
    edgeOrderById,
  };
}

function findRootFromParent(parent, nodeIndex) {
  let cursor = nodeIndex;
  let guard = 0;
  while (parent[cursor] !== cursor && guard <= parent.length) {
    cursor = parent[cursor];
    guard += 1;
  }
  return cursor;
}

function computeComponentsFromSnapshot(snapshot) {
  if (!snapshot) {
    return [];
  }

  const componentMap = new Map();
  for (let i = 0; i < snapshot.parent.length; i += 1) {
    const root = findRootFromParent(snapshot.parent, i);
    if (!componentMap.has(root)) {
      componentMap.set(root, []);
    }
    componentMap.get(root).push(i);
  }

  return [...componentMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([root, members]) => ({
      root,
      members: members.sort((a, b) => a - b),
    }));
}

function edgeStatusForSnapshot(snapshot, edgeId) {
  if (!snapshot) {
    return 'pending';
  }

  const selected = new Set(snapshot.selectedEdgeIds);
  if (selected.has(edgeId)) {
    return 'selected';
  }

  const rejected = new Set(snapshot.rejectedEdgeIds);
  if (rejected.has(edgeId)) {
    return 'rejected';
  }

  return 'pending';
}

class KruskalTracer {
  constructor(graph) {
    this.graph = graph;
  }

  createBlankSnapshot() {
    const size = this.graph.nodes.length;
    return {
      parent: Array.from({ length: size }, (_, index) => index),
      rank: new Array(size).fill(0),
      componentCount: size,
      selectedEdgeIds: [],
      rejectedEdgeIds: [],
      activeEdgeId: null,
      activeNodes: [],
      totalWeight: 0,
      acceptedCount: 0,
      checkedCount: 0,
      targetEdgeCount: Math.max(0, size - 1),
    };
  }

  #snapshot(state, extras = {}) {
    return {
      parent: [...state.parent],
      rank: [...state.rank],
      componentCount: state.componentCount,
      selectedEdgeIds: [...state.selectedEdgeIds].sort((a, b) => a - b),
      rejectedEdgeIds: [...state.rejectedEdgeIds].sort((a, b) => a - b),
      activeEdgeId: extras.activeEdgeId ?? state.activeEdgeId ?? null,
      activeNodes: [...(extras.activeNodes ?? state.activeNodes ?? [])],
      totalWeight: state.totalWeight,
      acceptedCount: state.acceptedCount,
      checkedCount: state.checkedCount,
      targetEdgeCount: state.targetEdgeCount,
    };
  }

  #emit(events, message, line, state, extras = {}) {
    const snapshot = this.#snapshot(state, extras);
    events.push({
      opType: 'kruskal',
      message,
      line,
      snapshot,
      activeEdgeId: snapshot.activeEdgeId,
    });
  }

  #findRootWithTrace(nodeIndex, state, events, edgeId, labels) {
    const path = [];
    let cursor = nodeIndex;

    this.#emit(events, `Find root of ${labels[nodeIndex]}.`, 4, state, {
      activeEdgeId: edgeId,
      activeNodes: [nodeIndex],
    });

    while (state.parent[cursor] !== cursor) {
      path.push(cursor);
      cursor = state.parent[cursor];
    }

    const root = cursor;
    if (path.length === 0) {
      this.#emit(events, `${labels[nodeIndex]} is already a root (${labels[root]}).`, 4, state, {
        activeEdgeId: edgeId,
        activeNodes: [nodeIndex, root],
      });
      return root;
    }

    const chainLabels = [...path, root].map((index) => labels[index]);
    this.#emit(
      events,
      `Root chain for ${labels[nodeIndex]}: ${chainLabels.join(' -> ')}.`,
      4,
      state,
      { activeEdgeId: edgeId, activeNodes: [nodeIndex, root] },
    );

    for (const node of path) {
      if (state.parent[node] !== root) {
        const oldParent = state.parent[node];
        state.parent[node] = root;
        this.#emit(
          events,
          `Path compression: parent[${labels[node]}] ${labels[oldParent]} -> ${labels[root]}.`,
          4,
          state,
          { activeEdgeId: edgeId, activeNodes: [node, root] },
        );
      }
    }

    return root;
  }

  #unionRoots(rootA, rootB, state) {
    let parentRoot = rootA;
    let childRoot = rootB;
    let swapped = false;

    if (state.rank[parentRoot] < state.rank[childRoot]) {
      parentRoot = rootB;
      childRoot = rootA;
      swapped = true;
    }

    state.parent[childRoot] = parentRoot;
    let rankIncreased = false;
    if (state.rank[parentRoot] === state.rank[childRoot]) {
      state.rank[parentRoot] += 1;
      rankIncreased = true;
    }

    state.componentCount -= 1;

    return {
      parentRoot,
      childRoot,
      swapped,
      rankIncreased,
    };
  }

  generateRun() {
    const labels = this.graph.nodes;
    const size = labels.length;
    const state = {
      parent: Array.from({ length: size }, (_, index) => index),
      rank: new Array(size).fill(0),
      componentCount: size,
      selectedEdgeIds: new Set(),
      rejectedEdgeIds: new Set(),
      activeEdgeId: null,
      activeNodes: [],
      totalWeight: 0,
      acceptedCount: 0,
      checkedCount: 0,
      targetEdgeCount: Math.max(0, size - 1),
    };
    const events = [];

    const orderText = this.graph.sortedEdges
      .map((edge) => `${labels[edge.from]}-${labels[edge.to]}(${edge.weight})`)
      .join(', ');

    this.#emit(events, `Sort edges by weight: ${orderText}.`, 1, state);
    this.#emit(events, `Initialize DSU with ${size} singleton components and empty MST.`, 2, state);

    for (const edge of this.graph.sortedEdges) {
      const fromLabel = labels[edge.from];
      const toLabel = labels[edge.to];

      state.activeEdgeId = edge.id;
      state.activeNodes = [edge.from, edge.to];
      state.checkedCount += 1;

      this.#emit(events, `Inspect edge ${fromLabel}-${toLabel} (w=${edge.weight}).`, 3, state);

      const rootFrom = this.#findRootWithTrace(edge.from, state, events, edge.id, labels);
      const rootTo = this.#findRootWithTrace(edge.to, state, events, edge.id, labels);

      if (rootFrom === rootTo) {
        state.rejectedEdgeIds.add(edge.id);
        this.#emit(
          events,
          `Skip ${fromLabel}-${toLabel}: both endpoints are in component ${labels[rootFrom]} (cycle).`,
          5,
          state,
        );
        continue;
      }

      const union = this.#unionRoots(rootFrom, rootTo, state);
      state.selectedEdgeIds.add(edge.id);
      state.totalWeight += edge.weight;
      state.acceptedCount += 1;

      const rankNote = union.rankIncreased
        ? `rank[${labels[union.parentRoot]}] increased to ${state.rank[union.parentRoot]}`
        : 'rank unchanged';
      const attachNote = union.swapped
        ? `(swap roots by rank) attach ${labels[union.childRoot]} under ${labels[union.parentRoot]}`
        : `attach ${labels[union.childRoot]} under ${labels[union.parentRoot]}`;

      this.#emit(
        events,
        `Accept ${fromLabel}-${toLabel}: ${attachNote}; ${rankNote}; total weight = ${state.totalWeight}.`,
        6,
        state,
      );

      if (state.acceptedCount === state.targetEdgeCount) {
        this.#emit(events, `MST has ${state.targetEdgeCount} edges. Stop early.`, 7, state);
        break;
      }
    }

    state.activeEdgeId = null;
    state.activeNodes = [];

    const connected = size <= 1 || state.acceptedCount === state.targetEdgeCount;
    const edgeWord = state.acceptedCount === 1 ? 'edge' : 'edges';
    const summary = connected
      ? `Kruskal complete. MST uses ${state.acceptedCount} ${edgeWord} with total weight ${state.totalWeight}.`
      : `Graph is disconnected. Built a minimum spanning forest with ${state.acceptedCount} ${edgeWord}, weight ${state.totalWeight}, components ${state.componentCount}.`;

    this.#emit(events, summary, 8, state);

    return {
      events,
      connected,
      acceptedCount: state.acceptedCount,
      totalWeight: state.totalWeight,
      componentCount: state.componentCount,
      summary,
      success: connected,
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
  selectedMetric: document.getElementById('selectedMetric'),
  weightMetric: document.getElementById('weightMetric'),
  componentMetric: document.getElementById('componentMetric'),
  resultMetric: document.getElementById('resultMetric'),
  stepCounter: document.getElementById('stepCounter'),
  graphViewPanel: document.getElementById('graphViewPanel'),
  graphCanvas: document.getElementById('graphCanvas'),
  edgeOrderStrip: document.getElementById('edgeOrderStrip'),
  nodeCards: document.getElementById('nodeCards'),
  dsuTableContainer: document.getElementById('dsuTableContainer'),
  componentList: document.getElementById('componentList'),
  edgeRows: document.getElementById('edgeRows'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  logOutput: document.getElementById('logOutput'),
};

const state = {
  graph: null,
  tracer: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
  lastConnected: null,
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
    parent: [...snapshot.parent],
    rank: [...snapshot.rank],
    componentCount: snapshot.componentCount,
    selectedEdgeIds: [...snapshot.selectedEdgeIds],
    rejectedEdgeIds: [...snapshot.rejectedEdgeIds],
    activeEdgeId: snapshot.activeEdgeId,
    activeNodes: [...snapshot.activeNodes],
    totalWeight: snapshot.totalWeight,
    acceptedCount: snapshot.acceptedCount,
    checkedCount: snapshot.checkedCount,
    targetEdgeCount: snapshot.targetEdgeCount,
  };
}

function renderGraphCanvas(snapshot, activeEdgeId = null) {
  elements.graphCanvas.classList.toggle('has-active-edge', activeEdgeId !== null);

  const prepared = prepareGraphCanvas({
    svgElement: elements.graphCanvas,
    fallbackSize: { width: 980, height: 560 },
    hasGraph: Boolean(state.graph),
    emptyMessage: "Load a graph to visualize Kruskal's algorithm.",
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
    edgeLabelTextFn: (edge) => String(edge.weight),
    edgeLabelWidthFn: (text) => 10 + text.length * 7,
    edgeLabelBgClassFn: (_edge, isActive) =>
      isActive ? ['graph-edge-label-bg', 'active'] : 'graph-edge-label-bg',
    edgeLabelClassFn: (_edge, isActive) =>
      isActive ? ['graph-edge-label', 'active'] : 'graph-edge-label',
  });

  const activeSet = new Set(snapshot?.activeNodes ?? []);

  renderGraphNodes({
    svgElement: elements.graphCanvas,
    nodeCount: state.graph.nodes.length,
    positions,
    nodeClassFn: (index) => [
      snapshot?.parent[index] === index ? 'root' : '',
      activeSet.has(index) ? 'active' : '',
    ],
    renderNodeContent: ({ group, index, position }) => {
      if (activeSet.has(index)) {
        const halo = createSvgElement('circle', {
          class: 'graph-active-halo',
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

      const parentLabel = createSvgElement('text', {
        class: 'graph-parent',
        x: position.x,
        y: position.y + 34,
      });
      const parentIndex = snapshot?.parent[index] ?? index;
      parentLabel.textContent = `p=${state.graph.nodes[parentIndex]}`;
      group.appendChild(parentLabel);
    },
  });
}

function renderEdgeOrder(snapshot) {
  elements.edgeOrderStrip.innerHTML = '';

  if (!state.graph) {
    return;
  }

  if (!snapshot) {
    const empty = document.createElement('span');
    empty.className = 'order-empty';
    empty.textContent = 'Load a graph to see sorted edges.';
    elements.edgeOrderStrip.appendChild(empty);
    return;
  }

  for (const edge of state.graph.sortedEdges) {
    const fromLabel = state.graph.nodes[edge.from];
    const toLabel = state.graph.nodes[edge.to];
    const status = edgeStatusForSnapshot(snapshot, edge.id);

    const pill = document.createElement('span');
    pill.className = `edge-pill ${status}`;
    if (snapshot.activeEdgeId === edge.id) {
      pill.classList.add('active');
    }
    pill.textContent = `${fromLabel}-${toLabel}(${edge.weight})`;
    elements.edgeOrderStrip.appendChild(pill);
  }
}

function renderNodes(snapshot) {
  elements.nodeCards.innerHTML = '';

  if (!state.graph || !snapshot) {
    return;
  }

  const activeSet = new Set(snapshot.activeNodes);

  for (let i = 0; i < state.graph.nodes.length; i += 1) {
    const card = document.createElement('article');
    card.className = 'node-card';

    if (snapshot.parent[i] === i) {
      card.classList.add('root');
    }
    if (activeSet.has(i)) {
      card.classList.add('active');
    }

    const root = findRootFromParent(snapshot.parent, i);

    card.innerHTML = `
      <div class="node-top">
        <span class="node-label">${state.graph.nodes[i]}</span>
        <span class="node-status">${snapshot.parent[i] === i ? 'root' : 'child'}</span>
      </div>
      <div class="node-line">parent: ${state.graph.nodes[snapshot.parent[i]]}</div>
      <div class="node-line">root: ${state.graph.nodes[root]}</div>
      <div class="node-line">rank: ${snapshot.rank[i]}</div>
    `;

    elements.nodeCards.appendChild(card);
  }
}

function renderDsuTable(snapshot) {
  elements.dsuTableContainer.innerHTML = '';

  if (!state.graph || !snapshot) {
    return;
  }

  const table = document.createElement('table');
  table.className = 'dsu-table';

  const activeSet = new Set(snapshot.activeNodes);

  const labelsRow = document.createElement('tr');
  labelsRow.innerHTML = `<th>node</th>${state.graph.nodes.map((label) => `<th>${label}</th>`).join('')}`;

  const parentRow = document.createElement('tr');
  parentRow.innerHTML = `<th>parent</th>${snapshot.parent
    .map((parent, index) => {
      const cls = activeSet.has(index) ? ' class="highlight"' : '';
      return `<td${cls}>${state.graph.nodes[parent]}</td>`;
    })
    .join('')}`;

  const rankRow = document.createElement('tr');
  rankRow.innerHTML = `<th>rank</th>${snapshot.rank
    .map((rank, index) => {
      const cls = activeSet.has(index) ? ' class="highlight"' : '';
      return `<td${cls}>${rank}</td>`;
    })
    .join('')}`;

  table.appendChild(labelsRow);
  table.appendChild(parentRow);
  table.appendChild(rankRow);
  elements.dsuTableContainer.appendChild(table);
}

function renderComponents(snapshot) {
  elements.componentList.innerHTML = '';

  if (!state.graph || !snapshot) {
    return;
  }

  const components = computeComponentsFromSnapshot(snapshot);
  for (const component of components) {
    const chip = document.createElement('div');
    chip.className = 'component-chip';
    const rootLabel = state.graph.nodes[component.root];
    const members = component.members.map((index) => state.graph.nodes[index]).join(', ');
    chip.innerHTML = `<span class="component-root">root ${rootLabel}</span> {${members}}`;
    elements.componentList.appendChild(chip);
  }
}

function renderEdges(snapshot, activeEdgeId = null) {
  elements.edgeRows.innerHTML = '';

  if (!state.graph) {
    return;
  }

  for (const edge of state.graph.sortedEdges) {
    const status = edgeStatusForSnapshot(snapshot, edge.id);
    const row = document.createElement('tr');
    row.classList.add(`status-${status}`);

    if (activeEdgeId !== null && edge.id === activeEdgeId) {
      row.classList.add('active-edge');
    }

    const left = state.graph.nodes[edge.from];
    const right = state.graph.nodes[edge.to];
    const order = state.graph.edgeOrderById.get(edge.id) ?? '-';

    row.innerHTML = `
      <td>${order}</td>
      <td>${left} - ${right}</td>
      <td>${edge.weight}</td>
      <td>${status}</td>
    `;

    elements.edgeRows.appendChild(row);
  }
}

function renderSnapshot(snapshot, activeEdgeId = null) {
  renderGraphCanvas(snapshot, activeEdgeId);
  renderEdgeOrder(snapshot);
  renderNodes(snapshot);
  renderDsuTable(snapshot);
  renderComponents(snapshot);
}

function clearGraphState() {
  state.graph = null;
  state.tracer = null;
  state.lastSnapshot = null;
  state.lastConnected = null;

  renderSnapshot(null, null);
  renderEdges(null, null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function updateMetrics() {
  const totalNodes = state.graph ? state.graph.nodes.length : 0;
  const targetEdgeCount = Math.max(0, totalNodes - 1);
  const selectedCount = state.lastSnapshot ? state.lastSnapshot.acceptedCount : 0;
  const componentCount = state.lastSnapshot ? state.lastSnapshot.componentCount : totalNodes;

  elements.selectedMetric.textContent = `${selectedCount} / ${targetEdgeCount}`;
  elements.weightMetric.textContent = state.lastSnapshot
    ? String(state.lastSnapshot.totalWeight)
    : '-';
  elements.componentMetric.textContent = state.graph ? String(componentCount) : '-';

  if (state.lastConnected === null) {
    elements.resultMetric.textContent = '-';
  } else {
    elements.resultMetric.textContent = state.lastConnected ? 'MST complete' : 'Forest only';
  }

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
  state.lastConnected = meta.connected;

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
  const edgesParsed = parseWeightedEdgesInput(elements.edgesInput.value, {
    labelToIndex,
    mode: 'undirected',
    lineFormatMessage: (lineNumber) =>
      `Edge line ${lineNumber} is invalid. Format must be: FROM TO WEIGHT.`,
    duplicateEdgeMessage: (lineNumber, fromLabel, toLabel) =>
      `Edge line ${lineNumber}: duplicate undirected edge '${fromLabel} ${toLabel}'.`,
    selfLoopMessage: (lineNumber) => `Edge line ${lineNumber}: self-loops are not allowed.`,
  });
  if (edgesParsed.error) {
    clearGraphState();
    helpers.updateStatus(edgesParsed.error);
    helpers.appendLog(edgesParsed.error);
    return false;
  }

  state.graph = buildGraph(nodesParsed.nodes, edgesParsed.edges);
  state.tracer = new KruskalTracer(state.graph);
  state.lastConnected = null;
  state.lastSnapshot = state.tracer.createBlankSnapshot();

  renderSnapshot(state.lastSnapshot, null);
  renderEdges(state.lastSnapshot, null);
  helpers.focusCodePanel('kruskal');
  helpers.clearCodeHighlights();
  updateMetrics();

  const message = `Loaded ${state.graph.nodes.length} nodes and ${state.graph.edges.length} undirected edges.`;
  helpers.updateStatus(message);
  helpers.appendLog(message, 'ok');
  return true;
}

function generateRandomGraph() {
  const size = 5 + Math.floor(Math.random() * 4);
  const labels = [];
  for (let i = 0; i < size; i += 1) {
    labels.push(String.fromCharCode(65 + i));
  }

  const edges = [];
  const seen = new Set();

  const tryAddEdge = (from, to) => {
    if (from === to) {
      return false;
    }

    const key = edgeKeyForMode('undirected', from, to);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    edges.push({
      from,
      to,
      weight: 1 + Math.floor(Math.random() * 20),
    });
    return true;
  };

  for (let i = 1; i < size; i += 1) {
    const parent = Math.floor(Math.random() * i);
    tryAddEdge(parent, i);
  }

  const targetCount = Math.min(
    (size * (size - 1)) / 2,
    size - 1 + Math.floor(Math.random() * (size + 1)),
  );

  let guard = 0;
  while (edges.length < targetCount && guard < 500) {
    guard += 1;
    const from = Math.floor(Math.random() * size);
    const to = Math.floor(Math.random() * size);
    tryAddEdge(from, to);
  }

  return {
    nodes: labels,
    edgeLines: edges.map((edge) => `${labels[edge.from]} ${labels[edge.to]} ${edge.weight}`),
  };
}

function loadSampleGraph() {
  elements.nodesInput.value = SAMPLE_GRAPH.nodes.join(', ');
  elements.edgesInput.value = SAMPLE_GRAPH.edgesText;
  loadGraphFromInputs();
}

function loadRandomGraph() {
  const randomGraph = generateRandomGraph();
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
    opType: 'kruskal',
    events: trace.events,
    connected: trace.connected,
    acceptedCount: trace.acceptedCount,
    totalWeight: trace.totalWeight,
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

  helpers.focusCodePanel('kruskal');
  loadSampleGraph();
}

init();
