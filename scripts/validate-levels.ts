import rawLevels from '../src/levels/levels.json';
import { parseLevels } from '../src/levels/schema';

try {
  const levels = parseLevels(rawLevels);
  const obstacles = levels.reduce((sum, level) => sum + level.obstacles.length, 0);
  console.log(`Validated ${levels.length} levels with ${obstacles} obstacles.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
