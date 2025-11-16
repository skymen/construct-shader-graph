# Features

- allow copy/pasting/duplicating nodes
- background is broken for some reason

# Content

- actually add all of the nodes

## Common Shader Operations to Implement

### Math Operations

- [x] Add (A + B) - Available in Math node
- [x] Subtract (A - B) - Available in Math node
- [x] Multiply (A × B) - Available in Math node
- [x] Divide (A ÷ B) - Available in Math node
- [x] Power (A^B) - PowerNode
- [x] Abs (absolute value) - AbsNode
- [x] Min (minimum of two values) - MinNode
- [x] Max (maximum of two values) - MaxNode
- [x] Clamp (clamp value between min and max) - ClampNode
- [x] Lerp/Mix (linear interpolation between two values) - MixNode
- [x] Smoothstep (smooth Hermite interpolation) - SmoothstepNode
- [x] Step (step function, returns 0 or 1) - StepNode
- [x] Fract (fractional part of a number) - FractNode
- [x] Floor (round down) - FloorNode
- [x] Ceil (round up) - CeilNode
- [x] Round (round to nearest integer) - RoundNode
- [x] Sign (returns -1, 0, or 1) - SignNode
- [x] Mod/Fmod (modulo operation) - ModNode
- [x] Sqrt (square root) - SqrtNode
- [x] Exp (exponential) - ExpNode
- [x] Log (logarithm) - LnNode, Log10Node, Log2Node
- [x] Exp2 (2^x) - Exp2Node
- [x] Log2 (log base 2) - Log2Node

### Trigonometry

- [x] Sin (sine) - SinNode
- [x] Cos (cosine) - CosNode
- [x] Tan (tangent) - TanNode
- [x] Asin (arc sine) - AsinNode
- [x] Acos (arc cosine) - AcosNode
- [x] Atan (arc tangent) - AtanNode
- [x] Atan2 (arc tangent of y/x) - Atan2Node
- [x] Radians (degrees to radians) - ToRadiansNode
- [x] Degrees (radians to degrees) - ToDegreesNode

### Vector Operations

- [x] Dot (dot product) - DotNode
- [x] Cross (cross product) - CrossNode
- [x] Length (vector length/magnitude) - LengthNode
- [x] Distance (distance between two points) - DistanceNode
- [x] Normalize (normalize vector to unit length) - NormalizeNode

### Vector Construction/Decomposition

- [x] Vec2 (combine 2 scalars into vec2) - Vec2Node
- [x] Vec3 (combine 3 scalars into vec3) - Vec3Node
- [x] Vec4 (combine 4 scalars into vec4) - Vec4Node
- [x] Vec2 Decompose (split vec2 into X, Y) - Vec2DecomposeNode
- [x] Vec3 Decompose (split vec3 into X, Y, Z) - Vec3DecomposeNode
- [x] Vec4 Decompose (split vec4 into X, Y, Z, W) - Vec4DecomposeNode
- [x] Split/Swizzle (extract components with swizzle like .xyz, .rgb, .xxy, etc.) - SwizzleNode
- [ ] Append (append values to vector, e.g., vec2 + float = vec3)

### Texture Operations

- [x] Texture Sample Front (sample front texture) - TextureFrontNode (outputs RGBA, Color, Alpha)
- [x] Texture Sample Back (sample background texture) - TextureBackNode (outputs RGBA, Color, Alpha)
- [x] Texture Sample Depth (sample depth texture) - TextureDepthNode (outputs RGBA, Color, Alpha)
- [x] Front UV (get front texture UV coordinates) - FrontUVNode
- [x] Back UV (get background texture UV coordinates) - BackUVNode
- [x] Depth UV (get depth texture UV coordinates) - DepthUVNode
- [ ] Texture Sample LOD (sample with specific mip level)
- [ ] Texture Sample Grad (sample with explicit gradients)
- [ ] Texture Size (get texture dimensions)

