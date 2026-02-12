# Manual Regression Checklist

Use this after UI/runtime changes.

## Common checks (all modules)

- Load the page and confirm no console errors.
- Run `Animate`, `Step`, `Apply Instantly`, and `Finish Current`.
- Verify keyboard shortcuts shown in the key-hint panel.
- Change speed slider and confirm label updates.
- Clear log and verify log panel resets.
- Enter invalid input and verify helpful status message.

## Module-specific checks

### `trie/`
- Load words, run `insert`, `search`, `prefix`, `delete`.
- Verify node highlight and code-line highlight track each step.
- Resize window and confirm tree layout reflows correctly.

### `segment_tree/`
- Run range update and range query on overlapping and disjoint ranges.
- Verify lazy values appear and clear as recursion progresses.
- Confirm root sum and query result metrics stay consistent.

### `fenwick_tree/`
- Run point update, prefix query, and range query.
- Verify jump timeline reflects index transitions by `lowbit`.
- Confirm BIT rows and coverage map update after each operation.

### `dijkstra/`
- Test directed and undirected modes.
- Run with and without target node selected.
- Verify frontier pills, settled nodes, and reconstructed path labels.

### `bellman_ford/`
- Test graph with negative edges but no negative cycle.
- Test graph that contains a negative cycle.
- Verify pass strip and cycle metric reflect detection behavior.

### `topological_sort/`
- Test valid DAG and confirm full topological order.
- Test graph with cycle and verify cycle indicator/status.
- Verify queue and order strips update in lockstep with steps.
