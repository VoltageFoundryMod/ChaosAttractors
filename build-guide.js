#!/usr/bin/env node
/* ============================================================================
   build-guide.js — renders Readme.md into guide.html
   ----------------------------------------------------------------------------
   Run after editing the Readme:

       node build-guide.js

   Why a build step in a project that otherwise has none: the page must work
   when opened by double-clicking it, and browsers refuse to fetch() a local
   file from a file:// page. Rendering the Markdown at runtime would break
   exactly the case this project promises to support, so the HTML is generated
   once, here, and committed alongside the source.

   The generated page also ships a Refresh button that re-renders itself from
   Readme.md in the browser — see md.js, which both sides share. That refresh is
   in-memory only; a page cannot write files, so committing guide.html is still
   this script's job.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const MD = require("./md.js");

const SRC = path.join(__dirname, "Readme.md");
const OUT = path.join(__dirname, "guide.html");

const md = fs.readFileSync(SRC, "utf8");
const { html, toc } = MD.render(md);

const page = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reference — Strange Attractors</title>
<meta name="description" content="Study guide to deterministic chaos: what strange attractors are, how to read Lyapunov diagnostics, and a catalogue of fifteen systems.">
<link rel="canonical" href="https://chaos.vfmod.com/guide.html">
<link rel="stylesheet" href="styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>🦋</text></svg>">
</head>
<body class="g-body">

<header class="masthead">
  <h1>Strange Attractors</h1>
  <span class="sub">reference</span>
  <span class="spacer"></span>
  <button class="btn" id="btn-refresh" title="Re-render this page from Readme.md">⟳ Refresh</button>
  <a class="btn" href="index.html">← Back to the simulator</a>
  <button class="btn" id="btn-theme" title="Toggle light / dark">◐ Theme</button>
</header>

<p class="g-status" id="g-status" hidden></p>

<div class="g-shell">
  <nav class="g-toc" aria-label="Contents">
    <h2>Contents</h2>
    <div class="g-toc-list" id="g-toc-list">
      ${MD.tocHtml(toc)}
    </div>
  </nav>
  <main class="g-doc" id="g-doc">
${html}
  </main>
</div>

<footer class="sitefoot">
  <span>© 2026 <a href="https://vfmod.com" target="_blank" rel="noopener noreferrer">Carlos Eduardo de Paula</a> · <a href="https://vfmod.com" target="_blank" rel="noopener noreferrer">Voltage Foundry Modular</a></span>
  <span class="spacer"></span>
  <span class="g-foot">Generated from <code>Readme.md</code> by <code>build-guide.js</code></span>
  <a class="home" href="https://chaos.vfmod.com">chaos.vfmod.com</a>
</footer>

<script src="md.js"></script>
<script>
(function () {
  'use strict';

  /* theme — same storage key as the simulator, so the two always agree */
  var saved = localStorage.getItem('attractors-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById('btn-theme').onclick = function () {
    var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('attractors-theme', next);
  };

  /* ------------------------------------------------ contents highlighting */

  var spy = null;
  function initSpy() {
    if (spy) spy.disconnect();
    var links = [].slice.call(document.querySelectorAll('.g-toc-item'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var seen = {};
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) seen[e.target.id] = 1; else delete seen[e.target.id];
      });
      var current = null;
      for (var i = 0; i < links.length; i++) {
        if (seen[links[i].getAttribute('href').slice(1)]) { current = links[i]; break; }
      }
      links.forEach(function (a) { a.classList.toggle('is-current', a === current); });
    }, { rootMargin: '0px 0px -75% 0px' });
    document.querySelectorAll('h2[id], h3[id]').forEach(function (h) {
      if (byId[h.id]) spy.observe(h);
    });
  }
  initSpy();

  /* -------------------------------------------------------------- refresh

     A page cannot run build-guide.js — it has no shell and no write access to
     disk, on any protocol. What it can do is re-render itself from the current
     Markdown, which is what people actually want after editing the Readme:

       served over http://  fetch('Readme.md') and re-render, no interaction
       opened from file://  fetch is blocked by the opaque origin, so fall back
                            to a file picker (or a drag-and-drop of the file)

     Either way the result lives in this tab only. Run build-guide.js to make it
     permanent.
  */

  var status = document.getElementById('g-status');
  var picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.md,text/markdown,text/plain';

  function say(msg, kind) {
    status.textContent = msg;
    status.className = 'g-status' + (kind ? ' is-' + kind : '');
    status.hidden = false;
  }

  function apply(text, origin) {
    var res = MD.render(text);
    document.getElementById('g-doc').innerHTML = res.html;
    document.getElementById('g-toc-list').innerHTML = MD.tocHtml(res.toc);
    initSpy();
    var t = new Date().toLocaleTimeString();
    say('Re-rendered from ' + origin + ' at ' + t +
        ' — this tab only. Run "node build-guide.js" to update the committed guide.html.', 'ok');
  }

  picker.onchange = function () {
    var file = picker.files && picker.files[0];
    if (!file) return;
    file.text().then(function (text) { apply(text, file.name); });
    picker.value = '';
  };

  document.getElementById('btn-refresh').onclick = function () {
    fetch('Readme.md', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.text();
      })
      .then(function (text) { apply(text, 'Readme.md'); })
      .catch(function () {
        say('Opened from file:// — the browser will not let a local page read another local file. ' +
            'Pick Readme.md to re-render it, or drag the file onto this page.', 'warn');
        picker.click();
      });
  };

  /* drag a .md file anywhere onto the page */
  ['dragover', 'drop'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      e.preventDefault();
      if (type !== 'drop') return;
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) file.text().then(function (text) { apply(text, file.name); });
    });
  });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, page);
console.log(
  `guide.html written — ${toc.length} sections, ${(page.length / 1024).toFixed(1)} kB`,
);
