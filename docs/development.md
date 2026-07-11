# Development

## Prerequisites

- Node.js 20+
- npm 10+
- optional: R 4.2+ with `jsonlite`

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run test
npm run test:coverage
npm run lint
npm run format:check
npm run validate:levels
npm run analyze:levels
```

## Adding a level

The release intentionally contains exactly nine levels. Edit `src/levels/levels.json`, keep dimensions below the 8-bit limit, then run level validation, tests and the R analysis. Obstacles may be `rect` or `circle`.

## Engine changes

`engine.bf` contains only canonical commands plus safe alphabetic comments. Any punctuation that is itself a Brainfuck command would execute, so do not add decorative punctuation to the source header. Update the tape map, protocol documentation and fixed-vector tests with every packet change.
