# Repository Guidelines

## Project Structure & Module Organization
This repository contains six standalone tutorial apps and a shared core:
- `trie/`, `segment_tree/`, `fenwick_tree/`, `dijkstra/`, `bellman_ford/`, `topological_sort/`: each module has `index.html`, `styles.css`, and `app.js`.
- `shared/tutorial-core.js`: reusable interaction/runtime helpers (runner, logger, shortcuts, code highlighting).
- `shared/tutorial-bootstrap.js`: common UI wiring helpers for runner controls and debounced resize listeners.
- `shared/graph-core.js`, `shared/graph-renderer.js`: reusable graph geometry/rendering helpers.
- `shared/graph-input.js`: reusable graph input normalization/parsing/validation helpers.
- `shared/tutorial-base.css`: shared layout/control primitives used by all tutorials.

Keep algorithm-specific logic inside each module folder. Put cross-tutorial utilities in `shared/` only when reused by at least two modules.

## Build, Test, and Development Commands
No build step or package manager is required; this is plain HTML/CSS/ES modules.

- `python3 -m http.server 4173`
  - Serves the repo locally at `http://localhost:4173`.
- Open module pages directly:
  - `http://localhost:4173/trie/`
  - `http://localhost:4173/segment_tree/`
  - `http://localhost:4173/fenwick_tree/`
  - `http://localhost:4173/dijkstra/`
  - `http://localhost:4173/bellman_ford/`
  - `http://localhost:4173/topological_sort/`
- Optional syntax check:
  - `node --input-type=module --check < trie/app.js` (repeat for other JS files)
- Deterministic shared-logic tests:
  - `node shared/tests/shared-logic.test.mjs`

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML, CSS, and JavaScript.
- Use semicolons and modern ES module syntax (`import`/`export`).
- Naming:
  - Classes: `PascalCase` (for example, `FenwickTracer`).
  - Functions/variables: `camelCase` (for example, `parseArrayInput`).
  - CSS classes: kebab-case (for example, `code-panel`, `key-hint`).
- Prefer small, pure helper functions for parsing/validation and keep DOM wiring near the bottom of `app.js`.

## Testing Guidelines
Use manual regression checks per module:
- load sample/default data;
- run animated, step, instant, and finish flows;
- verify keyboard shortcuts and status/metric updates;
- confirm edge cases (empty input, invalid tokens, out-of-range indices).

Run deterministic shared tests after changing shared parsing/runner logic:
- `node shared/tests/shared-logic.test.mjs`

## Commit & Pull Request Guidelines
- Follow Conventional Commits (existing history uses `feat:`), e.g. `feat(trie): add delete trace pruning`.
- Keep commits focused to one module or one shared concern.
- PRs should include:
  - concise summary of behavior changes,
  - affected paths (for example, `trie/app.js`, `shared/tutorial-core.js`),
  - manual test notes and screenshots/GIFs for UI changes.
