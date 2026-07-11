import { describe, expect, it } from 'vitest';
import source from '../src/trumpscript/commentator.tr?raw';
import { createTrumpRuntime, type TrumpGameplayContext } from '../src/trumpscript/runtime';

const context = (overrides: Partial<TrumpGameplayContext> = {}): TrumpGameplayContext => ({
  levelId: 4,
  strokes: 4,
  par: 4,
  bounces: 1,
  shots: 4,
  maxPowerUsed: 10,
  lastPower: 5,
  diagonalShots: 1,
  ...overrides,
});

describe('TrumpScript compatibility runtime', () => {
  it('returns deterministic commentary for a supplied seed', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.comment('START', 0)).toBe(runtime.comment('START', 2));
  });

  it('grades level and round results without affecting authoritative scores', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.grade(1, 4)).toBe('TREMENDOUS');
    expect(runtime.grade(4, 4)).toBe('VERY SOLID');
    expect(runtime.roundTitle(35, 41)).toBe('LANDSLIDE VICTORY');
  });

  it('provides level tips and validated cosmetic themes', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.tip(4)).toContain('bank shot');
    expect(runtime.theme(9)).toEqual({ accent: '#ff4d6d', secondary: '#ffd166' });
  });

  it('evaluates compound level challenges', () => {
    const runtime = createTrumpRuntime(source);
    const awards = runtime.evaluate(context());
    expect(awards.map((award) => award.id)).toContain('wall-street');
    expect(runtime.describe(awards.find((award) => award.id === 'wall-street')!)).toContain(
      'at least 1 bounce',
    );
  });

  it('keeps Easter eggs hidden from the briefing but evaluates them', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.challenges(9).some((feature) => feature.kind === 'EASTER')).toBe(false);
    const awards = runtime.evaluate(
      context({ levelId: 9, strokes: 7, par: 7, bounces: 3, lastPower: 13 }),
    );
    expect(awards.map((award) => award.id)).toContain('covfefe-protocol');
  });

  it('rejects unsupported conditions and unsafe theme values', () => {
    expect(() =>
      createTrumpRuntime('CHALLENGE bad LEVEL 1 TITLE "Bad" WHEN TELEPORT AWARD 10 SAY "Nope"'),
    ).toThrow(/Unsupported TrumpScript condition/);
    expect(() => createTrumpRuntime('THEME LEVEL 1 ACCENT "red" SECONDARY "#ffffff"')).toThrow(
      /Unsupported TrumpScript compatibility statement/,
    );
  });
});
