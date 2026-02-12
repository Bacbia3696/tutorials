import { html } from "../shared/lit.js";
import { defineTutorialApp } from "../shared/tutorial-app.js";

defineTutorialApp(import.meta.url, {
  tutorialId: "dsu",
  renderTemplate: () => html`
    <div class="bg-shape shape-a"></div>
    <div class="bg-shape shape-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Data Structure</p>
        <h1>Disjoint Set Union Tutorial Lab</h1>
        <p>
          Learn how Union-Find works with path compression and union by rank.
          Trace each union/find operation step-by-step and watch the forest
          evolve.
        </p>
      </header>

      <section class="panel controls">
        <div class="control-group">
          <label for="elementsInput">Elements (comma/space separated integers)</label>
          <div class="row">
            <input id="elementsInput" type="text" value="0, 1, 2, 3, 4, 5, 6, 7" />
            <button id="loadBtn" class="btn">Initialize</button>
            <button id="sampleBtn" class="btn btn-muted">Sample</button>
          </div>
        </div>

        <div class="control-grid">
          <div class="control-group">
            <label for="opType">Operation</label>
            <select id="opType">
              <option value="union">Union(a, b)</option>
              <option value="find">Find(x)</option>
              <option value="connected">Connected(a, b)</option>
            </select>
          </div>

          <div class="control-group">
            <label for="paramA">Param A (x)</label>
            <input id="paramA" type="number" value="1" min="0" />
          </div>

          <div class="control-group">
            <label for="paramB">Param B</label>
            <input id="paramB" type="number" value="3" min="0" />
          </div>
        </div>

        <div class="row wrap">
          <button id="animateBtn" class="btn btn-primary">Run Animated</button>
          <button id="stepBtn" class="btn">Step</button>
          <button id="instantBtn" class="btn">Apply Instantly</button>
          <button id="finishBtn" class="btn btn-muted">Finish Current</button>

          <div class="speed-wrap">
            <label for="speedRange">Speed</label>
            <input id="speedRange" type="range" min="120" max="1200" step="20" value="440" />
            <span id="speedLabel">440 ms</span>
          </div>
        </div>

        <p class="key-hint">
          Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd> finish,
          <kbd>L</kbd> load, <kbd>R</kbd> sample, <kbd>1</kbd> union, <kbd>2</kbd> find,
          <kbd>3</kbd> connected.
        </p>
      </section>

      <section class="panel forest-view">
        <h2>Forest View</h2>
        <p class="hint">
          Each tree represents a disjoint set. The root node is highlighted in green.
          Edges point from child to parent. Active nodes glow during operations.
        </p>
        <div id="forestContainer" class="forest-container"></div>
      </section>

      <section class="panel status">
        <div>
          <h2>Status</h2>
          <p id="statusMessage" role="status" aria-live="polite" aria-atomic="true">Ready.</p>
        </div>
        <div class="metrics">
          <p><span class="metric-label">Elements:</span> <span id="elementCount">0</span></p>
          <p><span class="metric-label">Components:</span> <span id="componentCount">0</span></p>
          <p><span class="metric-label">Last Result:</span> <span id="lastResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        </div>
      </section>

      <section class="panel parent-view">
        <h2>Parent & Rank Arrays</h2>
        <div id="parentTableContainer" class="parent-table-scroll"></div>
      </section>

      <section class="panel code-view">
        <h2>Pseudocode Lens</h2>
        <div class="code-grid">
          <div class="code-panel" data-op="find">
            <h3>Find(x)</h3>
            <ol>
              <li data-line="1">if parent[x] ≠ x:</li>
              <li data-line="2">  parent[x] = Find(parent[x])</li>
              <li data-line="3">return parent[x]</li>
            </ol>
          </div>

          <div class="code-panel" data-op="union">
            <h3>Union(a, b)</h3>
            <ol>
              <li data-line="1">rootA = Find(a)</li>
              <li data-line="2">rootB = Find(b)</li>
              <li data-line="3">if rootA == rootB: return</li>
              <li data-line="4">if rank[rootA] < rank[rootB]: swap</li>
              <li data-line="5">parent[rootB] = rootA</li>
              <li data-line="6">if rank equal: rank[rootA]++</li>
            </ol>
          </div>

          <div class="code-panel" data-op="connected">
            <h3>Connected(a, b)</h3>
            <ol>
              <li data-line="1">return Find(a) == Find(b)</li>
            </ol>
          </div>
        </div>
      </section>

      <section class="panel components-view">
        <h2>Connected Components</h2>
        <div id="componentsList" class="components-list"></div>
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
