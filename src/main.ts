import './ui/styles.css';
import commentatorSource from './trumpscript/commentator.tr?raw';
import { Game } from './game/Game';
import { LevelManager } from './game/LevelManager';
import type { CommentaryEvent } from './trumpscript/runtime';
import { createTrumpRuntime } from './trumpscript/runtime';
import { loadProgress, recordLevelScore, resetProgress, saveProgress } from './storage/scores';
import type { EngineState, LevelDefinition } from './game/types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root element.');

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">BRAINFUCK POWERED</p>
        <h1>CRAZY MINI GOLF</h1>
      </div>
      <div class="top-actions">
        <label class="toggle"><input id="audio-toggle" type="checkbox" checked /> AUDIO</label>
        <button id="pause-button" type="button">PAUSE</button>
        <button id="restart-button" type="button">RESTART</button>
      </div>
    </header>

    <section class="hud" aria-live="polite">
      <div><span>LEVEL</span><strong id="hud-level">1 / 9</strong></div>
      <div><span>PAR</span><strong id="hud-par">2</strong></div>
      <div><span>STROKES</span><strong id="hud-strokes">0</strong></div>
      <div><span>TOTAL</span><strong id="hud-total">E</strong></div>
      <div><span>POWER</span><strong id="hud-power">7</strong></div>
    </section>

    <section class="game-grid">
      <div class="canvas-card">
        <canvas id="game-canvas" aria-label="Crazy Mini Golf game board"></canvas>
        <div class="commentator" id="commentator">Loading the tremendous commentary engine…</div>
        <div class="completion-actions">
          <button id="next-button" type="button" hidden>NEXT LEVEL</button>
        </div>
      </div>

      <aside class="side-panel">
        <section>
          <h2 id="level-name">Pixel Promenade</h2>
          <p id="level-rule">Straight introductory lane</p>
        </section>
        <section class="mobile-controls">
          <label for="angle-control">ANGLE <output id="angle-output">0°</output></label>
          <input id="angle-control" type="range" min="0" max="315" step="45" value="0" />
          <label for="power-control">POWER <output id="power-output">7</output></label>
          <input id="power-control" type="range" min="2" max="14" step="1" value="7" />
          <button id="hit-button" class="primary" type="button">HIT</button>
        </section>
        <section>
          <h3>LEVEL SELECT</h3>
          <div id="level-select" class="level-select"></div>
        </section>
        <section class="help">
          <h3>CONTROLS</h3>
          <p>Pointer/touch: aim and release. Keyboard: ←/→ angle, ↑/↓ power, Space hit, R restart, P pause.</p>
          <p class="snap-note">Retro physics snaps shots to eight directions.</p>
        </section>
        <section class="highscore">
          <h3>LOCAL HIGHSCORE</h3>
          <p id="highscore-value">Not completed</p>
          <button id="reset-progress" class="danger" type="button">RESET SAVE</button>
        </section>
      </aside>
    </section>

    <footer>
      <span>TypeScript host · Brainfuck state engine · R balancing · isolated TrumpScript commentary</span>
      <a href="https://github.com/Pepitodrop/CrazyMiniGolf" target="_blank" rel="noreferrer">SOURCE</a>
    </footer>
  </main>
`;

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing UI element ${selector}.`);
  return found;
}

const canvas = element<HTMLCanvasElement>('#game-canvas');
const hudLevel = element<HTMLElement>('#hud-level');
const hudPar = element<HTMLElement>('#hud-par');
const hudStrokes = element<HTMLElement>('#hud-strokes');
const hudTotal = element<HTMLElement>('#hud-total');
const hudPower = element<HTMLElement>('#hud-power');
const levelName = element<HTMLElement>('#level-name');
const levelRule = element<HTMLElement>('#level-rule');
const commentator = element<HTMLElement>('#commentator');
const nextButton = element<HTMLButtonElement>('#next-button');
const pauseButton = element<HTMLButtonElement>('#pause-button');
const restartButton = element<HTMLButtonElement>('#restart-button');
const hitButton = element<HTMLButtonElement>('#hit-button');
const angleControl = element<HTMLInputElement>('#angle-control');
const powerControl = element<HTMLInputElement>('#power-control');
const angleOutput = element<HTMLOutputElement>('#angle-output');
const powerOutput = element<HTMLOutputElement>('#power-output');
const levelSelect = element<HTMLDivElement>('#level-select');
const highscoreValue = element<HTMLElement>('#highscore-value');
const audioToggle = element<HTMLInputElement>('#audio-toggle');
const resetProgressButton = element<HTMLButtonElement>('#reset-progress');

