# Algorithm Tutorials Playground

Interactive, browser-based labs for learning core data structures:
- `trie/`: insert/search/prefix/delete tracing for Trie
- `segment_tree/`: range update and range query with lazy propagation
- `fenwick_tree/`: point updates and prefix/range sums with BIT

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

## Repository Layout

- `trie/`, `segment_tree/`, `fenwick_tree/`
  - `index.html`: page structure and controls
  - `styles.css`: module-specific theme and layout
  - `app.js`: algorithm tracer + UI wiring
- `shared/tutorial-core.js`: common operation runner, logger, shortcuts, code highlighter
- `shared/tutorial-base.css`: shared layout/control primitives
- `AGENTS.md`: contributor guide for coding, testing, and PR expectations

## Development Notes

- Use modern ES modules (`import`/`export`) and 2-space indentation.
- Keep reusable behavior in `shared/`; keep algorithm logic module-local unless reused.
- Validate syntax quickly with:

```bash
node --input-type=module --check < trie/app.js
node --input-type=module --check < segment_tree/app.js
node --input-type=module --check < fenwick_tree/app.js
```

## Manual Testing Checklist

For each module, verify:
- load/sample/random input flows
- animate/step/instant/finish controls
- keyboard shortcuts
- status metrics and trace log updates
- invalid input handling and index bounds behavior
