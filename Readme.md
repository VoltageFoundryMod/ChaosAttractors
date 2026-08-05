# Strange Attractors

An interactive study guide to deterministic chaos: fifteen chaotic systems,
integrated live in the browser, with a rotatable 3-D view, parameter sweeps,
Poincaré sections, and Lyapunov diagnostics computed as you watch.

**Open `index.html` in a browser.** No build step, no server, no dependencies —
double-clicking the file works.

```text
index.html      the simulator — layout and controls
styles.css      the stylesheet (dark by default, light theme included)
attractors.js   the catalogue: equations, parameters, notes. Start here.
app.js          integrator, camera, renderer, diagnostics

guide.html      this document, rendered as a reference page
build-guide.js  regenerates guide.html from Readme.md
md.js           the Markdown converter, shared by the build and the page
analytics.js    the visitor-count tag, on both pages, off outside the live site

.github/workflows/pages.yml   publishes the site to GitHub Pages
```

The **📖 Reference** button in the simulator opens `guide.html` — this file with a
contents sidebar, in the same theme, in its own tab so the simulation keeps
running. Each attractor's info panel also links to the section of §4 that covers
it.

`guide.html` is generated and committed, so it works when opened directly from
disk — browsers refuse to `fetch()` a local file from a `file://` page, so
rendering the Markdown at runtime would break the double-click case. **After
editing this Readme, run `node build-guide.js`** to regenerate it. That script
is the project's only build step and has no dependencies.

**The ⟳ Refresh button** on the reference page re-renders it from the current
`Readme.md` without a terminal. It cannot run `build-guide.js` — a web page has
no shell and no write access to disk, on any protocol — so what it does instead
depends on how the page was opened:

| Opened as                    | What Refresh does                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `http://` (any local server) | fetches `Readme.md` and re-renders immediately                                          |
| `file://`                    | `fetch` is blocked by the opaque origin, so it opens a file picker — choose `Readme.md` |

You can also **drag a `.md` file onto the page** at any time, which works in both
cases. Both routes use the same converter as the build, `md.js`, so the result
is identical to what the script would produce.

The re-render lives in that tab only; nothing is written. When you are happy
with it, run `node build-guide.js` to update the committed page.

**Publishing.** `.github/workflows/pages.yml` deploys the site to GitHub Pages on
every push to `main`, and can be run by hand from the Actions tab. It checks that
the scripts parse, regenerates `guide.html` from this file, and publishes — so
the deployed reference is never stale, and it warns in the run log if the
committed copy had drifted.

