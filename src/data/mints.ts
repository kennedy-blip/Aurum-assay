/** World Mint Metallurgical Database + synthetic scenarios + movement simulators. */

export interface CoinSpec {
  id: string;
  name: string;
  metal: "Gold" | "Silver" | "Platinum";
  purity: string;
  weight_g: number;
  diameter_mm: number;
  thickness_mm: number;
  E_GPa: number;
  nu: number;
  rho: number;
  modes: { f20: number; f30: number; f01: number };
  sustain_ms: number;
  melt_usd: number;
  note: string;
}

export const COINS: CoinSpec[] = [
  { id: "ase", name: "1 oz American Silver Eagle", metal: "Silver", purity: ".999 Fine", weight_g: 31.103, diameter_mm: 40.6, thickness_mm: 2.98, E_GPa: 82.7, nu: 0.37, rho: 10490, modes: { f20: 3995, f30: 8920, f01: 11040 }, sustain_ms: 2150, melt_usd: 30.49, note: "40.60 × 2.98 mm mint tolerance" },
  { id: "age", name: "1 oz American Gold Eagle (22K)", metal: "Gold", purity: "22K Crown", weight_g: 33.931, diameter_mm: 32.7, thickness_mm: 2.87, E_GPa: 79, nu: 0.42, rho: 19320, modes: { f20: 3520, f30: 7910, f01: 9850 }, sustain_ms: 1680, melt_usd: 2437, note: "33.93 g total, 31.10 g fine" },
  { id: "maple", name: "1 oz Canadian Gold Maple Leaf (.9999)", metal: "Gold", purity: ".9999 Fine", weight_g: 31.103, diameter_mm: 30, thickness_mm: 2.87, E_GPa: 79, nu: 0.42, rho: 19320, modes: { f20: 3610, f30: 8120, f01: 10120 }, sustain_ms: 1740, melt_usd: 2437, note: "Radial-line security feature" },
  { id: "krug", name: "1 oz South African Krugerrand", metal: "Gold", purity: "22K Crown", weight_g: 33.931, diameter_mm: 32.77, thickness_mm: 2.84, E_GPa: 79, nu: 0.42, rho: 19320, modes: { f20: 3520, f30: 7910, f01: 9850 }, sustain_ms: 1620, melt_usd: 2437, note: "First modern gold bullion coin (1967)" },
  { id: "morgan", name: "1878–1921 Morgan Silver Dollar", metal: "Silver", purity: ".900 Coin Silver", weight_g: 26.73, diameter_mm: 38.1, thickness_mm: 3.1, E_GPa: 82.7, nu: 0.37, rho: 10490, modes: { f20: 3640, f30: 8150, f01: 10080 }, sustain_ms: 1980, melt_usd: 26.2, note: "0.7734 ozt fine silver" },
  { id: "sov", name: "British Gold Sovereign", metal: "Gold", purity: "22K Crown", weight_g: 7.988, diameter_mm: 22.05, thickness_mm: 1.52, E_GPa: 79, nu: 0.42, rho: 19320, modes: { f20: 5480, f30: 12100, f01: 14900 }, sustain_ms: 940, melt_usd: 573.5, note: "7.32 g fine gold" },
  { id: "peagle", name: "1 oz Platinum Eagle", metal: "Platinum", purity: ".9995 Fine", weight_g: 31.103, diameter_mm: 32.7, thickness_mm: 2.87, E_GPa: 168, nu: 0.39, rho: 21450, modes: { f20: 4410, f30: 9890, f01: 12310 }, sustain_ms: 1870, melt_usd: 969, note: "Non-magnetic, high E modulus" },
  { id: "custom", name: "Custom Dimensions", metal: "Gold", purity: "Custom", weight_g: 31.103, diameter_mm: 30, thickness_mm: 2.87, E_GPa: 79, nu: 0.42, rho: 19320, modes: { f20: 3610, f30: 8120, f01: 10120 }, sustain_ms: 1740, melt_usd: 2437, note: "Model E / ν / ρ freely (Pro)" },
];

