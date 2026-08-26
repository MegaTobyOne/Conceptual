import { PRESENTATION_LENS_LABELS, type PresentationLens } from "./presentation-lens.js";
import { escapeHtmlAttribute as escapeAttr, escapeHtmlText as escapeText } from "./encoding.js";

export interface PageHeaderOptions {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actionsHtml?: string;
}

export function pageHeaderHtml(options: PageHeaderOptions): string {
  const eyebrow = options.eyebrow ? `<p class="pspf-page-header__eyebrow">${escapeText(options.eyebrow)}</p>` : "";
  const description = options.description
    ? `<p class="pspf-page-header__description">${escapeText(options.description)}</p>`
    : "";
  const actions = options.actionsHtml ? `<div class="pspf-page-header__actions">${options.actionsHtml}</div>` : "";
  return `<header class="pspf-page-header"><div>${eyebrow}<h1>${escapeText(options.title)}</h1>${description}</div>${actions}</header>`;
}

export interface TrustChip {
  readonly label: string;
  readonly strong?: boolean;
}

export function trustChipsHtml(chips: readonly TrustChip[], label = "Record context"): string {
  return `<div class="pspf-trust-row" aria-label="${escapeAttr(label)}">${chips
    .map(
      (chip) =>
        `<span class="pspf-trust-chip${chip.strong ? " pspf-trust-chip--strong" : ""}">${escapeText(chip.label)}</span>`
    )
    .join("")}</div>`;
}

export interface MetricStripItem {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

export function metricStripHtml(items: readonly MetricStripItem[]): string {
  return `<div class="pspf-metric-strip">${items
    .map(
      (item) =>
        `<div class="pspf-metric-strip__item"><span>${escapeText(item.label)}</span><strong>${escapeText(String(item.value))}</strong>${item.detail ? `<small>${escapeText(item.detail)}</small>` : ""}</div>`
    )
    .join("")}</div>`;
}

export type AttentionTone = "danger" | "warning" | "ok" | "neutral";

export interface AttentionItem {
  readonly title: string;
  readonly detail: string;
  readonly tone: AttentionTone;
  readonly actionHtml?: string;
}

export function attentionListHtml(items: readonly AttentionItem[], label = "Needs attention"): string {
  return `<ul class="pspf-attention-list" aria-label="${escapeAttr(label)}">${items
    .map(
      (item) =>
        `<li class="pspf-attention-item"><span class="pspf-attention-item__tone pspf-attention-item__tone--${item.tone}" aria-hidden="true"></span><div><strong>${escapeText(item.title)}</strong><span>${escapeText(item.detail)}</span></div>${item.actionHtml ?? ""}</li>`
    )
    .join("")}</ul>`;
}

export interface TraceChainItem {
  readonly marker: string;
  readonly title: string;
  readonly detail: string;
}

export function traceChainHtml(items: readonly TraceChainItem[], label = "Traceability chain"): string {
  return `<ol class="pspf-trace-chain" aria-label="${escapeAttr(label)}">${items
    .map(
      (item) =>
        `<li class="pspf-trace-chain__item"><span class="pspf-trace-chain__marker">${escapeText(item.marker)}</span><div><strong>${escapeText(item.title)}</strong><span>${escapeText(item.detail)}</span></div></li>`
    )
    .join("")}</ol>`;
}

export interface DisclosureOptions {
  readonly summary: string;
  readonly bodyHtml: string;
  readonly open?: boolean;
}

export function disclosureHtml(options: DisclosureOptions): string {
  return `<details class="pspf-disclosure"${options.open ? " open" : ""}><summary>${escapeText(options.summary)}</summary><div class="pspf-disclosure__body">${options.bodyHtml}</div></details>`;
}

export interface LensSelectorOptions {
  readonly lens: PresentationLens;
  readonly command: string;
  readonly label?: string;
}

export function lensSelectorHtml(options: LensSelectorOptions): string {
  const label = options.label ?? "View for";
  return `<label class="pspf-lens-selector">${escapeText(label)}<select data-command="${escapeAttr(options.command)}" aria-label="${escapeAttr(label)}">${(
    Object.keys(PRESENTATION_LENS_LABELS) as PresentationLens[]
  )
    .map(
      (lens) =>
        `<option value="${lens}"${lens === options.lens ? " selected" : ""}>${escapeText(PRESENTATION_LENS_LABELS[lens])}</option>`
    )
    .join("")}</select></label>`;
}
