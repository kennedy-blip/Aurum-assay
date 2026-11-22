import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { COINS, PING_SCENARIOS, type CoinSpec, type PingScenario } from "../data/mints";
import { assayBridge, customAlloyModes, fftMagnitude, findPeaks, matchModes, plateModes, sustainMs } from "../wasm/polyglotAssayBridge";
import { getMicAnalyser, haptic, playPing, stopStream } from "../services/audio";
import { insertLedger } from "../services/sqlEngine";
import { createSpring } from "../primitives/createSpring";

interface Props {
  role: string;
  onVerdict: (v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT", score: number) => void;
  onOpenCertificate: (data: any) => void;
}

export default function AcousticPingLab(props: Props) {
  const [coinId, setCoinId] = createSignal("ase");
  const [scenario, setScenario] = createSignal<PingScenario | null>(null);
  const [detected, setDetected] = createSignal<number[]>([]);
  const [sustain, setSustain] = createSignal(0);
  const [result, setResult] = createSignal<ReturnType<typeof matchModes> | null>(null);
  const [micOn, setMicOn] = createSignal(false);
  const [micError, setMicError] = createSignal("");
  const [custom, setCustom] = createSignal({ E: 79, nu: 0.42, rho: 19320, d: 30, t: 2.87 });
  const [backend, setBackend] = createSignal("ts-fallback");
  const [saved, setSaved] = createSignal(false);

  const coin = createMemo<CoinSpec>(() => COINS.find((c) => c.id === coinId()) ?? COINS[0]);

  // Predicted modes from the C++20 biharmonic kernel (WASM when available).
  const predicted = createMemo(() => {
    const c = coin();
    if (c.id === "custom") {
      const u = custom();
      return customAlloyModes(u.E, u.nu, u.rho, u.d, u.t);
    }
    return plateModes({ E_GPa: c.E_GPa, nu: c.nu, rho: c.rho, radius_m: c.diameter_mm / 2000, thickness_m: c.thickness_mm / 1000 });
  });

  createEffect(() => {
    assayBridge.computeModes({ E_GPa: coin().E_GPa, nu: coin().nu, rho: coin().rho, radius_m: coin().diameter_mm / 2000, thickness_m: coin().thickness_mm / 1000 })
      .then((r) => setBackend(r.backend));
  });

  // Spring-driven resonance ring (visual ping pulse)
  const ring = createSpring(0, { stiffness: 320, damping: 25, mass: 0.8 });
  const ringScale = createMemo(() => 1 + ring.value() * 0.6);

  let canvas: HTMLCanvasElement | undefined;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  let envelope: number[] = [];
  let peakHold: { freq: number; mag: number }[] = [];

  const evaluate = (freqs: number[], sustainMsVal: number) => {
    const exp = { f20: coin().modes.f20, f30: coin().modes.f30, f01: coin().modes.f01 };
    const m = matchModes(freqs, exp);
    setDetected(freqs);
    setSustain(Math.round(sustainMsVal));
    setResult(m);
    props.onVerdict(m.verdict, m.score);
    ring.kick(1);
    haptic([22, 40, 22]);
  };

  const runScenario = (s: PingScenario) => {
    setScenario(s);
    setCoinId(s.targetCoinId);
    playPing(s.freqs, s.sustain_ms);
    // Feed the synthesized spectrum through the real FFT peak matcher.
    const N = 8192;
    const sr = 48000;
    const sig = new Float32Array(N);
    const tau = Math.max(s.sustain_ms / 1000 / 4.6, 0.05);
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const env = Math.exp(-t / tau);
      sig[i] = env * (0.5 * Math.sin(2 * Math.PI * s.freqs[0] * t) + 0.3 * Math.sin(2 * Math.PI * s.freqs[1] * t) + 0.18 * Math.sin(2 * Math.PI * s.freqs[2] * t));
    }
    const { mags } = fftMagnitude(sig);
    const peaks = findPeaks(mags, sr, N, 2000, 16000, 6);
    const envArr = new Float32Array(N);
    for (let i = 0; i < N; i++) envArr[i] = Math.abs(sig[i]);
    const sus = sustainMs(envArr, sr);
    evaluate(peaks.map((p) => p.freqHz), sus);
  };

