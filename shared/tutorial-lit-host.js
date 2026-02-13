import { LitElement } from './lit.js';

export function defineTutorialLitHost({
  tagName,
  runtimeModulePath = './app-runtime.js',
  renderTemplate,
}) {
  class TutorialLitHost extends LitElement {
    constructor() {
      super();
      this.runtimeLoaded = false;
    }

    createRenderRoot() {
      return this;
    }

    async firstUpdated() {
      if (this.runtimeLoaded) {
        return;
      }
      this.runtimeLoaded = true;

      const runtimeUrl = new URL(runtimeModulePath, import.meta.url);
      if (window.__tutorialCacheBust) {
        runtimeUrl.searchParams.set('v', window.__tutorialCacheBust);
      }

      try {
        await import(runtimeUrl.href);
      } catch (error) {
        console.error(
          `[tutorial-lit-host] Failed to load runtime module: ${runtimeUrl.href}`,
          error,
        );
        const notice = document.createElement('div');
        notice.style.cssText =
          'padding:24px;margin:20px auto;max-width:640px;border-radius:12px;' +
          'background:#fff3f3;border:1px solid #e8a0a0;color:#7a2020;font-family:system-ui,sans-serif;';
        notice.innerHTML =
          `<strong>Failed to load tutorial runtime.</strong><br>` +
          `<code style="font-size:0.85em;word-break:break-all">${runtimeUrl.href}</code><br><br>` +
          `Check that the dev server is running and that no syntax errors exist in the module.`;
        this.appendChild(notice);
      }
    }

    render() {
      return renderTemplate();
    }
  }

  if (!customElements.get(tagName)) {
    customElements.define(tagName, TutorialLitHost);
  }
}
