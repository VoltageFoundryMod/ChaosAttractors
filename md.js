/* ============================================================================
   md.js — the Markdown subset used by Readme.md, converted to HTML
   ----------------------------------------------------------------------------
   Loaded by both sides so the two never drift:

     Node    require('./md.js')            — build-guide.js, writing guide.html
     Browser <script src="md.js">          — guide.html's Refresh button

   This is not a general Markdown engine. It handles what the Readme actually
   uses — headings, paragraphs, GFM tables, fenced code, lists, blockquotes,
   rules, and inline emphasis/code/links — and passes anything else through as a
   paragraph rather than guessing.
   ========================================================================== */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MD = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const esc = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /**
   * Readable, stable anchor for a heading. Deliberately ASCII-only: several
   * headings start with Greek (λ₁, Σλ), and transliterating those would produce
   * anchors nobody can type. Collisions get a numeric suffix.
   */
  function makeSlugger() {
    const used = new Set();
    return function slug(text) {
      let s = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!s) s = "section";
      let out = s,
        n = 2;
      while (used.has(out)) out = s + "-" + n++;
      used.add(out);
      return out;
    };
  }

  /*
   * Inline formatting. Code spans are lifted out first and restored last, so
   * emphasis and link syntax inside `backticks` is left alone. NUL is the
   * placeholder delimiter because it cannot occur in the source — a printable
   * marker would collide with ordinary prose ("in 1961 Edward Lorenz…").
   */
  const NUL = "\u0000";

  function inline(s) {
    const code = [];
    let t = s.replace(/`([^`]+)`/g, function (_, c) {
      code.push(c);
      return NUL + (code.length - 1) + NUL;
    });

    t = esc(t);
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      const ext = /^https?:/.test(href);
      return (
        '<a href="' +
        href +
        '"' +
        (ext ? ' target="_blank" rel="noopener noreferrer"' : "") +
        ">" +
        label +
        "</a>"
      );
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
    t = t.replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");

    return t.replace(new RegExp(NUL + "(\\d+)" + NUL, "g"), function (_, i) {
      return "<code>" + esc(code[+i]) + "</code>";
    });
  }

  /** @returns {{ html: string, toc: {level:number,text:string,id:string}[] }} */
  function render(md) {
    const slug = makeSlugger();
    const lines = String(md).split(/\r?\n/);
    const out = [];
    const toc = [];
    let i = 0;

    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isDivider = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

    while (i < lines.length) {
      const line = lines[i];

      // fenced code
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        i++; // closing fence
        out.push(
          '<pre class="g-code"' +
            (lang ? ' data-lang="' + esc(lang) + '"' : "") +
            "><code>" +
            esc(body.join("\n")) +
            "</code></pre>",
        );
        continue;
      }

      // headings
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        const text = h[2].trim();
        const id = slug(text);
        if (level === 2 || level === 3) toc.push({ level: level, text: text, id: id });
        out.push(
          "<h" + level + ' id="' + id + '"><a class="g-anchor" href="#' + id + '">' +
            inline(text) +
            "</a></h" + level + ">",
        );
        i++;
        continue;
      }

      // horizontal rule
      if (/^---+\s*$/.test(line)) {
        out.push("<hr>");
        i++;
        continue;
      }

      // table
      if (isTableRow(line) && isDivider(lines[i + 1] || "")) {
        const cells = (l) =>
          l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = cells(line);
        i += 2;
        const body = [];
        while (i < lines.length && isTableRow(lines[i])) body.push(cells(lines[i++]));
        out.push(
          '<div class="g-tablewrap"><table>' +
            "<thead><tr>" +
            head.map((c) => "<th>" + inline(c) + "</th>").join("") +
            "</tr></thead><tbody>" +
            body
              .map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>")
              .join("") +
            "</tbody></table></div>",
        );
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        const body = [];
        while (i < lines.length && /^>\s?/.test(lines[i]))
          body.push(lines[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + inline(body.join(" ")) + "</blockquote>");
        continue;
      }

      // lists — an item continues while following lines are indented
      if (/^(\s*)([-*]|\d+\.)\s+(.*)$/.test(line)) {
        const ordered = /^\s*\d/.test(line);
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
          if (!m) break;
          let text = m[3];
          i++;
          while (
            i < lines.length &&
            /^\s+\S/.test(lines[i]) &&
            !/^\s*([-*]|\d+\.)\s/.test(lines[i])
          ) {
            text += " " + lines[i++].trim();
          }
          items.push(text);
        }
        const tag = ordered ? "ol" : "ul";
        out.push(
          "<" + tag + ">" + items.map((t) => "<li>" + inline(t) + "</li>").join("") + "</" + tag + ">",
        );
        continue;
      }

      // blank
      if (!line.trim()) {
        i++;
        continue;
      }

      // paragraph — consume until a blank line or the start of another block
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4}\s|```|>|---+\s*$)/.test(lines[i]) &&
        !/^\s*([-*]|\d+\.)\s/.test(lines[i]) &&
        !isTableRow(lines[i])
      ) {
        para.push(lines[i++]);
      }
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }

    return { html: out.join("\n"), toc: toc };
  }

  /** Contents sidebar markup, shared by the generator and the live refresh. */
  function tocHtml(toc) {
    return toc
      .map(
        (t) =>
          '<a class="g-toc-item g-toc-' + t.level + '" href="#' + t.id + '">' +
          esc(t.text) +
          "</a>",
      )
      .join("\n      ");
  }

  return { render: render, tocHtml: tocHtml, esc: esc };
});
