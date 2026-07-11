import { describe, expect, it, vi } from 'vitest';
import { BrainfuckEngineClient, type WorkerLike } from '../src/brainfuck/EngineClient';
import { createInitialState } from '../src/brainfuck/protocol';
import type { WorkerRequest, WorkerResponse } from '../src/brainfuck/worker';

class FakeWorker implements WorkerLike {
  messageListener: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  errorListener: ((event: ErrorEvent) => void) | null = null;
  lastMessage: WorkerRequest | null = null;
  terminated = false;
  postError: Error | null = null;

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<WorkerResponse>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageListener = listener as (event: MessageEvent<WorkerResponse>) => void;
    } else {
      this.errorListener = listener as (event: ErrorEvent) => void;
    }
  }

  postMessage(message: WorkerRequest): void {
    if (this.postError) throw this.postError;
    this.lastMessage = message;
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(output: Uint8Array): void {
    this.messageListener?.({
      data: { id: this.lastMessage?.id ?? 0, output },
    } as MessageEvent<WorkerResponse>);
  }
}

describe('BrainfuckEngineClient', () => {
  it('serializes requests and decodes worker responses', async () => {
    const worker = new FakeWorker();
    const client = new BrainfuckEngineClient(() => worker, 1000);
    const promise = client.run({
      state: createInitialState(1, { x: 20, y: 30 }),
      maxLevel: 9,
    });

    expect(worker.lastMessage?.input).toHaveLength(32);
    worker.respond(Uint8Array.from([1, 20, 30, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0]));

    await expect(promise).resolves.toMatchObject({ level: 1, x: 20, y: 30 });
    client.dispose();
  });

  it('cleans up immediately when posting to the worker throws synchronously', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    worker.postError = new Error('structured clone failed');
    const client = new BrainfuckEngineClient(() => worker, 50);

    await expect(
      client.run({ state: createInitialState(1, { x: 1, y: 1 }), maxLevel: 9 }),
    ).rejects.toThrow(/structured clone failed/);
    await vi.advanceTimersByTimeAsync(60);
    client.dispose();
    vi.useRealTimers();
  });

  it('rejects timed-out requests and disposed clients', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = new BrainfuckEngineClient(() => worker, 50);
    const promise = client.run({ state: createInitialState(1, { x: 1, y: 1 }), maxLevel: 9 });
    const expectation = expect(promise).rejects.toThrow(/did not respond/);

    await vi.advanceTimersByTimeAsync(51);
    await expectation;
    client.dispose();
    await expect(
      client.run({ state: createInitialState(1, { x: 1, y: 1 }), maxLevel: 9 }),
    ).rejects.toThrow(/disposed/);
    vi.useRealTimers();
  });
});
