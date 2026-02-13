import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'kmp',
  renderTemplate: () => html`
    <div class="bg-shape shape-a"></div>
    <div class="bg-shape shape-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">String Matching</p>
        <h1>KMP Algorithm Tutorial Lab</h1>
        <p>
          Learn Knuth-Morris-Pratt by tracing both LPS construction and pattern scanning. Watch how
          mismatches reuse prior prefix knowledge instead of restarting from scratch.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="textInput">Text (letters a-z, max 90)</label>
              <input id="textInput" type="text" value="ababcabcabababd" />
            </div>

            <div class="control-group">
              <label for="patternInput">Pattern (letters a-z, max 40)</label>
              <input id="patternInput" type="text" value="ababd" />
            </div>

            <div class="row controls-row">
              <button id="loadBtn" class="btn">Load Strings</button>
              <button id="sampleBtn" class="btn btn-muted">Sample</button>
            </div>

            <div class="control-group">
              <label for="opType">Operation</label>
              <select id="opType">
                <option value="build">Build LPS Array</option>
                <option value="search">Search Pattern in Text</option>
              </select>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 420,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>R</kbd> sample, <kbd>1</kbd> build LPS,
              <kbd>2</kbd> search.
            `,
          })}
        </div>
      </section>

      <section class="panel string-view">
        <h2>String Scanner</h2>
        <div class="string-grid">
          <div>
            <h3>Text (index i)</h3>
            <div id="textStrip" class="char-strip" aria-label="text strip"></div>
          </div>
          <div>
            <h3>Pattern (index j / build pointer)</h3>
            <div id="patternStrip" class="char-strip" aria-label="pattern strip"></div>
          </div>
        </div>
      </section>

      <section class="panel lps-view">
        <h2>LPS Table</h2>
        <p class="hint">
          <code>lps[i]</code> is the length of the longest proper prefix of <code>pattern[0..i]</code>
          that is also a suffix.
        </p>
        <div id="lpsStrip" class="lps-strip"></div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Text Length:</span> <span id="textLength">0</span></p>
          <p><span class="metric-label">Pattern Length:</span> <span id="patternLength">0</span></p>
          <p><span class="metric-label">Match Count:</span> <span id="matchCount">0</span></p>
          <p><span class="metric-label">Last Result:</span> <span id="lastResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      <section class="panel matches-view">
        <h2>Matched Start Indices</h2>
        <div id="matchesList" class="matches-list"></div>
      </section>

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="build">
            <h3>BuildLPS(pattern)</h3>
            <ol>
              <li data-line="1">lps[0] = 0, len = 0, i = 1</li>
              <li data-line="2">while i &lt; m: compare pattern[i] vs pattern[len]</li>
              <li data-line="3">if equal: len++, lps[i] = len</li>
              <li data-line="4">i++</li>
              <li data-line="5">else if len &gt; 0: len = lps[len - 1]</li>
              <li data-line="6">else: lps[i] = 0</li>
              <li data-line="7">i++</li>
              <li data-line="8">return lps</li>
            </ol>
          </div>

          <div class="code-panel" data-op="search">
            <h3>KMP Search(text, pattern)</h3>
            <ol>
              <li data-line="1">lps = BuildLPS(pattern)</li>
              <li data-line="2">i = 0, j = 0</li>
              <li data-line="3">while i &lt; n: compare text[i] vs pattern[j]</li>
              <li data-line="4">if equal: i++, j++</li>
              <li data-line="5">if j == m: record match, j = lps[j - 1]</li>
              <li data-line="6">else if mismatch and j &gt; 0: j = lps[j - 1]</li>
              <li data-line="7">else mismatch and j == 0: i++</li>
              <li data-line="8">return matches</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel()}
    </main>
  `,
});
