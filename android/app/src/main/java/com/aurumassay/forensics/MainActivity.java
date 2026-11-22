package com.aurumassay.forensics;

import com.getcapacitor.BridgeActivity;

/**
 * AURUM-ASSAY Android shell.
 *
 * Hosts the SolidJS bundle (dist/ synced into assets/public by `npx cap sync`)
 * inside a Capacitor WebView. The five assay modules run identically offline:
 * the physics kernels are pure JS/WASM, SQL runs on IndexedDB, and the ledger
 * lives in device storage.
 */
public class MainActivity extends BridgeActivity {
}
