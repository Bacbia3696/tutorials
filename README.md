# Algorithm Tutorials Playground

Interactive, browser-based labs for learning core data structures and graph algorithms:
- `trie/`: insert/search/prefix/delete tracing for Trie
- `segment_tree/`: range update and range query with lazy propagation
- `fenwick_tree/`: point updates and prefix/range sums with BIT
- `dijkstra/`: shortest paths in weighted graphs with step-by-step relaxation tracing
- `bellman_ford/`: pass-by-pass relaxation tracing with negative-cycle detection
- `topological_sort/`: Kahn's algorithm tracing for queue/indegree/order evolution

Each tutorial is a standalone HTML/CSS/JS module and reuses shared runtime utilities from `shared/`.

## Run Locally

No build step is required.

```bash
python3 -m http.server 4173
```

Then open:
- `http://localhost:4173/trie/`
- `http://localhost:4173/segment_tree/`
- `http://localhost:4173/fenwick_tree/`
- `http://localhost:4173/dijkstra/`
- `http://localhost:4173/bellman_ford/`
- `http://localhost:4173/topological_sort/`

## Repository Layout

- `trie/`, `segment_tree/`, `fenwick_tree/`, `dijkstra/`, `bellman_ford/`, `topological_sort/`
  - `index.html`: page structure and controls
  - `styles.css`: module-specific theme and layout
  - `app.js`: algorithm tracer + UI wiring
- `shared/tutorial-core.js`: common operation runner, logger, shortcuts, code highlighter
- `shared/tutorial-bootstrap.js`: common runner-control bindings and debounced resize wiring
- `shared/cache-bust.js`: shared dev cache-busting loader for local CSS/JS assets
- `shared/graph-core.js`: shared SVG graph geometry/math helpers for graph tutorials
- `shared/graph-renderer.js`: shared SVG graph rendering helpers (canvas prep, edges, nodes, arrow markers)
- `shared/graph-input.js`: shared graph input normalization/parsing/validation helpers
- `shared/tutorial-base.css`: shared layout/control primitives
- `shared/tests/shared-logic.test.mjs`: deterministic shared logic tests (parser + runner behavior)
- `AGENTS.md`: contributor guide for coding, testing, and PR expectations

## Development Notes

- Use modern ES modules (`import`/`export`) and 2-space indentation.
- Keep reusable behavior in `shared/`; keep algorithm logic module-local unless reused.
- Tutorial pages apply automatic cache-busting for local CSS/JS on each load, so browser stale-cache issues are avoided during development.
- Validate syntax quickly with:

```bash
node --input-type=module --check < trie/app.js
node --input-type=module --check < segment_tree/app.js
node --input-type=module --check < fenwick_tree/app.js
node --input-type=module --check < dijkstra/app.js
node --input-type=module --check < bellman_ford/app.js
node --input-type=module --check < topological_sort/app.js
node shared/tests/shared-logic.test.mjs
```

## Manual Testing Checklist

For each module, verify:
- load/sample/random input flows
- animate/step/instant/finish controls
- keyboard shortcuts
- status metrics and trace log updates
- invalid input handling and index bounds behavior
