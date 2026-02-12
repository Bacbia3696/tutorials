import { html } from "../shared/lit.js";
import { defineTutorialLitHost } from "../shared/tutorial-lit-host.js";

defineTutorialLitHost({
  tagName: "bellman-ford-tutorial-app",
  runtimeModulePath: new URL("./app-runtime.js", import.meta.url).href,
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
        <div class="control-group">
          <label for="nodesInput">Nodes (labels, comma/space separated, max 10)</label>
          <div class="row">
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

        <div class="row wrap">
          <button id="animateBtn" class="btn btn-primary">Run Animated</button>
          <button id="stepBtn" class="btn">Step</button>
          <button id="instantBtn" class="btn">Apply Instantly</button>
          <button id="finishBtn" class="btn btn-muted">Finish Current</button>

          <div class="speed-wrap">
            <label for="speedRange">Speed</label>
            <input id="speedRange" type="range" min="120" max="1200" step="20" value="420" />
            <span id="speedLabel">420 ms</span>
          </div>
        </div>

        <p class="key-hint">
          Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd> finish,
          <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random, <kbd>D</kbd> directed,
          <kbd>U</kbd> undirected.
        </p>
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

      <section class="panel status">
        <div>
          <h2>Status</h2>
          <p id="statusMessage" role="status" aria-live="polite" aria-atomic="true">Ready.</p>
        </div>
        <div class="metrics">
          <p><span class="metric-label">Pass:</span> <span id="passMetric">0 / 0</span></p>
          <p><span class="metric-label">Relaxations:</span> <span id="relaxMetric">0</span></p>
          <p><span class="metric-label">Negative Cycle:</span> <span id="cycleMetric">No</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        </div>
      </section>

      <section class="panel code-view">
        <h2>Pseudocode Lens</h2>
        <div class="code-grid">
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
        </div>
      </section>

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

      <section class="panel log-view">
        <div class="row between">
          <h2>Trace Log</h2>
          <button id="clearLogBtn" class="btn btn-muted">Clear Log</button>
        </div>
        <div id="logOutput" class="log-output" role="log" aria-live="polite" aria-relevant="additions"></div>
      </section>
    </main>
  `,
});
