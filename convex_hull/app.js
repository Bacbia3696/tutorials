import { html } from "../shared/lit.js";
import { defineTutorialApp } from "../shared/tutorial-app.js";

defineTutorialApp(import.meta.url, {
  tutorialId: "convex_hull",
  renderTemplate: () => html`
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Computational Geometry</p>
        <h1>Convex Hull Tutorial Lab</h1>
        <p>
          Trace Andrew's Monotonic Chain step-by-step. Watch lexicographic sorting, orientation
          checks, stack pops, and final hull assembly in one interactive flow.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="pointsInput">Points (one per line, format: <code>x y</code>, max 40)</label>
              <textarea id="pointsInput" rows="8">-6 -2
-4 4
-1 1
0 -3
2 5
4 2
6 -1
3 -4
-2 -5
1 0
5 4
-5 1</textarea>
            </div>

            <div class="row controls-row">
              <button id="loadPointsBtn" class="btn">Load Points</button>
              <button id="samplePointsBtn" class="btn btn-muted">Sample</button>
              <button id="randomPointsBtn" class="btn btn-muted">Random</button>
            </div>
          </div>

          <aside class="controls-runner">
            <h3>Playback Controls</h3>

            <div class="runner-grid">
              <button id="animateBtn" class="btn btn-primary">Run Animated</button>
              <button id="stepBtn" class="btn">Step</button>
              <button id="instantBtn" class="btn">Apply Instantly</button>
              <button id="finishBtn" class="btn btn-muted">Finish Current</button>
            </div>

            <div class="runner-speed">
              <label for="speedRange">Speed</label>
              <input id="speedRange" type="range" min="120" max="1200" step="20" value="420" />
              <span id="speedLabel">420 ms</span>
            </div>

            <p class="key-hint">
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random.
            </p>
          </aside>
        </div>
      </section>

      <section class="panel geometry-view">
        <h2>Geometry State</h2>

        <div class="geometry-grid">
          <div>
            <h3>Hull Canvas</h3>
            <div class="canvas-wrap">
              <svg
                id="hullCanvas"
                class="hull-canvas"
                viewBox="0 0 920 520"
                role="img"
                aria-label="Convex hull visualization"
              ></svg>
            </div>

            <div class="stack-grid">
              <article class="stack-card">
                <h3>Sorted Order</h3>
                <div id="sortedStrip" class="strip"></div>
              </article>
              <article class="stack-card">
                <h3>Lower Stack</h3>
                <div id="lowerStrip" class="strip"></div>
              </article>
              <article class="stack-card">
                <h3>Upper Stack</h3>
                <div id="upperStrip" class="strip"></div>
              </article>
              <article class="stack-card">
                <h3>Hull (CCW)</h3>
                <div id="hullStrip" class="strip"></div>
              </article>
            </div>
          </div>

          <div>
            <h3>Point Table</h3>
            <div class="point-table-wrap">
              <table class="point-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Coordinate</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody id="pointRows"></tbody>
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
          <p><span class="metric-label">Points Loaded:</span> <span id="pointsMetric">0</span></p>
          <p><span class="metric-label">Hull Vertices:</span> <span id="hullMetric">0</span></p>
          <p><span class="metric-label">Orientation Checks:</span> <span id="checksMetric">0</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        </div>
      </section>

      <section class="panel code-view">
        <h2>Pseudocode Lens</h2>
        <div class="code-grid">
          <div class="code-panel" data-op="hull">
            <h3>Andrew's Monotonic Chain</h3>
            <ol>
              <li data-line="1">sort points by (x, then y)</li>
              <li data-line="2">for each point in sorted order: process lower hull</li>
              <li data-line="3">while lower has 2+ points and turn &lt;= 0: pop</li>
              <li data-line="4">push current point to lower</li>
              <li data-line="5">for each point in reverse order: process upper hull</li>
              <li data-line="6">while upper has 2+ points and turn &lt;= 0: pop</li>
              <li data-line="7">push current point to upper</li>
              <li data-line="8">hull = lower[:-1] + upper[:-1]</li>
              <li data-line="9">return hull vertices in CCW order</li>
            </ol>
          </div>
        </div>
      </section>

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <article class="concept-card">
            <h3>Orientation Test</h3>
            <p>Use cross product sign to keep only left turns while scanning points.</p>
          </article>
          <article class="concept-card">
            <h3>Two Monotone Chains</h3>
            <p>Build lower then upper hull; both are stack-maintained boundaries.</p>
          </article>
          <article class="concept-card">
            <h3>Linear After Sort</h3>
            <p>After sorting, every point is pushed/popped at most once in each pass.</p>
          </article>
        </div>
      </section>

      <section class="panel log-view">
        <div class="row between">
          <h2>Trace Log</h2>
          <button id="clearLogBtn" class="btn btn-muted">Clear Log</button>
        </div>
        <div
          id="logOutput"
          class="log-output"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        ></div>
      </section>
    </main>
  `,
});
