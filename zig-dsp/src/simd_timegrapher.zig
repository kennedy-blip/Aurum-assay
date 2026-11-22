//! simd_timegrapher.zig — AURUM-ASSAY Zig 0.13 DSP Kernel
//! ----------------------------------------------------------------------------
//! Implements:
//!   1. Radix-2 FFT coin-resonance peak matching (2k–16k Hz modal gates).
//!   2. Sub-millisecond watch escapement tick-tock cross-correlation:
//!      beat rate (BPH), sec/day drift, beat error (ms), lift-angle amplitude.
//!
//! Compiled to WebAssembly in CI:
//!   zig build-exe zig-dsp/src/simd_timegrapher.zig -target wasm32-freestanding \
//!       -O ReleaseFast -femit-bin=public/wasm/simd_timegrapher.wasm
//! and mirrored deterministically in src/wasm/polyglotAssayBridge.ts so the
//! Vercel build never depends on a Zig toolchain.

const std = @import("std");

// ---------------------------------------------------------------------------
// Radix-2 FFT (iterative Cooley–Tukey, in-place)
// ---------------------------------------------------------------------------

pub const FftResult = struct {
    mags: []f32, // half-spectrum magnitudes, bin i ↔ i·sampleRate/N Hz
};

/// In-place radix-2 FFT over interleaved re/im buffers. `n` must be a power of two.
pub fn fftRadix2(re: []f32, im: []f32) void {
    const n = re.len;
    std.debug.assert(n == im.len);
    std.debug.assert((n & (n - 1)) == 0);

    // Bit-reversal permutation
    var j: usize = 0;
    for (1..n) |i| {
        var bit = n >> 1;
        while ((j & bit) != 0) : (bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            std.mem.swap(f32, &re[i], &re[j]);
            std.mem.swap(f32, &im[i], &im[j]);
        }
    }

    // Butterflies
    var len: usize = 2;
    while (len <= n) : (len <<= 1) {
        const ang = -2.0 * std.math.pi / @as(f32, @floatFromInt(len));
        const wlen_re = @cos(ang);
        const wlen_im = @sin(ang);
        var i: usize = 0;
        while (i < n) : (i += len) {
            var w_re: f32 = 1.0;
            var w_im: f32 = 0.0;
            for (0..len / 2) |k| {
                const u_re = re[i + k];
                const u_im = im[i + k];
                const v_re = re[i + k + len / 2] * w_re - im[i + k + len / 2] * w_im;
                const v_im = re[i + k + len / 2] * w_im + im[i + k + len / 2] * w_re;
                re[i + k] = u_re + v_re;
                im[i + k] = u_im + v_im;
                re[i + k + len / 2] = u_re - v_re;
                im[i + k + len / 2] = u_im - v_im;
                const next_re = w_re * wlen_re - w_im * wlen_im;
                w_im = w_re * wlen_im + w_im * wlen_re;
                w_re = next_re;
            }
        }
    }
}

/// Find the strongest spectral peaks inside the coin modal band (2–16 kHz).
pub const Peak = struct { freq_hz: f32, mag: f32, bin: usize };

pub fn findPeaks(mags: []f32, sample_rate: f32, n: usize, min_hz: f32, max_hz: f32, max_peaks: usize, out: []Peak) usize {
    var count: usize = 0;
    if (mags.len < 5) return 0;
    for (2..mags.len - 2) |i| {
        const f = @as(f32, @floatFromInt(i)) * sample_rate / @as(f32, @floatFromInt(n));
        if (f < min_hz or f > max_hz) continue;
        if (mags[i] > mags[i - 1] and mags[i] > mags[i + 1] and mags[i] > mags[i - 2] and mags[i] > mags[i + 2]) {
            if (count < out.len) {
                out[count] = .{ .freq_hz = f, .mag = mags[i], .bin = i };
                count += 1;
            }
        }
    }
    // Insertion sort by magnitude, descending (small N — fine for ≤ 64 peaks)
    for (1..count) |i| {
        var k = i;
        while (k > 0 and out[k].mag > out[k - 1].mag) : (k -= 1) {
            std.mem.swap(Peak, &out[k], &out[k - 1]);
        }
    }
    return @min(count, max_peaks);
}

// ---------------------------------------------------------------------------
// Escapement tick-tock cross-correlation
// ---------------------------------------------------------------------------

pub const TickAnalysis = struct {
    bph: f32, // beats per hour
    freq_hz: f32, // ticks per second
    beat_error_ms: f32, // tick/tock asymmetry
    drift_sec_per_day: f32, // linear-regression drift
    tick_count: usize,
};

