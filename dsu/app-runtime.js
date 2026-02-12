import { createOperationRunner } from "../shared/tutorial-core.js";
import {
    bindDebouncedResize,
    setupRunnerControls,
} from "../shared/tutorial-bootstrap.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";

// ─── DSU Data Structure with Trace Generation ───────────────────────────────

class DSUTracer {
    constructor(elements) {
        this.elements = [...elements].sort((a, b) => a - b);
        this.parent = new Map();
        this.rank = new Map();

        for (const e of this.elements) {
            this.parent.set(e, e);
            this.rank.set(e, 0);
        }
    }

    findRoot(x) {
        while (this.parent.get(x) !== x) {
            x = this.parent.get(x);
        }
        return x;
    }

    snapshot() {
        const parent = {};
        const rank = {};
        for (const e of this.elements) {
            parent[e] = this.parent.get(e);
            rank[e] = this.rank.get(e);
        }

        const componentMap = new Map();
        for (const e of this.elements) {
            const root = this.findRoot(e);
            if (!componentMap.has(root)) {
                componentMap.set(root, []);
            }
            componentMap.get(root).push(e);
        }

        const components = [...componentMap.entries()]
            .sort(([a], [b]) => a - b)
            .map(([root, members]) => ({ root, members: members.sort((a, b) => a - b) }));

        return {
            elements: [...this.elements],
            parent,
            rank,
            components,
            componentCount: components.length,
        };
    }

    generateFind(x) {
        const events = [];
        const path = [];

        const emit = (message, line, activeNodes = [], extras = {}) => {
            events.push({
                opType: "find",
                message,
                line,
                activeNodes,
                snapshot: this.snapshot(),
                ...extras,
            });
        };

        emit(`Find(${x}): start at node ${x}`, 1, [x]);

        // Walk up to root, recording the path
        let current = x;
        while (this.parent.get(current) !== current) {
            path.push(current);
            emit(`parent[${current}] = ${this.parent.get(current)} ≠ ${current}, keep going`, 1, [current, this.parent.get(current)]);
            current = this.parent.get(current);
        }
        const root = current;
        emit(`Found root: ${root} (parent[${root}] == ${root})`, 3, [root]);

        // Path compression
        for (const node of path) {
            if (this.parent.get(node) !== root) {
                const oldParent = this.parent.get(node);
                this.parent.set(node, root);
                emit(`Path compression: parent[${node}] = ${oldParent} → ${root}`, 2, [node, root]);
            }
        }

        emit(`Find(${x}) = ${root}`, 3, [root], { done: true, result: root });
        return { events, result: root };
    }

