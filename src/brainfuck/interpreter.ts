export interface BrainfuckRunOptions {
  tapeSize?: number;
  stepLimit?: number;
  outputLimit?: number;
}

export interface BrainfuckRunResult {
  output: Uint8Array;
  tape: Uint8Array;
  pointer: number;
  steps: number;
}

export class BrainfuckError extends Error {
  constructor(
    message: string,
    readonly code: 'SYNTAX' | 'STEP_LIMIT' | 'MEMORY_LIMIT' | 'OUTPUT_LIMIT',
  ) {
    super(message);
    this.name = 'BrainfuckError';
  }
}

const COMMANDS = new Set(['>', '<', '+', '-', '.', ',', '[', ']']);

export function compileBrainfuck(source: string): { program: string; jumps: Map<number, number> } {
  const program = [...source].filter((character) => COMMANDS.has(character)).join('');
  const stack: number[] = [];
  const jumps = new Map<number, number>();

  for (let index = 0; index < program.length; index += 1) {
    const command = program[index];
    if (command === '[') stack.push(index);
    if (command === ']') {
      const opening = stack.pop();
      if (opening === undefined) {
        throw new BrainfuckError(`Unmatched closing bracket at command ${index}.`, 'SYNTAX');
      }
      jumps.set(opening, index);
      jumps.set(index, opening);
    }
  }

  if (stack.length > 0) {
    throw new BrainfuckError(`Unmatched opening bracket at command ${stack.at(-1)}.`, 'SYNTAX');
  }
  return { program, jumps };
}

export function runBrainfuck(
  source: string,
  input: Uint8Array = new Uint8Array(),
  options: BrainfuckRunOptions = {},
): BrainfuckRunResult {
  const tapeSize = options.tapeSize ?? 128;
  const stepLimit = options.stepLimit ?? 500_000;
  const outputLimit = options.outputLimit ?? 256;
  if (tapeSize < 1 || stepLimit < 1 || outputLimit < 1) {
    throw new RangeError('Brainfuck limits must be positive integers.');
  }

  const { program, jumps } = compileBrainfuck(source);
  const tape = new Uint8Array(tapeSize);
  const output: number[] = [];
  let pointer = 0;
  let instruction = 0;
  let inputIndex = 0;
  let steps = 0;

  while (instruction < program.length) {
    steps += 1;
    if (steps > stepLimit) {
      throw new BrainfuckError(`Execution exceeded ${stepLimit} steps.`, 'STEP_LIMIT');
    }

    const command = program[instruction];
    switch (command) {
      case '>':
        pointer += 1;
        if (pointer >= tape.length) {
          throw new BrainfuckError(`Tape pointer exceeded ${tape.length - 1}.`, 'MEMORY_LIMIT');
        }
        break;
      case '<':
        pointer -= 1;
        if (pointer < 0) throw new BrainfuckError('Tape pointer moved below zero.', 'MEMORY_LIMIT');
        break;
      case '+':
        tape[pointer] = ((tape[pointer] ?? 0) + 1) & 0xff;
        break;
      case '-':
        tape[pointer] = ((tape[pointer] ?? 0) - 1) & 0xff;
        break;
      case '.':
        output.push(tape[pointer] ?? 0);
        if (output.length > outputLimit) {
          throw new BrainfuckError(`Output exceeded ${outputLimit} bytes.`, 'OUTPUT_LIMIT');
        }
        break;
      case ',':
        tape[pointer] = input[inputIndex] ?? 0;
        inputIndex += 1;
        break;
      case '[':
        if (tape[pointer] === 0) {
          const destination = jumps.get(instruction);
          if (destination === undefined) throw new BrainfuckError('Missing jump target.', 'SYNTAX');
          instruction = destination;
        }
        break;
      case ']':
        if (tape[pointer] !== 0) {
          const destination = jumps.get(instruction);
          if (destination === undefined) throw new BrainfuckError('Missing jump target.', 'SYNTAX');
          instruction = destination;
        }
        break;
      default:
        break;
    }
    instruction += 1;
  }

  return { output: Uint8Array.from(output), tape, pointer, steps };
}
