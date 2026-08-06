#!/usr/bin/env python3
"""Fetch the two preview models that are real meshes rather than maths.

Run:  python3 preview-src/models/fetch-models.py

Both are repacked through the same writer as the procedural models, so every
model in this folder is one mesh, unit-cube sized, UV-mapped, and carries no
material - see glb.py for why no material.

Sources and licensing, both fine to redistribute:

* **Suzanne** - Blender's chimpanzee test mesh, from Khronos' glTF-Sample-Assets.
  (c) 2017 UX3D, CC0 1.0 Universal (public domain dedication).
* **Utah teapot** - Martin Newell's 1975 bicubic Bezier patch dataset, which has
  been in the public domain for decades. The control points are lifted out of
  three.js's TeapotGeometry.js (MIT) and tessellated here; none of three.js's
  code ships in the result.
"""

import json
import math
import re
import struct
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from glb import (  # noqa: E402
    cross,
    normalise_to_unit_cube,
    unit_normal,
    write_glb,
)

OUT_DIR = Path(__file__).parent
RAW = "https://raw.githubusercontent.com"
SUZANNE_BASE = f"{RAW}/KhronosGroup/glTF-Sample-Assets/main/Models/Suzanne/glTF"
TEAPOT_URL = f"{RAW}/mrdoob/three.js/dev/examples/jsm/geometries/TeapotGeometry.js"


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


# --- Suzanne -----------------------------------------------------------------

COMPONENT_FORMAT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
TYPE_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_accessor(gltf, blob, index):
    """Enough of the glTF accessor rules for this one file: no sparse data, and
    tightly packed or explicitly strided buffer views."""
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    fmt = COMPONENT_FORMAT[acc["componentType"]]
    count = TYPE_COUNT[acc["type"]]
    size = struct.calcsize(fmt) * count
    stride = view.get("byteStride") or size
    base = view.get("byteOffset", 0) + acc.get("byteOffset", 0)

    out = []
    for i in range(acc["count"]):
        start = base + i * stride
        out.append(struct.unpack_from("<" + fmt * count, blob, start))
    return out


def build_suzanne():
    gltf = json.loads(fetch(f"{SUZANNE_BASE}/Suzanne.gltf"))
    blob = fetch(f"{SUZANNE_BASE}/{gltf['buffers'][0]['uri']}")

    primitive = gltf["meshes"][0]["primitives"][0]
    attrs = primitive["attributes"]
    positions = read_accessor(gltf, blob, attrs["POSITION"])
    normals = read_accessor(gltf, blob, attrs["NORMAL"])
    uvs = read_accessor(gltf, blob, attrs["TEXCOORD_0"])
    indices = [i[0] for i in read_accessor(gltf, blob, primitive["indices"])]

    # TANGENT and the PBR textures are dropped: the previewer is the material.
    return positions, normals, uvs, indices


# --- Utah teapot -------------------------------------------------------------


def parse_teapot_data():
    """Pull the two flat numeric arrays out of TeapotGeometry.js.

    The source writes negatives as `- 0.784`, with a space after the sign. A
    regex that does not allow for that reads every negative as positive, which
    silently collapses the teapot into one quadrant - so the space is part of
    the pattern, and the counts are asserted afterwards.
    """
    src = fetch(TEAPOT_URL).decode("utf-8")
    number = re.compile(r"-?\s*\d+\.?\d*(?:e-?\d+)?")

    def array_after(name):
        start = src.index(name)
        open_bracket = src.index("[", start)
        close_bracket = src.index("];", open_bracket)
        body = src[open_bracket + 1 : close_bracket]
        return [float(n.replace(" ", "")) for n in number.findall(body)]

    patches = [int(n) for n in array_after("teapotPatches")]
    vertices = array_after("teapotVertices")

    if len(patches) != 32 * 16:
        raise SystemExit(f"expected 32 teapot patches, parsed {len(patches) / 16}")
    if len(vertices) % 3:
        raise SystemExit("teapot vertices did not parse into whole triples")
    if max(patches) >= len(vertices) // 3:
        raise SystemExit("a teapot patch references a vertex that was not parsed")
    if min(vertices) >= 0:
        raise SystemExit("no negative coordinates parsed - the sign regex is wrong again")
    return patches, vertices


