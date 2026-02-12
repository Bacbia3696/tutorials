import { html } from "../shared/lit.js";
import { defineTutorialLitHost } from "../shared/tutorial-lit-host.js";

defineTutorialLitHost({
  tagName: "sparse-segment-tree-tutorial-app",
  runtimeModulePath: new URL("./app-runtime.js", import.meta.url).href,
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="hero panel">
        <p class="eyebrow">Segment Tree Playground</p>
        <h1>Sparse Segment Tree Lab</h1>
        <p class="hero-copy">
          Learn dynamic segment trees over huge index ranges. Nodes are created only
          when an update touches a segment, while untouched areas stay implicit.
        </p>
      </header>

      <section class="controls panel">
        <div class="control-grid bounds-grid">
          <div class="control-group">
            <label for="boundLeft">Universe Left (L)</label>
            <input id="boundLeft" type="number" value="0" />
          </div>

          <div class="control-group">
            <label for="boundRight">Universe Right (R)</label>
            <input id="boundRight" type="number" value="1023" />
          </div>

          <div class="control-group control-group-end">
            <label>&nbsp;</label>
            <button id="resetTreeBtn" class="btn">Reset Tree</button>
          </div>
        </div>

        <div class="control-grid">
          <div class="control-group">
            <label for="opType">Operation</label>
            <select id="opType">
              <option value="update">Point Add Update</option>
              <option value="query">Range Sum Query</option>
            </select>
          </div>

          <div class="control-group" id="pointIndexWrap">
            <label for="pointIndex">Point Index</label>
            <input id="pointIndex" type="number" value="42" />
          </div>

          <div class="control-group" id="deltaWrap">
            <label for="deltaValue">Delta (+V)</label>
            <input id="deltaValue" type="number" value="5" />
          </div>

          <div class="control-group" id="leftWrap">
            <label for="leftIndex">Left Index (L)</label>
            <input id="leftIndex" type="number" value="0" />
          </div>

          <div class="control-group" id="rightWrap">
            <label for="rightIndex">Right Index (R)</label>
            <input id="rightIndex" type="number" value="127" />
          </div>
        </div>

        <div class="row wrap">
          <button id="animateBtn" class="btn btn-primary">Run Animated</button>
          <button id="stepBtn" class="btn">Step</button>
          <button id="instantBtn" class="btn">Apply Instantly</button>
          <button id="finishBtn" class="btn btn-muted">Finish Current</button>

          <div class="speed-wrap">
            <label for="speedRange">Animation Speed</label>
            <input id="speedRange" type="range" min="120" max="1400" step="20" value="520" />
            <span id="speedLabel">520 ms</span>
          </div>
        </div>
        <p class="key-hint">
          Shortcuts: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant,
          <kbd>F</kbd> finish, <kbd>B</kbd> reset tree,
          <kbd>U</kbd> update mode, <kbd>Q</kbd> query mode.
        </p>
      </section>

      <section class="array-view panel">
        <h2>Materialized Point Values (naive map)</h2>
        <div id="pointStrip" class="point-strip"></div>
      </section>

      <section class="tree-view panel">
        <h2>Sparse Tree Nodes</h2>
        <p class="hint">
          Card format: <code>#id [l,r]</code>, <code>sum</code>. Only materialized nodes are shown.
          Active recursion node pulses.
        </p>
        <div id="treeContainer" class="tree-container"></div>
      </section>

      <section class="status panel">
        <div>
          <h2>Status</h2>
          <p id="statusMessage" role="status" aria-live="polite" aria-atomic="true">Ready. Set bounds and run operations.</p>
        </div>
        <div class="status-metrics">
          <p><span class="metric-label">Current Sum (root):</span> <span id="rootSum">-</span></p>
          <p><span class="metric-label">Materialized Nodes:</span> <span id="nodeCount">0</span></p>
          <p><span class="metric-label">Last Query Result:</span> <span id="queryResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        </div>
      </section>

      <section class="code panel">
        <h2>Algorithm Lens</h2>
        <div class="code-grid">
          <div class="code-panel" data-op="update">
            <h3>Point Add Update</h3>
            <ol>
              <li data-line="1">Visit node segment [l, r]</li>
              <li data-line="2">If leaf, apply delta to node sum and return</li>
              <li data-line="3">Compute midpoint</li>
              <li data-line="4">Create needed child lazily if missing</li>
              <li data-line="5">Recurse into chosen child branch</li>
              <li data-line="6">Recompute current node sum from children</li>
            </ol>
          </div>

          <div class="code-panel" data-op="query">
            <h3>Range Sum Query</h3>
            <ol>
              <li data-line="1">If node is missing, contribution is 0</li>
              <li data-line="2">Return 0 for no overlap</li>
              <li data-line="3">Return node sum for total overlap</li>
              <li data-line="4">Otherwise recurse into both halves</li>
              <li data-line="5">Return left contribution + right contribution</li>
            </ol>
          </div>
        </div>
      </section>

      <section class="log panel">
        <div class="row between">
          <h2>Trace Log</h2>
          <button id="clearLogBtn" class="btn btn-muted">Clear Log</button>
        </div>
        <div id="logOutput" class="log-output" role="log" aria-live="polite" aria-relevant="additions"></div>
      </section>
    </main>
  `,
});