    generateUnion(a, b) {
        const events = [];

        const emit = (message, line, activeNodes = [], extras = {}) => {
            events.push({
                opType: "union",
                message,
                line,
                activeNodes,
                snapshot: this.snapshot(),
                ...extras,
            });
        };

        emit(`Union(${a}, ${b}): find root of ${a}`, 1, [a]);

        // Find root of a (with path compression and tracing)
        let rootA = a;
        {
            const path = [];
            while (this.parent.get(rootA) !== rootA) {
                path.push(rootA);
                emit(`  Find(${a}): parent[${rootA}] = ${this.parent.get(rootA)}, walk up`, 1, [rootA, this.parent.get(rootA)]);
                rootA = this.parent.get(rootA);
            }
            emit(`  Find(${a}) = ${rootA}`, 1, [rootA]);
            for (const node of path) {
                if (this.parent.get(node) !== rootA) {
                    this.parent.set(node, rootA);
                    emit(`  Path compression: parent[${node}] → ${rootA}`, 1, [node, rootA]);
                }
            }
        }

        emit(`Union(${a}, ${b}): find root of ${b}`, 2, [b]);

        // Find root of b (with path compression and tracing)
        let rootB = b;
        {
            const path = [];
            while (this.parent.get(rootB) !== rootB) {
                path.push(rootB);
                emit(`  Find(${b}): parent[${rootB}] = ${this.parent.get(rootB)}, walk up`, 2, [rootB, this.parent.get(rootB)]);
                rootB = this.parent.get(rootB);
            }
            emit(`  Find(${b}) = ${rootB}`, 2, [rootB]);
            for (const node of path) {
                if (this.parent.get(node) !== rootB) {
                    this.parent.set(node, rootB);
                    emit(`  Path compression: parent[${node}] → ${rootB}`, 2, [node, rootB]);
                }
            }
        }

        if (rootA === rootB) {
            emit(`rootA == rootB == ${rootA}: already connected, skip`, 3, [rootA], {
                done: true,
                result: "already connected",
            });
            return { events, result: "already connected", merged: false };
        }

        const rankA = this.rank.get(rootA);
        const rankB = this.rank.get(rootB);

        if (rankA < rankB) {
            emit(`rank[${rootA}]=${rankA} < rank[${rootB}]=${rankB}: swap so A is always ≥`, 4, [rootA, rootB]);
            const tmp = rootA;
            rootA = rootB;
            rootB = tmp;
        } else {
            emit(`rank[${rootA}]=${rankA} ≥ rank[${rootB}]=${rankB}: no swap needed`, 4, [rootA, rootB]);
        }

        this.parent.set(rootB, rootA);
        emit(`Attach: parent[${rootB}] = ${rootA}`, 5, [rootA, rootB]);

        if (this.rank.get(rootA) === this.rank.get(rootB)) {
            this.rank.set(rootA, this.rank.get(rootA) + 1);
            emit(`Ranks were equal: rank[${rootA}] incremented to ${this.rank.get(rootA)}`, 6, [rootA]);
        } else {
            emit(`Ranks differ: no rank change`, 6, [rootA]);
        }

        const snap = this.snapshot();
        emit(`Union(${a}, ${b}) complete. Components: ${snap.componentCount}`, 6, [], {
            done: true,
            result: `merged under root ${rootA}`,
        });
        return { events, result: `merged under root ${rootA}`, merged: true };
    }

    generateConnected(a, b) {
        const events = [];

        const emit = (message, line, activeNodes = [], extras = {}) => {
            events.push({
                opType: "connected",
                message,
                line,
                activeNodes,
                snapshot: this.snapshot(),
                ...extras,
            });
        };

        emit(`Connected(${a}, ${b}): checking Find(${a}) == Find(${b})`, 1, [a, b]);

        // Find root of a
        let rootA = a;
        {
            const path = [];
            while (this.parent.get(rootA) !== rootA) {
                path.push(rootA);
                emit(`  Find(${a}): parent[${rootA}] = ${this.parent.get(rootA)}, walk up`, 1, [rootA]);
                rootA = this.parent.get(rootA);
            }
            for (const node of path) {
                if (this.parent.get(node) !== rootA) {
                    this.parent.set(node, rootA);
                }
            }
        }

        // Find root of b
        let rootB = b;
        {
            const path = [];
            while (this.parent.get(rootB) !== rootB) {
                path.push(rootB);
                emit(`  Find(${b}): parent[${rootB}] = ${this.parent.get(rootB)}, walk up`, 1, [rootB]);
                rootB = this.parent.get(rootB);
            }
            for (const node of path) {
                if (this.parent.get(node) !== rootB) {
                    this.parent.set(node, rootB);
                }
            }
        }

        const connected = rootA === rootB;
        emit(
            `Find(${a})=${rootA}, Find(${b})=${rootB} → ${connected ? "connected" : "NOT connected"}`,
            1,
            [rootA, rootB],
            { done: true, result: connected },
        );
        return { events, result: connected };
    }
}

// ─── DOM Elements ───────────────────────────────────────────────────────────

