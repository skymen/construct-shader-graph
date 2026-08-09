// The changelog the app shows in Help > What's New.
//
// CHANGELOG.md is imported with ?raw rather than fetched from public/, so it
// ships inside the hash-named JS bundle. That matters: files under public/ are
// served unhashed, so GitHub Pages can hand a freshly deployed build a cached
// copy of the previous changelog - which is exactly the bug
// public/EXPERIMENTAL_INFO.md has. It also means no network failure mode and
// no BASE_URL juggling, and tests can import it synchronously.

import changelogMd from "./CHANGELOG.md?raw";

export const CHANGELOG_MD = changelogMd;

/** First semver-looking token in a heading: "## 1.0.0 - 2026-08-09" -> "1.0.0". */
const VERSION_IN_HEADING = /\d+\.\d+\.\d+(?:[-+][\w.]+)?/;

/**
 * Split the file into entries. A `## ` heading starts one; anything before the
 * first heading is preamble and is dropped. Order is the file's own -
 * newest-first is an invariant enforced by tests/51-changelog.test.js, not by
 * a comparator here.
 *
 * @returns {{version: string, heading: string, body: string}[]}
 */
export function parseChangelog(md = changelogMd) {
  const entries = [];
  const lines = (md || "").split("\n");
  let current = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) entries.push(current);
      const heading = line.slice(3).trim();
      const version = heading.match(VERSION_IN_HEADING)?.[0] ?? null;
      current = { version, heading, body: "" };
      continue;
    }
    if (current) current.body += `${line}\n`;
  }
  if (current) entries.push(current);

  return entries
    .filter((entry) => entry.version)
    .map((entry) => ({ ...entry, body: entry.body.trim() }));
}

export const CHANGELOG_ENTRIES = parseChangelog();

/**
 * The entries a user who last saw `seenVersion` has not read yet.
 *
 * No semver comparison: entries are in file order, so "newer than X" is
 * "before X in the list". The three edge cases are deliberate.
 */
export function entriesSince(entries, seenVersion) {
  // Never seen the app before - there is nothing to catch up on, and a
  // changelog is a poor first impression.
  if (!seenVersion) return [];

  const index = entries.findIndex((entry) => entry.version === seenVersion);

  // Unknown version: a pruned entry, a hand-edited key, or a downgrade. Show
  // the newest entry only rather than the whole history.
  if (index === -1) return entries.slice(0, 1);

  return entries.slice(0, index);
}
