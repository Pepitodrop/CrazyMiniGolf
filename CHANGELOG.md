# Changelog

All notable changes to Crazy Mini Golf are documented here.

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
