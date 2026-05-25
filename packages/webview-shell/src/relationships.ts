export interface RelationshipManagerAction {
  readonly label: string;
  readonly fromLabel: string;
  readonly phrase: string;
  readonly toLabel: string;
  readonly helpText?: string;
  readonly href?: string;
  readonly command?: string;
  readonly dataAttributes?: Readonly<Record<string, string>>;
  readonly disabledReason?: string;
}

export interface RelationshipManagerOptions {
  readonly title: string;
  readonly description?: string;
  readonly actions: readonly RelationshipManagerAction[];
  readonly emptyText?: string;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function dataAttributesHtml(attributes: Readonly<Record<string, string>> | undefined): string {
  if (!attributes) {
    return "";
  }
  return Object.entries(attributes)
    .filter(([name]) => /^data-[a-z0-9-]+$/.test(name))
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
}

export function relationshipManagerHtml(options: RelationshipManagerOptions): string {
  const description = options.description ? `<p class="pspf-muted">${escapeText(options.description)}</p>` : "";
  const actions = options.actions
    .map((action) => {
      const endpoint = `<span class="pspf-relationship-endpoints"><strong>${escapeText(action.fromLabel)}</strong> <span>${escapeText(action.phrase)}</span> <strong>${escapeText(action.toLabel)}</strong></span>`;
      const help = action.helpText ? `<p class="pspf-muted">${escapeText(action.helpText)}</p>` : "";
      const command = action.href
        ? `<a class="pspf-button pspf-button--secondary" href="${escapeAttribute(action.href)}">${escapeText(action.label)}</a>`
        : action.command
          ? `<button type="button" class="pspf-button pspf-button--secondary" data-command="${escapeAttribute(action.command)}"${dataAttributesHtml(action.dataAttributes)}>${escapeText(action.label)}</button>`
          : `<span class="pspf-pill pspf-pill--neutral">${escapeText(action.disabledReason ?? "No action available")}</span>`;
      return `<li class="pspf-relationship-action">${endpoint}${help}${command}</li>`;
    })
    .join("");

  return `<section class="pspf-section pspf-relationship-manager">
  <h2>${escapeText(options.title)}</h2>
  ${description}
  ${actions ? `<ul class="pspf-relationship-actions">${actions}</ul>` : `<div class="pspf-empty">${escapeText(options.emptyText ?? "No relationship actions available.")}</div>`}
</section>`;
}
