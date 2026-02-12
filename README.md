# Algorithm Tutorials Playground

Interactive, browser-based labs for learning core data structures and graph algorithms:
- `trie/`: insert/search/prefix/delete tracing for Trie
- `segment_tree/`: range update and range query with lazy propagation
- `fenwick_tree/`: point updates and prefix/range sums with BIT
- `dijkstra/`: shortest paths in weighted graphs with step-by-step relaxation tracing
- `bellman_ford/`: pass-by-pass relaxation tracing with negative-cycle detection
- `topological_sort/`: Kahn's algorithm tracing for queue/indegree/order evolution

Each tutorial is a standalone HTML/CSS/JS module and reuses shared runtime utilities from `shared/`.
All tutorials are mounted through Lit custom elements in `app.js`.
Algorithm/runtime logic lives in `app-runtime.js`.

## Run Locally

No build step is required.
Internet access is required at runtime to fetch Lit ESM imports from CDN (`shared/lit.js`).

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/` for the landing page, or navigate directly to a tutorial:
- `http://localhost:4173/trie/`
- `http://localhost:4173/segment_tree/`
- `http://localhost:4173/fenwick_tree/`
- `http://localhost:4173/dijkstra/`
- `http://localhost:4173/bellman_ford/`
- `http://localhost:4173/topological_sort/`

## Repository Layout

- `index.html`: landing page linking to every tutorial
- `trie/`, `segment_tree/`, `fenwick_tree/`, `dijkstra/`, `bellman_ford/`, `topological_sort/`
  - `index.html`: page shell that mounts a Lit custom element
  - `styles.css`: module-specific theme and layout
  - `app.js`: Lit host component template + runtime bootstrap
  - `app-runtime.js`: algorithm tracer + UI wiring
- `shared/tutorial-core.js`: common operation runner, logger, shortcuts, code highlighter
- `shared/tutorial-bootstrap.js`: common runner-control bindings and debounced resize wiring
- `shared/cache-bust.js`: shared dev cache-busting loader for local CSS/JS assets
- `shared/tutorial-lit-host.js`: shared Lit host wrapper for runtime bootstrap and cache-busted dynamic import
- `shared/graph-core.js`: shared SVG graph geometry/math helpers for graph tutorials
- `shared/graph-renderer.js`: shared SVG graph rendering helpers (canvas prep, edges, nodes, arrow markers)
- `shared/graph-input.js`: shared graph input normalization/parsing/validation helpers
- `shared/tutorial-base.css`: shared layout/control primitives
- `shared/array-input.js`: shared integer-array parsing and random-array generation
- `shared/lit.js`: shared Lit runtime imports used by Lit-migrated tutorials
- `shared/tests/shared-logic.test.mjs`: deterministic shared logic tests (parser + runner behavior)
- `shared/tests/smoke-check.sh`: repo-wide syntax + shared-logic smoke checks
- `shared/tests/manual-regression-checklist.md`: per-module manual regression checklist
- `AGENTS.md`: contributor guide for coding, testing, and PR expectations

## Development Notes

- Use modern ES modules (`import`/`export`) and 2-space indentation.
- Keep reusable behavior in `shared/`; keep algorithm logic module-local unless reused.
- Tutorial pages apply automatic cache-busting for local CSS/JS on each load, so browser stale-cache issues are avoided during development.
- **CDN dependency:** `shared/lit.js` fetches Lit from `https://esm.sh/lit@3.3.1`. Internet access is required at runtime. If the CDN or that exact version becomes unavailable, all tutorials will fail to load — consider pinning to a local copy if deploying in an offline or long-lived environment.
- Validate syntax quickly with:

```bash
shared/tests/smoke-check.sh
```

## Manual Testing Checklist

See:
- `shared/tests/manual-regression-checklist.md`