### Color Operations

- [ ] RGB to HSV
- [ ] HSV to RGB
- [ ] RGB to Grayscale/Luminance
- [ ] Desaturate
- [ ] Contrast
- [ ] Brightness
- [ ] Hue Shift
- [ ] Color Invert
- [ ] Posterize
- [ ] Blend modes (Multiply, Add, Screen, Overlay, etc.)

### Noise Functions

- [x] Random/Hash (pseudo-random from seed) - Hash11Node, Hash21Node, Hash22Node, Hash33Node
- [x] Value Noise - ValueNoiseNode
- [x] Perlin Noise - PerlinNoiseNode
- [x] Simplex Noise - SimplexNoiseNode
- [x] Voronoi/Worley Noise - VoronoiNoiseNode
- [x] Fractal Brownian Motion (FBM) - FBMNode

### UV/Coordinate Operations

- [x] Tiling/Repeat (repeat UVs) - TilingNode, WrapUVNode
- [x] Offset (offset UVs) - WrapUVNode (with offset parameter)
- [x] Rotate (rotate UVs around point) - RotateAroundPointNode
- [x] Scale (scale UVs from center) - ScaleUVNode
- [x] Polar Coordinates (cartesian to polar) - CartesianToPolarNode, PolarToCartesianNode
- [x] Spherical Coordinates (cartesian to spherical) - CartesianToSphericalNode, SphericalToCartesianNode
- [x] Twirl/Swirl (twist UVs around point) - TwirlNode
- [x] Flip (flip UVs horizontally/vertically) - FlipNode

### Gradient/Interpolation

- [ ] Gradient (linear gradient)
- [ ] Radial Gradient
- [x] Remap (remap value from one range to another) - RemapNode

### Utility

- [x] Compare (>, >=, ==, !=, <=, <) - CompareNode (outputs boolean)
- [ ] If/Branch (conditional branching)
- [x] Select/Ternary (select between two values based on condition) - SelectNode
- [x] To Float (convert int to float) - ToFloatNode
- [x] To Int (convert float to int) - ToIntNode
- [ ] One Minus (1 - x)
- [ ] Negate (-x)
- [ ] Reciprocal (1/x)
- [ ] Saturate (clamp to 0-1)
- [x] DDX (derivative in X) - DDXNode
- [x] DDY (derivative in Y) - DDYNode
- [x] FWIDTH (sum of absolute derivatives) - FWidthNode

### Advanced

- [ ] Matrix operations (multiply, transform, etc.)
- [ ] Normal mapping
- [ ] Parallax mapping
- [ ] Screen-space derivatives
- [x] Custom code block (for advanced users) - Custom Node system

### Built-in Parameters (Construct 3 specific)

- [x] srcStart (vec2) - BuiltinSrcStartNode
- [x] srcEnd (vec2) - BuiltinSrcEndNode
- [x] srcOriginStart (vec2) - BuiltinSrcOriginStartNode
- [x] srcOriginEnd (vec2) - BuiltinSrcOriginEndNode
- [x] layoutStart (vec2) - BuiltinLayoutStartNode
- [x] layoutEnd (vec2) - BuiltinLayoutEndNode
- [x] destStart (vec2) - BuiltinDestStartNode
- [x] destEnd (vec2) - BuiltinDestEndNode
- [x] devicePixelRatio (float) - BuiltinDevicePixelRatioNode
- [x] layerScale (float) - BuiltinLayerScaleNode
- [x] layerAngle (float) - BuiltinLayerAngleNode
- [x] seconds (float) - BuiltinSecondsNode
- [x] zNear (float) - BuiltinZNearNode
- [x] zFar (float) - BuiltinZFarNode

### Output

- [x] Output (final shader output) - OutputNode

# UX

- make number inputs draggable
- make more types editable
- fix float/percent value type
- zoom out with command scroll is horrible
