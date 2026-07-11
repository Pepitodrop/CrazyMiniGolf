import { decodeEngineOutput, encodeEngineCommand, type EngineCommand } from './protocol';
import type { EngineState } from '../game/types';
import type { WorkerRequest, WorkerResponse } from './worker';

export interface WorkerLike {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  postMessage(message: WorkerRequest, options?: StructuredSerializeOptions): void;
  terminate(): void;
}

interface PendingRequest {
  resolve: (state: EngineState) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const createDefaultWorker = (): WorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class BrainfuckEngineClient {
  private readonly worker: WorkerLike;
  private nextId = 1;
  private disposed = false;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    workerFactory: () => WorkerLike = createDefaultWorker,
    private readonly requestTimeoutMs = 5_000,
  ) {
    this.worker = workerFactory();
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      clearTimeout(request.timeoutId);
      this.pending.delete(event.data.id);
      if (event.data.error || !event.data.output) {
        request.reject(new Error(event.data.error ?? 'Brainfuck engine returned no output.'));
        return;
      }
      try {
        request.resolve(decodeEngineOutput(event.data.output));
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error('Invalid Brainfuck output.'));
      }
    });
    this.worker.addEventListener('error', (event) => {
      this.rejectAll(new Error(event.message || 'Brainfuck worker failed.'));
    });
  }

  run(command: EngineCommand): Promise<EngineState> {
    if (this.disposed) return Promise.reject(new Error('Brainfuck engine was disposed.'));

    const id = this.nextId;
    this.nextId += 1;
    const input = encodeEngineCommand(command);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Brainfuck worker did not respond within ${this.requestTimeoutMs} ms.`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timeoutId });
      const message: WorkerRequest = { id, input };
      try {
        this.worker.postMessage(message, { transfer: [input.buffer] });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error('Brainfuck worker request failed.'));
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    this.rejectAll(new Error('Brainfuck engine was disposed.'));
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeoutId);
      request.reject(error);
    }
    this.pending.clear();
  }
}
