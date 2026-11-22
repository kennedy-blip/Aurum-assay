import { createEffect, createSignal, Show } from "solid-js";
import QRCode from "qrcode";

export type ThemeId = "obsidian" | "geneva" | "bourse" | "eco";
export type RoleId = "collector" | "assayer" | "director";
export type TabId = "ping" | "horology" | "archimedes" | "caliper" | "vault";

export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: "obsidian", name: "Sovereign Obsidian", desc: "Default dark glass · 24K gold" },
  { id: "geneva", name: "Geneva Horology Emerald", desc: "Watchmaker loupe · Swiss emerald & brass" },
  { id: "bourse", name: "Bourse Daylight Frost", desc: "Coin-show pearl glass · high luminosity" },
  { id: "eco", name: "Eco-Glass / Low-GPU", desc: "Matte surfaces · API < 31 battery saver" },
];

export const ROLES: { id: RoleId; name: string; tier: string; perks: string[] }[] = [
  { id: "collector", name: "Collector & Buyer", tier: "Standard", perks: ["Acoustic Ping Lab", "Watch Timegrapher", "Archimedes SG Lab", "Optical Caliper"] },
  { id: "assayer", name: "Master Assayer & Horologist", tier: "Pro", perks: ["Custom alloy E/ν modeling", "36,000 BPH lift-angle calibration", "Lenz eddy-current analyzer"] },
  { id: "director", name: "Vault Forensics Director", tier: "Admin", perks: ["Interactive SQL console", "5-language polyglot inspector", "CSV/JSON certificate export", "Cloud sync controller"] },
];

export const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "ping", icon: "🔔", label: "Ping Lab" },
  { id: "horology", icon: "⏱️", label: "Timegrapher" },
  { id: "archimedes", icon: "⚖️", label: "Archimedes" },
  { id: "caliper", icon: "📐", label: "Caliper" },
  { id: "vault", icon: "🗄️", label: "SQL Vault" },
];

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface HeaderProps {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  role: RoleId;
  setRole: (r: RoleId) => void;
  formFactor: "desktop" | "mobile";
  setFormFactor: (f: "desktop" | "mobile") => void;
  onOpenDrawer: () => void;
  onOpenApk: () => void;
}

