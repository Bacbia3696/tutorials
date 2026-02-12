function safePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function mountAutoFitTree(container, diagram, options = {}) {
  const {
    shellClass = "tree-shell",
    viewportClass = "tree-viewport",
    paddingPx = 24,
    minHeightPx = 300,
    maxHeightPx = 860,
    maxViewportHeightRatio = 0.82,
  } = options;

  const shell = document.createElement("div");
  shell.className = shellClass;

  const viewport = document.createElement("div");
  viewport.className = viewportClass;

  viewport.appendChild(diagram);
  shell.appendChild(viewport);
  container.appendChild(shell);

  const diagramWidth = safePositiveNumber(
    Number.parseFloat(diagram.style.width),
    safePositiveNumber(diagram.offsetWidth, 1),
  );
  const diagramHeight = safePositiveNumber(
    Number.parseFloat(diagram.style.height),
    safePositiveNumber(diagram.offsetHeight, 1),
  );

  const viewportWidth = safePositiveNumber(viewport.clientWidth, 1);
  const viewportMaxHeight = Math.max(
    minHeightPx,
    Math.min(maxHeightPx, window.innerHeight * maxViewportHeightRatio),
  );

  const widthScale = Math.min((viewportWidth - paddingPx * 2) / diagramWidth, 1);
  const preferredHeight = diagramHeight * safePositiveNumber(widthScale, 1) + paddingPx * 2;
  const viewportHeight = Math.max(minHeightPx, Math.min(preferredHeight, viewportMaxHeight));
  viewport.style.height = `${Math.round(viewportHeight)}px`;

  const fitWidth = safePositiveNumber(viewport.clientWidth, 1);
  const fitHeight = safePositiveNumber(viewport.clientHeight, minHeightPx);
  const fitScale = Math.min(
    (fitWidth - paddingPx * 2) / diagramWidth,
    (fitHeight - paddingPx * 2) / diagramHeight,
    1,
  );
  const scale = safePositiveNumber(fitScale, 1);
  const translateX = (fitWidth - diagramWidth * scale) / 2;
  const translateY = (fitHeight - diagramHeight * scale) / 2;

  diagram.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}
