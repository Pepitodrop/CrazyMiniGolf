# TrumpScript compatibility layer

The original TrumpScript ecosystem is not reliable on current Node.js/browser runtimes. Crazy Mini Golf therefore ships a deliberately small, isolated and deterministic compatibility grammar in `commentator.tr`.

## Supported statements

```text
WHEN <EVENT> SAY "message"
GRADE <RESULT> AS "label"
ROUND <RESULT> AS "label"
TIP LEVEL <id> SAY "message"
THEME LEVEL <id> ACCENT "#rrggbb" SECONDARY "#rrggbb"
CHALLENGE <id> LEVEL <id|ANY> TITLE "title" WHEN <conditions> AWARD <points> SAY "message"
EASTER <id> LEVEL <id|ANY> TITLE "title" WHEN <conditions> AWARD <points> SAY "message"
```

Conditions may be joined with `AND`:

- `ACE`
- `UNDER_PAR`
- `PAR_OR_BETTER`
- `NO_BOUNCE`
- `BOUNCES_AT_LEAST <n>`
- `STROKES_AT_MOST <n>`
- `SHOTS_AT_MOST <n>`
- `MAX_POWER`
- `LAST_POWER <n>`
- `DIAGONAL_SHOTS_AT_LEAST <n>`

## Responsibilities

The compatibility runtime now controls:

- event commentary
- per-level tactical tips
- validated cosmetic accent themes
- optional challenge definitions
- one-time style-point awards and medals
- hidden Easter eggs
- level and round result titles

TypeScript supplies a read-only gameplay summary after a level: strokes, par, bounces, shot count, maximum/final power and diagonal-shot count. The runtime evaluates only its declarative rules and returns presentation metadata.

It cannot access the DOM, network, Local Storage, Brainfuck tape or authoritative score. A parser or rule error disables these optional features without changing physics, level progression or the real stroke result.
