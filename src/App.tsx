import { createMemo, createSignal, Show } from "solid-js";
import GLSLBackground, { type PaletteName } from "./components/GLSLBackground";
import { ApkModal, CertificateModal, GooeyDock, Header, PrivilegeDrawer, type RoleId, type TabId, type ThemeId } from "./components/Chrome";
import AcousticPingLab from "./components/AcousticPingLab";
import HorologyTimegrapher from "./components/HorologyTimegrapher";
import ArchimedesMagnetics from "./components/ArchimedesMagnetics";
import OpticalCaliper from "./components/OpticalCaliper";
import SqlVault from "./components/SqlVault";

export default function App() {
  const [theme, setTheme] = createSignal<ThemeId>("obsidian");
  const [role, setRole] = createSignal<RoleId>("collector");
  const [tab, setTab] = createSignal<TabId>("ping");
  const [formFactor, setFormFactor] = createSignal<"desktop" | "mobile">("desktop");
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [apkOpen, setApkOpen] = createSignal(false);
  const [certificate, setCertificate] = createSignal<any>(null);
  const [verdict, setVerdict] = createSignal<{ v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT"; score: number } | null>(null);

  const eco = () => theme() === "eco";
  const depthPush = () => drawerOpen() || apkOpen() || certificate() != null;

  const palette = createMemo<PaletteName>(() => {
    if (verdict()?.v === "AUTHENTIC") return "emerald";
    if (verdict()?.v === "COUNTERFEIT") return "crimson";
    if (tab() === "archimedes" || tab() === "caliper") return "ice";
    return "gold";
  });
  const glow = createMemo(() => (verdict()?.v === "AUTHENTIC" ? 1 : verdict()?.v === "COUNTERFEIT" ? -1 : 0));

  const onVerdict = (v: "AUTHENTIC" | "SUSPECT" | "COUNTERFEIT", score: number) => setVerdict({ v, score });

  const shell = (
    <div class={`app-shell ${depthPush() ? "depth-push" : ""} mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-3 pb-28 pt-3 sm:px-5`}>
      <Header
        theme={theme()}
        setTheme={setTheme}
        role={role()}
        setRole={setRole}
        formFactor={formFactor()}
        setFormFactor={setFormFactor}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenApk={() => setApkOpen(true)}
      />

      <main class="flex-1">
        <Show when={tab() === "ping"}>
          <AcousticPingLab role={role()} onVerdict={onVerdict} onOpenCertificate={setCertificate} />
        </Show>
        <Show when={tab() === "horology"}>
          <HorologyTimegrapher role={role()} onVerdict={onVerdict} onOpenCertificate={setCertificate} />
        </Show>
        <Show when={tab() === "archimedes"}>
          <ArchimedesMagnetics role={role()} onVerdict={onVerdict} onOpenCertificate={setCertificate} />
        </Show>
        <Show when={tab() === "caliper"}>
          <OpticalCaliper onVerdict={onVerdict} />
        </Show>
        <Show when={tab() === "vault"}>
          <SqlVault role={role()} />
        </Show>
      </main>

      <footer class="text-dim pb-2 text-center text-[11px]">
        AURUM-ASSAY v1.0.0 · SolidJS + C++20 + Zig 0.13 + Declarative SQL + GLSL · 100% offline · com.aurumassay.forensics
      </footer>
    </div>
  );

  return (
    <div data-theme={theme()}>
      <GLSLBackground palette={palette()} verdictGlow={glow()} eco={eco()} />
      <div class="noise-overlay" />

      <Show when={formFactor() === "mobile"} fallback={shell}>
        <div class="flex min-h-screen items-start justify-center py-6">
          <div class="phone-frame w-[390px] max-w-[94vw]">
            <div class="h-[780px] overflow-y-auto">{shell}</div>
          </div>
        </div>
      </Show>

      <GooeyDock tab={tab()} setTab={setTab} onOpenApk={() => setApkOpen(true)} />
      <PrivilegeDrawer open={drawerOpen()} close={() => setDrawerOpen(false)} role={role()} setRole={setRole} />
      <ApkModal open={apkOpen()} close={() => setApkOpen(false)} />
      <Show when={certificate()}>{(c) => <CertificateModal data={c()} close={() => setCertificate(null)} />}</Show>
    </div>
  );
}
