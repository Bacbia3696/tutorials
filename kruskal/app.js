import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'kruskal',
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Minimum Spanning Tree</p>
        <h1>Kruskal's Algorithm Tutorial Lab</h1>
        <p>
          Build an MST edge-by-edge by sorting weights and using Disjoint Set Union to skip cycles.
          Watch accepted and rejected edges update in real time.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="nodesInput">Nodes (labels, comma/space separated, max 10)</label>
              <div class="row controls-row">
                <input id="nodesInput" type="text" value="A, B, C, D, E, F, G" />
                <button id="loadGraphBtn" class="btn">Load Graph</button>
                <button id="sampleGraphBtn" class="btn btn-muted">Sample</button>
                <button id="randomGraphBtn" class="btn btn-muted">Random</button>
              </div>
            </div>

            <div class="control-group">
              <label for="edgesInput">
                Undirected weighted edges (one per line): <code>FROM TO WEIGHT</code>
              </label>
              <textarea id="edgesInput" rows="8">A B 7
A D 5
B C 8
B D 9
B E 7
C E 5
D E 15
D F 6
E F 8
E G 9
F G 11</textarea>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 420,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random.
            `,
          })}
        </div>
      </section>

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <div class="concept-card">
            <h3>Sort by Weight</h3>
            <p>Process edges from lightest to heaviest so each accepted edge is locally optimal.</p>
          </div>
          <div class="concept-card">
            <h3>Cycle Check with DSU</h3>
            <p>Use Union-Find to test whether endpoints are already connected before accepting an edge.</p>
          </div>
          <div class="concept-card">
            <h3>Stop at n - 1</h3>
            <p>An MST on <code>n</code> vertices always has <code>n - 1</code> edges.</p>
          </div>
        </div>
      </section>

      <section id="graphViewPanel" class="panel graph-view">
        <div class="graph-grid">
          <div class="graph-main">
            <h3>Graph Canvas</h3>
            <div class="graph-canvas-wrap">
              <svg id="graphCanvas" class="graph-canvas" viewBox="0 0 980 560" role="img" aria-label="Kruskal graph visualization"></svg>
            </div>

            <div class="legend-pills">
              <span class="legend-pill selected">Selected</span>
              <span class="legend-pill rejected">Rejected</span>
              <span class="legend-pill active">Active Edge</span>
              <span class="legend-pill root">DSU Root</span>
            </div>
            <p class="canvas-hint">
              Green edges enter MST, red edges are skipped for cycles, amber highlights the current edge.
            </p>

            <h3>Sorted Edge Order</h3>
            <div id="edgeOrderStrip" class="edge-order-strip"></div>

            <h3>Node Details</h3>
            <div id="nodeCards" class="node-grid"></div>
          </div>

          <aside class="graph-side">
            <section class="runtime-card">
              <h3>DSU Parent & Rank</h3>
              <div id="dsuTableContainer" class="dsu-table-wrap"></div>
            </section>

            <section class="runtime-card">
              <h3>Components</h3>
              <div id="componentList" class="component-list"></div>
            </section>

            <section class="runtime-card">
              <h3>Edges</h3>
              <div class="edge-table-wrap">
                <table class="edge-table">
                  <thead>
                    <tr>
                      <th>Ord</th>
                      <th>Edge</th>
                      <th>W</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody id="edgeRows"></tbody>
                </table>
              </div>
            </section>
          </aside>
        </div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Selected Edges:</span> <span id="selectedMetric">0 / 0</span></p>
          <p><span class="metric-label">MST Weight:</span> <span id="weightMetric">-</span></p>
          <p><span class="metric-label">Components:</span> <span id="componentMetric">-</span></p>
          <p><span class="metric-label">Result:</span> <span id="resultMetric">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="kruskal">
            <h3>Kruskal(graph)</h3>
            <ol>
              <li data-line="1">sort edges by nondecreasing weight</li>
              <li data-line="2">initialize DSU; mst = empty</li>
              <li data-line="3">for each edge (u, v, w) in sorted order:</li>
              <li data-line="4">ru = Find(u), rv = Find(v)</li>
              <li data-line="5">if ru == rv: skip edge (cycle)</li>
              <li data-line="6">else Union(ru, rv); add edge to mst</li>
              <li data-line="7">if mst size == n - 1: break</li>
              <li data-line="8">return mst (or spanning forest if disconnected)</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel()}
    </main>
  `,
});
