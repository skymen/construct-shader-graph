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

## When you *do* need a re-export

Anything that changes project **structure** rather than script code:

- new or removed object types (`objectTypes/`, and the `usedAddons` list)
- layout edits — instances, layers, sizes, positions (`layouts/Layout 1.json`)
- event sheet changes (`eventSheets/Event sheet 1.json`)
- project properties: viewport size, fullscreen mode, sampling, near/far Z, …

Those regenerate `preview/data.json`, `preview/scripts/objRefTable.js` and
`preview/scripts/c3runtime.js`, and only the Construct editor can do it. `bundleAddons` is
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
