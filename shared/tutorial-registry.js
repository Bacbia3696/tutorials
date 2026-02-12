const tutorialOrder = [
  "trie",
  "segment_tree",
  "sparse_segment_tree",
  "fenwick_tree",
  "dsu",
  "dijkstra",
  "bellman_ford",
  "kruskal",
  "topological_sort",
];

function freezeTutorial(config) {
  return Object.freeze({
    ...config,
    landingTags: Object.freeze([...(config.landingTags ?? [])]),
  });
}

export const tutorialRegistry = Object.freeze({
  trie: freezeTutorial({
    id: "trie",
    category: "ds",
    route: "trie/",
    title: "Trie Tutorial Lab",
    description:
      "Interactive Trie tutorial. Trace insert, search, prefix, and delete operations step-by-step through a Trie data structure.",
    landingTitle: "Trie",
    landingDescription:
      "Insert, search, prefix-check, and delete words in a prefix tree. Watch nodes appear and edges light up as each character is consumed.",
    landingTags: ["insert", "search", "prefix", "delete"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "trie-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  segment_tree: freezeTutorial({
    id: "segment_tree",
    category: "ds",
    route: "segment_tree/",
    title: "Lazy Propagation Lab",
    description:
      "Interactive Segment Tree tutorial with lazy propagation. Trace range update and range query operations step-by-step.",
    landingTitle: "Segment Tree + Lazy Propagation",
    landingDescription:
      "Range updates and range queries on an array backed by a segment tree. See how lazy values propagate down through the tree.",
    landingTags: ["range-add", "range-query", "lazy-propagation"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "segment-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  sparse_segment_tree: freezeTutorial({
    id: "sparse_segment_tree",
    category: "ds",
    route: "sparse_segment_tree/",
    title: "Sparse Segment Tree Lab",
    description:
      "Interactive Sparse Segment Tree tutorial. Explore dynamic node creation for point updates and range sum queries over huge index spaces.",
    landingTitle: "Sparse Segment Tree",
    landingDescription:
      "Dynamic segment tree for huge index spaces. Nodes are created lazily only along touched paths, so untouched ranges consume zero extra memory.",
    landingTags: ["dynamic-nodes", "point-update", "range-query"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "sparse-segment-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  fenwick_tree: freezeTutorial({
    id: "fenwick_tree",
    category: "ds",
    route: "fenwick_tree/",
    title: "Fenwick Tree Tutorial Lab",
    description:
      "Interactive Fenwick Tree (Binary Indexed Tree) tutorial. Trace point updates, prefix queries, and range queries step-by-step.",
    landingTitle: "Fenwick Tree (BIT)",
    landingDescription:
      "Point updates, prefix sums, and range queries. Follow the lowbit jumps through the coverage map and the binary index timeline.",
    landingTags: ["point-update", "prefix-sum", "range-query"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "fenwick-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  dsu: freezeTutorial({
    id: "dsu",
    category: "ds",
    route: "dsu/",
    title: "Disjoint Set Union Tutorial Lab",
    description:
      "Interactive Disjoint Set Union (Union-Find) tutorial. Trace union, find, and connected operations step-by-step with path compression and union by rank.",
    landingTitle: "Disjoint Set Union (Union-Find)",
    landingDescription:
      "Merge sets and find representatives with path compression and union by rank. Watch the forest of trees evolve as elements are connected.",
    landingTags: ["union", "find", "path-compression", "union-by-rank"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "dsu-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  dijkstra: freezeTutorial({
    id: "dijkstra",
    category: "graph",
    route: "dijkstra/",
    title: "Dijkstra Shortest Path Lab",
    description:
      "Interactive Dijkstra's algorithm tutorial. Trace shortest path computations with step-by-step relaxation and priority queue visualization.",
    landingTitle: "Dijkstra's Algorithm",
    landingDescription:
      "Find shortest paths in weighted graphs with non-negative edges. Watch the priority queue, edge relaxation, and distance table update in real time.",
    landingTags: ["shortest-path", "priority-queue", "relaxation"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Fira+Mono:wght@400;500&display=swap",
    tagName: "dijkstra-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  bellman_ford: freezeTutorial({
    id: "bellman_ford",
    category: "graph",
    route: "bellman_ford/",
    title: "Bellman-Ford Tutorial Lab",
    description:
      "Interactive Bellman-Ford algorithm tutorial. Trace pass-by-pass relaxation with negative-cycle detection step-by-step.",
    landingTitle: "Bellman-Ford",
    landingDescription:
      "Shortest paths with negative-weight edges. Trace each relaxation pass across every edge and see negative-cycle detection in action.",
    landingTags: ["shortest-path", "negative-weights", "cycle-detection"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "bellman-ford-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  kruskal: freezeTutorial({
    id: "kruskal",
    category: "graph",
    route: "kruskal/",
    title: "Kruskal's Algorithm Tutorial Lab",
    description:
      "Interactive Kruskal's algorithm tutorial. Trace sorted-edge processing and DSU-based cycle checks while building a minimum spanning tree step-by-step.",
    landingTitle: "Kruskal's Algorithm",
    landingDescription:
      "Build a minimum spanning tree by processing edges in weight order and using Union-Find to reject cycle-forming edges.",
    landingTags: ["mst", "union-find", "greedy", "cycle-check"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;700;800&family=Roboto+Mono:wght@400;500&display=swap",
    tagName: "kruskal-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  topological_sort: freezeTutorial({
    id: "topological_sort",
    category: "graph",
    route: "topological_sort/",
    title: "Topological Sort Tutorial Lab",
    description:
      "Interactive topological sort tutorial using Kahn's algorithm. Trace queue, indegree, and ordering evolution step-by-step.",
    landingTitle: "Topological Sort",
    landingDescription:
      "Order a directed acyclic graph with Kahn's algorithm. Watch the indegree table, the BFS queue, and the output ordering evolve.",
    landingTags: ["kahn's", "indegree", "DAG"],
    fontHref:
      "https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;600;700;800&family=Source+Code+Pro:wght@400;500&display=swap",
    tagName: "topological-sort-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
});

export const tutorialList = Object.freeze(
  tutorialOrder.map((tutorialId) => tutorialRegistry[tutorialId]).filter(Boolean),
);

export const tutorialGroups = Object.freeze({
  ds: Object.freeze(tutorialList.filter((tutorial) => tutorial.category === "ds")),
  graph: Object.freeze(tutorialList.filter((tutorial) => tutorial.category === "graph")),
});

export function getTutorialConfig(tutorialId) {
  if (!tutorialId) {
    return null;
  }
  return tutorialRegistry[tutorialId] ?? null;
}
