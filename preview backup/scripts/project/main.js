runOnStartup(async (runtime) => {
  runtime.addEventListener("beforeprojectstart", () =>
    OnBeforeProjectStart(runtime)
  );
});

async function OnBeforeProjectStart(runtime) {
  // Capture shader errors and warnings
  setupShaderErrorCapture();

  if (window !== window.parent) {
    window.parent.postMessage({ type: "projectReady" }, "*");

    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "updateParam") {
        updateParam(runtime, event.data.index, event.data.value);
      }
    });
  }
}

function updateParam(runtime, index, value) {
  let inst = runtime.objects.Piggy.getFirstInstance();
  inst.effects[0].setParameter(index, value);
}

function setupShaderErrorCapture() {
  // Capture console errors and warnings
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = function (...args) {
    originalError.apply(console, args);

    // Check if it's a shader-related error
    const message = args.join(" ");
    if (
      message.includes("shader") ||
      message.includes("GLSL") ||
      message.includes("WebGL") ||
      message.includes("WebGPU")
    ) {
      if (window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: message,
            severity: "error",
          },
          "*"
        );
      }
    }
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);

    // Check if it's a shader-related warning
    const message = args.join(" ");
    if (
      message.includes("shader") ||
      message.includes("GLSL") ||
      message.includes("WebGL") ||
      message.includes("WebGPU")
    ) {
      if (window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: message,
            severity: "warning",
          },
          "*"
        );
      }
    }
  };

  // Capture WebGL errors
  if (window.WebGLRenderingContext) {
    const originalGetShaderInfoLog =
      WebGLRenderingContext.prototype.getShaderInfoLog;
    WebGLRenderingContext.prototype.getShaderInfoLog = function (shader) {
      const log = originalGetShaderInfoLog.call(this, shader);
      if (log && log.trim() && window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: log,
            severity: log.toLowerCase().includes("error") ? "error" : "warning",
          },
          "*"
        );
      }
      return log;
    };

    const originalGetProgramInfoLog =
      WebGLRenderingContext.prototype.getProgramInfoLog;
    WebGLRenderingContext.prototype.getProgramInfoLog = function (program) {
      const log = originalGetProgramInfoLog.call(this, program);
      if (log && log.trim() && window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: log,
            severity: log.toLowerCase().includes("error") ? "error" : "warning",
          },
          "*"
        );
      }
      return log;
    };
  }

  // Capture WebGL2 errors
  if (window.WebGL2RenderingContext) {
    const originalGetShaderInfoLog =
      WebGL2RenderingContext.prototype.getShaderInfoLog;
    WebGL2RenderingContext.prototype.getShaderInfoLog = function (shader) {
      const log = originalGetShaderInfoLog.call(this, shader);
      if (log && log.trim() && window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: log,
            severity: log.toLowerCase().includes("error") ? "error" : "warning",
          },
          "*"
        );
      }
      return log;
    };

    const originalGetProgramInfoLog =
      WebGL2RenderingContext.prototype.getProgramInfoLog;
    WebGL2RenderingContext.prototype.getProgramInfoLog = function (program) {
      const log = originalGetProgramInfoLog.call(this, program);
      if (log && log.trim() && window !== window.parent) {
        window.parent.postMessage(
          {
            type: "shaderError",
            message: log,
            severity: log.toLowerCase().includes("error") ? "error" : "warning",
          },
          "*"
        );
      }
      return log;
    };
  }
}

