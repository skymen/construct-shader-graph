// Wait for shader data from parent window before starting

// Helper to send errors to parent window
function sendErrorToParent(message, severity = "error") {
  if (window !== window.parent) {
    window.parent.postMessage(
      {
        type: "shaderError",
        message: message,
        severity: severity,
      },
      "*",
    );
  }
}

// Helper to send console logs to parent window
function sendConsoleLogToParent(message, level = "log") {
  if (window !== window.parent) {
    window.parent.postMessage(
      {
        type: "consoleLog",
        message: message,
        level: level,
      },
      "*",
    );
  }
}

// Set up WebGPU error capturing IMMEDIATELY before any WebGPU code runs
// This must happen before Construct 3 initializes its renderer
function setupWebGPUErrorCapture() {
  if (!navigator.gpu) return;

  // Hook into GPUDevice creation to capture uncaptured errors
  const originalRequestAdapter = navigator.gpu.requestAdapter.bind(
    navigator.gpu,
  );
  navigator.gpu.requestAdapter = async function (...args) {
    const adapter = await originalRequestAdapter(...args);
    if (adapter) {
      const originalRequestDevice = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async function (...deviceArgs) {
        const device = await originalRequestDevice(...deviceArgs);
        if (device) {
          // Capture uncaptured errors from this device
          device.addEventListener("uncapturederror", (event) => {
            const error = event.error;
            let message = "WebGPU Error";

            if (error instanceof GPUValidationError) {
              message = `WebGPU Validation Error: ${error.message}`;
            } else if (error instanceof GPUOutOfMemoryError) {
              message = `WebGPU Out of Memory Error: ${error.message}`;
            } else if (error instanceof GPUInternalError) {
              message = `WebGPU Internal Error: ${error.message}`;
            } else if (error && error.message) {
              message = `WebGPU Error: ${error.message}`;
            }

            sendErrorToParent(message, "error");
          });

          // Also intercept createShaderModule to capture shader compilation errors
          const originalCreateShaderModule =
            device.createShaderModule.bind(device);
          device.createShaderModule = function (descriptor) {
            const shaderModule = originalCreateShaderModule(descriptor);

            // Check for compilation info asynchronously
            if (shaderModule && shaderModule.getCompilationInfo) {
              shaderModule
                .getCompilationInfo()
                .then((compilationInfo) => {
                  for (const msg of compilationInfo.messages) {
                    const severity = msg.type === "error" ? "error" : "warning";
                    const location =
                      msg.lineNum > 0
                        ? ` (line ${msg.lineNum}, col ${msg.linePos})`
                        : "";
                    sendErrorToParent(
                      `WGSL ${msg.type}${location}: ${msg.message}`,
                      severity,
                    );
                  }
                })
                .catch(() => {
                  // Ignore errors from getCompilationInfo
                });
            }

            return shaderModule;
          };

          // Intercept createRenderPipeline for pipeline creation errors
          const originalCreateRenderPipeline =
            device.createRenderPipeline.bind(device);
          device.createRenderPipeline = function (descriptor) {
            try {
              return originalCreateRenderPipeline(descriptor);
            } catch (e) {
              sendErrorToParent(`WebGPU Pipeline Error: ${e.message}`, "error");
              throw e;
            }
          };

          // Intercept createRenderPipelineAsync
          const originalCreateRenderPipelineAsync =
            device.createRenderPipelineAsync.bind(device);
          device.createRenderPipelineAsync = async function (descriptor) {
            try {
              return await originalCreateRenderPipelineAsync(descriptor);
            } catch (e) {
              sendErrorToParent(`WebGPU Pipeline Error: ${e.message}`, "error");
              throw e;
            }
          };
        }
        return device;
      };
    }
    return adapter;
  };
}

// Run WebGPU interception immediately
setupWebGPUErrorCapture();

