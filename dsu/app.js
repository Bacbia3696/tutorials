import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'dsu',
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
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="elementsInput">Elements (comma/space separated integers)</label>
              <div class="row controls-row">
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
          </div>

          ${renderRunnerControls({
            speedMs: 440,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>R</kbd> sample, <kbd>1</kbd> union, <kbd>2</kbd> find,
              <kbd>3</kbd> connected.
            `,
          })}
        </div>
      </section>

      <section class="panel forest-view">
        <h2>Forest View</h2>
        <p class="hint">
          Each tree represents a disjoint set. The root node is highlighted in green.
          Edges point from child to parent. Active nodes glow during operations.
        </p>
        <div id="forestContainer" class="forest-container"></div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Elements:</span> <span id="elementCount">0</span></p>
          <p><span class="metric-label">Components:</span> <span id="componentCount">0</span></p>
          <p><span class="metric-label">Last Result:</span> <span id="lastResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      <section class="panel parent-view">
        <h2>Parent & Rank Arrays</h2>
        <div id="parentTableContainer" class="parent-table-scroll"></div>
      </section>

      ${renderCodeLensPanel({
        content: html`
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
        `,
      })}

      <section class="panel components-view">
        <h2>Connected Components</h2>
        <div id="componentsList" class="components-list"></div>
      </section>

      ${renderTraceLogPanel()}
    </main>
  `,
});
