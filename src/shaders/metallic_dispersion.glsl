// ============================================================================
// metallic_dispersion.glsl — Anisotropic Brushed Metal & Liquid-Glass
// WebGL2 fragment shader for AURUM-ASSAY.
// Renders brushed gold / silver / platinum / emerald liquid-glass reflections
// that react to device gyroscope tilt and mouse position (uPointer).
// ============================================================================
#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;      // normalized −1..1 (mouse / gyroscope)
uniform vec3  uPaletteA;     // primary alloy hue  (gold / ice / emerald / crimson)
uniform vec3  uPaletteB;     // secondary alloy hue
uniform vec3  uPaletteC;     // deep base hue
uniform float uVerdictGlow;  // 0 neutral · 1 authentic emerald · −1 counterfeit crimson
uniform float uEcoMode;      // 1 → matte brushed surface (low-GPU)

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  vec2 p = uv + uPointer * 0.35;

  // Anisotropic brushed-metal streaks (stretched noise along x)
  float brush = noise(vec2(p.x * 90.0, p.y * 3.0 + uTime * 0.02));
  float brush2 = noise(vec2(p.x * 220.0, p.y * 1.2 - uTime * 0.015));
  float grain = hash(gl_FragCoord.xy + fract(uTime));

  // Liquid-glass caustic blobs drifting with pointer parallax
  float c1 = noise(p * 1.6 + vec2(uTime * 0.05, -uTime * 0.03));
  float c2 = noise(p * 3.1 - vec2(uTime * 0.04, uTime * 0.06));
  float caustic = smoothstep(0.45, 0.95, c1 * 0.6 + c2 * 0.4);

  // Specular sweep from pointer position
  float spec = pow(max(0.0, 1.0 - length(uv - uPointer * 1.4)), 3.0);

  vec3 col = uPaletteC;
  col = mix(col, uPaletteA, 0.28 + brush * 0.22);
  col = mix(col, uPaletteB, 0.18 + brush2 * 0.16);
  col += uPaletteA * caustic * 0.35;
  col += vec3(1.0) * spec * 0.22;
  col += vec3(grain) * 0.03;

  // Verdict tint wash
  if (uVerdictGlow > 0.0) col = mix(col, vec3(0.06, 0.55, 0.38), uVerdictGlow * 0.35);
  if (uVerdictGlow < 0.0) col = mix(col, vec3(0.62, 0.08, 0.12), -uVerdictGlow * 0.4);

  // Eco / low-GPU: flatten to a matte brushed surface
  col = mix(col, vec3(dot(col, vec3(0.333))) * 0.9 + uPaletteA * 0.12, uEcoMode * 0.85);

  // Vignette
  col *= 1.0 - 0.45 * dot(uv, uv);
  fragColor = vec4(col, 1.0);
}
