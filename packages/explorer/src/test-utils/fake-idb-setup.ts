/**
 * Vitest setup file: register the fake-indexeddb shim onto globalThis.
 * Loaded once per worker by vitest before test files import.
 */

import 'fake-indexeddb/auto';