The published site is **[chaos.vfmod.com](https://chaos.vfmod.com)**, and it is
served without file extensions — `/` and `/guide`, since GitHub Pages resolves
those to the two HTML files on its own. Opened from disk there is no server to
do that, so the links carry a `data-file` fallback that the page swaps in when
it sees a `file://` address. Anything new that the site needs has to be added to
the `cp` line in the workflow, or it will be missing from the deploy.

---

## 1. What a strange attractor is

Take a system whose future is completely determined by its present — three
coupled differential equations, no randomness anywhere. Start it somewhere and
let it run. Three things can happen:

- it settles onto a **fixed point** and stops;
- it settles onto a **limit cycle** and repeats forever;
- or it settles onto a **strange attractor** — a bounded region it never leaves
  and a path it never retraces.

The third case is the interesting one. The orbit is confined, so it cannot run
away. It never repeats, so it cannot be predicted by looking up what happened
last time. And it is _attracting_: start anywhere in a large surrounding volume
and you are pulled onto the same shape. The shape is the destiny of the system.

Four properties, together, are what "chaos" means:

| Property                        | What it means                                     | Where you see it here                |
| ------------------------------- | ------------------------------------------------- | ------------------------------------ |
| Deterministic                   | no noise, no randomness; same input → same output | reset twice, get the identical orbit |
| Bounded                         | the orbit never escapes to infinity               | the attractor stays in frame         |
| Aperiodic                       | it never exactly repeats                          | the trail never closes               |
| Sensitive to initial conditions | nearby starts diverge exponentially               | λ₁ > 0 in the diagnostics            |

That last property is the definition, and it is measurable — which is what most
of the instrumentation in this simulator exists to do.

### The mechanism: stretch and fold

Bounded _and_ exponentially diverging sounds contradictory. It is not, and
Rössler's attractor is the clearest demonstration: the orbit spirals outward in
a plane (**stretching** — neighbours pull apart), and when it strays too far it
is lifted, carried over, and dropped back near the centre (**folding** — distant
points are brought back together). Stretch pulls information apart; fold keeps
the whole thing in a box. Repeat forever and you get a set that is infinitely
layered — a fractal.

Watch it happen: load **Rössler**, use the **XY** view to see the spiral, then
**XZ** to see the fold that is invisible edge-on.

### The story

In 1961 Edward Lorenz was re-running a weather simulation and, to save time,
restarted it from the middle by typing in a value from a printout: `0.506`
instead of the stored `0.506127`. The new run tracked the old one for a while,
then diverged completely. A difference of one part in four thousand — far below
any measurement precision that could ever exist for the atmosphere — had
rewritten the forecast.

He published the three-equation model in 1963 as _Deterministic Nonperiodic
Flow_, and gave a 1972 talk titled _"Does the flap of a butterfly's wings in
Brazil set off a tornado in Texas?"_ The name stuck.

The uncomfortable implication is not that weather is complicated. It is that
**three simple equations are enough**. Complexity in nature does not require
complex causes.

---

## 2. Reading the diagnostics

The four numbers under the canvas are the reason this is a study guide and not a
screensaver. They are estimated live and need a few thousand steps to settle;
they reset whenever you touch a parameter.

### λ₁ — the largest Lyapunov exponent

Two orbits starting a distance _d₀_ apart separate roughly as

```text
d(t) ≈ d₀ · e^(λ₁ t)
```

**λ₁ > 0 is the definition of chaos.** It is measured here by Benettin's
algorithm: carry a shadow orbit a tiny fixed distance away, advance both one
step, record how much the gap grew, then pull the shadow back to the original
distance along the same direction. The average of log(growth) per unit time is
λ₁.

The practical meaning is a **forecast horizon**. To keep prediction error under
some tolerance, halving your initial uncertainty buys you only `ln2 / λ₁` more
time. For Lorenz (λ₁ ≈ 0.9) that is about 0.8 time units per doubling of
precision — which is why a thousandfold better measurement extends the forecast
by a factor of nothing much. Turn on the **divergence panel** with two ghost
trajectories to see this as a picture: a straight exponential ramp, then a hard
ceiling where the two orbits are as far apart as the attractor is wide and the
forecast is worth exactly zero.

### Σλ — the divergence of the flow

∇·F, averaged along the orbit: the rate at which a blob of initial conditions
loses volume. For dissipative systems it is negative, and every visible detail
of the attractor follows from the combination:

> **volume shrinks to zero (Σλ < 0) while lengths grow (λ₁ > 0).**

A set that has zero volume but is stretched in one direction and squeezed in
another, folded over on itself endlessly, is a fractal. Not by decoration —
by arithmetic.

For Lorenz this is exactly constant, and the simulator's numerical estimate
reproduces it to three decimals:

```text
Σλ = −(σ + 1 + β) = −(10 + 1 + 8/3) = −13.667
```

Thomas is another clean one: `Σλ = −3b`, so at b = 0.1998 the panel reads
−0.599.

### D — the Kaplan–Yorke dimension

```text
D = 2 + λ₁ / |λ₃|      (taking λ₂ ≈ 0 and λ₃ = Σλ − λ₁)
```

A _fractional_ dimension. Lorenz settles near **2.06**: not a surface (2), not a
solid (3), but a surface that is just barely thicker than a surface. This number
is what the word "fractal" actually means mathematically, and you can watch it
converge.

### separation

Straight-line distance between the reference orbit and the first ghost, once
ghost trajectories are switched on.

---

## 3. Using it

### Layout

The **left column** is the catalogue. The **centre** is the phase-space view plus
the diagnostics and a selectable panel. The **right column** holds the equations,
parameter sliders, named regimes worth visiting, simulation settings, and notes
for the current system.

### The view

Drag to rotate, wheel to zoom, shift-drag to pan, double-click to reset. **XZ /
XY / YZ / ISO** snap to standard projections, and the little gizmo in the corner
shows where each axis currently points. Several attractors are unrecognisable
between one projection and another — Aizawa most dramatically.

Trail colour can encode **age** (default), **speed** (where the orbit lingers vs.
races — try it on Aizawa) or **depth** (distance from the camera).

### The lower panel

- **x, y, z vs time** — the same orbit unrolled. Three separate strips with
  three independent scales, because the variables have different ranges and
  stacking them on one axis would be a lie. This is what an experimentalist
  would actually have recorded.
- **divergence of nearby starts** — log separation vs time, with the measured λ₁
  slope drawn alongside and the saturation ceiling marked. Needs at least one
  ghost trajectory; it turns one on for you.
- **Poincaré section** — instead of watching the whole flow, record only where
  it pierces a chosen plane. A continuous 3-D flow collapses to a discrete 2-D
  map, and the fractal cross-section becomes directly visible: for Rössler the
  crossings fall on what is very nearly a curve, and that curve is essentially
  the logistic map in disguise.

### Keyboard

| Key             | Action                            |
| --------------- | --------------------------------- |
| `Space`         | pause / resume                    |
| `R` · `C`       | reset the orbit · clear the trail |
| `1` `2` `3` `4` | XZ · XY · YZ · ISO                |
| `←` `→` `↑` `↓` | rotate                            |
| `+` `−`         | zoom                              |
| `F` · `S`       | fit the view · toggle spin        |
| `[` `]`         | previous / next attractor         |
| `G`             | add / remove a ghost trajectory   |

Each attractor has its own URL: [chaos.vfmod.com/#aizawa](https://chaos.vfmod.com/#aizawa), or
`index.html#aizawa` on disk.

### What is remembered

The simulation settings — speed, trail length, line weight, glow, auto-fit,
the gizmo, the colour mode, the lower panel, ghosts and ε — are stored in this
browser and come back on your next visit, along with the theme. **Reset
settings** in the Simulation panel puts them all back.

Parameter values are deliberately _not_ remembered. Every attractor opens at
its published values, because a slider you nudged last week quietly changing
what Lorenz looks like today would make every number in this guide a lie.
Within a session, **Restore published values** does the same job for one
system.

---

## 4. The catalogue

λ₁ below was measured by integrating each system at its default parameters for
the time span shown, using the same RK4 core the browser runs. The published
values, where they exist, agree — Sprott's own tabulated exponents for cases B
and C are 0.210 and 0.163.

### The classics

| System      | Year | λ₁     | Note                                            |
| ----------- | ---- | ------ | ----------------------------------------------- |
| **Lorenz**  | 1963 | +0.904 | Atmospheric convection. The original.           |
| **Rössler** | 1976 | +0.077 | Minimal chaos — one nonlinear term.             |
| **Thomas**  | 1999 | +0.039 | Cyclically symmetric; a walk through a lattice. |
| **Chua**    | 1983 | +0.433 | Double scroll — and buildable in hardware.      |

```text
Lorenz      ẋ = σ(y − x)          σ = 10, ρ = 28, β = 8/3
            ẏ = x(ρ − z) − y
            ż = xy − βz

Rössler     ẋ = −y − z            a = 0.2, b = 0.2, c = 5.7
            ẏ = x + ay
            ż = b + z(x − c)

Thomas      ẋ = sin y − bx        b = 0.1998
            ẏ = sin z − by
            ż = sin x − bz

Chua        ẋ = α(y − x − h(x))   α = 15.6, β = 28
            ẏ = x − y + z         m₀ = −1.143, m₁ = −0.714
            ż = −βy
            h(x) = m₁x + ½(m₀ − m₁)(|x + 1| − |x − 1|)
```

**Lorenz.** Drop ρ below 24.74 and the attractor dies — the orbit falls into a
fixed point and stays. ρ = 24 gives a long chaotic _transient_ that eventually
collapses, which is a useful reminder that "looks chaotic for a while" and "is
chaotic" are different claims. Chaos is also not monotone in ρ: the preset at
ρ = 99.65 is a clean periodic window sitting inside the chaotic range.

**Rössler.** The presets walk the **period-doubling cascade** — period-1 at
c = 2.5, period-2 at 3.5, period-4 at 4.1, chaos at 5.7. Each split happens at a
smaller interval than the last, by a universal ratio (Feigenbaum's δ ≈ 4.669)
that is the same for an enormous class of unrelated systems. Five clicks, and
you have seen one of the deepest results in the field.

**Thomas.** Below b ≈ 0.208 it is _usually_ chaotic, but chaotic and periodic
windows are interleaved, and this is the system where that matters most. The
b = 0.19 preset and the b = 0.1998 preset look nearly identical on screen; λ₁ is
0 for one and +0.037 for the other. One is a torus, the other is chaos. **This
is what the number is for.** (A curiosity: the diagonal x = y = z is an
invariant subspace, so an initial condition on it can never leave — the orbit
collapses to a point.)

**Chua.** Sweep α from 6 to 16 and watch a spiral become one scroll, then two.
The variables are physical: x and y are capacitor voltages, z is an inductor
current, and the whole thing is a real circuit — two capacitors, an inductor, a
resistor, and the "Chua diode" (a couple of op-amps with resistors). On a
breadboard with a 9-volt battery it produces genuine physical chaos on an
oscilloscope. It is the standard demonstration that chaos is not an artefact of
computer arithmetic.

### The wider zoo

| System                   | Year | λ₁     | Note                                                |
| ------------------------ | ---- | ------ | --------------------------------------------------- |
| **Chen**                 | 1999 | +2.025 | Found while _trying to control_ Lorenz.             |
| **Lü**                   | 2002 | +1.387 | The critical case between Lorenz and Chen.          |
| **Halvorsen**            | 1990 | +0.675 | 3-fold cyclic symmetry about x = y = z.             |
| **Aizawa**               | 1982 | +0.094 | A torus being torn open. Six parameters.            |
| **Dadras**               | 2009 | +0.421 | Knotted; five parameters to hunt bifurcations with. |
| **Rabinovich–Fabrikant** | 1979 | +0.200 | Wave physics. Notoriously delicate.                 |
| **Burke–Shaw**           | 1981 | +0.695 | Tightly wound double spiral.                        |
| **Finance**              | 2001 | +0.095 | Interest rate, investment demand, price index.      |

**Chen** is the good story: Guanrong Chen applied feedback control to the Lorenz
system to tame it, and the controlled system turned out to be a _new_ chaotic
attractor — topologically not equivalent to Lorenz despite the resemblance. Lü
later found the system exactly on the boundary between them. Put all three in
the XZ view in turn; the family resemblance and the differences are both real.

**Halvorsen** has each equation identical to the last with the variables
rotated, so the attractor has exact 3-fold symmetry about the diagonal. Rotate
until the three scrolls line up and you are looking straight down x = y = z.

**Finance** is what it says: x is the interest rate, y is investment demand, z is
the price index. There are no shocks, no news, and no noise in the model, and
the trajectory still never repeats. It is a mathematical argument that an
economy can be unforecastable purely from its own internal feedback. Open the
time-series panel — it looks like market data because it is the same kind of
object.

**Rabinovich–Fabrikant** is the cautionary tale, and it is worth dwelling on.
The most-reproduced picture of it, at α = 0.14, γ = 0.10, measures **λ₁ ≈ 0** —
it is a torus, not a strange attractor, and it is captioned wrongly all over the
internet. Meanwhile α = 1.1, γ = 0.87 (the default here) gives a genuinely
chaotic attractor that looks nothing like it, and α = 0.05, γ = 0.05 escapes to
infinity, which the simulator shows you by repeatedly resetting. Same three
equations, three completely different fates. Several published RF "attractors"
have turned out to be artefacts of the integrator.

### Minimal and unusual

| System          | Year | λ₁     | Note                                |
| --------------- | ---- | ------ | ----------------------------------- |
| **Sprott B**    | 1994 | +0.207 | Chaos with no parameters at all.    |
| **Sprott C**    | 1994 | +0.161 | One term different from B.          |
| **Nosé–Hoover** | 1984 | +0.038 | Conservative — no attractor at all. |

```text
Sprott B    ẋ = yz      Sprott C    ẋ = yz      Nosé–Hoover   ẋ = y
            ẏ = x − y               ẏ = x − y                 ẏ = −x + yz
            ż = 1 − xy              ż = 1 − x²                ż = a − y²
```

Julien Sprott brute-forced millions of simple polynomial ODE systems by computer
looking for chaos, and catalogued the survivors — about 19 distinct minimal
systems. There are **no sliders** on B and C, and that absence is the entire
point: chaos needs no fine tuning. B and C differ by a single character, and
they are visibly different objects.

**Nosé–Hoover** is the odd one out and the most instructive comparison in the
set. It is a thermostat from molecular dynamics, and it is _conservative_: phase
space volume is preserved, so Σλ ≈ 0 rather than negative. With no contraction,
there is nothing for orbits to be attracted _to_ — no attractor exists. What you
are watching is a chaotic _sea_, and unlike every other system here, where you
start genuinely determines where you stay. Reset it several times and compare;
then look at Σλ, and at every other system's Σλ.

---

## 5. The playground

The last entry in the catalogue, **Custom**, is a blank system: type three
expressions and watch what they do. The diagnostics turn it into something more
useful than a drawing toy — they tell you _what you found_, in one line under the
equations:

```text
chaotic · λ₁ = +0.350
λ₁ ≈ 0 · not chaos — a cycle, a torus, or drifting to a stop
settled onto a fixed point — the orbit has stopped moving
escaping to infinity — try a smaller dt, or smaller parameters
```

Write the right-hand sides in JavaScript. `x`, `y` and `z` are the state; **any
other name becomes a parameter and gets its own slider automatically**, so
`a * (y - x)` produces an `a` you can drag. `sin`, `cos`, `exp`, `sqrt`, `abs`,
`**` and the rest of `Math` are available unprefixed, and pasted `−`, `×`, `·`,
`²`, `³` and `^` are converted for you. Parameter values are typeable as well as
draggable, since a slider range for an unknown system is only a guess — type a
value outside it and the range widens.

Below the equations are `x₀ y₀ z₀` and `dt`. **The `dt` box matters more than it
looks.** A system that flies off to infinity may be genuinely unbounded, or may
just be outrunning the integrator; halving `dt` distinguishes the two. Whatever
is in the editor survives a reload on its own — but only the one you were last
working on, which is what **Saved systems** is for.

### Keeping what you find

**Save** stores the equations, the parameters and their ranges, the initial
condition and `dt` under a name; saving again under the same name replaces it.
Click a saved system to load it, `✕` to delete it. They live in this browser,
which means a cleared cache or a different machine does not have them —
so:

- **Export** writes every saved system to one `.json` file.
- **Import**, or dragging a `.json` anywhere onto the page, reads one back.
  Files from anywhere are accepted: our own export, a bare array of systems, or
  a single system on its own.

Every imported system is compiled and test-fired before it is accepted, and
anything that fails is skipped with the reason — a file that is half-wrong
imports the half that works rather than breaking the editor. One caution
follows from the design of the playground: **the equations are JavaScript**, so
import files from people you trust, exactly as you would a script.

The **Start from** buttons load a seed you can mutate, which is where the real
learning is. Load Lorenz, change `x * y` to `x * x` in the ż equation, and you
get a completely different chaotic attractor with λ₁ = +0.35. Delete a term and
it usually collapses.

That collapse is the honest base rate, and it is worth internalising: **most
things you type are not chaotic.** They decay to a point or explode. This is
exactly why Sprott had to search millions of candidate systems by computer to
find his nineteen — and it makes the fact that Lorenz stumbled onto one while
modelling the weather look much less inevitable than it does in retrospect.

Two rules of thumb for hunting: chaos needs **at least three dimensions** and
**at least one nonlinear term** (a purely linear system can only decay, explode,
or oscillate). Those are necessary, nowhere near sufficient, and the rest is
searching.

To add a permanent system rather than a scratch one, see §8 — or add to the
`seeds` array in the `custom` entry to make it a starting point.

---

## 6. A suggested path

1. **Lorenz, ghosts on, ε = 1e−6, divergence panel.** Watch two orbits agree
   perfectly, then not. This is the whole subject in one screen.
2. **Lorenz, ρ from 28 down through 24.74.** Chaos → long transient → a fixed
   point. Attractors are born and die as parameters move.
3. **Rössler, the five presets in order.** The period-doubling road to chaos.
4. **Rössler, Poincaré section on x = 0.** A 3-D flow becomes a 1-D map.
5. **Thomas, "Chaotic" vs "Quasi-periodic".** Two pictures you cannot tell
   apart, and one number that tells them apart.
6. **Nosé–Hoover, and Σλ.** Why "strange attractor" and "chaos" are not
   synonyms.
7. **Rabinovich–Fabrikant, "The famous picture".** Why you should measure things
   rather than trust captions — including the ones in this file.
8. **Lorenz, watch D converge to ≈ 2.06.** A dimension that is not a whole
   number.

---

## 7. How it works

Nothing is pre-rendered or cached. Every frame integrates the differential
equations forward and redraws from the resulting state.

**Integration.** Classical 4th-order Runge–Kutta at a fixed step, 12–26 steps per
animation frame depending on the system's timescale. The step size `dt` is
chosen per attractor; the speed slider changes how many steps run per frame, not
the step size, so accuracy does not change when you speed it up. Each step
evaluates the vector field four times, and the field functions are written as
`f(x, y, z, p, out)` — writing into a preallocated array rather than returning a
new one — so that thousands of steps per second allocate nothing and never
trigger garbage collection mid-animation. If a trajectory escapes to infinity,
it is detected and reset.

**Projection.** Trail points are stored in 3-D in a fixed-capacity ring buffer
and projected each frame through a yaw/pitch orthographic camera, which is why
you can rotate a trail that was integrated minutes ago. Depth modulates opacity
and line weight to give the shape solidity. The view auto-fits by tracking the
bounding box of the retained trail and easing towards it, so an attractor that
grows — Thomas at low b keeps discovering new cells of its lattice — stays in
frame.

**Rendering.** Drawing 12 000 individual segments as 12 000 strokes would be far
slower than a canvas can afford. Instead each segment is quantised into one of
`colour × opacity` buckets and appended to that bucket's `Path2D`; the frame then
costs one stroke per non-empty bucket, usually well under a hundred. Glow is
applied only to the brightest buckets, where it actually reads.

**λ₁** is Benettin's algorithm as described above. **Σλ** is ∇·F by central
differences, sampled along the orbit and averaged. **Poincaré crossings** are
detected by sign change against the plane and located by linear interpolation
between the two straddling steps. The **divergence history** keeps its full
record back to launch rather than a rolling window: when the buffer fills, every
second sample is dropped and the sampling interval doubles, so resolution decays
but the exponential ramp never scrolls off the left edge.

**Colour.** The trail ramps are per-attractor and reverse themselves in light
mode, so the freshest arc is always the most visible against whichever
background is behind it. The three-series palette used in the diagnostic panels
is checked for colour-vision-deficiency separation and contrast against both the
dark and light canvas surfaces.

### Honest numerics

Because these systems are chaotic, the computed orbit **is not** the true orbit
through your initial point. Round-off at each step acts exactly like the
perturbation the diagnostics measure, and it grows at rate λ₁: after enough time
the trajectory on screen has no relation to the mathematical one you asked for.
No integrator avoids this, and a smaller step size only postpones it.

What survives is everything that matters. The _shape_ of the attractor, its
dimension, its exponents, and its statistics are robust — and there is a theorem
about why: the **shadowing lemma** says that a numerical orbit with small
per-step error stays close to _some_ true orbit of the system, just not the one
you started with. You are looking at a real trajectory of the real system. You
are simply not looking at the one you requested, and for chaotic systems that
distinction turns out not to matter.

The two corrections in this repo's own defaults came from taking this seriously
and measuring rather than copying: Thomas at the widely-quoted b = 0.19 is a
torus, and Rabinovich–Fabrikant's most famous parameters are not measurably
chaotic.

---

## 8. Adding your own

Everything a system needs is one object in `attractors.js`; nothing there knows
about rendering. The minimum is:

```js
myattractor: {
  name: 'Mine', year: 2026, author: 'You', family: 'modern',
  tagline: 'One line',
  about: 'A few sentences.',
  equations: ['ẋ = …', 'ẏ = …', 'ż = …'],
  params: { a: { v: 1, min: 0, max: 3, step: 0.01, label: 'a' } },
  init: [0.1, 0, 0],
  dt: 0.005, steps: 14,
  view: { yaw: 0, pitch: 0, center: [0, 0, 0], radius: 10 },
  palette: ['#0b3550', '#3987e5', '#8fc9f7', '#eaf6ff'],
  f: (x, y, z, p, o) => { o[0] = …; o[1] = …; o[2] = …; }
}
```

The framing values do not need to be right — auto-fit corrects them. If λ₁
settles near zero you have found a limit cycle or a torus, not chaos; nudge a
parameter and try again.

---

## 9. Glossary

**Attractor** — a set that nearby trajectories converge onto. **Strange
attractor** — one with fractal structure and sensitive dependence.
**Basin of attraction** — the set of starting points that end up on it.
**Bifurcation** — a qualitative change in behaviour as a parameter crosses a
threshold. **Period doubling** — a bifurcation where the orbit's period doubles;
an infinite cascade of them is one standard route to chaos.
**Dissipative** — phase-space volume contracts (Σλ < 0). **Conservative** —
volume is preserved (Σλ = 0); no attractors possible.
**Lyapunov exponent** — the exponential rate at which nearby orbits separate.
**Fractal dimension** — a non-integer measure of how a set fills space.
**Poincaré section** — the record of a flow's crossings of a chosen surface,
turning a continuous flow into a discrete map.
**Phase space** — the space whose coordinates are the system's state variables;
one point is one complete state. **Quasi-periodic** — motion with two or more
incommensurable frequencies: never repeating, but not chaotic (λ₁ = 0).
**Shadowing** — the property that a numerical orbit stays close to some true
orbit.

---

## 10. Further reading

- **James Gleick, _Chaos: Making a New Science_ (1987)** — the book that opened
  this up for everyone. Reads like a thriller, requires no mathematics, and the
  people in it (Lorenz, Rössler, Shaw, Feigenbaum, Mandelbrot) are the names
  attached to half the systems in this catalogue.
- **Steven Strogatz, _Nonlinear Dynamics and Chaos_** — the standard textbook,
  and unusually well written. Takes you from zero to deriving these systems
  yourself, with strong physical intuition throughout.
- **Julien C. Sprott, _Chaos and Time-Series Analysis_** and his
  [website](http://sprott.physics.wisc.edu/) — the systematic catalogue, plus
  the numerical methods used in this simulator.
- **Edward Lorenz, "Deterministic Nonperiodic Flow", _J. Atmos. Sci._ 20 (1963)**
  — the original paper. Short, and readable.
- Each attractor's panel links its own key paper and a reference page.

### Where this shows up elsewhere

The same mathematics describes dripping faucets, cardiac arrhythmias, population
cycles in ecology, and turbulence — same equations, different variable names.
Beyond the science, these systems have two lives worth knowing about. In
**circuit design**, the Chua family is directly synthesisable in analog hardware.
In **analog synthesis**, Thomas, Rössler and Chua are popular patch targets:
routed into a modular synth they make LFOs and control voltages that evolve
forever without repeating — bounded, structured, and never the same twice, which
is a difficult thing to get from a noise source or a sequencer.

---

© 2026 [Carlos Eduardo de Paula](https://vfmod.com) ·
[Voltage Foundry Modular](https://vfmod.com) ·
[chaos.vfmod.com](https://chaos.vfmod.com)
