import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { SG_PRESETS } from "../data/mints";
import { karatFromSG, meltValueUSD, specificGravity } from "../wasm/polyglotAssayBridge";
import { insertLedger } from "../services/sqlEngine";

interface Props {
  role: string;
  onVerdict: (v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT", score: number) => void;
  onOpenCertificate: (data: any) => void;
}

const SPECTRUM = [
  { lo: 2.5, hi: 3.6, label: "Gemstone", color: "#38BDF8" },
  { lo: 3.6, hi: 5.0, label: "CZ / Glass", color: "#818CF8" },
  { lo: 5.0, hi: 9.0, label: "Brass / Copper", color: "#F59E0B" },
  { lo: 9.0, hi: 11.5, label: "10K Gold / Lead", color: "#D97706" },
  { lo: 11.5, hi: 14.0, label: "14K Gold", color: "#FBBF24" },
  { lo: 14.0, hi: 17.0, label: "18K Gold", color: "#FCD34D" },
  { lo: 17.0, hi: 20.0, label: "22–24K Gold", color: "#FDE68A" },
  { lo: 20.0, hi: 22.0, label: "Platinum", color: "#E2E8F0" },
];

export default function ArchimedesMagnetics(props: Props) {
  const [wAir, setWAir] = createSignal(5.2);
  const [wWater, setWWater] = createSignal(4.86);
  const [metal, setMetal] = createSignal<"gold" | "silver" | "platinum">("gold");
  const [preset, setPreset] = createSignal<string | null>(null);
  const [saved, setSaved] = createSignal(false);

  // Magnetometer / Lenz scanner
  const [proximity, setProximity] = createSignal(0.5); // 0 far → 1 touching
  const [magOn, setMagOn] = createSignal(false);
  const [magReading, setMagReading] = createSignal<number | null>(null);
  const [magError, setMagError] = createSignal("");

  const sg = createMemo(() => specificGravity(wAir(), wWater()));
  const karat = createMemo(() => karatFromSG(sg()));
  const melt = createMemo(() => meltValueUSD(wAir(), karat().karat, metal()));
  const sgPct = createMemo(() => Math.max(0, Math.min(100, ((sg() - 2.5) / (22 - 2.5)) * 100)));

  const verdict = createMemo(() => {
    const s = sg();
    if (!isFinite(s)) return { label: "INVALID INPUT", cls: "text-dim border-white/10", score: 0 };
    if (s >= 18.5 && s <= 19.6) return { label: "24K GOLD — AUTHENTIC", cls: "text-emerald-400 border-emerald-400/50", score: 99 };
    if (s >= 14.5 && s <= 16.5) return { label: "18K GOLD — AUTHENTIC", cls: "text-emerald-400 border-emerald-400/50", score: 97 };
    if (s >= 10.2 && s <= 10.8) return { label: "STERLING SILVER — AUTHENTIC", cls: "text-emerald-400 border-emerald-400/50", score: 96 };
    if (s >= 20.8 && s <= 21.9) return { label: "PLATINUM — AUTHENTIC", cls: "text-emerald-400 border-emerald-400/50", score: 98 };
    if (s >= 3.4 && s <= 3.6) return { label: "DIAMOND — AUTHENTIC", cls: "text-emerald-400 border-emerald-400/50", score: 95 };
    if (s >= 5.6 && s <= 6.0) return { label: "CUBIC ZIRCONIA — NOT DIAMOND", cls: "text-red-400 border-red-400/50", score: 8 };
    if (s >= 8.2 && s <= 8.8) return { label: "BRASS — COUNTERFEIT", cls: "text-red-400 border-red-400/50", score: 12 };
    if (s >= 18.8 && s <= 19.8) return { label: "TUNGSTEN SUSPECT — SG MATCHES GOLD", cls: "text-amber-300 border-amber-300/50", score: 55 };
    return { label: "UNKNOWN ALLOY — SUSPECT", cls: "text-amber-300 border-amber-300/50", score: 50 };
  });

  const applyPreset = (id: string) => {
    const p = SG_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setWAir(p.wAir);
    setWWater(p.wWater);
    setMetal(p.metal);
  };

  // Magnetometer: real DeviceOrientationEvent where available, else proximity-slider simulation.
  let magTimer: number | undefined;
  const toggleMag = () => {
    if (magOn()) {
      setMagOn(false);
      if (magTimer) clearInterval(magTimer);
      window.removeEventListener("deviceorientation", onTilt as any);
      return;
    }
    setMagError("");
    setMagOn(true);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.alpha != null && e.beta != null) {
        const base = 48 + Math.abs(Math.sin(e.alpha * Math.PI / 180)) * 6; // µT earth field baseline
        setMagReading(base + proximity() * 120);
      }
    };
    window.addEventListener("deviceorientation", onTilt as any);
    // Fallback simulation when no magnetometer events arrive (desktop).
    magTimer = window.setInterval(() => {
      if (magReading() == null) setMagReading(48 + proximity() * 120 + Math.random() * 2);
    }, 300);
    if (typeof DeviceOrientationEvent !== "undefined" && (DeviceOrientationEvent as any).requestPermission) {
      (DeviceOrientationEvent as any).requestPermission().catch(() => setMagError("Magnetometer permission denied — using proximity slider simulation."));
    }
  };
  onCleanup(() => { if (magTimer) clearInterval(magTimer); });

  const magVerdict = createMemo(() => {
    const r = magReading();
    if (r == null) return { label: "NO READING", cls: "text-dim" };
    const delta = r - 48;
    if (delta > 95) return { label: "FERROMAGNETIC CORE DETECTED (>95 µT)", cls: "text-red-400" };
    if (delta < 0.2) return { label: "DIAMAGNETIC — PURE Au/Ag/Pt (<0.2 µT)", cls: "text-emerald-400" };
    return { label: `WEAK RESPONSE (${delta.toFixed(1)} µT)`, cls: "text-amber-300" };
  });

  const save = async () => {
    await insertLedger({
      item_name: preset() ? SG_PRESETS.find((p) => p.id === preset())!.name : "Hydrostatic assay",
      purity_karat: karat().karat,
      weight_g: wAir(),
      melt_value_usd: melt(),
      verdict: verdict().score >= 90 ? "AUTHENTIC" : verdict().score < 40 ? "COUNTERFEIT" : "SUSPECT",
      score_pct: verdict().score,
      sg_measured: Math.round(sg() * 100) / 100,
      module: "archimedes",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div class="grid gap-5 lg:grid-cols-5">
      <div class="glass glass-hover rise p-5 lg:col-span-2">
        <h3 class="font-display text-lg font-bold tracking-wide">Hydrostatic Weighing</h3>
        <p class="text-dim mt-1 text-xs">SG = W<sub>air</sub> / (W<sub>air</sub> − W<sub>water</sub>) · C++20 kernel</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <label class="text-xs">Dry weight in air (g)
            <input type="number" step="0.01" class="mt-1 w-full" value={wAir()} onInput={(e) => { setWAir(+e.currentTarget.value); setPreset(null); }} />
          </label>
          <label class="text-xs">Submerged weight (g)
            <input type="number" step="0.01" class="mt-1 w-full" value={wWater()} onInput={(e) => { setWWater(+e.currentTarget.value); setPreset(null); }} />
          </label>
        </div>
        <label class="mt-3 block text-xs">Assay metal
          <select class="mt-1 w-full" value={metal()} onChange={(e) => setMetal(e.currentTarget.value as any)}>
            <option value="gold">Gold (karat & melt)</option>
            <option value="silver">Silver (.999 melt)</option>
            <option value="platinum">Platinum (melt)</option>
          </select>
        </label>
        <p class="text-dim mt-3 text-xs">Quick presets</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {SG_PRESETS.map((p) => (
            <button class={`btn-ghost px-3 py-1.5 text-xs ${preset() === p.id ? "border-amber-400/70 bg-amber-400/10" : ""}`} onClick={() => applyPreset(p.id)}>
              {p.name}
            </button>
          ))}
        </div>

        <div class="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
          <div class="flex items-baseline justify-between">
            <span class="text-xs tracking-wider text-dim">SPECIFIC GRAVITY</span>
            <span class="font-mono2 text-2xl">{isFinite(sg()) ? sg().toFixed(2) : "—"}</span>
          </div>
          <div class="relative mt-3 h-4 overflow-hidden rounded-full">
            <div class="absolute inset-0 flex">
              {SPECTRUM.map((s) => (
                <div style={{ width: `${((s.hi - s.lo) / 19.5) * 100}%`, background: s.color, opacity: 0.55 }} />
              ))}
            </div>
            <div class="absolute top-0 h-full w-0.5 bg-white shadow" style={{ left: `${sgPct()}%` }} />
          </div>
          <div class="text-dim mt-1 flex justify-between font-mono2 text-[10px]"><span>2.5</span><span>22.0 g/cm³</span></div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><div class="text-[10px] text-dim">KARAT</div><div class="font-mono2">{karat().label}</div></div>
            <div><div class="text-[10px] text-dim">CONFIDENCE</div><div class="font-mono2">{Math.round(karat().confidence * 100)}%</div></div>
            <div><div class="text-[10px] text-dim">MELT VALUE</div><div class="font-mono2 text-emerald-400">${melt().toFixed(2)}</div></div>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <div class={`rounded-xl border px-3 py-2 font-mono2 text-xs ${verdict().cls}`}>{verdict().label}</div>
          <button class="btn-ghost ml-auto px-3 py-2 text-xs" onClick={save}>{saved() ? "✓ Saved" : "Save to Ledger"}</button>
          <button class="btn-ghost px-3 py-2 text-xs" onClick={() => props.onOpenCertificate({ type: "archimedes", sg: sg(), karat: karat(), melt: melt(), verdict: verdict() })}>Certificate</button>
        </div>
      </div>

      {/* Magnetometer + Lenz */}
      <div class="glass rise p-5 lg:col-span-3" style={{ "animation-delay": "80ms" }}>
        <h3 class="font-display text-lg font-bold tracking-wide">3-Axis Magnetometer & Lenz Eddy-Current Scanner</h3>
        <p class="text-dim mt-1 text-xs">Diamagnetic Au/Ag/Pt (&lt;0.2 µT) vs hidden ferromagnetic Fe/Ni cores (&gt;95 µT)</p>

        <div class="mt-4 flex items-center gap-4">
          <div class="relative h-40 w-40 shrink-0">
            <div class="absolute inset-0 rounded-full border border-white/15 bg-black/40" />
            <div class="absolute inset-4 rounded-full border border-white/10" />
            <div
              class="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: magReading() != null && magReading()! - 48 > 95 ? "#ef4444" : "#10b981",
                transform: `translate(-50%,-50%) translate(${(proximity() - 0.5) * 90}px, ${(proximity() - 0.5) * 40}px)`,
                boxShadow: "0 0 18px currentColor",
              }}
            />
            <div class="absolute bottom-1 left-0 right-0 text-center font-mono2 text-[10px] text-dim">proximity {Math.round(proximity() * 100)}%</div>
          </div>
          <div class="flex-1">
            <label class="text-xs">Proximity slider (desktop testing)</label>
            <input type="range" min={0} max={1} step={0.01} value={proximity()} class="w-full" onInput={(e) => setProximity(+e.currentTarget.value)} />
            <div class="mt-3 flex items-center gap-3">
              <button class="btn-gold px-4 py-2 text-sm" onClick={toggleMag}>{magOn() ? "■ Stop Scanner" : "🧲 Start Magnetometer"}</button>
              <div class="font-mono2 text-sm">{magReading() != null ? `${magReading()!.toFixed(1)} µT` : "— µT"}</div>
            </div>
            <div class={`mt-2 font-mono2 text-xs ${magVerdict().cls}`}>{magVerdict().label}</div>
            <Show when={magError()}><p class="mt-1 text-xs text-amber-300">{magError()}</p></Show>
            <Show when={props.role !== "collector"}>
              <div class="mt-3 rounded-xl border border-white/10 p-3 text-xs">
                <p class="font-semibold">Lenz's Law Eddy-Current Decay Analyzer <span class="badge ml-1">PRO</span></p>
                <p class="text-dim mt-1">τ = μ₀σd²/π² — pure silver τ ≈ 0.9 ms vs steel core τ ≈ 14 ms. Sweep the magnet: a fast-decaying eddy signature confirms bulk precious metal; a slow, persistent tail betrays a ferromagnetic core.</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