const elements = {
    elementsInput: document.getElementById("elementsInput"),
    loadBtn: document.getElementById("loadBtn"),
    sampleBtn: document.getElementById("sampleBtn"),
    opType: document.getElementById("opType"),
    paramA: document.getElementById("paramA"),
    paramB: document.getElementById("paramB"),
    animateBtn: document.getElementById("animateBtn"),
    stepBtn: document.getElementById("stepBtn"),
    instantBtn: document.getElementById("instantBtn"),
    finishBtn: document.getElementById("finishBtn"),
    speedRange: document.getElementById("speedRange"),
    speedLabel: document.getElementById("speedLabel"),
    statusMessage: document.getElementById("statusMessage"),
    elementCount: document.getElementById("elementCount"),
    componentCount: document.getElementById("componentCount"),
    lastResult: document.getElementById("lastResult"),
    stepCounter: document.getElementById("stepCounter"),
    forestContainer: document.getElementById("forestContainer"),
    parentTableContainer: document.getElementById("parentTableContainer"),
    componentsList: document.getElementById("componentsList"),
    logOutput: document.getElementById("logOutput"),
    clearLogBtn: document.getElementById("clearLogBtn"),
};

const state = {
    dsu: null,
    speedMs: Number(elements.speedRange.value),
    lastResult: null,
    lastSnapshot: null,
    lastActiveNodes: [],
};
const helpers = createRuntimeHelpers({
    logOutput: elements.logOutput,
    statusMessage: elements.statusMessage,
});
let operationRunner = null;

// ─── Input Parsing ──────────────────────────────────────────────────────────

function parseElementsInput(text) {
    const tokens = text
        .trim()
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    if (tokens.length === 0) {
        return { error: "Please provide at least one element." };
    }
    if (tokens.length > 30) {
        return { error: "Use at most 30 elements." };
    }

    const nums = [];
    for (const token of tokens) {
        const n = Number(token);
        if (!Number.isInteger(n) || n < 0 || n > 999) {
            return { error: `Invalid element '${token}'. Use non-negative integers (0–999).` };
        }
        nums.push(n);
    }

    const unique = [...new Set(nums)].sort((a, b) => a - b);
    if (unique.length !== nums.length) {
        return { elements: unique };
    }
    return { elements: unique };
}

function randomSampleElements() {
    const count = 6 + Math.floor(Math.random() * 5); // 6–10
    const chosen = new Set();
    while (chosen.size < count) {
        chosen.add(Math.floor(Math.random() * 12));
    }
    return [...chosen].sort((a, b) => a - b);
}

// ─── Rendering: Parent & Rank Table ─────────────────────────────────────────

