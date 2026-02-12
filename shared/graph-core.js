export function createSvgElement(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

export function getSvgCanvasSize(svgElement, fallback = { width: 900, height: 520 }) {
  const rect = svgElement.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return fallback;
}

export function computeCircularNodePositions(count, width, height, options = {}) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const twoNodeXRatio = options.twoNodeXRatio ?? 0.3;
  const twoNodeYRatio = options.twoNodeYRatio ?? 0.5;
  if (count === 2) {
    return [
      { x: width * twoNodeXRatio, y: height * twoNodeYRatio },
      { x: width * (1 - twoNodeXRatio), y: height * twoNodeYRatio },
    ];
  }

  const marginX = options.marginX ?? 90;
  const marginY = options.marginY ?? 90;
  const minRadiusX = options.minRadiusX ?? 90;
  const minRadiusY = options.minRadiusY ?? 86;
  const startAngle = options.startAngle ?? -Math.PI / 2;

  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = Math.max(minRadiusX, width / 2 - marginX);
  const radiusY = Math.max(minRadiusY, height / 2 - marginY);
  const positions = [];

  for (let i = 0; i < count; i += 1) {
    const angle = startAngle + (2 * Math.PI * i) / count;
    positions.push({
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    });
  }

  return positions;
}

export function computeEdgeGeometry({
  from,
  to,
  positions,
  nodeRadius = 20,
  curveOffset = 0,
  labelOffset = 10,
}) {
  const fromPos = positions[from];
  const toPos = positions[to];

  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const startX = fromPos.x + ux * nodeRadius;
  const startY = fromPos.y + uy * nodeRadius;
  const endX = toPos.x - ux * nodeRadius;
  const endY = toPos.y - uy * nodeRadius;

  if (curveOffset === 0) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    return {
      pathD: `M ${startX} ${startY} L ${endX} ${endY}`,
      labelX: midX + nx * labelOffset,
      labelY: midY + ny * labelOffset,
    };
  }

  const controlX = (startX + endX) / 2 + nx * curveOffset;
  const controlY = (startY + endY) / 2 + ny * curveOffset;
  return {
    pathD: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    labelX: (startX + 2 * controlX + endX) / 4,
    labelY: (startY + 2 * controlY + endY) / 4,
  };
}
