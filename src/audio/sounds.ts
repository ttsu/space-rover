let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.15,
  freqEnd?: number
): void {
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {
    // Audio may not be available
  }
}

function playNoise(duration: number, volume = 0.1): void {
  try {
    const c = ctx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start(c.currentTime);
  } catch {
    // Audio may not be available
  }
}

export function playBlaster(): void {
  playTone(880, 0.08, "square", 0.12, 220);
  playNoise(0.06, 0.06);
}

export function playPickup(): void {
  playTone(523, 0.06, "sine", 0.12);
  setTimeout(() => playTone(784, 0.08, "sine", 0.1), 60);
}

export function playDamage(): void {
  playNoise(0.15, 0.18);
  playTone(120, 0.15, "sawtooth", 0.1, 60);
}

export function playDock(): void {
  playTone(440, 0.1, "sine", 0.1);
  setTimeout(() => playTone(554, 0.1, "sine", 0.1), 100);
  setTimeout(() => playTone(659, 0.15, "sine", 0.12), 200);
}

export function playClick(): void {
  playTone(660, 0.04, "square", 0.08);
}

export function playDeath(): void {
  playTone(300, 0.2, "sawtooth", 0.15, 80);
  playNoise(0.3, 0.12);
}

/**
 * Thunder sound with optional delay (distance-based) and volume (distant = quieter).
 * @param delayMs - Delay before playing (e.g. from lightning strike distance).
 * @param volume - 0–1; reduce for distant strikes.
 */
export function playThunder(delayMs = 0, volume = 0.2): void {
  const clampedVol = Math.max(0.05, Math.min(1, volume));
  if (delayMs <= 0) {
    playNoise(0.4, clampedVol * 0.25);
    playTone(80, 0.3, "sawtooth", clampedVol * 0.12, 40);
  } else {
    setTimeout(() => {
      playNoise(0.4, clampedVol * 0.25);
      playTone(80, 0.3, "sawtooth", clampedVol * 0.12, 40);
    }, delayMs);
  }
}
