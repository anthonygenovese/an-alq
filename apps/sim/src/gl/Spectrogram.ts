// SPDX-License-Identifier: MIT
import { drawsFromRound, sampleRow } from "../engine/signature.js";
import type { SignatureDraw, TrainingRound } from "../engine/types.js";
import { colorAt } from "../colormap.js";

const ROWS = 256;

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, aPos.y * 0.5 + 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uNewest;
uniform float uRows;
in vec2 vUv;
out vec4 frag;
void main() {
  float row = mod(uNewest - (1.0 - vUv.y) * (uRows - 1.0), uRows);
  frag = texture(uTex, vec2(vUv.x, (row + 0.5) / uRows));
}`;

/**
 * Scrolling spectrogram. One RGBA row is uploaded per frame into a ring
 * texture and a fullscreen triangle-strip samples it. React does not
 * participate in the frame loop.
 */
export class Spectrogram {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private offscreen: HTMLCanvasElement | null = null;
  private offctx: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  private newestLoc: WebGLUniformLocation | null = null;
  private rowsLoc: WebGLUniformLocation | null = null;
  private sample = new Float32Array(0);
  private rgba = new Uint8Array(0);
  private draws: SignatureDraw[] = [];
  private noiseFloor = 0.1;
  private seed = 1;
  private bins = 512;
  private head = 0;
  private rowIndex = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private reduced = false;
  private running = false;
  private destroyed = false;
  private observer: ResizeObserver | null = null;
  private motion: MediaQueryList | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      desynchronized: true,
      preserveDrawingBuffer: false,
    });
    if (gl && this.initGl(gl)) {
      this.gl = gl;
    } else {
      this.ctx2d = canvas.getContext("2d", { alpha: false });
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.motion.matches;
    this.onMotion = this.onMotion.bind(this);
    this.motion.addEventListener("change", this.onMotion);
    this.resize();
  }

  setRound(round: TrainingRound): void {
    this.bins = round.display.bins;
    this.noiseFloor = round.noiseFloor;
    this.seed = round.seed ^ 0x51ed;
    this.draws = drawsFromRound(round);
    this.sample = new Float32Array(this.bins);
    this.rgba = new Uint8Array(this.bins * 4);
    this.head = 0;
    this.rowIndex = 0;
    this.acc = 0;
    if (this.gl && this.texture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.bins,
        ROWS,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null,
      );
    }
    if (this.ctx2d) {
      this.offscreen = document.createElement("canvas");
      this.offscreen.width = this.bins;
      this.offscreen.height = ROWS;
      this.offctx = this.offscreen.getContext("2d", { alpha: false });
      this.image = this.offctx?.createImageData(this.bins, ROWS) ?? null;
    }
    for (let i = 0; i < ROWS; i += 1) this.pushRow();
    this.draw();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running || this.destroyed) return;
      const step = this.reduced ? 100 : 1000 / 60;
      this.acc += now - this.last;
      this.last = now;
      if (!this.paused && this.acc >= step) {
        this.acc = Math.min(this.acc - step, step);
        this.pushRow();
        this.draw();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.motion?.removeEventListener("change", this.onMotion);
    const gl = this.gl;
    if (!gl) return;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
  }

  private onMotion(event: MediaQueryListEvent): void {
    this.reduced = event.matches;
  }

  private initGl(gl: WebGL2RenderingContext): boolean {
    const program = link(gl, VERT, FRAG);
    if (!program) return false;
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) return false;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.useProgram(program);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.program = program;
    this.buffer = buffer;
    this.texture = texture;
    this.newestLoc = gl.getUniformLocation(program, "uNewest");
    this.rowsLoc = gl.getUniformLocation(program, "uRows");
    return true;
  }

  private pushRow(): void {
    if (this.sample.length !== this.bins) return;
    sampleRow(
      {
        bins: this.bins,
        noiseFloor: this.noiseFloor,
        seed: this.seed,
        rowIndex: this.rowIndex,
        draws: this.draws,
      },
      this.sample,
    );
    for (let x = 0; x < this.bins; x += 1) {
      const [r, g, b] = colorAt(this.sample[x] ?? 0);
      const offset = x * 4;
      this.rgba[offset] = r;
      this.rgba[offset + 1] = g;
      this.rgba[offset + 2] = b;
      this.rgba[offset + 3] = 255;
    }
    const gl = this.gl;
    if (gl && this.texture) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        this.head,
        this.bins,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.rgba,
      );
    } else if (this.image) {
      const pixels = this.image.data;
      const stride = this.bins * 4;
      pixels.set(this.rgba, this.head * stride);
    }
    this.head = (this.head + 1) % ROWS;
    this.rowIndex += 1;
  }

  private draw(): void {
    const newest = (this.head - 1 + ROWS) % ROWS;
    const gl = this.gl;
    if (gl && this.program && this.texture) {
      gl.useProgram(this.program);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      if (this.newestLoc) gl.uniform1f(this.newestLoc, newest);
      if (this.rowsLoc) gl.uniform1f(this.rowsLoc, ROWS);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    const ctx = this.ctx2d;
    const image = this.image;
    if (!ctx || !image || !this.offctx || !this.offscreen) return;
    this.offctx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.gl) this.gl.viewport(0, 0, width, height);
    this.draw();
  }
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
