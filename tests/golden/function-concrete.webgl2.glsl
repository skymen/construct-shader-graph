#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
#define highmedp highp
#else
#define highmedp mediump
#endif

precision lowp float;
uniform mediump vec2 pixelSize;

in mediump vec2 vTex;
out lowp vec4 outColor;

// Builtin uniforms
uniform lowp sampler2D samplerFront;
uniform mediump vec2 srcStart;
uniform mediump vec2 srcEnd;
uniform mediump vec2 srcOriginStart;
uniform mediump vec2 srcOriginEnd;
uniform mediump vec2 layoutStart;
uniform mediump vec2 layoutEnd;
uniform mediump vec2 destStart;
uniform mediump vec2 destEnd;
uniform mediump float devicePixelRatio;
uniform mediump float layerScale;
uniform mediump float layerAngle;
uniform highmedp float seconds;
uniform mediump float zNear;
uniform mediump float zFar;

// --- Function declarations ---
float fn_fnConcrete(float x) {

    // Math
    float fv_0 = x + 0.0;
    return fv_0;
}


void main() {
    // FnConcrete
    float var_0 = fn_fnConcrete(0.0);

    // To Vec4
    vec4 var_1 = vec4(var_0);

    // Output
    outColor = var_1;
}