// Also set up global error handlers for ALL uncaught errors
window.addEventListener("error", (event) => {
  const message = event.message || "Unknown error";
  const filename = event.filename || "";
  const lineno = event.lineno || 0;
  const colno = event.colno || 0;

  // Send all uncaught errors to parent
  const locationStr = filename ? ` (${filename}:${lineno}:${colno})` : "";
  sendErrorToParent(`${message}${locationStr}`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  let message = "Unhandled Promise Rejection";

  if (reason instanceof Error) {
    message = reason.message;
    if (reason.stack) {
      // Include first line of stack for context
      const stackLine = reason.stack.split("\n")[1];
      if (stackLine) {
        message += ` ${stackLine.trim()}`;
      }
    }
  } else if (typeof reason === "string") {
    message = reason;
  } else if (reason && reason.message) {
    message = reason.message;
  }

  sendErrorToParent(`Unhandled Rejection: ${message}`, "error");
});

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
  globalThis.loadSpriteUrl = (url) => {
    runtime.callFunction("loadSpriteUrl", url, false);

    // C3's "load image from URL" resizes the sprite to the image's natural
    // size, asynchronously. This used to read the size back after a fixed 10ms
    // and lost that race: it captured the still-*scaled* size as the new base,
    // and C3's resize then landed on top and threw the scale away entirely -
    // load a texture and the sprite came out at the image's raw pixel size no
    // matter where the scale sliders were.
    //
    // So take the base size from the image itself, and wait for the instance to
    // actually be at it before re-applying the scale on top.
    const image = new Image();
    image.onerror = () =>
      sendErrorToParent("Preview sprite texture failed to load", "warning");
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!piggy || !(width > 0) || !(height > 0)) return;

      let ticksWaited = 0;
      const reapplyWhenResized = () => {
        const resized =
          Math.abs(piggy.width - width) < 0.5 &&
          Math.abs(piggy.height - height) < 0.5;
        // Bail out after a couple of seconds rather than ticking forever, in
        // case the load action is ever changed to keep the current size.
        if (!resized && ++ticksWaited < 120) return;

        runtime.removeEventListener("tick", reapplyWhenResized);
        baseObjectSize.sprite.w = width;
        baseObjectSize.sprite.h = height;
        applyObjectScale();

        // Report size change to parent
        if (window !== window.parent) {
          window.parent.postMessage(
            {
              type: "spriteSizeChanged",
              width: baseObjectSize.sprite.w,
              height: baseObjectSize.sprite.h,
            },
            "*",
          );
        }
      };
      runtime.addEventListener("tick", reapplyWhenResized);
    };
    image.src = url;
  };
  globalThis.loadShapeUrl = (url) => {
    runtime.callFunction("loadShapeUrl", url, false);
  };
  globalThis.loadModelUrl = (url) => {
    // Not an event-sheet function like the others: the scripting API takes any
    // URL, data: included, and replaces the mesh's image directly.
    applyModelTexture(url);
  };
  globalThis.loadBgUrl = (url) => {
    runtime.callFunction("loadBgUrl", url, false);
  };
  globalThis.updatePreviewSpriteUrl = (url) => {
    if (window !== window.parent) {
      window.parent.postMessage(
        {
          type: "updatePreviewSpriteUrl",
          url: url,
        },
        "*",
      );
    }
  };
  globalThis.updatePreviewShapeUrl = (url) => {
    if (window !== window.parent) {
      window.parent.postMessage(
        {
          type: "updatePreviewShapeUrl",
          url: url,
        },
        "*",
      );
    }
  };
  globalThis.updatePreviewBgUrl = (url) => {
    if (window !== window.parent) {
      window.parent.postMessage(
        {
          type: "updatePreviewBgUrl",
          url: url,
        },
        "*",
      );
    }
  };
  await shaderDataPromise;
  runtime.addEventListener("beforeprojectstart", () =>
    OnBeforeProjectStart(runtime),
  );
});

let piggy;
let shape3D;
let model;
let background;
let background3d;
let camera;
let layout;
let layer;
let runtime;

// Camera state
let cameraMode = "2d";
let autoRotate = true;
let cameraAzimuth = 0; // Horizontal angle (around Z axis)
let cameraPolar = Math.PI / 4; // Vertical angle from Z axis (45 degrees)
let cameraDistance = 300;
let baseCameraDistance = 300;
let targetPosition = { x: 120, y: 120, z: 60 };
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartAzimuth = 0;
let dragStartPolar = 0;
let lastDragTime = 0;
let resumeRotationTimeout = null;

// 2D camera state
let scrollX = 120;
let scrollY = 120;
let zoomLevel = 1;
let dragStartScrollX = 0;
let dragStartScrollY = 0;

// Scale state
// One scale for whichever object is showing, per axis. The command still
// accepts a plain number for the uniform case, because an older host sends one.
let objectScale = { x: 1, y: 1, z: 1 };
let roomScale = 1;
let baseObjectSize = { sprite: { w: 80, h: 130 }, shape: 100 };

// Canvas size state. The project ships a 240x240 viewport and everything in the
// layout is placed for it; changing it re-derives all of these. See
// applyCanvasSize.
const DESIGN_CANVAS_SIZE = 240;
let canvasSize = { w: DESIGN_CANVAS_SIZE, h: DESIGN_CANVAS_SIZE };
let baseBackground3dSize = DESIGN_CANVAS_SIZE;
let baseBackgroundSize = { w: DESIGN_CANVAS_SIZE, h: DESIGN_CANVAS_SIZE };

// Set once, in the C3.Runtime._LoadDataJson override at the bottom of this file.
let internalRuntime = null;

// Opacity state
let bgOpacity = 0.15;
let bg3dOpacity = 0.15;

// Rendering state
let anisotropicFiltering = "auto";

// Object appearance state
let objectColor = "#ffffff";
// Percent of the room size, from its centre. The room is the background cube,
// which is a cube, so one size covers all three axes and +-50% is a wall.
let objectOffset = { x: 0, y: 0, z: 0 };
// Degrees per axis. Like the scale, the command still accepts a plain number -
// that is a pre-3D host sending the Z angle on its own.
let objectAngle = { x: 0, y: 0, z: 0 };

