export function parseArrayInput(
  text,
  { maxValues = 16, maxValuesMessage = `Please use at most ${maxValues} values.` } = {},
) {
  const tokens = String(text ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { error: 'Array cannot be empty.' };
  }
  if (tokens.length > maxValues) {
    return { error: maxValuesMessage };
  }

  const values = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { error: `Invalid integer: ${token}` };
    }
    values.push(value);
  }

  return { values };
}

export function randomIntegerArray({ minLength = 6, maxLength = 10, maxValue = 10 } = {}) {
  const length = minLength + Math.floor(Math.random() * (maxLength - minLength + 1));
  const values = [];
  for (let i = 0; i < length; i += 1) {
    values.push(Math.floor(Math.random() * maxValue));
  }
  return values;
}
