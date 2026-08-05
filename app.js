/* ============================================================================
   app.js — integrator, camera, renderer, UI
   ----------------------------------------------------------------------------
   Nothing is pre-rendered. Every frame solves the ODE forward with 4th-order
   Runge–Kutta, projects the whole trail through a rotation matrix, and redraws.
   The interesting parts, in order:

     rk4()            the integrator (§2)
     project()        yaw/pitch orthographic camera (§4)
     drawScene()      the trail renderer, batched by colour run (§5)
     lyapunovStep()   Benettin's algorithm for λ₁ (§2)
     drawInset()      the three diagnostic panels (§6)
   ========================================================================== */

"use strict";

/* §1 ---------------------------------------------------------------- setup */

const $ = (s) => document.querySelector(s);
const scene = $("#scene"),
  sctx = scene.getContext("2d");
const inset = $("#inset"),
  ictx = inset.getContext("2d");

const KEYS = Object.keys(ATTRACTORS);

/** Fixed-capacity ring buffer of 3-D points plus the speed at each point. */
class Trail {
  constructor(cap) {
    this.alloc(cap);
  }
  alloc(cap) {
    this.cap = cap;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap);
    this.n = 0;
    this.head = 0;
  }
  clear() {
    this.n = 0;
    this.head = 0;
  }
  push(x, y, z, sp) {
    const i = this.head * 3;
    this.p[i] = x;
    this.p[i + 1] = y;
    this.p[i + 2] = z;
    this.v[this.head] = sp;
    this.head = (this.head + 1) % this.cap;
    if (this.n < this.cap) this.n++;
  }
  /** Buffer index of the k-th oldest retained point. */
  idx(k) {
    return (this.head - this.n + k + this.cap + this.cap) % this.cap;
  }
}

const ui = {
  playing: true,
  speed: 1,
  trailCap: 12000,
  width: 1,
  glow: true,
  autofit: true,
  axes: true,
  colorMode: "age",
  ghosts: 0,
  epsExp: -6,
  insetMode: "timeseries",
  sectionAxis: 2,
};

const sim = {
  id: null,
  cfg: null,
  p: {}, // live parameter values
  runners: [], // [0] is the reference orbit, rest are ghosts
  t: 0,
  steps: 0,
  lyap: {
    shadow: new Float64Array(3),
    sum: 0,
    T: 0,
    val: null,
    d0: 1e-7,
    warm: 0,
  },
  div: { sum: 0, n: 0 },
  poincare: [],
  pcHead: 0,
  pcPrev: null,
  prevState: new Float64Array(3),
  sep: [],
  fit: { c: [0, 0, 0], r: 1, target: null },
  view: { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 },
};

const PC_CAP = 4000,
  SEP_CAP = 900;

/* §2 ----------------------------------------------------- the numerics core */

const K1 = new Float64Array(3),
  K2 = new Float64Array(3),
  K3 = new Float64Array(3),
  K4 = new Float64Array(3),
  DA = new Float64Array(3),
  DB = new Float64Array(3);

/**
 * One classical RK4 step, in place on `s`. Returns |F(s)| at the step start,
 * which the renderer reuses as "speed" without a second evaluation.
 */
function rk4(s, p, dt, f) {
  const x = s[0],
    y = s[1],
    z = s[2];
  f(x, y, z, p, K1);
  const sp = Math.sqrt(K1[0] * K1[0] + K1[1] * K1[1] + K1[2] * K1[2]);
  f(x + 0.5 * dt * K1[0], y + 0.5 * dt * K1[1], z + 0.5 * dt * K1[2], p, K2);
  f(x + 0.5 * dt * K2[0], y + 0.5 * dt * K2[1], z + 0.5 * dt * K2[2], p, K3);
  f(x + dt * K3[0], y + dt * K3[1], z + dt * K3[2], p, K4);
  s[0] = x + (dt * (K1[0] + 2 * K2[0] + 2 * K3[0] + K4[0])) / 6;
  s[1] = y + (dt * (K1[1] + 2 * K2[1] + 2 * K3[1] + K4[1])) / 6;
  s[2] = z + (dt * (K1[2] + 2 * K2[2] + 2 * K3[2] + K4[2])) / 6;
  return sp;
}

const finite = (s) =>
  Number.isFinite(s[0]) &&
  Number.isFinite(s[1]) &&
  Number.isFinite(s[2]) &&
  Math.abs(s[0]) < 1e7 &&
  Math.abs(s[1]) < 1e7 &&
  Math.abs(s[2]) < 1e7;

/**
 * Benettin's algorithm for the largest Lyapunov exponent: carry a shadow orbit
 * a fixed tiny distance d0 away, advance both one step, record how much the gap
 * grew, then pull the shadow back to d0 along the same direction. The mean of
 * log(growth) per unit time is λ₁.
 */
function lyapunovStep(cfg, p, dt) {
  const L = sim.lyap,
    s = sim.runners[0].s,
    sh = L.shadow;
  rk4(sh, p, dt, cfg.f);
  const dx = sh[0] - s[0],
    dy = sh[1] - s[1],
    dz = sh[2] - s[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(d > 0) || !Number.isFinite(d)) {
    resetLyapunov();
    return;
  }
  L.warm++;
  if (L.warm > 1500) {
    L.sum += Math.log(d / L.d0);
    L.T += dt;
  }
  const k = L.d0 / d;
  sh[0] = s[0] + dx * k;
  sh[1] = s[1] + dy * k;
  sh[2] = s[2] + dz * k;
  if (L.T > 0) L.val = L.sum / L.T;
}