def bezier(t):
    mt = 1 - t
    return (mt ** 3, 3 * mt * mt * t, 3 * mt * t * t, t ** 3)


def bezier_derivative(t):
    mt = 1 - t
    return (-3 * mt * mt, 3 * mt * mt - 6 * mt * t, 6 * mt * t - 3 * t * t, 3 * t * t)


def build_teapot(segments=12):
    """Tessellate the 32 bicubic patches.

    Patches 20-27 are the lid, which the original data leaves slightly too small
    to meet the body; three.js widens it by 7.7% in X and Y and so do we. Each
    patch gets its own 0..1 UV island, which is what three.js does too - the
    teapot earns its place on silhouette and self-occlusion, not UV layout.
    """
    patches, vertices = parse_teapot_data()
    pos, nrm, uv, idx = [], [], [], []
    mid_height = max(vertices[2::3]) / 2

    for surf in range(len(patches) // 16):
        is_lid = 20 <= surf < 28
        control = [
            [
                [
                    vertices[patches[surf * 16 + r * 4 + c] * 3 + axis]
                    * (1.077 if is_lid and axis != 2 else 1.0)
                    for axis in range(3)
                ]
                for c in range(4)
            ]
            for r in range(4)
        ]

        base = len(pos)
        for i in range(segments + 1):
            u = i / segments
            bu, du = bezier(u), bezier_derivative(u)
            for j in range(segments + 1):
                v = j / segments
                bv, dv = bezier(v), bezier_derivative(v)

                point = [0.0, 0.0, 0.0]
                tan_u = [0.0, 0.0, 0.0]
                tan_v = [0.0, 0.0, 0.0]
                for r in range(4):
                    for c in range(4):
                        p = control[r][c]
                        for axis in range(3):
                            point[axis] += bu[r] * bv[c] * p[axis]
                            tan_u[axis] += du[r] * bv[c] * p[axis]
                            tan_v[axis] += bu[r] * dv[c] * p[axis]

                # Newell's data is Z-up; glTF is Y-up.
                pos.append((point[0], point[2], -point[1]))

                # cross(dv, du), not cross(du, dv) - the other way round turns
                # the whole teapot inside out.
                n = cross(tan_v, tan_u)
                n = (n[0], n[2], -n[1])
                if math.sqrt(sum(x * x for x in n)) > 1e-9:
                    nrm.append(unit_normal(n))
                else:
                    # The knob and the base pinch to a cusp, where both tangents
                    # vanish. Point up or down depending on which end it is.
                    nrm.append((0.0, 1.0 if point[2] > mid_height else -1.0, 0.0))
                uv.append((1 - v, 1 - u))

        # Cusp patches collapse a whole edge onto one point, so skip the
        # zero-area triangles that fall out of the grid there.
        def degenerate(a, b, c):
            return pos[a] == pos[b] or pos[a] == pos[c] or pos[b] == pos[c]

        stride = segments + 1
        for i in range(segments):
            for j in range(segments):
                a = base + i * stride + j
                for tri in ((a, a + 1, a + stride),
                            (a + 1, a + stride + 1, a + stride)):
                    if not degenerate(*tri):
                        idx += list(tri)

    return pos, nrm, uv, idx


def main():
    print("Fetching preview models:")
    for name, build in (("suzanne", build_suzanne), ("teapot", build_teapot)):
        pos, nrm, uv, idx = build()
        write_glb(OUT_DIR / f"{name}.glb", normalise_to_unit_cube(pos), nrm, uv, idx, name)


if __name__ == "__main__":
    main()
