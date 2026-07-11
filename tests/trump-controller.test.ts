// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrumpFeatureController } from '../src/trumpscript/controller';
import type { TrumpFeature, TrumpGameplayContext } from '../src/trumpscript/runtime';

const feature: TrumpFeature = {
  id: 'diagonal-test',
  kind: 'CHALLENGE',
  levelId: 2,
  title: 'Diagonal Test',
  conditions: [{ type: 'DIAGONAL_SHOTS_AT_LEAST', value: 1 }],
  points: 75,
  message: 'Diagonal telemetry works.',
};

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `
    <main class="shell">
      <section class="hud"></section>
      <div class="canvas-card"></div>
      <aside class="side-panel">
        <section class="mobile-controls"></section>
        <section class="help"></section>
        <button id="reset-progress"></button>
      </aside>
    </main>
  `;
});

describe('TrumpFeatureController', () => {
  it('uses explicit shot telemetry and updates optional UI', async () => {
    let captured: TrumpGameplayContext | null = null;
    const evaluate = vi.fn((context: TrumpGameplayContext) => {
      captured = { ...context };
      return context.diagonalShots >= 1 ? [feature] : [];
    });
    const controller = new TrumpFeatureController({
      tip: () => 'Typed telemetry only.',
      theme: () => ({ accent: '#123456', secondary: '#abcdef' }),
      challenges: () => [feature],
      evaluate,
      getFeature: (id) => (id === feature.id ? feature : null),
      describe: () => 'use one diagonal shot',
    });
    await Promise.resolve();

    controller.startLevel(2);
    controller.recordShot({ strength: 14, diagonal: true });
    controller.recordBounce();
    const result = controller.completeLevel(2, 3, 4);

    expect(captured).toMatchObject({
      levelId: 2,
      strokes: 3,
      par: 4,
      shots: 1,
      bounces: 1,
      maxPowerUsed: 14,
      lastPower: 14,
      diagonalShots: 1,
    });
    expect(result.awards).toEqual([feature]);
    expect(result.saved).toBe(true);
    expect(document.querySelector('#trump-style-points')?.textContent).toBe('75');
    expect(document.querySelector('.trump-challenge')?.classList.contains('complete')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456');
  });
});
