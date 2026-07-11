import type { AimState, EngineState, LevelDefinition, Vec2 } from './types';

interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private viewport: Viewport = { scale: 1, offsetX: 0, offsetY: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D rendering is unavailable in this browser.');
    this.context = context;
  }

  private resize(level: LevelDefinition): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(240, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const padding = 18 * dpr;
    const scale = Math.min(
      (width - padding * 2) / level.width,
      (height - padding * 2) / level.height,
    );
    this.viewport = {
      scale,
      offsetX: (width - level.width * scale) / 2,
      offsetY: (height - level.height * scale) / 2,
    };
  }

  toWorld(level: LevelDefinition, clientX: number, clientY: number): Vec2 {
    this.resize(level);
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * this.canvas.height;
    return {
      x: (canvasX - this.viewport.offsetX) / this.viewport.scale,
      y: (canvasY - this.viewport.offsetY) / this.viewport.scale,
    };
  }

  render(
    level: LevelDefinition,
    state: EngineState,
    aim: AimState,
    paused: boolean,
    errorMessage: string | null,
  ): void {
    this.resize(level);
    const { context: ctx } = this;
    const { scale, offsetX, offsetY } = this.viewport;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#08101f');
    gradient.addColorStop(1, '#111a2f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#183f32';
    ctx.fillRect(0, 0, level.width, level.height);
    ctx.strokeStyle = '#56d89b';
    ctx.lineWidth = 4 / scale + 2;
    ctx.strokeRect(0, 0, level.width, level.height);

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#a7ffd4';
    ctx.lineWidth = 1;
    for (let x = 8; x < level.width; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, level.height);
      ctx.stroke();
    }
    for (let y = 8; y < level.height; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(level.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const obstacle of level.obstacles) {
      ctx.fillStyle = '#7b4f9d';
      ctx.strokeStyle = '#d5a7ff';
      ctx.lineWidth = 2;
      if (obstacle.type === 'rect') {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      } else {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#05070b';
    ctx.beginPath();
    ctx.arc(level.hole.x, level.hole.y, level.holeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ecfdf5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(level.hole.x + 1, level.hole.y - 24, 2, 24);
    ctx.beginPath();
    ctx.moveTo(level.hole.x + 3, level.hole.y - 24);
    ctx.lineTo(level.hole.x + 16, level.hole.y - 19);
    ctx.lineTo(level.hole.x + 3, level.hole.y - 14);
    ctx.closePath();
    ctx.fill();

    if (state.velocityX + state.velocityY === 0 && !state.levelComplete && !paused) {
      const length = 22 + aim.strength * 3;
      const endX = state.x + aim.direction.x * length;
      const endY = state.y + aim.direction.y * length;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#fff48f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff48f';
      ctx.beginPath();
      ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!state.inHole) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(state.x, state.y, level.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(state.x - 1, state.y - 2, 1.5, 1.5);
    }
    ctx.restore();

    if (paused || state.levelComplete || errorMessage) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.72)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = errorMessage ? '#ff879d' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(18, this.canvas.width / 28)}px ui-monospace, monospace`;
      const message = errorMessage ?? (paused ? 'PAUSED' : 'HOLE COMPLETE');
      ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }
  }
}
