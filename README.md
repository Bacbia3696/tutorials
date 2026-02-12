# Algorithm Tutorials Playground

Interactive, browser-based labs for learning core data structures and graph algorithms:
- `trie/`: insert/search/prefix/delete tracing for Trie
- `segment_tree/`: range update and range query with lazy propagation
- `sparse_segment_tree/`: dynamic segment tree with lazy node creation over large index spaces
- `fenwick_tree/`: point updates and prefix/range sums with BIT
- `dsu/`: union/find/connected tracing with path compression and union by rank
- `dijkstra/`: shortest paths in weighted graphs with step-by-step relaxation tracing
- `bellman_ford/`: pass-by-pass relaxation tracing with negative-cycle detection
- `kruskal/`: minimum spanning tree construction with sorted-edge + DSU cycle checks
- `eulerian_path/`: Eulerian path detection + construction with Hierholzer stack traversal
- `topological_sort/`: Kahn's algorithm tracing for queue/indegree/order evolution

Each tutorial is a standalone HTML/CSS/JS module and reuses shared runtime utilities from `shared/`.
Tutorial metadata is centralized in `shared/tutorial-registry.js`.
Tutorial page shell bootstrap lives in `shared/tutorial-page.js`, landing cards are rendered by `shared/landing-page.js`, and tutorial app host wiring is centralized in `shared/tutorial-app.js`.
All tutorials are mounted through Lit custom elements in `app.js`, and algorithm/runtime logic lives in `app-runtime.js`.

## Run Locally

No build step is required.
Internet access is required at runtime to fetch Lit ESM imports from CDN (`shared/lit.js`).

### Basic Static Server (No Live Reload)

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/` for the landing page, or navigate directly to a tutorial:
- `http://localhost:4173/trie/`
- `http://localhost:4173/segment_tree/`
- `http://localhost:4173/sparse_segment_tree/`
- `http://localhost:4173/fenwick_tree/`
- `http://localhost:4173/dijkstra/`
- `http://localhost:4173/dsu/`
- `http://localhost:4173/bellman_ford/`
- `http://localhost:4173/kruskal/`
- `http://localhost:4173/eulerian_path/`
- `http://localhost:4173/topological_sort/`

## Repository Layout

- `index.html`: landing page skeleton rendered from `shared/tutorial-registry.js` via `shared/landing-page.js`
- `trie/`, `segment_tree/`, `sparse_segment_tree/`, `fenwick_tree/`, `dsu/`, `dijkstra/`, `bellman_ford/`, `kruskal/`, `eulerian_path/`, `topological_sort/`
  - `index.html`: minimal page stub that delegates bootstrapping to `shared/tutorial-page.js`
  - `styles.css`: module-specific theme and layout
  - `app.js`: Lit host component template + runtime bootstrap
  - `app-runtime.js`: algorithm tracer + UI wiring
- `shared/tutorial-core.js`: common operation runner, logger, shortcuts, code highlighter
- `shared/tutorial-bootstrap.js`: common runner-control bindings and debounced resize wiring
- `shared/tutorial-registry.js`: centralized tutorial metadata (routing, page bootstrap, landing-card content)
- `shared/tutorial-page.js`: shared per-tutorial page bootstrap (head assets + host mount + module load)
- `shared/landing-page.js`: shared landing-page card renderer driven by `shared/tutorial-registry.js`
- `shared/tutorial-app.js`: shared tutorial-app bootstrap helper that binds registry `tagName` + runtime module loading
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
