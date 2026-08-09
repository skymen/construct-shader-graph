#!/usr/bin/env python3
"""Push grid.png into the places Construct already baked it, so changing the
models' texture does not cost an import/export round trip.

Run:  python3 preview-src/models/apply-grid.py

Three copies of that texture exist once the models have been imported:

  preview-src/models/<name>.glb          the source model      (build-models.py)
  preview-src/images/<name>-diffuse-000.png   the project's copy
  preview/images/<name>-sheet0.webp      the exported spritesheet

This script rewrites the last two. Run the build scripts as well to keep the
`.glb` files in step - they are what a future re-import would read.

**This only works while the image keeps its dimensions.** The exported
`3dmodels/<name>.zip` stores each texture's sprite-sheet rectangle, and the
project's model data stores its width and height; neither holds pixel data or a
hash, so same-size pixels can simply be swapped underneath them. A different size
means those records are wrong, and the script refuses rather than producing a
model with skewed UVs - re-import and re-export instead.

**Run this after an export, never before.** The editor holds its own copy of the
texture, so any save or export from a session that already had the project open
writes that copy back and quietly undoes this - the same way a re-export ships a
stale `scripts/main.js`. To make a texture change permanent, re-import the `.glb`
files instead; they carry it.

Needs Pillow (`pip install pillow`), unlike the build scripts, which stay
dependency-free because they run on every model change rather than once.
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("apply-grid.py needs Pillow:  pip install pillow")

MODELS_DIR = Path(__file__).parent
ROOT = MODELS_DIR.parent.parent
PROJECT_IMAGES = ROOT / "preview-src" / "images"
EXPORT_IMAGES = ROOT / "preview" / "images"

NAMES = [
    "sphere", "torus", "cylinder", "cone",
    "capsule", "torus-knot", "suzanne", "teapot",
]


def main():
    grid = Image.open(MODELS_DIR / "grid.png")
    print(f"grid.png is {grid.width}x{grid.height} {grid.mode}")

    targets = []
    for name in NAMES:
        targets.append((PROJECT_IMAGES / f"{name}-diffuse-000.png", "RGBA", "PNG"))
        targets.append((EXPORT_IMAGES / f"{name}-sheet0.webp", "RGB", "WEBP"))

    # Check every target before writing any of them, so a size mismatch cannot
    # leave half the models on the new texture and half on the old.
    missing, resized = [], []
    for path, _, _ in targets:
        if not path.exists():
            missing.append(path)
        elif Image.open(path).size != grid.size:
            resized.append((path, Image.open(path).size))

    if missing:
        raise SystemExit(
            "These baked textures do not exist - import the models first:\n  "
            + "\n  ".join(str(p.relative_to(ROOT)) for p in missing)
        )
    if resized:
        lines = "\n  ".join(
            f"{p.relative_to(ROOT)} is {w}x{h}" for p, (w, h) in resized
        )
        raise SystemExit(
            f"grid.png is {grid.width}x{grid.height} but the baked textures are not:\n  "
            f"{lines}\n\n"
            "The sprite-sheet rectangles in preview/3dmodels/*.zip are sized for the "
            "old image, so swapping the pixels would skew the UVs. Re-import the "
            ".glb files in Construct and re-export instead."
        )

    for path, mode, fmt in targets:
        image = grid.convert(mode)
        if fmt == "WEBP":
            image.save(path, "WEBP", lossless=True, quality=100, method=6)
        else:
            image.save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(ROOT)}  ({path.stat().st_size} bytes)")

    print(
        f"\nRewrote {len(targets)} baked textures. Re-run build-models.py and "
        "fetch-models.py so the .glb files match."
    )


if __name__ == "__main__":
    main()
