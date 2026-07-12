# Changelog

All notable changes to Crazy Mini Golf are documented here.

## [1.0.2] - 2026-07-12

### Fixed

- Pink rectangular and circular obstacles now reflect the ball on the detected collision-normal axis instead of reversing every active component and retracing the incoming shot.
- Added regression tests for side, diagonal-corner, circular-obstacle, wall, and fast-hole interactions.

### Operations

- Added an automated production review for every completed PR CI run.
- Same-repository PRs are merged only when the validated head SHA is unchanged, the PR targets `main`, the PR is not a draft, and the complete CI workflow succeeds.
- Fork PRs receive the automated review result but are never automatically merged.

## [1.0.1] - 2026-07-12

### Fixed

- Added a packaged SVG favicon that works on the deployed site.
- Unified mouse, touch, keyboard, slider, guide-line, and engine aim resolution.
- Added five-degree angle controls with integer engine component resolution.
- Added initial pink-obstacle collision handling while outer walls retain axis-specific reflection.
- Added visible feedback when the ball crosses the hole above capture speed.

### Operations

- Kept full CI, Docker smoke tests, cross-browser E2E, R analysis, deployment, and versioned release automation.

## [1.0.0] - 2026-07-11

### Added

- Nine complete retro minigolf holes.
- Authoritative Brainfuck state-transition engine running in a protected Web Worker.
- Deterministic TypeScript geometry, rendering, input, audio, and local persistence.
- R-based level balancing analysis.
- Restricted TrumpScript-compatible commentary, challenges, medals, themes, and post-hole speech function.
- Docker and GitHub Pages deployment paths.
- Privacy, legal, parody, security, and deployment documentation.
- Cross-browser desktop and mobile smoke tests.

### Fixed

- Final-tick hole capture.
- Round-total accounting and separation of real round highscores from combined hole bests.
- Brainfuck level bounds and stroke-counter saturation.
- Diagonal obstacle-corner penetration.
- Worker timeouts, blocked storage, and unavailable audio handling.
- Keyboard shortcuts interfering with focused controls.

### Security

- Restricted Content Security Policy and defensive response headers.
- Fixed interpreter tape, step, and output limits.
- Full-history secret scanning in CI.
- Dependency audit and automated dependency update monitoring.
