# Shared Tutorial Core

Reusable module for all algorithm tutorials in this repo.

## File

- `shared/tutorial-core.js`
- `shared/tutorial-bootstrap.js`
- `shared/tutorial-lit-host.js`
- `shared/tutorial-base.css`
- `shared/lit.js`
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
- `tutorial-lit-host.js`
  - Shared Lit host wrapper that mounts light-DOM templates and lazy-loads `app-runtime.js`.
  - Replaces repeated custom-element bootstrap boilerplate across tutorials.
- `lit.js`
  - Shared Lit runtime import wrapper for browser ESM usage (via CDN URL imports).
  - Exposes `LitElement` and `html` for Lit component migration.
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

1. Add shared CSS + cache-bust loader in HTML:

```html
<link rel="stylesheet" href="../shared/tutorial-base.css" />
<script src="../shared/cache-bust.js"></script>
```

2. Mount your Lit host component and load `app.js` through cache busting:

```html
<your-tutorial-app></your-tutorial-app>
<script>
  window.loadTutorialModule("./app.js");
</script>
```

3. Define the Lit host in `app.js`:

```js
import { html } from "../shared/lit.js";
import { defineTutorialLitHost } from "../shared/tutorial-lit-host.js";

defineTutorialLitHost({
  tagName: "your-tutorial-app",
  runtimeModulePath: "./app-runtime.js",
  renderTemplate: () => html`<main class="layout">...</main>`,
});
```

This ensures existing imperative DOM wiring in `app-runtime.js` initializes only after IDs are rendered.

4. Define tutorial theme variables in local `styles.css`:

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

5. Import helpers in tutorial JS:

```js
import {
  bindShortcutHandler,
  createCodeHighlighter,
  createLogger,
  createOperationRunner,
} from "../shared/tutorial-core.js";
```

6. Wire the runner:

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

7. Use runner actions in buttons + shortcuts:

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