{
  // THIS IS WHERE YOU NEED TO LOOK
  // Query parameter parsing function
  self.getQueryParams = function () {
    const urlParams = new URLSearchParams(self.location.search);
    const params = {};
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    return params;
  };
  self["C3_Shaders"] = {};

  // Get query parameters for shader customization
  const queryParams = self.getQueryParams ? self.getQueryParams() : {};

  // Default shader definition
  const defaultShaderData = {
    glsl: "#ifdef GL_FRAGMENT_PRECISION_HIGH\n#define highmedp highp\n#else\n#define highmedp mediump\n#endif\nprecision lowp float;\nvarying mediump vec2 vTex;\nuniform mediump vec2 pixelSize;\nuniform lowp sampler2D samplerFront;\nvoid main() {\nvar_0 = vTex;\nvec4 var_1 = texture2D(samplerFront, var_0.xy);\nvec3 var_2 = var_1.xyz;\nfloat var_3 = var_1.a;\ngl_FragColor = var_1;\n}",
    glslWebGL2:
      "#version 300 es\n#ifdef GL_FRAGMENT_PRECISION_HIGH\n#define highmedp highp\n#else\n#define highmedp mediump\n#endif\nprecision lowp float;\nuniform mediump vec2 pixelSize;\nin mediump vec2 vTex;\nout lowp vec4 outColor;\nuniform lowp sampler2D samplerFront;\nvoid main() {\nvar_0 = vTex;\nvec4 var_1 = texture(samplerFront, var_0.xy);\nvec3 var_2 = var_1.xyz;\nfloat var_3 = var_1.a;\nfragColor = var_1;\n}",
    wgsl: "%%FRAGMENTINPUT_STRUCT%%\n%%FRAGMENTOUTPUT_STRUCT%%\n%%C3_UTILITY_FUNCTIONS%%\n%%C3PARAMS_STRUCT%%\n%%SAMPLERFRONT_BINDING%% var samplerFront : sampler;\n%%TEXTUREFRONT_BINDING%% var textureFront : texture_2d<f32>;\n@fragment\nfn main(input : FragmentInput) -> FragmentOutput {\nvar output : FragmentOutput;\nvar var_0: vec2<f32> = input.fragUV;\nvar var_1: vec4<f32> = textureSample(textureFront, samplerFront, var_0.xy);\nvar var_2: vec3<f32> = var_1.xyz;\nvar var_3: f32 = var_1.a;\noutput.color = var_1;\nreturn output;\n}",
    blendsBackground: false,
    usesDepth: false,
    extendBoxHorizontal: 0,
    extendBoxVertical: 0,
    crossSampling: false,
    mustPreDraw: false,
    preservesOpaqueness: true,
    supports3dDirectRendering: false,
    animated: false,
    parameters: [],
  };

  // Apply query parameter overrides if they exist
  const shaderData = { ...defaultShaderData };

  // Override shader properties from query parameters
  if (queryParams.shader_glsl) {
    shaderData.glsl = decodeURIComponent(queryParams.shader_glsl);
  }
  if (queryParams.shader_glslWebGL2) {
    shaderData.glslWebGL2 = decodeURIComponent(queryParams.shader_glslWebGL2);
  }
  if (queryParams.shader_wgsl) {
    shaderData.wgsl = decodeURIComponent(queryParams.shader_wgsl);
  }
  if (queryParams.shader_blendsBackground !== undefined) {
    shaderData.blendsBackground =
      queryParams.shader_blendsBackground === "true";
  }
  if (queryParams.shader_usesDepth !== undefined) {
    shaderData.usesDepth = queryParams.shader_usesDepth === "true";
  }
  if (queryParams.shader_extendBoxHorizontal !== undefined) {
    shaderData.extendBoxHorizontal =
      parseInt(queryParams.shader_extendBoxHorizontal) || 0;
  }
  if (queryParams.shader_extendBoxVertical !== undefined) {
    shaderData.extendBoxVertical =
      parseInt(queryParams.shader_extendBoxVertical) || 0;
  }
  if (queryParams.shader_crossSampling !== undefined) {
    shaderData.crossSampling = queryParams.shader_crossSampling === "true";
  }
  if (queryParams.shader_mustPreDraw !== undefined) {
    shaderData.mustPreDraw = queryParams.shader_mustPreDraw === "true";
  }
  if (queryParams.shader_preservesOpaqueness !== undefined) {
    shaderData.preservesOpaqueness =
      queryParams.shader_preservesOpaqueness === "true";
  }
  if (queryParams.shader_supports3dDirectRendering !== undefined) {
    shaderData.supports3dDirectRendering =
      queryParams.shader_supports3dDirectRendering === "true";
  }
  if (queryParams.shader_animated !== undefined) {
    shaderData.animated = queryParams.shader_animated === "true";
  }

  // Parse parameters from JSON string
  if (queryParams.shader_parameters) {
    try {
      shaderData.parameters = JSON.parse(queryParams.shader_parameters);
    } catch (e) {
      console.warn("Failed to parse shader_parameters:", e);
      shaderData.parameters = [];
    }
  }

  // Assign the final shader data
  self["C3_Shaders"]["skymen_Placeholdereffect"] = shaderData;
}

{
  self.C3.WorldInfo = class extends self.C3.WorldInfo {
    Init(t) {
      t[12] = [
        [
          true,
          ...self["C3_Shaders"]["skymen_Placeholdereffect"].parameters.map(
            (p) => {
              return p[2] === "color" ? [1, 1, 1] : 1;
            }
          ),
        ],
      ];
      super.Init(t);
    }
  };
}
