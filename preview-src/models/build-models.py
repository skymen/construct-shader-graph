#!/usr/bin/env python3
"""Generate the preview's built-in 3D models as .glb files.

These exist so the shader previewer has curved surfaces to test against - the
built-in 3D Shape only offers flat-faced solids, so nothing in the current set
has a curved normal, a UV seam or a pole.

Run:  python3 preview-src/models/build-models.py
Then import the .glb files into the Construct project (see README.md).

Three rules every model here follows, all of which matter to C3:

* **Triangles wind counter-clockwise seen from outside.** C3 culls back faces on
  exactly that, so a reversed model is invisible. write_glb refuses to emit one -
  see assert_outward_winding in glb.py.
* **Every vertex has a UV**, and the mesh carries a texture (see README.md for why
  the texture is what makes the Model Texture control work at all). C3 cannot
  invent either.
* **One mesh per model.** `loadTextureFromURL` is per-mesh, so a single mesh
  keeps the previewer's side a one-liner.

Geometry is built to fit a unit cube centred on the origin, so Construct's
"fit" axis-scale mode gives every model the same on-screen size.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from glb import (  # noqa: E402
    grid_indices,
    normalise_to_unit_cube,
    unit_normal,
    write_glb,
)

OUT_DIR = Path(__file__).parent


# --- the models --------------------------------------------------------------


def uv_sphere(segments=48, rings=24):
    """Every normal direction at once, with a textbook equirectangular UV."""
    pos, nrm, uv = [], [], []
    for r in range(rings + 1):
        phi = math.pi * r / rings
        for s in range(segments + 1):
            theta = 2 * math.pi * s / segments
            n = (math.sin(phi) * math.cos(theta), math.cos(phi), math.sin(phi) * math.sin(theta))
            pos.append(tuple(0.5 * x for x in n))
            nrm.append(n)
            uv.append((s / segments, r / rings))
    return pos, nrm, uv, grid_indices(segments, rings)


def torus(segments=64, sides=32, radius=0.35, tube=0.15):
    """Convex and concave curvature in one object, plus a hole - the case a
    sphere hides."""
    pos, nrm, uv = [], [], []
    for i in range(segments + 1):
        u = 2 * math.pi * i / segments
        cu, su = math.cos(u), math.sin(u)
        for j in range(sides + 1):
            v = 2 * math.pi * j / sides
            cv, sv = math.cos(v), math.sin(v)
            pos.append(((radius + tube * cv) * cu, tube * sv, (radius + tube * cv) * su))
            nrm.append((cv * cu, sv, cv * su))
            uv.append((i / segments, j / sides))
    return pos, nrm, uv, grid_indices(sides, segments)


def cylinder(segments=48, half_h=0.5, radius=0.35):
    """Flat caps meeting a curved wall - the cheapest way to see UV-seam and
    hard-normal-edge artifacts."""
    pos, nrm, uv = [], [], []
    idx = []

    # Wall as a grid, so the seam column is duplicated rather than wrapped.
    for r in range(2):
        y = half_h - 2 * half_h * r
        for s in range(segments + 1):
            theta = 2 * math.pi * s / segments
            c, sn = math.cos(theta), math.sin(theta)
            pos.append((radius * c, y, radius * sn))
            nrm.append((c, 0.0, sn))
            uv.append((s / segments, r))
    idx += grid_indices(segments, 1)

    # Caps: a fan each, with their own planar UV.
    for sign in (1, -1):
        centre = len(pos)
        pos.append((0.0, sign * half_h, 0.0))
        nrm.append((0.0, float(sign), 0.0))
        uv.append((0.5, 0.5))
        first = len(pos)
        for s in range(segments + 1):
            theta = 2 * math.pi * s / segments
            c, sn = math.cos(theta), math.sin(theta)
            pos.append((radius * c, sign * half_h, radius * sn))
            nrm.append((0.0, float(sign), 0.0))
            uv.append((0.5 + 0.5 * c, 0.5 + 0.5 * sn))
        for s in range(segments):
            a, b = first + s, first + s + 1
            # The two caps face opposite ways, so they wind opposite ways.
            idx += [centre, b, a] if sign > 0 else [centre, a, b]
    return pos, nrm, uv, idx


def cone(segments=48, half_h=0.5, radius=0.4):
    """A single pole where every UV converges: the classic pinch case."""
    pos, nrm, uv = [], [], []
    idx = []
    slope = radius / (2 * half_h)

    # Apex is duplicated per segment so each side gets its own normal and UV.
    for s in range(segments + 1):
        theta = 2 * math.pi * s / segments
        c, sn = math.cos(theta), math.sin(theta)
        pos.append((0.0, half_h, 0.0))
        nrm.append(unit_normal((c, slope, sn)))
        uv.append((s / segments, 0.0))
    base_start = len(pos)
    for s in range(segments + 1):
        theta = 2 * math.pi * s / segments
        c, sn = math.cos(theta), math.sin(theta)
        pos.append((radius * c, -half_h, radius * sn))
        nrm.append(unit_normal((c, slope, sn)))
        uv.append((s / segments, 1.0))
    for s in range(segments):
        idx += [s, base_start + s + 1, base_start + s]

    centre = len(pos)
    pos.append((0.0, -half_h, 0.0))
    nrm.append((0.0, -1.0, 0.0))
    uv.append((0.5, 0.5))
    first = len(pos)
    for s in range(segments + 1):
        theta = 2 * math.pi * s / segments
        c, sn = math.cos(theta), math.sin(theta)
        pos.append((radius * c, -half_h, radius * sn))
        nrm.append((0.0, -1.0, 0.0))
        uv.append((0.5 + 0.5 * c, 0.5 + 0.5 * sn))
    for s in range(segments):
        idx += [centre, first + s, first + s + 1]
    return pos, nrm, uv, idx


def capsule(segments=48, cap_rings=12, radius=0.25, half_h=0.25):
    """Curved everywhere, with no pole and no cap seam - the control case for
    the cylinder and the cone."""
    pos, nrm, uv = [], [], []
    rows = 2 * cap_rings + 1
    for r in range(rows + 1):
        # Walk the top cap, the straight wall, then the bottom cap.
        if r <= cap_rings:
            phi = (math.pi / 2) * r / cap_rings
            ny, ring, y = math.cos(phi), math.sin(phi), half_h
        elif r == cap_rings + 1:
            ny, ring, y = 0.0, 1.0, -half_h
        else:
            phi = (math.pi / 2) * (r - cap_rings - 1) / cap_rings
            ny, ring, y = -math.sin(phi), math.cos(phi), -half_h
        for s in range(segments + 1):
            theta = 2 * math.pi * s / segments
            c, sn = math.cos(theta), math.sin(theta)
            n = (ring * c, ny, ring * sn)
            pos.append((radius * n[0], y + radius * ny, radius * n[2]))
            nrm.append(n)
            uv.append((s / segments, r / rows))
    return pos, nrm, uv, grid_indices(segments, rows)


def torus_knot(p=2, q=3, segments=256, sides=24, radius=0.3, tube=0.09):
    """Self-occluding with high curvature variation: the stress test for depth,
    normal and screen-space effects."""

    def curve(t):
        r = 0.5 * (2 + math.cos(q * t))
        return (r * math.cos(p * t), r * math.sin(p * t), 0.5 * math.sin(q * t))

    pos, nrm, uv = [], [], []
    for i in range(segments + 1):
        t = 2 * math.pi * i / segments
        eps = 1e-4
        point = curve(t)
        nxt = curve(t + eps)
        tangent = unit_normal(tuple(nxt[k] - point[k] for k in range(3)))
        # Frenet-ish frame: any consistent normal works, the curve never
        # straightens enough for it to degenerate.
        ref = (0.0, 0.0, 1.0) if abs(tangent[2]) < 0.9 else (1.0, 0.0, 0.0)
        binorm = unit_normal((
            tangent[1] * ref[2] - tangent[2] * ref[1],
            tangent[2] * ref[0] - tangent[0] * ref[2],
            tangent[0] * ref[1] - tangent[1] * ref[0],
        ))
        normal = unit_normal((
            binorm[1] * tangent[2] - binorm[2] * tangent[1],
            binorm[2] * tangent[0] - binorm[0] * tangent[2],
            binorm[0] * tangent[1] - binorm[1] * tangent[0],
        ))
        for j in range(sides + 1):
            v = 2 * math.pi * j / sides
            cv, sv = math.cos(v), math.sin(v)
            n = unit_normal(tuple(cv * normal[k] + sv * binorm[k] for k in range(3)))
            pos.append(tuple(radius * point[k] + tube * n[k] for k in range(3)))
            nrm.append(n)
            uv.append((i / segments, j / sides))
    return pos, nrm, uv, grid_indices(sides, segments)


MODELS = {
    "sphere": uv_sphere,
    "torus": torus,
    "cylinder": cylinder,
    "cone": cone,
    "capsule": capsule,
    "torus-knot": torus_knot,
}


def main():
    print("Generating preview models:")
    for name, build in MODELS.items():
        pos, nrm, uv, idx = build()
        write_glb(OUT_DIR / f"{name}.glb", normalise_to_unit_cube(pos), nrm, uv, idx, name)


if __name__ == "__main__":
    main()
