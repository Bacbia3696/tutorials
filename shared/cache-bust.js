(function () {
  function ensureCacheBust() {
    if (window.__tutorialCacheBust) {
      return window.__tutorialCacheBust;
    }
    const cacheBust = Date.now().toString();
    window.__tutorialCacheBust = cacheBust;
    return cacheBust;
  }

  function toVersionedUrl(path, cacheBust) {
    const url = new URL(path, window.location.href);
    url.searchParams.set("v", cacheBust);
    return url.href;
  }

  function applyCacheBustToLinks() {
    const cacheBust = ensureCacheBust();
    const links = document.querySelectorAll('link[data-cache-bust="1"]');

    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href) {
        continue;
      }
      link.setAttribute("href", toVersionedUrl(href, cacheBust));
    }
  }

  function loadTutorialModule(modulePath = "./app.js") {
    const cacheBust = ensureCacheBust();
    const script = document.createElement("script");
    script.type = "module";
    script.src = toVersionedUrl(modulePath, cacheBust);
    document.body.appendChild(script);
  }

  window.loadTutorialModule = loadTutorialModule;
  applyCacheBustToLinks();
})();
