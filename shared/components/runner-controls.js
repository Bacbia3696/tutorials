import { html } from '../lit.js';

export function renderRunnerControls({
  speedMs = 400,
  keyHint = null,
  title = 'Playback Controls',
  speedLabel = 'Speed',
  speedMin = 120,
  speedMax = 1200,
  speedStep = 20,
} = {}) {
  const parsedSpeed = Number.parseInt(speedMs, 10);
  const parsedMin = Number.parseInt(speedMin, 10);
  const parsedMax = Number.parseInt(speedMax, 10);
  const parsedStep = Number.parseInt(speedStep, 10);
  const resolvedMin = Number.isFinite(parsedMin) ? parsedMin : 120;
  const resolvedMax = Number.isFinite(parsedMax) ? parsedMax : 1200;
  const resolvedStep = Number.isFinite(parsedStep) ? parsedStep : 20;
  const fallbackSpeed = Number.isFinite(parsedSpeed) ? parsedSpeed : 400;
  const resolvedSpeed = Math.min(Math.max(fallbackSpeed, resolvedMin), resolvedMax);

  return html`
    <aside class="controls-runner">
      <h3>${title}</h3>

      <div class="runner-grid">
        <button id="animateBtn" class="btn btn-primary">Run Animated</button>
        <button id="stepBtn" class="btn">Step</button>
        <button id="instantBtn" class="btn">Apply Instantly</button>
        <button id="finishBtn" class="btn btn-muted">Finish Current</button>
      </div>

      <div class="runner-speed">
        <label for="speedRange">${speedLabel}</label>
        <input
          id="speedRange"
          type="range"
          min=${resolvedMin}
          max=${resolvedMax}
          step=${resolvedStep}
          value=${resolvedSpeed}
        />
        <span id="speedLabel">${resolvedSpeed} ms</span>
      </div>

      ${keyHint ? html`<p class="key-hint">${keyHint}</p>` : ''}
    </aside>
  `;
}
