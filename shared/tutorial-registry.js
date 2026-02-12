export const tutorialRegistry = Object.freeze({
  trie: Object.freeze({
    id: "trie",
    route: "/trie/",
    title: "Trie Tutorial Lab",
    description:
      "Interactive Trie tutorial. Trace insert, search, prefix, and delete operations step-by-step through a Trie data structure.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "trie-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  segment_tree: Object.freeze({
    id: "segment_tree",
    route: "/segment_tree/",
    title: "Lazy Propagation Lab",
    description:
      "Interactive Segment Tree tutorial with lazy propagation. Trace range update and range query operations step-by-step.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "segment-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  sparse_segment_tree: Object.freeze({
    id: "sparse_segment_tree",
    route: "/sparse_segment_tree/",
    title: "Sparse Segment Tree Lab",
    description:
      "Interactive Sparse Segment Tree tutorial. Explore dynamic node creation for point updates and range sum queries over huge index spaces.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "sparse-segment-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  fenwick_tree: Object.freeze({
    id: "fenwick_tree",
    route: "/fenwick_tree/",
    title: "Fenwick Tree Tutorial Lab",
    description:
      "Interactive Fenwick Tree (Binary Indexed Tree) tutorial. Trace point updates, prefix queries, and range queries step-by-step.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "fenwick-tree-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  dsu: Object.freeze({
    id: "dsu",
    route: "/dsu/",
    title: "Disjoint Set Union Tutorial Lab",
    description:
      "Interactive Disjoint Set Union (Union-Find) tutorial. Trace union, find, and connected operations step-by-step with path compression and union by rank.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap",
    tagName: "dsu-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  dijkstra: Object.freeze({
    id: "dijkstra",
    route: "/dijkstra/",
    title: "Dijkstra Shortest Path Lab",
    description:
      "Interactive Dijkstra's algorithm tutorial. Trace shortest path computations with step-by-step relaxation and priority queue visualization.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Fira+Mono:wght@400;500&display=swap",
    tagName: "dijkstra-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  bellman_ford: Object.freeze({
    id: "bellman_ford",
    route: "/bellman_ford/",
    title: "Bellman-Ford Tutorial Lab",
    description:
      "Interactive Bellman-Ford algorithm tutorial. Trace pass-by-pass relaxation with negative-cycle detection step-by-step.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
    tagName: "bellman-ford-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
  topological_sort: Object.freeze({
    id: "topological_sort",
    route: "/topological_sort/",
    title: "Topological Sort Tutorial Lab",
    description:
      "Interactive topological sort tutorial using Kahn's algorithm. Trace queue, indegree, and ordering evolution step-by-step.",
    fontHref:
      "https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;600;700;800&family=Source+Code+Pro:wght@400;500&display=swap",
    tagName: "topological-sort-tutorial-app",
    moduleEntryPath: "./app.js",
  }),
});

export const tutorialList = Object.freeze(Object.values(tutorialRegistry));

export function getTutorialConfig(tutorialId) {
  if (!tutorialId) {
    return null;
  }
  return tutorialRegistry[tutorialId] ?? null;
}