export function Header(props: HeaderProps) {
  return (
    <header class="glass sticky top-3 z-40 mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 font-display text-lg font-black text-black shadow-lg shadow-amber-500/40">
          Au
        </div>
        <div>
          <h1 class="font-display shimmer-text text-lg font-black leading-none tracking-widest">AURUM-ASSAY</h1>
          <p class="text-dim mt-0.5 text-[10px] tracking-wider">FORENSIC METALLURGY & HOROLOGY LAB</p>
        </div>
      </div>

      {/* Theme switcher */}
      <div class="ml-auto flex items-center gap-1 rounded-full border border-white/10 p-1">
        {THEMES.map((t) => (
          <button
            title={t.desc}
            class={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${props.theme === t.id ? "bg-amber-500 text-black" : "text-dim hover:text-white"}`}
            onClick={() => props.setTheme(t.id)}
          >
            {t.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Form factor */}
      <div class="flex items-center gap-1 rounded-full border border-white/10 p-1">
        <button class={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${props.formFactor === "desktop" ? "bg-white/15" : "text-dim"}`} onClick={() => props.setFormFactor("desktop")}>🖥 Station</button>
        <button class={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${props.formFactor === "mobile" ? "bg-white/15" : "text-dim"}`} onClick={() => props.setFormFactor("mobile")}>📱 APK Preview</button>
      </div>

      <button class="btn-ghost px-3 py-1.5 text-xs" onClick={props.onOpenDrawer}>
        🔐 {ROLES.find((r) => r.id === props.role)!.tier}
      </button>
      <button class="btn-gold px-4 py-2 text-xs" onClick={props.onOpenApk}>⬇ Download Android .APK</button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Gooey metaball dock
// ---------------------------------------------------------------------------

export function GooeyDock(props: { tab: TabId; setTab: (t: TabId) => void; onOpenApk: () => void }) {
  const idx = () => TABS.findIndex((t) => t.id === props.tab);
  return (
    <nav class="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <svg width="0" height="0" class="absolute"><defs><filter id="gooey"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" /><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" /><feComposite in="SourceGraphic" in2="goo" operator="atop" /></filter></defs></svg>
      <div class="gooey-wrap glass flex items-center gap-1 rounded-full px-2 py-2">
        {TABS.map((t, i) => (
          <button
            class={`relative flex flex-col items-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${props.tab === t.id ? "text-black" : "text-dim hover:text-white"}`}
            onClick={() => props.setTab(t.id)}
          >
            {props.tab === t.id && (
              <span
                class="gooey-pill absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-600"
                style={{ transform: `scale(${props.tab === t.id ? 1 : 0.6})` }}
              />
            )}
            <span class="relative">{t.icon}</span>
            <span class="relative hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <button class="btn-gold ml-1 rounded-full px-3 py-1.5 text-[11px]" onClick={props.onOpenApk}>⬇ APK</button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Privileges & sensor drawer
// ---------------------------------------------------------------------------

export function PrivilegeDrawer(props: { open: boolean; close: () => void; role: RoleId; setRole: (r: RoleId) => void }) {
  const [sensors, setSensors] = createSignal({ mic: false, mag: false, cam: false, haptic: true });
  const [status, setStatus] = createSignal<Record<string, string>>({ mic: "RESTRICTED", mag: "RESTRICTED", cam: "RESTRICTED", haptic: "ACTIVE" });

  const toggle = async (key: keyof typeof sensors) => {
    const next = { ...sensors(), [key]: !sensors()[key] };
    setSensors(next);
    if (!next[key]) { setStatus({ ...status(), [key]: "RESTRICTED" }); return; }
    try {
      if (key === "mic") {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any });
        s.getTracks().forEach((t) => t.stop());
        setStatus({ ...status(), mic: "ACTIVE · 48 kHz" });
      } else if (key === "cam") {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
        setStatus({ ...status(), cam: "ACTIVE" });
      } else if (key === "mag") {
        setStatus({ ...status(), mag: "SIMULATOR ACTIVE" });
      } else {
        (navigator as any).vibrate?.(15);
        setStatus({ ...status(), haptic: "ACTIVE" });
      }
    } catch {
      setStatus({ ...status(), [key]: "RESTRICTED" });
      setSensors({ ...sensors(), [key]: false });
    }
  };

  const sensorRows: { key: keyof typeof sensors; name: string; desc: string }[] = [
    { key: "mic", name: "48 kHz Acoustic Assay Mic", desc: "getUserMedia audio · voice filters OFF for 2–16 kHz overtones" },
    { key: "mag", name: "3-Axis Magnetometer", desc: "DeviceOrientation · ferromagnetic core detection" },
    { key: "cam", name: "Optical Macro Camera", desc: "getUserMedia video · caliper + edge-reed counter" },
    { key: "haptic", name: "Tactile Resonance Haptics", desc: "navigator.vibrate synced to pings & escapement beats" },
  ];

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={props.close}>
        <div class="glass modal-in h-full w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-bold">Privileges & Runtime</h2>
            <button class="btn-ghost px-3 py-1 text-xs" onClick={props.close}>✕</button>
          </div>

          <p class="text-dim mt-4 text-xs font-semibold tracking-wider">ROLE-BASED ACCESS CONTROL</p>
          <div class="mt-2 grid gap-2">
            {ROLES.map((r) => (
              <button
                class={`btn-ghost px-3 py-2 text-left ${props.role === r.id ? "border-amber-400/70 bg-amber-400/10" : ""}`}
                onClick={() => props.setRole(r.id)}
              >
                <div class="flex items-center justify-between text-sm">
                  <span class="font-semibold">{r.name}</span>
                  <span class="badge">{r.tier}</span>
                </div>
                <div class="text-dim mt-1 text-[11px]">{r.perks.join(" · ")}</div>
              </button>
            ))}
          </div>

          <p class="text-dim mt-5 text-xs font-semibold tracking-wider">HARDWARE & OS SENSOR MATRIX</p>
          <div class="mt-2 grid gap-2">
            {sensorRows.map((s) => (
              <div class="flex items-center gap-3 rounded-xl border border-white/10 p-3">
                <div class="flex-1">
                  <div class="text-sm font-semibold">{s.name}</div>
                  <div class="text-dim text-[11px]">{s.desc}</div>
                </div>
                <span class={`badge ${status()[s.key].includes("ACTIVE") ? "text-emerald-400" : "text-dim"}`}>{status()[s.key]}</span>
                <button
                  class={`relative h-6 w-11 rounded-full transition ${sensors()[s.key] ? "bg-amber-500" : "bg-white/15"}`}
                  onClick={() => toggle(s.key)}
                >
                  <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: sensors()[s.key] ? "22px" : "2px" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Show>
  );
}

// ---------------------------------------------------------------------------
// APK download modal (QR + direct download)
// ---------------------------------------------------------------------------

export function ApkModal(props: { open: boolean; close: () => void }) {
  const [qr, setQr] = createSignal("");
  const apkUrl = () => `${window.location.origin}/releases/aurumassay-release.apk`;

  createEffect(() => {
    if (props.open) QRCode.toDataURL(apkUrl(), { width: 220, margin: 1, color: { dark: "#0a0a0a", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  });

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={props.close}>
        <div class="glass modal-in w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-xl font-bold">Android .APK Download Center</h2>
            <button class="btn-ghost px-3 py-1 text-xs" onClick={props.close}>✕</button>
          </div>

          <div class="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <div class="rounded-2xl bg-white p-3">
              {qr() ? <img src={qr()} alt="APK download QR code" class="h-44 w-44" /> : <div class="flex h-44 w-44 items-center justify-center text-xs text-black/50">QR…</div>}
            </div>
            <div class="flex-1 text-center sm:text-left">
              <p class="text-sm">Scan with your Android phone to install instantly — then assay coins, watches & jewelry anywhere, 100% offline.</p>
              <a href="/releases/aurumassay-release.apk" download="AurumAssay-Forensics-v1.0.0.apk" class="btn-gold mt-3 inline-block px-5 py-3 text-sm">
                ⬇ One-Tap Direct .APK Download
              </a>
              <p class="text-dim mt-2 font-mono2 text-[10px] break-all">{apkUrl()}</p>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-xl border border-white/10 p-3"><div class="text-dim">Version</div><div class="font-mono2">v1.0.0-arm64</div></div>
            <div class="rounded-xl border border-white/10 p-3"><div class="text-dim">Stack</div><div class="font-mono2">SolidJS + C++20 NDK + Zig + SQL + GLSL</div></div>
            <div class="rounded-xl border border-white/10 p-3"><div class="text-dim">Mode</div><div class="font-mono2">100% Offline Estate-Sale Ready</div></div>
            <div class="rounded-xl border border-white/10 p-3"><div class="text-dim">Checksum</div><div class="font-mono2">SHA-256 · see /releases/SHA256SUMS.txt</div></div>
          </div>

          <ol class="text-dim mt-4 list-decimal space-y-1 pl-5 text-xs">
            <li>Download the .APK (or scan the QR code).</li>
            <li>Allow "Install unknown apps" for your browser/file manager.</li>
            <li>Open the APK and grant Mic + Camera permissions — assay anywhere.</li>
          </ol>
        </div>
      </div>
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Forensic certificate modal (shared-element morph target)
// ---------------------------------------------------------------------------

export function CertificateModal(props: { data: any; close: () => void }) {
  const d = () => props.data;
  const download = (fmt: "json" | "csv") => {
    const payload = JSON.stringify(d(), null, 2);
    const blob = new Blob([fmt === "json" ? payload : "field,value\n" + Object.entries(d()).map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join("\n")], { type: fmt === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aurum-certificate.${fmt}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={props.close}>
      <div class="glass modal-in w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between">
          <h2 class="font-display text-xl font-bold">Forensic Assay Certificate</h2>
          <button class="btn-ghost px-3 py-1 text-xs" onClick={props.close}>✕</button>
        </div>
        <div class="mt-3 flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 font-display text-xl font-black text-black">Au</div>
          <div class="text-xs">
            <div class="font-mono2">Certificate № AA-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}</div>
            <div class="text-dim">AURUM-ASSAY · Polyglot Forensic Laboratory · {new Date().toLocaleString()}</div>
          </div>
        </div>
        <pre class="font-mono2 mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 text-[11px] leading-relaxed">
          {JSON.stringify(d(), null, 2)}
        </pre>
        <div class="mt-4 flex gap-2">
          <button class="btn-gold px-4 py-2 text-sm" onClick={() => download("json")}>Export JSON</button>
          <button class="btn-ghost px-4 py-2 text-sm" onClick={() => download("csv")}>Export CSV</button>
        </div>
      </div>
    </div>
  );
}
