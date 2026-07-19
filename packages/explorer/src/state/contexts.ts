import { createContext } from '@lit/context';
import type { AppStore } from './app-store.ts';

export const appStoreContext = createContext<AppStore>(Symbol('pspf-app-store'));
