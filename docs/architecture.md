# Architecture

```text
Pointer / touch / keyboard
          │
          ▼
   InputManager ───────► UI / HUD
          │
          ▼
        Game ─────► Level geometry sensors
          │                 │
          │ 32-byte packet  │ blockX blockY holeSensor
          ▼                 │
   Web Worker               │
          │                 │
 Brainfuck interpreter      │
          │                 │
      engine.bf ◄───────────┘
          │ 15-byte state
          ▼
      Renderer / Audio / Local Storage
```

## Boundaries

- **Brainfuck:** authoritative state transition, speed/sign state, strike strength application, strokes, integer movement, bounce response, penetration suppression, friction, stationary value, hole/complete flags, reset and level increment.
- **TypeScript:** browser APIs, worker transport, interpreter safety, input quantization, level-shape sensor generation, Canvas rendering, audio, menus, errors and persistence.
- **JSON:** declarative dimensions, start/hole coordinates, rectangular/circular obstacles and par.
- **R:** offline simulation and balancing against the same discrete model.
- **TrumpScript compatibility layer:** isolated commentary and non-authoritative result grades.

## Physics model

The ball has separate unsigned X/Y magnitudes plus sign bits. A shot activates the horizontal axis, vertical axis or both and assigns the selected strength. Every 70 ms the host samples whether the next axis movement would enter a wall or obstacle. Brainfuck then either moves that axis or toggles its sign and skips penetration. Every third tick it decrements non-zero magnitudes. This is intentionally retro and deterministic rather than continuous floating-point physics.
