/// <reference lib="webworker" />

import engineSource from './engine.bf?raw';
import { BrainfuckError, runBrainfuck } from './interpreter';

export interface WorkerRequest {
  id: number;
  input: Uint8Array;
}

export interface WorkerResponse {
  id: number;
  output?: Uint8Array;
  steps?: number;
  error?: string;
  errorCode?: string;
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data;
  try {
    const result = runBrainfuck(engineSource, input, {
      tapeSize: 96,
      stepLimit: 350_000,
      outputLimit: 32,
    });
    const response: WorkerResponse = { id, output: result.output, steps: result.steps };
    self.postMessage(response, { transfer: [response.output!.buffer] });
  } catch (error) {
    const response: WorkerResponse = {
      id,
      error: error instanceof Error ? error.message : 'Unknown Brainfuck worker error.',
      errorCode: error instanceof BrainfuckError ? error.code : 'UNKNOWN',
    };
    self.postMessage(response);
  }
});

export {};
