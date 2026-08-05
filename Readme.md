Here's a deep dive into all four chaotic attractors — what they are, how they differ, and an interactive simulator with all the controls you asked for.

---

**Chaotic attractors** are solutions to sets of differential equations that never repeat, yet stay bounded within a characteristic shape in 3D space. They're the mathematical fingerprints of deterministic chaos — tiny differences in starting conditions produce wildly different trajectories (the "butterfly effect"), but the overall _shape_ remains stable.

**Lorenz** (1963) — the original. Models atmospheric convection. Its iconic double-wing shape emerges from three parameters: σ (sigma, the Prandtl number), ρ (rho, the Rayleigh number), and β (beta, geometric factor). Sensitive to ρ especially — classic chaos happens around ρ=28.

**Rössler** (1976) — much simpler equations, designed by Otto Rössler to produce chaos with minimal complexity. One nonlinear term only (`xz`). Produces a spiraling band that folds back on itself. Parameters a, b, c — raising `c` beyond ~4 pushes it into full chaos.

**Thomas** (1999) — proposed by René Thomas, beautifully symmetric. All three equations have the same form: each variable drives the next through a sine function. One parameter `b` controls dissipation — near `b=0.18` it enters chaotic regime. Has a crystalline, almost organic look.

**Chua** (1983) — the only one that can be built as a real analog circuit (Chua's circuit). Uses a piecewise-linear nonlinear resistor. Parameters α and β control its double-scroll attractor shape. It's the go-to for chaos demonstrations in electronics and is directly synthesizable in hardware.Here's what to play with in the simulator:

**Reset** drops the trajectory back to the initial condition — try tweaking a parameter by a tiny amount, then resetting to see how differently the orbit develops. That's the butterfly effect in action.

**Amplitude** scales the projection without changing the dynamics, so you can zoom in on dense regions of the attractor.

**Parameter exploration worth trying:**

- Lorenz: drop ρ below 24 — the attractor collapses to a fixed point (no more chaos)
- Rössler: sweep `c` from 3 → 8 and watch period-doubling bifurcations before full chaos
- Thomas: push `b` up toward 0.32 — the attractor geometry changes dramatically
- Chua: tweak α and watch it shift between single-scroll and double-scroll regimes

**DIY angle**: Chua's circuit is directly buildable on a breadboard — you need two capacitors, an inductor, a resistor, and the "Chua diode" (which is just two op-amps with resistors). The chaotic waveform shows up on an oscilloscope. Thomas and Rössler are also popular analog synth targets — patching them into a modular synth gives you unpredictably evolving LFOs that never repeat.

Yes, there are quite a few more! Here's a tour of some of the most interesting ones, then I'll build an expanded simulator.

**Halvorsen** — a cyclic attractor with 3-fold rotational symmetry, like three interlocked spirals. Parameter `a` controls the dissipation rate.

**Dadras** — discovered in 2009, produces a very unusual knotted torus-like shape. Has 5 parameters giving it rich bifurcation behavior.

**Aizawa** — looks almost like a glass donut being pulled apart. Has a toroidal core with a spiraling skirt. Six parameters, highly visual.

**Burke-Shaw** — compact and figure-eight-ish, originally studied in the context of fluid dynamics and optics.

**Sprott B & C** — Julian Sprott systematically searched through millions of 3D ODE systems in the 1990s and catalogued dozens of minimal chaotic systems. B and C are among the most elegant — just 3 terms each.

**Lorenz 96** — a high-dimensional generalization Lorenz made in 1996 for weather modeling. Even in its 3D projection it looks very different from the original.

**Chen** — discovered by Guanrong Chen in 1999 while trying to _control_ the Lorenz attractor. It escaped control and became its own attractor — a great chaos-theory story.

**Finance attractor** — yes, really. Proposed to model boom-bust cycles in economics. Three variables: interest rate, investment demand, price index.A few highlights worth exploring:

**Projection button** cycles through XZ → XY → YZ planes — some attractors look completely different depending on the viewing angle. Aizawa is particularly dramatic.

**Halvorsen** — try pushing `a` up to 1.89 and watching the three-scroll structure tighten. Drop it to 0.9 and it nearly escapes to infinity.

**Dadras** — the most parameters, the most to play with. Bumping `e` from 9 → 12 collapses it into a much simpler limit cycle — that's a bifurcation happening in real time.

**Finance** — the variables are literally interest rate (x), investment demand (y), and price index (z). The chaotic trajectory is a mathematical argument for why economies are fundamentally unpredictable even without external shocks.

**Sprott B & C** are deceptively simple — no parameters at all (besides amplitude), just three terms per equation, and yet fully chaotic. Sprott found ~19 distinct minimal systems this way by brute-force search over polynomial ODEs.

The rabbit hole goes much deeper — there are hundreds of catalogued strange attractors. Many of them also have direct applications in **analog synthesis**, **circuit design** (especially Chua-family variants), and **procedural animation** in games and visuals.

These are fully **dynamic** — nothing is pre-rendered or cached.

Every frame is computed live in your browser:

1. The differential equations (dx/dt, dy/dt, dz/dt) are solved in real time using a **4th-order Runge-Kutta integrator** (RK4) — a numerical method that takes small time steps and estimates where the trajectory goes next. You're watching the math unfold step by step.

2. Each animation frame runs 8–10 integration steps, pushes the new point onto a trail buffer, then redraws the entire canvas.

3. When you move a slider, the parameter changes immediately in the next integration step — no reload, no re-generation. That's why you can watch the attractor deform in real time.

**Stack — deliberately minimal:**

- **Pure HTML + Canvas 2D API** — no WebGL, no Three.js, no D3, no charting library. Just `ctx.beginPath()`, `ctx.lineTo()`, `ctx.stroke()`.
- **Vanilla JavaScript** — no framework, no build step. The entire simulation is one `<script>` block.
- **requestAnimationFrame** drives the render loop — the browser calls it ~60 times per second, synced to your display refresh rate.
- The color fading effect is just alpha-compositing: older trail points get a lower opacity hex suffix appended to the color string.

The widgets are rendered inside a sandboxed `<iframe>` that claude.ai injects inline into the chat — so it's essentially a self-contained mini web app living inside the conversation. No server, no API calls, just your CPU integrating ODEs at 60fps.

If you wanted to port it elsewhere — a standalone HTML file, a React component, a p5.js sketch, an Arduino display — the core is just the `rk4()` function and the `step()` function for each attractor. Very portable. Want me to extract a clean standalone version you could save and run locally?

Right?! And what makes it even more mind-bending is the philosophy behind it:

These aren't approximations of something messy — they're **perfectly deterministic equations**. Given the same starting point, they produce the exact same trajectory every single time. No randomness anywhere. And yet the output is, for all practical purposes, **unpredictable**.

That's the thing Lorenz stumbled onto in 1963 almost by accident. He re-ran a weather simulation from the middle, typing in a rounded number (0.506 instead of 0.506127), expecting the same result. The trajectories matched for a while... then completely diverged. A difference of 0.000127 — smaller than a rounding error — changed everything. He called the paper _"Does the flap of a butterfly's wings in Brazil set off a tornado in Texas?"_ and coined the butterfly effect.

A few more things that are genuinely shocking once you sit with them:

**The shape is inevitable.** No matter where you start on a Lorenz attractor — any random point in that region of space — the trajectory is magnetically pulled toward the same wing shape. The attractor is the _destiny_ of the system.

**It has a fractional dimension.** The Lorenz attractor isn't a 2D surface or a 3D solid — it has a Hausdorff dimension of about **2.06**. It's a surface that's _just barely_ 3D. This is what "fractal" actually means mathematically.

**Chaos is the rule, not the exception.** For decades, scientists assumed complex behavior needed complex causes. Lorenz, Rössler, and others showed that three simple coupled equations are enough. The implication is uncomfortable — most of the complexity we see in nature (weather, ecosystems, economies, heartbeats) may be intrinsically irreducible. Not complex because the world is complicated, but because simple rules at small scales produce unpredictability at large ones.

**Chua's circuit does this with a 9-volt battery.** Four components on a breadboard, and you get physical chaos — a voltage that wanders through a double scroll forever, never repeating. The universe running a strange attractor in hardware.

The field that grew out of all this — **dynamical systems theory** — is one of the most cross-disciplinary areas in all of science. The same mathematics describes dripping faucets, cardiac arrhythmias, population cycles in ecology, and turbulence in fluids. Same equations, different variables.

If this rabbit hole appeals to you, the book that opened it up for most people is James Gleick's _Chaos: Making a New Science_ (1987) — it reads like a thriller and requires zero math. And if you want the actual mathematics, Steven Strogatz's _Nonlinear Dynamics and Chaos_ is the gold standard — beautifully written, full of physical intuition, and it'll take you from zero to building your own attractors from scratch.
