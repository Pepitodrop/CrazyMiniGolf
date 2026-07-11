# Crazy Mini Golf

A complete nine-hole, top-down browser minigolf game whose authoritative state transitions run through a real Brainfuck program. The surrounding TypeScript host provides safe browser integration, rendering, input, declarative geometry and persistence.

![Crazy Mini Golf placeholder](docs/screenshots/game-placeholder.svg)

## Features

- Nine increasingly difficult, declarative levels
- Mouse, touch and keyboard controls
- Eight-direction retro aiming with adjustable power
- Integer ball motion, friction, wall/obstacle rebounds and hole capture
- Rectangular and circular obstacles
- Per-level strokes, par, total relative score and local highscores
- Pause, restart and unlocked-level selection
- Responsive Canvas UI with generated Web Audio effects
- Brainfuck execution in a Web Worker with tape, output and step limits
- Deterministic Vitest suite and GitHub Actions CI
- R simulations for solvability estimates, expected strokes and par suggestions
- Expanded TrumpScript-compatible feature rules for commentary, level tips, cosmetic themes, optional challenges, persistent style points, medals, round titles, hidden Easter eggs and an executable post-hole speech function

## Languages and responsibilities

| Language                              | Responsibility                                                                                                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brainfuck**                         | Authoritative state packet, current level, position, velocity magnitudes/signs, strike application, strength, stroke count, signed movement, friction decrements, bounce response, collision status, stationary value, hole/completion flags, reset and level increment |
| **TypeScript**                        | Brainfuck interpreter, worker transport, packet conversion, browser input, Canvas rendering, arbitrary level geometry sensors, audio, UI, errors and Local Storage                                                                                                      |
| **HTML/CSS**                          | Responsive application shell, HUD, controls and retro presentation                                                                                                                                                                                                      |
| **R**                                 | Offline shot simulation, coarse solvability checks, expected-stroke estimates, suggested par and CSV/JSON/PNG output                                                                                                                                                    |
| **TrumpScript compatibility grammar** | Non-critical commentary, tactical tips, cosmetic themes, optional challenge conditions, persistent style awards, medals, round titles and Easter eggs                                                                                                                   |
| **Node.js/Vite**                      | Development server, test/build tooling and production bundling                                                                                                                                                                                                          |

## Honest Brainfuck boundary

`src/brainfuck/engine.bf` is not a decorative snippet. It is canonical Brainfuck executed for every strike, physics tick, reset, hole capture and level transition. It mutates a documented 8-bit tape state and returns the only state accepted by the game.

Arbitrary rectangle/circle intersection tests are intentionally performed by TypeScript because encoding dynamic JSON geometry in Brainfuck would make the engine fragile and unreviewable. TypeScript emits compact `blockX`, `blockY` and `holeSensor` bits; Brainfuck owns the collision response, sign reversal, penetration suppression, speed decay and resulting gameplay state. See [architecture](docs/architecture.md), [protocol](docs/protocol.md) and [tape map](src/brainfuck/memory-map.md).

## Installation

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Controls

- **Mouse/touch:** point from the ball toward the desired target, drag to adjust power and release to strike
- **Left/Right or A/D:** rotate aim by 45 degrees
- **Up/Down or W/S:** change power
- **Space:** strike
- **R:** restart current level
- **P or Escape:** pause/resume

The side panel also provides angle, power and hit controls for mobile play and accessibility.

## Commands

```bash
npm run dev               # development server
npm run build             # strict TypeScript check and production bundle
npm run preview           # serve the production bundle locally
npm run test              # deterministic test suite
npm run test:coverage     # tests with enforced V8 coverage thresholds
npm run test:e2e         # Chromium production-build smoke tests
npm run generate:engine  # regenerate the canonical Brainfuck kernel
npm run check:engine     # verify engine.bf matches its generator
npm run audit            # fail on high-severity dependency advisories
npm run lint              # ESLint typed rules
npm run format            # write Prettier formatting
npm run format:check      # verify formatting
npm run validate:levels   # validate all nine JSON levels
npm run analyze:levels    # run R balancing analysis
```

## Production build

```bash
npm ci
npm run build
npm run preview
```

The output is written to `dist/`. Vite uses a relative base path, so the static build can be hosted below a repository path such as GitHub Pages.

## Testing

The suite covers:

