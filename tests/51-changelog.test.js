// The changelog the app shows, and the markdown renderer that draws it.
//
// Two invariants live here that nothing at runtime enforces:
//   - CHANGELOG.md is newest-first. entriesSince() has no comparator; it slices
//     by position, so file order IS the semantics.
//   - The newest entry matches package.json. This is the release-discipline
//     guard: bumping the version without writing an entry fails here.
//
// The renderer half is a regression guard. renderMarkdown was extracted out of
// showExperimentalDialog, so the golden below is the output the inline version
// produced for public/EXPERIMENTAL_INFO.md, captured before it was deleted.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bootstrap, ROOT } from "./helpers/bootstrap.js";
import { renderMarkdown } from "../markdown.js";
import {
  CHANGELOG_ENTRIES,
  CHANGELOG_MD,
  parseChangelog,
  entriesSince,
} from "../changelog.js";

const pkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"),
);

const tuple = (version) => version.split(/[.\-+]/).slice(0, 3).map(Number);

describe("CHANGELOG.md", () => {
  it("parses into at least one entry, with unique versions", () => {
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThanOrEqual(1);
    const versions = CHANGELOG_ENTRIES.map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("gives every entry a body", () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.body.length, `${entry.version} has an empty body`).
        toBeGreaterThan(0);
    }
  });

  it("is ordered newest first", () => {
    // entriesSince() slices by index rather than comparing versions, so an
    // out-of-order file would silently show the wrong set of entries.
    for (let i = 1; i < CHANGELOG_ENTRIES.length; i++) {
      const newer = tuple(CHANGELOG_ENTRIES[i - 1].version);
      const older = tuple(CHANGELOG_ENTRIES[i].version);
      expect(
        newer > older,
        `${CHANGELOG_ENTRIES[i - 1].version} should come after ${CHANGELOG_ENTRIES[i].version}`,
      ).toBe(true);
    }
  });

  it("has an entry for the version in package.json", () => {
    // Fails on any commit that bumps the version without writing a changelog
    // entry. That is the point.
    expect(CHANGELOG_ENTRIES[0].version).toBe(pkg.version);
  });

  it("drops the preamble above the first entry", () => {
    expect(CHANGELOG_MD).toContain("# Changelog");
    expect(CHANGELOG_ENTRIES[0].body).not.toContain("# Changelog");
  });

  it("does not treat a ### subheading as a new entry", () => {
    const parsed = parseChangelog(
      ["## 2.0.0 - 2026-01-01", "### Nodes", "- a thing"].join("\n"),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].body).toContain("### Nodes");
  });
});

describe("entriesSince", () => {
  const entries = [
    { version: "1.2.0", heading: "1.2.0", body: "c" },
    { version: "1.1.0", heading: "1.1.0", body: "b" },
    { version: "1.0.0", heading: "1.0.0", body: "a" },
  ];

  const cases = [
    ["never seen the app: nothing to catch up on", null, []],
    ["already on the newest: nothing new", "1.2.0", ["1.2.0"].slice(0, 0)],
    ["one behind", "1.1.0", ["1.2.0"]],
    ["two behind", "1.0.0", ["1.2.0", "1.1.0"]],
    ["unknown version: newest only", "0.9.0", ["1.2.0"]],
    ["downgrade to an unreleased version: newest only", "9.9.9", ["1.2.0"]],
  ];

  for (const [name, seen, expected] of cases) {
    it(name, () => {
      expect(entriesSince(entries, seen).map((e) => e.version)).toEqual(
        expected,
      );
    });
  }
});

describe("renderMarkdown", () => {
  it("renders headings, lists and inline marks", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
    expect(renderMarkdown("## Two")).toBe("<h2>Two</h2>");
    expect(renderMarkdown("### Three")).toBe("<h3>Three</h3>");
    expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderMarkdown("**b**")).toBe("<p><strong>b</strong></p>");
    expect(renderMarkdown("*i*")).toBe("<p><em>i</em></p>");
    expect(renderMarkdown("`c`")).toBe("<p><code>c</code></p>");
  });

  it("closes a list that runs to the end of the file", () => {
    expect(renderMarkdown("- only")).toBe("<ul><li>only</li></ul>");
  });

  it("joins hard-wrapped bullets and paragraphs into one block", () => {
    // Markdown authors wrap at 80 columns. Emitting a <p> per source line
    // scattered the text and closed the list mid-item - fine for the
    // never-wrapped experimental notice, wrong for anything else.
    expect(renderMarkdown("- one bullet\n  wrapped across lines")).toBe(
      "<ul><li>one bullet wrapped across lines</li></ul>",
    );
    expect(renderMarkdown("a paragraph\nwrapped across lines")).toBe(
      "<p>a paragraph wrapped across lines</p>",
    );
    expect(renderMarkdown("- a\n  more\n- b")).toBe(
      "<ul><li>a more</li><li>b</li></ul>",
    );
  });

  it("ends a block on a blank line, not on the next non-bullet", () => {
    expect(renderMarkdown("- a\n\nafter")).toBe(
      "<ul><li>a</li></ul><p>after</p>",
    );
    expect(renderMarkdown("para\n\n- a")).toBe("<p>para</p><ul><li>a</li></ul>");
  });

  it("renders links, and strips unsafe schemes to plain text", () => {
    expect(renderMarkdown("[a](https://x.dev)")).toBe(
      '<p><a href="https://x.dev" target="_blank" rel="noopener noreferrer">a</a></p>',
    );
    const unsafe = renderMarkdown("[click](javascript:alert)");
    expect(unsafe).toBe("<p>click</p>");
    expect(unsafe).not.toContain("<a");

    expect(renderMarkdown("[d](data:text/html,x)")).toBe("<p>d</p>");
  });

  it("does not swallow a bare (parenthesised) aside", () => {
    expect(renderMarkdown("a (b) c")).toBe("<p>a (b) c</p>");
  });

  it("still produces exactly what the inline version produced", () => {
    // The extraction guard. renderMarkdown was lifted verbatim out of
    // showExperimentalDialog; the golden is that function's own output,
    // captured before it was removed. Regenerate it only if the notice's
    // markdown changes, never to make a renderer change pass.
    const source = fs.readFileSync(
      path.join(ROOT, "public", "EXPERIMENTAL_INFO.md"),
      "utf-8",
    );
    const golden = fs.readFileSync(
      path.join(ROOT, "tests", "golden", "experimental-info.html"),
      "utf-8",
    );
    expect(renderMarkdown(source)).toBe(golden);
  });
});

