# SDF Nodes TODO

## Shape SDF Nodes

Output raw signed distance (negative=inside, zero=edge, positive=outside).

| Node             | Inputs                                                |
| ---------------- | ----------------------------------------------------- |
| Circle SDF       | UV, Center, Radius                                    |
| Rectangle SDF    | UV, Center, Size                                      |
| Rounded Rect SDF | UV, Center, Size, Corner Radius                       |
| Ellipse SDF      | UV, Center, Size                                      |
| Line SDF         | UV, Start, End, Thickness                             |
| Triangle SDF     | UV, A, B, C                                           |
| Polygon SDF      | UV, Center, Radius, Sides                             |
| Star SDF         | UV, Center, Inner Radius, Outer Radius, Points        |
| Arc SDF          | UV, Center, Radius, Start Angle, End Angle, Thickness |
| Pie SDF          | UV, Center, Radius, Start Angle, End Angle            |
| Capsule SDF      | UV, Start, End, Radius                                |

## SDF Operation Nodes

Combine/modify SDF values.

| Node                 | Inputs         | Formula                |
| -------------------- | -------------- | ---------------------- |
| SDF Union            | A, B           | `min(a, b)`            |
| SDF Intersect        | A, B           | `max(a, b)`            |
| SDF Subtract         | A, B           | `max(a, -b)`           |
| SDF Smooth Union     | A, B, K        | smooth min             |
| SDF Smooth Intersect | A, B, K        | smooth max             |
| SDF Smooth Subtract  | A, B, K        | smooth subtract        |
| SDF Invert           | SDF            | `-sdf`                 |
| SDF Offset           | SDF, Offset    | `sdf - offset`         |
| SDF Annular          | SDF, Thickness | `abs(sdf) - thickness` |
| SDF Round            | SDF, Radius    | `sdf - radius`         |

## SDF Output Nodes

Convert SDF to visual output.

| Node       | Inputs                        | Output       |
| ---------- | ----------------------------- | ------------ |
| SDF Fill   | SDF, Feather                  | Mask (float) |
| SDF Stroke | SDF, Width, Feather           | Mask (float) |
| SDF Color  | SDF, Inside, Outside, Feather | Color (vec4) |

## UV Transform Node (New)

| Node            | Inputs            |
| --------------- | ----------------- |
| Radial Symmetry | UV, Center, Folds |
