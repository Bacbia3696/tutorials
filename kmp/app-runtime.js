import { createOperationRunner } from '../shared/tutorial-core.js';
import { setupRunnerControls } from '../shared/tutorial-bootstrap.js';
import { createRuntimeHelpers } from '../shared/runtime-helpers.js';

class KMPTracer {
  snapshot({
    text,
    pattern,
    lps,
    scanTextIndex = null,
    scanPatternIndex = null,
    buildIndex = null,
    prefixLength = null,
    compare = null,
    matches = [],
  }) {
    return {
      text,
      pattern,
      lps: [...lps],
      scanTextIndex,
      scanPatternIndex,
      buildIndex,
      prefixLength,
      compare,
      matches: [...matches],
    };
  }

  computeLps(pattern) {
    const m = pattern.length;
    const lps = new Array(m).fill(0);
    let len = 0;
    let i = 1;

    while (i < m) {
      if (pattern[i] === pattern[len]) {
        len += 1;
        lps[i] = len;
        i += 1;
      } else if (len !== 0) {
        len = lps[len - 1];
      } else {
        lps[i] = 0;
        i += 1;
      }
    }

    return lps;
  }

  generateBuild(pattern, textForSnapshot = '') {
    const events = [];
    const m = pattern.length;
    const lps = new Array(m).fill(0);

    const emit = (message, line, extras = {}) => {
      events.push({
        opType: 'build',
        message,
        line,
        snapshot: this.snapshot({
          text: textForSnapshot,
          pattern,
          lps,
          ...extras,
        }),
        ...extras,
      });
    };

    let len = 0;
    let i = 1;

    emit('Initialize: lps[0]=0, len=0, i=1', 1, {
      buildIndex: i,
      prefixLength: len,
    });

    while (i < m) {
      const equal = pattern[i] === pattern[len];
      emit(`Compare pattern[${i}]='${pattern[i]}' with pattern[${len}]='${pattern[len]}'`, 2, {
        buildIndex: i,
        prefixLength: len,
        compare: {
          patternIndex: i,
          prefixIndex: len,
          equal,
        },
      });

      if (equal) {
        len += 1;
        lps[i] = len;
        emit(`Match: len becomes ${len}, set lps[${i}] = ${len}`, 3, {
          buildIndex: i,
          prefixLength: len,
          compare: {
            patternIndex: i,
            prefixIndex: len - 1,
            equal: true,
          },
        });

        i += 1;
        emit(`Advance i to ${i}`, 4, {
          buildIndex: i < m ? i : null,
          prefixLength: len,
        });
        continue;
      }

      if (len > 0) {
        const fallback = lps[len - 1];
        emit(`Mismatch and len>0: fallback len from ${len} to lps[${len - 1}] = ${fallback}`, 5, {
          buildIndex: i,
          prefixLength: len,
          compare: {
            patternIndex: i,
            prefixIndex: len,
            equal: false,
          },
        });
        len = fallback;
      } else {
        lps[i] = 0;
        emit(`Mismatch and len=0: keep lps[${i}] = 0`, 6, {
          buildIndex: i,
          prefixLength: len,
          compare: {
            patternIndex: i,
            prefixIndex: 0,
            equal: false,
          },
        });
        i += 1;
        emit(`Advance i to ${i}`, 7, {
          buildIndex: i < m ? i : null,
          prefixLength: len,
        });
      }
    }

    emit(`Build complete: lps = [${lps.join(', ')}]`, 8, {
      done: true,
      result: [...lps],
      buildIndex: null,
      prefixLength: len,
    });

    return { events, lps };
  }

