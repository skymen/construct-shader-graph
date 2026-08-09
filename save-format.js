// The .c3sg save format's version contract.
//
// Two different "version" fields live in a save file and they are not the same
// thing:
//
//   version       - a frozen "1.0.0" string. It is the file-type sentinel:
//                   loadFromJSON reads it for truthiness only, to answer "is
//                   this a .c3sg at all". Nothing compares it. It is NOT the
//                   app version (version.js) and must never be coupled to it,
//                   or every saved file and every golden changes on each
//                   release.
//   formatVersion - this. The real one, an integer, compared on load.
//
// The compatibility policy, which is why SAVE_MIGRATIONS is empty:
//
// Backwards compatibility is structural, not version-gated. The loader sniffs
// shape - `data.uniforms === undefined` means the old per-graph layout, a
// missing `_additionalGraphs` means a single-graph file, `constants` defaults
// to [], `shaderSettings` is spread over freshly-built defaults so a file
// predating a setting picks up its default. That handles every *additive*
// change, which is every change made so far, and it needs no version at all.
//
// What shape-sniffing cannot do is the two things below, which is what this
// module exists for:
//
//   1. Non-additive change - a field rename, a node-type rename, a port
//      reorder (port values are restored by index, so a reorder silently
//      rewires old files), a semantic flip. Those need a real migration, and
//      SAVE_FORMAT_VERSION is what tells the loader to run it.
//   2. A file from a *newer* build. Sniffing cannot see fields it has no name
//      for; it loads happily and then drops them on the next save. The forward
//      guard below is the only warning a user gets.

/**
 * Bump ONLY for a change shape-sniffing cannot express. Adding a field does not
 * bump this. Every bump needs a matching SAVE_MIGRATIONS entry and a row in
 * tests/52-save-format-version.test.js.
 */
export const SAVE_FORMAT_VERSION = 1;

/**
 * Ordered migrations keyed by the format they upgrade *from*: entry `n`
 * turns a format-`n` save object into a format-`n+1` one, mutating or
 * returning it, before the loader reads anything.
 *
 * Empty on purpose - see the policy above. Two shape-driven migrations already
 * exist and deliberately stay where they are rather than moving here:
 * `_migrateLoopBodyContract` (script.js) and `migratePreviewSettings`
 * (preview-settings.js). Both predate this table and both key off shape, so
 * they run for every file regardless of version.
 */
export const SAVE_MIGRATIONS = {
  // 1: (data) => data,
};

/**
 * The format a save object declares. Files written before `formatVersion`
 * existed carry no such field and are format 1 by definition.
 */
export function saveFormatOf(data) {
  const declared = Number(data?.formatVersion);
  return Number.isFinite(declared) && declared >= 1 ? declared : 1;
}

/**
 * Run every migration between `from` and the current format. A no-op today.
 *
 * @returns {number} how many migrations ran
 */
export function applySaveMigrations(data, from = saveFormatOf(data)) {
  let ran = 0;
  for (let v = from; v < SAVE_FORMAT_VERSION; v++) {
    const migrate = SAVE_MIGRATIONS[v];
    if (!migrate) continue;
    migrate(data);
    ran++;
  }
  return ran;
}
