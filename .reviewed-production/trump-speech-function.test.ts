import { describe, expect, it } from 'vitest';
import source from '../src/trumpscript/tremendous-function.tr?raw';
import {
  calculateTremendousNumber,
  createTrumpSpeechFunction,
} from '../src/trumpscript/speechFunction';

describe('TrumpScript tremendous speech function', () => {
  it('parses the Trump-style function declaration and executes it deterministically', () => {
    const speechFunction = createTrumpSpeechFunction(source);
    const speech = speechFunction.invoke({ strokes: 3, par: 4 });

    expect(speechFunction.id).toBe('tremendous-deal');
    expect(calculateTremendousNumber(3, 4)).toBe(198);
    expect(speech).toContain('3 strokes');
    expect(speech).toContain('Par was 4');
    expect(speech).toContain('margin is +1');
    expect(speech).toContain('198');
    expect(speech).toContain('landslide victory');
  });

  it('produces a deliberately rambling consolation result over par', () => {
    const speech = createTrumpSpeechFunction(source).invoke({ strokes: 5, par: 4 });

    expect(calculateTremendousNumber(5, 4)).toBe(309);
    expect(speech).toContain('temporary negotiation');
    expect(speech).toContain('course was frankly very unfair');
  });

  it('rejects malformed functions and unknown placeholders', () => {
    expect(() => createTrumpSpeechFunction('MAKE FUNCTION bad SAY "No deal"')).toThrow(
      /Unsupported TrumpScript speech function/,
    );
    expect(() =>
      createTrumpSpeechFunction(
        'MAKE FUNCTION bad GREAT AGAIN WITH STROKES AND PAR SAY "The number is {SECRET}."',
      ),
    ).toThrow(/Unsupported TrumpScript speech placeholder/);
    expect(() =>
      createTrumpSpeechFunction(
        'MAKE FUNCTION bad GREAT AGAIN WITH STROKES AND PAR SAY "The number is {secret}."',
      ),
    ).toThrow(/Unsupported TrumpScript speech placeholder/);
  });

  it('rejects invalid score inputs without touching game state', () => {
    const speechFunction = createTrumpSpeechFunction(source);
    expect(() => speechFunction.invoke({ strokes: -1, par: 4 })).toThrow(/Strokes/);
    expect(() => speechFunction.invoke({ strokes: 2, par: 0 })).toThrow(/Par/);
  });
});
