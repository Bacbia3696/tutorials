import { getTutorialConfig } from './tutorial-registry.js';
import { defineTutorialLitHost } from './tutorial-lit-host.js';

export function defineTutorialApp(
  moduleBaseUrl,
  { tutorialId, renderTemplate, runtimeModulePath },
) {
  const config = getTutorialConfig(tutorialId);
  if (!config) {
    throw new Error(`[tutorial-app] Unknown tutorial id: "${tutorialId ?? ''}".`);
  }

  if (!moduleBaseUrl) {
    throw new Error('[tutorial-app] moduleBaseUrl is required (pass import.meta.url).');
  }

  const resolvedRuntimeModulePath =
    runtimeModulePath ?? new URL('./app-runtime.js', moduleBaseUrl).href;

  defineTutorialLitHost({
    tagName: config.tagName,
    runtimeModulePath: resolvedRuntimeModulePath,
    renderTemplate,
  });
}
