# TrumpScript compatibility layer

The original TrumpScript ecosystem is not reliable on current Node.js/browser runtimes. The game therefore uses a deliberately tiny, isolated compatibility grammar in `commentator.tr`:

- `WHEN <EVENT> SAY "message"`
- `GRADE <RESULT> AS "label"`

`runtime.ts` parses only these statements. It cannot access the DOM, storage, network, Brainfuck tape, or score state. A parser failure disables commentary but never blocks gameplay. The module controls visible commentator messages and an alternative, non-authoritative result grade; critical physics and progression never depend on it.
