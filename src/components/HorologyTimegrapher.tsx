import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { MOVEMENTS, type Movement } from "../data/mints";
import { analyzeTicks } from "../wasm/polyglotAssayBridge";
import { getMicAnalyser, haptic, playTick, stopStream } from "../services/audio";
import { insertHorology } from "../services/sqlEngine";
import { createSpring } from "../primitives/createSpring";

interface Props {
  role: string;
  onVerdict: (v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT", score: number) => void;
  onOpenCertificate: (data: any) => void;
}

export default function HorologyTimegrapher(props: Props) {
  const [movement, setMovement] = createSignal<Movement>(MOVEMENTS[0]);
  const [running, setRunning] = createSignal(false);
  const [tickTimes, setTickTimes] = createSignal<number[]>([]);
  const [micOn, setMicOn] = createSignal(false);
  const [micError, setMicError] = createSignal("");
  const [saved, setSaved] = createSignal(false);
  const [liftAngle, setLiftAngle] = createSignal(52);

  const analysis = createMemo(() => {
    const times = tickTimes();
    if (times.length < 4) return null;
    return analyzeTicks(times, movement().amplitudeDeg);
  });

  // Balance-wheel spring oscillator visual
  const wheel = createSpring(0, { stiffness: 320, damping: 6, mass: 0.8 });
  let canvas: HTMLCanvasElement | undefined;
  let raf = 0;
  let timer: number | undefined;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let lastMicLevel = 0;
  let micTicks: number[] = [];

  const verdictOf = (a: ReturnType<typeof analyzeTicks> | null, m: Movement) => {
    if (!a) return { label: "AWAITING TICKS", cls: "text-dim border-white/10" };
    const bphOk = Math.abs(a.bph - m.bph) < 300;
    const driftOk = Math.abs(a.driftSecPerDay) < 10;
    const beatOk = a.beatErrorMs < 1.0;
    if (bphOk && driftOk && beatOk) return { label: m.verdict, cls: "text-emerald-400 border-emerald-400/50" };
    if (!bphOk || a.beatErrorMs > 2) return { label: "FAKE / MAGNETIZED ALERT", cls: "text-red-400 border-red-400/50" };
    return { label: "SUSPECT — SERVICE REQUIRED", cls: "text-amber-300 border-amber-300/50" };
  };

  const drawTape = () => {
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width, H = canvas.height;
    g.fillStyle = "#f5efdd";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(60,50,30,0.25)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.strokeStyle = "rgba(60,50,30,0.5)";
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    // Tick marks from recorded tick times (last 12 s window)
    const times = tickTimes();
    if (!times.length) {
      g.fillStyle = "#6b5f45";
      g.font = "13px JetBrains Mono, monospace";
      g.fillText("paper tape — press ▶ run simulator or 🎙 live mic", 16, H / 2 - 12);
      return;
    }
    const tEnd = times[times.length - 1];
    const tStart = tEnd - 12;
    g.strokeStyle = "#1a1a1a";
    g.lineWidth = 2;
    times.forEach((t, i) => {
      if (t < tStart) return;
      const x = ((t - tStart) / 12) * W;
      const up = i % 2 === 0;
      g.beginPath();
      g.moveTo(x, H / 2);
      g.lineTo(x, up ? H / 2 - 34 : H / 2 + 34);
      g.lineTo(x + 8, up ? H / 2 - 34 : H / 2 + 34);
      g.stroke();
    });
    // 3-peak escapement oscilloscope (impulse / unlocking / drop) schematic
    g.strokeStyle = "#b45309";
    g.lineWidth = 1.5;
    g.beginPath();
    const baseY = H - 18;
    g.moveTo(0, baseY);
    g.lineTo(W * 0.2, baseY);
    g.lineTo(W * 0.24, baseY - 26);
    g.lineTo(W * 0.28, baseY - 26);
    g.lineTo(W * 0.32, baseY);
    g.lineTo(W * 0.55, baseY);
    g.lineTo(W * 0.59, baseY - 40);
    g.lineTo(W * 0.63, baseY - 40);
    g.lineTo(W * 0.67, baseY);
    g.lineTo(W * 0.85, baseY);
    g.lineTo(W * 0.89, baseY - 18);
    g.lineTo(W * 0.93, baseY - 18);
    g.lineTo(W * 0.97, baseY);
    g.stroke();
    g.fillStyle = "#8a6d2f";
    g.font = "10px JetBrains Mono, monospace";
    g.fillText("IMPULSE", W * 0.2, baseY - 32);
    g.fillText("UNLOCKING", W * 0.55, baseY - 46);
    g.fillText("DROP", W * 0.85, baseY - 24);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    wheel.setTarget(Math.sin(performance.now() / 1000 * Math.PI * 2 * movement().freqHz) * 0.9);
    drawTape();
  };

  const startSimulator = () => {
    stopAll();
    setRunning(true);
    setTickTimes([]);
    const m = movement();
    const intervalMs = 1000 / m.freqHz;
    const t0 = performance.now() / 1000;
    let n = 0;
    let isTick = true;
    const tick = () => {
      const now = performance.now() / 1000;
      // Deterministic jitter from the movement's beat error + drift profile
      const jitter = (Math.sin(n * 12.9898) * 43758.5453 % 1) * (m.beatErrorMs / 1000) * (isTick ? 1 : -1);
      const driftOffset = (m.drift / 86400) * (now - t0);
      const t = now - t0 + jitter + driftOffset;
      setTickTimes((prev) => [...prev.slice(-400), t]);
      playTick(isTick);
      haptic(6);
      wheel.kick(isTick ? 0.6 : -0.6);
      isTick = !isTick;
      n++;
      timer = window.setTimeout(tick, intervalMs);
    };
    tick();
    raf = requestAnimationFrame(loop);
  };

  const toggleMic = async () => {
    if (micOn()) { stopAll(); setMicOn(false); return; }
    try {
      setMicError("");
      const mic = await getMicAnalyser(4096);
      stream = mic.stream;
      analyser = mic.analyser;
      setMicOn(true);
      setTickTimes([]);
      micTicks = [];
      const buf = new Float32Array(analyser.fftSize);
      const detect = () => {
        raf = requestAnimationFrame(detect);
        analyser!.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        const now = performance.now() / 1000;
        if (peak > 0.3 && peak - lastMicLevel > 0.15 && now - (micTicks[micTicks.length - 1] ?? -1) > 0.05) {
          micTicks.push(now);
          setTickTimes([...micTicks]);
          haptic(6);
          wheel.kick(0.5);
        }
        lastMicLevel = peak;
        drawTape();
      };
      detect();
    } catch (e: any) {
      setMicError("Mic unavailable — run a movement simulator instead. (" + (e?.name ?? "error") + ")");
    }
  };

  const stopAll = () => {
    setRunning(false);
    cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    if (stream) stopStream(stream);
    stream = null;
  };
  onCleanup(stopAll);

  const saveLog = async () => {
    const a = analysis();
    if (!a) return;
    const v = verdictOf(a, movement());
    await insertHorology({
      movement: movement().name,
      bph: Math.round(a.bph),
      drift_s_day: a.driftSecPerDay,
      beat_error_ms: a.beatErrorMs,
      amplitude_deg: movement().amplitudeDeg,
      verdict: v.label,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const v = () => verdictOf(analysis(), movement());

  return (
    <div class="grid gap-5 lg:grid-cols-5">
      <div class="glass glass-hover rise p-5 lg:col-span-2">
        <h3 class="font-display text-lg font-bold tracking-wide">Movement Simulators</h3>
        <p class="text-dim mt-1 text-xs">Real synthesized tick-tock audio · Zig cross-correlation analysis</p>
        <div class="mt-4 grid gap-2">
          {MOVEMENTS.map((m) => (
            <button
              class={`btn-ghost px-3 py-2 text-left ${movement().id === m.id ? "border-amber-400/70 bg-amber-400/10" : ""}`}
              onClick={() => { stopAll(); setMovement(m); setTickTimes([]); }}
            >
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold">{m.name}</span>
                <span class={`badge ${m.verdictClass === "ok" ? "text-emerald-400" : m.verdictClass === "bad" ? "text-red-400" : "text-amber-300"}`}>{m.verdict}</span>
              </div>
              <div class="text-dim mt-0.5 text-xs">{m.caliber}</div>
              <div class="font-mono2 mt-1 text-[11px]">
                {m.bph.toLocaleString()} BPH · {m.drift > 0 ? "+" : ""}{m.drift} s/d · BE {m.beatErrorMs} ms · {m.amplitudeDeg}°
              </div>
            </button>
          ))}
        </div>
        <div class="mt-4 flex gap-2">
          <button class="btn-gold flex-1 px-4 py-2 text-sm" onClick={startSimulator}>{running() ? "↻ Restart" : "▶ Run Simulator"}</button>
          <button class="btn-ghost px-4 py-2 text-sm" onClick={toggleMic}>{micOn() ? "■ Stop Mic" : "🎙 Live Mic"}</button>
        </div>
        <Show when={micError()}><p class="mt-2 text-xs text-red-300">{micError()}</p></Show>
        <Show when={props.role !== "collector"}>
          <div class="mt-4 rounded-xl border border-white/10 p-3">
            <p class="text-xs font-semibold">Lift-Angle Calibration <span class="badge ml-1">PRO</span></p>
            <label class="text-dim mt-2 block text-xs">Lift angle: {liftAngle()}° (co-axial / high-beat 36,000 BPH)</label>
            <input type="range" min={30} max={60} value={liftAngle()} class="w-full" onInput={(e) => setLiftAngle(+e.currentTarget.value)} />
          </div>
        </Show>
      </div>

      <div class="glass rise p-5 lg:col-span-3" style={{ "animation-delay": "80ms" }}>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-display text-lg font-bold tracking-wide">Paper-Tape Timegrapher</h3>
            <p class="text-dim text-xs">{movement().name} · {movement().caliber}</p>
          </div>
          <div class={`rounded-xl border px-4 py-2 font-mono2 text-sm ${v().cls}`}>{v().label}</div>
        </div>

        <div class="relative mt-4 overflow-hidden rounded-2xl border border-white/10">
          <canvas ref={canvas} width={900} height={300} class="h-64 w-full" />
          {/* Balance wheel */}
          <div class="absolute right-4 top-4 flex h-20 w-20 items-center justify-center">
            <div
              class="h-16 w-16 rounded-full border-4 border-amber-500/80"
              style={{ transform: `rotate(${wheel.value() * 160}deg)`, "border-style": "dashed" }}
            />
            <div class="absolute h-1 w-8 rounded bg-amber-400" style={{ transform: `rotate(${wheel.value() * 160}deg)` }} />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            { label: "Beat Rate", val: analysis() ? `${Math.round(analysis()!.bph).toLocaleString()} BPH` : "—", sub: `${movement().freqHz} Hz target` },
            { label: "Daily Drift", val: analysis() ? `${analysis()!.driftSecPerDay > 0 ? "+" : ""}${analysis()!.driftSecPerDay} s/d` : "—", sub: `target ${movement().drift > 0 ? "+" : ""}${movement().drift} s/d` },
            { label: "Beat Error", val: analysis() ? `${analysis()!.beatErrorMs} ms` : "—", sub: `target ${movement().beatErrorMs} ms` },
            { label: "Amplitude", val: `${movement().amplitudeDeg}°`, sub: movement().verdict },
          ].map((s) => (
            <div class="rounded-xl border border-white/10 bg-black/30 p-3">
              <div class="text-[11px] tracking-wider text-dim">{s.label}</div>
              <div class="font-mono2 mt-1 text-base">{s.val}</div>
              <div class="text-dim mt-0.5 text-[10px]">{s.sub}</div>
            </div>
          ))}
        </div>

        <div class="mt-4 flex gap-2">
          <button class="btn-ghost px-3 py-2 text-xs" disabled={!analysis()} onClick={saveLog}>{saved() ? "✓ Logged" : "Save to Horology Log"}</button>
          <button
            class="btn-ghost px-3 py-2 text-xs"
            disabled={!analysis()}
            onClick={() => props.onOpenCertificate({ type: "horology", movement: movement(), analysis: analysis() })}
          >
            Forensic Certificate
          </button>
          <span class="text-dim ml-auto self-center font-mono2 text-[11px]">ticks: {tickTimes().length}</span>
        </div>
      </div>
    </div>
  );
}
