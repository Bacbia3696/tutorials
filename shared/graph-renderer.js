import { createSvgElement, getSvgCanvasSize, computeEdgeGeometry } from "./graph-core.js";

function toClassList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [value].filter(Boolean);
}

function addClasses(element, classes) {
  for (const className of toClassList(classes)) {
    element.classList.add(className);
  }
}

export function prepareGraphCanvas({
  svgElement,
  fallbackSize = { width: 900, height: 520 },
  hasGraph,
  emptyMessage = "Load a graph to visualize it.",
  emptyClass = "graph-empty-label",
}) {
  svgElement.innerHTML = "";
  const { width, height } = getSvgCanvasSize(svgElement, fallbackSize);
  svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (!hasGraph) {
    const text = createSvgElement("text", {
      class: emptyClass,
      x: width / 2,
      y: height / 2,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    });
    text.textContent = emptyMessage;
    svgElement.appendChild(text);
    return { ready: false, width, height };
  }

  return { ready: true, width, height };
}

export function ensureArrowMarker({
  svgElement,
  id = "graph-arrow",
  markerWidth = 9,
  markerHeight = 9,
  refX = 8,
  refY = 4.5,
  fill = "rgba(57, 89, 121, 0.9)",
}) {
  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id,
    markerWidth,
    markerHeight,
    refX,
    refY,
    orient: "auto",
    markerUnits: "strokeWidth",
  });
  const arrowPath = createSvgElement("path", {
    d: `M 0 0 L ${markerWidth} ${markerHeight / 2} L 0 ${markerHeight} z`,
    fill,
  });
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svgElement.appendChild(defs);
}

export function createDirectedPairSet(edges) {
  return new Set(edges.map((edge) => `${edge.from}->${edge.to}`));
}

export function getReverseCurveOffset(edge, directedPairSet, magnitude = 22) {
  if (!directedPairSet.has(`${edge.to}->${edge.from}`)) {
    return 0;
  }
  return edge.from < edge.to ? magnitude : -magnitude;
}

export function renderGraphEdges({
  svgElement,
  edges,
  positions,
  nodeRadius = 20,
  directed = false,
  markerId = "graph-arrow",
  activeEdgeId = null,
  curveOffsetForEdge = () => 0,
  labelOffset = 10,
  edgeClassFn = () => [],
  edgeLabelTextFn = () => "",
  edgeLabelWidthFn = (text) => 10 + text.length * 7,
  edgeLabelBgClassFn = (_edge, isActive) => (isActive ? ["graph-edge-label-bg", "active"] : "graph-edge-label-bg"),
  edgeLabelClassFn = (_edge, isActive) => (isActive ? ["graph-edge-label", "active"] : "graph-edge-label"),
  edgeLabelVerticalOffset = 0.5,
}) {
  const edgesLayer = createSvgElement("g");

  for (const edge of edges) {
    const isActive = activeEdgeId !== null && edge.id === activeEdgeId;
    const geometry = computeEdgeGeometry({
      from: edge.from,
      to: edge.to,
      positions,
      nodeRadius,
      curveOffset: curveOffsetForEdge(edge),
      labelOffset,
    });

    const path = createSvgElement("path", { d: geometry.pathD });
    addClasses(path, ["graph-edge", ...toClassList(edgeClassFn(edge, isActive))]);
    if (isActive) {
      path.classList.add("active");
    }
    if (directed) {
      path.setAttribute("marker-end", `url(#${markerId})`);
    }
    edgesLayer.appendChild(path);

    const labelText = String(edgeLabelTextFn(edge, isActive));
    const labelWidth = edgeLabelWidthFn(labelText, edge, isActive);
    const labelBg = createSvgElement("rect", {
      x: geometry.labelX - labelWidth / 2,
      y: geometry.labelY - 8,
      width: labelWidth,
      height: 16,
      rx: 5,
    });
    addClasses(labelBg, edgeLabelBgClassFn(edge, isActive));
    edgesLayer.appendChild(labelBg);

    const label = createSvgElement("text", {
      x: geometry.labelX,
      y: geometry.labelY + edgeLabelVerticalOffset,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    });
    addClasses(label, edgeLabelClassFn(edge, isActive));
    label.textContent = labelText;
    edgesLayer.appendChild(label);
  }

  svgElement.appendChild(edgesLayer);
}

export function renderGraphNodes({
  svgElement,
  nodeCount,
  positions,
  nodeClassFn = () => [],
  renderNodeContent,
}) {
  const nodeLayer = createSvgElement("g");

  for (let index = 0; index < nodeCount; index += 1) {
    const group = createSvgElement("g", { class: "graph-node" });
    addClasses(group, nodeClassFn(index));

    renderNodeContent({
      group,
      index,
      position: positions[index],
    });

    nodeLayer.appendChild(group);
  }

  svgElement.appendChild(nodeLayer);
}
