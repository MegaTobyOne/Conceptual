/**
 * Shop webview utility helpers.
 *
 * Small pure helpers used by Shop's webview HTML emitters. Kept in a
 * focused module so the body of `extension.ts` can stay close to the
 * VS Code command/business-logic surface. None of these helpers touch
 * VS Code APIs or shop store state.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function commandUri(command: string, args: readonly unknown[]): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
}

export function formatToken(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatCurrency(value: number, currency = "AUD"): string {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `AUD ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(amount)}`;
  }
}
