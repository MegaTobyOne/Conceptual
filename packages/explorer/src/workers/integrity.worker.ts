/**
 * Integrity scanner Web Worker.
 *
 * Receives an `IntegrityInput` over `postMessage`, runs the pure-domain
 * scanner, and posts back the resulting `IntegrityReport`. Keeps long
 * scans off the main thread; the same domain function still runs there
 * for tests and small datasets.
 */

import { scanIntegrity, type IntegrityInput, type IntegrityReport } from '../domain/integrity.ts';

interface ScanRequest {
  type: 'scan';
  input: IntegrityInput;
}

interface ScanResponse {
  type: 'report';
  report: IntegrityReport;
}

interface ErrorResponse {
  type: 'error';
  message: string;
}

self.addEventListener('message', (event: MessageEvent<ScanRequest>) => {
  try {
    if (event.data?.type !== 'scan') return;
    const report = scanIntegrity(event.data.input);
    const response: ScanResponse = { type: 'report', report };
    (self as unknown as Worker).postMessage(response);
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    (self as unknown as Worker).postMessage(response);
  }
});

export type { ScanRequest, ScanResponse, ErrorResponse };
