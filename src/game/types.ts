export interface Vec2 {
  x: number;
  y: number;
}

export interface RectObstacle {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleObstacle {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
}

export type Obstacle = RectObstacle | CircleObstacle;

export interface LevelDefinition {
  id: number;
  name: string;
  width: number;
  height: number;
  start: Vec2;
  hole: Vec2;
  holeRadius: number;
  ballRadius: number;
  par: number;
  obstacles: Obstacle[];
  specialRule?: string;
}

export interface EngineState {
  level: number;
  x: number;
  y: number;
  velocityX: number;
  velocityXNegative: boolean;
  velocityY: number;
  velocityYNegative: boolean;
  strength: number;
  strokes: number;
  collision: boolean;
  movingValue: number;
  inHole: boolean;
  levelComplete: boolean;
  errorCode: number;
}

export interface AimState {
  direction: Vec2;
  strength: number;
}

export interface CollisionSensors {
  blockX: boolean;
  blockY: boolean;
  collisionKind: 'none' | 'wall' | 'obstacle';
}

export interface ScoreEntry {
  levelId: number;
  bestStrokes: number;
  par: number;
}

export interface SavedProgress {
  version: 2;
  unlockedLevel: number;
  bestRound: number | null;
  combinedHoleBests: number | null;
  scores: ScoreEntry[];
}
