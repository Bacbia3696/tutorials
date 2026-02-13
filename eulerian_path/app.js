import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'eulerian_path',
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Graph Traversal</p>
        <h1>Eulerian Path Tutorial Lab</h1>
        <p>
          Learn how Hierholzer's algorithm builds an Eulerian path by consuming each edge exactly
          once. Watch degree checks, connectivity checks, stack growth, and backtracking in real
          time.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="nodesInput">Nodes (labels, comma/space separated, max 10)</label>
              <div class="row controls-row">
                <input id="nodesInput" type="text" value="A, B, C, D, E, F" />
                <button id="loadGraphBtn" class="btn">Load Graph</button>
                <button id="sampleGraphBtn" class="btn btn-muted">Sample</button>
                <button id="randomGraphBtn" class="btn btn-muted">Random</button>
              </div>
            </div>

            <div class="control-group">
              <label for="edgesInput">
                Undirected edges (one per line): <code>FROM TO</code> (example: <code>A B</code>)
              </label>
              <textarea id="edgesInput" rows="8">A B
B C
C D
D E
E F
F C
C A</textarea>
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
            <h3>Validity Rules</h3>
            <p>
              In an undirected graph, an Eulerian path exists only when all non-zero-degree vertices
              are connected and odd-degree count is <code>0</code> or <code>2</code>.
            </p>
          </div>
          <div class="concept-card">
            <h3>Hierholzer Stack</h3>
            <p>
              Walk unused edges greedily with a stack. When a node has no unused edge left,
              backtrack and append it to the path.
            </p>
          </div>
          <div class="concept-card">
            <h3>Reverse at End</h3>
            <p>
              Nodes are appended during backtracking, so reverse that sequence to get the final
              Eulerian path from start to end.
            </p>
          </div>
        </div>
      </section>

      <section id="graphViewPanel" class="panel graph-view">
        <div class="graph-grid">
          <div class="graph-main">
            <h3>Graph Canvas</h3>
            <div class="graph-canvas-wrap">
              <svg id="graphCanvas" class="graph-canvas" viewBox="0 0 980 560" role="img" aria-label="Eulerian path graph visualization"></svg>
            </div>

            <div class="legend-pills">
              <span class="legend-pill used">Used Edge</span>
              <span class="legend-pill active">Active Edge</span>
              <span class="legend-pill odd">Odd Degree</span>
              <span class="legend-pill current">Current Node</span>
            </div>
            <p class="canvas-hint">
              Green edges are already consumed; amber is the current traversal edge. Odd-degree nodes
              are highlighted until path validation is complete.
            </p>

            <h3>Node Details</h3>
            <div id="nodeCards" class="node-grid"></div>
          </div>

          <aside class="graph-side">
            <section class="runtime-card">
              <h3>Traversal Stack</h3>
              <div id="stackStrip" class="pill-strip"></div>
            </section>

            <section class="runtime-card">
              <h3>Backtrack Path (before reverse)</h3>
              <div id="pathStrip" class="pill-strip"></div>
            </section>

            <section class="runtime-card">
              <h3>Edges</h3>
              <div class="edge-table-wrap">
                <table class="edge-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Edge</th>
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
          <p><span class="metric-label">Odd-Degree Vertices:</span> <span id="oddMetric">0</span></p>
          <p><span class="metric-label">Used Edges:</span> <span id="usedMetric">0 / 0</span></p>
          <p><span class="metric-label">Result:</span> <span id="resultMetric">-</span></p>
          <p><span class="metric-label">Eulerian Path:</span> <span id="pathMetric">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="eulerian">
            <h3>EulerianPath(graph)</h3>
            <ol>
              <li data-line="1">compute degree of every vertex; find odd-degree vertices</li>
              <li data-line="2">check connectivity among non-zero-degree vertices</li>
              <li data-line="3">if disconnected or odd count not in {0,2}: no Eulerian path</li>
              <li data-line="4">choose start: odd vertex if exists, else any non-zero-degree vertex</li>
              <li data-line="5">stack = [start], path = []</li>
              <li data-line="6">while stack not empty:</li>
              <li data-line="7">if top has unused edge (v,u): mark used and push u</li>
              <li data-line="8">else pop v and append v to path</li>
              <li data-line="9">reverse path and return</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel()}
    </main>
  `,
});