function renderParentTable(snapshot, activeNodes = []) {
    const container = elements.parentTableContainer;
    container.innerHTML = "";

    if (!snapshot) {
        return;
    }

    const table = document.createElement("table");
    table.className = "parent-table";

    const activeSet = new Set(activeNodes);

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const indexHeader = document.createElement("th");
    indexHeader.textContent = "Element";
    headerRow.appendChild(indexHeader);
    for (const e of snapshot.elements) {
        const th = document.createElement("th");
        th.textContent = String(e);
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    // Parent row
    const parentRow = document.createElement("tr");
    const parentLabel = document.createElement("th");
    parentLabel.textContent = "parent";
    parentRow.appendChild(parentLabel);
    for (const e of snapshot.elements) {
        const td = document.createElement("td");
        td.textContent = String(snapshot.parent[e]);
        if (activeSet.has(e)) {
            td.className = "highlight";
        }
        parentRow.appendChild(td);
    }
    tbody.appendChild(parentRow);

    // Rank row
    const rankRow = document.createElement("tr");
    const rankLabel = document.createElement("th");
    rankLabel.textContent = "rank";
    rankRow.appendChild(rankLabel);
    for (const e of snapshot.elements) {
        const td = document.createElement("td");
        td.textContent = String(snapshot.rank[e]);
        if (activeSet.has(e)) {
            td.className = "highlight";
        }
        rankRow.appendChild(td);
    }
    tbody.appendChild(rankRow);

    table.appendChild(tbody);
    container.appendChild(table);
}

// ─── Rendering: Connected Components ────────────────────────────────────────

function renderComponents(snapshot) {
    const container = elements.componentsList;
    container.innerHTML = "";

    if (!snapshot || snapshot.components.length === 0) {
        const empty = document.createElement("div");
        empty.className = "component-chip empty";
        empty.textContent = "(no elements)";
        container.appendChild(empty);
        return;
    }

    for (const comp of snapshot.components) {
        const chip = document.createElement("div");
        chip.className = "component-chip";
        chip.innerHTML = `<span class="chip-label">root ${comp.root}:</span> {${comp.members.join(", ")}}`;
        container.appendChild(chip);
    }
}

// ─── Rendering: Forest Graph ────────────────────────────────────────────────

function layoutForest(snapshot, containerWidth) {
    const elems = snapshot.elements;
    const n = elems.length;

    // Build adjacency: for each non-root, edge from child → parent
    const children = new Map();
    const roots = [];
    for (const e of elems) {
        children.set(e, []);
    }
    for (const e of elems) {
        const p = snapshot.parent[e];
        if (p !== e) {
            children.get(p).push(e);
        } else {
            roots.push(e);
        }
    }

    // Compute depth and subtree width for layout
    const depth = new Map();
    const subtreeWidth = new Map();

    const computeLayout = (node, d) => {
        depth.set(node, d);
        const kids = children.get(node).sort((a, b) => a - b);
        if (kids.length === 0) {
            subtreeWidth.set(node, 1);
            return 1;
        }
        let total = 0;
        for (const kid of kids) {
            total += computeLayout(kid, d + 1);
        }
        subtreeWidth.set(node, total);
        return total;
    };

    let totalLeaves = 0;
    for (const root of roots) {
        totalLeaves += computeLayout(root, 0);
    }

    const maxDepth = Math.max(0, ...depth.values());
    const nodeSpacing = 80;
    const rowHeight = 90;
    const topPad = 40;
    const bottomPad = 40;
    const sidePad = 50;
    const minWidth = sidePad * 2 + Math.max(totalLeaves - 1, 0) * nodeSpacing;
    const width = Math.max(containerWidth, minWidth, 400);
    const height = topPad + bottomPad + (maxDepth + 1) * rowHeight;

    // Assign x coordinates
    const coords = new Map();
    let cursor = sidePad;

    const assignX = (node) => {
        const kids = children.get(node).sort((a, b) => a - b);
        if (kids.length === 0) {
            const x = totalLeaves <= 1 ? width / 2 : cursor;
            coords.set(node, { x, y: topPad + depth.get(node) * rowHeight });
            cursor += nodeSpacing;
            return;
        }

        for (const kid of kids) {
            assignX(kid);
        }

        // Center parent over children
        const firstChild = coords.get(kids[0]);
        const lastChild = coords.get(kids[kids.length - 1]);
        const x = (firstChild.x + lastChild.x) / 2;
        coords.set(node, { x, y: topPad + depth.get(node) * rowHeight });
    };

    for (const root of roots) {
        assignX(root);
    }

    return { coords, width, height, roots, children };
}

function renderForest(snapshot, activeNodes = []) {
    state.lastSnapshot = snapshot;
    state.lastActiveNodes = activeNodes;
    const container = elements.forestContainer;
    container.innerHTML = "";

    if (!snapshot || snapshot.elements.length === 0) {
        return;
    }

    const panelWidth = Math.max(container.clientWidth - 6, 400);
    const { coords, width, height, children } = layoutForest(snapshot, panelWidth);
    const activeSet = new Set(activeNodes);

    const scroll = document.createElement("div");
    scroll.className = "forest-scroll";

    const diagram = document.createElement("div");
    diagram.className = "forest-diagram";
    diagram.style.width = `${width}px`;
    diagram.style.height = `${height}px`;

    // SVG for edges
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "forest-links");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");

    // Arrow marker
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowPath.setAttribute("fill", "rgba(60, 70, 110, 0.4)");
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Draw edges (child → parent, direction: parent to child visually top-down)
    for (const e of snapshot.elements) {
        const p = snapshot.parent[e];
        if (p === e) {
            continue; // root
        }
        const from = coords.get(e);
        const to = coords.get(p);
        if (!from || !to) {
            continue;
        }

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        // Draw from child upward to parent
        const nodeRadius = 24;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dist > 0 ? dx / dist : 0;
        const uy = dist > 0 ? dy / dist : -1;

        line.setAttribute("x1", String(from.x + ux * nodeRadius));
        line.setAttribute("y1", String(from.y + uy * nodeRadius));
        line.setAttribute("x2", String(to.x - ux * nodeRadius));
        line.setAttribute("y2", String(to.y - uy * nodeRadius));
        line.setAttribute("class", `forest-edge${activeSet.has(e) ? " highlight" : ""}`);
        svg.appendChild(line);
    }

    diagram.appendChild(svg);

    // Draw nodes
    for (const e of snapshot.elements) {
        const pos = coords.get(e);
        if (!pos) {
            continue;
        }
        const isRoot = snapshot.parent[e] === e;

        const card = document.createElement("div");
        card.className = "dsu-node";
        if (isRoot) {
            card.classList.add("root-node");
        }
        if (activeSet.has(e)) {
            card.classList.add("active");
        }
        card.style.left = `${pos.x}px`;
        card.style.top = `${pos.y}px`;

        card.innerHTML = `
      <div class="node-label">${e}</div>
      <span class="node-rank">r${snapshot.rank[e]}</span>
      ${isRoot ? '<span class="root-badge">ROOT</span>' : ""}
    `;
        diagram.appendChild(card);
    }

    scroll.appendChild(diagram);
    container.appendChild(scroll);
}

