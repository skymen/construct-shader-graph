// Wait for shader data from parent window before starting

let shaderDataPromise = (async () => {
  // If we're in an iframe, wait for shader data from parent
  if (window !== window.parent) {
    await waitForShaderData();
  } else {
    // If not in iframe, use default shader data
    setupDefaultShader();
  }
})();

runOnStartup(async (runtime) => {
  await shaderDataPromise;
  runtime.addEventListener("beforeprojectstart", () =>
    OnBeforeProjectStart(runtime)
  );
});

let piggy;
let shape3D;
let background;
let background3d;
let camera;
let layout;
let layer;

// Promise that waits for shader data from parent window
function waitForShaderData() {
  return new Promise((resolve) => {
    const messageHandler = (event) => {
      if (event.data && event.data.type === "shaderData") {
        // Store the shader data
        self["C3_Shaders"] = self["C3_Shaders"] || {};
        self["C3_Shaders"]["skymen_Placeholdereffect"] = event.data.shaderData;
        console.log(self["C3_Shaders"]["skymen_Placeholdereffect"]);
        // Clean up listener
        window.removeEventListener("message", messageHandler);

        resolve();
      }
    };

    window.addEventListener("message", messageHandler);

    // Signal to parent that we're ready to receive shader data
    window.parent.postMessage({ type: "requestShaderData" }, "*");
  });
}

// Setup default shader data when not in iframe
function setupDefaultShader() {
  self["C3_Shaders"] = self["C3_Shaders"] || {};
  self["C3_Shaders"]["skymen_Placeholdereffect"] = {
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
}

async function OnBeforeProjectStart(runtime) {
  // Capture shader errors and warnings
  setupShaderErrorCapture();

  piggy = runtime.objects.Piggy.getFirstInstance();
  shape3D = runtime.objects.shape3d.getFirstInstance();
  background = runtime.objects.background.getFirstInstance();
  background3d = runtime.objects.background3d.getFirstInstance();
  camera = runtime.objects.camera;
  layout = runtime.layout;
  layer = piggy.layer;

  if (window !== window.parent) {
    // Signal that project is ready for parameter updates
    window.parent.postMessage({ type: "projectReady" }, "*");

    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "updateParam") {
        updateParam(runtime, event.data.index, event.data.value);
      }
    });
  }
}

function updateParam(runtime, index, value) {
  piggy.effects[0].setParameter(index, value);
  shape3D.effects[0].setParameter(index, value);
  layout.effects[0].setParameter(index, value);
  layer.effects[0].setParameter(index, value);
}

function setEffectTarget(target) {
  piggy.effects[0].isActive = false;
  shape3D.effects[0].isActive = false;
  layout.effects[0].isActive = false;
  layer.effects[0].isActive = false;

  switch (target) {
    case "piggy":
      piggy.effects[0].isActive = true;
      break;
    case "shape3D":
      shape3D.effects[0].isActive = true;
      break;
    case "layout":
      layout.effects[0].isActive = true;
      break;
    case "layer":
      layer.effects[0].isActive = true;
      break;
  }
}

function setObject(object) {
  // "sprite", "box", "prism", "wedge", "pyramid", "corner-out" and "corner-in"
  piggy.isVisible = false;
  shape3D.isVisible = false;

  if (object === "sprite") {
    piggy.isVisible = true;
  } else {
    shape3D.isVisible = true;
    shape3D.shape = object;
  }
}

function setCameraMode(mode) {
  //2d, perspective, orthographic
}

function setupShaderErrorCapture() {
  // Capture console errors and warnings
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = function (...args) {
    originalError.apply(console, args);

    // Check if it's a shader-related error
    const message = args.join(" ");
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
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);

    // Check if it's a shader-related warning
    const message = args.join(" ");
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
