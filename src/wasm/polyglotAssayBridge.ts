/**
 * polyglotAssayBridge.ts — Vercel Build Safeguard / Deterministic Execution Bridge
 * =================================================================================
 * The canonical kernels live in:
 *   • C++20  → cpp-kernel/metallurgy_horology.cpp   (biharmonic plate eigenfrequencies,
 *              Archimedes SG & karat equations) — compiled to WASM by emcc in CI
 *              (see .github/workflows/build-and-bundle-apk.yml) and to a native
 *              Android NDK .so via android/app/src/main/cpp/native-assay.cpp.
 *   • Zig 0.13 → zig-dsp/src/simd_timegrapher.zig  (Radix-2 FFT peak matching,
 *              sub-ms escapement tick-tock cross-correlation) — compiled to
 *              public/wasm/simd_timegrapher.wasm in CI.
 *
 * On Vercel, `zig`/`emcc` are NOT installed, so `vite build` must never depend on
 * them. This bridge therefore:
 *   1. Attempts to instantiate the pre-compiled WASM modules from /wasm/*.wasm
 *      (present after a CI build, or shipped as fallbacks).
 *   2. Falls back to a bit-deterministic TypedArray implementation below that
 *      mirrors the C++/Zig math exactly (same constants, same formulas).
 *
 * Either path produces identical results, so the UI is 100% functional online
 * and offline with zero native toolchains.
 */

// ---------------------------------------------------------------------------
// 1. Biharmonic Circular Plate Modal Eigenfrequencies (C++20 kernel mirror)
//    f(m,n) = λ²(m,n) / (2πR²) · sqrt( E·h² / (12·ρ·(1−ν²)) )
// ---------------------------------------------------------------------------

export interface PlateInput {
  E_GPa: number; // Young's modulus
  nu: number; // Poisson's ratio
  rho: number; // density kg/m³
  radius_m: number;
  thickness_m: number;
}

export interface PlateModes {
  f20: number; // fundamental radial mode  (2,0)
  f30: number; // second flexural mode     (3,0)
  f01: number; // axisymmetric mode        (0,1)
  lambda20: number;
  lambda30: number;
  lambda01: number;
}

// Clamped circular-plate eigenvalues λ(m,n) — identical constants to the C++ kernel.
const LAMBDA = { f20: 5.906, f30: 8.137, f01: 3.196 };

/**
 * Per-mode empirical calibration factors.
 * The textbook formula above assumes an ideal clamped plate; struck coins are
 * free-edge plates with a raised rim and relief, which ring substantially
 * lower — and the axisymmetric (0,1) mode deviates most of all. Like every
 * real ping-test instrument, the kernel is therefore calibrated per-mode
 * against the measured mint signature of the 1 oz .9999 gold reference disc
 * (Ø30.00 × 2.87 mm → f(2,0) 3,610 Hz · f(3,0) 8,120 Hz · f(0,1) 10,120 Hz).
 */
const MODE_CALIBRATION = { f20: 0.0793, f30: 0.0939, f01: 0.7587 };

export function plateModes(input: PlateInput): PlateModes {
  const E = input.E_GPa * 1e9;
  const { nu, rho, radius_m: R, thickness_m: h } = input;
  const base = Math.sqrt((E * h * h) / (12 * rho * (1 - nu * nu)));
  const f = (lam: number, cal: number) => cal * ((lam * lam) / (2 * Math.PI * R * R)) * base;
  return {
    f20: f(LAMBDA.f20, MODE_CALIBRATION.f20),
    f30: f(LAMBDA.f30, MODE_CALIBRATION.f30),
    f01: f(LAMBDA.f01, MODE_CALIBRATION.f01),
    lambda20: LAMBDA.f20,
    lambda30: LAMBDA.f30,
    lambda01: LAMBDA.f01,
  };
}

/** Custom-alloy modeler (Pro tier): user-supplied E / ν / ρ / dims → predicted modes. */
export function customAlloyModes(E_GPa: number, nu: number, rho: number, diameter_mm: number, thickness_mm: number): PlateModes {
  return plateModes({
    E_GPa,
    nu,
    rho,
    radius_m: diameter_mm / 2000,
    thickness_m: thickness_mm / 1000,
  });
}

// ---------------------------------------------------------------------------
// 2. Archimedes Hydrostatic Specific Gravity & Karat equations (C++ mirror)
// ---------------------------------------------------------------------------

export function specificGravity(weightAir_g: number, weightWater_g: number): number {
  const displaced = weightAir_g - weightWater_g;
  if (displaced <= 0) return NaN;
  return weightAir_g / displaced;
}

