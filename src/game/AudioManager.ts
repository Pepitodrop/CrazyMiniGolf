export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNode;
  readonly state?: AudioContextState;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

export class AudioManager {
  private context: AudioContextLike | null = null;
  private enabled = true;
  private unavailable = false;

  constructor(private readonly contextFactory: () => AudioContextLike = () => new AudioContext()) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private getContext(): AudioContextLike | null {
    if (!this.enabled || this.unavailable) return null;
    try {
      this.context ??= this.contextFactory();
      if (this.context.state === 'suspended') void this.context.resume?.().catch(() => undefined);
      return this.context;
    } catch {
      this.unavailable = true;
      return null;
    }
  }

  tone(frequency: number, duration = 0.08, volume = 0.04): boolean {
    const context = this.getContext();
    if (!context) return false;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      return true;
    } catch {
      this.unavailable = true;
      return false;
    }
  }

  hit(strength: number): void {
    this.tone(160 + strength * 18, 0.06 + strength * 0.004);
  }

  bounce(): void {
    this.tone(110, 0.05, 0.025);
  }

  hole(): void {
    this.tone(523, 0.12);
    if (typeof window !== 'undefined') window.setTimeout(() => this.tone(784, 0.18), 90);
  }

  dispose(): void {
    void this.context?.close?.().catch(() => undefined);
    this.context = null;
  }
}