function resetLyapunov() {
  const L = sim.lyap,
    s = sim.runners[0].s;
  L.d0 = Math.max(1e-9, sim.fit.r * 1e-7);
  L.shadow.set([s[0] + L.d0, s[1], s[2]]);
  L.sum = 0;
  L.T = 0;
  L.val = null;
  L.warm = 0;
  sim.div.sum = 0;
  sim.div.n = 0;
}

/** ∇·F by central differences — the rate at which phase-space volume shrinks. */
function divergence(s, p, f) {
  const h = 1e-5 * Math.max(1, sim.fit.r);
  let d = 0;
  f(s[0] + h, s[1], s[2], p, DA);
  f(s[0] - h, s[1], s[2], p, DB);
  d += (DA[0] - DB[0]) / (2 * h);
  f(s[0], s[1] + h, s[2], p, DA);
  f(s[0], s[1] - h, s[2], p, DB);
  d += (DA[1] - DB[1]) / (2 * h);
  f(s[0], s[1], s[2] + h, p, DA);
  f(s[0], s[1], s[2] - h, p, DB);
  d += (DA[2] - DB[2]) / (2 * h);
  return d;
}

/* §3 ----------------------------------------------------------- simulation */

function makeRunner(base, offsetDir, eps) {
  const s = new Float64Array(3);
  s[0] = base[0] + (offsetDir ? offsetDir[0] * eps : 0);
  s[1] = base[1] + (offsetDir ? offsetDir[1] * eps : 0);
  s[2] = base[2] + (offsetDir ? offsetDir[2] * eps : 0);
  return { s, trail: new Trail(ui.trailCap) };
}

const GHOST_DIRS = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function rebuildRunners() {
  const eps = Math.pow(10, ui.epsExp);
  const base = sim.cfg.init;
  sim.runners = [makeRunner(base, null, 0)];
  for (let i = 0; i < ui.ghosts; i++)
    sim.runners.push(makeRunner(base, GHOST_DIRS[i], eps));
  sim.t = 0;
  sim.steps = 0;
  sim.poincare.length = 0;
  sim.pcHead = 0;
  sim.pcPrev = null;
  sim.sep.length = 0;
  sim.sepEvery = 6;
  sim.prevState.set(sim.runners[0].s);
  resetLyapunov();
  renderLegend();
}

function resetOrbit() {
  rebuildRunners();
}

function clearTrails() {
  for (const r of sim.runners) r.trail.clear();
  sim.poincare.length = 0;
  sim.pcHead = 0;
  sim.sep.length = 0;
}

function advance(n) {
  const cfg = sim.cfg,
    dt = cfg.dt,
    p = sim.p,
    f = cfg.f;
  for (let i = 0; i < n; i++) {
    for (let ri = 0; ri < sim.runners.length; ri++) {
      const r = sim.runners[ri];
      const sp = rk4(r.s, p, dt, f);
      if (!finite(r.s)) {
        resetOrbit();
        return;
      }
      r.trail.push(r.s[0], r.s[1], r.s[2], sp);
    }
    lyapunovStep(cfg, p, dt);
    sim.t += dt;
    sim.steps++;

    const s0 = sim.runners[0].s;
    if (sim.steps % 16 === 0) {
      const d = divergence(s0, p, f);
      if (Number.isFinite(d)) {
        sim.div.sum += d;
        sim.div.n++;
      }
    }
    recordSection(s0);
    if (sim.runners.length > 1 && sim.steps % sim.sepEvery === 0)
      recordSeparation();
    sim.prevState[0] = s0[0];
    sim.prevState[1] = s0[1];
    sim.prevState[2] = s0[2];
  }
}

/** Poincaré section: log where the orbit pierces a plane in the + direction. */
function recordSection(s) {
  const ax = ui.sectionAxis;
  const c = sim.fit.c[ax] + (sim.cfg.section?.offset || 0) * sim.fit.r;
  const prev = sim.pcPrev;
  sim.pcPrev = s[ax];
  if (prev === null) return;
  if (!(prev < c && s[ax] >= c)) return;
  const u = (c - prev) / (s[ax] - prev || 1e-12);
  const a = (ax + 1) % 3,
    b = (ax + 2) % 3;
  const pa = sim.prevState[a] + u * (s[a] - sim.prevState[a]);
  const pb = sim.prevState[b] + u * (s[b] - sim.prevState[b]);
  if (sim.poincare.length < PC_CAP) sim.poincare.push(pa, pb);
  else {
    sim.poincare[sim.pcHead] = pa;
    sim.poincare[sim.pcHead + 1] = pb;
    sim.pcHead = (sim.pcHead + 2) % PC_CAP;
  }
}

/*
 * The whole story of the divergence is in its first few seconds, so this keeps
 * history all the way back to launch rather than a rolling window: when the
 * buffer fills, every second sample is dropped and the sampling interval
 * doubles. Resolution decays; the exponential ramp never scrolls off.
 */
function recordSeparation() {
  const a = sim.runners[0].s,
    b = sim.runners[1].s;
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2];
  sim.sep.push(sim.t, Math.sqrt(dx * dx + dy * dy + dz * dz));
  if (sim.sep.length > SEP_CAP * 2) {
    const s = sim.sep;
    let w = 0;
    for (let i = 0; i < s.length; i += 4) {
      s[w++] = s[i];
      s[w++] = s[i + 1];
    }
    s.length = w;
    sim.sepEvery *= 2;
  }
}

/* §4 -------------------------------------------------------------- camera */

const cam = { cy: 1, sy: 0, cp: 1, sp: 0, s: 1, ox: 0, oy: 0 };

