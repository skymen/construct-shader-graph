%%FRAGMENTINPUT_STRUCT%%
%%FRAGMENTOUTPUT_STRUCT%%

%%C3_UTILITY_FUNCTIONS%%

%%C3PARAMS_STRUCT%%

%%SAMPLERFRONT_BINDING%% var samplerFront : sampler;
%%TEXTUREFRONT_BINDING%% var textureFront : texture_2d<f32>;
// --- Function declarations ---
fn fn_fnConcrete(x: f32) -> f32 {

    // Math
    var fv_0: f32 = x + 0.0;
    return fv_0;
}


@fragment
fn main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    // FnConcrete
    let var_0 = fn_fnConcrete(0.0);

    // To Vec4
    var var_1: vec4<f32> = vec4<f32>(var_0);

    // Output
    output.color = var_1;
    return output;
}
