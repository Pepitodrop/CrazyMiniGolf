import { describe, expect, it, vi } from 'vitest';
import { AudioManager, type AudioContextLike } from '../src/game/AudioManager';

describe('AudioManager', () => {
  it('degrades gracefully when AudioContext construction fails', () => {
    const manager = new AudioManager(() => {
      throw new Error('blocked');
    });

    expect(manager.tone(440)).toBe(false);
    expect(() => manager.hit(5)).not.toThrow();
  });

  it('creates and schedules an oscillator when audio is available', () => {
    const connect = vi.fn().mockReturnThis();
    const start = vi.fn();
    const stop = vi.fn();
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect,
      start,
      stop,
    } as unknown as OscillatorNode;
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect,
    } as unknown as GainNode;
    const context = {
      currentTime: 1,
      destination: {} as AudioNode,
      createOscillator: () => oscillator,
      createGain: () => gain,
    } as AudioContextLike;
    const manager = new AudioManager(() => context);

    expect(manager.tone(440, 0.1, 0.02)).toBe(true);
    expect(oscillator.frequency.value).toBe(440);
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledWith(1.1);
  });
});
