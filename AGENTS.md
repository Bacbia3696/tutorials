# Repository Guidelines

## Project Structure & Module Organization
This repository contains three standalone tutorial apps and one shared core:
- `trie/`, `segment_tree/`, `fenwick_tree/`: each module has `index.html`, `styles.css`, and `app.js`.
- `shared/tutorial-core.js`: reusable interaction/runtime helpers (runner, logger, shortcuts, code highlighting).
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
- Optional syntax check:
  - `node --input-type=module --check < trie/app.js` (repeat for other JS files)

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML, CSS, and JavaScript.
- Use semicolons and modern ES module syntax (`import`/`export`).
- Naming:
  - Classes: `PascalCase` (for example, `FenwickTracer`).
  - Functions/variables: `camelCase` (for example, `parseArrayInput`).
  - CSS classes: kebab-case (for example, `code-panel`, `key-hint`).
- Prefer small, pure helper functions for parsing/validation and keep DOM wiring near the bottom of `app.js`.

## Testing Guidelines
There is no automated test framework configured yet. Use manual regression checks per module:
- load sample/default data;
- run animated, step, instant, and finish flows;
- verify keyboard shortcuts and status/metric updates;
- confirm edge cases (empty input, invalid tokens, out-of-range indices).

If you introduce non-trivial shared logic in `shared/tutorial-core.js`, include deterministic unit tests when a test harness is added.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (existing history uses `feat:`), e.g. `feat(trie): add delete trace pruning`.
- Keep commits focused to one module or one shared concern.
- PRs should include:
  - concise summary of behavior changes,
  - affected paths (for example, `trie/app.js`, `shared/tutorial-core.js`),
  - manual test notes and screenshots/GIFs for UI changes.
