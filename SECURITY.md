# Security Policy

## Supported versions

| Version                       | Supported |
| ----------------------------- | --------- |
| 1.0.x                         | Yes       |
| Earlier development snapshots | No        |

## Reporting a vulnerability

Please do not open a public issue for an undisclosed vulnerability.

Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is not available, contact the maintainer through the GitHub profile associated with this repository and request a private communication channel.

Include:

- affected version or commit
- reproduction steps
- expected impact
- suggested mitigation, if known

Reports will be acknowledged as soon as reasonably possible. Confirmed issues will be fixed on a private branch before disclosure whenever practical.

## Security model

Crazy Mini Golf is a static browser application. It has no application backend, accounts, remote leaderboard, analytics, or score-upload endpoint. The Brainfuck interpreter runs in a Web Worker with fixed tape, execution-step, and output limits. The optional TrumpScript-compatible parser uses a restricted grammar and does not evaluate arbitrary JavaScript.