function rerenderForResize() {
    if (!state.lastSnapshot) {
        return;
    }
    renderForest(state.lastSnapshot, state.lastActiveNodes);
}

// ─── Metrics ────────────────────────────────────────────────────────────────

function updateMetrics(snapshot) {
    const snap = snapshot || (state.dsu ? state.dsu.snapshot() : null);
    if (!snap) {
        return;
    }
    elements.elementCount.textContent = String(snap.elements.length);
    elements.componentCount.textContent = String(snap.componentCount);
    elements.lastResult.textContent = state.lastResult === null ? "-" : String(state.lastResult);
    const step = operationRunner ? operationRunner.eventIndex : 0;
    const total = operationRunner ? operationRunner.pendingLength : 0;
    elements.stepCounter.textContent = `${step} / ${total}`;
}

// ─── Operation Lifecycle ────────────────────────────────────────────────────

function finalizePendingOperation(meta) {
    if (Object.prototype.hasOwnProperty.call(meta, "result")) {
        state.lastResult = meta.result;
    } else {
        state.lastResult = meta.summary;
    }

    helpers.updateStatus(meta.summary);
    helpers.appendLog(meta.summary, "ok");

    const snapshot = state.dsu.snapshot();
    renderForest(snapshot, []);
    renderParentTable(snapshot, []);
    renderComponents(snapshot);
    helpers.clearCodeHighlights();
    updateMetrics(snapshot);
}

function applyEvent(event) {
    renderForest(event.snapshot, event.activeNodes || []);
    renderParentTable(event.snapshot, event.activeNodes || []);
    renderComponents(event.snapshot);
    helpers.highlightCode(event.opType, event.line);
    helpers.updateStatus(event.message);
}