// Promise that waits for shader data from parent window
function waitForShaderData() {
  return new Promise((resolve) => {
    const messageHandler = (event) => {
      if (event.data && event.data.type === "shaderData") {
        // Store the shader data
        self["C3_Shaders"] = self["C3_Shaders"] || {};
        self["C3_Shaders"]["skymen_Placeholdereffect"] = event.data.shaderData;
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

async function OnBeforeProjectStart(rt) {
  runtime = rt;

  // Capture shader errors and warnings
  setupShaderErrorCapture();

  piggy = runtime.objects.Piggy.getFirstInstance();
  shape3D = runtime.objects.shape3d.getFirstInstance();
  model = runtime.objects.model?.getFirstInstance();
  background = runtime.objects.background.getFirstInstance();
  background3d = runtime.objects.background3d.getFirstInstance();
  camera = runtime.objects.camera;
  layout = runtime.layout;
  layer = piggy.layer;

  warnIfNotRotatable3D();

  // Setup camera controls
  setupCameraControls();

  // Start camera update loop
  runtime.addEventListener("tick", updateCamera);

  if (window !== window.parent) {
    // Signal that project is ready for parameter updates. The command list
    // lets the host notice it is talking to a stale cached preview.
    window.parent.postMessage(
      { type: "projectReady", commands: Object.keys(PREVIEW_COMMANDS) },
      "*",
    );

    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "updateParam") {
        updateParam(runtime, event.data.index, event.data.value);
      } else if (event.data && event.data.type === "previewCommand") {
        handlePreviewCommand(event.data.command, event.data.value);
      } else if (event.data && event.data.type === "callFunction") {
        // Call global function with the provided URL
        if (typeof globalThis[event.data.function] === "function") {
          globalThis[event.data.function](event.data.url);
        }
      } else if (event.data && event.data.type === "requestScreenshot") {
        // Capture canvas and send back as base64 data URL
        runtime.saveCanvasImage().then((blob) => {
          // Convert blob to base64 data URL
          const reader = new FileReader();
          reader.onloadend = () => {
            window.parent.postMessage(
              {
                type: "screenshotData",
                dataUrl: reader.result, // This is a base64 data URL
              },
              "*",
            );
          };
          reader.readAsDataURL(blob);
        });
      } else if (event.data && event.data.type === "runStartupScript") {
        // Execute user-provided startup script
        runStartupScript(event.data.script);
      }
    });
  }
}

function runStartupScript(script) {
  if (!script) return;

  try {
    // Create a function with access to runtime objects
    const scriptFn = new Function(
      "runtime",
      "sprite",
      "shape3D",
      "background",
      "background3d",
      "camera",
      "layout",
      "layer",
      script,
    );

    // Execute the script with runtime context
    scriptFn(
      runtime,
      piggy,
      shape3D,
      background,
      background3d,
      camera,
      layout,
      layer,
    );

    sendConsoleLogToParent("Startup script executed successfully", "log");
  } catch (error) {
    sendErrorToParent(`Startup script error: ${error.message}`, "error");
    console.error("Startup script error:", error);
  }
}

function updateParam(runtime, index, value) {
  piggy.effects[0].setParameter(index, value);
  shape3D.effects[0].setParameter(index, value);
  if (model?.effects[0]) model.effects[0].setParameter(index, value);
  layout.effects[0].setParameter(index, value);
  layer.effects[0].setParameter(index, value);
}

function setEffectTarget(target) {
  piggy.effects[0].isActive = false;
  shape3D.effects[0].isActive = false;
  if (model?.effects[0]) model.effects[0].isActive = false;
  layout.effects[0].isActive = false;
  layer.effects[0].isActive = false;

  switch (target) {
    case "sprite":
      piggy.effects[0].isActive = true;
      break;
    case "shape3D":
      // "shape3D" means "the 3D object", and setObject shows exactly one of the
      // built-in shape and the imported model, so both get switched on.
      shape3D.effects[0].isActive = true;
      if (model?.effects[0]) model.effects[0].isActive = true;
      break;
    case "layout":
      layout.effects[0].isActive = true;
      break;
    case "layer":
      layer.effects[0].isActive = true;
      break;
  }
}

// Imported 3D models, as opposed to the 3D Shape plugin's built-in solids. The
// names are the ones the models were imported under; preview-settings.js lists
// the same set in the `object` enum and tests/31 asserts the two agree.
const MODEL_OBJECTS = new Set([
  "sphere",
  "torus",
  "cylinder",
  "cone",
  "capsule",
  "torus-knot",
  "suzanne",
  "teapot",
]);

function setObject(object) {
  // "sprite", one of the 3D Shape solids, or one of MODEL_OBJECTS
  piggy.isVisible = false;
  shape3D.isVisible = false;
  if (model) model.isVisible = false;

  if (object === "sprite") {
    piggy.isVisible = true;
    targetPosition.z = 0;
    return;
  }

  targetPosition.z = 60;

  if (MODEL_OBJECTS.has(object)) {
    if (!model) {
      sendErrorToParent(
        `The preview has no 3D model object, so "${object}" cannot be shown. ` +
          `Reload the page to pick up the current preview.`,
        "warning",
      );
      return;
    }
    model.isVisible = true;
    if (model.modelName !== object) model.loadModel(object);
    // loadModel rebuilds the mesh, which drops whatever texture was on the old
    // one, so put it back.
    applyModelTexture(modelTextureUrl);
    return;
  }

  shape3D.isVisible = true;
  shape3D.shape = object;
}

// The model's texture, kept so switching model can restore it.
let modelTextureUrl = null;

// Replaces the grid texture the models are imported with. Only works because
// they *are* imported with one: C3 fixes at import time whether a mesh samples a
// texture at all (AnimatedMesh.DrawMesh gates on the baked content type), so a
// material-free model would ignore this and report success anyway.
function applyModelTexture(url) {
  modelTextureUrl = url || modelTextureUrl;
  if (!model || !modelTextureUrl) return;

  // Per-mesh, and these models are single-mesh by construction - see
  // preview-src/models/README.md.
  for (const mesh of model.getAllMeshes()) {
    model
      .loadTextureFromURL(modelTextureUrl, mesh, "instance")
      .then((ok) => {
        // Resolves false rather than rejecting when the mesh refuses it.
        if (!ok) {
          sendErrorToParent(
            `The 3D model would not take the texture on mesh "${mesh}".`,
            "warning",
          );
        }
      })
      .catch((error) =>
        sendErrorToParent(
          `3D model texture failed: ${error && error.message ? error.message : error}`,
          "warning",
        ),
      );
  }
}

function setCameraMode(mode) {
  cameraMode = mode;
  const cam = camera;

  //   background.isVisible = mode === "2d";
  //   background3d.isVisible = mode !== "2d";
  background.isVisible = false;
  background3d.isVisible = true;

  if (mode === "2d") {
    // Reset to 2D mode
    cam.restore2DCamera();
    layout.projection = "perspective";
    scrollX = canvasSize.w / 2;
    scrollY = canvasSize.h / 2;
    zoomLevel = 1;
    layout.scrollTo(scrollX, scrollY);
    layout.scale = zoomLevel;
    runtime.mouse.setCursorStyle("grab");
  } else if (mode === "perspective") {
    layout.projection = "perspective";
    cam.fieldOfView = 45;
    runtime.mouse.setCursorStyle("grab");
  } else if (mode === "orthographic") {
    layout.projection = "orthographic";
    cam.orthographicScale = 1;
    runtime.mouse.setCursorStyle("grab");
  }
}

function setAutoRotate(enabled) {
  autoRotate = enabled;

  if (enabled && !isDragging && cameraMode !== "2d") {
    // Clear any pending timeout
    if (resumeRotationTimeout) {
      clearTimeout(resumeRotationTimeout);
      resumeRotationTimeout = null;
    }
  }
}

function setShowBackgroundCube(visible) {
  if (background3d) {
    background3d.isVisible = visible;
  }
}

function setObjectScale(scale) {
  if (typeof scale === "number") {
    objectScale = { x: scale, y: scale, z: scale };
  } else {
    // An axis the sender left out falls back to X - a pre-merge host sends
    // {x, y} with no depth.
    const axis = (value, fallback) =>
      Number.isFinite(Number(value)) ? Number(value) : fallback;
    const x = axis(scale.x, 1);
    objectScale = { x, y: axis(scale.y, x), z: axis(scale.z, x) };
  }
  applyObjectScale();
}

function applyObjectScale() {
  // Both objects get it; setObject only ever shows one of them at a time. The
  // sprite has no depth, so Z simply does not reach it.
  if (piggy) {
    piggy.width = baseObjectSize.sprite.w * objectScale.x;
    piggy.height = baseObjectSize.sprite.h * objectScale.y;
  }
  // The 3D shape and the imported model are both sized off the same base, so a
  // model reads at the same size as a box at the same scale. The model's
  // axis-scale-mode is "fit", so its own proportions are preserved inside this.
  for (const instance of [shape3D, model]) {
    if (!instance) continue;
    instance.width = baseObjectSize.shape * objectScale.x;
    instance.height = baseObjectSize.shape * objectScale.y;
    instance.depth = baseObjectSize.shape * objectScale.z;
  }
}

function setBgOpacity(opacity) {
  bgOpacity = opacity;
  if (background) {
    background.opacity = opacity;
  }
}

function setBg3dOpacity(opacity) {
  bg3dOpacity = opacity;
  if (background3d) {
    background3d.opacity = opacity;
  }
}

function hexToRgb01(hex) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(String(hex ?? ""));
  const packed = match ? parseInt(match[1], 16) : 0xffffff;
  return [
    ((packed >> 16) & 255) / 255,
    ((packed >> 8) & 255) / 255,
    (packed & 255) / 255,
  ];
}

// The three instances the previewer transforms. Only one is ever visible, but
// they are all kept in step so switching object never shows a stale pose.
function previewObjects() {
  return [piggy, shape3D, model].filter(Boolean);
}

function setObjectColor(hex) {
  objectColor = hex;
  applyObjectColor();
}

function applyObjectColor() {
  // C3 multiplies this into the object's vertex colour before the effect
  // runs, so samplerFront sees the tinted pixels - which is the point.
  const rgb = hexToRgb01(objectColor);
  for (const instance of previewObjects()) instance.colorRgb = rgb;
}

function setObjectOffset(offset) {
  const axis = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  objectOffset = {
    x: axis(offset && offset.x),
    y: axis(offset && offset.y),
    z: axis(offset && offset.z),
  };
  applyObjectPosition();
}

// Where the object sits: the room's centre, shifted by the offset. Called from
// anywhere that changes the centre or the room size - the canvas size and the
// room scale both move it.
function applyObjectPosition() {
  const room = baseBackground3dSize * roomScale;
  const x = canvasSize.w / 2 + (objectOffset.x / 100) * room;
  const y = canvasSize.h / 2 + (objectOffset.y / 100) * room;
  const z = (objectOffset.z / 100) * room;

  for (const instance of previewObjects()) {
    instance.x = x;
    instance.y = y;
    instance.z = z;
  }
}

function setObjectAngle(angle) {
  if (typeof angle === "number") {
    // A host from before the X/Y axes existed sends the Z angle bare.
    objectAngle = { x: 0, y: 0, z: angle };
  } else {
    const axis = (value) =>
      Number.isFinite(Number(value)) ? Number(value) : 0;
    objectAngle = { x: axis(angle.x), y: axis(angle.y), z: axis(angle.z) };
  }
  applyObjectAngle();
}

function applyObjectAngle() {
  const toRad = (degrees) => degrees * (Math.PI / 180);

  for (const instance of previewObjects()) {
    // All three axes go through the euler, and the legacy 2D angle is pinned at
    // zero. Setting both would compose them - C3 applies `angle` about Z first
    // and *then* the 3D quaternion - which is not something anyone could
    // predict from three sliders.
    instance.angleDegrees = 0;
    instance.setRotationEuler(
      toRad(objectAngle.x),
      toRad(objectAngle.y),
      toRad(objectAngle.z),
    );
  }
}

// setRotationEuler is not gated by the plugin's isRotatable3d flag the way
// setQuaternion is, so on a plugin that does not support 3D rotation it moves
// the bounding box and nothing else - a silent half-failure. Say so once.
function warnIfNotRotatable3D() {
  const unsupported = [
    ["Sprite", piggy],
    ["3D shape", shape3D],
  ].filter(([, instance]) => {
    if (!instance) return false;
    return instance.objectType?.plugin?.isRotatable3d === false;
  });

  if (!unsupported.length) return;
  sendErrorToParent(
    `${unsupported.map(([name]) => name).join(" and ")} cannot be rotated in 3D ` +
      `on this Construct runtime - the X and Y rotation sliders will do nothing.`,
    "warning",
  );
}

function setAnisotropicFiltering(mode) {
  anisotropicFiltering = mode;
  applyAnisotropicFiltering();
}

function applyAnisotropicFiltering() {
  if (!runtime) return;

  // The runtime re-parameterises every texture it already holds, so this takes
  // effect without a reload. It throws on a mode string it does not know -
  // report that rather than taking the preview down with it.
  try {
    runtime.anisotropicFiltering = anisotropicFiltering;
  } catch (error) {
    sendErrorToParent(`Anisotropic filtering: ${error.message}`, "warning");
  }
}

function setZoomLevel(level) {
  if (cameraMode === "2d") {
    zoomLevel = level;
    layout.scale = zoomLevel;
  }
}

function setRoomScale(scale) {
  roomScale = scale;
  applyRoomScale();
}

function applyRoomScale() {
  // Scale background 3D cube
  if (background3d) {
    background3d.width = -1 * baseBackground3dSize * roomScale;
    background3d.height = baseBackground3dSize * roomScale;
    background3d.depth = baseBackground3dSize * roomScale;
  }

  // Scale 2D background (tiled)
  if (background) {
    background.width = baseBackgroundSize.w * roomScale;
    background.height = baseBackgroundSize.h * roomScale;
  }

  // Update camera distance for 3D modes
  cameraDistance = baseCameraDistance * roomScale;

  // The offset is a percentage of the room, so a bigger room moves the object.
  applyObjectPosition();
}

function setCanvasSize(size) {
  const axis = (value, fallback) =>
    Number.isFinite(Number(value)) && Number(value) > 0
      ? Math.round(Number(value))
      : fallback;

  canvasSize = {
    w: axis(size && size.w, DESIGN_CANVAS_SIZE),
    h: axis(size && size.h, DESIGN_CANVAS_SIZE),
  };
  applyCanvasSize();
}

function applyCanvasSize() {
  if (!internalRuntime) return;

  const { w, h } = canvasSize;

  // Construct's own "Set canvas size" action, called with the runtime it wants
  // on `this`. Its body touches nothing else, so this stays faithful even if
  // Construct changes what the action does. Under this project's scale-outer
  // fullscreen mode that means the *design viewport* changes, not the number of
  // device pixels: the object covers a different fraction of the canvas, so the
  // effect really does run over more or fewer pixels.
  const setCanvasSizeAct = self.C3?.Plugins?.System?.Acts?.SetCanvasSize;
  if (typeof setCanvasSizeAct === "function") {
    setCanvasSizeAct.call({ _runtime: internalRuntime }, w, h);
  } else {
    sendErrorToParent(
      "Construct's Set canvas size action is missing from this runtime - " +
        "the preview resolution control cannot work.",
      "warning",
    );
    return;
  }

  // Everything in the layout was placed for a 240x240 viewport, so the scene has
  // to follow the viewport or the object drifts off-centre and the room stops
  // enclosing the view. The object's own size is deliberately left alone - that
  // it covers fewer pixels at a larger viewport is the point of the control.
  const centreX = w / 2;
  const centreY = h / 2;

  if (background3d) {
    background3d.x = centreX;
    background3d.y = centreY;
  }
  if (background) {
    background.x = 0;
    background.y = 0;
  }

  baseBackgroundSize = { w, h };
  baseBackground3dSize = Math.max(w, h);
  // Keep the 3D framing: the camera sits back in proportion to the room.
  baseCameraDistance = 300 * (Math.max(w, h) / DESIGN_CANVAS_SIZE);
  targetPosition.x = centreX;
  targetPosition.y = centreY;
  scrollX = centreX;
  scrollY = centreY;

  // Re-places the object too, via applyObjectPosition.
  applyRoomScale();
  if (layout && cameraMode === "2d") layout.scrollTo(scrollX, scrollY);
}

// Every command the host can send, in one table so the list can be handed to
// the host on startup. That is what lets the host tell a stale cached preview
// from a current one instead of quietly dropping commands it does not know.
const PREVIEW_COMMANDS = {
  setEffectTarget,
  setObject,
  setCameraMode,
  setAutoRotate,
  setShowBackgroundCube,
  setObjectColor,
  setObjectAngle,
  setObjectOffset,
  setObjectScale,
  setRoomScale,
  setBgOpacity,
  setBg3dOpacity,
  setZoomLevel,
  setAnisotropicFiltering,
  setCanvasSize,

  // Pre-merge names for the scale. Kept so a host page that has not been
  // reloaded since the sprite and shape scales were merged still works.
  setSpriteScale: setObjectScale,
  setShapeScale: setObjectScale,
};

function handlePreviewCommand(command, value) {
  const handler = PREVIEW_COMMANDS[command];
  // An unknown command means the host is newer than this preview. Dropping it
  // is the only safe thing to do here; the host spots the mismatch from the
  // command list sent with projectReady and tells the user to reload.
  if (handler) handler(value);
}

function setupCameraControls() {
  runtime.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    if (cameraMode === "2d") {
      // Store current scroll position for 2D dragging
      dragStartScrollX = scrollX;
      dragStartScrollY = scrollY;
    } else {
      // Store camera spherical coordinates for 3D dragging
      dragStartAzimuth = cameraAzimuth;
      dragStartPolar = cameraPolar;
      lastDragTime = Date.now();

      // Stop auto rotation
      if (resumeRotationTimeout) {
        clearTimeout(resumeRotationTimeout);
        resumeRotationTimeout = null;
      }
    }

    runtime.mouse.setCursorStyle("grabbing");
  });

  runtime.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    if (cameraMode === "2d") {
      // Pan the 2D view
      scrollX = dragStartScrollX - deltaX / zoomLevel;
      scrollY = dragStartScrollY - deltaY / zoomLevel;
      layout.scrollTo(scrollX, scrollY);
    } else {
      // Update spherical coordinates based on drag
      // Horizontal drag controls azimuth (rotation around Z axis)
      cameraAzimuth = dragStartAzimuth + deltaX * 0.005;

      // Vertical drag controls polar angle (elevation)
      // Clamp polar angle to prevent flipping (0.1 to PI - 0.1)
      cameraPolar = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, dragStartPolar - deltaY * 0.005),
      );

      lastDragTime = Date.now();
    }
  });

  runtime.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    runtime.mouse.setCursorStyle("grab");

    // If auto rotate is enabled, wait a bit then resume rotation
    if (autoRotate && cameraMode !== "2d") {
      resumeRotationTimeout = setTimeout(() => {
        resumeRotationTimeout = null;
      }, 1000);
    }
  });

  runtime.addEventListener("mouseleave", () => {
    if (isDragging) {
      isDragging = false;
      runtime.mouse.setCursorStyle("default");
    }
  });

  // Mouse wheel zoom for both 2D and 3D
  runtime.addEventListener("wheel", (e) => {
    e.preventDefault();

    if (cameraMode === "2d") {
      // Zoom 2D view
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomLevel = Math.max(0.1, Math.min(5, zoomLevel * zoomFactor));
      layout.scale = zoomLevel;

      // Report zoom change to parent
      if (window !== window.parent) {
        window.parent.postMessage(
          {
            type: "zoomLevelChanged",
            zoomLevel: zoomLevel,
          },
          "*",
        );
      }
    } else {
      // Zoom 3D camera by adjusting distance from target
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      cameraDistance = Math.max(50, Math.min(800, cameraDistance * zoomFactor));
    }
  });

  // Set initial cursor
  runtime.mouse.setCursorStyle("grab");
}

