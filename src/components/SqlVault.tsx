import { createEffect, createSignal, onMount, Show } from "solid-js";
import { POLYGLOT_FILES, SQL_PRESETS } from "../data/mints";
import { downloadText, executeSQL, exportTable, flushSyncQueue, resetDatabase, syncQueue, type QueryResult } from "../services/sqlEngine";
import { assayBridge } from "../wasm/polyglotAssayBridge";

import cppSrc from "../../cpp-kernel/metallurgy_horology.cpp?raw";
import zigSrc from "../../zig-dsp/src/simd_timegrapher.zig?raw";
import sqlSrc from "../db/assay_schema.sql?raw";
import glslSrc from "../shaders/metallic_dispersion.glsl?raw";
import bridgeSrc from "../wasm/polyglotAssayBridge.ts?raw";
import jniSrc from "../../android/app/src/main/cpp/native-assay.cpp?raw";

const SOURCES: Record<string, string> = {
  "cpp-kernel/metallurgy_horology.cpp": cppSrc,
  "zig-dsp/src/simd_timegrapher.zig": zigSrc,
  "src/db/assay_schema.sql": sqlSrc,
  "src/shaders/metallic_dispersion.glsl": glslSrc,
  "src/wasm/polyglotAssayBridge.ts": bridgeSrc,
  "android/app/src/main/cpp/native-assay.cpp": jniSrc,
};

interface Props {
  role: string;
}

export default function SqlVault(props: Props) {
  const [sql, setSql] = createSignal(SQL_PRESETS[0].sql);
  const [result, setResult] = createSignal<QueryResult | null>(null);
  const [error, setError] = createSignal("");
  const [running, setRunning] = createSignal(false);
  const [file, setFile] = createSignal(POLYGLOT_FILES[0].path);
  const [syncCount, setSyncCount] = createSignal(syncQueue().length);
  const [syncMsg, setSyncMsg] = createSignal("");
  const [backend, setBackend] = createSignal("ts-fallback (deterministic)");

  const locked = () => props.role === "collector";

  onMount(async () => {
    await run();
    assayBridge.computeModes({ E_GPa: 79, nu: 0.42, rho: 19320, radius_m: 0.015, thickness_m: 0.00287 }).then((r) => setBackend(r.backend));
  });

  const run = async (q?: string) => {
    if (locked()) return;
    setRunning(true);
    setError("");
    try {
      const r = await executeSQL(q ?? sql());
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const doSync = async () => {
    const n = await flushSyncQueue();
    setSyncCount(0);
    setSyncMsg(n ? `✓ ${n} record(s) synced to cloud` : "Queue already empty");
    setTimeout(() => setSyncMsg(""), 3000);
  };

  createEffect(() => { setSyncCount(syncQueue().length); });

  return (
    <div class="grid gap-5 lg:grid-cols-2">
      {/* SQL Console */}
      <div class="glass glass-hover rise p-5">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold tracking-wide">Declarative SQL Console</h3>
          <span class="badge">IndexedDB · offline</span>
        </div>
        <Show when={locked()}>
          <div class="mt-3 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-xs">
            🔒 <b>Master Assayer tier required.</b> Switch role in the Privileges drawer to unlock the interactive SQL console.
          </div>
        </Show>
        <div class="mt-3 flex flex-wrap gap-2">
          {SQL_PRESETS.map((p) => (
            <button class="btn-ghost px-2 py-1 text-[11px]" disabled={locked()} onClick={() => { setSql(p.sql); run(p.sql); }}>{p.label}</button>
          ))}
        </div>
        <textarea
          class="font-mono2 mt-3 h-28 w-full text-xs leading-relaxed"
          value={sql()}
          disabled={locked()}
          onInput={(e) => setSql(e.currentTarget.value)}
          spellcheck={false}
        />
        <div class="mt-2 flex flex-wrap gap-2">
          <button class="btn-gold px-4 py-2 text-sm" disabled={locked() || running()} onClick={() => run()}>{running() ? "Running…" : "▶ Execute SQL"}</button>
          <button class="btn-ghost px-3 py-2 text-xs" disabled={locked()} onClick={() => downloadText("assay_ledger.csv", "").then(() => exportTable("assay_ledger", "csv").then((t) => downloadText("assay_ledger.csv", t, "text/csv")))}>CSV Export</button>
          <button class="btn-ghost px-3 py-2 text-xs" disabled={locked()} onClick={() => exportTable("assay_ledger", "json").then((t) => downloadText("assay_ledger.json", t, "application/json"))}>JSON Export</button>
          <button class="btn-ghost px-3 py-2 text-xs" disabled={locked()} onClick={async () => { await resetDatabase(); run(); }}>Reset DB</button>
        </div>
        <Show when={error()}><p class="mt-2 font-mono2 text-xs text-red-300">⚠ {error()}</p></Show>
        <Show when={result()}>
          <div class="mt-3 overflow-auto rounded-xl border border-white/10">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-white/5">
                  {result()!.columns.map((c) => <th class="px-3 py-2 font-mono2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result()!.rows.map((r) => (
                  <tr class="border-t border-white/5">
                    {result()!.columns.map((c) => (
                      <td class="px-3 py-1.5 font-mono2">{typeof r[c] === "number" ? (Number.isInteger(r[c]) ? r[c] : r[c].toFixed(2)) : String(r[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="text-dim mt-2 font-mono2 text-[11px]">{result()!.rowCount} row(s) · {result()!.ms} ms · IndexedDB</p>
        </Show>

        {/* Sync queue */}
        <div class="mt-4 flex items-center gap-3 rounded-xl border border-white/10 p-3">
          <div class="text-xs">
            <div class="font-semibold">Offline → Online Cloud Sync</div>
            <div class="text-dim">{syncCount()} certificate(s) queued</div>
          </div>
          <button class="btn-ghost ml-auto px-3 py-2 text-xs" onClick={doSync}>☁ Sync Now</button>
          <Show when={syncMsg()}><span class="text-xs text-emerald-400">{syncMsg()}</span></Show>
        </div>
      </div>

      {/* Polyglot inspector */}
      <div class="glass rise p-5" style={{ "animation-delay": "80ms" }}>
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold tracking-wide">5-Language Polyglot Inspector</h3>
          <span class="badge">backend: {backend()}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          {POLYGLOT_FILES.map((f) => (
            <button
              class={`btn-ghost px-2 py-1 text-[11px] ${file() === f.path ? "border-amber-400/70 bg-amber-400/10" : ""}`}
              onClick={() => setFile(f.path)}
            >
              {f.name} <span class="text-dim">· {f.lang}</span>
            </button>
          ))}
        </div>
        <pre class="font-mono2 mt-3 h-[420px] overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 text-[11px] leading-relaxed text-emerald-100/90">
          {SOURCES[file()] ?? "// source unavailable in this build"}
        </pre>
        <p class="text-dim mt-2 text-[11px]">
          C++20 kernel → WASM via emcc (CI) · Zig 0.13 → WASM via zig build-exe (CI) · deterministic TS bridge on Vercel.
        </p>
      </div>
    </div>
  );
}
