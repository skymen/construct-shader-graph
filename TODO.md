# Features

- allow copy/pasting/duplicating nodes

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
- [ ] Fract (fractional part of a number)
- [ ] Floor (round down)
- [ ] Ceil (round up)
- [ ] Round (round to nearest integer)
- [ ] Sign (returns -1, 0, or 1)
- [ ] Mod/Fmod (modulo operation)
- [ ] Sqrt (square root)
- [ ] Exp (exponential)
- [ ] Log (logarithm)
- [ ] Exp2 (2^x)
- [ ] Log2 (log base 2)

### Trigonometry

- [x] Sin (sine) - SinNode
- [x] Cos (cosine) - CosNode
- [x] Tan (tangent) - TanNode
- [ ] Asin (arc sine)
- [ ] Acos (arc cosine)
- [ ] Atan (arc tangent)
- [ ] Atan2 (arc tangent of y/x)
- [ ] Radians (degrees to radians)
- [ ] Degrees (radians to degrees)

### Vector Operations

- [ ] Dot (dot product)
- [ ] Cross (cross product)
- [ ] Length (vector length/magnitude)
- [ ] Distance (distance between two points)
- [ ] Normalize (normalize vector to unit length)
- [ ] Reflect (reflect vector)
- [ ] Refract (refract vector)
- [ ] FaceForward (orient vector to face forward)

### Vector Construction/Decomposition

- [x] Vec2 (combine 2 scalars into vec2) - Vec2Node
- [x] Vec3 (combine 3 scalars into vec3) - Vec3Node
- [x] Vec4 (combine 4 scalars into vec4) - Vec4Node
- [x] Vec2 Decompose (split vec2 into X, Y) - Vec2DecomposeNode
- [x] Vec3 Decompose (split vec3 into X, Y, Z) - Vec3DecomposeNode
- [x] Vec4 Decompose (split vec4 into X, Y, Z, W) - Vec4DecomposeNode
- [ ] Split/Swizzle (extract components with swizzle like .xyz, .rgb, .xxy, etc.)
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

- [ ] Random/Hash (pseudo-random from seed)
- [ ] Value Noise
- [ ] Perlin Noise
- [ ] Simplex Noise
- [ ] Voronoi/Worley Noise
- [ ] Fractal Brownian Motion (FBM)

### UV/Coordinate Operations

- [ ] Tiling/Repeat (repeat UVs)
- [ ] Offset (offset UVs)
- [ ] Rotate (rotate UVs around point)
- [ ] Scale (scale UVs from center)
- [ ] Polar Coordinates (cartesian to polar)
- [ ] Twirl/Swirl (twist UVs around point)
- [ ] Flip (flip UVs horizontally/vertically)

### Gradient/Interpolation

- [ ] Gradient (linear gradient)
- [ ] Radial Gradient
- [ ] Remap (remap value from one range to another)

### Utility

- [x] Compare (>, >=, ==, !=, <=, <) - CompareNode (outputs boolean)
- [ ] If/Branch (conditional branching)
- [ ] Select/Ternary (select between two values based on condition)
- [ ] One Minus (1 - x)
- [ ] Negate (-x)
- [ ] Reciprocal (1/x)
- [ ] Saturate (clamp to 0-1)
- [ ] DDX (derivative in X)
- [ ] DDY (derivative in Y)
- [ ] FWIDTH (sum of absolute derivatives)

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