  generateSearch(text, pattern) {
    const events = [];
    const n = text.length;
    const m = pattern.length;
    const lps = this.computeLps(pattern);
    const matches = [];

    const emit = (message, line, extras = {}) => {
      events.push({
        opType: 'search',
        message,
        line,
        snapshot: this.snapshot({
          text,
          pattern,
          lps,
          matches,
          ...extras,
        }),
        ...extras,
      });
    };

    emit(`Precompute LPS: [${lps.join(', ')}]`, 1, {
      scanTextIndex: 0,
      scanPatternIndex: 0,
    });

    let i = 0;
    let j = 0;
    emit('Initialize pointers: i=0, j=0', 2, {
      scanTextIndex: i,
      scanPatternIndex: j,
    });

    while (i < n) {
      const equal = text[i] === pattern[j];
      emit(`Compare text[${i}]='${text[i]}' with pattern[${j}]='${pattern[j]}'`, 3, {
        scanTextIndex: i,
        scanPatternIndex: j,
        compare: {
          textIndex: i,
          patternIndex: j,
          equal,
        },
      });

      if (equal) {
        i += 1;
        j += 1;
        emit(`Match step: move to i=${i}, j=${j}`, 4, {
          scanTextIndex: i < n ? i : null,
          scanPatternIndex: j < m ? j : null,
          compare: null,
        });

        if (j === m) {
          const start = i - m;
          matches.push(start);
          emit(`Full match found at start index ${start}`, 5, {
            scanTextIndex: i < n ? i : null,
            scanPatternIndex: j - 1,
          });

          const fallback = lps[j - 1] ?? 0;
          j = fallback;
          emit(`After match, fallback j to lps[${m - 1}] = ${fallback}`, 5, {
            scanTextIndex: i < n ? i : null,
            scanPatternIndex: j,
          });
        }

        continue;
      }

      if (j > 0) {
        const fallback = lps[j - 1];
        emit(`Mismatch with j>0: fallback j from ${j} to lps[${j - 1}] = ${fallback}`, 6, {
          scanTextIndex: i,
          scanPatternIndex: j,
          compare: {
            textIndex: i,
            patternIndex: j,
            equal: false,
          },
        });
        j = fallback;
      } else {
        i += 1;
        emit(`Mismatch with j=0: advance i to ${i}`, 7, {
          scanTextIndex: i < n ? i : null,
          scanPatternIndex: j,
          compare: null,
        });
      }
    }

    emit(
      matches.length > 0
        ? `Search complete: matches at [${matches.join(', ')}]`
        : 'Search complete: no matches found',
      8,
      {
        done: true,
        result: [...matches],
        scanTextIndex: null,
        scanPatternIndex: null,
      },
    );

    return { events, matches, lps };
  }
}

