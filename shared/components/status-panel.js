import { html } from '../lit.js';

export function renderStatusPanel({
  sectionClass = 'panel status',
  metricsClass = 'metrics',
  statusText = 'Ready.',
  metricsContent = null,
} = {}) {
  return html`
    <section class=${sectionClass}>
      <div>
        <h2>Status</h2>
        <p id="statusMessage" role="status" aria-live="polite" aria-atomic="true">${statusText}</p>
      </div>
      <div class=${metricsClass}>${metricsContent ?? ''}</div>
    </section>
  `;
}
