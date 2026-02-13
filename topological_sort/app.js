import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'topological_sort',
  renderTemplate: () => html`
    <div class="bg-net net-a"></div>
    <div class="bg-net net-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Directed Acyclic Graphs</p>
        <h1>Topological Sort Tutorial Lab</h1>
        <p>
          Learn Kahn's algorithm by tracking indegrees and queue operations in real time. Each step
          removes one zero-indegree node and updates its neighbors.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="nodesInput">Nodes (labels, comma/space separated, max 12)</label>
              <div class="row controls-row">
                <input id="nodesInput" type="text" value="A, B, C, D, E, F, G, H" />
                <button id="loadGraphBtn" class="btn">Load Graph</button>
                <button id="sampleGraphBtn" class="btn btn-muted">Sample DAG</button>
                <button id="randomGraphBtn" class="btn btn-muted">Random</button>
              </div>
            </div>

            <div class="control-group">
              <label for="edgesInput">
                Directed edges (one per line): <code>FROM TO</code> (example: <code>A C</code>)
              </label>
              <textarea id="edgesInput" rows="7">A C
A D
B D
B E
C F
D F
D G
E G
F H
G H</textarea>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 400,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random.
            `,
          })}
        </div>
      </section>

      <section class="panel process-view">
        <h2>Process State</h2>

        <div class="lane-wrap">
          <div class="lane">
            <h3>Queue (zero indegree)</h3>
            <div id="queueStrip" class="queue-strip"></div>
          </div>
          <div class="lane">
            <h3>Topological Order</h3>
            <div id="orderStrip" class="order-strip"></div>
          </div>
        </div>

        <div class="process-grid">
          <div>
            <h3>Graph Canvas</h3>
            <div class="graph-canvas-wrap">
              <svg id="graphCanvas" class="graph-canvas" viewBox="0 0 920 520" role="img" aria-label="Topological sort graph visualization"></svg>
            </div>

            <h3>Node In-Degrees</h3>
            <div id="nodeCards" class="node-grid"></div>
          </div>
          <div>
            <h3>Edges</h3>
            <div class="edge-table-wrap">
              <table class="edge-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Edge</th>
                  </tr>
                </thead>
                <tbody id="edgeRows"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Processed Nodes:</span> <span id="processedMetric">0 / 0</span></p>
          <p><span class="metric-label">Order Length:</span> <span id="orderMetric">0</span></p>
          <p><span class="metric-label">Cycle Detected:</span> <span id="cycleMetric">No</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="topo">
            <h3>Kahn's Algorithm</h3>
            <ol>
              <li data-line="1">compute indegree for each node, enqueue all indegree-0 nodes</li>
              <li data-line="2">while queue is not empty:</li>
              <li data-line="3">u = pop front from queue</li>
              <li data-line="4">append u to topological order</li>
              <li data-line="5">for each edge (u, v):</li>
              <li data-line="6">indegree[v] -= 1</li>
              <li data-line="7">if indegree[v] == 0: enqueue v</li>
              <li data-line="8">if order size &lt; n: cycle exists</li>
              <li data-line="9">otherwise order is valid</li>
            </ol>
          </div>
        `,
      })}

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <div class="concept-card">
            <h3>In-degree Gate</h3>
            <p>Only nodes with no remaining prerequisites can be taken next.</p>
          </div>
          <div class="concept-card">
            <h3>Queue Dynamics</h3>
            <p>Removing one node can unlock several downstream nodes.</p>
          </div>
          <div class="concept-card">
            <h3>Cycle Signal</h3>
            <p>If queue empties early, remaining nodes belong to at least one cycle.</p>
          </div>
        </div>
      </section>

      ${renderTraceLogPanel()}
    </main>
  `,
});