function updateCamera() {
  if (cameraMode === "2d") return;

  const cam = camera;

  // Auto rotate if enabled and not dragging
  if (autoRotate && !isDragging && resumeRotationTimeout === null) {
    cameraAzimuth -= runtime.dt * 0.5; // Slow rotation around Z axis
  }

  // Convert spherical coordinates to Cartesian coordinates
  // Spherical to Cartesian:
  // x = r * sin(polar) * cos(azimuth)
  // y = r * sin(polar) * sin(azimuth)
  // z = r * cos(polar)
  const sinPolar = Math.sin(cameraPolar);
  const cosPolar = Math.cos(cameraPolar);

  let x =
    targetPosition.x + cameraDistance * sinPolar * Math.cos(cameraAzimuth);
  let y =
    targetPosition.y + cameraDistance * sinPolar * Math.sin(cameraAzimuth);
  let z = targetPosition.z + cameraDistance * cosPolar;

  // Smoothly interpolate camera position
  const camPos = cam.getCameraPosition();
  const lerpFactor = 1 - Math.pow(0.001, runtime.dt);
  x = camPos[0] + (x - camPos[0]) * lerpFactor;
  y = camPos[1] + (y - camPos[1]) * lerpFactor;
  z = camPos[2] + (z - camPos[2]) * lerpFactor;

  // Look at the target position
  cam.lookAtPosition(
    x,
    y,
    z,
    targetPosition.x,
    targetPosition.y,
    targetPosition.z,
    0,
    0,
    1,
  );
}

