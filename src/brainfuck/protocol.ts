import type { EngineState, Vec2 } from '../game/types';

export const ENGINE_INPUT_BYTES = 32;
export const ENGINE_OUTPUT_BYTES = 15;

export interface EngineCommand {
  state: EngineState;
  aim?: {
    velocityX: number;
    xNegative: boolean;
    velocityY: number;
    yNegative: boolean;
    strength: number;
  };
  strike?: boolean;
  tick?: boolean;
  blockX?: boolean;
  blockY?: boolean;
  decayX?: boolean;
  decayY?: boolean;
  holeSensor?: boolean;
  advance?: boolean;
  reset?: Vec2;
  maxLevel: number;
  paused?: boolean;
}

const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
const flag = (value: boolean | undefined): number => (value ? 1 : 0);

export function encodeEngineCommand(command: EngineCommand): Uint8Array {
  const { state, aim, reset } = command;
  return Uint8Array.from([
    byte(state.level),
    byte(state.x),
    byte(state.y),
    byte(state.velocityX),
    flag(state.velocityXNegative),
    byte(state.velocityY),
    flag(state.velocityYNegative),
    byte(aim?.velocityX ?? 0),
    flag(aim?.xNegative),
    byte(aim?.velocityY ?? 0),
    flag(aim?.yNegative),
    byte(aim?.strength ?? state.strength),
    byte(state.strokes),
    flag(command.strike),
    flag(command.tick && !command.paused),
    flag(command.blockX),
    flag(command.blockY),
    flag(command.decayX),
    flag(command.decayY),
    flag(command.holeSensor),
    flag(command.advance),
    flag(reset !== undefined),
    byte(reset?.x ?? 0),
    byte(reset?.y ?? 0),
    byte(command.maxLevel),
    flag(command.paused),
    0,
    0,
    flag(state.inHole),
    flag(state.levelComplete),
    0,
    0,
  ]);
}

export function decodeEngineOutput(output: Uint8Array): EngineState {
  if (output.length !== ENGINE_OUTPUT_BYTES) {
    throw new Error(
      `Brainfuck engine returned ${output.length} bytes; expected ${ENGINE_OUTPUT_BYTES}.`,
    );
  }
  const value = (index: number): number => output[index] ?? 0;
  return {
    level: value(0),
    x: value(1),
    y: value(2),
    velocityX: value(3),
    velocityXNegative: value(4) !== 0,
    velocityY: value(5),
    velocityYNegative: value(6) !== 0,
    strength: value(7),
    strokes: value(8),
    collision: value(9) !== 0,
    movingValue: value(10),
    inHole: value(11) !== 0,
    levelComplete: value(12) !== 0,
    errorCode: value(13),
  };
}

export function createInitialState(level: number, start: Vec2): EngineState {
  return {
    level,
    x: start.x,
    y: start.y,
    velocityX: 0,
    velocityXNegative: false,
    velocityY: 0,
    velocityYNegative: false,
    strength: 6,
    strokes: 0,
    collision: false,
    movingValue: 0,
    inHole: false,
    levelComplete: false,
    errorCode: 0,
  };
}
