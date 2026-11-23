export function formatSigned(value: number | undefined, digits = 1): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

export function formatValue(value: number | undefined, digits = 1): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}
