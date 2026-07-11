# Brainfuck binary protocol

Each engine invocation is stateless at the interpreter boundary but stateful at the game boundary: TypeScript serializes the complete authoritative state, Brainfuck mutates it on its tape, and TypeScript accepts only the returned state. No JSON enters the Brainfuck interpreter.

## Input packet: 32 bytes

The byte order exactly matches tape cells `0–31` documented in `src/brainfuck/memory-map.md`. Flags are `0` or `1`. Coordinates and speeds must stay within `0–255`.

An invocation may contain one or more orthogonal flags, although the game normally sends one action at a time:

- reset
- strike
- physics tick
- hole capture
- advance level

## Output packet: 15 bytes

| Byte | Field                          |
| ---: | ------------------------------ |
|    0 | level                          |
|  1–2 | ball X/Y                       |
|  3–6 | X/Y speed magnitudes and signs |
|    7 | strength                       |
|    8 | stroke count                   |
|    9 | collision status               |
|   10 | moving value                   |
|   11 | hole status                    |
|   12 | level-complete status          |
|   13 | error code                     |
|   14 | reserved                       |

The decoder rejects packets with any other length. The worker limits execution to 350,000 commands, 96 tape cells and 32 output bytes.