function updateCamera(W, H) {
  const v = sim.view,
    d = Math.PI / 180;
  cam.cy = Math.cos(v.yaw * d);
  cam.sy = Math.sin(v.yaw * d);
  cam.cp = Math.cos(v.pitch * d);
  cam.sp = Math.sin(v.pitch * d);
  cam.s = ((Math.min(W, H) * 0.42) / sim.fit.r) * v.zoom;
  cam.ox = W / 2 + v.panX;
  cam.oy = H / 2 + v.panY;
}

/* Screen X, screen Y and a depth value, written into these three slots. */
let PX = 0,
  PY = 0,
  PD = 0;
function project(x, y, z) {
  const cx = x - sim.fit.c[0],
    cy_ = y - sim.fit.c[1],
    cz = z - sim.fit.c[2];
  const rx = cx * cam.cy - cy_ * cam.sy;
  const ry = cx * cam.sy + cy_ * cam.cy;
  const depth = ry * cam.cp - cz * cam.sp;
  const up = ry * cam.sp + cz * cam.cp;
  PX = cam.ox + rx * cam.s;
  PY = cam.oy - up * cam.s;
  PD = depth;
}

/** Re-frame on the bounding box of the reference trail. */
function fitView(instant) {
  const tr = sim.runners[0].trail;
  if (tr.n < 50) return;
  let mnx = Infinity,
    mny = Infinity,
    mnz = Infinity,
    mxx = -Infinity,
    mxy = -Infinity,
    mxz = -Infinity;
  for (let k = 0; k < tr.n; k++) {
    const i = tr.idx(k) * 3;
    const x = tr.p[i],
      y = tr.p[i + 1],
      z = tr.p[i + 2];
    if (x < mnx) mnx = x;
    if (x > mxx) mxx = x;
    if (y < mny) mny = y;
    if (y > mxy) mxy = y;
    if (z < mnz) mnz = z;
    if (z > mxz) mxz = z;
  }
  const targetC = [(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2];
  const targetR = Math.max(
    1e-4,
    0.5 * Math.max(mxx - mnx, mxy - mny, mxz - mnz) * 1.12,
  );
  const k = instant ? 1 : 0.12;
  for (let i = 0; i < 3; i++) sim.fit.c[i] += (targetC[i] - sim.fit.c[i]) * k;
  sim.fit.r += (targetR - sim.fit.r) * k;
}

/* §5 -------------------------------------------------------- scene renderer */

let SX = new Float32Array(0),
  SY = new Float32Array(0),
  SD = new Float32Array(0);
function ensureProjBuffers(n) {
  if (SX.length < n) {
    SX = new Float32Array(n);
    SY = new Float32Array(n);
    SD = new Float32Array(n);
  }
}

const LUT_N = 32;
let lut = [];

function hex2rgb(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/*
 * Palettes are written dark→light, which puts the freshest, most important part
 * of the trail at the bright end. On a light surface that end is invisible, so
 * the ramp is flipped and the newest arc becomes the darkest instead.
 */
function buildLUT(stops) {
  const light = document.documentElement.dataset.theme === "light";
  const rgb = (light ? [...stops].reverse() : stops).map(hex2rgb);
  lut = [];
  for (let i = 0; i < LUT_N; i++) {
    const f = (i / (LUT_N - 1)) * (rgb.length - 1);
    const a = Math.min(rgb.length - 2, Math.floor(f)),
      k = f - a;
    const c = [0, 1, 2].map((j) =>
      Math.round(rgb[a][j] + (rgb[a + 1][j] - rgb[a][j]) * k),
    );
    lut.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
}

function cssVar(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}
let theme = {};
function readTheme() {
  theme = {
    surface: cssVar("--surface"),
    grid: cssVar("--grid"),
    axis: cssVar("--axis"),
    ink: cssVar("--ink"),
    ink2: cssVar("--ink-2"),
    muted: cssVar("--ink-muted"),
    line: cssVar("--line"),
    s1: cssVar("--series-1"),
    s2: cssVar("--series-2"),
    s3: cssVar("--series-3"),
    s4: cssVar("--series-4"),
  };
}
const ghostColor = (i) => [theme.s2, theme.s3, theme.s4][i % 3];

function sizeCanvas(cv, ctx) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth,
    h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [w, h];
}

function drawScene() {
  const [W, H] = sizeCanvas(scene, sctx);
  updateCamera(W, H);

  sctx.fillStyle = theme.surface;
  sctx.fillRect(0, 0, W, H);

  if (ui.axes) {
    sctx.strokeStyle = theme.grid;
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let x = (W / 2) % 44; x < W; x += 44) {
      sctx.moveTo(x + 0.5, 0);
      sctx.lineTo(x + 0.5, H);
    }
    for (let y = (H / 2) % 44; y < H; y += 44) {
      sctx.moveTo(0, y + 0.5);
      sctx.lineTo(W, y + 0.5);
    }
    sctx.stroke();
  }

  for (let ri = sim.runners.length - 1; ri >= 0; ri--) {
    drawTrail(sim.runners[ri], ri === 0 ? null : ghostColor(ri - 1));
  }

  if (ui.axes) drawGizmo(W, H);

  sctx.fillStyle = theme.muted;
  sctx.font = "11px ui-monospace, monospace";
  sctx.fillText(
    `yaw ${sim.view.yaw.toFixed(0)}°  pitch ${sim.view.pitch.toFixed(0)}°  zoom ${sim.view.zoom.toFixed(2)}×`,
    12,
    18,
  );
}

/*
 * Drawing 12 000 segments as 12 000 strokes would be far slower than the
 * canvas can afford. Instead every segment is quantised into one of NC × NA
 * (colour, opacity) buckets and appended to that bucket's Path2D; the frame
 * then costs one stroke per non-empty bucket — usually well under a hundred.
 */
const NA = 8;
function drawTrail(runner, flat) {
  const tr = runner.trail,
    n = tr.n;
  if (n < 2) return;
  ensureProjBuffers(n);

  let vmin = Infinity,
    vmax = -Infinity;
  if (!flat && ui.colorMode === "speed") {
    for (let k = 0; k < n; k += 4) {
      const v = tr.v[tr.idx(k)];
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
    if (!(vmax > vmin)) vmax = vmin + 1;
  }

  for (let k = 0; k < n; k++) {
    const i = tr.idx(k) * 3;
    project(tr.p[i], tr.p[i + 1], tr.p[i + 2]);
    SX[k] = PX;
    SY[k] = PY;
    SD[k] = PD;
  }

  const r2 = 2 * sim.fit.r;
  const buckets = new Map();
  let lastKey = -1;

  for (let k = 1; k < n; k++) {
    const age = k / n;
    const dn = Math.max(0, Math.min(1, SD[k] / r2 + 0.5)); // 0 = far, 1 = near
    let ci;
    if (flat) ci = 0;
    // ^2.2 keeps the body of the trail in the saturated middle of the ramp and
    // spends the near-white top stop only on the freshest arc
    else if (ui.colorMode === "age")
      ci = (Math.pow(age, 2.2) * (LUT_N - 1)) | 0;
    else if (ui.colorMode === "depth") ci = (dn * (LUT_N - 1)) | 0;
    else
      ci =
        (Math.min(0.999, (tr.v[tr.idx(k)] - vmin) / (vmax - vmin)) *
          (LUT_N - 1)) |
        0;

    let a = (0.1 + 0.9 * Math.pow(age, 1.1)) * (0.45 + 0.55 * dn);
    if (flat) a = Math.min(1, a * 1.3);
    const ai = Math.max(0, Math.min(NA - 1, Math.round(a * (NA - 1))));
    const key = ci * NA + ai;

    let path = buckets.get(key);
    if (!path) {
      path = new Path2D();
      buckets.set(key, path);
    }
    if (key !== lastKey) path.moveTo(SX[k - 1], SY[k - 1]);
    path.lineTo(SX[k], SY[k]);
    lastKey = key;
  }

  const baseW = ui.width * (flat ? 0.9 : 1);
  sctx.lineCap = "round";
  sctx.lineJoin = "round";

  // faintest first, so the freshest part of the orbit lands on top
  const keys = [...buckets.keys()].sort((p, q) => (p % NA) - (q % NA));
  for (const key of keys) {
    const ci = (key / NA) | 0,
      ai = key % NA;
    const col = flat || lut[ci];
    sctx.strokeStyle = col;
    sctx.globalAlpha = (ai + 1) / NA;
    sctx.lineWidth = baseW * (0.7 + (0.55 * ai) / (NA - 1));
    // glow only where it reads — blurring the dim tail is invisible and costly
    if (ui.glow && ai >= NA - 2) {
      sctx.shadowBlur = 6;
      sctx.shadowColor = col;
    } else sctx.shadowBlur = 0;
    sctx.stroke(buckets.get(key));
  }

  // the moving head
  sctx.globalAlpha = 1;
  sctx.shadowBlur = 0;
  const hx = SX[n - 1],
    hy = SY[n - 1];
  sctx.fillStyle = flat || lut[LUT_N - 1];
  sctx.beginPath();
  sctx.arc(hx, hy, 3.2, 0, 6.2832);
  sctx.fill();
  sctx.strokeStyle = theme.surface;
  sctx.lineWidth = 1.5;
  sctx.beginPath();
  sctx.arc(hx, hy, 3.2, 0, 6.2832);
  sctx.stroke();
}

/** Small corner widget showing where x, y and z currently point. */
function drawGizmo(W, H) {
  const ox = W - 52,
    oy = H - 46,
    L = 24;
  const axes = [
    [1, 0, 0, "x"],
    [0, 1, 0, "y"],
    [0, 0, 1, "z"],
  ];
  sctx.globalAlpha = 1;
  sctx.shadowBlur = 0;
  sctx.lineWidth = 1.4;
  sctx.font = "10px ui-monospace, monospace";
  const cs = cam.s;
  cam.s = 1;
  const saveC = sim.fit.c,
    saveO = [cam.ox, cam.oy];
  sim.fit.c = [0, 0, 0];
  cam.ox = 0;
  cam.oy = 0;
  for (const [x, y, z, label] of axes) {
    project(x, y, z);
    const ex = ox + PX * L,
      ey = oy + PY * L;
    sctx.strokeStyle = theme.axis;
    sctx.beginPath();
    sctx.moveTo(ox, oy);
    sctx.lineTo(ex, ey);
    sctx.stroke();
    sctx.fillStyle = theme.muted;
    sctx.fillText(label, ex + (ex > ox ? 2 : -8), ey + (ey > oy ? 8 : -2));
  }
  sim.fit.c = saveC;
  cam.s = cs;
  cam.ox = saveO[0];
  cam.oy = saveO[1];
}

/* §6 ------------------------------------------------------- diagnostic plots */

const insetNote = $("#inset-note"),
  insetTitle = $("#inset-title");

function drawInset() {
  if (ui.insetMode === "none") return;
  const [W, H] = sizeCanvas(inset, ictx);
  ictx.clearRect(0, 0, W, H);
  ictx.fillStyle = theme.surface;
  ictx.fillRect(0, 0, W, H);
  if (ui.insetMode === "timeseries") drawTimeSeries(W, H);
  else if (ui.insetMode === "separation") drawSeparation(W, H);
  else drawPoincare(W, H);
}

const PAD = { l: 26, r: 14, t: 10, b: 16 };

function drawTimeSeries(W, H) {
  const tr = sim.runners[0].trail,
    n = tr.n;
  if (n < 4) return;
  const win = Math.min(n, 2600),
    start = n - win;
  const cols = [theme.s1, theme.s2, theme.s3],
    names = ["x", "y", "z"];
  const stripH = (H - PAD.t - PAD.b - 8) / 3;

  for (let c = 0; c < 3; c++) {
    const top = PAD.t + c * (stripH + 4);
    let mn = Infinity,
      mx = -Infinity;
    for (let k = start; k < n; k++) {
      const v = tr.p[tr.idx(k) * 3 + c];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (!(mx > mn)) {
      mx = mn + 1;
    }
    const pad = (mx - mn) * 0.08;
    mn -= pad;
    mx += pad;

    ictx.strokeStyle = theme.line;
    ictx.lineWidth = 1;
    ictx.beginPath();
    ictx.moveTo(PAD.l, top + stripH + 0.5);
    ictx.lineTo(W - PAD.r, top + stripH + 0.5);
    ictx.stroke();

    ictx.strokeStyle = cols[c];
    ictx.lineWidth = 1.4;
    ictx.beginPath();
    for (let k = start; k < n; k++) {
      const v = tr.p[tr.idx(k) * 3 + c];
      const px = PAD.l + ((k - start) / (win - 1)) * (W - PAD.l - PAD.r);
      const py = top + stripH - ((v - mn) / (mx - mn)) * stripH;
      k === start ? ictx.moveTo(px, py) : ictx.lineTo(px, py);
    }
    ictx.stroke();

    ictx.fillStyle = cols[c];
    ictx.font = "600 11px ui-monospace, monospace";
    ictx.fillText(names[c], 8, top + stripH / 2 + 4);
    ictx.fillStyle = theme.muted;
    ictx.font = "9.5px ui-monospace, monospace";
    ictx.fillText(fmt(mx), W - PAD.r - 34, top + 8);
  }
  ictx.fillStyle = theme.muted;
  ictx.font = "10px system-ui, sans-serif";
  ictx.fillText(
    `last ${(win * sim.cfg.dt).toFixed(1)} time units →`,
    PAD.l,
    H - 4,
  );
}

function drawSeparation(W, H) {
  if (sim.runners.length < 2) {
    ictx.fillStyle = theme.muted;
    ictx.font = "12px system-ui, sans-serif";
    ictx.fillText(
      "Add at least one extra starting point to compare orbits.",
      PAD.l,
      H / 2,
    );
    return;
  }
  const s = sim.sep;
  if (s.length < 6) return;
  const t0 = s[0],
    t1 = s[s.length - 2];
  const loEps = ui.epsExp - 0.5,
    hi = Math.log10(Math.max(1e-9, sim.fit.r * 2.2));
  const x = (t) =>
    PAD.l + ((t - t0) / Math.max(1e-9, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (l) =>
    PAD.t +
    (1 - (l - loEps) / Math.max(1e-9, hi - loEps)) * (H - PAD.t - PAD.b);

  // saturation ceiling: once separated by the attractor's own size, all information is gone
  ictx.strokeStyle = theme.line;
  ictx.lineWidth = 1;
  ictx.setLineDash([3, 3]);
  ictx.beginPath();
  ictx.moveTo(PAD.l, y(hi));
  ictx.lineTo(W - PAD.r, y(hi));
  ictx.stroke();

  // predicted growth at the measured λ₁
  if (sim.lyap.val > 0) {
    const slope = sim.lyap.val / Math.LN10;
    ictx.strokeStyle = theme.muted;
    ictx.beginPath();
    ictx.moveTo(x(t0), y(ui.epsExp));
    const tEnd = Math.min(t1, t0 + (hi - ui.epsExp) / slope);
    ictx.lineTo(x(tEnd), y(ui.epsExp + slope * (tEnd - t0)));
    ictx.stroke();
  }
  ictx.setLineDash([]);

  ictx.strokeStyle = theme.s1;
  ictx.lineWidth = 1.6;
  ictx.beginPath();
  for (let i = 0; i < s.length; i += 2) {
    const l = Math.log10(Math.max(1e-14, s[i + 1]));
    const px = x(s[i]),
      py = y(Math.max(loEps, Math.min(hi + 0.2, l)));
    i === 0 ? ictx.moveTo(px, py) : ictx.lineTo(px, py);
  }
  ictx.stroke();

  ictx.fillStyle = theme.muted;
  ictx.font = "10px ui-monospace, monospace";
  ictx.fillText("10^" + hi.toFixed(0), 2, y(hi) + 3);
  ictx.fillText("10^" + loEps.toFixed(0), 2, y(loEps));
  ictx.fillStyle = theme.s1;
  ictx.font = "600 10px system-ui, sans-serif";
  ictx.fillText("separation", PAD.l + 4, PAD.t + 10);
  ictx.fillStyle = theme.muted;
  ictx.font = "10px system-ui, sans-serif";
  if (sim.lyap.val > 0) ictx.fillText("slope = λ₁", W - PAD.r - 56, H - 4);
  ictx.fillText("time →", PAD.l, H - 4);
}

function drawPoincare(W, H) {
  const pts = sim.poincare;
  if (pts.length < 8) {
    ictx.fillStyle = theme.muted;
    ictx.font = "12px system-ui, sans-serif";
    ictx.fillText("Collecting crossings…", PAD.l, H / 2);
    return;
  }
  let mnx = Infinity,
    mxx = -Infinity,
    mny = Infinity,
    mxy = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < mnx) mnx = pts[i];
    if (pts[i] > mxx) mxx = pts[i];
    if (pts[i + 1] < mny) mny = pts[i + 1];
    if (pts[i + 1] > mxy) mxy = pts[i + 1];
  }
  const spanx = Math.max(1e-6, mxx - mnx),
    spany = Math.max(1e-6, mxy - mny);
  const x = (v) => PAD.l + ((v - mnx) / spanx) * (W - PAD.l - PAD.r);
  const y = (v) => H - PAD.b - ((v - mny) / spany) * (H - PAD.t - PAD.b);

  ictx.fillStyle = theme.s1;
  ictx.globalAlpha = 0.8;
  for (let i = 0; i < pts.length; i += 2) {
    ictx.beginPath();
    ictx.arc(x(pts[i]), y(pts[i + 1]), 1.4, 0, 6.2832);
    ictx.fill();
  }
  ictx.globalAlpha = 1;
  const names = ["x", "y", "z"];
  const a = (ui.sectionAxis + 1) % 3,
    b = (ui.sectionAxis + 2) % 3;
  ictx.fillStyle = theme.muted;
  ictx.font = "10px ui-monospace, monospace";
  ictx.fillText(names[a] + " →", W - PAD.r - 22, H - 4);
  ictx.fillText("↑ " + names[b], 4, PAD.t + 8);
  ictx.fillText(`${pts.length / 2} crossings`, PAD.l, PAD.t + 8);
}

/* §7 ------------------------------------------------------------- number UI */

function fmt(v) {
  const a = Math.abs(v);
  if (!Number.isFinite(v)) return "—";
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 10) return v.toFixed(2);
  if (a >= 1) return v.toFixed(3);
  return v.toFixed(4);
}
const decimalsFor = (step) =>
  Math.max(0, Math.min(6, Math.ceil(-Math.log10(step))));
function fmtExp(v) {
  const e = v.toExponential(1).replace("e", "e").replace("+", "");
  return e.replace("-", "−");
}

let statTick = 0;
function updateStats() {
  const s = sim.runners[0].s;
  $("#s-time").innerHTML = sim.t.toFixed(1) + '<span class="unit"> t</span>';
  $("#s-pos").textContent =
    `${s[0].toFixed(2)} ${s[1].toFixed(2)} ${s[2].toFixed(2)}`;

  const L = sim.lyap.val;
  const box = $("#s-lyap-box");
  if (L === null) {
    $("#s-lyap").textContent = "settling…";
    box.className = "stat";
  } else {
    $("#s-lyap").textContent = (L >= 0 ? "+" : "−") + Math.abs(L).toFixed(3);
    box.className = "stat " + (L > 0.01 ? "is-chaotic" : "is-ordered");
  }

  const dv = sim.div.n ? sim.div.sum / sim.div.n : null;
  $("#s-div").textContent =
    dv === null ? "—" : (dv >= 0 ? "+" : "−") + Math.abs(dv).toFixed(3);

  if (L !== null && dv !== null && L > 0.005 && dv < -1e-6) {
    const l3 = dv - L;
    $("#s-dim").textContent = l3 < 0 ? (2 + L / Math.abs(l3)).toFixed(3) : "—";
  } else
    $("#s-dim").textContent =
      L !== null && dv !== null && Math.abs(dv) < 0.01 ? "no attractor" : "—";

  if (sim.runners.length > 1 && sim.sep.length >= 2) {
    $("#s-sep").textContent = fmtExp(sim.sep[sim.sep.length - 1]);
  } else $("#s-sep").textContent = "—";
}

/* §8 ------------------------------------------------------------ UI build */

function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  for (const fam of FAMILIES) {
    const g = document.createElement("div");
    g.className = "nav-group";
    g.innerHTML = `<h2>${fam.label}</h2>`;
    for (const id of KEYS) {
      const a = ATTRACTORS[id];
      if (a.family !== fam.id) continue;
      const b = document.createElement("button");
      b.className = "nav-item";
      b.dataset.id = id;
      b.innerHTML = `<span class="n">${a.name}</span> <span class="y">${a.year}</span>`;
      b.onclick = () => select(id);
      g.appendChild(b);
    }
    nav.appendChild(g);
  }
}

function buildParams() {
  const host = $("#params");
  host.innerHTML = "";
  const keys = Object.keys(sim.cfg.params);
  $("#btn-defaults").hidden = keys.length === 0;
  if (!keys.length) {
    host.innerHTML =
      '<p class="empty-note">No parameters — this system is chaotic as written.</p>';
    return;
  }
  for (const k of keys) {
    const d = sim.cfg.params[k],
      dec = decimalsFor(d.step);
    const el = document.createElement("div");
    el.className = "param";
    el.innerHTML =
      `<div class="row"><span class="name">${d.label}</span><span class="val" id="pv-${k}">${sim.p[k].toFixed(dec)}</span></div>` +
      (d.note ? `<div class="note">${d.note}</div>` : "") +
      `<input type="range" id="ps-${k}" min="${d.min}" max="${d.max}" step="${d.step}" value="${sim.p[k]}" aria-label="${d.label}">`;
    host.appendChild(el);
    el.querySelector("input").addEventListener("input", (e) => {
      sim.p[k] = parseFloat(e.target.value);
      $(`#pv-${k}`).textContent = sim.p[k].toFixed(dec);
      onParamsChanged();
    });
  }
}

function syncParamInputs() {
  for (const k of Object.keys(sim.cfg.params)) {
    const el = $(`#ps-${k}`);
    if (!el) continue;
    el.value = sim.p[k];
    $(`#pv-${k}`).textContent = sim.p[k].toFixed(
      decimalsFor(sim.cfg.params[k].step),
    );
  }
}

function onParamsChanged() {
  sim.div.sum = 0;
  sim.div.n = 0;
  resetLyapunov();
}

function buildPresets() {
  const host = $("#presets"),
    list = sim.cfg.presets || [];
  $("#preset-block").hidden = list.length === 0;
  host.innerHTML = "";
  for (const pr of list) {
    const b = document.createElement("button");
    b.className = "preset";
    b.innerHTML = `<span class="pn">${pr.name}</span><span class="pd">${pr.note || ""}</span>`;
    b.onclick = () => {
      Object.assign(sim.p, pr.p);
      syncParamInputs();
      onParamsChanged();
      clearTrails();
    };
    host.appendChild(b);
  }
}

function renderLegend() {
  const el = $("#legend");
  if (sim.runners.length < 2) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const eps = Math.pow(10, ui.epsExp);
  let html = `<span class="item"><span class="swatch" style="background:${lut[LUT_N - 2]}"></span>reference</span>`;
  for (let i = 1; i < sim.runners.length; i++) {
    const ax = ["x", "y", "z"][i - 1];
    html += `<span class="item"><span class="swatch" style="background:${ghostColor(i - 1)}"></span>${ax}₀ + ${fmtExp(eps)}</span>`;
  }
  el.innerHTML = html;
}

function select(id) {
  if (!ATTRACTORS[id]) id = "lorenz";
  sim.id = id;
  const cfg = (sim.cfg = ATTRACTORS[id]);

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const extLink = (url, label) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

  sim.p = {};
  for (const k of Object.keys(cfg.params)) sim.p[k] = cfg.params[k].v;

  sim.fit.c = [...(cfg.view.center || [0, 0, 0])];
  sim.fit.r = cfg.view.radius || 10;
  sim.view.yaw = cfg.view.yaw;
  sim.view.pitch = cfg.view.pitch;
  sim.view.zoom = 1;
  sim.view.panX = 0;
  sim.view.panY = 0;
  ui.sectionAxis = cfg.section ? cfg.section.axis : 2;
  $("#sel-section").value = String(ui.sectionAxis);

  buildLUT(cfg.palette);
  rebuildRunners();

  document
    .querySelectorAll(".nav-item")
    .forEach((b) =>
      b.setAttribute("aria-current", String(b.dataset.id === id)),
    );

  $("#title").textContent = cfg.name;
  $("#tagline").textContent = cfg.tagline;
  $("#equations").textContent = cfg.equations.join("\n");
  const creditBits = [
    `${esc(cfg.author)} · ${esc(cfg.year)} · dt = ${esc(cfg.dt)}`,
  ];
  if (cfg.paper?.url)
    creditBits.push(
      `paper: ${extLink(cfg.paper.url, cfg.paper.title || "publication")}`,
    );
  if (cfg.reference?.url)
    creditBits.push(
      `ref: ${extLink(cfg.reference.url, cfg.reference.label || "reference")}`,
    );
  $("#credit").innerHTML = creditBits.join(" · ");
  $("#about").innerHTML = `<p>${cfg.about}</p>`;
  $("#tips").innerHTML = (cfg.tips || []).map((t) => `<li>${t}</li>`).join("");

  buildParams();
  buildPresets();
  history.replaceState(null, "", "#" + id);
  document.title = `${cfg.name} — Strange Attractors`;
}

/* §9 --------------------------------------------------------------- events */

function setPlaying(v) {
  ui.playing = v;
  $("#btn-play").textContent = v ? "⏸ Pause" : "▶ Play";
}

$("#btn-play").onclick = () => setPlaying(!ui.playing);
$("#btn-reset").onclick = () => resetOrbit();
$("#btn-clear").onclick = () => clearTrails();
$("#btn-fit").onclick = () => {
  fitView(true);
};
$("#btn-defaults").onclick = () => {
  for (const k of Object.keys(sim.cfg.params)) sim.p[k] = sim.cfg.params[k].v;
  syncParamInputs();
  onParamsChanged();
  clearTrails();
};
$("#btn-spin").onclick = (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
};
const spinning = () => $("#btn-spin").getAttribute("aria-pressed") === "true";

document.querySelectorAll(".view-preset").forEach((b) => {
  b.onclick = () => {
    sim.view.yaw = +b.dataset.yaw;
    sim.view.pitch = +b.dataset.pitch;
    $("#btn-spin").setAttribute("aria-pressed", "false");
  };
});

$("#btn-png").onclick = () => {
  const a = document.createElement("a");
  a.download = `${sim.id}-attractor.png`;
  a.href = scene.toDataURL("image/png");
  a.click();
};

$("#sel-color").onchange = (e) => {
  ui.colorMode = e.target.value;
};
$("#sel-inset").onchange = (e) => {
  ui.insetMode = e.target.value;
  inset.hidden = ui.insetMode === "none";
  $("#sel-section").hidden = ui.insetMode !== "poincare";
  const titles = {
    timeseries: "State variables over time",
    separation: "Divergence of nearby starts (log scale)",
    poincare: "Poincaré section",
    none: "—",
  };
  insetTitle.textContent = titles[ui.insetMode];
  const notes = {
    timeseries:
      "Three strips, three independent scales — the same orbit you see rotating above, unrolled in time.",
    separation:
      "Two orbits that start ε apart. The straight run is exponential growth at rate λ₁; the ceiling is the size of the attractor, where the forecast is worth nothing.",
    poincare:
      "Every crossing of one plane, plotted as a dot. A continuous flow becomes a discrete map — and the fractal cross-section becomes visible.",
    none: "",
  };
  insetNote.textContent = notes[ui.insetMode];
  if (ui.insetMode === "separation" && ui.ghosts === 0) setGhosts(1);
};

$("#sel-section").onchange = (e) => {
  ui.sectionAxis = +e.target.value;
  sim.poincare.length = 0;
  sim.pcHead = 0;
  sim.pcPrev = null;
};

function bindRange(id, valId, apply, format) {
  const el = $(id);
  const run = () => {
    const v = parseFloat(el.value);
    $(valId).textContent = format(v);
    apply(v);
  };
  el.addEventListener("input", run);
  run();
}

bindRange(
  "#rng-speed",
  "#v-speed",
  (v) => (ui.speed = v),
  (v) => v.toFixed(1) + "×",
);
bindRange(
  "#rng-trail",
  "#v-trail",
  (v) => {
    ui.trailCap = v;
    for (const r of sim.runners) r.trail.alloc(v);
  },
  (v) => v.toLocaleString("en-US").replace(/,/g, " ") + " pts",
);
bindRange(
  "#rng-width",
  "#v-width",
  (v) => (ui.width = v),
  (v) => v.toFixed(1) + " px",
);

function setGhosts(n) {
  ui.ghosts = n;
  $("#rng-ghosts").value = n;
  $("#v-ghosts").textContent = String(n);
  rebuildRunners();
}
$("#rng-ghosts").addEventListener("input", (e) =>
  setGhosts(parseInt(e.target.value, 10)),
);
$("#rng-eps").addEventListener("input", (e) => {
  ui.epsExp = parseFloat(e.target.value);
  $("#v-eps").textContent = fmtExp(Math.pow(10, ui.epsExp));
  rebuildRunners();
});
$("#v-eps").textContent = fmtExp(Math.pow(10, ui.epsExp));

$("#chk-glow").onchange = (e) => (ui.glow = e.target.checked);
$("#chk-autofit").onchange = (e) => (ui.autofit = e.target.checked);
$("#chk-axes").onchange = (e) => (ui.axes = e.target.checked);

/* pointer: drag to rotate, shift-drag to pan, wheel to zoom */
let drag = null;
scene.addEventListener("pointerdown", (e) => {
  scene.setPointerCapture(e.pointerId);
  scene.classList.add("dragging");
  drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey };
});
scene.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (drag.pan) {
    sim.view.panX += dx;
    sim.view.panY += dy;
  } else {
    sim.view.yaw = (sim.view.yaw - dx * 0.4) % 360;
    sim.view.pitch = Math.max(-90, Math.min(90, sim.view.pitch + dy * 0.4));
    $("#btn-spin").setAttribute("aria-pressed", "false");
  }
});
const endDrag = () => {
  drag = null;
  scene.classList.remove("dragging");
};
scene.addEventListener("pointerup", endDrag);
scene.addEventListener("pointercancel", endDrag);
scene.addEventListener("dblclick", () => {
  sim.view.zoom = 1;
  sim.view.panX = 0;
  sim.view.panY = 0;
  sim.view.yaw = sim.cfg.view.yaw;
  sim.view.pitch = sim.cfg.view.pitch;
});
scene.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    sim.view.zoom = Math.max(
      0.15,
      Math.min(14, sim.view.zoom * Math.exp(-e.deltaY * 0.0015)),
    );
    if (ui.autofit) {
      ui.autofit = false;
      $("#chk-autofit").checked = false;
    } // manual zoom wins
  },
  { passive: false },
);

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return;
  const v = sim.view;
  switch (e.key) {
    case " ":
      e.preventDefault();
      setPlaying(!ui.playing);
      break;
    case "r":
    case "R":
      resetOrbit();
      break;
    case "c":
    case "C":
      clearTrails();
      break;
    case "f":
    case "F":
      fitView(true);
      break;
    case "s":
    case "S":
      $("#btn-spin").click();
      break;
    case "1":
    case "2":
    case "3":
    case "4":
      document.querySelectorAll(".view-preset")[+e.key - 1].click();
      break;
    case "ArrowLeft":
      v.yaw -= 5;
      break;
    case "ArrowRight":
      v.yaw += 5;
      break;
    case "ArrowUp":
      v.pitch = Math.min(90, v.pitch + 5);
      break;
    case "ArrowDown":
      v.pitch = Math.max(-90, v.pitch - 5);
      break;
    case "+":
    case "=":
      v.zoom = Math.min(14, v.zoom * 1.15);
      break;
    case "-":
    case "_":
      v.zoom = Math.max(0.15, v.zoom / 1.15);
      break;
    case "g":
    case "G":
      setGhosts((ui.ghosts + 1) % 4);
      break;
    case "[":
      select(KEYS[(KEYS.indexOf(sim.id) - 1 + KEYS.length) % KEYS.length]);
      break;
    case "]":
      select(KEYS[(KEYS.indexOf(sim.id) + 1) % KEYS.length]);
      break;
  }
});

$("#btn-theme").onclick = () => {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("attractors-theme", next);
  readTheme();
  buildLUT(sim.cfg.palette);
  renderLegend();
};
$("#btn-help").onclick = () => $("#dlg-help").showModal();
$("#dlg-close").onclick = () => $("#dlg-help").close();

window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (id && id !== sim.id && ATTRACTORS[id]) select(id);
});

/* §10 ---------------------------------------------------------- main loop */

let frame = 0;
function tick() {
  if (ui.playing) {
    const n = Math.max(1, Math.round(sim.cfg.steps * ui.speed));
    advance(n);
  }
  if (spinning()) sim.view.yaw = (sim.view.yaw + 0.25) % 360;
  if (ui.autofit && frame % 12 === 0) fitView(false);

  drawScene();
  if (frame % 2 === 0 && ui.insetMode !== "none") drawInset();
  if (frame % 8 === 0) updateStats();
  frame++;
  requestAnimationFrame(tick);
}

/* boot */
const savedTheme = localStorage.getItem("attractors-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
readTheme();
buildNav();
select(location.hash.slice(1) || "lorenz");
$("#sel-inset").dispatchEvent(new Event("change"));
tick(); // sizeCanvas() re-reads the layout every frame, so resize needs no handler
