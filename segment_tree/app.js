import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'segment_tree',
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="hero panel">
        <p class="eyebrow">Segment Tree Playground</p>
        <h1>Lazy Propagation Lab</h1>
        <p class="hero-copy">
          Explore how range updates are deferred with lazy tags, then resolved only when needed.
          Run each operation instantly, animate it, or step through every recursive call.
        </p>
      </header>

      <section class="controls panel">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="arrayInput">Initial Array (comma or space separated, max 16)</label>
              <div class="row controls-row">
                <input id="arrayInput" type="text" value="3, 1, 4, 1, 5, 9, 2, 6" />
                <button id="loadArrayBtn" class="btn">Load Array</button>
                <button id="randomArrayBtn" class="btn btn-muted">Random</button>
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

              <div class="control-group">
                <label for="leftIndex">Left Index (L)</label>
                <input id="leftIndex" type="number" min="0" value="2" />
              </div>

              <div class="control-group">
                <label for="rightIndex">Right Index (R)</label>
                <input id="rightIndex" type="number" min="0" value="6" />
              </div>

              <div class="control-group" id="deltaWrap">
                <label for="deltaValue">Delta (+V)</label>
                <input id="deltaValue" type="number" value="3" />
              </div>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 520,
            speedLabel: 'Animation Speed',
            speedMax: 1400,
            keyHint: html`
              Shortcuts: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant,
              <kbd>F</kbd> finish, <kbd>L</kbd> load array, <kbd>R</kbd> random,
              <kbd>U</kbd> update mode, <kbd>Q</kbd> query mode.
            `,
          })}
        </div>
      </section>

      <section class="array-view panel">
        <h2>Base Array (naive reference)</h2>
        <div id="arrayStrip" class="array-strip"></div>
      </section>

      <section class="tree-view panel">
        <h2>Segment Tree Nodes</h2>
        <p class="hint">
          Card format: <code>#node [l,r]</code>, <code>sum</code>, <code>lazy</code>. Active recursion node pulses.
          The view auto-fits to keep the full materialized tree visible.
        </p>
        <div id="treeContainer" class="tree-container"></div>
      </section>

      ${renderStatusPanel({
        sectionClass: 'status panel',
        metricsClass: 'status-metrics',
        statusText: 'Ready. Load an array and choose an operation.',
        metricsContent: html`
          <p><span class="metric-label">Current Sum (root):</span> <span id="rootSum">-</span></p>
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
              <li data-line="5">If total overlap: update sum and mark current node lazy (if internal), then return</li>
              <li data-line="6">If partial overlap: recurse and recompute sum</li>
            </ol>
          </div>

          <div class="code-panel" data-op="query">
            <h3>Range Sum Query</h3>
            <ol>
              <li data-line="1">Visit current node (repeats for each recursive call)</li>
              <li data-line="2">For partial overlap: resolve pending lazy on current node</li>
              <li data-line="3">For partial overlap: push pending lazy to children</li>
              <li data-line="4">Return 0 if no overlap</li>
              <li data-line="5">If total overlap: return node sum</li>
              <li data-line="6">If partial overlap: recurse and return left + right</li>
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
