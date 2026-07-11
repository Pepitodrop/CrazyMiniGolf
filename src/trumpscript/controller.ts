import {
  loadTrumpFeatureProgress,
  recordTrumpAwards,
  resetTrumpFeatureProgress,
  saveTrumpFeatureProgress,
  type TrumpFeatureProgress,
} from '../storage/trumpFeatures';
import type { CommentaryEvent, TrumpFeature, TrumpGameplayContext, TrumpTheme } from './runtime';

const DEFAULT_ACCENT = '#56d89b';
const DEFAULT_SECONDARY = '#fff48f';
const ROUND_PAR = 41;

export interface TrumpFeatureControllerOptions {
  tip(levelId: number): string;
  theme(levelId: number): TrumpTheme | null;
  challenges(levelId: number): TrumpFeature[];
  evaluate(context: TrumpGameplayContext): TrumpFeature[];
  getFeature(id: string): TrumpFeature | null;
  describe(feature: TrumpFeature): string;
  roundTitle(strokes: number, par: number): string;
}

const FEATURE_CSS = `
.trump-feature-hud strong { color: var(--accent); }
.trump-briefing-panel { position: relative; }
.trump-briefing-panel::after { content: 'OPTIONAL'; position: absolute; top: 1rem; right: 0; color: var(--accent); font-size: .62rem; letter-spacing: .12em; }
.trump-tip { color: #d4e2f2; font-size: .82rem; line-height: 1.5; }
.trump-challenges { display: grid; gap: .5rem; }
.trump-challenge { display: grid; grid-template-columns: 1.25rem 1fr; gap: .4rem; padding: .5rem; border: 1px solid #314a68; background: rgba(4,10,21,.5); }
.trump-challenge.complete { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, #08101f); }
.trump-challenge > span { color: var(--yellow); font-weight: 800; }
.trump-challenge.complete > span { color: var(--accent); }
.trump-challenge strong, .trump-challenge small { display: block; }
.trump-challenge strong { color: #f8fafc; font-size: .75rem; }
.trump-challenge small { margin-top: .2rem; color: #8fa9c8; font-size: .68rem; line-height: 1.35; }
.trump-medal-list { display: flex; flex-wrap: wrap; gap: .4rem; }
.trump-medal { display: inline-flex; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, #08101f); color: #eafff6; padding: .32rem .48rem; font-size: .68rem; }
.trump-medal.easter { border-color: var(--yellow); color: var(--yellow); box-shadow: 0 0 14px color-mix(in srgb, var(--yellow) 45%, transparent); }
.trump-medal-empty { color: #7186a1; font-size: .72rem; line-height: 1.4; }
.trump-bonus-banner { position: absolute; z-index: 4; top: 1rem; left: 50%; width: min(90%,620px); transform: translateX(-50%); border: 2px solid var(--yellow); background: rgba(7,13,25,.94); color: var(--yellow); padding: .75rem 1rem; text-align: center; font-weight: 800; box-shadow: 5px 5px 0 #02050b; }
.trump-bonus-banner.pop { animation: trump-bonus-pop 520ms steps(5,end); }
@keyframes trump-bonus-pop { 0% { transform: translate(-50%,-18px) scale(.85); opacity: 0; } 70% { transform: translate(-50%,2px) scale(1.04); opacity: 1; } 100% { transform: translateX(-50%) scale(1); } }
body.trump-easter-active .shell { animation: trump-easter-glitch 180ms steps(2,end) 10; }
body.trump-easter-active .trump-bonus-banner { background: var(--yellow); color: #08101f; border-color: var(--accent); }
@keyframes trump-easter-glitch { 0%,100% { transform: translate(0,0); filter: hue-rotate(0deg); } 33% { transform: translate(2px,-1px); filter: hue-rotate(60deg); } 66% { transform: translate(-2px,1px); filter: hue-rotate(-60deg); } }
`;

function initialTelemetry(levelId: number): TrumpGameplayContext {
  return {
    levelId,
    strokes: 0,
    par: 0,
    bounces: 0,
    shots: 0,
    maxPowerUsed: 0,
    lastPower: 0,
    diagonalShots: 0,
  };
}

