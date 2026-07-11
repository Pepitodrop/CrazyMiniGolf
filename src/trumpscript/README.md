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

The browser-side compatibility controller observes only the existing `START`, `HIT`, `BOUNCE`, `HOLE`, `ACE` and `FINAL` events plus the already rendered level/power values. It builds a read-only summary containing strokes, par, bounces, shot count and power usage, then evaluates the declarative rules.

The controller may add its own optional DOM panels and use the namespaced `crazy-mini-golf-trump-features-v1` Local Storage key for style points and medals. It has no network access and cannot write to the Brainfuck tape, alter strokes, unlock levels or modify authoritative highscores. A parser or controller failure leaves the core game usable.
