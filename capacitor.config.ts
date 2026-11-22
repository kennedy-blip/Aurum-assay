import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aurumassay.forensics",
  appName: "AurumAssay",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Hardware permissions requested at runtime by the app shell:
    //  - RECORD_AUDIO      -> 48 kHz ultrasonic/acoustic assay mic (echoCancellation:false)
    //  - CAMERA            -> optical macro caliper + coin edge-reed counter
    //  - VIBRATE           -> tactile resonance haptic engine
    //  - ACCESS_FINE_LOCATION (optional) -> estate-sale provenance logging
  },
};

export default config;