function setupShaderErrorCapture() {
  // Capture all console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalInfo = console.info;

  console.error = function (...args) {
    originalError.apply(console, args);
    const message = args.join(" ");
    sendErrorToParent(message, "error");
    sendConsoleLogToParent(message, "error");
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);
    const message = args.join(" ");
    sendErrorToParent(message, "warning");
    sendConsoleLogToParent(message, "warning");
  };

  console.log = function (...args) {
    originalLog.apply(console, args);
    const message = args.join(" ");
    sendConsoleLogToParent(message, "log");
  };

  console.info = function (...args) {
    originalInfo.apply(console, args);
    const message = args.join(" ");
    sendConsoleLogToParent(message, "info");
  };

  // Capture WebGL errors
  if (window.WebGLRenderingContext) {
    const originalGetShaderInfoLog =
      WebGLRenderingContext.prototype.getShaderInfoLog;
    WebGLRenderingContext.prototype.getShaderInfoLog = function (shader) {
      const log = originalGetShaderInfoLog.call(this, shader);
      if (log && log.trim()) {
        const severity = log.toLowerCase().includes("error")
          ? "error"
          : "warning";
        sendErrorToParent(`WebGL Shader: ${log}`, severity);
      }
      return log;
    };

    const originalGetProgramInfoLog =
      WebGLRenderingContext.prototype.getProgramInfoLog;
    WebGLRenderingContext.prototype.getProgramInfoLog = function (program) {
      const log = originalGetProgramInfoLog.call(this, program);
      if (log && log.trim()) {
        const severity = log.toLowerCase().includes("error")
          ? "error"
          : "warning";
        sendErrorToParent(`WebGL Program: ${log}`, severity);
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
      if (log && log.trim()) {
        const severity = log.toLowerCase().includes("error")
          ? "error"
          : "warning";
        sendErrorToParent(`WebGL2 Shader: ${log}`, severity);
      }
      return log;
    };

    const originalGetProgramInfoLog =
      WebGL2RenderingContext.prototype.getProgramInfoLog;
    WebGL2RenderingContext.prototype.getProgramInfoLog = function (program) {
      const log = originalGetProgramInfoLog.call(this, program);
      if (log && log.trim()) {
        const severity = log.toLowerCase().includes("error")
          ? "error"
          : "warning";
        sendErrorToParent(`WebGL2 Program: ${log}`, severity);
      }
      return log;
    };
  }
}