function prepareOperation() {
    if (!state.dsu) {
        helpers.updateStatus("Initialize elements first.");
        return null;
    }

    const opType = elements.opType.value;
    const a = Number(elements.paramA.value);
    const b = Number(elements.paramB.value);

    const validSet = new Set(state.dsu.elements);

    if (opType === "find") {
        if (!validSet.has(a)) {
            const msg = `Element ${a} does not exist.`;
            helpers.updateStatus(msg);
            helpers.appendLog(msg);
            return null;
        }
        const trace = state.dsu.generateFind(a);
        return {
            opType,
            events: trace.events,
            result: trace.result,
            summary: `Find(${a}) = ${trace.result}`,
        };
    }

    if (opType === "union") {
        if (!validSet.has(a) || !validSet.has(b)) {
            const msg = `Both elements must exist. Got a=${a}, b=${b}.`;
            helpers.updateStatus(msg);
            helpers.appendLog(msg);
            return null;
        }
        const trace = state.dsu.generateUnion(a, b);
        return {
            opType,
            events: trace.events,
            result: trace.result,
            summary: `Union(${a}, ${b}): ${trace.result}`,
        };
    }

    // connected
    if (!validSet.has(a) || !validSet.has(b)) {
        const msg = `Both elements must exist. Got a=${a}, b=${b}.`;
        helpers.updateStatus(msg);
        helpers.appendLog(msg);
        return null;
    }
    const trace = state.dsu.generateConnected(a, b);
    return {
        opType,
        events: trace.events,
        result: trace.result,
        summary: `Connected(${a}, ${b}) = ${trace.result}`,
    };
}

// ─── Load / Sample ──────────────────────────────────────────────────────────

function loadElements(elems) {
    operationRunner.stop();
    operationRunner.ensureNoPending();

    state.dsu = new DSUTracer(elems);
    state.lastResult = null;

    const snapshot = state.dsu.snapshot();
    renderForest(snapshot, []);
    renderParentTable(snapshot, []);
    renderComponents(snapshot);
    updateMetrics(snapshot);

    helpers.focusCodePanel(elements.opType.value);
    helpers.clearCodeHighlights();

    const message = `Initialized ${snapshot.elements.length} elements: {${snapshot.elements.join(", ")}}`;
    helpers.updateStatus(message);
    helpers.appendLog(message, "ok");
}

function handleLoad() {
    const parsed = parseElementsInput(elements.elementsInput.value);
    if (parsed.error) {
        helpers.updateStatus(parsed.error);
        helpers.appendLog(parsed.error);
        return;
    }
    loadElements(parsed.elements);
}

function handleSample() {
    const elems = randomSampleElements();
    elements.elementsInput.value = elems.join(", ");
    loadElements(elems);
}

function setOperationType(opType) {
    elements.opType.value = opType;
    helpers.focusCodePanel(opType);
    helpers.clearCodeHighlights();
    helpers.updateStatus(`Shortcut: switched to ${opType} mode.`);
}

function finishCurrentOperation() {
    operationRunner.finishCurrent();
}

// ─── Initialization ─────────────────────────────────────────────────────────

function init() {
    operationRunner = createOperationRunner({
        getSpeedMs: () => state.speedMs,
        prepareOperation,
        applyEvent,
        updateMetrics,
        finalizeOperation: finalizePendingOperation,
        onPrepared: (operation) => {
            helpers.appendLog(`Prepared ${operation.opType} with ${operation.events.length} trace steps.`);
        },
        onNoPending: () => {
            helpers.updateStatus("No pending operation.");
        },
    });

    elements.loadBtn.addEventListener("click", handleLoad);
    elements.sampleBtn.addEventListener("click", handleSample);

    elements.opType.addEventListener("change", () => {
        helpers.focusCodePanel(elements.opType.value);
        helpers.clearCodeHighlights();
    });

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
            l: () => handleLoad(),
            r: () => handleSample(),
            1: () => setOperationType("union"),
            2: () => setOperationType("find"),
            3: () => setOperationType("connected"),
        },
    });

    bindDebouncedResize({
        onResize: () => {
            rerenderForResize();
        },
        delayMs: 120,
    });

    handleLoad();
}

init();