  const toggleMic = async () => {
    if (micOn()) {
      setMicOn(false);
      cancelAnimationFrame(raf);
      if (stream) stopStream(stream);
      stream = null;
      return;
    }
    try {
      setMicError("");
      const mic = await getMicAnalyser();
      stream = mic.stream;
      analyser = mic.analyser;
      setMicOn(true);
      const N = analyser.fftSize;
      const buf = new Float32Array(N);
      envelope = [];
      peakHold = [];
      const loop = () => {
        raf = requestAnimationFrame(loop);
        analyser!.getFloatTimeDomainData(buf);
        // Envelope for sustain measurement
        let peak = 0;
        for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
        envelope.push(peak);
        if (envelope.length > 48000) envelope.shift();
        // FFT peak detection on a snapshot
        const { mags } = fftMagnitude(buf.slice(0, 8192));
        const peaks = findPeaks(mags, 48000, 8192, 2000, 16000, 6);
        peakHold = peaks.map((p) => ({ freq: p.freqHz, mag: p.mag }));
        drawSpectrum(mags);
        // Auto-evaluate when a strong transient is detected
        if (peak > 0.25 && peaks.length >= 2) {
          const sus = sustainMs(new Float32Array(envelope), 48000);
          evaluate(peaks.map((p) => p.freqHz), sus);
          envelope = [];
        }
      };
      loop();
    } catch (e: any) {
      setMicError("Microphone unavailable — use the 1-tap synthetic ping generator instead. (" + (e?.name ?? "error") + ")");
    }
  };

  const drawSpectrum = (mags: Float32Array) => {
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    const maxMag = Math.max(...mags) || 1;
    const grad = g.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, "rgba(245,158,11,0.15)");
    grad.addColorStop(1, "rgba(245,158,11,0.9)");
    g.fillStyle = grad;
    const bins = 220;
    for (let i = 0; i < bins; i++) {
      const idx = Math.floor((i / bins) * mags.length * 0.35); // 0–16.8 kHz window
      const h = (mags[idx] / maxMag) * H * 0.92;
      g.fillRect((i / bins) * W, H - h, W / bins - 1, h);
    }
    // Modal target gates
    const gt = gates();
    const gatesArr = [gt.f20, gt.f30, gt.f01];
    g.strokeStyle = "rgba(16,185,129,0.9)";
    g.lineWidth = 2;
    for (const f of gates) {
      const x = (f / 16800) * W;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    // Detected peaks
    g.fillStyle = "#38BDF8";
    for (const p of peakHold) {
      const x = (p.freq / 16800) * W;
      g.beginPath(); g.arc(x, 10, 4, 0, Math.PI * 2); g.fill();
    }
  };

  onCleanup(() => {
    cancelAnimationFrame(raf);
    if (stream) stopStream(stream);
  });

