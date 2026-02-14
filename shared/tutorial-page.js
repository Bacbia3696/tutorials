import { getTutorialConfig } from './tutorial-registry.js';

function ensureCacheBustToken() {
  if (window.__tutorialCacheBust) {
    return window.__tutorialCacheBust;
  }
  const cacheBust = Date.now().toString();
  window.__tutorialCacheBust = cacheBust;
  return cacheBust;
}

function toVersionedUrl(path) {
  const url = new URL(path, window.location.href);
  url.searchParams.set('v', ensureCacheBustToken());
  return url.href;
}

function ensurePreconnectLink(href, withCrossOrigin = false) {
  let link = document.querySelector(`link[rel="preconnect"][href="${href}"]`);
  if (link) {
    return link;
  }

  link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  if (withCrossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
  return link;
}

function ensureStylesheet(href, key, shouldCacheBust = true) {
  let link = document.querySelector(`link[rel="stylesheet"][data-tutorial-asset="${key}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.tutorialAsset = key;
    document.head.appendChild(link);
  }
  link.href = shouldCacheBust ? toVersionedUrl(href) : href;
  return link;
}

function ensureFavicon(href) {
  let link = document.querySelector('link[rel="icon"][data-tutorial-asset="favicon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.dataset.tutorialAsset = 'favicon';
    document.head.appendChild(link);
  }
  link.href = toVersionedUrl(href);
  return link;
}

function ensureMetaDescription(content) {
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function ensureHostElement(tagName) {
  let host = document.querySelector(tagName);
  if (host) {
    return host;
  }
  host = document.createElement(tagName);
  document.body.appendChild(host);
  return host;
}

function loadTutorialEntry(moduleEntryPath) {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = toVersionedUrl(moduleEntryPath);
  document.body.appendChild(script);
}

function renderBootstrapError(message) {
  console.error(`[tutorial-page] ${message}`);
  const notice = document.createElement('div');
  notice.style.cssText =
    'padding:24px;margin:20px auto;max-width:640px;border-radius:12px;' +
    'background:#fff3f3;border:1px solid #e8a0a0;color:#7a2020;font-family:system-ui,sans-serif;';
  notice.textContent = message;
  document.body.appendChild(notice);
}

function bootstrapTutorialPage(tutorialId) {
  const config = getTutorialConfig(tutorialId);
  if (!config) {
    renderBootstrapError(`Unknown tutorial id: "${tutorialId ?? ''}".`);
    return;
  }

  document.title = config.title;
  ensureMetaDescription(config.description);

  ensurePreconnectLink('https://fonts.googleapis.com');
  ensurePreconnectLink('https://fonts.gstatic.com', true);
  ensureFavicon('../favicon.svg');

  if (config.fontHref) {
    ensureStylesheet(config.fontHref, 'font', false);
  }
  ensureStylesheet('../shared/tutorial-base.css', 'tutorial-base');
  ensureStylesheet('./styles.css', 'tutorial-local');

  ensureHostElement(config.tagName);
  loadTutorialEntry(config.moduleEntryPath ?? './app.js');
}

function getTutorialIdFromScriptTag() {
  const tutorialScripts = [...document.querySelectorAll('script[data-tutorial]')];
  if (!tutorialScripts.length) {
    return null;
  }

  const currentScriptPath = new URL(import.meta.url, window.location.href).pathname;
  const script = tutorialScripts.find((candidate) => {
    if (!candidate.src) {
      return false;
    }
    try {
      return new URL(candidate.src, window.location.href).pathname === currentScriptPath;
    } catch {
      return false;
    }
  });

  return (script ?? tutorialScripts[0]).dataset.tutorial ?? null;
}

function start() {
  bootstrapTutorialPage(getTutorialIdFromScriptTag());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
