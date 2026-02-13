import { html } from '../lit.js';

export function renderTraceLogPanel({
  sectionClass = 'panel log-view',
  title = 'Trace Log',
  clearLabel = 'Clear Log',
} = {}) {
  return html`
    <section class=${sectionClass}>
      <div class="row between">
        <h2>${title}</h2>
        <button id="clearLogBtn" class="btn btn-muted">${clearLabel}</button>
      </div>
      <div id="logOutput" class="log-output" role="log" aria-live="polite" aria-relevant="additions"></div>
    </section>
  `;
}
