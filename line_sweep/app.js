import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'line_sweep',
  renderTemplate: () => html`
    <div class="bg-wave wave-a"></div>
    <div class="bg-wave wave-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">Computational Geometry</p>
        <h1>Line Sweep Tutorial Lab</h1>
        <p>
          Trace a 1D line sweep that finds the maximum number of overlapping intervals. Watch event
          sorting, active-set updates, and max-overlap checkpoints unfold step-by-step.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="intervalsInput">
                Intervals (one per line, format: <code>l r</code>, max 40)
              </label>
              <textarea id="intervalsInput" rows="8">1 6
2 7
4 9
8 11
10 13
3 5
12 15</textarea>
            </div>

            <div class="row controls-row">
              <button id="loadIntervalsBtn" class="btn">Load Intervals</button>
              <button id="sampleIntervalsBtn" class="btn btn-muted">Sample</button>
              <button id="randomIntervalsBtn" class="btn btn-muted">Random</button>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 380,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>M</kbd> sample, <kbd>R</kbd> random.
            `,
          })}
        </div>
      </section>

      <section class="panel sweep-view">
        <h2>Sweep State</h2>

        <div class="lane-wrap">
          <article class="lane">
            <h3>Sorted Events</h3>
            <div id="eventStrip" class="event-strip"></div>
          </article>
          <article class="lane">
            <h3>Active Intervals</h3>
            <div id="activeStrip" class="active-strip"></div>
          </article>
        </div>

        <div class="sweep-grid">
          <div>
            <h3>Timeline Canvas</h3>
            <div class="timeline-wrap">
              <svg
                id="timelineCanvas"
                class="timeline-canvas"
                viewBox="0 0 920 420"
                role="img"
                aria-label="Line sweep interval visualization"
              ></svg>
            </div>
          </div>

          <div>
            <h3>Interval Table</h3>
            <div class="interval-table-wrap">
              <table class="interval-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Range</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody id="intervalRows"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Intervals Loaded:</span> <span id="intervalsMetric">0</span></p>
          <p><span class="metric-label">Events Processed:</span> <span id="eventsMetric">0 / 0</span></p>
          <p><span class="metric-label">Current Active:</span> <span id="activeMetric">0</span></p>
          <p><span class="metric-label">Max Overlap:</span> <span id="maxMetric">0</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="sweep">
            <h3>Line Sweep (Max Overlap)</h3>
            <ol>
              <li data-line="1">for each interval [l, r], emit (l, start) and (r, end)</li>
              <li data-line="2">sort events by x; when tied, process start before end</li>
              <li data-line="3">active = 0, best = 0, bestPositions = []</li>
              <li data-line="4">for each event in sorted events:</li>
              <li data-line="5">apply delta (+1 start, -1 end) and update active set</li>
              <li data-line="6">if active &gt; best: best = active, bestPositions = [x]</li>
              <li data-line="7">else if active == best: add x to bestPositions</li>
              <li data-line="8">return best and bestPositions</li>
            </ol>
          </div>
        `,
      })}

      <section class="panel concept">
        <h2>Core Idea</h2>
        <div class="concept-grid">
          <article class="concept-card">
            <h3>Events, Not Segments</h3>
            <p>Turn each interval into two endpoints so work happens only at meaningful x-values.</p>
          </article>
          <article class="concept-card">
            <h3>Tie Rule Matters</h3>
            <p>
              Processing <em>start</em> before <em>end</em> at the same coordinate captures closed-endpoint overlaps.
            </p>
          </article>
          <article class="concept-card">
            <h3>Single Pass After Sort</h3>
            <p>Once events are sorted, one sweep is enough to track active and maximum overlap.</p>
          </article>
        </div>
      </section>

      ${renderTraceLogPanel()}
    </main>
  `,
});
