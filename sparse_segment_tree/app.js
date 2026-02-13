import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'sparse_segment_tree',
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="hero panel">
        <p class="eyebrow">Segment Tree Playground</p>
        <h1>Sparse Segment Tree Lab</h1>
        <p class="hero-copy">
          Learn dynamic segment trees over huge index ranges with lazy propagation.
          Nodes are created only when recursion needs them, while untouched ranges
          remain implicit.
        </p>
      </header>

      <section class="controls panel">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="initialValuesInput">
                Initial Values at [L, L+1, ...] (comma or space separated, max 24)
              </label>
              <div class="row seed-row controls-row">
                <input id="initialValuesInput" type="text" value="4, 1, 0, 7, 2, 3" />
                <button id="loadInitialBtn" class="btn">Load Initial Values</button>
                <button id="randomInitialBtn" class="btn btn-muted">Random Seed</button>
              </div>
            </div>

            <div class="control-grid bounds-grid">
              <div class="control-group">
                <label for="boundLeft">Universe Left (L)</label>
                <input id="boundLeft" type="number" value="0" />
              </div>

              <div class="control-group">
                <label for="boundRight">Universe Right (R)</label>
                <input id="boundRight" type="number" value="15" />
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
                  <option value="update">Range Add Update</option>
                  <option value="query">Range Sum Query</option>
                </select>
              </div>

              <div class="control-group" id="leftWrap">
                <label for="leftIndex">Left Index (L)</label>
                <input id="leftIndex" type="number" value="4" />
              </div>

              <div class="control-group" id="rightWrap">
                <label for="rightIndex">Right Index (R)</label>
                <input id="rightIndex" type="number" value="8" />
              </div>

              <div class="control-group" id="deltaWrap">
                <label for="deltaValue">Delta (+V)</label>
                <input id="deltaValue" type="number" value="5" />
              </div>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 520,
            speedLabel: 'Animation Speed',
            speedMax: 1400,
            keyHint: html`
              Shortcuts: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant,
              <kbd>F</kbd> finish, <kbd>B</kbd> reset tree,
              <kbd>L</kbd> load initial, <kbd>R</kbd> random seed,
              <kbd>U</kbd> update mode, <kbd>Q</kbd> query mode.
            `,
          })}
        </div>
      </section>

      <section class="array-view panel">
        <h2>Probe Point Values (sampled)</h2>
        <div id="pointStrip" class="point-strip"></div>
      </section>

      <section class="tree-view panel">
        <h2>Sparse Tree Nodes</h2>
        <p class="hint">
          Card format: <code>#id [l,r]</code>, <code>sum</code>, <code>lazy</code>, child ids.
          Only materialized nodes are shown.
          Active recursion node pulses. The view auto-fits to keep the full materialized tree visible.
        </p>
        <div id="treeContainer" class="tree-container"></div>
      </section>

      ${renderStatusPanel({
        sectionClass: 'status panel',
        metricsClass: 'status-metrics',
        statusText: 'Ready. Load initial values (or reset empty), then run operations.',
        metricsContent: html`
          <p><span class="metric-label">Current Sum (root):</span> <span id="rootSum">-</span></p>
          <p><span class="metric-label">Materialized Nodes:</span> <span id="nodeCount">0</span></p>
          <p><span class="metric-label">Last Query Result:</span> <span id="queryResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        sectionClass: 'code panel',
        title: 'Algorithm Lens',
        content: html`
          <div class="code-panel" data-op="update">
            <h3>Range Add Update</h3>
            <ol>
              <li data-line="1">Visit current node (repeats for each recursive call)</li>
              <li data-line="2">For partial overlap: resolve pending lazy on current node</li>
              <li data-line="3">For partial overlap: push pending lazy to children</li>
              <li data-line="4">Return if no overlap</li>
              <li data-line="5">If total overlap: update sum and mark lazy (if internal), then return</li>
              <li data-line="6">If partial overlap: recurse to needed halves, then recompute sum</li>
            </ol>
          </div>

          <div class="code-panel" data-op="query">
            <h3>Range Sum Query</h3>
            <ol>
              <li data-line="1">Visit current segment/node context (repeats per recursive call)</li>
              <li data-line="2">For partial overlap: resolve pending lazy on current node</li>
              <li data-line="3">For partial overlap: push pending lazy to children</li>
              <li data-line="4">Return 0 if no overlap</li>
              <li data-line="5">If total overlap: return node sum</li>
              <li data-line="6">If partial overlap: recurse and return combined child sums</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel({
        sectionClass: 'log panel',
      })}
    </main>
  `,
});
