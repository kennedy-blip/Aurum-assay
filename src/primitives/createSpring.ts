import { createSignal, onCleanup } from "solid-js";

/**
 * createSpring — Hooke's-law spring physics for SolidJS.
 * Drives coin resonance rings, balance-wheel oscillations, caliper jaws,
 * card interactions and the gooey dock pill.
 *
 *   m·x'' = -k·(x - target) - c·x'
 */
export interface SpringOptions {
  stiffness?: number; // k  (default 320)
  damping?: number; //   c  (default 25)
  mass?: number; //       m  (default 0.8)
  precision?: number; //   rest threshold
}

export function createSpring(initial: number, opts: SpringOptions = {}) {
  const k = opts.stiffness ?? 320;
  const c = opts.damping ?? 25;
  const m = opts.mass ?? 0.8;
  const precision = opts.precision ?? 0.001;

  const [value, setValue] = createSignal(initial);
  let target = initial;
  let velocity = 0;
  let raf = 0;
  let last = 0;
  let running = false;

  const step = (now: number) => {
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.033); // clamp for tab-switch spikes
    last = now;
    const x = value();
    const force = -k * (x - target) - c * velocity;
    velocity += (force / m) * dt;
    const next = x + velocity * dt;
    setValue(next);
    if (Math.abs(next - target) < precision && Math.abs(velocity) < precision) {
      setValue(target);
      velocity = 0;
      running = false;
      return;
    }
    raf = requestAnimationFrame(step);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(step);
  };

  const setTarget = (t: number) => {
    target = t;
    start();
  };

  /** Impulse kick — e.g. coin ping strike, escapement tick. */
  const kick = (impulse: number) => {
    velocity += impulse;
    start();
  };

  onCleanup(() => cancelAnimationFrame(raf));
  return { value, setTarget, kick, get target() { return target; } };
}

/** Spring-driven oscillator: value = sin phase advanced by a spring-damper toward a rotating target. */
export function createSpringOscillator(freqHz: number, amplitude: number) {
  const s = createSpring(0, { stiffness: 320, damping: 4, mass: 0.8 });
  let phase = 0;
  let last = 0;
  let raf = 0;
  const loop = (now: number) => {
    if (!last) last = now;
    const dt = (now - last) / 1000;
    last = now;
    phase += dt * freqHz * Math.PI * 2;
    s.setTarget(Math.sin(phase) * amplitude);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
  return s.value;
}
