import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { COINS } from "../data/mints";

interface Props {
  onVerdict: (v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT", score: number) => void;
}

export default function OpticalCaliper(props: Props) {
  const [coinId, setCoinId] = createSignal("ase");
  const [camOn, setCamOn] = createSignal(false);
  const [camError, setCamError] = createSignal("");
  const [cardMm, setCardMm] = createSignal(85.6); // credit-card reference
  const [pxPerMm, setPxPerMm] = createSignal(8);
  const [measuredD, setMeasuredD] = createSignal(40.6);
  const [measuredT, setMeasuredT] = createSignal(2.98);
  const [reeds, setReeds] = createSignal(0);
  const [reedTarget, setReedTarget] = createSignal(118);

  const coin = createMemo(() => COINS.find((c) => c.id === coinId()) ?? COINS[0]);

  const dCheck = createMemo(() => {
    const delta = Math.abs(measuredD() - coin().diameter_mm);
    return { delta, pass: delta <= 0.15 };
  });
  const tCheck = createMemo(() => {
    const delta = Math.abs(measuredT() - coin().thickness_mm);
    return { delta, pass: delta <= 0.08 };
  });
  const verdict = createMemo(() => {
    const score = (dCheck().pass ? 50 : 0) + (tCheck().pass ? 50 : 0);
    return { score, label: score === 100 ? "DIMENSIONS WITHIN MINT TOLERANCE" : score === 0 ? "DIMENSION MISMATCH — FAKE SUSPECT" : "ONE DIMENSION OFF — SUSPECT" };
  });

  let video: HTMLVideoElement | undefined;
  let stream: MediaStream | null = null;

  const toggleCam = async () => {
    if (camOn()) {
      setCamOn(false);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      return;
    }
    try {
      setCamError("");
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCamOn(true);
    } catch (e: any) {
      setCamError("Camera unavailable — use the manual vernier sliders. (" + (e?.name ?? "error") + ")");
    }
  };
  onCleanup(() => stream?.getTracks().forEach((t) => t.stop()));

  // Screen-space diameter of the mint tolerance ring (px per mm from card calibration)
  const ringPx = createMemo(() => coin().diameter_mm * pxPerMm());

  return (
    <div class="grid gap-5 lg:grid-cols-5">
      <div class="glass glass-hover rise p-5 lg:col-span-2">
        <h3 class="font-display text-lg font-bold tracking-wide">Mint Tolerance Rings</h3>
        <p class="text-dim mt-1 text-xs">If a fake matches gold's weight with cheaper metal, it MUST be too thick or too wide.</p>
        <div class="mt-4 grid gap-2">
          {COINS.filter((c) => c.id !== "custom").map((c) => (
            <button
              class={`btn-ghost flex items-center justify-between px-3 py-2 text-left text-sm ${coinId() === c.id ? "border-amber-400/70 bg-amber-400/10" : ""}`}
              onClick={() => { setCoinId(c.id); setMeasuredD(c.diameter_mm); setMeasuredT(c.thickness_mm); }}
            >
              <span>{c.name}</span>
              <span class="font-mono2 text-xs">{c.diameter_mm} × {c.thickness_mm} mm</span>
            </button>
          ))}
        </div>

        <div class="mt-5 rounded-xl border border-white/10 p-3">
          <p class="text-xs font-semibold">Calibration — credit-card reference</p>
          <label class="text-dim mt-2 block text-xs">Card width: {cardMm().toFixed(1)} mm (ISO/IEC 7810 = 85.60 mm)</label>
          <input type="range" min={80} max={90} step={0.1} value={cardMm()} class="w-full" onInput={(e) => setCardMm(+e.currentTarget.value)} />
          <label class="text-dim mt-2 block text-xs">Pixels per mm: {pxPerMm().toFixed(1)}</label>
          <input type="range" min={3} max={20} step={0.1} value={pxPerMm()} class="w-full" onInput={(e) => setPxPerMm(+e.currentTarget.value)} />
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <label class="text-xs">Measured Ø (mm)
            <input type="number" step="0.01" class="mt-1 w-full" value={measuredD()} onInput={(e) => setMeasuredD(+e.currentTarget.value)} />
          </label>
          <label class="text-xs">Measured thickness (mm)
            <input type="number" step="0.01" class="mt-1 w-full" value={measuredT()} onInput={(e) => setMeasuredT(+e.currentTarget.value)} />
          </label>
        </div>
        <label class="mt-3 block text-xs">Edge reeds counted (coin edge-reed counter)
          <input type="number" class="mt-1 w-full" value={reeds()} onInput={(e) => setReeds(+e.currentTarget.value)} />
        </label>
        <div class="text-dim mt-1 text-[11px]">Target for {coin().name}: {reedTarget()} reeds</div>
      </div>

      <div class="glass rise p-5 lg:col-span-3" style={{ "animation-delay": "80ms" }}>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display text-lg font-bold tracking-wide">0.05 mm Digital Vernier</h3>
          <button class="btn-gold px-4 py-2 text-sm" onClick={toggleCam}>{camOn() ? "■ Stop Camera" : "📷 Macro Camera"}</button>
        </div>
        <Show when={camError()}><p class="mt-2 text-xs text-red-300">{camError()}</p></Show>

        <div class="relative mt-4 flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/60">
          <Show when={camOn()} fallback={<div class="text-dim text-xs">camera off — align coin with the tolerance ring</div>}>
            <video ref={video} class="absolute inset-0 h-full w-full object-cover opacity-70" playsInline muted />
          </Show>
          {/* Tolerance ring overlay */}
          <div
            class="pointer-events-none absolute rounded-full border-2 border-dashed border-emerald-400/80"
            style={{ width: `${Math.min(ringPx(), 340)}px`, height: `${Math.min(ringPx(), 340)}px` }}
          />
          <div class="pointer-events-none absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
          <div class="pointer-events-none absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 bg-white/20" />
          {/* Vernier scale */}
          <div class="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-[7px]">
            {Array.from({ length: 21 }).map((_, i) => (
              <div class="w-px bg-white/40" style={{ height: i % 5 === 0 ? "14px" : "8px" }} />
            ))}
          </div>
          <div class="absolute left-3 top-3 font-mono2 text-[11px] text-emerald-300">
            Ø ring {coin().diameter_mm} mm · {Math.round(ringPx())} px · {pxPerMm().toFixed(1)} px/mm
          </div>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl border border-white/10 bg-black/30 p-3">
            <div class="text-[11px] text-dim">DIAMETER Δ</div>
            <div class={`font-mono2 mt-1 ${dCheck().pass ? "text-emerald-400" : "text-red-400"}`}>{dCheck().delta.toFixed(2)} mm {dCheck().pass ? "✓" : "✗"}</div>
            <div class="text-dim text-[10px]">tolerance ±0.15 mm</div>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/30 p-3">
            <div class="text-[11px] text-dim">THICKNESS Δ</div>
            <div class={`font-mono2 mt-1 ${tCheck().pass ? "text-emerald-400" : "text-red-400"}`}>{tCheck().delta.toFixed(2)} mm {tCheck().pass ? "✓" : "✗"}</div>
            <div class="text-dim text-[10px]">tolerance ±0.08 mm</div>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/30 p-3">
            <div class="text-[11px] text-dim">REEDS</div>
            <div class={`font-mono2 mt-1 ${reeds() === reedTarget() ? "text-emerald-400" : "text-amber-300"}`}>{reeds() || "—"}</div>
            <div class="text-dim text-[10px]">target {reedTarget()}</div>
          </div>
        </div>
        <div class={`mt-4 rounded-xl border px-4 py-2 text-center font-mono2 text-sm ${verdict().score === 100 ? "border-emerald-400/50 text-emerald-400" : verdict().score === 0 ? "border-red-400/50 text-red-400" : "border-amber-300/50 text-amber-300"}`}>
          {verdict().label} · {verdict().score}%
        </div>
      </div>
    </div>
  );
}
