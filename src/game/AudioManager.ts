export class AudioManager {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    this.context ??= new AudioContext();
    return this.context;
  }

  tone(frequency: number, duration = 0.08, volume = 0.04): void {
    const context = this.getContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  hit(strength: number): void {
    this.tone(160 + strength * 18, 0.06 + strength * 0.004);
  }

  bounce(): void {
    this.tone(110, 0.05, 0.025);
  }

  hole(): void {
    this.tone(523, 0.12);
    window.setTimeout(() => this.tone(784, 0.18), 90);
  }
}
