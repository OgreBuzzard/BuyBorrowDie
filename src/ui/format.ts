export function usd(n: number): string {
  const sign = n < -0.5 ? "-" : "";
  return sign + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
}

/** Compact above ten million: $12.3M, $1.25B. */
export function usdShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e7) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return usd(n);
}

export function pct(x: number, digits = 0): string {
  return (x * 100).toFixed(digits) + "%";
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
