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
      "*"
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
      "*"
    );
  }
}

// Set up WebGPU error capturing IMMEDIATELY before any WebGPU code runs
// This must happen before Construct 3 initializes its renderer
function setupWebGPUErrorCapture() {
  if (!navigator.gpu) return;

  // Hook into GPUDevice creation to capture uncaptured errors
  const originalRequestAdapter = navigator.gpu.requestAdapter.bind(
    navigator.gpu
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
                      severity
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
    // After loading, update the base size based on the new sprite dimensions
    setTimeout(() => {
      if (piggy) {
        // Store new base size (accounting for current scale)
        baseObjectSize.sprite.w = piggy.width;
        baseObjectSize.sprite.h = piggy.height;
        applySpriteScale();

        // Report size change to parent
        if (window !== window.parent) {
          window.parent.postMessage(
            {
              type: "spriteSizeChanged",
              width: baseObjectSize.sprite.w,
              height: baseObjectSize.sprite.h,
            },
            "*"
          );
        }
      }
    }, 10);
  };
  globalThis.loadShapeUrl = (url) => {
    runtime.callFunction("loadShapeUrl", url, false);
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
        "*"
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
        "*"
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
        "*"
      );
    }
  };
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
let spriteScale = 1;
let shapeScale = 1;
let roomScale = 1;
let baseObjectSize = { sprite: { w: 80, h: 130 }, shape: 100 };
let baseBackground3dSize = 240;
let baseBackgroundSize = 240;

// Opacity state
let bgOpacity = 0.15;
let bg3dOpacity = 0.15;

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
  background = runtime.objects.background.getFirstInstance();
  background3d = runtime.objects.background3d.getFirstInstance();
  camera = runtime.objects.camera;
  layout = runtime.layout;
  layer = piggy.layer;

  // Setup camera controls
  setupCameraControls();

  // Start camera update loop
  runtime.addEventListener("tick", updateCamera);

  if (window !== window.parent) {
    // Signal that project is ready for parameter updates
    window.parent.postMessage({ type: "projectReady" }, "*");

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
              "*"
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
      script
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
      layer
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
  layout.effects[0].setParameter(index, value);
  layer.effects[0].setParameter(index, value);
}

function setEffectTarget(target) {
  piggy.effects[0].isActive = false;
  shape3D.effects[0].isActive = false;
  layout.effects[0].isActive = false;
  layer.effects[0].isActive = false;

  switch (target) {
    case "sprite":
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
    targetPosition.z = 0;
  } else {
    shape3D.isVisible = true;
    shape3D.shape = object;
    targetPosition.z = 60;
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
    scrollX = 120;
    scrollY = 120;
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

function setSpriteScale(scale) {
  spriteScale = scale;
  applySpriteScale();
}

function applySpriteScale() {
  if (piggy) {
    piggy.width = baseObjectSize.sprite.w * spriteScale;
    piggy.height = baseObjectSize.sprite.h * spriteScale;
  }
}

function setShapeScale(scale) {
  shapeScale = scale;
  applyShapeScale();
}

function applyShapeScale() {
  if (shape3D) {
    shape3D.width = baseObjectSize.shape * shapeScale;
    shape3D.height = baseObjectSize.shape * shapeScale;
    shape3D.zHeight = baseObjectSize.shape * shapeScale;
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
    background3d.zHeight = baseBackground3dSize * roomScale;
  }

  // Scale 2D background (tiled)
  if (background) {
    background.width = baseBackgroundSize * roomScale;
    background.height = baseBackgroundSize * roomScale;
  }

  // Update camera distance for 3D modes
  cameraDistance = baseCameraDistance * roomScale;
}

function handlePreviewCommand(command, value) {
  switch (command) {
    case "setEffectTarget":
      setEffectTarget(value);
      break;
    case "setObject":
      setObject(value);
      break;
    case "setCameraMode":
      setCameraMode(value);
      break;
    case "setAutoRotate":
      setAutoRotate(value);
      break;
    case "setShowBackgroundCube":
      setShowBackgroundCube(value);
      break;
    case "setSpriteScale":
      setSpriteScale(value);
      break;
    case "setShapeScale":
      setShapeScale(value);
      break;
    case "setRoomScale":
      setRoomScale(value);
      break;
    case "setBgOpacity":
      setBgOpacity(value);
      break;
    case "setBg3dOpacity":
      setBg3dOpacity(value);
      break;
    case "setZoomLevel":
      setZoomLevel(value);
      break;
  }
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
        Math.min(Math.PI - 0.1, dragStartPolar - deltaY * 0.005)
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
          "*"
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
    1
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
            }
          ),
        ];
      }
      super(e, t);
    }
  };
  self.C3.Runtime = class extends self.C3.Runtime {
    async _LoadDataJson(e) {
      const t = e["project"];

      // Get settings from query params
      const urlParams = new URLSearchParams(window.location.search);
      const samplingMode = urlParams.get("samplingMode") || "trilinear";
      const shaderLanguage = urlParams.get("shaderLanguage") || "webgpu";

      // Set shader language (t[13] is the shader language property)
      t[13] = shaderLanguage === "webgpu";

      t[48] = shaderLanguage === "webgl1";

      // Set sampling mode (t[14] is the sampling mode property)
      t[14] = samplingMode;

      t[15] =
        t[15] ||
        self["C3_Shaders"]["skymen_Placeholdereffect"].blendsBackground;

      t[42] =
        t[42] || self["C3_Shaders"]["skymen_Placeholdereffect"].crossSampling;

      t[17] = t[17] || self["C3_Shaders"]["skymen_Placeholdereffect"].usesDepth;

      await super._LoadDataJson(e);
    }
  };
}