// Force every non-tiled image to behave as a frame that was packed *rotated*
// into a spritesheet.
//
// C3 packs a frame sideways when that saves atlas space, and the only trace of
// it in the shader is indirect: srcOrigin becomes the frame's *transposed* box
// and the quad's texture coords are rotated to compensate. Nothing tells the
// fragment shader which way round it is, so anything that maps texture UV onto
// layout/object space (getLayoutPos, fromLayoutPos, ...) comes out rotated 90
// degrees and stretched by the frame's aspect ratio. There is no way to author
// against that case without being able to reproduce it, hence this toggle.
//
// This is a faithful reproduction, not a fake: the frame is genuinely re-encoded
// sideways into its own texture and the ImageInfo is put into exactly the state
// C3's own loader produces for a rotated frame. So `IsCurrentTexRotated()` is
// true, WebGL takes its forced pre-draw path, and WebGPU sets isSrcTexRotated -
// all the real behaviour follows.
{
  const forceRotatedTexture =
    new URLSearchParams(self.location.search).get("forceRotatedTexture") ===
    "1";

  if (forceRotatedTexture) {
    const ImageInfo = self.C3.ImageInfo;
    const origLoadStaticTexture = ImageInfo.prototype.LoadStaticTexture;
    const origGetTexture = ImageInfo.prototype.GetTexture;
    const origReleaseTexture = ImageInfo.prototype.ReleaseTexture;
    const origReplaceWith = ImageInfo.prototype.ReplaceWith;

    // Re-encode the frame sideways and adopt C3's rotated-frame state for it.
    // The maths mirrors ImageInfo.ExtractImageToCanvas, which un-rotates a real
    // rotated frame - this is that transform run backwards, so a round trip
    // through both is the identity.
    async function packRotated(info, renderer, opts) {
      const w = info.GetWidth();
      const h = info.GetHeight();
      if (!(w > 0) || !(h > 0)) return;

      const upright = await info.ExtractImageToCanvas();
      const canvas = self.C3.CreateCanvas(h, w);
      const ctx = canvas.getContext("2d");
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(upright, 0, 0);

      const texture = await renderer.CreateStaticTextureAsync(
        canvas,
        Object.assign({}, opts),
      );

      info._forcedRotatedTexture = texture;
      info._isRotated = true;
      info._offsetX = 0;
      info._offsetY = 0;
      // C3's own formula, for a sheet that is exactly this one frame: the box
      // is transposed (h x w), then normalised against the sheet size.
      info._rcTex.set(0, 0, 1, 1);
      info._quadTex.setFromRect(info._rcTex);
      info._quadTex.rotatePointsAnticlockwise();
    }

    ImageInfo.prototype.LoadStaticTexture = async function (renderer, opts) {
      const texture = await origLoadStaticTexture.call(this, renderer, opts);
      if (!texture) return texture;

      // A tiled background derives its own texture rect and ignores the frame
      // quad entirely, so rotating it would just shift the backdrop for no
      // reason. IsTiled() only covers dynamically loaded ones; a wrap mode
      // other than clamp-to-edge is what identifies the rest.
      const wraps = [opts?.wrapX, opts?.wrapY].filter(Boolean);
      const isTiled =
        (this._imageAsset && this._imageAsset.IsTiled()) ||
        wraps.some((wrap) => wrap !== "clamp-to-edge");
      if (isTiled) return texture;

      try {
        await packRotated(this, renderer, opts);
      } catch (e) {
        sendErrorToParent(
          `Force-rotated texture failed: ${e && e.message ? e.message : e}`,
          "error",
        );
      }
      return texture;
    };

    ImageInfo.prototype.GetTexture = function () {
      return this._forcedRotatedTexture || origGetTexture.call(this);
    };

    ImageInfo.prototype.ReleaseTexture = function () {
      const texture = this._forcedRotatedTexture;
      if (texture) {
        this._forcedRotatedTexture = null;
        texture.GetRenderer().DeleteTexture(texture);
      }
      return origReleaseTexture.call(this);
    };

    // "Load image from URL" builds a fresh ImageInfo and folds it into the
    // frame's one. Hand the rotated texture over with it, or the frame keeps
    // rotated coords while sampling the upright texture.
    ImageInfo.prototype.ReplaceWith = function (other) {
      const result = origReplaceWith.call(this, other);
      this._forcedRotatedTexture = other._forcedRotatedTexture || null;
      other._forcedRotatedTexture = null;
      return result;
    };
  }
}

