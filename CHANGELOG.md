# Changelog

All notable changes to Crazy Mini Golf are documented here.

## [1.0.1] - 2026-07-12

### Fixed

- Added a reliable bundled SVG favicon for browser tabs and installed-app icons.
- Unified mouse, touch, keyboard, preview, and Brainfuck shot directions on the same 5° aim grid.
- Replaced eight-direction strike flags with independent X/Y velocity components in the Brainfuck protocol.
- Corrected pink-obstacle corner rebounds so they reflect on the collision-normal axis instead of retracing the incoming path.
- Added a visible `TOO FAST` hole indicator when the ball crosses the capture area above the allowed speed.

### Changed

- Angle controls now cover 0–355° in 5° increments.
- Added focused unit tests for aim quantization, component velocities, reflective collisions, and fast-hole detection.

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
