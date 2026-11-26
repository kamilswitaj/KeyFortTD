import { TowerType } from '../types';

export type MusicTrack = 'none' | 'menu' | 'combat' | 'boss';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicVolume: number = 0.35;
  private sfxVolume: number = 0.65;
  private isMuted: boolean = false;

  private lastShotAtByType: Record<string, number> = {};
  private activeVoices: number = 0;
  private readonly maxVoices: number = 14;

  private musicTimerId: number | null = null;
  private currentTrack: MusicTrack = 'none';
  private musicStep: number = 0;

  public setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    if (this.musicVolume <= 0.01) {
      this.stopMusic();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopMusic();
    }
  }

  private ensureContext(forMusic = false): AudioContext | null {
    if (this.isMuted) return null;
    if (!forMusic && this.sfxVolume <= 0.01) return null;
    if (forMusic && this.musicVolume <= 0.01) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private canSpawnVoice(): boolean {
    return this.activeVoices < this.maxVoices;
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    durationSec: number,
    volume: number,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.canSpawnVoice()) return;

    this.activeVoices++;
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
    }
    gain.gain.setValueAtTime(Math.max(0.001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }

  public startMusic(track: MusicTrack): void {
    if (typeof window === 'undefined') return;
    if (track === 'none' || this.musicVolume <= 0.01 || this.isMuted) {
      this.stopMusic();
      return;
    }
    if (this.currentTrack === track && this.musicTimerId !== null) return;
    this.stopMusic();
    this.currentTrack = track;
    this.musicStep = 0;

    const tempoMs = track === 'boss' ? 320 : track === 'combat' ? 420 : 580;
    const scale =
      track === 'boss'
        ? [146.83, 174.61, 196.0, 220.0, 261.63, 293.66]
        : track === 'combat'
        ? [196.0, 246.94, 293.66, 329.63, 392.0, 440.0]
        : [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

    this.musicTimerId = window.setInterval(() => {
      const ctx = this.ensureContext(true);
      if (!ctx || ctx.state !== 'running' || !this.canSpawnVoice()) return;
      const pattern = [0, 2, 4, 3, 1, 4, 2, 5];
      const note = scale[pattern[this.musicStep % pattern.length]];
      this.musicStep++;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = track === 'boss' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(note, now);
      const vol = 0.032 * this.musicVolume;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tempoMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.activeVoices++;
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };
      osc.start(now);
      osc.stop(now + tempoMs / 1000 + 0.02);
    }, tempoMs);
  }

  public stopMusic(): void {
    if (this.musicTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimerId);
    }
    this.musicTimerId = null;
    this.currentTrack = 'none';
  }

  public playKeystroke(isCorrect: boolean, combo: number = 0): void {
    if (isCorrect) {
      const pitchShift = Math.min(260, combo * 4);
      this.playTone('triangle', 520 + pitchShift, 780 + pitchShift, 0.05, 0.1 * this.sfxVolume);
    } else {
      this.playTone('sawtooth', 165, 108, 0.11, 0.14 * this.sfxVolume);
    }
  }

  public playSequenceComplete(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      this.playTone('sine', freq, freq, 0.13, 0.11 * this.sfxVolume, idx * 0.045);
    });
  }

  public playTowerShot(type: TowerType): void {
    const nowMs = Date.now();
    const minIntervalMs = type === 'gun' || type === 'flame' || type === 'laser' ? 110 : 65;
    if (nowMs - (this.lastShotAtByType[type] ?? 0) < minIntervalMs) {
      return;
    }
    this.lastShotAtByType[type] = nowMs;

    switch (type) {
      case 'gun':
        this.playTone('square', 360, 110, 0.05, 0.06 * this.sfxVolume);
        break;
      case 'cannon':
        this.playTone('sawtooth', 135, 42, 0.18, 0.12 * this.sfxVolume);
        break;
      case 'frost':
        this.playTone('sine', 880, 440, 0.14, 0.07 * this.sfxVolume);
        break;
      case 'tesla':
        this.playTone('sawtooth', 640, 320, 0.09, 0.08 * this.sfxVolume);
        break;
      case 'sniper':
        this.playTone('triangle', 720, 95, 0.16, 0.13 * this.sfxVolume);
        break;
      case 'flame':
        this.playTone('sawtooth', 220, 120, 0.08, 0.06 * this.sfxVolume);
        break;
      case 'drone':
        this.playTone('triangle', 480, 620, 0.07, 0.07 * this.sfxVolume);
        break;
      case 'laser':
        this.playTone('sine', 960, 740, 0.08, 0.07 * this.sfxVolume);
        break;
      case 'command':
        this.playTone('sine', 540, 810, 0.09, 0.06 * this.sfxVolume);
        break;
      default:
        break;
    }
  }

  public playUpgrade(): void {
    this.playTone('triangle', 440, 660, 0.09, 0.12 * this.sfxVolume, 0);
    this.playTone('triangle', 660, 880, 0.12, 0.12 * this.sfxVolume, 0.07);
  }

  public playWaveStart(): void {
    this.playTone('sawtooth', 220, 330, 0.14, 0.1 * this.sfxVolume, 0);
    this.playTone('triangle', 330, 440, 0.16, 0.1 * this.sfxVolume, 0.09);
  }

  public playVictory(): void {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      this.playTone('triangle', freq, freq, 0.25, 0.12 * this.sfxVolume, idx * 0.08);
    });
  }

  public playDefeat(): void {
    const notes = [330, 277.18, 220];
    notes.forEach((freq, idx) => {
      this.playTone('sawtooth', freq, freq * 0.85, 0.24, 0.1 * this.sfxVolume, idx * 0.12);
    });
  }
}
