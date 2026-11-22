// ============================================================================
// native-assay.cpp — AURUM-ASSAY Android NDK JNI Bridge (C++20)
// ----------------------------------------------------------------------------
// Exposes the metallurgy kernel (cpp-kernel/metallurgy_horology.cpp) to the
// Capacitor WebView via JNI so the .APK runs the native physics at full speed:
//
//   Java:  com.aurumassay.forensics.NativeAssay.plateModes(E, nu, rho, R, h)
//          com.aurumassay.forensics.NativeAssay.specificGravity(wAir, wWater)
//          com.aurumassay.forensics.NativeAssay.karatFromSG(sg)
//
// Build: android/app/src/main/cpp/CMakeLists.txt (add_subdirectory from
// android/app/build.gradle → externalNativeBuild).
// ============================================================================

#include <jni.h>
#include <cmath>
#include <algorithm>

// ---- Kernel (inlined copy of cpp-kernel/metallurgy_horology.cpp core) ------
namespace aurum {

inline constexpr double kLambda20 = 5.906;
inline constexpr double kLambda30 = 8.137;
inline constexpr double kLambda01 = 3.196;
// Per-mode empirical calibration vs the 1 oz .9999 gold reference disc —
// see cpp-kernel/metallurgy_horology.cpp for the full rationale.
inline constexpr double kCal20 = 0.0793;
inline constexpr double kCal30 = 0.0939;
inline constexpr double kCal01 = 0.7587;
inline constexpr double kPi = 3.14159265358979323846;

struct PlateModes { double f20, f30, f01; };

inline PlateModes plate_modes(double E_GPa, double nu, double rho,
                              double radius_m, double thickness_m) {
    const double E = E_GPa * 1e9;
    const double base = std::sqrt((E * thickness_m * thickness_m) / (12.0 * rho * (1.0 - nu * nu)));
    const double denom = 2.0 * kPi * radius_m * radius_m;
    auto f = [&](double l, double cal) { return cal * (l * l / denom) * base; };
    return {f(kLambda20, kCal20), f(kLambda30, kCal30), f(kLambda01, kCal01)};
}

inline double specific_gravity(double w_air, double w_water) {
    const double d = w_air - w_water;
    return d > 0.0 ? w_air / d : NAN;
}

inline double karat_from_sg(double sg) {
    if (!(sg > 0.0) || !std::isfinite(sg)) return 0.0;
    static constexpr double kAnchors[][2] = {{10, 11.4}, {14, 13.4}, {18, 15.5}, {22, 17.7}, {24, 19.32}};
    if (sg <= kAnchors[0][1]) return std::clamp(10.0 - (kAnchors[0][1] - sg), 0.0, 24.0);
    for (int i = 0; i < 4; ++i) {
        if (sg >= kAnchors[i][1] && sg <= kAnchors[i + 1][1]) {
            const double t = (sg - kAnchors[i][1]) / (kAnchors[i + 1][1] - kAnchors[i][1]);
            return kAnchors[i][0] + t * (kAnchors[i + 1][0] - kAnchors[i][0]);
        }
    }
    return 24.0;
}

} // namespace aurum

// ---- JNI exports ------------------------------------------------------------
extern "C" JNIEXPORT jdoubleArray JNICALL
Java_com_aurumassay_forensics_NativeAssay_plateModes(
    JNIEnv* env, jobject /*thiz*/,
    jdouble E_GPa, jdouble nu, jdouble rho, jdouble radius_m, jdouble thickness_m) {
    auto m = aurum::plate_modes(E_GPa, nu, rho, radius_m, thickness_m);
    jdouble out[3] = {m.f20, m.f30, m.f01};
    jdoubleArray arr = env->NewDoubleArray(3);
    env->SetDoubleArrayRegion(arr, 0, 3, out);
    return arr;
}

extern "C" JNIEXPORT jdouble JNICALL
Java_com_aurumassay_forensics_NativeAssay_specificGravity(
    JNIEnv* /*env*/, jobject /*thiz*/, jdouble w_air, jdouble w_water) {
    return aurum::specific_gravity(w_air, w_water);
}

extern "C" JNIEXPORT jdouble JNICALL
Java_com_aurumassay_forensics_NativeAssay_karatFromSG(
    JNIEnv* /*env*/, jobject /*thiz*/, jdouble sg) {
    return aurum::karat_from_sg(sg);
}

// Lenz's-law eddy-current decay model (Pro tier):
//   τ = μ₀·σ·d² / π²  →  decay time constant for a conducting disc of thickness d.
extern "C" JNIEXPORT jdouble JNICALL
Java_com_aurumassay_forensics_NativeAssay_eddyDecayTau(
    JNIEnv* /*env*/, jobject /*thiz*/, jdouble conductivity_Spm, jdouble thickness_m) {
    constexpr double kMu0 = 4.0 * 3.141592653589793 * 1e-7;
    const double d = thickness_m;
    return (kMu0 * conductivity_Spm * d * d) / (3.141592653589793 * 3.141592653589793);
}
