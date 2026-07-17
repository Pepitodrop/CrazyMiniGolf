# Crazy Mini Golf

Play this game online at **[game.luisbenedikt.de](https://game.luisbenedikt.de/)**.

**Version 1.0.2**

Crazy Mini Golf is a complete nine-hole browser minigolf game whose authoritative state transitions run through a real Brainfuck program. TypeScript provides safe browser integration, rendering, input, declarative geometry, persistence, and deployment tooling.

## Highlights

- Nine increasingly difficult, declarative holes
- Mouse, touch, and keyboard controls
- Mouse, touch, slider, and keyboard aiming in five-degree increments
- Integer movement, friction, rebounds, and deterministic hole capture
- Real Brainfuck execution in a protected Web Worker
- Local per-hole bests and a separate best completed nine-hole round
- Optional restricted TrumpScript-compatible parody commentary and challenges
- R-based balancing analysis
- Cross-browser desktop and mobile E2E tests
- Docker, GHCR, and GitHub Pages deployment

## Architecture and language boundaries

| Language or layer                  | Responsibility                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Brainfuck**                      | Authoritative level, position, velocity, strike, stroke, friction, collision response, hole, reset, and progression state transitions |
| **TypeScript**                     | Interpreter safety, worker transport, browser input, Canvas rendering, geometry sensors, audio, UI, errors, and Local Storage         |
| **JSON**                           | Nine declarative levels and obstacles                                                                                                 |
| **R**                              | Offline balancing simulation and expected-stroke estimates                                                                            |
| **TrumpScript-compatible grammar** | Optional, non-critical commentary, themes, challenges, medals, and parody speech output                                               |
| **Vite and Nginx**                 | Production bundling and hardened static delivery                                                                                      |

`src/brainfuck/engine.bf` is not decorative. It is generated deterministically and executed for every strike, physics tick, reset, hole capture, and level transition. Arbitrary rectangle and circle intersection tests remain in TypeScript; their compact sensor bits are passed into Brainfuck, which owns the resulting state transition.

See [architecture](docs/architecture.md), [protocol](docs/protocol.md), and [tape map](src/brainfuck/memory-map.md).

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
npm run dev
```

Open the Vite URL shown in the terminal.

### Docker

```bash
docker compose up --build -d
```

Open `http://localhost:8080`. The health endpoint is `http://localhost:8080/healthz`.

See the complete [deployment guide](docs/deployment.md).

## Controls

- **Mouse or touch:** aim from the ball and release to strike
- **Left/Right or A/D:** rotate aim by 5 degrees
- **Up/Down or W/S:** change power
- **Space:** strike
- **R:** restart the current hole
- **P or Escape:** pause or resume

Keyboard shortcuts do not override focused buttons, sliders, form controls, or editable content.

## Commands

```bash
npm run dev               # development server
npm run build             # strict TypeScript check and production bundle
npm run preview           # serve the production bundle locally
npm run test              # deterministic unit/integration suite
npm run test:coverage     # tests with enforced coverage thresholds
npm run test:e2e          # Chromium, Firefox, WebKit, and mobile smoke tests
npm run generate:engine   # regenerate the Brainfuck kernel
npm run check:engine      # verify engine.bf matches its generator
npm run audit             # fail on high-severity dependency advisories
npm run lint              # typed ESLint rules
npm run format:check      # verify Prettier formatting
npm run validate:levels   # validate all nine JSON levels
npm run analyze:levels    # run the R balancing analysis
```

## Testing and release gates

CI validates:

- the full Git history with Gitleaks
- deterministic dependency installation and `npm audit`
- formatting, typed linting, and strict TypeScript
- Brainfuck generation and protocol behavior
- all level data and geometry
- unit and integration tests with coverage thresholds
- Docker image build, health endpoint, HTML, and security headers
- Chromium, Firefox, WebKit, and mobile Chromium E2E
- deterministic R balancing output

Deployment runs only after successful CI on `main`, checks out the exact validated commit, publishes Pages and GHCR artifacts, and verifies the deployed Pages URL.

## Scores and persistence

All persistence is local to the browser. No score or telemetry is uploaded.

- **Best completed round** records only a continuous nine-hole round.
- **Combined hole bests** sums the best result achieved separately on every hole.
- Existing version-one save data is migrated without presenting a synthetic combined total as a completed round.

Storage failures are non-fatal and are reported in the UI.

## TrumpScript-compatible parody layer

The project contains an independently implemented, restricted compatibility grammar. It does not evaluate arbitrary JavaScript and cannot modify Brainfuck state, scores, physics, or level progression.

Example:

```text
MAKE FUNCTION tremendous-deal GREAT AGAIN WITH STROKES AND PAR SAY "We had {STROKES} strokes and the tremendous number is {TREMENDOUS_NUMBER}."
```

This is an unofficial software parody. It is not affiliated with, endorsed by, or sponsored by Donald J. Trump, the Trump Organization, any political campaign, or the creators of the original TrumpScript project. See the in-app legal notice and [`src/trumpscript/README.md`](src/trumpscript/README.md).

## Privacy

The application has no accounts, analytics, advertising trackers, remote leaderboard, or application backend. Local scores and optional awards are stored only in Local Storage. Hosting providers may process normal technical request logs.

See the bundled privacy and legal pages:

- `public/privacy.html`
- `public/legal.html`

## Repository structure

```text
src/game/          orchestration, rendering, input, audio, and geometry
src/brainfuck/     interpreter, worker, protocol, engine, and tape map
src/levels/        nine declarative levels and runtime validation
src/storage/       local progress and score persistence
src/trumpscript/   isolated compatibility grammar and parser
analysis/          R simulation and generated results
scripts/           Brainfuck generation, validation, and R launcher
tests/             unit, integration, browser, and mobile tests
deploy/            production Nginx configuration
docs/              architecture, development, and deployment notes
.github/workflows/ CI, deployment, dependency, and release automation
```

## Known limitations

- Five-degree input angles resolve to the closest safe integer X/Y vector at the selected power.
- Geometry sensors are calculated in TypeScript; Brainfuck performs the authoritative response.
- Scores remain local to the current browser profile.
- The Brainfuck stroke counter saturates at 255 because the protocol field is one byte.
- The R solver is a deterministic balancing heuristic, not a mathematical proof of reachability.
- Canvas gameplay has limited support for users who cannot use a visual game board.
- Audio begins only after user interaction because of browser autoplay policies.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and private vulnerability reporting guidance. The production container sets a restrictive Content Security Policy and defensive response headers.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