- Brainfuck commands, nested loops, byte I/O and bracket validation
- Step, tape and output limits
- Protocol serialization and malformed packet rejection
- Strike application and stroke counting
- Integer movement and friction
- Wall and obstacle sensor generation
- Brainfuck bounce response and penetration suppression
- Hole detection and level-complete flags
- Deterministic progression across all nine levels
- Local highscore persistence and better-score replacement
- Level schema validity
- TrumpScript parsing, typed shot/bounce telemetry, challenges and persistent medals
- Game orchestration, including final-tick hole capture and continuous nine-level totals
- Worker-client timeouts, audio fallback, Canvas rendering and keyboard/pointer input
- Blocked Local Storage as a non-fatal browser condition

Run:

```bash
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

## TrumpScript feature rules

`src/trumpscript/commentator.tr` now defines more than commentary. It declaratively configures per-level tips and colors, optional challenge conditions, one-time style-point awards, medals, level/round labels and hidden Easter eggs. A small compatibility controller receives typed, read-only level, shot and bounce telemetry from `Game`. It never reconstructs gameplay data from the DOM. The summary contains strokes, par, bounces, shot count, maximum/final power and diagonal-shot count.

Examples:

```text
CHALLENGE wall-street LEVEL 4 TITLE "Wall Street" WHEN BOUNCES_AT_LEAST 1 AND PAR_OR_BETTER AWARD 175 SAY "The bank shot paid a tremendous dividend."
MAKE FUNCTION tremendous-deal GREAT AGAIN WITH STROKES AND PAR SAY "We had {STROKES} strokes and the tremendous number is {TREMENDOUS_NUMBER}."
```

The speech function is parsed from `src/trumpscript/tremendous-function.tr` and runs after each completed hole. It can read only strokes and par, substitute an allowlisted set of placeholders and return commentary. It cannot mutate the Brainfuck state, scores, physics or persistence.

These rewards are intentionally separate from the real golf score and use a separate namespaced Local Storage record. The controller injects only optional briefing, medal and bonus UI. Its typed callbacks are separate from the Brainfuck protocol and cannot mutate authoritative game state. A TrumpScript parser failure disables the optional feature layer while Brainfuck gameplay remains usable. See [`src/trumpscript/README.md`](src/trumpscript/README.md).

## R analysis

Install R 4.2+ and `jsonlite`:

```r
install.packages("jsonlite")
```

Then run:

```bash
npm run analyze:levels
```

The deterministic analyzer reads all nine levels, simulates the same eight-direction integer model, estimates whether its coarse solver can finish each course, calculates expected strokes among solved trials, proposes par values and writes:

- `analysis/results/level-analysis.csv`
- `analysis/results/level-analysis.json`
- `analysis/results/level-difficulty.png`

The simulation is a balancing heuristic rather than a formal proof of reachability.

## Architecture overview

```text
InputManager ──► Game ──► geometry sensors ──► 32-byte packet
                                                │
                                                ▼
                                      Brainfuck Web Worker
                                      interpreter + engine.bf
                                                │
                                         15-byte state
                                                ▼
                       Renderer · HUD · Audio · Local Storage
```

The worker compiles the generated Brainfuck kernel once, then reuses it with a 96-byte tape, 350,000 executed commands and 32 output bytes per engine invocation. Any violation becomes a visible engine error instead of freezing the browser.

## Repository structure

```text
src/game/          orchestration, rendering, input, audio and geometry
src/brainfuck/     interpreter, worker, protocol, engine and tape map
src/levels/        nine declarative levels and runtime validation
src/storage/       local progress and highscore persistence
src/trumpscript/   isolated compatibility grammar and parser
analysis/          R simulation and generated results
scripts/           deterministic Brainfuck generation, level validation and R launcher
tests/             unit, integration and Chromium smoke tests
docs/              architecture, protocol and development notes
.github/workflows/ continuous integration
```

## Known limitations

- The physics deliberately snaps to eight directions and uses integer magnitudes rather than continuous floating-point vectors.
- Geometry intersection is calculated in TypeScript and represented to Brainfuck as axis sensor bits; Brainfuck performs the authoritative response.
- Highscores are local to the current browser profile. Storage failures are reported as non-fatal warnings; there is no remote account or server leaderboard.
- The Brainfuck stroke counter saturates at 255 to preserve its one-byte protocol field instead of wrapping to zero.
- The TrumpScript component is a documented compatibility subset, not the abandoned original runtime. Its optional rules cannot alter strokes, physics, level progression or authoritative highscores.
- The R solver is stochastic but deterministically seeded; `coarse_solver_found_path` records only whether that solver found a route and is not a proof of solvability.
- Audio starts only after user interaction because of browser autoplay policies.

## Browser support

Recent versions of Chrome, Edge, Firefox and Safari with ES2022 modules, Canvas, Web Workers and Local Storage. Touch support is provided through Pointer Events.

## License

[MIT](LICENSE)
