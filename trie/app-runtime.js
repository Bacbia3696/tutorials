import { createOperationRunner } from "../shared/tutorial-core.js";
import {
  bindDebouncedResize,
  setupRunnerControls,
} from "../shared/tutorial-bootstrap.js";
import { createRuntimeHelpers } from "../shared/runtime-helpers.js";

class TrieNode {
  constructor(id, char) {
    this.id = id;
    this.char = char;
    this.children = new Map();
    this.isEnd = false;
  }
}

class TrieTracer {
  constructor(words = []) {
    this.root = new TrieNode(0, "");
    this.nextId = 1;
    this.words = new Set();

    for (const word of words) {
      this.insertInternal(word);
    }
  }

  insertInternal(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        const child = new TrieNode(this.nextId, ch);
        this.nextId += 1;
        node.children.set(ch, child);
      }
      node = node.children.get(ch);
    }
    node.isEnd = true;
    this.words.add(word);
  }

  snapshot() {
    const nodes = [];
    const queue = [{ node: this.root, depth: 0 }];

    while (queue.length > 0) {
      const { node, depth } = queue.shift();
      const children = [...node.children.values()].sort((a, b) => a.char.localeCompare(b.char));
      nodes.push({
        id: node.id,
        char: node.char,
        isEnd: node.isEnd,
        depth,
        children: children.map((child) => child.id),
      });

      for (const child of children) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }

    return {
      nodes,
      nextId: this.nextId,
      words: [...this.words].sort(),
    };
  }

  generateInsert(word) {
    const events = [];
    const existedBefore = this.words.has(word);

    const emit = (message, line, activeNodeId = null, extras = {}) => {
      events.push({
        opType: "insert",
        message,
        line,
        activeNodeId,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    let node = this.root;
    emit(`Initialize at root for insert("${word}")`, 1, node.id);

    for (const ch of word) {
      emit(`Process char '${ch}'`, 2, node.id, { char: ch });

      if (!node.children.has(ch)) {
        const child = new TrieNode(this.nextId, ch);
        this.nextId += 1;
        node.children.set(ch, child);
        emit(`Create node '${ch}' as child`, 3, child.id, { char: ch });
      }

      node = node.children.get(ch);
      emit(`Move to child '${ch}'`, 4, node.id, { char: ch });
    }

    const alreadyEnd = node.isEnd;
    node.isEnd = true;
    this.words.add(word);
    emit(
      alreadyEnd
        ? `Word already existed. End marker remains true.`
        : `Mark end-of-word at last node`,
      5,
      node.id,
      { done: true, existedBefore },
    );

    return { events, existedBefore };
  }

  generateSearch(word) {
    const events = [];

    const emit = (message, line, activeNodeId = null, extras = {}) => {
      events.push({
        opType: "search",
        message,
        line,
        activeNodeId,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    let node = this.root;
    emit(`Initialize at root for search("${word}")`, 1, node.id);

    for (const ch of word) {
      emit(`Process char '${ch}'`, 2, node.id, { char: ch });

      if (!node.children.has(ch)) {
        emit(`Missing child '${ch}' => return false`, 3, node.id, {
          done: true,
          result: false,
        });
        return { events, result: false };
      }

      node = node.children.get(ch);
      emit(`Move to child '${ch}'`, 4, node.id, { char: ch });
    }

    emit(`Reached end. Return node.isEnd = ${node.isEnd}`, 5, node.id, {
      done: true,
      result: node.isEnd,
    });
    return { events, result: node.isEnd };
  }

  generateStartsWith(prefix) {
    const events = [];

    const emit = (message, line, activeNodeId = null, extras = {}) => {
      events.push({
        opType: "prefix",
        message,
        line,
        activeNodeId,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    let node = this.root;
    emit(`Initialize at root for startsWith("${prefix}")`, 1, node.id);

    for (const ch of prefix) {
      emit(`Process char '${ch}'`, 2, node.id, { char: ch });

      if (!node.children.has(ch)) {
        emit(`Missing child '${ch}' => return false`, 3, node.id, {
          done: true,
          result: false,
        });
        return { events, result: false };
      }

      node = node.children.get(ch);
      emit(`Move to child '${ch}'`, 4, node.id, { char: ch });
    }

    emit(`All prefix chars found => return true`, 5, node.id, {
      done: true,
      result: true,
    });
    return { events, result: true };
  }

  generateDelete(word) {
    const events = [];

    const emit = (message, line, activeNodeId = null, extras = {}) => {
      events.push({
        opType: "delete",
        message,
        line,
        activeNodeId,
        snapshot: this.snapshot(),
        ...extras,
      });
    };

    let node = this.root;
    const path = [];
    emit(`Initialize at root for delete("${word}")`, 1, node.id);

    for (const ch of word) {
      emit(`Process char '${ch}' and walk down`, 2, node.id, { char: ch });

      if (!node.children.has(ch)) {
        emit(`Missing child '${ch}' => return false`, 3, node.id, {
          done: true,
          result: false,
        });
        return { events, result: false };
      }

      path.push({ parent: node, ch });
      node = node.children.get(ch);
      emit(`Move to child '${ch}'`, 2, node.id, { char: ch });
    }

    if (!node.isEnd) {
      emit(`Path exists but node is not end-of-word => return false`, 4, node.id, {
        done: true,
        result: false,
      });
      return { events, result: false };
    }

    node.isEnd = false;
    this.words.delete(word);
    emit(`Unmark end-of-word at last node`, 5, node.id);

    for (let i = path.length - 1; i >= 0; i -= 1) {
      const { parent, ch } = path[i];
      const child = parent.children.get(ch);

      if (!child) {
        continue;
      }

      const shouldPrune = child.children.size === 0 && !child.isEnd;
      if (!shouldPrune) {
        emit(`Stop pruning at '${ch}' (node still needed)`, 6, child.id, { char: ch });
        break;
      }

      parent.children.delete(ch);
      emit(`Prune empty node '${ch}'`, 6, parent.id, { char: ch });
    }

    emit(`Delete complete => return true`, 7, null, {
      done: true,
      result: true,
    });
    return { events, result: true };
  }
}

const elements = {
  initialWordsInput: document.getElementById("initialWordsInput"),
  loadWordsBtn: document.getElementById("loadWordsBtn"),
  sampleWordsBtn: document.getElementById("sampleWordsBtn"),
  opType: document.getElementById("opType"),
  wordInput: document.getElementById("wordInput"),
  animateBtn: document.getElementById("animateBtn"),
  stepBtn: document.getElementById("stepBtn"),
  instantBtn: document.getElementById("instantBtn"),
  finishBtn: document.getElementById("finishBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  statusMessage: document.getElementById("statusMessage"),
  wordCount: document.getElementById("wordCount"),
  nodeCount: document.getElementById("nodeCount"),
  lastResult: document.getElementById("lastResult"),
  stepCounter: document.getElementById("stepCounter"),
  treeContainer: document.getElementById("treeContainer"),
  wordsList: document.getElementById("wordsList"),
  logOutput: document.getElementById("logOutput"),
  clearLogBtn: document.getElementById("clearLogBtn"),
};

const state = {
  trie: null,
  speedMs: Number(elements.speedRange.value),
  lastResult: null,
  lastTreeSnapshot: null,
  lastActiveNodeId: null,
};
const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});
let operationRunner = null;

function normalizeWord(raw) {
  return raw.trim().toLowerCase();
}

function isValidWord(word) {
  return /^[a-z]+$/.test(word);
}

function parseWordsInput(text) {
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .map((token) => normalizeWord(token))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { error: "Please provide at least one word." };
  }
  if (tokens.length > 40) {
    return { error: "Use at most 40 words." };
  }

  const unique = new Set();
  for (const token of tokens) {
    if (!isValidWord(token)) {
      return { error: `Invalid token '${token}'. Use letters a-z only.` };
    }
    unique.add(token);
  }

  return { words: [...unique] };
}

function randomSampleWords() {
  const bank = [
    "cat",
    "car",
    "cart",
    "care",
    "dog",
    "dot",
    "dove",
    "deal",
    "deer",
    "doom",
    "sun",
    "sand",
    "song",
    "soon",
    "tea",
    "team",
    "tear",
  ];

  const chosen = [];
  while (chosen.length < 8) {
    const idx = Math.floor(Math.random() * bank.length);
    const word = bank[idx];
    if (!chosen.includes(word)) {
      chosen.push(word);
    }
  }
  return chosen;
}

function renderWords(words) {
  elements.wordsList.innerHTML = "";

  if (!words || words.length === 0) {
    const empty = document.createElement("div");
    empty.className = "word-chip empty";
    empty.textContent = "(empty dictionary)";
    elements.wordsList.appendChild(empty);
    return;
  }

  for (const word of words) {
    const chip = document.createElement("div");
    chip.className = "word-chip";
    chip.textContent = word;
    elements.wordsList.appendChild(chip);
  }
}

function layoutTree(snapshot, containerWidth) {
  const map = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const xUnits = new Map();
  let leafCursor = 0;

  const assign = (id) => {
    const node = map.get(id);
    const children = [...node.children]
      .map((childId) => map.get(childId))
      .filter(Boolean)
      .sort((a, b) => a.char.localeCompare(b.char));

    if (children.length === 0) {
      xUnits.set(id, leafCursor);
      leafCursor += 1;
      return;
    }

    for (const child of children) {
      assign(child.id);
    }

    const avg = children.reduce((acc, child) => acc + xUnits.get(child.id), 0) / children.length;
    xUnits.set(id, avg);
  };

  assign(0);

  const maxDepth = Math.max(...snapshot.nodes.map((node) => node.depth));
  const leaves = Math.max(leafCursor, 1);
  const sidePad = 46;
  const minWidth = sidePad * 2 + Math.max(leaves - 1, 1) * 86;
  const width = Math.max(containerWidth, minWidth);
  const rowHeight = 98;
  const topPad = 14;
  const bottomPad = 16;
  const height = topPad + bottomPad + (maxDepth + 1) * rowHeight;

  const coords = new Map();
  for (const node of snapshot.nodes) {
    const unit = xUnits.get(node.id) ?? 0;
    const x =
      leaves <= 1
        ? width / 2
        : sidePad + (unit / (leaves - 1)) * (width - sidePad * 2);
    const y = topPad + node.depth * rowHeight;
    coords.set(node.id, { x, y });
  }

  return { coords, width, height };
}

function renderTree(snapshot, activeNodeId = null) {
  state.lastTreeSnapshot = snapshot;
  state.lastActiveNodeId = activeNodeId;
  elements.treeContainer.innerHTML = "";

  if (!snapshot || !snapshot.nodes || snapshot.nodes.length === 0) {
    return;
  }

  const panelWidth = Math.max(elements.treeContainer.clientWidth - 6, 620);
  const { coords, width, height } = layoutTree(snapshot, panelWidth);

  const scroll = document.createElement("div");
  scroll.className = "tree-scroll";

  const diagram = document.createElement("div");
  diagram.className = "tree-diagram";
  diagram.style.width = `${width}px`;
  diagram.style.height = `${height}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tree-links");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  for (const node of snapshot.nodes) {
    const from = coords.get(node.id);
    for (const childId of node.children) {
      const to = coords.get(childId);
      if (!from || !to) {
        continue;
      }
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      edge.setAttribute("x1", String(from.x));
      edge.setAttribute("y1", String(from.y + 30));
      edge.setAttribute("x2", String(to.x));
      edge.setAttribute("y2", String(to.y + 4));
      edge.setAttribute("class", "tree-edge");
      svg.appendChild(edge);
    }
  }

  diagram.appendChild(svg);

  const nodesOrdered = [...snapshot.nodes].sort((a, b) => a.depth - b.depth || a.id - b.id);
  for (const node of nodesOrdered) {
    const { x, y } = coords.get(node.id);
    const card = document.createElement("div");
    card.className = "trie-node";
    if (node.isEnd) {
      card.classList.add("end");
    }
    if (activeNodeId === node.id) {
      card.classList.add("active");
    }
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;

    const charLabel = node.id === 0 ? "ROOT" : node.char;
    card.innerHTML = `
      <div class="node-char ${node.id === 0 ? "root" : ""}">${charLabel}</div>
      <span class="node-id">#${node.id}</span>
      ${node.isEnd ? '<span class="end-flag">END</span>' : ""}
    `;
    diagram.appendChild(card);
  }

  scroll.appendChild(diagram);
  elements.treeContainer.appendChild(scroll);
}

function rerenderTreeForResize() {
  if (!state.lastTreeSnapshot) {
    return;
  }
  renderTree(state.lastTreeSnapshot, state.lastActiveNodeId);
}

function updateMetrics(snapshot) {
  const snap = snapshot || state.trie.snapshot();
  elements.wordCount.textContent = String(snap.words.length);
  elements.nodeCount.textContent = String(snap.nodes.length);
  elements.lastResult.textContent = state.lastResult === null ? "-" : String(state.lastResult);
  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function finalizePendingOperation(meta) {
  if (Object.prototype.hasOwnProperty.call(meta, "result")) {
    state.lastResult = meta.result;
  } else {
    state.lastResult = meta.summary;
  }

  helpers.updateStatus(meta.summary);
  helpers.appendLog(meta.summary, "ok");

  const snapshot = state.trie.snapshot();
  renderTree(snapshot, null);
  renderWords(snapshot.words);
  helpers.clearCodeHighlights();
  updateMetrics(snapshot);
}

function applyEvent(event) {
  renderTree(event.snapshot, event.activeNodeId);
  renderWords(event.snapshot.words);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
}

function prepareOperation() {
  if (!state.trie) {
    helpers.updateStatus("Load words first.");
    return null;
  }

  const opType = elements.opType.value;
  const word = normalizeWord(elements.wordInput.value);

  if (!word || !isValidWord(word)) {
    const message = "Word must contain letters a-z only.";
    helpers.updateStatus(message);
    helpers.appendLog(message);
    return null;
  }

  if (opType === "insert") {
    const trace = state.trie.generateInsert(word);
    return {
      opType,
      events: trace.events,
      summary: trace.existedBefore
        ? `Insert("${word}"): word already existed.`
        : `Insert("${word}"): word added.`,
    };
  }

  if (opType === "search") {
    const trace = state.trie.generateSearch(word);
    const naive = state.trie.words.has(word);
    return {
      opType,
      events: trace.events,
      result: trace.result,
      summary: `Search("${word}") => ${trace.result} (naive: ${naive})`,
    };
  }

  if (opType === "delete") {
    const existedBefore = state.trie.words.has(word);
    const trace = state.trie.generateDelete(word);
    const existsAfter = state.trie.words.has(word);
    return {
      opType,
      events: trace.events,
      result: trace.result,
      summary: `Delete("${word}") => ${trace.result} (existed-before: ${existedBefore}, exists-after: ${existsAfter})`,
    };
  }

  const trace = state.trie.generateStartsWith(word);
  const naive = [...state.trie.words].some((candidate) => candidate.startsWith(word));
  return {
    opType,
    events: trace.events,
    result: trace.result,
    summary: `StartsWith("${word}") => ${trace.result} (naive: ${naive})`,
  };
}

function loadWords(words) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.trie = new TrieTracer(words);
  state.lastResult = null;

  const snapshot = state.trie.snapshot();
  renderTree(snapshot, null);
  renderWords(snapshot.words);
  updateMetrics(snapshot);

  helpers.focusCodePanel(elements.opType.value);
  helpers.clearCodeHighlights();

  const message = `Loaded ${snapshot.words.length} unique words.`;
  helpers.updateStatus(message);
  helpers.appendLog(`${message} [${snapshot.words.join(", ")}]`, "ok");
}

function handleLoadWords() {
  const parsed = parseWordsInput(elements.initialWordsInput.value);
  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }
  loadWords(parsed.words);
}

function handleSampleWords() {
  const words = randomSampleWords();
  elements.initialWordsInput.value = words.join(", ");
  loadWords(words);
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

  elements.loadWordsBtn.addEventListener("click", handleLoadWords);
  elements.sampleWordsBtn.addEventListener("click", handleSampleWords);

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
      l: () => handleLoadWords(),
      r: () => handleSampleWords(),
      1: () => setOperationType("insert"),
      2: () => setOperationType("search"),
      3: () => setOperationType("prefix"),
      4: () => setOperationType("delete"),
    },
  });

  bindDebouncedResize({
    onResize: () => {
      rerenderTreeForResize();
    },
    delayMs: 120,
  });

  handleLoadWords();
}

init();