{
  self.C3.WorldInfo = class extends self.C3.WorldInfo {
    Init(t) {
      t[13] = [
        [
          true,
          ...self["C3_Shaders"]["skymen_Placeholdereffect"].parameters.map(
            (p) => {
              return p[2] === "color" ? [1, 1, 1] : 1;
            },
          ),
        ],
      ];
      super.Init(t);
    }
  };
  self.C3.EffectList = class extends self.C3.EffectList {
    constructor(e, t) {
      if (t.length === 1) {
        while (t[0].length < 3) {
          t[0].push([]);
        }
        t[0][2] = [
          true,
          ...self["C3_Shaders"]["skymen_Placeholdereffect"].parameters.map(
            (p) => {
              return p[2] === "color" ? [1, 1, 1] : 1;
            },
          ),
        ];
      }
      super(e, t);
    }
  };
  // The project array is positional and undocumented, and the indices move
  // between Construct releases - C3.WorldInfo's already went from t[12] to
  // t[13] once, silently. Check each slot still holds the type we expect before
  // overwriting it, so the next re-export announces the shift instead of
  // quietly corrupting the setting.
  function checkProjectIndex(t, index, type, what) {
    if (typeof t[index] === type) return true;
    sendErrorToParent(
      `Preview project index t[${index}] should be the ${what} (${type}) but is ` +
        `${typeof t[index]}. Construct's project format has shifted - the ` +
        `_LoadDataJson override in preview-src/scripts/main.js needs updating.`,
      "warning",
    );
    return false;
  }

  self.C3.Runtime = class extends self.C3.Runtime {
    async _LoadDataJson(e) {
      const t = e["project"];

      // The only place the export hands us a C3.Runtime. The scripting API
      // deliberately keeps it private - IRuntime's viewport getters are frozen
      // read-only snapshots and nothing exposes a setter - so setCanvasSize
      // needs this reference. See applyCanvasSize.
      internalRuntime = this;

      const shader = self["C3_Shaders"]["skymen_Placeholdereffect"];

      checkProjectIndex(t, 13, "boolean", "WebGPU flag");
      checkProjectIndex(t, 14, "string", "sampling mode");
      checkProjectIndex(t, 15, "boolean", "blendsBackground flag");
      checkProjectIndex(t, 17, "boolean", "usesDepth flag");
      checkProjectIndex(t, 42, "boolean", "crossSampling flag");
      checkProjectIndex(t, 48, "boolean", "minimum-capabilities flag");

      // Get settings from query params
      const urlParams = new URLSearchParams(window.location.search);
      const samplingMode = urlParams.get("samplingMode") || "trilinear";
      const shaderLanguage = urlParams.get("shaderLanguage") || "webgpu";

      // Set shader language (t[13] is the shader language property)
      t[13] = shaderLanguage === "webgpu";

      t[48] = shaderLanguage === "webgl1";

      // Set sampling mode (t[14] is the sampling mode property)
      t[14] = samplingMode;

      t[15] = t[15] || shader.blendsBackground;

      t[42] = t[42] || shader.crossSampling;

      t[17] = t[17] || shader.usesDepth;

      await super._LoadDataJson(e);
    }
  };
}