const elements = {
  textInput: document.getElementById('textInput'),
  patternInput: document.getElementById('patternInput'),
  loadBtn: document.getElementById('loadBtn'),
  sampleBtn: document.getElementById('sampleBtn'),
  opType: document.getElementById('opType'),
  animateBtn: document.getElementById('animateBtn'),
  stepBtn: document.getElementById('stepBtn'),
  instantBtn: document.getElementById('instantBtn'),
  finishBtn: document.getElementById('finishBtn'),
  speedRange: document.getElementById('speedRange'),
  speedLabel: document.getElementById('speedLabel'),
  statusMessage: document.getElementById('statusMessage'),
  textLength: document.getElementById('textLength'),
  patternLength: document.getElementById('patternLength'),
  matchCount: document.getElementById('matchCount'),
  lastResult: document.getElementById('lastResult'),
  stepCounter: document.getElementById('stepCounter'),
  textStrip: document.getElementById('textStrip'),
  patternStrip: document.getElementById('patternStrip'),
  lpsStrip: document.getElementById('lpsStrip'),
  matchesList: document.getElementById('matchesList'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  logOutput: document.getElementById('logOutput'),
};

const state = {
  tracer: new KMPTracer(),
  text: '',
  pattern: '',
  lastLps: [],
  lastMatches: [],
  lastResult: null,
  speedMs: Number(elements.speedRange.value),
  lastSnapshot: null,
};

const helpers = createRuntimeHelpers({
  logOutput: elements.logOutput,
  statusMessage: elements.statusMessage,
});

let operationRunner = null;

function normalizeSequence(raw) {
  return raw.trim().toLowerCase();
}

function isValidSequence(value) {
  return /^[a-z]+$/.test(value);
}

function parseTextPattern(rawText, rawPattern) {
  const text = normalizeSequence(rawText);
  const pattern = normalizeSequence(rawPattern);

  if (!text) {
    return { error: 'Text cannot be empty.' };
  }
  if (!pattern) {
    return { error: 'Pattern cannot be empty.' };
  }
  if (!isValidSequence(text)) {
    return { error: 'Text must use letters a-z only.' };
  }
  if (!isValidSequence(pattern)) {
    return { error: 'Pattern must use letters a-z only.' };
  }
  if (text.length > 90) {
    return { error: 'Use text length up to 90 for readability.' };
  }
  if (pattern.length > 40) {
    return { error: 'Use pattern length up to 40 for readability.' };
  }

  return { text, pattern };
}

function sampleCase() {
  const bank = [
    { text: 'ababcabcabababd', pattern: 'ababd' },
    { text: 'aaaaaabaaaba', pattern: 'aaaba' },
    { text: 'abxabcabcabyabcaby', pattern: 'abcaby' },
    { text: 'abcabcabcabc', pattern: 'abcabc' },
    { text: 'aabaaac', pattern: 'aabaa' },
  ];
  const index = Math.floor(Math.random() * bank.length);
  return bank[index];
}

function collectMatchedIndices(matches, patternLength) {
  const covered = new Set();
  for (const start of matches) {
    for (let offset = 0; offset < patternLength; offset += 1) {
      covered.add(start + offset);
    }
  }
  return covered;
}

function renderTextStrip(snapshot) {
  elements.textStrip.innerHTML = '';

  if (!snapshot.text) {
    const empty = document.createElement('div');
    empty.className = 'cell-empty';
    empty.textContent = '(no text loaded)';
    elements.textStrip.appendChild(empty);
    return;
  }

  const matched = collectMatchedIndices(snapshot.matches ?? [], snapshot.pattern.length);
  for (let idx = 0; idx < snapshot.text.length; idx += 1) {
    const cell = document.createElement('div');
    cell.className = 'char-cell';

    if (matched.has(idx)) {
      cell.classList.add('matched');
    }
    if (snapshot.scanTextIndex === idx) {
      cell.classList.add('active');
    }

    const compare = snapshot.compare;
    if (compare && compare.textIndex === idx) {
      cell.classList.add(compare.equal ? 'compare-ok' : 'compare-bad');
    }

    cell.innerHTML = `<span class="cell-index">${idx}</span><span class="cell-char">${snapshot.text[idx]}</span>`;
    elements.textStrip.appendChild(cell);
  }
}

function renderPatternStrip(snapshot) {
  elements.patternStrip.innerHTML = '';

  if (!snapshot.pattern) {
    const empty = document.createElement('div');
    empty.className = 'cell-empty';
    empty.textContent = '(no pattern loaded)';
    elements.patternStrip.appendChild(empty);
    return;
  }

  for (let idx = 0; idx < snapshot.pattern.length; idx += 1) {
    const cell = document.createElement('div');
    cell.className = 'char-cell';

    if (snapshot.scanPatternIndex === idx || snapshot.buildIndex === idx) {
      cell.classList.add('active');
    }
    if (Number.isInteger(snapshot.prefixLength) && idx < snapshot.prefixLength) {
      cell.classList.add('prefix-zone');
    }
    if (
      Number.isInteger(snapshot.prefixLength) &&
      snapshot.prefixLength > 0 &&
      idx === snapshot.prefixLength - 1
    ) {
      cell.classList.add('prefix-tip');
    }

    const compare = snapshot.compare;
    if (compare && compare.patternIndex === idx) {
      cell.classList.add(compare.equal ? 'compare-ok' : 'compare-bad');
    }
    if (compare && compare.prefixIndex === idx) {
      cell.classList.add(compare.equal ? 'compare-ok' : 'compare-bad');
    }

    cell.innerHTML = `<span class="cell-index">${idx}</span><span class="cell-char">${snapshot.pattern[idx]}</span>`;
    elements.patternStrip.appendChild(cell);
  }
}

function renderLpsStrip(snapshot) {
  elements.lpsStrip.innerHTML = '';

  if (!snapshot.pattern) {
    const empty = document.createElement('div');
    empty.className = 'cell-empty';
    empty.textContent = 'Load text/pattern to build LPS view.';
    elements.lpsStrip.appendChild(empty);
    return;
  }

  for (let idx = 0; idx < snapshot.pattern.length; idx += 1) {
    const cell = document.createElement('div');
    cell.className = 'lps-cell';

    if (snapshot.buildIndex === idx || snapshot.scanPatternIndex === idx) {
      cell.classList.add('active');
    }

    const compare = snapshot.compare;
    if (compare && compare.patternIndex === idx) {
      cell.classList.add(compare.equal ? 'compare-ok' : 'compare-bad');
    }
    if (compare && compare.prefixIndex === idx) {
      cell.classList.add(compare.equal ? 'compare-ok' : 'compare-bad');
    }

    const value = snapshot.lps[idx] ?? 0;
    cell.innerHTML = `
      <span class="lps-idx">i=${idx}</span>
      <span class="lps-char">${snapshot.pattern[idx]}</span>
      <span class="lps-val">${value}</span>
    `;
    elements.lpsStrip.appendChild(cell);
  }
}

function renderMatches(snapshot) {
  elements.matchesList.innerHTML = '';

  if (!snapshot.matches || snapshot.matches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'match-chip empty';
    empty.textContent = '(no matches yet)';
    elements.matchesList.appendChild(empty);
    return;
  }

  for (const start of snapshot.matches) {
    const chip = document.createElement('div');
    chip.className = 'match-chip';
    const end = start + snapshot.pattern.length - 1;
    chip.textContent = `start=${start}, end=${end}`;
    elements.matchesList.appendChild(chip);
  }
}

function baseSnapshot() {
  return {
    text: state.text,
    pattern: state.pattern,
    lps: [...state.lastLps],
    scanTextIndex: null,
    scanPatternIndex: null,
    buildIndex: null,
    prefixLength: null,
    compare: null,
    matches: [...state.lastMatches],
  };
}

function renderSnapshot(snapshot) {
  const snap = snapshot ?? baseSnapshot();
  state.lastSnapshot = snap;
  renderTextStrip(snap);
  renderPatternStrip(snap);
  renderLpsStrip(snap);
  renderMatches(snap);
}

function updateMetrics() {
  elements.textLength.textContent = String(state.text.length);
  elements.patternLength.textContent = String(state.pattern.length);
  elements.matchCount.textContent = String(state.lastMatches.length);
  elements.lastResult.textContent = state.lastResult === null ? '-' : String(state.lastResult);

  const step = operationRunner ? operationRunner.eventIndex : 0;
  const total = operationRunner ? operationRunner.pendingLength : 0;
  elements.stepCounter.textContent = `${step} / ${total}`;
}

function arrayEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function naiveSearch(text, pattern) {
  const matches = [];
  const n = text.length;
  const m = pattern.length;

  for (let start = 0; start + m <= n; start += 1) {
    let ok = true;
    for (let j = 0; j < m; j += 1) {
      if (text[start + j] !== pattern[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      matches.push(start);
    }
  }

  return matches;
}

function finalizePendingOperation(meta) {
  if (meta.opType === 'build') {
    state.lastLps = [...meta.lps];
    state.lastMatches = [];
    state.lastResult = `lps ready (${state.lastLps.length} values)`;
  } else {
    state.lastLps = [...meta.lps];
    state.lastMatches = [...meta.matches];
    state.lastResult = meta.matches.length > 0 ? `${meta.matches.length} match(es)` : 'no match';
  }

  const mismatch =
    Array.isArray(meta.naiveMatches) && !arrayEqual(meta.naiveMatches, meta.matches ?? []);

  const summary = mismatch
    ? `${meta.summary} (warning: naive=[${meta.naiveMatches.join(', ')}])`
    : meta.summary;

  helpers.updateStatus(summary);
  helpers.appendLog(summary, mismatch ? '' : 'ok');

  renderSnapshot(null);
  helpers.clearCodeHighlights();
  updateMetrics();
}

function applyEvent(event) {
  renderSnapshot(event.snapshot);
  helpers.highlightCode(event.opType, event.line);
  helpers.updateStatus(event.message);
}

function prepareOperation() {
  if (!state.text || !state.pattern) {
    const message = 'Load text and pattern first.';
    helpers.updateStatus(message);
    helpers.appendLog(message);
    return null;
  }

  const opType = elements.opType.value;

  if (opType === 'build') {
    const trace = state.tracer.generateBuild(state.pattern, state.text);
    return {
      opType,
      events: trace.events,
      lps: trace.lps,
      summary: `Built LPS: [${trace.lps.join(', ')}]`,
    };
  }

  const trace = state.tracer.generateSearch(state.text, state.pattern);
  const naiveMatches = naiveSearch(state.text, state.pattern);

  return {
    opType,
    events: trace.events,
    lps: trace.lps,
    matches: trace.matches,
    naiveMatches,
    summary:
      trace.matches.length > 0
        ? `KMP matches at [${trace.matches.join(', ')}]`
        : 'KMP search found no matches.',
  };
}

function loadTextPattern(text, pattern) {
  operationRunner.stop();
  operationRunner.ensureNoPending();

  state.text = text;
  state.pattern = pattern;
  state.lastLps = new Array(pattern.length).fill(0);
  state.lastMatches = [];
  state.lastResult = null;

  renderSnapshot(null);
  updateMetrics();
  helpers.focusCodePanel(elements.opType.value);
  helpers.clearCodeHighlights();

  const message = `Loaded text (n=${text.length}) and pattern (m=${pattern.length}).`;
  helpers.updateStatus(message);
  helpers.appendLog(message, 'ok');
}

function handleLoad() {
  const parsed = parseTextPattern(elements.textInput.value, elements.patternInput.value);
  if (parsed.error) {
    helpers.updateStatus(parsed.error);
    helpers.appendLog(parsed.error);
    return;
  }
  loadTextPattern(parsed.text, parsed.pattern);
}

function handleSample() {
  const sample = sampleCase();
  elements.textInput.value = sample.text;
  elements.patternInput.value = sample.pattern;
  loadTextPattern(sample.text, sample.pattern);
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
      helpers.appendLog(
        `Prepared ${operation.opType} operation with ${operation.events.length} trace steps.`,
      );
    },
    onNoPending: () => {
      helpers.updateStatus('No pending operation.');
    },
  });

  elements.loadBtn.addEventListener('click', handleLoad);
  elements.sampleBtn.addEventListener('click', handleSample);

  elements.opType.addEventListener('change', () => {
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
      1: () => setOperationType('build'),
      2: () => setOperationType('search'),
    },
  });

  handleLoad();
}

init();
