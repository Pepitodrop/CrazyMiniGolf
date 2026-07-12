import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function update(path, transformations) {
  let content = readFileSync(path, 'utf8');
  for (const [from, to] of transformations) {
    if (!content.includes(from)) throw new Error(`Missing expected text in ${path}: ${from.slice(0, 80)}`);
    content = content.replace(from, to);
  }
  writeFileSync(path, content);
}

update('src/game/Game.ts', [
  [
    "import { calculateCollisionSensors, isBallInHole } from './collision';",
    "import { calculateCollisionSensors, isBallInHole, isBallWithinHole } from './collision';\nimport { snapAim, toEngineAimVector } from './aim';",
  ],
  [
    "  onBounce?(): void;\n  onRoundReset?(): void;",
    "  onBounce?(): void;\n  onHoleSpeed?(tooFast: boolean): void;\n  onRoundReset?(): void;",
  ],
  [
    "  private completionHandled = false;",
    "  private completionHandled = false;\n  private fastHolePass = false;",
  ],
  [
    `      this.state = tickState;\n      if (\n        !this.state.levelComplete &&\n        isBallInHole(level, { x: this.state.x, y: this.state.y }, this.state.movingValue)\n      ) {`,
    `      this.state = tickState;\n      const overHole = isBallWithinHole(level, { x: this.state.x, y: this.state.y });\n      const tooFastForHole = overHole && this.state.movingValue > 2;\n      this.setFastHoleIndicator(tooFastForHole);\n      if (\n        !this.state.levelComplete &&\n        isBallInHole(level, { x: this.state.x, y: this.state.y }, this.state.movingValue)\n      ) {`,
  ],
  [
    `  private quantizeAim(aim: AimState): {\n    xActive: boolean;\n    xNegative: boolean;\n    yActive: boolean;\n    yNegative: boolean;\n    strength: number;\n  } {\n    const absX = Math.abs(aim.direction.x);\n    const absY = Math.abs(aim.direction.y);\n    let xActive = absX >= 0.38;\n    let yActive = absY >= 0.38;\n    if (!xActive && !yActive) {\n      xActive = absX >= absY;\n      yActive = !xActive;\n    }\n    return {\n      xActive,\n      xNegative: aim.direction.x < 0,\n      yActive,\n      yNegative: aim.direction.y < 0,\n      strength: Math.max(2, Math.min(14, Math.round(aim.strength))),\n    };\n  }`,
    `  private quantizeAim(aim: AimState) {\n    return toEngineAimVector(snapAim(aim));\n  }`,
  ],
  [
    `  setAim(aim: AimState): void {\n    this.aim = aim;\n    this.emitState();\n  }`,
    `  setAim(aim: AimState): void {\n    this.aim = snapAim(aim);\n    this.emitState();\n  }`,
  ],
  [
    `      this.aim = aim;\n      const quantized = this.quantizeAim(aim);`,
    `      this.aim = snapAim(aim);\n      const quantized = this.quantizeAim(this.aim);\n      this.setFastHoleIndicator(false);`,
  ],
  [
    `            xActive: quantized.xActive,\n            yActive: quantized.yActive,\n            diagonal: quantized.xActive && quantized.yActive,`,
    `            xActive: quantized.velocityX > 0,\n            yActive: quantized.velocityY > 0,\n            diagonal: quantized.velocityX > 0 && quantized.velocityY > 0,`,
  ],
  [
    `        this.physicsCounter = 0;\n        this.emit('level start', () => this.events.onLevelStart?.(this.level));`,
    `        this.physicsCounter = 0;\n        this.setFastHoleIndicator(false);\n        this.emit('level start', () => this.events.onLevelStart?.(this.level));`,
  ],
  [
    `  private emitState(): void {`,
    `  private setFastHoleIndicator(tooFast: boolean): void {\n    if (this.fastHolePass === tooFast) return;\n    this.fastHolePass = tooFast;\n    this.emit('hole speed indicator', () => this.events.onHoleSpeed?.(tooFast));\n  }\n\n  private emitState(): void {`,
  ],
]);

update('scripts/generate-brainfuck-engine.ts', [
  ['  aimXActive: 7,', '  aimVelocityX: 7,'],
  ['  aimYActive: 9,', '  aimVelocityY: 9,'],
  [
    `  builder.ifConsume(CELL.aimXActive, () => {\n    builder.copyPreserve(CELL.strength, CELL.velocityX, CELL.t2);\n    builder.copyPreserve(CELL.aimXNegative, CELL.xNegative, CELL.t2);\n  });\n  builder.ifConsume(CELL.aimYActive, () => {\n    builder.copyPreserve(CELL.strength, CELL.velocityY, CELL.t2);\n    builder.copyPreserve(CELL.aimYNegative, CELL.yNegative, CELL.t2);\n  });`,
    `  builder.copyPreserve(CELL.aimVelocityX, CELL.velocityX, CELL.t2);\n  builder.copyPreserve(CELL.aimXNegative, CELL.xNegative, CELL.t2);\n  builder.copyPreserve(CELL.aimVelocityY, CELL.velocityY, CELL.t2);\n  builder.copyPreserve(CELL.aimYNegative, CELL.yNegative, CELL.t2);`,
  ],
]);

update('src/main.ts', [
  ['BRAINFUCK POWERED · v1.0.0', 'BRAINFUCK POWERED · v1.0.1'],
  [
    '      <div><span>POWER</span><strong id="hud-power">7</strong></div>',
    '      <div><span>POWER</span><strong id="hud-power">7</strong></div>\n      <div><span>HOLE</span><strong id="hud-hole-speed" class="hole-speed">READY</strong></div>',
  ],
  [
    '<input id="angle-control" type="range" min="0" max="315" step="45" value="0" />',
    '<input id="angle-control" type="range" min="0" max="355" step="5" value="0" />',
  ],
  [
    '<p class="snap-note">Retro physics snaps shots to eight directions.</p>',
    '<p class="snap-note">Aim is shared by preview and physics in precise 5° steps.</p>',
  ],
  [
    "const hudPower = element<HTMLElement>('#hud-power');",
    "const hudPower = element<HTMLElement>('#hud-power');\nconst hudHoleSpeed = element<HTMLElement>('#hud-hole-speed');",
  ],
  [
    `  onBounce() {\n    trumpRuntime?.recordBounce();\n  },`,
    `  onBounce() {\n    trumpRuntime?.recordBounce();\n  },\n  onHoleSpeed(tooFast) {\n    hudHoleSpeed.textContent = tooFast ? 'TOO FAST' : 'READY';\n    hudHoleSpeed.classList.toggle('too-fast', tooFast);\n  },`,
  ],
]);

update('index.html', [
  [
    `    <link\n      rel="icon"\n      href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><text y=%22.9em%22 font-size=%2290%22>⛳</text></svg>"\n    />`,
    `    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />\n    <link rel="apple-touch-icon" href="./favicon.svg" />`,
  ],
]);

update('package.json', [['"version": "1.0.0"', '"version": "1.0.1"']]);
update('package-lock.json', [
  ['"version": "1.0.0"', '"version": "1.0.1"'],
  ['"version": "1.0.0"', '"version": "1.0.1"'],
]);

rmSync('scripts/apply-gameplay-polish.mjs');
rmSync('.github/workflows/apply-gameplay-polish.yml');
