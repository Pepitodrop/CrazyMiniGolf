import rawLevels from '../levels/levels.json';
import { parseLevels } from '../levels/schema';
import type { LevelDefinition } from './types';

export class LevelManager {
  readonly levels: LevelDefinition[];

  constructor(source: unknown = rawLevels) {
    this.levels = parseLevels(source);
  }

  get count(): number {
    return this.levels.length;
  }

  getByIndex(index: number): LevelDefinition {
    const level = this.levels[index];
    if (!level) throw new Error(`Unknown level index ${index}.`);
    return level;
  }

  getById(id: number): LevelDefinition {
    const level = this.levels.find((candidate) => candidate.id === id);
    if (!level) throw new Error(`Unknown level id ${id}.`);
    return level;
  }
}
