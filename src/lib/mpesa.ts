export function extractMpesaCode(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  // Direct code input (10 alphanumeric chars starting with a letter)
  if (/^[A-Z][A-Z0-9]{9}$/.test(trimmed)) return trimmed;
  // Extract from full M-Pesa SMS
  const match = trimmed.match(/\b([A-Z][A-Z0-9]{9})\b/);
  return match ? match[1] : null;
}
