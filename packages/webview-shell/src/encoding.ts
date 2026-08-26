function htmlValue(value: unknown): string {
  return String(value ?? "");
}

export function escapeHtmlText(value: unknown): string {
  return htmlValue(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeHtmlAttribute(value: unknown): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const escapeHtml = escapeHtmlAttribute;
