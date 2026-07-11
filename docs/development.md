# Development

## Prerequisites

- Node.js 20+
- npm 10+
- optional: R 4.2+ with `jsonlite`

## Commands

```bash
npm ci
npm run dev
npm run build
npm run preview
npm run test
npm run test:coverage
npm run test:e2e
npm run check:engine
npm run audit
npm run lint
npm run format:check
npm run validate:levels
npm run analyze:levels
```

## Adding a level

The release intentionally contains exactly nine levels. Edit `src/levels/levels.json`, keep dimensions below the 8-bit limit, then run level validation, tests and the R analysis. Obstacles may be `rect` or `circle`.

## Engine changes

`engine.bf` is generated deterministically from `scripts/generate-brainfuck-engine.ts`. Edit the generator, run `npm run generate:engine`, then update the tape map, protocol documentation and fixed-vector tests. CI runs `npm run check:engine` and fails if the checked-in kernel differs from the generator output.

## Extending TrumpScript features

Edit `src/trumpscript/commentator.tr` and keep all rules inside the documented compatibility grammar. Challenge and Easter-egg conditions are combined with `AND`; IDs must remain unique. Themes accept only six-digit hexadecimal colors. Keep rules limited to typed telemetry supplied by `Game`: strokes, par, shot count, bounce count, power usage and diagonal-shot count. Run `npm run test`, `npm run lint` and `npm run build` after changes.
