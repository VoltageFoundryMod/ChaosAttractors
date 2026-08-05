/* ============================================================================
   attractors.js — the catalogue
   ----------------------------------------------------------------------------
   Every attractor is one plain object. Nothing here knows about rendering,
   so this file doubles as a reference sheet: read it, edit it, add your own.

   Field guide
   -----------
   id         internal key (also the URL hash, e.g. index.html#lorenz)
   name       display name
   year       year of publication
   author     who found it
   family     grouping in the sidebar: 'classic' | 'modern' | 'minimal'
   tagline    one line, shown under the title
   about      2–3 sentences of context
   equations  the ODE system, as display strings (Unicode, not LaTeX)
   params     sliders. { v: default, min, max, step, label, note }
   init       initial condition [x, y, z]
   dt         integration step. Smaller = more accurate + slower-moving.
   steps      integration steps per animation frame at 1× speed
   view       { yaw, pitch } starting camera in degrees, plus center/radius
              hints for the initial framing (auto-fit corrects them anyway)
   palette    3–4 colour stops; the trail ramp is interpolated between them
   section    default Poincaré plane: { axis: 0|1|2, offset: -1..1 }
   presets    named parameter sets worth visiting
   tips       things to try, shown in the info panel
   f          the vector field: f(x, y, z, p, out) writes [ẋ, ẏ, ż] into out.
              Written in "out[i] =" style rather than returning an array so the
              integrator can run thousands of steps per second without
              allocating garbage.
   ========================================================================== */

