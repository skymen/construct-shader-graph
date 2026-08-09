// A deliberately tiny markdown subset: headings, bullet lists, bold, italic,
// inline code, links. Nothing else - no tables, no nested lists, no code
// fences.
//
// Extracted verbatim from showExperimentalDialog in script.js so the
// experimental-build notice and the What's New changelog render through one
// function and cannot drift apart. Pure string -> string: no DOM, no imports,
// so it unit-tests without standing the app up.
//
// The output is assigned with innerHTML. Every caller feeds it markdown that
// ships inside the build (CHANGELOG.md via ?raw, public/EXPERIMENTAL_INFO.md),
// which is as trusted as the code around it - hence no escaping, and hence the
// rule that this must never be pointed at user-supplied markdown.

/** Schemes an anchor may point at. Anything else renders as plain text. */
const SAFE_HREF = /^(https?:|mailto:|#)/i;

function renderInline(text) {
  const withMarks = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links last, so bold/code inside the label still works. An unsafe scheme
  // (javascript:, data:) drops the anchor and keeps the label - a changelog
  // entry is authored by us, but a pasted link is the one thing an author
  // might not read carefully.
  //
  // The href stops at the first ")", so a URL that itself contains one (a
  // Wikipedia disambiguation link, say) will not round-trip. Percent-encode it
  // as %29 rather than making this regex balance brackets.
  return withMarks.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) =>
    SAFE_HREF.test(href)
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label,
  );
}

/**
 * @param {string} markdown
 * @returns {string} HTML
 */
export function renderMarkdown(markdown) {
  let out = "";
  let inList = false;
  // Blocks are buffered rather than emitted per line, because a hard-wrapped
  // bullet or paragraph spans several source lines and must come out as one
  // element. The original line-at-a-time version emitted a <p> for every
  // continuation line, which closed the list and scattered the text - invisible
  // in EXPERIMENTAL_INFO.md, where nothing wraps, and immediately obvious in a
  // changelog, where everything does.
  let item = null; // current <li>
  let para = null; // current <p>

  const flushItem = () => {
    if (item !== null) {
      out += `<li>${item}</li>`;
      item = null;
    }
  };
  const closeList = () => {
    flushItem();
    if (inList) {
      out += "</ul>";
      inList = false;
    }
  };
  const flushPara = () => {
    if (para !== null) {
      out += `<p>${para}</p>`;
      para = null;
    }
  };
  const flushAll = () => {
    closeList();
    flushPara();
  };

  for (const line of renderInline(markdown || "").split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushAll();
      out += `<h3>${trimmed.slice(4)}</h3>`;
    } else if (trimmed.startsWith("## ")) {
      flushAll();
      out += `<h2>${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      flushAll();
      out += `<h1>${trimmed.slice(2)}</h1>`;
    } else if (trimmed.startsWith("- ")) {
      flushPara();
      flushItem();
      if (!inList) {
        out += "<ul>";
        inList = true;
      }
      item = trimmed.slice(2);
    } else if (trimmed === "") {
      // A blank line is the only thing that ends a block.
      flushAll();
    } else if (item !== null) {
      item += ` ${trimmed}`;
    } else if (para !== null) {
      para += ` ${trimmed}`;
    } else {
      closeList();
      para = trimmed;
    }
  }

  // A file ending mid-block would otherwise leave it unclosed.
  flushAll();
  return out;
}
