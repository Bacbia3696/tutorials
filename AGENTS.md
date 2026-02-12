# Repository Guidelines

## Architecture Snapshot

This repo is a set of standalone tutorial modules plus shared runtime helpers.

- Tutorial modules live in folders like `trie/`, `dijkstra/`, `kruskal/`.
- Each tutorial module should contain:
  - `index.html` (stub that loads `../shared/tutorial-page.js` with `data-tutorial="<id>"`)
  - `app.js` (Lit template + `defineTutorialApp(...)`)
  - `app-runtime.js` (algorithm tracer + DOM/runtime wiring)
  - `styles.css` (module theme/styles)
- Shared infra:
  - `shared/tutorial-registry.js`: source of truth for tutorial IDs, routes, titles, landing cards, fonts, tag names.
  - `shared/tutorial-page.js`: per-module page bootstrap (CSS/font/host/script loading).
  - `shared/tutorial-app.js`: binds tutorial ID to host tag + runtime module.
  - `shared/tutorial-core.js`: operation runner, logger, shortcuts, code highlighting.
  - `shared/tutorial-bootstrap.js`: runner control bindings + resize helper.
  - `shared/runtime-helpers.js`: status/log/code-highlight helper bundle.
  - Graph helpers: `shared/graph-input.js`, `shared/graph-core.js`, `shared/graph-renderer.js`.

Keep algorithm-specific logic inside each tutorial folder. Move code into `shared/` only when reused by at least two modules.

## New Tutorial Playbook (Required Checklist)

When adding a tutorial, complete all steps below.

1. Create module folder and files:
   - `<tutorial_id>/index.html`
   - `<tutorial_id>/app.js`
   - `<tutorial_id>/app-runtime.js`
   - `<tutorial_id>/styles.css`
2. Register tutorial in `shared/tutorial-registry.js`:
   - add ID to `tutorialOrder`
   - add full config entry (`id`, `category`, `route`, `title`, `landing*`, `fontHref`, `tagName`, `moduleEntryPath`)
3. Keep UX parity with existing modules:
   - controls: animate/step/instant/finish + speed slider + clear log
   - keyboard shortcuts via `setupRunnerControls(...)`
   - pseudocode panel with `data-op` and line highlights
   - status + metrics + trace log panels
4. Ensure operation events carry full snapshots (not deltas), so `finishCurrent()` remains correct.
5. Update repo references:
   - add tutorial to `README.md` list + direct URL list
   - update root `index.html` meta description if tutorial list is enumerated there
   - add module to `shared/tests/smoke-check.sh` module array

## Development Commands

No build step is required.

- Serve locally: `python3 -m http.server 4173`
- Shared deterministic tests: `node shared/tests/shared-logic.test.mjs`
- Full smoke check: `shared/tests/smoke-check.sh`
- Syntax check one file: `node --input-type=module --check < <path>/app-runtime.js`

## Style Conventions

- 2-space indentation (HTML/CSS/JS).
- ES modules with semicolons.
- Naming:
  - classes: `PascalCase`
  - functions/variables: `camelCase`
  - CSS classes: `kebab-case`
- Keep parsing/validation helpers small and pure.
- Keep event/render/control wiring explicit and near bottom of `app-runtime.js`.

## Regression Checklist

Manual checks for each tutorial:

1. Load sample/default data and custom valid input.
2. Run all four flows: animated, step, instant, finish.
3. Verify shortcuts, status text, metrics, pseudocode highlighting, and trace log.
4. Verify edge cases: empty/invalid input, duplicates, out-of-range references, disconnected cases (if graph tutorial).
