# Shared Tutorial Core

Reusable module for all algorithm tutorials in this repo.

## File

- `shared/tutorial-core.js`
- `shared/tutorial-base.css`
- `shared/graph-core.js`
- `shared/graph-renderer.js`

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