describe("What's New startup behaviour", () => {
  let blueprint;

  beforeAll(async () => {
    ({ blueprint } = await bootstrap());
  });

  it("opens no dialog on a headless boot", () => {
    // The startup block is gated on isHeadlessHost() precisely so this holds.
    // Without it, jsdom's empty localStorage makes What's New auto-open and
    // isAnyDialogOpen() stays true, silently disabling every keyboard test in
    // the suite (see tests/38).
    expect(blueprint.isAnyDialogOpen()).toBe(false);
    const modal = document.getElementById("changelogModal");
    expect(modal).toBeTruthy();
    expect(modal.style.display === "" || modal.style.display === "none").toBe(
      true,
    );
  });

  it("namespaces the seen-version key per channel", () => {
    // Stable and experimental are the same origin, different paths, so they
    // share localStorage. An unsuffixed key would let one suppress the other.
    expect(blueprint.lastSeenVersionKey()).toBe(
      "shader-graph-last-seen-version",
    );
  });

  it("shows the changelog on demand and stamps the version on dismiss", () => {
    const key = blueprint.lastSeenVersionKey();
    localStorage.removeItem(key);

    blueprint.showChangelogModal();
    const modal = document.getElementById("changelogModal");
    expect(modal.style.display).toBe("flex");
    expect(document.getElementById("changelogModalBody").innerHTML).toContain(
      "<h2>",
    );
    // Not stamped until the user actually dismisses it - a reload part-way
    // through reading should bring it back.
    expect(localStorage.getItem(key)).toBeNull();

    document.getElementById("changelogModalOk").click();
    expect(modal.style.display).toBe("none");
    expect(localStorage.getItem(key)).toBe(pkg.version);
  });

  // No stamp is ambiguous: a brand-new browser and a user who predates the key
  // look identical. On the release that introduces the key that is *every*
  // existing user, so getting this wrong announces 1.0 to nobody. Recent files
  // is the tie-breaker.
  describe("with no stored version", () => {
    const setRecent = (value) => {
      if (value === null) localStorage.removeItem("recentFiles");
      else localStorage.setItem("recentFiles", value);
    };

    const cases = [
      ["never used the app: stays quiet", null, false],
      ["recent files cleared to empty: stays quiet", "[]", false],
      ["unparseable recent files: stays quiet", "{not json", false],
      [
        "has opened a project before: shows the release",
        JSON.stringify([{ id: "a", name: "x.c3sg", lastOpened: 1 }]),
        true,
      ],
    ];

    for (const [name, recent, shouldShow] of cases) {
      it(name, () => {
        const key = blueprint.lastSeenVersionKey();
        localStorage.removeItem(key);
        setRecent(recent);
        document.getElementById("changelogModal").style.display = "none";

        blueprint.maybeShowWhatsNew();

        const modal = document.getElementById("changelogModal");
        if (shouldShow) {
          expect(modal.style.display).toBe("flex");
          // Not stamped until dismissed, same as every other show path.
          expect(localStorage.getItem(key)).toBeNull();
          document.getElementById("changelogModalOk").click();
          expect(localStorage.getItem(key)).toBe(pkg.version);
        } else {
          expect(modal.style.display).toBe("none");
          expect(localStorage.getItem(key)).toBe(pkg.version);
        }

        setRecent(null);
      });
    }

    it("shows only the newest entry, not the whole history", () => {
      // We cannot know which version a pre-key user came from, so the catch-up
      // is capped at the current release rather than replaying everything.
      const key = blueprint.lastSeenVersionKey();
      localStorage.removeItem(key);
      setRecent(JSON.stringify([{ id: "a", name: "x.c3sg", lastOpened: 1 }]));

      blueprint.maybeShowWhatsNew();

      const html = document.getElementById("changelogModalBody").innerHTML;
      expect(html).toContain(CHANGELOG_ENTRIES[0].version);
      expect(
        document.getElementById("changelogModalTitle").textContent,
      ).toContain(pkg.version);
      // One entry rendered means exactly one release heading.
      expect(html.match(/<h2>/g) ?? []).toHaveLength(1);

      document.getElementById("changelogModalOk").click();
      setRecent(null);
    });
  });

  it("shows only what is new when upgrading from an older version", () => {
    const key = blueprint.lastSeenVersionKey();
    localStorage.setItem(key, "0.0.1");

    blueprint.maybeShowWhatsNew();

    const modal = document.getElementById("changelogModal");
    expect(modal.style.display).toBe("flex");
    expect(document.getElementById("changelogModalTitle").textContent).toContain(
      pkg.version,
    );

    document.getElementById("changelogModalOk").click();
    expect(localStorage.getItem(key)).toBe(pkg.version);

    // And it does not come back on the next load.
    blueprint.maybeShowWhatsNew();
    expect(modal.style.display).toBe("none");
  });
});