  const saveToLedger = async () => {
    const r = result();
    if (!r) return;
    await insertLedger({
      item_name: coin().name,
      purity_karat: coin().metal === "Gold" ? (coin().purity.includes("22") ? 22 : 24) : coin().metal === "Silver" ? 24 : 24,
      weight_g: coin().weight_g,
      melt_value_usd: coin().melt_usd,
      verdict: r.verdict,
      score_pct: r.score,
      module: "acoustic",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const verdictColor = () => {
    const v = result()?.verdict;
    return v === "AUTHENTIC" ? "text-emerald-400 border-emerald-400/50" : v === "COUNTERFEIT" ? "text-red-400 border-red-400/50" : "text-amber-300 border-amber-300/50";
  };

  return (
    <div class="grid gap-5 lg:grid-cols-5">
      {/* Left: target selection + synthetic generator */}
      <div class="glass glass-hover rise p-5 lg:col-span-2">
        <h3 class="font-display text-lg font-bold tracking-wide">World Mint Database</h3>
        <p class="text-dim mt-1 text-xs">10+ iconic coins & bars · seeded from <span class="font-mono2">assay_schema.sql</span></p>
        <div class="mt-4 grid gap-2">
          {COINS.map((c) => (
            <button
              class={`btn-ghost flex items-center justify-between px-3 py-2 text-left text-sm ${coinId() === c.id ? "border-amber-400/70 bg-amber-400/10" : ""}`}
              onClick={() => { setCoinId(c.id); setScenario(null); setResult(null); }}
            >
              <span>{c.name}</span>
              <span class="badge">{c.metal}</span>
            </button>
          ))}
        </div>

        <Show when={coin().id === "custom"}>
          <div class="mt-4 rounded-xl border border-white/10 p-3">
            <p class="text-xs font-semibold">Custom Alloy Biharmonic Modeler {props.role !== "collector" && <span class="badge ml-1">PRO</span>}</p>
            <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
              <label>E (GPa)<input type="number" class="mt-1 w-full" value={custom().E} onInput={(e) => setCustom({ ...custom(), E: +e.currentTarget.value })} /></label>
              <label>ν Poisson<input type="number" step="0.01" class="mt-1 w-full" value={custom().nu} onInput={(e) => setCustom({ ...custom(), nu: +e.currentTarget.value })} /></label>
              <label>ρ (kg/m³)<input type="number" class="mt-1 w-full" value={custom().rho} onInput={(e) => setCustom({ ...custom(), rho: +e.currentTarget.value })} /></label>
              <label>Ø (mm)<input type="number" step="0.1" class="mt-1 w-full" value={custom().d} onInput={(e) => setCustom({ ...custom(), d: +e.currentTarget.value })} /></label>
              <label>Thickness (mm)<input type="number" step="0.01" class="mt-1 w-full" value={custom().t} onInput={(e) => setCustom({ ...custom(), t: +e.currentTarget.value })} /></label>
            </div>
          </div>
        </Show>

        <div class="mt-5">
          <p class="text-xs font-semibold tracking-wider text-dim">1-TAP SYNTHETIC METALLURGICAL PING GENERATOR</p>
          <div class="mt-2 grid gap-2">
            {PING_SCENARIOS.map((s) => (
              <button class="btn-ghost px-3 py-2 text-left" onClick={() => runScenario(s)}>
                <div class="flex items-center justify-between text-sm">
                  <span class="font-semibold">{s.title}</span>
                  <span class={`badge ${s.verdict === "AUTHENTIC" ? "text-emerald-400" : "text-red-400"}`}>{s.score}%</span>
                </div>
                <div class="text-dim mt-0.5 text-xs">{s.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: spectral waterfall + modal gates + verdict */}
      <div class="glass rise p-5 lg:col-span-3" style={{ "animation-delay": "80ms" }}>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-display text-lg font-bold tracking-wide">{coin().name}</h3>
            <p class="text-dim text-xs">
              {coin().purity} · {coin().weight_g} g · Ø{coin().diameter_mm} × {coin().thickness_mm} mm · E {coin().E_GPa} GPa · ν {coin().nu} · ρ {coin().rho} kg/m³
            </p>
            <p class="text-dim mt-0.5 text-[11px]">C++20 kernel backend: <span class="font-mono2 accent">{backend()}</span> · {coin().note}</p>
          </div>
          <button class={`btn-gold px-4 py-2 text-sm ${micOn() ? "animate-pulse" : ""}`} onClick={toggleMic}>
            {micOn() ? "■ Stop Mic" : "🎙 Live Mic Ping"}
          </button>
        </div>
        <Show when={micError()}><p class="mt-2 text-xs text-red-300">{micError()}</p></Show>

        <div class="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <canvas ref={canvas} width={900} height={260} class="h-56 w-full" />
          {/* Spring resonance ring */}
          <div
            class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400/70"
            style={{ width: "120px", height: "120px", transform: `translate(-50%,-50%) scale(${ringScale()})`, opacity: Math.max(0, 1 - ring.value()) }}
          />
          <div class="absolute bottom-2 left-3 font-mono2 text-[10px] text-white/50">2 kHz ——— 16 kHz · green = mint modal gates · blue = detected peaks</div>
        </div>

        {/* Modal gate readouts */}
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { label: "f(2,0) Radial", exp: coin().modes.f20 },
            { label: "f(3,0) Flexural", exp: coin().modes.f30 },
            { label: "f(0,1) Axisym.", exp: coin().modes.f01 },
          ].map((m, i) => {
            const r = result()?.perMode[i];
            return (
              <div class="rounded-xl border border-white/10 bg-black/30 p-3">
                <div class="text-[11px] tracking-wider text-dim">{m.label}</div>
                <div class="font-mono2 mt-1 text-lg">{Math.round(m.exp)} Hz</div>
                <div class={`font-mono2 text-xs ${r ? (r.pass ? "text-emerald-400" : "text-red-400") : "text-dim"}`}>
                  {r ? `Δ ${r.deviationPct.toFixed(2)}% ${r.pass ? "✓" : "✗"}` : "awaiting ping"}
                </div>
              </div>
            );
          })}
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <div class={`rounded-xl border px-4 py-2 font-mono2 text-sm ${result() ? verdictColor() : "text-dim border-white/10"}`}>
            {result() ? `${result()!.verdict} · ${result()!.score}% MATCH` : "NO VERDICT YET"}
          </div>
          <div class="font-mono2 text-xs text-dim">Sustain: <span class="text-white">{sustain() ? sustain() + " ms" : "—"}</span> (target {coin().sustain_ms} ms)</div>
          <div class="ml-auto flex gap-2">
            <button class="btn-ghost px-3 py-2 text-xs" disabled={!result()} onClick={saveToLedger}>{saved() ? "✓ Saved" : "Save to Ledger"}</button>
            <button
              class="btn-ghost px-3 py-2 text-xs"
              disabled={!result()}
              onClick={() => props.onOpenCertificate({ type: "acoustic", coin: coin(), result: result(), sustain: sustain() })}
            >
              Forensic Certificate
            </button>
          </div>
        </div>
        <Show when={scenario()}>
          <p class="text-dim mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-relaxed">{scenario()!.explanation}</p>
        </Show>
      </div>
    </div>
  );
}