export interface PingScenario {
  id: string;
  title: string;
  subtitle: string;
  freqs: number[];
  sustain_ms: number;
  verdict: "AUTHENTIC" | "COUNTERFEIT";
  score: number;
  explanation: string;
  targetCoinId: string;
}

export const PING_SCENARIOS: PingScenario[] = [
  {
    id: "genuine-ase",
    title: "Genuine 1 oz American Silver Eagle",
    subtitle: "f₁ 3,995 Hz · f₂ 8,920 Hz · f₃ 11,040 Hz · Sustain 2,150 ms",
    freqs: [3995, 8920, 11040],
    sustain_ms: 2150,
    verdict: "AUTHENTIC",
    score: 99.8,
    explanation: "All three biharmonic modes sit inside the ±4% mint gate and the long silver ring-decay matches .999 fine silver (E = 82.7 GPa).",
    targetCoinId: "ase",
  },
  {
    id: "fake-cuni",
    title: "Counterfeit Copper-Nickel Clad Fake",
    subtitle: "f₁ 4,480 Hz shifted · Short 520 ms dead ring",
    freqs: [4480, 9980, 12410],
    sustain_ms: 520,
    verdict: "COUNTERFEIT",
    score: 31.4,
    explanation: "CuNi core raises effective Young's modulus (E ≈ 200 GPa): f₁ is shifted +12% and the ring dies in 520 ms — a dead, glassy thunk instead of a silver chime.",
    targetCoinId: "ase",
  },
  {
    id: "genuine-krug",
    title: "Genuine 1 oz Gold Krugerrand",
    subtitle: "f₁ 3,520 Hz · f₂ 7,910 Hz · f₃ 9,850 Hz · 22K crown gold",
    freqs: [3520, 7910, 9850],
    sustain_ms: 1620,
    verdict: "AUTHENTIC",
    score: 99.1,
    explanation: "22K crown-gold alloy (E = 79 GPa, ρ = 19,320 kg/m³) reproduces the exact modal triplet and warm 1.6 s decay.",
    targetCoinId: "krug",
  },
  {
    id: "tungsten",
    title: "Tungsten-Core Gold-Plated Scam",
    subtitle: "Weight matches gold · E = 411 GPa shifts f₁ to 5,640 Hz",
    freqs: [5640, 12650, 15720],
    sustain_ms: 610,
    verdict: "COUNTERFEIT",
    score: 12.7,
    explanation: "Tungsten matches gold's density (19.25 g/cm³) so weight & SG pass — but E = 411 GPa drives f₁ to 5,640 Hz, +60% off the gold gate. TUNGSTEN CORE DETECTED.",
    targetCoinId: "maple",
  },
];

export interface Movement {
  id: string;
  name: string;
  caliber: string;
  bph: number;
  freqHz: number;
  drift: number;
  beatErrorMs: number;
  amplitudeDeg: number;
  verdict: string;
  verdictClass: "ok" | "warn" | "bad";
  note: string;
}

export const MOVEMENTS: Movement[] = [
  { id: "rolex", name: "Swiss Chronometer", caliber: "Rolex / Omega · 28,800 BPH · 4 Hz", bph: 28800, freqHz: 4, drift: 1.2, beatErrorMs: 0.1, amplitudeDeg: 294, verdict: "COSC CERTIFIED", verdictClass: "ok", note: "Free-sprung balance, silicon hairspring." },
  { id: "seiko", name: "Japanese Workhorse", caliber: "Seiko NH35 · 21,600 BPH · 3 Hz", bph: 21600, freqHz: 3, drift: -6.5, beatErrorMs: 0.4, amplitudeDeg: 262, verdict: "HEALTHY", verdictClass: "ok", note: "Hacking seconds, hand-wind crown." },
  { id: "elprimero", name: "High-Beat Chronograph", caliber: "El Primero / Grand Seiko · 36,000 BPH · 5 Hz", bph: 36000, freqHz: 5, drift: 0.5, beatErrorMs: 0.2, amplitudeDeg: 288, verdict: "HIGH-BEAT CERTIFIED", verdictClass: "ok", note: "Pro tier: co-axial lift-angle calibration." },
  { id: "replica", name: "Counterfeit 'Replica' / Magnetized", caliber: "Claims 28,800 BPH on dial · ticks at 21,600 BPH", bph: 21600, freqHz: 3, drift: 48, beatErrorMs: 2.8, amplitudeDeg: 198, verdict: "FAKE / MAGNETIZED ALERT", verdictClass: "bad", note: "Clone 21,600 BPH movement + magnetized hairspring: +48 s/day drift, 2.8 ms beat error." },
];

