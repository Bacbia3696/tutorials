import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'fenwick_tree',
  renderTemplate: () => html`
    <div class="bg-shape shape-a"></div>
    <div class="bg-shape shape-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Binary Indexed Tree</p>
        <h1>Fenwick Tree Tutorial Lab</h1>
        <p>
          Learn why Fenwick Tree gives fast prefix/range sums with point updates. Watch each jump by
          <code>lowbit(i) = i & -i</code> and see exactly which BIT cells are touched.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="arrayInput">Initial Array (integers, comma/space separated, max 20)</label>
              <div class="row controls-row">
                <input id="arrayInput" type="text" value="5, 2, 7, 1, 3, 6, 4, 9" />
                <button id="loadArrayBtn" class="btn">Load Array</button>
                <button id="randomArrayBtn" class="btn btn-muted">Random</button>
              </div>
            </div>

            <div class="control-grid">
              <div class="control-group">
                <label for="opType">Operation</label>
                <select id="opType">
                  <option value="update">Point Update: add delta at index</option>
                  <option value="prefix">Prefix Query: sum(1..i)</option>
                  <option value="range">Range Query: sum(l..r)</option>
                </select>
              </div>

              <div class="control-group" id="singleIndexWrap">
                <label for="singleIndex">Index i (1-based)</label>
                <input id="singleIndex" type="number" min="1" value="5" />
              </div>

              <div class="control-group" id="leftWrap">
                <label for="leftIndex">Left l (1-based)</label>
                <input id="leftIndex" type="number" min="1" value="3" />
              </div>

              <div class="control-group" id="rightWrap">
                <label for="rightIndex">Right r (1-based)</label>
                <input id="rightIndex" type="number" min="1" value="7" />
              </div>

              <div class="control-group" id="deltaWrap">
                <label for="deltaValue">Delta (+/-)</label>
                <input id="deltaValue" type="number" value="4" />
              </div>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 460,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>R</kbd> random, <kbd>1</kbd> update, <kbd>2</kbd>
              prefix, <kbd>3</kbd> range.
            `,
          })}
        </div>
      </section>

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <div class="concept-card">
            <h3>What bit[i] stores</h3>
            <p>
              <code>bit[i]</code> stores a suffix of prefix ending at <code>i</code> of length
              <code>lowbit(i)</code>.
            </p>
          </div>
          <div class="concept-card">
            <h3>lowbit(i)</h3>
            <p><code>lowbit(i) = i & -i</code> gives the least significant set bit.</p>
          </div>
          <div class="concept-card">
            <h3>Traversal jumps</h3>
            <p>Update: <code>i += lowbit(i)</code>. Query: <code>i -= lowbit(i)</code>.</p>
          </div>
        </div>
      </section>

      <section class="panel array-view">
        <h2>Base Array (1-based shown)</h2>
        <div id="arrayStrip" class="array-strip"></div>
      </section>

      <section class="panel bit-view">
        <h2>BIT Table</h2>
        <h3>Coverage Map</h3>
        <div id="coverageMap" class="coverage-map" aria-label="Fenwick coverage map"></div>
        <h3>Jump Timeline</h3>
        <div class="jump-map-wrap">
          <svg id="jumpCanvas" class="jump-canvas" viewBox="0 0 540 150" role="img" aria-label="Fenwick jump timeline"></svg>
          <p id="jumpCaption" class="jump-caption">Load an array to preview jump routes.</p>
        </div>
        <div class="bit-table-wrap">
          <table class="bit-table">
            <thead>
              <tr>
                <th>i</th>
                <th>binary(i)</th>
                <th>lowbit(i)</th>
                <th>covers range</th>
                <th>bit[i]</th>
              </tr>
            </thead>
            <tbody id="bitRows"></tbody>
          </table>
        </div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Array Total:</span> <span id="arrayTotal">-</span></p>
          <p><span class="metric-label">Last Query Result:</span> <span id="queryResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="update">
            <h3>Point Update</h3>
            <ol>
              <li data-line="1">i = index</li>
              <li data-line="2">while i &lt;= n:</li>
              <li data-line="3">bit[i] += delta</li>
              <li data-line="4">i += lowbit(i)</li>
              <li data-line="5">done</li>
            </ol>
          </div>

          <div class="code-panel" data-op="prefix">
            <h3>Prefix Query</h3>
            <ol>
              <li data-line="1">i = index, sum = 0</li>
              <li data-line="2">while i &gt; 0:</li>
              <li data-line="3">sum += bit[i]</li>
              <li data-line="4">i -= lowbit(i)</li>
              <li data-line="5">return sum</li>
            </ol>
          </div>

          <div class="code-panel" data-op="range">
            <h3>Range Query</h3>
            <ol>
              <li data-line="1">result = prefix(r) - prefix(l - 1)</li>
              <li data-line="2">compute prefix(r)</li>
              <li data-line="3">compute prefix(l - 1)</li>
              <li data-line="4">return result</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel()}
    </main>
  `,
});