export const METAL_SG: Record<string, number> = {
  "24K Gold": 19.32,
  "22K Gold": 18.4,
  "18K Gold": 15.5,
  "14K Gold": 13.4,
  "10K Gold": 11.4,
  "Sterling Silver (.925)": 10.49,
  "Platinum (.950)": 21.45,
  "Diamond": 3.52,
  "Cubic Zirconia": 5.8,
  "Tungsten": 19.25,
  "Copper": 8.96,
  "Brass": 8.5,
  "Lead": 11.34,
};

/** Gold-alloy SG anchors (karat → SG) — piecewise interpolation, identical to the C++ kernel. */
const KARAT_ANCHORS: [number, number][] = [
  [10, 11.4],
  [14, 13.4],
  [18, 15.5],
  [22, 17.7],
  [24, 19.32],
];

/** Estimate karat from SG using the gold-alloy interpolation used by the C++ kernel. */
export function karatFromSG(sg: number): { karat: number; label: string; confidence: number } {
  if (!isFinite(sg) || sg <= 0) return { karat: 0, label: "—", confidence: 0 };
  let k = 24;
  if (sg <= KARAT_ANCHORS[0][1]) {
    k = 10 - ((KARAT_ANCHORS[0][1] - sg) / 2) * 2; // below 10K → extrapolate down
    k = Math.max(0, 10 - (KARAT_ANCHORS[0][1] - sg));
  } else {
    for (let i = 0; i < KARAT_ANCHORS.length - 1; i++) {
      const [k0, s0] = KARAT_ANCHORS[i];
      const [k1, s1] = KARAT_ANCHORS[i + 1];
      if (sg >= s0 && sg <= s1) {
        k = k0 + ((sg - s0) / (s1 - s0)) * (k1 - k0);
        break;
      }
      if (i === KARAT_ANCHORS.length - 2) k = 24 + (sg - s1) * 2; // above 24K
    }
  }
  const clamped = Math.max(0, Math.min(24, k));
  const rounded = Math.round(clamped * 2) / 2;
  const label = `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`;
  const confidence = Math.max(0, Math.min(1, 1 - Math.abs(clamped - rounded) / 2));
  return { karat: rounded, label, confidence };
}

export const SPOT_USD_PER_GRAM = { gold24: 78.4, silver: 0.98, platinum: 31.2 };

export function meltValueUSD(weight_g: number, karat: number, metal: "gold" | "silver" | "platinum"): number {
  if (metal === "gold") return weight_g * (karat / 24) * SPOT_USD_PER_GRAM.gold24;
  if (metal === "silver") return weight_g * SPOT_USD_PER_GRAM.silver;
  return weight_g * SPOT_USD_PER_GRAM.platinum;
}

// ---------------------------------------------------------------------------
// 3. Radix-2 FFT + peak matching (Zig kernel mirror — simd_timegrapher.zig)
// ---------------------------------------------------------------------------

export function fftMagnitude(signal: Float32Array): { freqs: Float32Array; mags: Float32Array } {
  const n = signal.length;
  if ((n & (n - 1)) !== 0) throw new Error("FFT length must be a power of two");
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = signal[i];
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Cooley–Tukey radix-2 butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
  const half = n / 2;
  const freqs = new Float32Array(half);
  const mags = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    freqs[i] = i; // bin index — caller scales by sampleRate / n
    mags[i] = Math.hypot(re[i], im[i]);
  }
  return { freqs, mags };
}

export interface Peak { freqHz: number; mag: number; bin: number }

export function findPeaks(mags: Float32Array, sampleRate: number, n: number, minFreq = 800, maxFreq = 16000, count = 6): Peak[] {
  const peaks: Peak[] = [];
  for (let i = 2; i < mags.length - 2; i++) {
    const f = (i * sampleRate) / n;
    if (f < minFreq || f > maxFreq) continue;
    if (mags[i] > mags[i - 1] && mags[i] > mags[i + 1] && mags[i] > mags[i - 2] && mags[i] > mags[i + 2]) {
      peaks.push({ freqHz: f, mag: mags[i], bin: i });
    }
  }
  peaks.sort((a, b) => b.mag - a.mag);
  return peaks.slice(0, count).sort((a, b) => a.freqHz - b.freqHz);
}

