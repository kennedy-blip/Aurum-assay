import { onCleanup, onMount } from "solid-js";
import shaderSrc from "../shaders/metallic_dispersion.glsl?raw";

export type PaletteName = "gold" | "ice" | "emerald" | "crimson";

const PALETTES: Record<PaletteName, { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] }> = {
  gold: { a: [0.96, 0.62, 0.04], b: [0.85, 0.47, 0.02], c: [0.035, 0.04, 0.06] },
  ice: { a: [0.22, 0.74, 0.97], b: [0.89, 0.93, 0.95], c: [0.03, 0.05, 0.09] },
  emerald: { a: [0.06, 0.73, 0.51], b: [0.2, 0.83, 0.6], c: [0.02, 0.07, 0.05] },
  crimson: { a: [0.94, 0.27, 0.27], b: [0.96, 0.25, 0.37], c: [0.09, 0.02, 0.04] },
};

interface Props {
  palette: PaletteName;
  verdictGlow: number; // 1 authentic · 0 neutral · −1 counterfeit
  eco: boolean;
}

/** GPU metallic-dispersion underlay. Falls back to a CSS gradient in Eco mode or when WebGL2 is unavailable. */
export default function GLSLBackground(props: Props) {
  let canvas: HTMLCanvasElement | undefined;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let raf = 0;
  const pointer = { x: 0, y: 0 };
  let palette = props.palette;
  let glow = props.verdictGlow;
  let eco = props.eco;

  const compile = (type: number, src: string) => {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    return sh;
  };

  const init = () => {
    if (!canvas) return;
    gl = canvas.getContext("webgl2", { antialias: false, alpha: false }) as WebGL2RenderingContext | null;
    if (!gl) return;
    const vs = compile(gl.VERTEX_SHADER, `#version 300 es\nin vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`);
    const fs = compile(gl.FRAGMENT_SHADER, shaderSrc);
    program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl = null; return; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
  };

  const resize = () => {
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, eco ? 1 : 1.5);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const render = (t: number) => {
    raf = requestAnimationFrame(render);
    if (!gl || !program || eco) return;
    const pal = PALETTES[palette];
    const u = (name: string) => gl!.getUniformLocation(program!, name);
    gl.uniform2f(u("uResolution"), canvas!.width, canvas!.height);
    gl.uniform1f(u("uTime"), t / 1000);
    gl.uniform2f(u("uPointer"), pointer.x, pointer.y);
    gl.uniform3f(u("uPaletteA"), ...pal.a);
    gl.uniform3f(u("uPaletteB"), ...pal.b);
    gl.uniform3f(u("uPaletteC"), ...pal.c);
    gl.uniform1f(u("uVerdictGlow"), glow);
    gl.uniform1f(u("uEcoMode"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma != null) pointer.x = Math.max(-1, Math.min(1, e.gamma / 45));
    if (e.beta != null) pointer.y = Math.max(-1, Math.min(1, -(e.beta - 45) / 45));
  };

  onMount(() => {
    init();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("deviceorientation", onTilt);
    raf = requestAnimationFrame(render);
  });
  onCleanup(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("deviceorientation", onTilt);
  });

  // Keep mutable copies in sync with props without re-creating the GL context.
  const sync = () => { palette = props.palette; glow = props.verdictGlow; eco = props.eco; resize(); };
  sync();
  setInterval(sync, 250);

  return (
    <>
      <canvas ref={canvas} class="fixed inset-0 -z-10 h-full w-full" style={{ display: props.eco ? "none" : "block" }} />
      <div
        class="fixed inset-0 -z-10"
        style={{
          display: props.eco ? "block" : "none",
          background:
            palette === "crimson"
              ? "linear-gradient(160deg,#1a0508,#0a0c10 60%)"
              : palette === "emerald"
                ? "linear-gradient(160deg,#04150f,#0a0c10 60%)"
                : palette === "ice"
                  ? "linear-gradient(160deg,#0a1626,#0a0c10 60%)"
                  : "linear-gradient(160deg,#171106,#0a0c10 60%)",
        }}
      />
    </>
  );
}
