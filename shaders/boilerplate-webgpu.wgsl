%%FRAGMENTINPUT_STRUCT%%
%%FRAGMENTOUTPUT_STRUCT%%

%%C3_UTILITY_FUNCTIONS%%

%%C3PARAMS_STRUCT%%
/* c3Params struct contains the following fields:
srcStart : vec2<f32>,
srcEnd : vec2<f32>,
srcOriginStart : vec2<f32>,
srcOriginEnd : vec2<f32>,
layoutStart : vec2<f32>,
layoutEnd : vec2<f32>,
destStart : vec2<f32>,
destEnd : vec2<f32>,
devicePixelRatio : f32,
layerScale : f32,
layerAngle : f32,
seconds : f32,
zNear : f32,
zFar : f32,
isSrcTexRotated : u32
fn c3_srcToNorm(p : vec2<f32>) -> vec2<f32>
fn c3_normToSrc(p : vec2<f32>) -> vec2<f32>
fn c3_srcOriginToNorm(p : vec2<f32>) -> vec2<f32>
fn c3_normToSrcOrigin(p : vec2<f32>) -> vec2<f32>
fn c3_clampToSrc(p : vec2<f32>) -> vec2<f32>
fn c3_clampToSrcOrigin(p : vec2<f32>) -> vec2<f32>
fn c3_getLayoutPos(p : vec2<f32>) -> vec2<f32>
fn c3_srcToDest(p : vec2<f32>) -> vec2<f32>
fn c3_clampToDest(p : vec2<f32>) -> vec2<f32>
fn c3_linearizeDepth(depthSample : f32) -> f32
*/

