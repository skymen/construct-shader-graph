# preview-src — the Construct project behind `preview/`

`preview/` at the repo root is a **generated** Construct 3 web export. This folder is the
project it was exported from, in Construct's folder format (JSON + PNG, so it diffs).

## The rule

> `preview-src/` is the source of truth. `preview/` is generated.

Preview behaviour lives in `preview-src/scripts/main.js`. Construct copies script files
**verbatim** on export, so that file and `preview/scripts/project/main.js` must stay
byte-identical — `tests/31-preview-source-parity.test.js` fails if they drift.

In practice that means: make the change in `preview-src/scripts/main.js`, then copy it over
`preview/scripts/project/main.js`. The app picks it up immediately; no export needed.

The drift runs **both** ways. A re-export ships whatever copy of the script the Construct
editor had in memory, which is older than the file on disk if the project was open while
`preview-src/scripts/main.js` was being edited — that is exactly what the r497 export did.
So the last step of every re-export is: copy `preview-src/scripts/main.js` over
`preview/scripts/project/main.js`, never the other way round.

## When you *do* need a re-export

Anything that changes project **structure** rather than script code:

- new or removed object types (`objectTypes/`, and the `usedAddons` list)
- layout edits — instances, layers, sizes, positions (`layouts/Layout 1.json`)
- event sheet changes (`eventSheets/Event sheet 1.json`)
- project properties: viewport size, fullscreen mode, sampling, near/far Z, …

**Replace the whole `preview/` folder from the export, then re-copy
`scripts/project/main.js` from here.** Do not hand-pick the changed files: a re-export can
touch `data.json`, `objRefTable.js`, `c3runtime.js`, `images/` (whenever the spritesheet is
re-packed), the `icons/`, and can add whole directories — the r497 export quietly changed
every icon, and picking files by hand missed them. `data.json` and `images/` are especially
not separable: the frame rectangles in one address the bytes in the other.

Only the Construct editor can produce an export. `bundleAddons` is
`false` and `skymen_Placeholdereffect` is a non-bundled third-party effect addon, so the
export needs that addon installed.

**After any re-export**, check the `C3.Runtime._LoadDataJson` override at the bottom of
`scripts/main.js`. It patches positional, undocumented indices into the raw project array
(`t[13]` shader language, `t[14]` sampling, `t[15]`/`t[17]`/`t[42]` shader flags, `t[48]`
WebGL1). Those shift between Construct releases — `C3.WorldInfo.Init`'s index already moved
from `t[12]` to `t[13]` once. The override sanity-checks the shapes it finds and reports a
warning to the editor's preview console if they no longer look right.

## History

Brought into the repo on 2026-08-05. The export had drifted ahead of the source by three
changes, all back-ported at that point: the `forceRotatedTexture` `ImageInfo` monkey-patch,
`zHeight` → `depth`, and the `t[12]` → `t[13]` `WorldInfo.Init` index.

Re-exported from r497 (`savedWithRelease: 49700`) on 2026-08-06, for the 3D rotation the
r497 runtime added. The project array's indices did not shift, so every `checkProjectIndex`
guard still held; the spritesheet was re-packed, so `images/` came over with `data.json`.
The export's `scripts/project/main.js` was a stale in-memory copy and was discarded.

Re-exported again the same day with the 3D models from `preview-src/models` and a `model`
object type. Indices still unmoved; `t[52]` now carries the eight models and the export
gained `3dmodels/` and `scripts/3rdparty/zip.js`, both gated on the Model3D plugin. This is
the export that revealed the hand-picking problem above — the icons had been stale since the
first r497 swap.

Re-exported a third time with the Placeholder effect attached to the `model` object type,
which retired a `_LoadDataJson` patch that had been injecting it. **Preference on record:
re-export rather than patch the project data at load.** Patching makes `preview-src` and
`preview/` describe different projects, and the drift is invisible until something breaks.
The `t[13]`/`t[14]`/… patches that remain are not structural — they carry the shader
language and sampling mode chosen per preview *run*, from the iframe's query string, so
there is nothing for the editor to hold.
