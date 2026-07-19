import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals-core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { SignalWatcher } from './signal-watcher.ts';

class FakeHost implements ReactiveControllerHost {
  controllers: ReactiveController[] = [];
  updates = 0;
  addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }
  removeController(controller: ReactiveController): void {
    this.controllers = this.controllers.filter((c) => c !== controller);
  }
  requestUpdate(): void {
    this.updates += 1;
  }
  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
  connect(): void {
    for (const c of this.controllers) c.hostConnected?.();
  }
  disconnect(): void {
    for (const c of this.controllers) c.hostDisconnected?.();
  }
}

describe('SignalWatcher', () => {
  it('does not request update on initial subscription', () => {
    const host = new FakeHost();
    const s = signal(0);
    new SignalWatcher(host, () => [s]);
    host.connect();
    expect(host.updates).toBe(0);
  });

  it('requests an update each time a watched signal changes', () => {
    const host = new FakeHost();
    const a = signal('x');
    const b = signal(1);
    new SignalWatcher(host, () => [a, b]);
    host.connect();

    a.value = 'y';
    expect(host.updates).toBe(1);

    b.value = 2;
    expect(host.updates).toBe(2);
  });

  it('stops listening after disconnect', () => {
    const host = new FakeHost();
    const s = signal(0);
    new SignalWatcher(host, () => [s]);
    host.connect();
    host.disconnect();

    s.value = 99;
    expect(host.updates).toBe(0);
  });
});
