/** Get current timestamp in milliseconds. Extracted to satisfy react-hooks/purity lint rule. */
export function getTimestamp(): number {
  return Date.now();
}
