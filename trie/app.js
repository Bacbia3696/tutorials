import { html } from '../shared/lit.js';
import { renderRunnerControls } from '../shared/components/runner-controls.js';
import { renderTraceLogPanel } from '../shared/components/trace-log-panel.js';
import { renderStatusPanel } from '../shared/components/status-panel.js';
import { renderCodeLensPanel } from '../shared/components/code-lens-panel.js';
import { defineTutorialApp } from '../shared/tutorial-app.js';

defineTutorialApp(import.meta.url, {
  tutorialId: 'trie',
  renderTemplate: () => html`
    <div class="bg-shape shape-a"></div>
    <div class="bg-shape shape-b"></div>

    <main class="layout">
      <header class="panel hero">
        <p class="eyebrow">String Data Structure</p>
        <h1>Trie Tutorial Lab</h1>
        <p>
          Learn how words share prefixes in a Trie. Trace each insert/search/prefix operation step-by-step,
          and watch the traversal path through the tree.
        </p>
      </header>

      <section class="panel controls">
        <div class="controls-grid">
          <div class="controls-main">
            <div class="control-group">
              <label for="initialWordsInput">Initial Words (comma/space separated)</label>
              <div class="row controls-row">
                <input id="initialWordsInput" type="text" value="cat, car, dog, dot, deal" />
                <button id="loadWordsBtn" class="btn">Load Words</button>
                <button id="sampleWordsBtn" class="btn btn-muted">Sample</button>
              </div>
            </div>

            <div class="control-grid">
              <div class="control-group">
                <label for="opType">Operation</label>
                <select id="opType">
                  <option value="insert">Insert Word</option>
                  <option value="search">Search Word</option>
                  <option value="prefix">Starts With Prefix</option>
                  <option value="delete">Delete Word</option>
                </select>
              </div>

              <div class="control-group">
                <label for="wordInput">Word / Prefix</label>
                <input id="wordInput" type="text" value="cart" />
              </div>
            </div>
          </div>

          ${renderRunnerControls({
            speedMs: 440,
            keyHint: html`
              Keys: <kbd>A</kbd> animate, <kbd>S</kbd> step, <kbd>I</kbd> instant, <kbd>F</kbd>
              finish, <kbd>L</kbd> load, <kbd>R</kbd> sample, <kbd>1</kbd> insert, <kbd>2</kbd>
              search, <kbd>3</kbd> prefix, <kbd>4</kbd> delete.
            `,
          })}
        </div>
      </section>

      <section class="panel tree-view">
        <h2>Trie Structure</h2>
        <p class="hint">
          Node label shows character. Root is <code>#0</code>. Green badge marks <code>end-of-word</code>.
        </p>
        <div id="treeContainer" class="tree-container"></div>
      </section>

      ${renderStatusPanel({
        metricsContent: html`
          <p><span class="metric-label">Words:</span> <span id="wordCount">0</span></p>
          <p><span class="metric-label">Nodes:</span> <span id="nodeCount">0</span></p>
          <p><span class="metric-label">Last Result:</span> <span id="lastResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        `,
      })}

      <section class="panel words-view">
        <h2>Dictionary (Stored Words)</h2>
        <div id="wordsList" class="words-list"></div>
      </section>

      ${renderCodeLensPanel({
        content: html`
          <div class="code-panel" data-op="insert">
            <h3>Insert(word)</h3>
            <ol>
              <li data-line="1">node = root</li>
              <li data-line="2">for each char c in word:</li>
              <li data-line="3">if child c not exists: create it</li>
              <li data-line="4">node = child c</li>
              <li data-line="5">mark node as end-of-word</li>
            </ol>
          </div>

          <div class="code-panel" data-op="search">
            <h3>Search(word)</h3>
            <ol>
              <li data-line="1">node = root</li>
              <li data-line="2">for each char c in word:</li>
              <li data-line="3">if child c missing: return false</li>
              <li data-line="4">node = child c</li>
              <li data-line="5">return node.isEnd</li>
            </ol>
          </div>

          <div class="code-panel" data-op="prefix">
            <h3>StartsWith(prefix)</h3>
            <ol>
              <li data-line="1">node = root</li>
              <li data-line="2">for each char c in prefix:</li>
              <li data-line="3">if child c missing: return false</li>
              <li data-line="4">node = child c</li>
              <li data-line="5">return true</li>
            </ol>
          </div>

          <div class="code-panel" data-op="delete">
            <h3>Delete(word)</h3>
            <ol>
              <li data-line="1">node = root</li>
              <li data-line="2">for each char c in word: traverse and store path</li>
              <li data-line="3">if child c missing: return false</li>
              <li data-line="4">if node.isEnd is false: return false</li>
              <li data-line="5">unmark end-of-word</li>
              <li data-line="6">prune empty suffix nodes bottom-up</li>
              <li data-line="7">return true</li>
            </ol>
          </div>
        `,
      })}

      ${renderTraceLogPanel()}
    </main>
  `,
});
