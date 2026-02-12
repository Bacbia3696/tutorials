# Shared Tutorial Core

Reusable module for all algorithm tutorials in this repo.

## File

- `shared/tutorial-core.js`
- `shared/tutorial-bootstrap.js`
- `shared/tutorial-base.css`
- `shared/cache-bust.js`
- `shared/graph-core.js`
- `shared/graph-renderer.js`
- `shared/graph-input.js`

## What it provides

- `createOperationRunner(...)`
  - Shared step/animate/instant execution engine.
  - Handles pending operation lifecycle, playback control, and progress updates.
- `createLogger(logElement)`
  - Shared trace-log writer (`append`, `clear`).
- `createCodeHighlighter(panelSelector)`
  - Shared pseudocode panel focus + active-line highlighting.
- `bindShortcutHandler({ actions, ... })`
  - Shared keyboard shortcut binding with typing-safe default behavior.
- `isTypingTarget(target)`
  - Utility for input-focus checks.
- `setupRunnerControls(...)` (`tutorial-bootstrap.js`)
  - Shared wiring for animate/step/instant/finish controls, speed slider, clear-log action, and keyboard shortcuts.
- `bindDebouncedResize(...)` (`tutorial-bootstrap.js`)
  - Shared debounced `resize` listener binding used by tree-based tutorials.
- `cache-bust.js`
  - Shared dev helper to append cache-busting query params to local tutorial CSS and JS files.
  - Exposes `window.loadTutorialModule("./app.js")` for no-stale script loading.
- Shared CSS foundation (`tutorial-base.css`)
  - Layout shell (`body`, `.layout`, `.panel`)
  - Controls (`.control-group`, form fields, `.btn*`)
  - Utility rows (`.row`, `.row.wrap`, `.row.between`)
  - Status + log primitives (`.status`, `.metric-label`, `.log-entry`)
  - Shortcut styling (`.key-hint`, `kbd`)
- Graph SVG utilities (`graph-core.js`)
  - `createSvgElement(tag, attrs)`: SVG element creation helper.
  - `getSvgCanvasSize(svg, fallback)`: safe responsive canvas sizing.
  - `computeCircularNodePositions(...)`: reusable node layout in circular/elliptic form.
  - `computeEdgeGeometry(...)`: reusable edge path + label geometry (line or curved).
- Graph SVG rendering helpers (`graph-renderer.js`)
  - `prepareGraphCanvas(...)`: shared canvas sizing + empty-state rendering.
  - `ensureArrowMarker(...)`: reusable directed-edge marker setup.
  - `renderGraphEdges(...)`: shared edge path/label rendering pipeline.
  - `renderGraphNodes(...)`: shared node group rendering pipeline.
  - `createDirectedPairSet(...)`, `getReverseCurveOffset(...)`: shared helpers for bidirectional edge curvature.
- Graph input helpers (`graph-input.js`)
  - `parseNodeLabelsInput(...)`: shared node-label parsing/normalization/validation.
  - `parseWeightedEdgesInput(...)`: shared weighted edge parsing/validation for directed/undirected modes.
  - `parseDirectedEdgesInput(...)`: shared unweighted directed edge parsing/validation.
  - `createLabelToIndex(...)`, `edgeKeyForMode(...)`: utility helpers reused by graph tutorials.

## How to use in a tutorial

1. Add shared CSS + module script in HTML:

```html
<link rel="stylesheet" href="../shared/tutorial-base.css" />
<script type="module" src="app.js"></script>
```

2. Define tutorial theme variables in local `styles.css`:

```css
:root {
  --font-sans: "...";
  --font-mono: "...";
  --page-bg: ...;
  --layout-max-width: 1200px;
  --panel-bg: ...;
  --btn-primary-bg: ...;
}
```

3. Import helpers in tutorial JS:

```js
import {
  bindShortcutHandler,
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
```

4. Wire the runner:

```js
const runner = createOperationRunner({
  getSpeedMs: () => state.speedMs,
  prepareOperation,
  applyEvent,
  updateMetrics,
  finalizeOperation,
  onPrepared: (operation) => logger.append(`Prepared ${operation.opType}`),
  onNoPending: () => updateStatus("No pending operation."),
});
```

5. Use runner actions in buttons + shortcuts:

- `runner.runAnimated()`
- `runner.step()`
- `runner.runInstant()`
- `runner.finishCurrent()`

This keeps future tutorials consistent and reduces duplicated control logic.

## Deterministic shared tests

Run:

```bash
node shared/tests/shared-logic.test.mjs
```

This validates shared parser behavior and `createOperationRunner(...)` lifecycle semantics.