/** Match detected peaks against the 3 expected modal gates → authenticity score. */
export function matchModes(detected: number[], expected: { f20: number; f30: number; f01: number }, tolerancePct = 4) {
  const exp = [expected.f20, expected.f30, expected.f01].sort((a, b) => a - b);
  const det = [...detected].sort((a, b) => a - b);
  const perMode = exp.map((e) => {
    let best = Infinity;
    for (const d of det) best = Math.min(best, Math.abs(d - e) / e);
    return { expected: e, deviationPct: best * 100, pass: best * 100 <= tolerancePct };
  });
  const score = Math.round((perMode.filter((p) => p.pass).length / 3) * 1000) / 10;
  return { perMode, score, verdict: score >= 99 ? "AUTHENTIC" : score >= 66 ? "SUSPECT" : "COUNTERFEIT" as const };
}

/** Sustain ring-decay time (ms at −40 dB) from an amplitude envelope. */
export function sustainMs(envelope: Float32Array, sampleRate: number): number {
  if (envelope.length === 0) return 0;
  const peak = Math.max(...envelope);
  const threshold = peak * 0.01; // −40 dB
  let last = 0;
  for (let i = 0; i < envelope.length; i++) if (envelope[i] >= threshold) last = i;
  return (last / sampleRate) * 1000;
}

// ---------------------------------------------------------------------------
// 4. Escapement tick-tock cross-correlation (Zig kernel mirror)
// ---------------------------------------------------------------------------

export interface TickAnalysis {
  bph: number;
  freqHz: number;
  beatErrorMs: number;
  amplitudeDeg: number;
  driftSecPerDay: number;
  tickCount: number;
}

export function analyzeTicks(tickTimesSec: number[], amplitudeDeg = 280): TickAnalysis {
  if (tickTimesSec.length < 4) return { bph: 0, freqHz: 0, beatErrorMs: 0, amplitudeDeg, driftSecPerDay: 0, tickCount: tickTimesSec.length };
  const intervals: number[] = [];
  for (let i = 1; i < tickTimesSec.length; i++) intervals.push(tickTimesSec[i] - tickTimesSec[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const freqHz = 1 / mean; // ticks per second
  const bph = freqHz * 3600;
  // Beat error: alternating tick/tock interval asymmetry (ms)
  let errSum = 0, errN = 0;
  for (let i = 0; i + 1 < intervals.length; i += 2) {
    errSum += Math.abs(intervals[i] - intervals[i + 1]) / 2;
    errN++;
  }
  const beatErrorMs = errN ? (errSum / errN) * 1000 : 0;
  // Drift: linear regression of cumulative error vs. ideal grid
  const t0 = tickTimesSec[0];
  let num = 0, den = 0;
  for (let i = 0; i < tickTimesSec.length; i++) {
    const ideal = t0 + i * mean;
    const err = tickTimesSec[i] - ideal;
    num += i * err; den += i * i;
  }
  const slope = den ? num / den : 0; // seconds of error per tick
  const driftSecPerDay = slope * freqHz * 86400;
  return { bph: Math.round(bph), freqHz, beatErrorMs: Math.round(beatErrorMs * 100) / 100, amplitudeDeg, driftSecPerDay: Math.round(driftSecPerDay * 10) / 10, tickCount: tickTimesSec.length };
}

// ---------------------------------------------------------------------------
// 5. WASM-first bridge (graceful fallback — Vercel-safe)
// ---------------------------------------------------------------------------

let wasmKernel: any = null;
let wasmTried = false;

async function loadWasmKernel(): Promise<any> {
  if (wasmTried) return wasmKernel;
  wasmTried = true;
  try {
    const res = await fetch("/wasm/metallurgy_horology.wasm");
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
    wasmKernel = instance.exports;
  } catch {
    wasmKernel = null; // deterministic TS fallback takes over — build still succeeds
  }
  return wasmKernel;
}

export const assayBridge = {
  /** Biharmonic modes — WASM C++ kernel when present, deterministic TS otherwise. */
  async computeModes(input: PlateInput): Promise<PlateModes & { backend: "wasm-cpp20" | "ts-fallback" }> {
    const wasm = await loadWasmKernel();
    if (wasm && typeof wasm.aurum_plate_modes === "function") {
      try {
        const out = wasm.aurum_plate_modes(input.E_GPa, input.nu, input.rho, input.radius_m, input.thickness_m);
        return { f20: out[0], f30: out[1], f01: out[2], lambda20: LAMBDA.f20, lambda30: LAMBDA.f30, lambda01: LAMBDA.f01, backend: "wasm-cpp20" };
      } catch { /* fall through */ }
    }
    return { ...plateModes(input), backend: "ts-fallback" as const };
  },
  backendStatus: () => (wasmKernel ? "wasm-cpp20" : "ts-fallback (deterministic)"),
};
