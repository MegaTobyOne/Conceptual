import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

export type StatusChipTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

@customElement('pspf-status-chip')
export class StatusChip extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: inline-flex;
        min-width: 0;
        max-width: 100%;
      }
      span {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        padding: 0.15rem var(--space-2);
        overflow: hidden;
        border: 1px solid var(--chip-colour, var(--pspf-border));
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--chip-colour, var(--pspf-muted)) 10%,
          var(--pspf-surface-strong)
        );
        color: var(--pspf-text);
        font-size: var(--text-xs);
        font-weight: 600;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      :host([tone='accent']) span {
        --chip-colour: var(--pspf-accent);
      }
      :host([tone='warning']) span {
        --chip-colour: var(--colour-action-blocked);
      }
      :host([tone='danger']) span {
        --chip-colour: var(--colour-status-no);
      }
      :host([tone='success']) span {
        --chip-colour: var(--colour-status-yes);
      }
    `,
  ];

  @property({ reflect: true }) accessor tone: StatusChipTone = 'neutral';

  override render(): TemplateResult {
    return html`<span><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-status-chip': StatusChip;
  }
}
