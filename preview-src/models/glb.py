"""Minimal single-mesh GLB writer, shared by build-models.py and fetch-models.py.

Every model gets a material carrying a grid texture, and that is load-bearing
rather than decorative. C3 decides at *import* time whether a mesh samples a
texture at all, and `AnimatedMesh.DrawMesh` then gates on it:

    a && "texture" === i.GetContentType() ? ...SetTexture(a)... : ...colour fill...

A model imported without a texture is stuck on the colour-fill branch forever, so
`loadTextureFromURL` reports success and changes nothing. Baking one in is what
makes the previewer's Model Texture control work at all - and a UV grid is the
most useful thing for it to default to.
"""

import json
import math
import struct
import zlib
from pathlib import Path


GRID_SIZE = 256
GRID_CELLS = 8


def encode_png(width, height, rgb_rows):
    """Minimal 8-bit RGB PNG. Avoids a Pillow dependency for one flat image."""

    def chunk(tag, data):
        body = tag + data
        return (
            struct.pack(">I", len(data))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + bytes(row) for row in rgb_rows)  # filter type 0
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


GRID_PATH = Path(__file__).parent / "grid.png"


def grid_texture_png():
    """The texture baked into every model, as bytes.

    `grid.png` next to this file is the source of truth - **edit that** to change
    what the models look like, then re-run both build scripts and re-import. It is
    only generated from `default_grid_png()` when missing, so a hand-edited one is
    never overwritten; delete it to get the default back.
    """
    if not GRID_PATH.exists():
        GRID_PATH.write_bytes(default_grid_png())
        print(f"  (wrote default {GRID_PATH.name} - edit it to change the models)")
    return GRID_PATH.read_bytes()


def default_grid_png():
    """A UV grid: alternating cells, darker lines on the cell boundaries, and one
    filled cell at the UV origin so the mapping's orientation is readable."""
    cell = GRID_SIZE // GRID_CELLS
    light, dark, line, origin = (
        (238, 238, 242),
        (148, 151, 160),
        (96, 99, 108),
        (208, 112, 78),
    )

    rows = []
    for y in range(GRID_SIZE):
        row = bytearray()
        for x in range(GRID_SIZE):
            cx, cy = x // cell, y // cell
            if x % cell == 0 or y % cell == 0:
                colour = line
            elif cx == 0 and cy == 0:
                colour = origin
            else:
                colour = light if (cx + cy) % 2 == 0 else dark
            row += bytes(colour)
        rows.append(row)
    return encode_png(GRID_SIZE, GRID_SIZE, rows)


def assert_outward_winding(positions, normals, indices, name):
    """Every triangle's winding must agree with the normals it was given.

    glTF calls a triangle front-facing when its vertices are counter-clockwise
    seen from the front, and C3 culls on exactly that. The vertex normals here
    are computed analytically and point outwards, so the geometric normal from
    the winding has to point the same way.

    Do NOT try to eyeball this in a viewer: render a closed surface with backface
    culling and inverted winding and you simply see the *inside* of the far half,
    which still looks like a solid object. It has to be measured.
    """
    flipped = 0
    total = 0
    for i in range(0, len(indices), 3):
        a, b, c = (positions[indices[i + k]] for k in range(3))
        ab = [b[k] - a[k] for k in range(3)]
        ac = [c[k] - a[k] for k in range(3)]
        face = cross(ab, ac)
        if sum(x * x for x in face) < 1e-18:
            continue  # degenerate, carries no winding
        total += 1
        # Average the three vertex normals: for a curved surface the face normal
        # only matches them approximately, but the sign is unambiguous.
        avg = [sum(normals[indices[i + k]][axis] for k in range(3)) for axis in range(3)]
        if sum(face[k] * avg[k] for k in range(3)) < 0:
            flipped += 1

    if flipped:
        raise SystemExit(
            f"{name}: {flipped} of {total} triangles wind against their normals - "
            f"C3 would cull them as back faces. Reverse the triangle order."
        )


def write_glb(path, positions, normals, uvs, indices, name):
    assert_outward_winding(positions, normals, indices, name)

    idx_type = 5125 if len(positions) > 65535 else 5123  # UINT / USHORT
    idx_fmt = "<I" if idx_type == 5125 else "<H"

    def pad(buf):
        return buf + b"\x00" * (-len(buf) % 4)

    parts = [
        (b"".join(struct.pack("<3f", *v) for v in positions), 34962),
        (b"".join(struct.pack("<3f", *v) for v in normals), 34962),
        (b"".join(struct.pack("<2f", *v) for v in uvs), 34962),
        (b"".join(struct.pack(idx_fmt, i) for i in indices), 34963),
        (grid_texture_png(), None),  # bufferView 4: the baked grid image
    ]

    chunks, offset, views = [], 0, []
    for data, target in parts:
        data = pad(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        views.append(view)
        chunks.append(data)
        offset += len(data)
    blob = b"".join(chunks)

    cols = list(zip(*positions))
    pos_min = [min(c) for c in cols]
    pos_max = [max(c) for c in cols]

    gltf = {
        "asset": {"version": "2.0",
                  "generator": "construct-shader-graph preview-src/models"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
            "indices": 3,
            "material": 0,
        }]}],
        # Unlit-ish: the previewer's shader is the material, so metallic and
        # roughness are pinned rather than left at glTF's defaults.
        "materials": [{
            "name": "grid",
            "doubleSided": False,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 1.0,
            },
        }],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [{"bufferView": 4, "mimeType": "image/png", "name": "grid"}],
        # Repeat, so a model whose UVs run past 0..1 tiles rather than smears.
        "samplers": [{
            "magFilter": 9729,   # LINEAR
            "minFilter": 9987,   # LINEAR_MIPMAP_LINEAR
            "wrapS": 10497,      # REPEAT
            "wrapT": 10497,
        }],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions),
             "type": "VEC3", "min": pos_min, "max": pos_max},
            {"bufferView": 1, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(uvs), "type": "VEC2"},
            {"bufferView": 3, "componentType": idx_type, "count": len(indices),
             "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)

    glb = struct.pack("<III", 0x46546C67, 2,
                      12 + 8 + len(json_bytes) + 8 + len(blob))
    glb += struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    glb += struct.pack("<II", len(blob), 0x004E4942) + blob
    path.write_bytes(glb)
    print(f"  {path.name:22} {len(positions):6} verts {len(indices) // 3:6} tris "
          f"{len(glb) / 1024:7.1f} KB")


def normalise_to_unit_cube(positions):
    """Centre on the origin and scale the longest axis to 1, so every model reads
    the same size once Construct's 'fit' axis-scale mode is applied."""
    cols = list(zip(*positions))
    lo = [min(c) for c in cols]
    hi = [max(c) for c in cols]
    centre = [(a + b) / 2 for a, b in zip(lo, hi)]
    span = max(b - a for a, b in zip(lo, hi)) or 1.0
    return [tuple((v[i] - centre[i]) / span for i in range(3)) for v in positions]


def unit_normal(v):
    length = math.sqrt(sum(x * x for x in v)) or 1.0
    return tuple(x / length for x in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def grid_indices(cols, rows):
    """Triangles for a (rows+1) x (cols+1) vertex grid. The seam column is a
    duplicate rather than a wrap, which is what keeps the UV seam clean.

    Wound so that advancing a column then a row is counter-clockwise seen from
    outside, i.e. front-facing. assert_outward_winding checks it.
    """
    stride = cols + 1
    out = []
    for r in range(rows):
        for c in range(cols):
            a = r * stride + c
            out += [a, a + 1, a + stride, a + 1, a + stride + 1, a + stride]
    return out
