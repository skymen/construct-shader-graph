// WebGPU Shader (WGSL)
// Generated shader from Blueprint System

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uSampler: sampler;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    var vUV = input.uv;

