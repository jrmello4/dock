// SoundService usando Web Audio API nativo (Zero-Dependency Synthesizer)
// Espelha o SoundService do Brasfoot Reborn para eventos de corrida e UI

class SoundService {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.6;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', delaySec = 0, gainScale = 0.25) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delaySec);

      const finalVol = Math.max(0.001, this.volume * gainScale);
      gain.gain.setValueAtTime(finalVol, ctx.currentTime + delaySec);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delaySec + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delaySec);
      osc.stop(ctx.currentTime + delaySec + durationSec);
    } catch {
      // Silencioso caso o navegador bloqueie autoplay
    }
  }

  public playLightsBeep(finalGreen = false) {
    if (finalGreen) {
      this.playTone(880, 0.45, 'sawtooth', 0, 0.3);
      this.playTone(1320, 0.45, 'triangle', 0.02, 0.2);
    } else {
      this.playTone(440, 0.16, 'square', 0, 0.2);
    }
  }

  public playTeamRadioBeep() {
    this.playTone(1200, 0.07, 'sine', 0, 0.2);
    this.playTone(1650, 0.12, 'sine', 0.08, 0.22);
  }

  public playOvertake(isMyTeam: boolean) {
    if (isMyTeam) {
      this.playTone(587.33, 0.12, 'triangle', 0, 0.25);
      this.playTone(880, 0.22, 'triangle', 0.1, 0.28);
    } else {
      this.playTone(392, 0.15, 'sine', 0, 0.15);
    }
  }

  public playFastestLap() {
    this.playTone(659.25, 0.1, 'sine', 0, 0.22);
    this.playTone(783.99, 0.1, 'sine', 0.09, 0.22);
    this.playTone(1046.5, 0.25, 'triangle', 0.18, 0.26);
  }

  public playPitStop() {
    // Som estilizado de pistola pneumática (wheel gun)
    this.playTone(310, 0.06, 'sawtooth', 0, 0.2);
    this.playTone(370, 0.06, 'sawtooth', 0.07, 0.2);
    this.playTone(480, 0.12, 'sawtooth', 0.14, 0.22);
  }

  public playSafetyCarAlert() {
    this.playTone(740, 0.18, 'square', 0, 0.22);
    this.playTone(554.37, 0.22, 'square', 0.2, 0.22);
  }

  public playDNFAlert() {
    this.playTone(330, 0.18, 'sawtooth', 0, 0.24);
    this.playTone(220, 0.35, 'sawtooth', 0.16, 0.24);
  }

  public playChequeredFlag() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', idx * 0.1, 0.28);
    });
  }
}

export const soundService = new SoundService();
