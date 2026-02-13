import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'bellman_ford',
  renderTemplate: () => html`
    <div class="bg-blur blur-a"></div>
    <div class="bg-blur blur-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Single-Source Shortest Paths</p>
        <h1>Bellman-Ford Tutorial Lab</h1>
        <p>
          Follow edge-by-edge relaxation for <code>n - 1</code> passes, then run the cycle check pass.
          Great for understanding shortest paths with negative weights.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="nodesInput">Nodes (labels, comma/space separated, max 10)</label>
              <div class="row controls-row">
                <input id="nodesInput" type="text" value="S, A, B, C, D, E" />
                <button id="loadGraphBtn" class="btn">Load Graph</button>
                <button id="sampleGraphBtn" class="btn btn-muted">Sample</button>
                <button id="randomGraphBtn" class="btn btn-muted">Random</button>
              </div>
            </div>

            <div class="control-group">
              <label for="edgesInput">
                Edges (one per line): <code>FROM TO WEIGHT</code> (example: <code>S A 4</code>)
              </label>
              <textarea id="edgesInput" rows="7">S A 4
S E 5
A C 6
B A 3
C B -2
D C 3
D A 10
E D -1</textarea>
            </div>

            <div class="control-grid">
              <div class="control-group">
                <label for="graphMode">Graph Mode</label>
                <select id="graphMode">
                  <option value="directed">Directed</option>
                  <option value="undirected">Undirected</option>
                </select>
              </div>

              <div class="control-group">
                <label for="sourceSelect">Source</label>
                <select id="sourceSelect"></select>
              </div>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 420,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random, <kbd>D</kbd>
              directed, <kbd>U</kbd> undirected.
            `,
          })}
        </div>
      </section>

      <section id="graphViewPanel" class="panel graph-view mode-directed">
        <div class="row between">
          <h2>Relaxation State</h2>
          <p id="modeIndicator" class="mode-indicator">Directed mode: edges are relaxed one-way.</p>
        </div>

        <div class="pass-wrap">
          <h3>Pass Timeline</h3>
          <div id="passStrip" class="pass-strip"></div>
        </div>

        <div class="graph-grid">
          <div>
            <h3>Graph Canvas</h3>
            <div class="graph-canvas-wrap">
              <svg id="graphCanvas" class="graph-canvas" viewBox="0 0 900 520" role="img" aria-label="Bellman-Ford graph visualization"></svg>
            </div>

            <h3>Distance Table</h3>
            <div id="distanceCards" class="distance-grid"></div>
          </div>

          <div>
            <h3>Edges</h3>
            <div class="edge-table-wrap">
              <table class="edge-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Edge</th>
                    <th>Weight</th>
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
          <p><span class="metric-label">Pass:</span> <span id="passMetric">0 / 0</span></p>
          <p><span class="metric-label">Relaxations:</span> <span id="relaxMetric">0</span></p>
          <p><span class="metric-label">Negative Cycle:</span> <span id="cycleMetric">No</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="bellman">
            <h3>Bellman-Ford(source)</h3>
            <ol>
              <li data-line="1">dist[*] = inf, dist[source] = 0</li>
              <li data-line="2">repeat (n - 1) passes:</li>
              <li data-line="3">for each edge (u, v, w): inspect</li>
              <li data-line="4">if dist[u] is finite and candidate improves v:</li>
              <li data-line="5">dist[v] = dist[u] + w, prev[v] = u</li>
              <li data-line="6">if no update in a pass: stop early</li>
              <li data-line="7">final pass: if any edge still improves, negative cycle exists</li>
            </ol>
          </div>
        `,
      })}

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <div class="concept-card">
            <h3>Pass-by-pass</h3>
            <p>Each pass allows shortest paths with one more edge.</p>
          </div>
          <div class="concept-card">
            <h3>Early Exit</h3>
            <p>If a full pass makes no updates, remaining passes are unnecessary.</p>
          </div>
          <div class="concept-card">
            <h3>Cycle Check</h3>
            <p>If an update is still possible on pass <code>n</code>, a negative cycle is reachable.</p>
          </div>
        </div>
      </section>

      ${renderTraceLogPanel()}
    </main>
  `,
});