export class TrumpFeatureController {
  private progress: TrumpFeatureProgress = loadTrumpFeatureProgress();
  private telemetry = initialTelemetry(1);
  private pendingAwards: TrumpFeature[] = [];
  private bonusTimer: number | null = null;
  private mounted = false;

  constructor(private readonly options: TrumpFeatureControllerOptions) {
    queueMicrotask(() => this.mount());
  }

  recordEvent(event: CommentaryEvent): string | null {
    if (event === 'START') {
      queueMicrotask(() => this.syncLevel(true));
      return null;
    }

    const levelId = this.readLevelId();
    if (levelId !== this.telemetry.levelId) this.telemetry = initialTelemetry(levelId);

    if (event === 'HIT') {
      const power = this.readPower();
      this.telemetry.shots += 1;
      this.telemetry.lastPower = power;
      this.telemetry.maxPowerUsed = Math.max(this.telemetry.maxPowerUsed, power);
    } else if (event === 'BOUNCE') {
      this.telemetry.bounces += 1;
    } else if (event === 'HOLE' || event === 'ACE') {
      const award = this.pendingAwards[0];
      this.pendingAwards = [];
      if (award) return `${award.message} +${award.points} style.`;
    } else if (event === 'FINAL') {
      const total = this.readRoundTotal();
      if (total !== null) return `${this.options.roundTitle(total, ROUND_PAR)} — ${total} strokes.`;
    }
    return null;
  }

  completeLevel(strokes: number, par: number): TrumpFeature[] {
    this.telemetry.levelId = this.readLevelId();
    this.telemetry.strokes = strokes;
    this.telemetry.par = par;
    const result = recordTrumpAwards(this.progress, this.options.evaluate(this.telemetry));
    this.progress = result.progress;
    this.pendingAwards = result.newlyUnlocked;
    saveTrumpFeatureProgress(this.progress);
    this.showAwards(result.newlyUnlocked);
    this.render();
    return result.newlyUnlocked;
  }

  private mount(): void {
    if (this.mounted || typeof document === 'undefined') return;
    this.mounted = true;

    if (!document.querySelector('#trump-feature-styles')) {
      const style = document.createElement('style');
      style.id = 'trump-feature-styles';
      style.textContent = FEATURE_CSS;
      document.head.append(style);
    }

    const hud = document.querySelector('.hud');
    if (hud && !document.querySelector('#trump-style-points')) {
      const item = document.createElement('div');
      item.className = 'trump-feature-hud';
      item.innerHTML = '<span>STYLE</span><strong id="trump-style-points">0</strong>';
      hud.append(item);
      (hud as HTMLElement).style.gridTemplateColumns = 'repeat(6, minmax(0, 1fr))';
    }

    const sidePanel = document.querySelector('.side-panel');
    const mobileControls = document.querySelector('.mobile-controls');
    if (sidePanel && mobileControls && !document.querySelector('#trump-briefing-panel')) {
      const briefing = document.createElement('section');
      briefing.id = 'trump-briefing-panel';
      briefing.className = 'trump-briefing-panel';
      briefing.innerHTML =
        '<h3>TRUMPSCRIPT BRIEFING</h3><p id="trump-level-tip" class="trump-tip"></p><div id="trump-challenges" class="trump-challenges"></div>';
      sidePanel.insertBefore(briefing, mobileControls);
    }

    const help = document.querySelector('.help');
    if (sidePanel && help && !document.querySelector('#trump-medals-panel')) {
      const medals = document.createElement('section');
      medals.id = 'trump-medals-panel';
      medals.innerHTML =
        '<h3>TRUMPSCRIPT MEDALS</h3><p id="trump-medal-summary"></p><div id="trump-medal-list" class="trump-medal-list"></div>';
      sidePanel.insertBefore(medals, help);
    }

    const canvasCard = document.querySelector('.canvas-card');
    if (canvasCard && !document.querySelector('#trump-bonus-banner')) {
      const banner = document.createElement('div');
      banner.id = 'trump-bonus-banner';
      banner.className = 'trump-bonus-banner';
      banner.hidden = true;
      canvasCard.append(banner);
    }

    document.querySelector('#reset-progress')?.addEventListener('click', () => {
      this.progress = resetTrumpFeatureProgress();
      this.pendingAwards = [];
      this.render();
    });

    this.syncLevel(true);
  }

