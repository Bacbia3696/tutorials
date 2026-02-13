const DEFAULT_NODE_LABEL_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function normalizeGraphLabel(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

export function createLabelToIndex(nodes) {
  const labelToIndex = new Map();
  nodes.forEach((label, index) => {
    labelToIndex.set(label, index);
  });
  return labelToIndex;
}

export function edgeKeyForMode(mode, fromIndex, toIndex) {
  if (mode === 'directed') {
    return `${fromIndex}->${toIndex}`;
  }
  return fromIndex < toIndex ? `${fromIndex}--${toIndex}` : `${toIndex}--${fromIndex}`;
}

function parseEdgeLines(text) {
  return String(text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function parseNodeLabelsInput(
  text,
  {
    minNodes = 2,
    maxNodes = 10,
    labelPattern = DEFAULT_NODE_LABEL_PATTERN,
    minNodesMessage = `Please provide at least ${minNodes} nodes.`,
    maxNodesMessage = `Please use at most ${maxNodes} nodes.`,
    invalidLabelMessage = (label) =>
      `Invalid node label '${label}'. Use letters/numbers/underscore and start with a letter.`,
    duplicateLabelMessage = (label) => `Duplicate node label '${label}'.`,
  } = {},
) {
  const tokens = String(text ?? '')
    .trim()
    .split(/[\s,]+/)
    .map((token) => normalizeGraphLabel(token))
    .filter((token) => token.length > 0);

  if (tokens.length < minNodes) {
    return { error: minNodesMessage };
  }
  if (tokens.length > maxNodes) {
    return { error: maxNodesMessage };
  }

  const nodes = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!labelPattern.test(token)) {
      return { error: invalidLabelMessage(token) };
    }
    if (seen.has(token)) {
      return { error: duplicateLabelMessage(token) };
    }
    seen.add(token);
    nodes.push(token);
  }

  return { nodes };
}

export function parseWeightedEdgesInput(
  text,
  {
    labelToIndex,
    mode = 'directed',
    lineFormatMessage = (lineNumber) => `Edge line ${lineNumber} is invalid. Use: FROM TO WEIGHT`,
    unknownNodeMessage = (lineNumber, label) => `Edge line ${lineNumber}: unknown node '${label}'.`,
    invalidWeightMessage = (lineNumber) => `Edge line ${lineNumber}: weight must be an integer.`,
    requirePositiveInteger = false,
    positiveWeightMessage = (lineNumber) =>
      `Edge line ${lineNumber}: weight must be a positive integer.`,
    allowNegativeWeightInUndirected = true,
    undirectedNegativeWeightMessage = 'Undirected mode disallows negative weights (it immediately creates a negative cycle). Use directed mode.',
    selfLoopMessage = (lineNumber) => `Edge line ${lineNumber}: self-loop is not allowed.`,
    duplicateEdgeMessage = (lineNumber, fromLabel, toLabel) =>
      `Edge line ${lineNumber}: duplicate edge '${fromLabel} ${toLabel}'.`,
    weightValidator = (weight) => Number.isInteger(weight),
  } = {},
) {
  const lines = parseEdgeLines(text);
  if (lines.length === 0) {
    return { error: 'Please provide at least one edge line.' };
  }
  if (!(labelToIndex instanceof Map)) {
    return { error: 'Internal error: labelToIndex map is required.' };
  }

  const edges = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const parts = lines[i].split(/[\s,]+/).filter((token) => token.length > 0);
    if (parts.length !== 3) {
      return { error: lineFormatMessage(lineNumber) };
    }

    const fromLabel = normalizeGraphLabel(parts[0]);
    const toLabel = normalizeGraphLabel(parts[1]);
    const weight = Number(parts[2]);

    if (!labelToIndex.has(fromLabel)) {
      return { error: unknownNodeMessage(lineNumber, fromLabel) };
    }
    if (!labelToIndex.has(toLabel)) {
      return { error: unknownNodeMessage(lineNumber, toLabel) };
    }
    if (!weightValidator(weight)) {
      return { error: invalidWeightMessage(lineNumber, parts[2]) };
    }
    if (requirePositiveInteger && weight <= 0) {
      return { error: positiveWeightMessage(lineNumber) };
    }
    if (!allowNegativeWeightInUndirected && mode === 'undirected' && weight < 0) {
      return { error: undirectedNegativeWeightMessage };
    }

    const from = labelToIndex.get(fromLabel);
    const to = labelToIndex.get(toLabel);
    if (from === to) {
      return { error: selfLoopMessage(lineNumber, fromLabel) };
    }

    const key = edgeKeyForMode(mode, from, to);
    if (seen.has(key)) {
      return { error: duplicateEdgeMessage(lineNumber, fromLabel, toLabel, mode) };
    }

    seen.add(key);
    edges.push({
      id: edges.length + 1,
      from,
      to,
      weight,
    });
  }

  return { edges };
}

export function parseDirectedEdgesInput(
  text,
  {
    labelToIndex,
    lineFormatMessage = (lineNumber) => `Edge line ${lineNumber} is invalid. Use: FROM TO`,
    unknownNodeMessage = (lineNumber, label) => `Edge line ${lineNumber}: unknown node '${label}'.`,
    duplicateEdgeMessage = (lineNumber, fromLabel, toLabel) =>
      `Edge line ${lineNumber}: duplicate edge '${fromLabel} ${toLabel}'.`,
    selfLoopMessage = (lineNumber) => `Edge line ${lineNumber}: self-loop is not allowed.`,
    allowSelfLoops = false,
  } = {},
) {
  const lines = parseEdgeLines(text);
  if (lines.length === 0) {
    return { error: 'Please provide at least one edge line.' };
  }
  if (!(labelToIndex instanceof Map)) {
    return { error: 'Internal error: labelToIndex map is required.' };
  }

  const edges = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const parts = lines[i].split(/[\s,]+/).filter((token) => token.length > 0);
    if (parts.length !== 2) {
      return { error: lineFormatMessage(lineNumber) };
    }

    const fromLabel = normalizeGraphLabel(parts[0]);
    const toLabel = normalizeGraphLabel(parts[1]);

    if (!labelToIndex.has(fromLabel)) {
      return { error: unknownNodeMessage(lineNumber, fromLabel) };
    }
    if (!labelToIndex.has(toLabel)) {
      return { error: unknownNodeMessage(lineNumber, toLabel) };
    }

    const from = labelToIndex.get(fromLabel);
    const to = labelToIndex.get(toLabel);
    if (from === to && !allowSelfLoops) {
      return { error: selfLoopMessage(lineNumber, fromLabel) };
    }

    const key = `${from}->${to}`;
    if (seen.has(key)) {
      return { error: duplicateEdgeMessage(lineNumber, fromLabel, toLabel) };
    }

    seen.add(key);
    edges.push({
      id: edges.length + 1,
      from,
      to,
    });
  }

  return { edges };
}
