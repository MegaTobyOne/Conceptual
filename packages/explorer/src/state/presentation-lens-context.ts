import { createContext } from '@lit/context';
import type { PresentationLens } from '@pspf/webview-shell';

export const presentationLensContext = createContext<PresentationLens>(
  Symbol('pspf-presentation-lens'),
);
