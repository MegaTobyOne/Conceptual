import './app/pspf-app.ts';

declare global {
  // Injected by Vite at build time (see vite.config.ts).
  const __APP_VERSION__: string;
}