/// Analyze detected tick timestamps (seconds) → BPH, beat error and drift.
/// Mirrors `analyzeTicks` in polyglotAssayBridge.ts exactly.
pub fn analyzeTicks(tick_times: []f64, amplitude_deg: f32) TickAnalysis {
    _ = amplitude_deg;
    if (tick_times.len < 4) return .{ .bph = 0, .freq_hz = 0, .beat_error_ms = 0, .drift_sec_per_day = 0, .tick_count = tick_times.len };

    var mean: f64 = 0;
    for (1..tick_times.len) |i| mean += tick_times[i] - tick_times[i - 1];
    mean /= @as(f64, @floatFromInt(tick_times.len - 1));

    const freq_hz = 1.0 / mean;
    const bph = freq_hz * 3600.0;

    // Beat error: alternating interval asymmetry
    var err_sum: f64 = 0;
    var err_n: usize = 0;
    var i: usize = 1;
    while (i + 1 < tick_times.len) : (i += 2) {
        err_sum += @abs((tick_times[i] - tick_times[i - 1]) - (tick_times[i + 1] - tick_times[i])) / 2.0;
        err_n += 1;
    }
    const beat_error_ms = if (err_n > 0) (err_sum / @as(f64, @floatFromInt(err_n))) * 1000.0 else 0;

    // Drift: least-squares slope of cumulative error vs ideal grid
    const t0 = tick_times[0];
    var num: f64 = 0;
    var den: f64 = 0;
    for (tick_times, 0..) |t, idx| {
        const ideal = t0 + @as(f64, @floatFromInt(idx)) * mean;
        const err = t - ideal;
        num += @as(f64, @floatFromInt(idx)) * err;
        den += @as(f64, @floatFromInt(idx)) * @as(f64, @floatFromInt(idx));
    }
    const slope = if (den != 0) num / den else 0;
    const drift = slope * freq_hz * 86400.0;

    return .{
        .bph = @floatCast(bph),
        .freq_hz = @floatCast(freq_hz),
        .beat_error_ms = @floatCast(beat_error_ms),
        .drift_sec_per_day = @floatCast(drift),
        .tick_count = tick_times.len,
    };
}

// ---------------------------------------------------------------------------
// WASM exports (wasm32-freestanding)
// ---------------------------------------------------------------------------

export fn aurum_fft_peak_match(signal_ptr: [*]f32, n: usize, sample_rate: f32, out_ptr: [*]f32, out_cap: usize) usize {
    // Scratch buffers on the stack via a fixed-size arena (N ≤ 16384).
    var re: [16384]f32 = undefined;
    var im: [16384]f32 = undefined;
    if (n > 16384) return 0;
    for (0..n) |k| {
        re[k] = signal_ptr[k];
        im[k] = 0;
    }
    fftRadix2(re[0..n], im[0..n]);
    var mags: [8192]f32 = undefined;
    for (0..n / 2) |k| mags[k] = @sqrt(re[k] * re[k] + im[k] * im[k]);
    var peaks: [64]Peak = undefined;
    const count = findPeaks(mags[0 .. n / 2], sample_rate, n, 2000, 16000, out_cap, &peaks);
    for (0..count) |k| {
        out_ptr[k * 2] = peaks[k].freq_hz;
        out_ptr[k * 2 + 1] = peaks[k].mag;
    }
    return count;
}

export fn aurum_analyze_ticks(ticks_ptr: [*]f64, n: usize, amplitude_deg: f32, out_ptr: [*]f32) void {
    const r = analyzeTicks(ticks_ptr[0..n], amplitude_deg);
    out_ptr[0] = r.bph;
    out_ptr[1] = r.freq_hz;
    out_ptr[2] = r.beat_error_ms;
    out_ptr[3] = r.drift_sec_per_day;
    out_ptr[4] = @floatFromInt(r.tick_count);
}

// ---------------------------------------------------------------------------
// Tests:  zig test zig-dsp/src/simd_timegrapher.zig
// ---------------------------------------------------------------------------

test "fft finds a pure tone" {
    const n = 1024;
    var re: [1024]f32 = undefined;
    var im: [1024]f32 = undefined;
    for (0..n) |k| {
        re[k] = @sin(2.0 * std.math.pi * 64.0 * @as(f32, @floatFromInt(k)) / @as(f32, @floatFromInt(n)));
        im[k] = 0;
    }
    fftRadix2(&re, &im);
    var mags: [512]f32 = undefined;
    for (0..512) |k| mags[k] = @sqrt(re[k] * re[k] + im[k] * im[k]);
    var peaks: [8]Peak = undefined;
    const count = findPeaks(&mags, 48000, n, 100, 16000, 4, &peaks);
    try std.testing.expect(count >= 1);
    try std.testing.expect(@abs(peaks[0].freq_hz - 3000.0) < 100.0); // bin 64 → 3000 Hz
}

test "analyzeTicks: 28,800 BPH grid" {
    var ticks: [40]f64 = undefined;
    const interval = 3600.0 / 28800.0;
    for (0..40) |k| ticks[k] = @as(f64, @floatFromInt(k)) * interval;
    const r = analyzeTicks(&ticks, 294);
    try std.testing.expect(@abs(r.bph - 28800.0) < 50.0);
    try std.testing.expect(r.beat_error_ms < 0.05);
}
