import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, before, after) {
  const current = readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Expected block not found in ${path}`);
  writeFileSync(path, current.replace(before, after), 'utf8');
}

replaceExact(
  'src/game/Game.ts',
  `      const level = this.level;
      const beforeMove = getHoleCaptureStatus(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityY,
      );
      this.updateHoleFeedback(beforeMove);`,
  `      const level = this.level;
      const previousPosition = { x: this.state.x, y: this.state.y };
      const incomingVelocityX = this.state.velocityX;
      const incomingVelocityY = this.state.velocityY;
      const incomingSpeed = Math.hypot(incomingVelocityX, incomingVelocityY);
      const beforeMove = getHoleCaptureStatus(
        level,
        previousPosition,
        incomingVelocityX,
        incomingVelocityY,
      );
      this.updateHoleFeedback(beforeMove, incomingSpeed);`,
);

replaceExact(
  'src/game/Game.ts',
  `      const afterMove = getHoleCaptureStatus(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityY,
      );
      this.updateHoleFeedback(afterMove);`,
  `      const afterMove = getHoleCaptureStatus(
        level,
        { x: this.state.x, y: this.state.y },
        incomingVelocityX,
        incomingVelocityY,
        previousPosition,
      );
      this.updateHoleFeedback(afterMove, incomingSpeed);`,
);

replaceExact(
  'src/game/Game.ts',
  `  private updateHoleFeedback(status: HoleCaptureStatus): void {
    if (status === 'too-fast') {
      if (!this.holeTooFastActive) {
        const speed = Math.hypot(this.state.velocityX, this.state.velocityY);
        this.emit('hole speed event', () =>
          this.events.onHoleTooFast?.(speed, HOLE_CAPTURE_MAX_SPEED),
        );
      }`,
  `  private updateHoleFeedback(status: HoleCaptureStatus, speed: number): void {
    if (status === 'too-fast') {
      if (!this.holeTooFastActive) {
        this.emit('hole speed event', () =>
          this.events.onHoleTooFast?.(speed, HOLE_CAPTURE_MAX_SPEED),
        );
      }`,
);

replaceExact(
  'tests/game.test.ts',
  `    state.x = game.level.hole.x;
    state.y = game.level.hole.y;
    state.velocityX = 4;
    state.velocityY = 0;
    state.movingValue = 4;
    await game.advancePhysics();
    expect(onHoleTooFast).toHaveBeenCalledTimes(1);
    expect(onHoleTooFast).toHaveBeenCalledWith(4, 2);`,
  `    state.x = game.level.hole.x - 8;
    state.y = game.level.hole.y;
    state.velocityX = 14;
    state.velocityY = 0;
    state.movingValue = 14;
    await game.advancePhysics();
    expect(onHoleTooFast).toHaveBeenCalledTimes(1);
    expect(onHoleTooFast).toHaveBeenCalledWith(14, 2);`,
);
