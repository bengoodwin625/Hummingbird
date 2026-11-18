/**
 * Gentle, optional sound, off by default: a quiet rainforest bed with the odd bird call, a chime
 * for each animal and a soft tick when the answers open. Everything is synthesised with Web
 * Audio, so there are no sound files to download. The choice is remembered on this device.
 */
import type { Band } from "../art/sprites";

const PREF_KEY = "hb-sound";

/** Notes (Hz) for each animal's chime: the faster the animal, the higher and brighter. */
export const CHIMES: Record<Band, { notes: number[]; type: OscillatorType; gap: number; length: number }> = {
  hummingbird: { notes: [1046.5, 1318.5, 1568, 2093], type: "triangle", gap: 0.06, length: 0.5 },
  jaguar: { notes: [784, 1046.5], type: "triangle", gap: 0.09, length: 0.45 },
  toucan: { notes: [659.3, 784], type: "sine", gap: 0.12, length: 0.45 },
  tree_frog: { notes: [261.6, 293.7], type: "square", gap: 0.1, length: 0.12 },
  sloth: { notes: [196], type: "sine", gap: 0, length: 1.1 },
};

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(on: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // Remembering is a nicety; the toggle still works for this visit.
  }
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: AudioBufferSourceNode | null = null;
  private chirpTimer = 0;
  enabled = readPref();

  constructor(private readonly onChange: (on: boolean) => void = () => {}) {
    // Browsers only allow audio after a tap; if sound was left on, start on the first one.
    if (this.enabled) {
      const start = () => {
        document.removeEventListener("pointerdown", start);
        if (this.enabled) this.start();
      };
      document.addEventListener("pointerdown", start);
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.enabled) void this.ctx.resume();
    });
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    writePref(this.enabled);
    if (this.enabled) this.start();
    else this.stop();
    this.onChange(this.enabled);
    return this.enabled;
  }

  /** An animal's chime, or a soft falling tone for a miss. */
  chime(band: Band | null): void {
    const ctx = this.ready();
    if (!ctx) return;
    if (!band) {
      this.notes([392, 311.1], "sine", 0.16, 0.5, 0.06);
      return;
    }
    const c = CHIMES[band];
    this.notes(c.notes, c.type, c.gap, c.length, band === "tree_frog" ? 0.03 : 0.07);
  }

  /** A faint tick as the answers open. */
  tick(): void {
    if (this.ready()) this.notes([1760], "sine", 0, 0.08, 0.035);
  }

  // ------------------------------------------------------------- internals

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return null;
    return this.ctx;
  }

  private start(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.startAmbience();
  }

  private stop(): void {
    this.ambience?.stop();
    this.ambience = null;
    window.clearTimeout(this.chirpTimer);
    if (this.ctx) void this.ctx.suspend();
  }

  private notes(freqs: number[], type: OscillatorType, gap: number, length: number, volume: number): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const t = now + i * gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.05);
    });
  }

  /** Soft filtered noise, like leaves and distant water, plus an occasional bird call. */
  private startAmbience(): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out || this.ambience) return;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: gentle and low, never hissy.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    source.connect(filter).connect(gain).connect(out);
    source.start();
    this.ambience = source;
    this.scheduleChirp();
  }

  private scheduleChirp(): void {
    window.clearTimeout(this.chirpTimer);
    this.chirpTimer = window.setTimeout(() => {
      this.chirp();
      if (this.enabled) this.scheduleChirp();
    }, 5000 + Math.random() * 9000);
  }

  private chirp(): void {
    const ctx = this.ready();
    const out = this.master;
    if (!ctx || !out) return;
    const base = 2200 + Math.random() * 1400;
    const calls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.07);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.012, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }
}
