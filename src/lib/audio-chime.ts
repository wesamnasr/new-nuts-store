/**
 * Real-Time Synthesized Audio Chimes & Alert Engine
 * Target: محمصة حفصة للبن والمكسرات — فرع بني مزار
 * 
 * Generates pure synthesizer sounds natively via HTML5 Web Audio API:
 * - Zero external mp3/wav audio assets required (immune to network 404s and offline failures).
 * - Instant execution with customizable tone envelopes.
 * - Persistent mute/unmute preferences across Cashier (/pos), Management (/admin), and Delivery (/rider).
 */

const AUDIO_MUTE_STORAGE_KEY = 'hafsa_audio_muted';

declare global {
  interface Window {
    __hafsaAudioContext?: AudioContext;
  }
}

/**
 * Checks whether audio notifications are currently muted
 */
export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets audio notifications mute state
 */
export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage quota or security errors
  }
}

/**
 * Toggles audio notifications mute state
 */
export function toggleAudioMuted(): boolean {
  const current = isAudioMuted();
  const next = !current;
  setAudioMuted(next);
  return next;
}

/**
 * Obtains or resumes shared AudioContext safely
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!window.__hafsaAudioContext || window.__hafsaAudioContext.state === 'closed') {
      window.__hafsaAudioContext = new AudioCtx();
    }

    if (window.__hafsaAudioContext.state === 'suspended') {
      window.__hafsaAudioContext.resume().catch(() => {});
    }

    return window.__hafsaAudioContext;
  } catch {
    return null;
  }
}

/**
 * Plays a single synth tone with gentle exponential decay envelope
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain = 0.22,
  type: OscillatorType = 'sine'
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  } catch {
    // Graceful degradation
  }
}

/**
 * Distinctive 3-tone chime for incoming online orders:
 * Musical Notes: D5 (587.33 Hz) -> F#5 (739.99 Hz) -> A5 (880 Hz)
 */
export function playOrderAlertChime(): void {
  if (isAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 587.33, now, 0.22, 0.25, 'triangle');
  playTone(ctx, 739.99, now + 0.14, 0.22, 0.28, 'sine');
  playTone(ctx, 880.0, now + 0.28, 0.45, 0.32, 'sine');
}

/**
 * Cheerful dual-tone chime for completed transactions, deliveries, and approvals:
 * Musical Notes: E5 (659.25 Hz) -> A5 (880 Hz)
 */
export function playSuccessChime(): void {
  if (isAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 659.25, now, 0.18, 0.2, 'sine');
  playTone(ctx, 880.0, now + 0.12, 0.32, 0.24, 'sine');
}

/**
 * Soft subtle cashier keypress click/beep
 */
export function playCashierKeyBeep(freq = 920, duration = 0.08): void {
  if (isAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, freq, now, duration, 0.12, 'sine');
}
