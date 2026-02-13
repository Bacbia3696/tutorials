import { html } from '../lit.js';

export function renderCodeLensPanel({
  sectionClass = 'panel code-view',
  title = 'Pseudocode Lens',
  gridClass = 'code-grid',
  content = null,
} = {}) {
  return html`
    <section class=${sectionClass}>
      <h2>${title}</h2>
      <div class=${gridClass}>${content ?? ''}</div>
    </section>
  `;
}
