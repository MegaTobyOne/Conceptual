/**
 * SignalWatcher: a Lit ReactiveController that re-renders the host whenever
 * any of the signals returned by `read()` change.
 *
 * The list of signals is re-evaluated on each host update, so it is safe to
 * derive signals from properties that are populated asynchronously (such as
 * a context-injected store). When the set of tracked signals changes, the
 * underlying effect is re-bound transparently.
 */

import { effect, type ReadonlySignal } from '@preact/signals-core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

type SignalList = readonly ReadonlySignal<unknown>[];

function listsMatch(a: SignalList, b: SignalList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export class SignalWatcher implements ReactiveController {
  #host: ReactiveControllerHost;
  #read: () => SignalList;
  #current: SignalList = [];
  #dispose: (() => void) | undefined;
  #initialised = false;

  constructor(host: ReactiveControllerHost, read: () => SignalList) {
    this.#host = host;
    this.#read = read;
    host.addController(this);
  }

  hostConnected(): void {
    this.#bind(this.#read());
  }

  hostUpdate(): void {
    const next = this.#read();
    if (!listsMatch(next, this.#current)) this.#bind(next);
  }

  hostDisconnected(): void {
    this.#dispose?.();
    this.#dispose = undefined;
    this.#initialised = false;
    this.#current = [];
  }

  #bind(list: SignalList): void {
    this.#dispose?.();
    this.#current = list;
    this.#initialised = false;
    this.#dispose = effect(() => {
      for (const s of list) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- intentional dependency read
        s.value;
      }
      if (this.#initialised) this.#host.requestUpdate();
      this.#initialised = true;
    });
  }
}
