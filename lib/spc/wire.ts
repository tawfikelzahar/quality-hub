// JSON cannot carry NaN or ±Infinity (they turn into null), so results that
// travel from the server keep them as tagged strings and get them back on
// arrival. This keeps every value identical to what the calculator returned.

const TAG = '__num:'

export function wireReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isFinite(value) ? TAG + String(value) : value
}

export function wireReviver(_key: string, value: unknown): unknown {
  return typeof value === 'string' && value.startsWith(TAG) ? Number(value.slice(TAG.length)) : value
}
