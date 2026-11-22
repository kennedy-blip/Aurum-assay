package com.aurumassay.forensics;

/**
 * JNI bridge to the C++20 metallurgy / horology kernel.
 *
 * Mirrors the TypeScript bridge in src/wasm/polyglotAssayBridge.ts and the
 * native implementation in android/app/src/main/cpp/native-assay.cpp.
 * Per-mode calibration factors are applied inside the native layer.
 *
 * Result layout of plateModes(): [f20, f30, f01] in Hz.
 */
public final class NativeAssay {

    private NativeAssay() {}

    static {
        try {
            System.loadLibrary("aurum-assay");
        } catch (UnsatisfiedLinkError e) {
            // WebView path still works without the native kernel (TS fallback).
            android.util.Log.w("NativeAssay", "Native kernel unavailable: " + e.getMessage());
        }
    }

    /** Biharmonic plate modes for a struck disc. */
    public static native double[] plateModes(double eGPa, double poisson, double rhoKgM3,
                                             double radiusM, double thicknessM);

    /** Archimedes specific gravity from air/water weights. */
    public static native double specificGravity(double weightAir, double weightWater);

    /** Karat from specific gravity via piecewise alloy anchors. */
    public static native double karatFromSG(double sg);

    /** Eddy-current decay time constant (magnetometer / Lenz probe). */
    public static native double eddyDecayTau(double conductivitySiemensPerM, double thicknessM);
}