export interface SGPreset {
  id: string;
  name: string;
  wAir: number;
  wWater: number;
  metal: "gold" | "silver" | "platinum";
  expect: string;
}

export const SG_PRESETS: SGPreset[] = [
  { id: "ring18", name: "18K Gold Ring", wAir: 5.2, wWater: 4.865, metal: "gold", expect: "SG ≈ 15.5 → 18K" },
  { id: "chain", name: "Sterling Silver Chain", wAir: 12.4, wWater: 11.22, metal: "silver", expect: "SG ≈ 10.5 → .925" },
  { id: "band", name: "Platinum Band", wAir: 8.1, wWater: 7.72, metal: "platinum", expect: "SG ≈ 21.3 → Pt950" },
  { id: "diamond", name: "1.5 ct Diamond", wAir: 0.3, wWater: 0.215, metal: "gold", expect: "SG ≈ 3.53 → diamond" },
  { id: "cz", name: "Cubic Zirconia", wAir: 0.3, wWater: 0.248, metal: "gold", expect: "SG ≈ 5.77 → CZ" },
  { id: "brass", name: "Brass Fake", wAir: 9.6, wWater: 8.47, metal: "gold", expect: "SG ≈ 8.5 → brass" },
];

export const SQL_PRESETS: { label: string; sql: string }[] = [
  { label: "Authentic ledger, richest first", sql: "SELECT item_name, purity_karat, weight_g, melt_value_usd, verdict FROM assay_ledger WHERE verdict = 'AUTHENTIC' ORDER BY melt_value_usd DESC;" },
  { label: "Mint database by metal", sql: "SELECT metal, COUNT(*) AS n, AVG(melt_value_usd) AS avg_melt FROM bullion_specs GROUP BY metal;" },
  { label: "Total portfolio melt value", sql: "SELECT SUM(melt_value_usd) AS total_melt, COUNT(*) AS items FROM assay_ledger;" },
  { label: "Ledger ⨝ mint modal join", sql: "SELECT item_name, f20_hz, f30_hz, f01_hz FROM assay_ledger JOIN bullion_specs ON item_name = item_name WHERE verdict = 'AUTHENTIC';" },
  { label: "Horology log — worst drift", sql: "SELECT movement, bph, drift_s_day, beat_error_ms, verdict FROM horology_logs ORDER BY drift_s_day DESC;" },
  { label: "All bullion specs", sql: "SELECT item_name, metal, purity_karat, weight_g, f20_hz, sustain_ms FROM bullion_specs ORDER BY melt_value_usd DESC LIMIT 10;" },
];

export const POLYGLOT_FILES: { name: string; lang: string; path: string }[] = [
  { name: "metallurgy_horology.cpp", lang: "C++20", path: "cpp-kernel/metallurgy_horology.cpp" },
  { name: "native-assay.cpp", lang: "C++20 · JNI", path: "android/app/src/main/cpp/native-assay.cpp" },
  { name: "simd_timegrapher.zig", lang: "Zig 0.13", path: "zig-dsp/src/simd_timegrapher.zig" },
  { name: "assay_schema.sql", lang: "Declarative SQL", path: "src/db/assay_schema.sql" },
  { name: "metallic_dispersion.glsl", lang: "GLSL ES 3.0", path: "src/shaders/metallic_dispersion.glsl" },
  { name: "polyglotAssayBridge.ts", lang: "TypeScript · WASM bridge", path: "src/wasm/polyglotAssayBridge.ts" },
];
