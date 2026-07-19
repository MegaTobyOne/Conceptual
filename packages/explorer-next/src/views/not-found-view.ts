import { customElement } from 'lit/decorators.js';
import { ViewBase } from './view-base.ts';

@customElement('pspf-not-found-view')
export class NotFoundView extends ViewBase {
  protected override heading(): string {
    return 'Not found';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-not-found-view': NotFoundView;
  }
}
