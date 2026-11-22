/**
 * audio.ts — Web Audio synthesis & capture helpers.
 *  • Synthetic metallurgical ping: 3-mode modal oscillator bank with
 *    exponential ring-decay (authentic vs counterfeit signatures).
 *  • Escapement tick-tock synthesis at exact BPH.
 *  • Live mic capture with voice filters DISABLED for pure 2–16 kHz overtones.
 */

let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Play a coin ping: modal frequencies + sustain decay (ms at −40 dB). */
export function playPing(freqs: number[], sustainMs: number, gain = 0.5) {
  const ac = audioCtx();
  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = gain;
  master.connect(ac.destination);
  const tau = Math.max(sustainMs / 1000 / 4.6, 0.05); // −40 dB ≈ 4.6τ
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = ac.createGain();
    const amp = [1, 0.55, 0.32][i] ?? 0.3;
    g.gain.setValueAtTime(amp, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tau * 4.6);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + tau * 4.6 + 0.05);
  });
  // Strike transient (metallic attack click)
  const noise = ac.createBufferSource();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.02, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
  noise.buffer = buf;
  const ng = ac.createGain(); ng.gain.value = 0.25;
  const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
  noise.connect(hp).connect(ng).connect(master);
  noise.start(t0);
}

/** Single escapement tick (tick = high click, tock = lower click). */
export function playTick(isTick: boolean, gain = 0.35) {
  const ac = audioCtx();
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "square";
  osc.frequency.value = isTick ? 4200 : 3100;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = isTick ? 4200 : 3100; bp.Q.value = 6;
  osc.connect(bp).connect(g).connect(ac.destination);
  osc.start(t0); osc.stop(t0 + 0.02);
}

/** Haptic pulse synced to ping/tick (navigator.vibrate / Capacitor Haptics). */
export function haptic(pattern: number | number[] = 18) {
  try { (navigator as any).vibrate?.(pattern); } catch { /* unsupported */ }
}

/**
 * Live mic analyser — voice filters OFF so 2–16 kHz coin overtones and
 * microsecond watch ticks are captured pure and unclipped.
 */
export async function getMicAnalyser(fftSize = 8192): Promise<{ analyser: AnalyserNode; stream: MediaStream; ctx: AudioContext }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: { ideal: 48000 },
    } as any,
  });
  const ac = audioCtx();
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.35;
  src.connect(analyser);
  return { analyser, stream, ctx: ac };
}

export function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}
