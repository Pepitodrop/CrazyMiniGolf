import { decodeEngineOutput, encodeEngineCommand, type EngineCommand } from './protocol';
import type { EngineState } from '../game/types';
import type { WorkerRequest, WorkerResponse } from './worker';

export class BrainfuckEngineClient {
  private readonly worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (state: EngineState) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
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
      for (const request of this.pending.values()) request.reject(new Error(event.message));
      this.pending.clear();
    });
  }

  run(command: EngineCommand): Promise<EngineState> {
    const id = this.nextId;
    this.nextId += 1;
    const input = encodeEngineCommand(command);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message: WorkerRequest = { id, input };
      this.worker.postMessage(message, { transfer: [input.buffer] });
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const request of this.pending.values()) {
      request.reject(new Error('Brainfuck engine was disposed.'));
    }
    this.pending.clear();
  }
}
