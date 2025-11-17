# Shader Node Ideas from Construct Documentation

## ✅ All WebGPU Helper Functions Implemented

### Coordinate Transformation Functions

- [x] **c3_srcToNorm** - ✅ IMPLEMENTED as `SrcToNormNode`

  - Converts position to normalized [0,1] range relative to srcStart/srcEnd
  - WebGPU: `c3_srcToNorm(p)` ✅
  - WebGL: `(p - srcStart) / (srcEnd - srcStart)` ✅

- [x] **c3_normToSrc** - ✅ IMPLEMENTED as `NormToSrcNode`

  - Converts normalized [0,1] position back to src coordinates
  - WebGPU: `c3_normToSrc(p)` ✅
  - WebGL: `mix(srcStart, srcEnd, p)` ✅

- [x] **c3_srcOriginToNorm** - ✅ IMPLEMENTED as `SrcOriginToNormNode`

  - Converts position to normalized [0,1] range relative to srcOriginStart/srcOriginEnd
  - WebGPU: `c3_srcOriginToNorm(input.fragUV)` ✅
  - WebGL: `(vTex - srcOriginStart) / (srcOriginEnd - srcOriginStart)` ✅

- [x] **c3_normToSrcOrigin** - ✅ IMPLEMENTED as `NormToSrcOriginNode`

  - Converts normalized [0,1] position back to srcOrigin coordinates
  - WebGPU: `c3_normToSrcOrigin(p)` ✅
  - WebGL: `mix(srcOriginStart, srcOriginEnd, p)` ✅

- [x] **c3_getLayoutPos** - ✅ IMPLEMENTED as `GetLayoutPosNode`

  - Gets the current layout position being rendered
  - WebGPU: `c3_getLayoutPos(input.fragUV)` ✅
  - WebGL: `mix(layoutStart, layoutEnd, normalizedCoords)` ✅

- [x] **c3_srcToDest** - ✅ IMPLEMENTED as `SrcToDestNode`
  - Maps texture coordinate from src rectangle to dest rectangle
  - WebGPU: `c3_srcToDest(p)` ✅
  - WebGL: `mix(destStart, destEnd, (p - srcStart) / (srcEnd - srcStart))` ✅

### Clamping Functions

- [x] **c3_clampToSrc** - ✅ IMPLEMENTED as `ClampToSrcNode`

  - Clamps position to srcStart/srcEnd box
  - WebGPU: `c3_clampToSrc(p)` ✅
  - WebGL: `clamp(p, srcStart, srcEnd)` ✅

- [x] **c3_clampToSrcOrigin** - ✅ IMPLEMENTED as `ClampToSrcOriginNode`

  - Clamps position to srcOriginStart/srcOriginEnd box
  - WebGPU: `c3_clampToSrcOrigin(p)` ✅
  - WebGL: `clamp(p, srcOriginStart, srcOriginEnd)` ✅

- [x] **c3_clampToDest** - ✅ IMPLEMENTED as `ClampToDestNode`
  - Clamps position to destStart/destEnd box
  - WebGPU: `c3_clampToDest(p)` ✅
  - WebGL: `clamp(p, destStart, destEnd)` ✅

### Depth Functions

- [x] **c3_linearizeDepth** - ✅ IMPLEMENTED as `LinearizeDepthNode`
  - Converts depth buffer value to linear depth
  - WebGPU: `c3_linearizeDepth(depthSample)` ✅
  - WebGL: `(2.0 * zNear * zFar) / (zFar + zNear - depth * (zFar - zNear))` ✅

### Alpha Blending Functions

- [x] **c3_unpremultiply** - ✅ IMPLEMENTED as `UnpremultiplyNode`

  - Converts premultiplied alpha to unpremultiplied
  - WebGPU: `c3_unpremultiply(color)` ✅
  - WebGL: `if (a != 0.0) color.rgb /= a;` ✅

- [x] **c3_premultiply** - ✅ IMPLEMENTED as `PremultiplyNode`
  - Converts unpremultiplied to premultiplied alpha
  - WebGPU: `c3_premultiply(color)` ✅
  - WebGL: `color.rgb *= a;` ✅

### Color Conversion Functions

- [x] **c3_grayscale** - ✅ IMPLEMENTED as `GrayscaleNode`

  - Converts RGB to grayscale
  - WebGPU: `c3_grayscale(rgb)` ✅
  - WebGL: `dot(rgb, vec3(0.299, 0.587, 0.114))` ✅

- [x] **c3_RGBtoHSL** - ✅ IMPLEMENTED as `RGBtoHSLNode`

  - Converts RGB to HSL color space
  - WebGPU: `c3_RGBtoHSL(color)` ✅
  - WebGL: Custom rgb2hsl() function ✅

- [x] **c3_HSLtoRGB** - ✅ IMPLEMENTED as `HSLtoRGBNode`
  - Converts HSL to RGB color space
  - WebGPU: `c3_HSLtoRGB(hsl)` ✅
  - WebGL: Custom hsl2rgb() function ✅

### Texture Information Functions

- [x] **c3_getPixelSize** - ✅ IMPLEMENTED as `PixelSizeNode`
  - Gets pixel size in texture coordinates
  - WebGPU: `c3_getPixelSize(textureFront)` ✅
  - WebGL: `pixelSize` uniform ✅

### UV Helper Functions

- [x] **c3_getBackUV** - ✅ IMPLEMENTED as `BackUVNode` (FIXED)

  - Gets UV coordinates for sampling background texture
  - WebGPU: `c3_getBackUV(input.fragPos.xy, textureBack)` ✅
  - WebGL: `(vTex - srcStart) / (srcEnd - srcStart)` ✅

- [x] **c3_getDepthUV** - ✅ IMPLEMENTED as `DepthUVNode` (FIXED)
  - Gets UV coordinates for sampling depth buffer
  - WebGPU: `c3_getDepthUV(input.fragPos.xy, textureDepth)` ✅
  - WebGL: `(vTex - srcStart) / (srcEnd - srcStart)` ✅

### Custom Size Calculations

- [x] **texelSize** - ✅ IMPLEMENTED as `TexelSizeNode`

  - Calculates texture space per layout pixel
  - Formula: `abs(srcOriginEnd - srcOriginStart) / abs(layoutEnd - layoutStart)` ✅

- [x] **layoutPixelSize** - ✅ IMPLEMENTED as `LayoutPixelSizeNode`
  - Calculates layout space per destination pixel
  - Formula: `abs(layoutEnd - layoutStart) / abs(destEnd - destStart)` ✅

---

## Summary

**Total: 20 helper function nodes implemented**

All Construct 3 WebGPU/WebGL shader helper functions have been successfully implemented with correct formulas for both shader languages.
