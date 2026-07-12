# Brainfuck tape memory map

The engine uses unsigned 8-bit wrapping cells. The interpreter allocates 96 cells and rejects pointer movement outside the tape. Inputs occupy cells `0–31`; temporary cells begin at `32`.

|  Cell | Name                 | Meaning                                                       |
| ----: | -------------------- | ------------------------------------------------------------- |
|     0 | level                | Current one-based level id                                    |
|   1–2 | ballX, ballY         | Integer ball center coordinates                               |
|   3–4 | velocityX, xNegative | X speed magnitude and sign bit                                |
|   5–6 | velocityY, yNegative | Y speed magnitude and sign bit                                |
|  7–10 | aim components       | X/Y speed magnitudes and sign bits for the next strike        |
|    11 | strength             | Strike strength, clamped by TypeScript to `2–14`              |
|    12 | strokes              | Current level stroke count, saturating at `255`               |
|    13 | strikeFlag           | Apply a strike when set to `1`                                |
|    14 | tickFlag             | Apply one physics transition when set to `1`                  |
| 15–16 | blockX, blockY       | Geometry sensor bits for impending axis collisions            |
| 17–18 | decayX, decayY       | Friction pulse bits; asserted only for non-zero magnitudes    |
|    19 | holeSensor           | Ball is geometrically capturable at low speed                 |
|    20 | advanceFlag          | Increment level only when `level < maxLevel`                  |
|    21 | resetFlag            | Copy cells 22–23 into ball position and clear per-level state |
| 22–23 | resetX, resetY       | Declarative level start position                              |
|    24 | maxLevel             | Enforced upper bound for level advancement                    |
|    25 | paused               | Host status; the host suppresses `tickFlag` while paused      |
|    26 | collision            | Output: collision response occurred                           |
|    27 | moving               | Output: `abs(vx) + abs(vy)`; zero means stationary            |
|    28 | inHole               | Persistent hole status                                        |
|    29 | complete             | Persistent level-complete status                              |
|    30 | error                | Engine error byte, currently `0` for successful transitions   |
|    31 | reserved             | Reserved for protocol evolution                               |
| 32–36 | temporaries          | Copy, sign, movement and boolean-toggle scratch cells         |

## What actually runs in Brainfuck

The generated canonical Brainfuck source copies and mutates this state, copies the resolved five-degree X/Y strike components, increments strokes with saturation at 255, performs signed integer movement, toggles velocity signs on collision sensors, suppresses penetration movement, applies friction decrements, calculates the moving value, sets hole/completion flags, resets level state, and increments the current level only below `maxLevel`. Regenerate it with `npm run generate:engine`.

TypeScript snaps browser input to five-degree angles and compact integer components and computes geometry sensor bits from JSON level shapes. This split keeps arbitrary rectangle/circle geometry outside the tiny language while leaving the authoritative state transition and collision response in Brainfuck.