const ATTRACTORS = {

  /* ---------------------------------------------------------------- classic */

  lorenz: {
    name: 'Lorenz', year: 1963, author: 'Edward Lorenz', family: 'classic',
    tagline: 'Atmospheric convection — the original butterfly',
    about: 'Lorenz reduced a model of a fluid layer heated from below to three ' +
      'equations, then discovered that rounding an input from 0.506127 to 0.506 ' +
      'destroyed the forecast. The two "wings" are the two directions the ' +
      'convection roll can turn; the trajectory switches between them forever, ' +
      'never on the same schedule twice.',
    equations: ['ẋ = σ (y − x)', 'ẏ = x (ρ − z) − y', 'ż = x y − β z'],
    params: {
      sigma: { v: 10, min: 0.5, max: 25, step: 0.1, label: 'σ', note: 'Prandtl number' },
      rho:   { v: 28, min: 0.5, max: 120, step: 0.05, label: 'ρ', note: 'Rayleigh number — the driving' },
      beta:  { v: 8 / 3, min: 0.1, max: 6, step: 0.01, label: 'β', note: 'geometry of the roll' }
    },
    init: [0.1, 0, 0], dt: 0.004, steps: 12,
    view: { yaw: 0, pitch: 0, center: [0, 0, 24.5], radius: 27 },
    palette: ['#1b3a6b', '#2a78d6', '#7cc4f5', '#eaf4ff'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Classic chaos', p: { sigma: 10, rho: 28, beta: 8 / 3 }, note: 'The textbook butterfly.' },
      { name: 'Fixed point',   p: { sigma: 10, rho: 20, beta: 8 / 3 }, note: 'ρ < 24.74 — the orbit spirals in and stops.' },
      { name: 'Pre-turbulence',p: { sigma: 10, rho: 24, beta: 8 / 3 }, note: 'Chaotic transient, then collapse. Watch it be patient.' },
      { name: 'Periodic window',p:{ sigma: 10, rho: 99.65, beta: 8 / 3 }, note: 'Chaos is not monotone in ρ — this window is a clean loop.' },
      { name: 'Noisy periodic',p: { sigma: 10, rho: 160, beta: 8 / 3 }, note: 'Far past the butterfly: a wobbling limit cycle.' }
    ],
    tips: [
      'Drop ρ below 24.74 and the attractor dies — the trajectory falls into one fixed point and stays.',
      'At ρ = 28 turn on ghost trajectories with ε = 1e-6: identical for ~15 seconds, then unrelated.',
      'The Poincaré section at z ≈ ρ−1 is not a blob — it is a thin curve. That thinness *is* the fractal.',
      'D≈2.06 in the diagnostics is the Kaplan–Yorke dimension: a surface just barely thicker than a surface.'
    ],
    f: (x, y, z, p, o) => { o[0] = p.sigma * (y - x); o[1] = x * (p.rho - z) - y; o[2] = x * y - p.beta * z; }
  },

  rossler: {
    name: 'Rössler', year: 1976, author: 'Otto Rössler', family: 'classic',
    tagline: 'Minimal chaos — one nonlinear term, a band that folds',
    about: 'Rössler set out to build the simplest possible chaotic flow, and ' +
      'landed on a system with a single quadratic term (xz). The motion is easy ' +
      'to narrate: the orbit spirals outward in the xy-plane, gets lifted in z ' +
      'when it strays too far, and is dropped back near the centre. Stretch, ' +
      'fold, repeat — the whole recipe for chaos in one picture.',
    equations: ['ẋ = − y − z', 'ẏ = x + a y', 'ż = b + z (x − c)'],
    params: {
      a: { v: 0.2, min: 0.01, max: 0.55, step: 0.005, label: 'a', note: 'spiral growth rate' },
      b: { v: 0.2, min: 0.01, max: 2, step: 0.01, label: 'b', note: 'z injection' },
      c: { v: 5.7, min: 1, max: 20, step: 0.02, label: 'c', note: 'fold threshold — the bifurcation knob' }
    },
    init: [1, 1, 1], dt: 0.012, steps: 14,
    view: { yaw: 0, pitch: 90, center: [1.2, -1.5, 11.4], radius: 11.5 },
    palette: ['#5a2708', '#d95926', '#f2a06a', '#ffe8d8'],
    section: { axis: 0, offset: 0 },
    presets: [
      { name: 'Period-1', p: { a: 0.2, b: 0.2, c: 2.5 }, note: 'A single closed loop.' },
      { name: 'Period-2', p: { a: 0.2, b: 0.2, c: 3.5 }, note: 'The loop has split in two.' },
      { name: 'Period-4', p: { a: 0.2, b: 0.2, c: 4.1 }, note: 'And split again. Each split halves the distance to chaos.' },
      { name: 'Chaos',    p: { a: 0.2, b: 0.2, c: 5.7 }, note: 'The cascade has completed.' },
      { name: 'Funnel',   p: { a: 0.343, b: 1.82, c: 9.75 }, note: 'A different chaotic regime — messier, spiral-funnel shaped.' }
    ],
    tips: [
      'Step c through 2.5 → 3.5 → 4.1 → 4.3 → 5.7 with the presets. That is the period-doubling road to chaos, in five clicks.',
      'Switch to the XY view — the fold is invisible edge-on and obvious from above.',
      'The Poincaré section on x = 0 is nearly a 1-D curve; that curve is essentially the logistic map in disguise.'
    ],
    f: (x, y, z, p, o) => { o[0] = -(y + z); o[1] = x + p.a * y; o[2] = p.b + z * (x - p.c); }
  },

  thomas: {
    name: 'Thomas', year: 1999, author: 'René Thomas', family: 'classic',
    tagline: 'Cyclically symmetric — labyrinth walk through a lattice of sines',
    about: 'Perfectly symmetric under cycling x→y→z→x. Because sin() repeats, ' +
      'phase space is an infinite 3-D lattice of unstable points, and the orbit ' +
      'wanders through it like a walk through a labyrinth. Thomas called the ' +
      'b→0 limit "labyrinth chaos": with almost no damping the trajectory ' +
      'diffuses across the lattice instead of settling anywhere. Below b ≈ 0.208 ' +
      'it is *usually* chaotic — but chaotic and periodic windows are ' +
      'interleaved, and the presets below step through both.',
    equations: ['ẋ = sin y − b x', 'ẏ = sin z − b y', 'ż = sin x − b z'],
    params: {
      b: { v: 0.1998, min: 0, max: 0.5, step: 0.0002, label: 'b', note: 'dissipation — windows of chaos below ≈0.208' }
    },
    init: [0.1, 0, 0.1], dt: 0.02, steps: 20,
    view: { yaw: -35, pitch: 22, center: [1.31, 1.31, 1.31], radius: 3 },
    palette: ['#0b3a2c', '#199e70', '#6fd6ac', '#e6fff5'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Chaotic',        p: { b: 0.1998 }, note: 'λ₁ ≈ +0.037. Bounded, dense, symmetric.' },
      { name: 'Quasi-periodic', p: { b: 0.19 }, note: 'λ₁ ≈ 0 — a torus, not chaos. The orbit never repeats yet never diverges.' },
      { name: 'Labyrinth walk', p: { b: 0.05 }, note: 'λ₁ ≈ +0.13. Weak damping — the orbit roams far across the lattice.' },
      { name: 'Periodic',       p: { b: 0.33 }, note: 'Order restored: one closed loop.' }
    ],
    tips: [
      'Compare the "Chaotic" and "Quasi-periodic" presets — they look almost identical on screen, and λ₁ in the diagnostics is the only thing that tells them apart. That is what the number is for.',
      'Set b = 0.05 with auto-fit on: the orbit keeps discovering new cells of the lattice and the view keeps pulling back.',
      'Every projection looks alike because the system is symmetric under x→y→z. Rotate and confirm it.'
    ],
    f: (x, y, z, p, o) => { o[0] = Math.sin(y) - p.b * x; o[1] = Math.sin(z) - p.b * y; o[2] = Math.sin(x) - p.b * z; }
  },

  chua: {
    name: 'Chua', year: 1983, author: 'Leon Chua', family: 'classic',
    tagline: 'Double scroll — the attractor you can solder',
    about: 'Chua designed a circuit — two capacitors, an inductor, a resistor ' +
      'and one nonlinear "Chua diode" — specifically to prove chaos was a real ' +
      'physical phenomenon and not a numerical artefact. It is the only entry ' +
      'here you can build on a breadboard and watch on an oscilloscope. The ' +
      'nonlinearity is piecewise-linear, which is why it is buildable at all.',
    equations: [
      'ẋ = α (y − x − h(x))',
      'ẏ = x − y + z',
      'ż = − β y',
      'h(x) = m₁x + ½(m₀−m₁)(|x+1| − |x−1|)'
    ],
    params: {
      alpha: { v: 15.6, min: 5, max: 30, step: 0.05, label: 'α', note: '1/C₁ — the fast capacitor' },
      beta:  { v: 28, min: 10, max: 60, step: 0.1, label: 'β', note: 'inductance term' },
      m0:    { v: -1.143, min: -2, max: 0, step: 0.001, label: 'm₀', note: 'inner slope of the diode' },
      m1:    { v: -0.714, min: -2, max: 0, step: 0.001, label: 'm₁', note: 'outer slope of the diode' }
    },
    init: [0.7, 0, 0], dt: 0.002, steps: 20,
    view: { yaw: 0, pitch: 0, center: [0, 0, 0], radius: 3.8 },
    palette: ['#4a1030', '#d55181', '#f5a8c4', '#ffe9f1'],
    section: { axis: 1, offset: 0 },
    presets: [
      { name: 'Double scroll', p: { alpha: 15.6, beta: 28, m0: -1.143, m1: -0.714 }, note: 'Both scrolls, orbit hopping between them.' },
      { name: 'Single scroll', p: { alpha: 8.8, beta: 28, m0: -1.143, m1: -0.714 }, note: 'Trapped on one side — a Rössler-like band.' },
      { name: 'Spiral',        p: { alpha: 6.5, beta: 28, m0: -1.143, m1: -0.714 }, note: 'Below the chaotic threshold entirely.' },
      { name: 'Wide scroll',   p: { alpha: 15.6, beta: 50, m0: -1.143, m1: -0.714 }, note: 'Stronger β pulls the scrolls flat.' }
    ],
    tips: [
      'Sweep α slowly from 6 up to 16 and you will watch a spiral become one scroll, then two. That is the whole bifurcation story in one slider.',
      'Reset the initial condition sign (x₀ = −0.7) with a single scroll active: the attractor mirrors. Two attractors coexist.',
      'The variables are physical: x and y are capacitor voltages, z is the inductor current. This picture is an oscilloscope trace.'
    ],
    f: (x, y, z, p, o) => {
      const h = p.m1 * x + 0.5 * (p.m0 - p.m1) * (Math.abs(x + 1) - Math.abs(x - 1));
      o[0] = p.alpha * (y - x - h); o[1] = x - y + z; o[2] = -p.beta * y;
    }
  },

  /* ----------------------------------------------------------------- modern */

  chen: {
    name: 'Chen', year: 1999, author: 'Guanrong Chen', family: 'modern',
    tagline: 'The attractor that escaped an attempt to control it',
    about: 'Chen was applying feedback control to the Lorenz system to tame it. ' +
      'The controlled system was not tamer — it was a new chaotic attractor, ' +
      'topologically *not* equivalent to Lorenz despite the family resemblance. ' +
      'It is often called the dual of Lorenz.',
    equations: ['ẋ = a (y − x)', 'ẏ = (c − a) x − x z + c y', 'ż = x y − b z'],
    params: {
      a: { v: 35, min: 20, max: 50, step: 0.1, label: 'a' },
      b: { v: 3, min: 1, max: 8, step: 0.02, label: 'b' },
      c: { v: 28, min: 15, max: 40, step: 0.05, label: 'c' }
    },
    init: [-0.1, 0.5, -0.6], dt: 0.0015, steps: 22,
    view: { yaw: 0, pitch: 0, center: [-1, -1.5, 29], radius: 31 },
    palette: ['#4a2a00', '#c98500', '#f0c46a', '#fff3d6'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Chaotic', p: { a: 35, b: 3, c: 28 }, note: 'The canonical Chen attractor.' },
      { name: 'Tight',   p: { a: 40, b: 3, c: 28 }, note: 'Faster contraction, denser winding.' },
      { name: 'Periodic',p: { a: 35, b: 3, c: 21 }, note: 'c below ≈ a/2 kills the chaos.' }
    ],
    tips: [
      'Put it next to Lorenz. Same silhouette at a glance; watch where the orbit crosses the middle and the difference is obvious.',
      'Chen sits in a family with Lorenz and Lü — Lü is the boundary case between them.'
    ],
    f: (x, y, z, p, o) => { o[0] = p.a * (y - x); o[1] = (p.c - p.a) * x - x * z + p.c * y; o[2] = x * y - p.b * z; }
  },

  lu: {
    name: 'Lü', year: 2002, author: 'Jinhu Lü & Guanrong Chen', family: 'modern',
    tagline: 'The bridge between Lorenz and Chen',
    about: 'Lorenz and Chen are the two ends of a continuous family of systems. ' +
      'The Lü attractor is the critical case in between — the system exactly on ' +
      'the boundary, belonging to neither. Useful for seeing that "the Lorenz ' +
      'attractor" is one point in a landscape, not an isolated object.',
    equations: ['ẋ = a (y − x)', 'ẏ = − x z + c y', 'ż = x y − b z'],
    params: {
      a: { v: 36, min: 20, max: 50, step: 0.1, label: 'a' },
      b: { v: 3, min: 1, max: 8, step: 0.02, label: 'b' },
      c: { v: 20, min: 10, max: 30, step: 0.05, label: 'c' }
    },
    init: [0.1, 0.1, 0.1], dt: 0.0015, steps: 22,
    view: { yaw: 0, pitch: 0, center: [-0.6, -0.8, 22], radius: 25 },
    palette: ['#2b1b52', '#9085e9', '#c9c2f5', '#f2f0ff'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Two scrolls', p: { a: 36, b: 3, c: 20 }, note: 'The standard Lü attractor.' },
      { name: 'Lorenz-like', p: { a: 36, b: 3, c: 28 }, note: 'Drifting toward the Lorenz end of the family.' }
    ],
    tips: ['Compare all three of Lorenz, Lü and Chen in the same projection (XZ). The family resemblance and the differences are both real.'],
    f: (x, y, z, p, o) => { o[0] = p.a * (y - x); o[1] = -x * z + p.c * y; o[2] = x * y - p.b * z; }
  },

  halvorsen: {
    name: 'Halvorsen', year: 1990, author: 'Arne Halvorsen', family: 'modern',
    tagline: 'Three interlocked scrolls, cyclically symmetric',
    about: 'Each equation is the same equation with the variables rotated, so ' +
      'the attractor has exact 3-fold symmetry about the diagonal x = y = z. ' +
      'Rotate the view until you are looking down that diagonal and the three ' +
      'scrolls line up like a propeller.',
    equations: ['ẋ = − a x − 4y − 4z − y²', 'ẏ = − a y − 4z − 4x − z²', 'ż = − a z − 4x − 4y − x²'],
    params: { a: { v: 1.4, min: 0.8, max: 2.2, step: 0.005, label: 'a', note: 'dissipation' } },
    init: [-5, 0, 0], dt: 0.004, steps: 14,
    view: { yaw: -45, pitch: 35, center: [-3.5, -3.5, -3.5], radius: 10 },
    palette: ['#0b3550', '#3987e5', '#8fc9f7', '#eaf6ff'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Standard', p: { a: 1.4 }, note: 'Three balanced scrolls.' },
      { name: 'Tight',    p: { a: 1.89 }, note: 'Higher damping — the scrolls pull in.' },
      { name: 'Near-escape', p: { a: 0.95 }, note: 'Barely bounded. Reduce speed and watch the excursions.' }
    ],
    tips: [
      'Use the ISO view, then drag until the three scrolls overlap exactly — you are now looking along x = y = z, the symmetry axis.',
      'At a = 0.9 the attractor nearly loses containment; the simulator auto-resets if a trajectory escapes to infinity.'
    ],
    f: (x, y, z, p, o) => {
      o[0] = -p.a * x - 4 * y - 4 * z - y * y;
      o[1] = -p.a * y - 4 * z - 4 * x - z * z;
      o[2] = -p.a * z - 4 * x - 4 * y - x * x;
    }
  },

  aizawa: {
    name: 'Aizawa', year: 1982, author: 'Yoji Aizawa', family: 'modern',
    tagline: 'A torus being torn open — the most sculptural of the set',
    about: 'A toroidal core with a spike pushed through it and a skirt spiralling ' +
      'off the equator. Six parameters make it the most tunable shape here, and ' +
      'it is the one most worth rotating: from the top it is a rosette, from the ' +
      'side an hourglass.',
    equations: [
      'ẋ = (z − b) x − d y',
      'ẏ = d x + (z − b) y',
      'ż = c + a z − z³/3 − (x² + y²)(1 + e z) + f z x³'
    ],
    params: {
      a: { v: 0.95, min: 0.2, max: 1.6, step: 0.005, label: 'a' },
      b: { v: 0.7, min: 0.1, max: 1.4, step: 0.005, label: 'b' },
      c: { v: 0.6, min: 0.05, max: 1.4, step: 0.005, label: 'c' },
      d: { v: 3.5, min: 1, max: 8, step: 0.02, label: 'd', note: 'rotation rate about the axis' },
      e: { v: 0.25, min: 0, max: 0.7, step: 0.005, label: 'e' },
      f: { v: 0.1, min: 0, max: 0.5, step: 0.005, label: 'f', note: 'symmetry-breaking term' }
    },
    init: [0.1, 0, 0], dt: 0.008, steps: 14,
    view: { yaw: -30, pitch: 18, center: [0, 0, 0.74], radius: 1.5 },
    palette: ['#4a1010', '#e66767', '#f6b3ac', '#fff0ec'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Standard', p: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 }, note: 'The classic sculpted torus.' },
      { name: 'Symmetric', p: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0 }, note: 'f = 0 restores rotational symmetry — the skirt closes up.' },
      { name: 'Wide skirt', p: { a: 1.2, b: 0.7, c: 0.6, d: 3.5, e: 0.1, f: 0.1 }, note: 'The outer band flares.' }
    ],
    tips: [
      'Set f = 0 and back to 0.1 — one term is what turns a symmetric surface into a strange attractor.',
      'Colour by speed: the orbit crawls at the poles and races around the equator, which is why the poles look solid.',
      'Compare the XY and XZ views. Genuinely two different objects to the eye.'
    ],
    f: (x, y, z, p, o) => {
      o[0] = (z - p.b) * x - p.d * y;
      o[1] = p.d * x + (z - p.b) * y;
      o[2] = p.c + p.a * z - z * z * z / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x;
    }
  },

  dadras: {
    name: 'Dadras', year: 2009, author: 'Sara Dadras & Hamid Momeni', family: 'modern',
    tagline: 'A knotted, four-winged tangle with five knobs',
    about: 'A relatively recent addition, designed to have a rich bifurcation ' +
      'structure rather than to model anything physical. With five parameters ' +
      'it is the best sandbox here for hunting bifurcations by hand.',
    equations: ['ẋ = y − a x + b y z', 'ẏ = c y − x z + z', 'ż = d x y − e z'],
    params: {
      a: { v: 3, min: 1, max: 6, step: 0.02, label: 'a' },
      b: { v: 2.7, min: 0.5, max: 5, step: 0.02, label: 'b' },
      c: { v: 1.7, min: 0.5, max: 4, step: 0.02, label: 'c' },
      d: { v: 2, min: 0.5, max: 4, step: 0.02, label: 'd' },
      e: { v: 9, min: 2, max: 15, step: 0.05, label: 'e' }
    },
    init: [1.1, 2.1, -2], dt: 0.003, steps: 16,
    view: { yaw: -20, pitch: 12, center: [0, -2, 0], radius: 19 },
    palette: ['#0d3b32', '#1baf7a', '#7fdcb8', '#e8fff7'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Knotted', p: { a: 3, b: 2.7, c: 1.7, d: 2, e: 9 }, note: 'The published chaotic regime.' },
      { name: 'Collapsed', p: { a: 3, b: 2.7, c: 1.7, d: 2, e: 12 }, note: 'e = 12 folds it into a simple limit cycle.' },
      { name: 'Wild', p: { a: 3, b: 2.7, c: 1.7, d: 1.2, e: 9 }, note: 'Weaker coupling, larger excursions.' }
    ],
    tips: [
      'Drag e slowly from 9 to 12 while watching λ₁ in the diagnostics. You are watching a bifurcation happen as a number.',
      'This one rewards a long trail — push the trail length to maximum.'
    ],
    f: (x, y, z, p, o) => { o[0] = y - p.a * x + p.b * y * z; o[1] = p.c * y - x * z + z; o[2] = p.d * x * y - p.e * z; }
  },

  rabinovich: {
    name: 'Rabinovich–Fabrikant', year: 1979, author: 'Mikhail Rabinovich & Anatoly Fabrikant', family: 'modern',
    tagline: 'Modulation instability in a nonlinear medium — famously delicate',
    about: 'Derived from the physics of waves in a dissipative medium, not ' +
      'invented as a toy — and the cautionary tale of the set. Neighbouring ' +
      'parameter values behave completely differently, several published ' +
      '"attractors" for it turned out to be artefacts of the integrator, and ' +
      'large regions of parameter space simply escape to infinity. The default ' +
      'here is the regime that measurably has λ₁ > 0.',
    equations: ['ẋ = y (z − 1 + x²) + γ x', 'ẏ = x (3z + 1 − x²) + γ y', 'ż = − 2z (α + x y)'],
    params: {
      alpha: { v: 1.1, min: 0.05, max: 1.5, step: 0.002, label: 'α' },
      gamma: { v: 0.87, min: 0.01, max: 1.2, step: 0.002, label: 'γ', note: 'dissipation' }
    },
    init: [-1, 0, 0.5], dt: 0.001, steps: 26,
    view: { yaw: -25, pitch: 15, center: [-1.12, 1.07, 0.72], radius: 1.4 },
    palette: ['#3d2a05', '#eda100', '#f8d98a', '#fff8e6'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Chaotic', p: { alpha: 1.1, gamma: 0.87 }, note: 'λ₁ ≈ +0.21 — solidly chaotic.' },
      { name: 'The famous picture', p: { alpha: 0.14, gamma: 0.1 }, note: 'The most-reproduced RF image. Measure it: λ₁ ≈ 0. Beautiful, and arguably not chaos at all.' },
      { name: 'Escape', p: { alpha: 0.05, gamma: 0.05 }, note: 'Unbounded — the orbit runs to infinity and the simulator keeps resetting. That is the point.' }
    ],
    tips: [
      'Load "The famous picture" and watch λ₁ settle near zero. Half the RF plots on the internet are of a torus captioned as a strange attractor.',
      'The "Escape" preset diverges. Not every parameter set has an attractor at all, and the auto-reset is what that looks like.',
      'Two of these presets are the same three equations. They share no visual resemblance whatsoever.'
    ],
    f: (x, y, z, p, o) => {
      o[0] = y * (z - 1 + x * x) + p.gamma * x;
      o[1] = x * (3 * z + 1 - x * x) + p.gamma * y;
      o[2] = -2 * z * (p.alpha + x * y);
    }
  },

  burkeshaw: {
    name: 'Burke–Shaw', year: 1981, author: 'Bill Burke & Robert Shaw', family: 'modern',
    tagline: 'A tightly wound double spiral from the Lorenz family',
    about: 'A close relative of Lorenz with the symmetry made explicit. Robert ' +
      'Shaw was one of the Santa Cruz "Chaos Cabal" — the graduate students who ' +
      'took chaos from a curiosity to a field, and who appear throughout ' +
      'Gleick\'s book.',
    equations: ['ẋ = − s (x + y)', 'ẏ = − y − s x z', 'ż = s x y + v'],
    params: {
      s: { v: 10, min: 3, max: 20, step: 0.05, label: 's' },
      v: { v: 4.272, min: 0.5, max: 10, step: 0.01, label: 'v' }
    },
    init: [0.6, 0, 0], dt: 0.002, steps: 18,
    view: { yaw: 0, pitch: 0, center: [0, 0, 0], radius: 2.3 },
    palette: ['#3b1550', '#9a54c9', '#d3a8ee', '#f8eeff'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Standard', p: { s: 10, v: 4.272 }, note: 'The published values.' },
      { name: 'Stretched', p: { s: 10, v: 1 }, note: 'Lower v, longer excursions.' },
      { name: 'Compact', p: { s: 14, v: 4.272 }, note: 'Higher s winds it tighter.' }
    ],
    tips: ['Rotate to the YZ view — the double spiral separates cleanly into two lobes.'],
    f: (x, y, z, p, o) => { o[0] = -p.s * (x + y); o[1] = -y - p.s * x * z; o[2] = p.s * x * y + p.v; }
  },

  finance: {
    name: 'Finance', year: 2001, author: 'Ma & Chen', family: 'modern',
    tagline: 'Interest rate, investment demand, price index — chaos in an economy',
    about: 'A three-variable macroeconomic model: x is the interest rate, y is ' +
      'investment demand, z is the price index. No external shocks, no noise, ' +
      'no news — and the trajectory still never repeats. The argument it makes ' +
      'is uncomfortable: an economy can be unforecastable purely because of its ' +
      'own internal feedback.',
    equations: ['ẋ = z + (y − a) x', 'ẏ = 1 − b y − x²', 'ż = − x − c z'],
    params: {
      a: { v: 0.001, min: 0, max: 2, step: 0.001, label: 'a', note: 'saving amount' },
      b: { v: 0.2, min: 0.05, max: 1, step: 0.005, label: 'b', note: 'cost per investment' },
      c: { v: 1.1, min: 0.2, max: 2.5, step: 0.005, label: 'c', note: 'elasticity of demand' }
    },
    init: [0.1, 0.2, -0.5], dt: 0.012, steps: 14,
    view: { yaw: -25, pitch: 15, center: [0, 0.6, 0], radius: 3 },
    palette: ['#0d3320', '#0ca30c', '#8ddc8d', '#eeffee'],
    section: { axis: 1, offset: 0 },
    presets: [
      { name: 'Chaotic', p: { a: 0.001, b: 0.2, c: 1.1 }, note: 'Boom and bust with no external cause.' },
      { name: 'High saving', p: { a: 1.2, b: 0.2, c: 1.1 }, note: 'The cycle damps out — order through saving.' },
      { name: 'Costly capital', p: { a: 0.001, b: 0.6, c: 1.1 }, note: 'Higher investment cost, tamer cycle.' }
    ],
    tips: [
      'Open the x/y/z time-series panel. This is the plot an economist would actually look at, and it looks like real market data.',
      'Raise a (the saving amount) and the chaos disappears. Whether that is economics or numerology is left to the reader.'
    ],
    f: (x, y, z, p, o) => { o[0] = z + (y - p.a) * x; o[1] = 1 - p.b * y - x * x; o[2] = -x - p.c * z; }
  },

  /* ---------------------------------------------------------------- minimal */

  sprottB: {
    name: 'Sprott B', year: 1994, author: 'Julien C. Sprott', family: 'minimal',
    tagline: 'Chaos with no parameters at all — five terms total',
    about: 'Sprott brute-forced millions of simple polynomial ODE systems by ' +
      'computer, looking for chaos, and catalogued the survivors. The result ' +
      'was a set of systems simpler than anyone had believed possible. There is ' +
      'nothing to tune here: the equations are already minimal.',
    equations: ['ẋ = y z', 'ẏ = x − y', 'ż = 1 − x y'],
    params: {},
    init: [0.1, 0, 0], dt: 0.01, steps: 12,
    view: { yaw: -20, pitch: 15, center: [-0.4, -0.15, -0.3], radius: 5.6 },
    palette: ['#123a4d', '#2596be', '#8ad4e8', '#eafaff'],
    section: { axis: 2, offset: 0 },
    presets: [],
    tips: [
      'No sliders. That absence is the whole point — chaos needs no fine tuning.',
      'Sprott found 19 distinct chaotic systems this simple. This is one of them.'
    ],
    f: (x, y, z, p, o) => { o[0] = y * z; o[1] = x - y; o[2] = 1 - x * y; }
  },

  sprottC: {
    name: 'Sprott C', year: 1994, author: 'Julien C. Sprott', family: 'minimal',
    tagline: 'One term different from Sprott B, a different attractor',
    about: 'Identical to Sprott B except the last term is x² instead of xy. One ' +
      'character of difference in the source code, a visibly different object in ' +
      'phase space.',
    equations: ['ẋ = y z', 'ẏ = x − y', 'ż = 1 − x²'],
    params: {},
    init: [0.1, 0, 0], dt: 0.01, steps: 12,
    view: { yaw: -20, pitch: 15, center: [-0.15, 0, -2.2], radius: 8.4 },
    palette: ['#2b1b52', '#6c5ce0', '#b6acf2', '#f0edff'],
    section: { axis: 2, offset: 0 },
    presets: [],
    tips: ['Flip between Sprott B and C. The single changed term is worth staring at.'],
    f: (x, y, z, p, o) => { o[0] = y * z; o[1] = x - y; o[2] = 1 - x * x; }
  },

  nosehoover: {
    name: 'Nosé–Hoover', year: 1984, author: 'Shuichi Nosé & William Hoover', family: 'minimal',
    tagline: 'A thermostat for molecular dynamics — conservative, not dissipative',
    about: 'The odd one out. Every other attractor here is dissipative: volumes ' +
      'in phase space shrink onto a set of zero volume. Nosé–Hoover is ' +
      'conservative — volume is preserved — so strictly there is no attractor at ' +
      'all, just a chaotic sea in which the orbit wanders forever. Watch the Σλ ' +
      'diagnostic sit at zero instead of going negative.',
    equations: ['ẋ = y', 'ẏ = − x + y z', 'ż = a − y²'],
    params: { a: { v: 1.5, min: 0.5, max: 3, step: 0.005, label: 'a', note: 'thermostat set point' } },
    init: [0, 5, 0], dt: 0.008, steps: 14,
    view: { yaw: -25, pitch: 15, center: [0, -0.3, 0.1], radius: 6.1 },
    palette: ['#402c05', '#c98500', '#f0cc7f', '#fff6e0'],
    section: { axis: 2, offset: 0 },
    presets: [
      { name: 'Standard', p: { a: 1.5 }, note: 'Chaotic sea.' },
      { name: 'Tori', p: { a: 1 }, note: 'Nested tori — try several resets from different starts.' }
    ],
    tips: [
      'Look at Σλ in the diagnostics: ≈ 0 here, clearly negative for every other system. That is the difference between a chaotic sea and a strange attractor.',
      'Reset repeatedly. Unlike a real attractor, where you start genuinely changes where you end up.'
    ],
    f: (x, y, z, p, o) => { o[0] = y; o[1] = -x + y * z; o[2] = p.a - y * y; }
  }
};

const FAMILIES = [
  { id: 'classic', label: 'Classics' },
  { id: 'modern',  label: 'The wider zoo' },
  { id: 'minimal', label: 'Minimal & unusual' }
];
