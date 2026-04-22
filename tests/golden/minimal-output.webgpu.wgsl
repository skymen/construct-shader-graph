%%FRAGMENTINPUT_STRUCT%%
%%FRAGMENTOUTPUT_STRUCT%%

%%C3_UTILITY_FUNCTIONS%%

%%C3PARAMS_STRUCT%%

%%SAMPLERFRONT_BINDING%% var samplerFront : sampler;
%%TEXTUREFRONT_BINDING%% var textureFront : texture_2d<f32>;
@fragment
fn main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    // Vec4
    var var_0: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 0.0);

    // Output
    output.color = var_0;
    return output;
}