  private syncLevel(reset: boolean): void {
    const levelId = this.readLevelId();
    if (reset || levelId !== this.telemetry.levelId) this.telemetry = initialTelemetry(levelId);
    this.applyTheme(levelId);
    this.render();
  }

  private render(): void {
    if (!this.mounted) return;
    const levelId = this.readLevelId();
    const stylePoints = document.querySelector('#trump-style-points');
    if (stylePoints) stylePoints.textContent = String(this.progress.stylePoints);

    const tip = document.querySelector('#trump-level-tip');
    if (tip) tip.textContent = this.options.tip(levelId) || 'No optional briefing for this level.';

    const challengeList = document.querySelector('#trump-challenges');
    if (challengeList) {
      challengeList.replaceChildren();
      for (const challenge of this.options.challenges(levelId)) {
        const complete = this.progress.unlockedFeatureIds.includes(challenge.id);
        const row = document.createElement('div');
        row.className = `trump-challenge${complete ? ' complete' : ''}`;
        const status = document.createElement('span');
        status.textContent = complete ? '✓' : '○';
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${challenge.title} · +${challenge.points}`;
        const description = document.createElement('small');
        description.textContent = this.options.describe(challenge);
        copy.append(title, description);
        row.append(status, copy);
        challengeList.append(row);
      }
    }

    const medalSummary = document.querySelector('#trump-medal-summary');
    if (medalSummary) {
      medalSummary.textContent = `${this.progress.unlockedFeatureIds.length} medals · ${this.progress.stylePoints} style points`;
    }

    const medalList = document.querySelector('#trump-medal-list');
    if (medalList) {
      medalList.replaceChildren();
      const earned = this.progress.unlockedFeatureIds
        .map((id) => this.options.getFeature(id))
        .filter((feature): feature is TrumpFeature => feature !== null);
      for (const feature of earned.slice(-8).reverse()) {
        const medal = document.createElement('span');
        medal.className = `trump-medal${feature.kind === 'EASTER' ? ' easter' : ''}`;
        medal.textContent = feature.title;
        medal.title = `${feature.message} (+${feature.points} style)`;
        medalList.append(medal);
      }
      if (earned.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'trump-medal-empty';
        empty.textContent = 'Complete optional challenges to earn medals.';
        medalList.append(empty);
      }
    }
  }

  private showAwards(awards: TrumpFeature[]): void {
    if (awards.length === 0 || typeof window === 'undefined') return;
    const banner = document.querySelector<HTMLElement>('#trump-bonus-banner');
    if (!banner) return;
    if (this.bonusTimer !== null) window.clearTimeout(this.bonusTimer);
    const points = awards.reduce((sum, award) => sum + award.points, 0);
    banner.textContent = `+${points} STYLE · ${awards.map((award) => award.title).join(' · ')}`;
    banner.hidden = false;
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');

    if (awards.some((award) => award.kind === 'EASTER')) {
      document.body.classList.add('trump-easter-active');
      window.setTimeout(() => document.body.classList.remove('trump-easter-active'), 2400);
    }

    this.bonusTimer = window.setTimeout(() => {
      banner.hidden = true;
      this.bonusTimer = null;
    }, 4200);
  }

  private applyTheme(levelId: number): void {
    const theme = this.options.theme(levelId);
    document.documentElement.style.setProperty('--accent', theme?.accent ?? DEFAULT_ACCENT);
    document.documentElement.style.setProperty('--yellow', theme?.secondary ?? DEFAULT_SECONDARY);
  }

  private readLevelId(): number {
    const text = document.querySelector('#hud-level')?.textContent ?? '1';
    const parsed = Number.parseInt(text, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  }

  private readPower(): number {
    const text = document.querySelector('#hud-power')?.textContent ?? '0';
    const parsed = Number.parseInt(text, 10);
    return Number.isInteger(parsed) ? parsed : 0;
  }

  private readRoundTotal(): number | null {
    const text = document.querySelector<HTMLElement>('#commentator')?.dataset.final ?? '';
    const match = /(\d+)/u.exec(text);
    return match ? Number(match[1]) : null;
  }
}
