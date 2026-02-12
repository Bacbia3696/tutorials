import { html } from "../shared/lit.js";
import { defineTutorialLitHost } from "../shared/tutorial-lit-host.js";

defineTutorialLitHost({
  tagName: "trie-tutorial-app",
  runtimeModulePath: new URL("./app-runtime.js", import.meta.url).href,
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
        <div class="control-group">
          <label for="initialWordsInput">Initial Words (comma/space separated)</label>
          <div class="row">
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
          <kbd>L</kbd> load, <kbd>R</kbd> sample, <kbd>1</kbd> insert, <kbd>2</kbd> search,
          <kbd>3</kbd> prefix, <kbd>4</kbd> delete.
        </p>
      </section>

      <section class="panel tree-view">
        <h2>Trie Structure</h2>
        <p class="hint">
          Node label shows character. Root is <code>#0</code>. Green badge marks <code>end-of-word</code>.
        </p>
        <div id="treeContainer" class="tree-container"></div>
      </section>

      <section class="panel status">
        <div>
          <h2>Status</h2>
          <p id="statusMessage" role="status" aria-live="polite" aria-atomic="true">Ready.</p>
        </div>
        <div class="metrics">
          <p><span class="metric-label">Words:</span> <span id="wordCount">0</span></p>
          <p><span class="metric-label">Nodes:</span> <span id="nodeCount">0</span></p>
          <p><span class="metric-label">Last Result:</span> <span id="lastResult">-</span></p>
          <p><span class="metric-label">Step:</span> <span id="stepCounter">0 / 0</span></p>
        </div>
      </section>

      <section class="panel words-view">
        <h2>Dictionary (Stored Words)</h2>
        <div id="wordsList" class="words-list"></div>
      </section>

      <section class="panel code-view">
        <h2>Pseudocode Lens</h2>
        <div class="code-grid">
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
        </div>
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
