/**
 * Shop webview utility helpers.
 *
 * Small pure helpers used by Shop's webview HTML emitters. Kept in a
 * focused module so the body of `extension.ts` can stay close to the
 * VS Code command/business-logic surface. None of these helpers touch
 * VS Code APIs or shop store state.
 */

export { escapeHtml } from "@pspf/webview-shell";

export function commandUri(command: string, args: readonly unknown[]): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
}

export function formatToken(value: unknown): string {
  return String(value ?? "")
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatCurrency(value: number, currency = "AUD"): string {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `AUD ${new Intl.NumberFormat("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
  }
}
