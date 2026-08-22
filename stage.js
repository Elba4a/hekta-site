/* The stage: one full-screen WebGL2 quad painting the room the phone stands in.
 *
 * A receding engraved plane ruled into columns, a hard raking key light, film
 * grain against banding, and a pool of light that takes the colour of whatever
 * the phone is currently showing (prototype.js sets `tint`). That last uniform
 * is the whole point — the room answers the phone.
 *
 * No library. Three.js would be ~600KB vendored to draw a single quad, and this
 * project ships no CDN and no build step. Everything here degrades to the CSS
 * gradient already painted under the canvas: if WebGL2 is missing, the context
 * is lost, or the visitor asked for reduced motion, we simply never start.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('stage-canvas');
  if (!canvas) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, powerPreference: 'low-power' });
  if (!gl) return;                        // CSS gradient fallback is already on screen

  const VERT = `#version 300 es
  in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uPhone;     // phone centre, in pixels
  uniform vec3  uTint;      // colour of the light the screen spills
  uniform float uGlow;      // 0..1, rises on a screen change

  // value noise, for grain only
  float hash(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv   = frag / uRes;

    // ── the plane. y is remapped so the board recedes toward a horizon at 0.62.
    float horizon = 0.62;
    float depth   = clamp((horizon - uv.y) / horizon, 0.0, 1.0);   // 0 at horizon, 1 at the floor edge
    float persp   = 1.0 / (depth * 5.5 + 0.22);                    // perspective compression

    // ── engraved columns. They converge as they recede, which is what sells depth.
    float cx    = (uv.x - 0.5) * persp + 0.5;
    float cols  = abs(fract(cx * 26.0) - 0.5);
    float rule  = smoothstep(0.5, 0.465, cols) * 0.085 * (1.0 - depth * 0.30);

    // ── flap rows, receding
    float rows  = abs(fract((uv.y * 8.0) * persp * 0.35 + uTime * 0.006) - 0.5);
    float row   = smoothstep(0.5, 0.46, rows) * 0.03 * step(uv.y, horizon);

    // ── the raking key from upper-left
    float key   = pow(max(0.0, 1.0 - distance(uv, vec2(0.04, 1.04)) * 1.15), 3.5) * 0.085;

    // ── the phone's spill: an elliptical pool under and behind the device
    vec2  ph    = (frag - uPhone) / uRes.y;
    ph.x *= 0.82;
    float pool  = exp(-dot(ph, ph) * 9.5);
    float halo  = exp(-dot(ph, ph) * 2.1) * 0.30;

    vec3 col = vec3(0.012, 0.015, 0.021);          // the metal, nearly black
    col += vec3(rule + row) * vec3(0.85, 0.92, 1.0);
    col += key * vec3(0.55, 0.62, 0.78);
    col += uTint * (pool * (0.16 + uGlow * 0.22) + halo * (0.055 + uGlow * 0.09));

    // ── vignette + grain
    col *= 1.0 - 0.72 * pow(distance(uv, vec2(0.5)) * 1.18, 2.0);
    col += (hash(frag + fract(uTime) * 91.7) - 0.5) * 0.016;

    fragColor = vec4(col, 1.0);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('stage: shader failed', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('stage: link failed', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res:   gl.getUniformLocation(prog, 'uRes'),
    time:  gl.getUniformLocation(prog, 'uTime'),
    phone: gl.getUniformLocation(prog, 'uPhone'),
    tint:  gl.getUniformLocation(prog, 'uTint'),
    glow:  gl.getUniformLocation(prog, 'uGlow'),
  };

  // ── state the page drives ────────────────────────────────────────────────
  const tint = { r: 0.30, g: 0.52, b: 0.95 };
  const goal = { r: 0.30, g: 0.52, b: 0.95 };
  let glow = 0;
  let phoneX = 0;
  let phoneY = 0;
  let running = false;
  let dpr = 1;

  // The device is looked up ONCE and its rect is re-read only when something can
  // have moved it. The first version of this ran the query and getBoundingClientRect
  // inside the frame loop, which forces a synchronous layout sixty times a second for
  // as long as the page is visible — the single most expensive thing on the page, and
  // invisible in a screenshot. `dirty` is set by scroll and resize; the loop only
  // recomputes when it is set.
  const device = document.querySelector('.device');
  let dirty = true;
  const invalidate = () => { dirty = true; };

  function measure() {
    if (!dirty) return;
    dirty = false;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    if (device) {
      const r = device.getBoundingClientRect();
      phoneX = (r.left + r.width / 2) * dpr;
      // GL's y origin is the bottom of the viewport
      phoneY = (canvas.clientHeight - (r.top + r.height * 0.62)) * dpr;
    } else {
      phoneX = canvas.width * 0.68;
      phoneY = canvas.height * 0.45;
    }
  }

  function frame(t) {
    if (!running) return;
    measure();
    // ease the tint toward its goal so a screen change reads as a light change
    tint.r += (goal.r - tint.r) * 0.06;
    tint.g += (goal.g - tint.g) * 0.06;
    tint.b += (goal.b - tint.b) * 0.06;
    glow += (0 - glow) * 0.035;

    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, t * 0.001);
    gl.uniform2f(U.phone, phoneX, phoneY);
    gl.uniform3f(U.tint, tint.r, tint.g, tint.b);
    gl.uniform1f(U.glow, glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  function drawOnce() {
    dirty = true;
    measure();
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, 0);
    gl.uniform2f(U.phone, phoneX, phoneY);
    gl.uniform3f(U.tint, goal.r, goal.g, goal.b);
    gl.uniform1f(U.glow, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function start() {
    if (reduce.matches) { running = false; drawOnce(); return; }
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  window.addEventListener('scroll', invalidate, { passive: true });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
  reduce.addEventListener('change', () => { stop(); start(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', () => { invalidate(); if (!running) drawOnce(); });

  // prototype.js calls this on every screen change
  window.hektaStage = {
    setTint(hex) {
      const n = parseInt(hex.slice(1), 16);
      goal.r = ((n >> 16) & 255) / 255;
      goal.g = ((n >> 8) & 255) / 255;
      goal.b = (n & 255) / 255;
      glow = 1;
      invalidate();
      if (!running) drawOnce();
    },
  };

  start();
})();
