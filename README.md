# AURUM-ASSAY

**Acoustic Coin/Bullion Ping Authenticator · Mechanical Watch Timegrapher · Archimedes Specific-Gravity Karat Lab · Optical Macro Caliper**

A polyglot forensic laboratory written across **five programming languages** that deploys to **Vercel** and packages into an offline-capable **Android `.APK`** with a one-tap download engine.

## The five languages

| Language | File | Role |
|---|---|---|
| **SolidJS** | `src/**/*.tsx` | UI with fine-grained signals, 60 fps canvas telemetry, spring physics |
| **C++20** | `cpp-kernel/metallurgy_horology.cpp` + `android/app/src/main/cpp/native-assay.cpp` | Biharmonic plate eigenfrequencies `f(2,0) f(3,0) f(0,1)`, Archimedes SG & karat equations, Android NDK JNI |
| **Zig 0.13** | `zig-dsp/src/simd_timegrapher.zig` | Radix-2 FFT peak matching, sub-ms tick-tock cross-correlation (BPH / drift / beat error) |
| **Declarative SQL** | `src/db/assay_schema.sql` + `src/services/sqlEngine.ts` | Real `SELECT/WHERE/JOIN/SUM/AVG/GROUP BY` executor persisted to IndexedDB — 100% offline |
| **GLSL** | `src/shaders/metallic_dispersion.glsl` | WebGL2 anisotropic brushed-metal / liquid-glass shader reacting to gyro & cursor |

**Vercel build safeguard:** `src/wasm/polyglotAssayBridge.ts` attempts to load pre-compiled WASM (built in CI by `emcc` / `zig build-exe`) and falls back to a bit-deterministic TypedArray implementation — `vite build` succeeds with zero native toolchains.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/ (Vercel-ready)
```

## Modules

1. **Acoustic Ping Lab** — 10-coin World Mint database, live mic FFT modal gates, 1-tap synthetic ping generator (genuine vs CuNi fake vs tungsten core).
2. **Horology Timegrapher** — paper-tape canvas trace, 3-peak escapement oscilloscope, 4 movement simulators with synthesized tick audio, live mic tick detection.
3. **Archimedes & Magnetics** — hydrostatic SG, karat & melt value, density spectrum, magnetometer/Lenz scanner.
4. **Optical Macro Caliper** — camera vernier with mint tolerance rings, credit-card calibration, edge-reed counter.
5. **SQL Vault & Polyglot Inspector** — interactive SQL console, portfolio valuation, 5-language code viewer, offline→online sync queue.

## Android APK

`capacitor.config.ts` (`com.aurumassay.forensics`) + `.github/workflows/build-and-bundle-apk.yml` build the SolidJS bundle, sync Capacitor, compile the NDK C++ kernel via Gradle, and bundle `public/releases/aurumassay-release.apk` for the in-app **One-Tap Download Center** (with QR code). A pre-bundled placeholder artifact ships in the repo so the download never 404s.

## Roles & themes

- **Roles:** Collector (standard) · Master Assayer (Pro: custom E/ν modeling, 36,000 BPH lift-angle, Lenz analyzer) · Vault Forensics Director (Admin: SQL console, polyglot inspector, exports, cloud sync).
- **Themes:** Sovereign Obsidian · Geneva Horology Emerald · Bourse Daylight Frost · Eco-Glass / Low-GPU.