const levels = new LevelManager();
let progress = loadProgress();
const sessionScores = new Map<number, { strokes: number; par: number }>();
let currentState: EngineState | null = null;

let trumpRuntime: ReturnType<typeof createTrumpRuntime> | null = null;
try {
  trumpRuntime = createTrumpRuntime(commentatorSource);
} catch (error) {
  commentator.textContent = `Commentary disabled: ${error instanceof Error ? error.message : 'parser error'}`;
}

function totalRelativeToPar(state: EngineState, level: LevelDefinition): string {
  let strokes = state.strokes;
  let par = level.par;
  for (const [levelId, score] of sessionScores) {
    if (levelId !== level.id) {
      strokes += score.strokes;
      par += score.par;
    }
  }
  const difference = strokes - par;
  return difference === 0 ? 'E' : difference > 0 ? `+${difference}` : String(difference);
}

function renderProgress(): void {
  levelSelect.innerHTML = '';
  for (const level of levels.levels) {
    const button = document.createElement('button');
    const score = progress.scores.find((entry) => entry.levelId === level.id);
    button.type = 'button';
    button.textContent = score ? `${level.id} · ${score.bestStrokes}` : String(level.id);
    button.title = score ? `${level.name}: best ${score.bestStrokes}` : level.name;
    button.disabled = level.id > progress.unlockedLevel;
    button.classList.toggle('active', currentState?.level === level.id);
    button.addEventListener('click', () => void game.selectLevel(level.id));
    levelSelect.append(button);
  }
  highscoreValue.textContent =
    progress.totalBest === null ? 'Not completed' : `${progress.totalBest} strokes`;
}

function showComment(event: CommentaryEvent): void {
  const message = trumpRuntime?.comment(event, Date.now() + (currentState?.strokes ?? 0));
  if (message) commentator.textContent = message;
}

const game = new Game(canvas, levels, 1, {
  onState(state, level, paused) {
    currentState = state;
    hudLevel.textContent = `${state.level} / ${levels.count}`;
    hudPar.textContent = String(level.par);
    hudStrokes.textContent = String(state.strokes);
    hudPower.textContent = String(game.currentAim.strength);
    hudTotal.textContent = totalRelativeToPar(state, level);
    levelName.textContent = level.name;
    levelRule.textContent = level.specialRule ?? `${level.obstacles.length} obstacles`;
    pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
    nextButton.hidden = !state.levelComplete || state.level >= levels.count;
    hitButton.disabled = paused || state.levelComplete || state.velocityX + state.velocityY > 0;
    renderProgress();
  },
  onMessage(event) {
    showComment(event as CommentaryEvent);
  },
  onError(message) {
    commentator.textContent = message;
    commentator.classList.add('error');
  },
  onLevelComplete(level, strokes) {
    sessionScores.set(level.id, { strokes, par: level.par });
    progress = recordLevelScore(progress, level.id, strokes, level.par);
    saveProgress(progress);
    const grade = trumpRuntime?.grade(strokes, level.par);
    if (grade) commentator.textContent = `${grade} — ${commentator.textContent}`;
    renderProgress();
  },
  onFinalComplete(strokes) {
    commentator.dataset.final = `Round total: ${strokes}`;
  },
});

function updateMobileAim(): void {
  const angle = Number(angleControl.value);
  const power = Number(powerControl.value);
  angleOutput.value = `${angle}°`;
  powerOutput.value = String(power);
  hudPower.textContent = String(power);
  game.setMobileAim(angle, power);
}

angleControl.addEventListener('input', updateMobileAim);
powerControl.addEventListener('input', updateMobileAim);
hitButton.addEventListener('click', () => void game.strikeCurrentAim());
restartButton.addEventListener('click', () => void game.restart());
pauseButton.addEventListener('click', () => game.togglePause());
nextButton.addEventListener('click', () => void game.nextLevel());
audioToggle.addEventListener('change', () => game.setAudioEnabled(audioToggle.checked));
resetProgressButton.addEventListener('click', () => {
  progress = resetProgress();
  sessionScores.clear();
  renderProgress();
  commentator.textContent = 'Save data reset. Level one is unlocked.';
  void game.selectLevel(1);
});

window.addEventListener('beforeunload', () => game.dispose());
renderProgress();
updateMobileAim();
showComment('START');
game.start();
