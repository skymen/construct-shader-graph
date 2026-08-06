// One declarative description of every preview setting.
//
// Before this existed, each setting had to be hand-written into six places that
// each independently knew its name, default, DOM control and wire command:
// the defaults in script.js, the defaults *again* in resetPreviewSettings(),
// the resend-everything projectReady handler, updatePreviewSettingsUI(),
// syncPreviewSettings()/the validators in GlobalConsoleApi.js, and the CLI flag
// tables. They drifted - the scripting API spent a while validating `object`
// against a list of shapes that do not exist. Now all six loop over this array.
//
// ORDER IS LOAD-BEARING. applyPreviewSettingsTo() walks it in order and must
// reproduce the sequence the old projectReady handler used: the scale commands
// come *after* the textures, because loading a sprite texture re-derives the
// sprite's base size and the scale has to be re-applied on top of it.
//
// The module is pure data - no DOM, no `window` at module scope. It is imported
// by script.js (browser), GlobalConsoleApi.js (both) and cli/commands/preview.js
// (plain Node), so DOM ids are stored as strings and never looked up here.

// The 3D models imported into the preview project, in `preview-src/models`.
// These are `object` values alongside the 3D Shape plugin's built-in solids;
// the preview decides which is which from the same list.
export const PREVIEW_MODELS = [
  "sphere",
  "torus",
  "cylinder",
  "cone",
  "capsule",
  "torus-knot",
  "suzanne",
  "teapot",
];

// --- cross-key coupling -----------------------------------------------------
//
// The only two settings that are not independent. Picking an effect target
// implies an object and vice versa; both the UI listeners and the scripting API
// have always done this, so it lives here once. Each returns the sibling keys it
// mutated, so the caller knows what else to resend.

export function linkEffectTarget(settings, target) {
  if (target === "sprite") {
    settings.object = "sprite";
  } else if (target === "shape3D" && settings.object === "sprite") {
    settings.object = "box";
  } else {
    return [];
  }
  return ["object"];
}

export function linkObject(settings, object) {
  const target = settings.effectTarget;
  if (
    object === "sprite" &&
    target !== "sprite" &&
    target !== "layout" &&
    target !== "layer"
  ) {
    settings.effectTarget = "sprite";
  } else if (object !== "sprite" && target === "sprite") {
    settings.effectTarget = "shape3D";
  } else {
    return [];
  }
  return ["effectTarget"];
}

// --- descriptors ------------------------------------------------------------
//
// key        previewSettings key, .c3sg key and preview.updateSettings patch key
// default    seeds makeDefaultPreviewSettings()
// kind       enum | bool | number | string | color | texture - drives coercion,
//            API validation and how the DOM control is read and written
// values     enum only: the allow-list, and the expected <option value> list
// min/max/step/precision
//            number only: mirror the <input type=range> attrs and the readout
// command    previewCommand name posted to the iframe; null means host-only
// reload     false, or true when the setting travels in the iframe URL instead
//            of a command, or "whenEmpty" when clearing it needs a reload
// queryParam URL param name when reload === true
// dom        { el, valueEl, previewEl, clearBtnEl } - id strings only
// label      i18n key, consumed by updateUIText()
// section    which panel section it renders into
// cli        { flag, arg, help } - flag is camelCase, matching cli/args.js
// link       optional cross-key coupling (above)
// onUi       optional (bp, value, settings) side-effect after the DOM is written
// apply      optional (bp, target, value, settings) override for the default
//            "post d.command" send
// applyGroup optional dedupe token, so keys that resolve into one command send
//            it once per batch

// Textures do not travel as a previewCommand; the preview exposes them as
// callable functions instead.
const applyTexture = (bp, target, value, _settings, d) => {
  if (value) bp.loadPreviewTexture(d.textureType, value, target);
};

// --- object scale ------------------------------------------------------------
//
// One scale for whichever object is showing - the sprite and the 3D shape are
// never visible at the same time, so two separate controls only ever meant
// "the one I am not looking at is wrong".
//
// `objectScale` MUST stay a plain number in previewSettings. Turning it into an
// {x, y, z} object would silently break every preview.updateSettings({objectScale: 1.5})
// caller - and the save-data fixed-point test would keep passing while it
// happened. The extra axes ride in their own keys instead, and the *effective*
// vector is computed at send time, never stored. That is also why the Y and Z
// defaults are 1 rather than null: nothing nullable reaches the validator.

// --- object rotation ---------------------------------------------------------
//
// Same shape as the scale, and for the same reason: `objectAngle` stays a plain
// number so every stored .c3sg and every preview.updateSettings({objectAngle: 90})
// caller keeps working. It is the Z axis - the only one that existed before the
// r497 runtime added 3D rotation to ordinary world instances - and X and Y ride
// in their own keys.

// --- canvas size -------------------------------------------------------------
//
// Does exactly what Construct's "System: Set canvas size" action does. The
// preview project runs `scale-outer`, where that action changes the *design
// viewport* rather than the number of device pixels: the canvas keeps filling
// the panel, and what moves is world-units-per-pixel. So a larger number means
// the object covers a smaller fraction of the canvas and the effect runs over
// fewer pixels - which is the effective-resolution knob a shader author wants,
// and matches what they would get shipping into a game with that window size.

export function effectiveCanvasSize(s) {
  return { w: s.canvasWidth, h: s.canvasHeight };
}

const applyCanvasSize = (bp, target, _value, settings) =>
  target.send("setCanvasSize", effectiveCanvasSize(settings));

// --- object offset -----------------------------------------------------------
//
// A percentage of the room size, measured from its centre, rather than world
// units - so an offset keeps meaning the same thing when the canvas size or the
// room scale changes. The room is the background cube, which is a cube, so one
// size covers all three axes and +-50% puts the object on a wall. Axes are
// Construct's: X right, Y down, Z towards the viewer.

export function effectiveObjectOffset(s) {
  return { x: s.objectOffsetX, y: s.objectOffsetY, z: s.objectOffsetZ };
}

const applyObjectOffset = (bp, target, _value, settings) =>
  target.send("setObjectOffset", effectiveObjectOffset(settings));

export function effectiveObjectAngle(s) {
  return { x: s.objectAngleX, y: s.objectAngleY, z: s.objectAngle };
}

const applyObjectAngle = (bp, target, _value, settings) =>
  target.send("setObjectAngle", effectiveObjectAngle(settings));

export function effectiveObjectScale(s) {
  return {
    x: s.objectScale,
    y: s.objectScaleLinked ? s.objectScale : s.objectScaleY,
    z: s.objectScaleLinked ? s.objectScale : s.objectScaleZ,
  };
}

const applyObjectScale = (bp, target, _value, settings) =>
  target.send("setObjectScale", effectiveObjectScale(settings));

// Reveal the per-axis rows only once the link is off, and the Z row only for a
// 3D shape - a sprite has no depth, and a slider that does nothing is worse
// than no slider. Driven from both the `object` and `objectScaleLinked` hooks,
// since either can change the answer.
function syncScaleAxisRows(settings) {
  const setDisplay = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.style.display = value;
  };
  const unlinked = !settings.objectScaleLinked;

  setDisplay("objectScaleXChip", unlinked ? "" : "none");
  setDisplay("objectScaleYRow", unlinked ? "flex" : "none");
  setDisplay(
    "objectScaleZRow",
    unlinked && settings.object !== "sprite" ? "flex" : "none",
  );
}

export const PREVIEW_SETTINGS = [
  {
    key: "effectTarget",
    default: "sprite",
    kind: "enum",
    values: ["sprite", "shape3D", "layout", "layer"],
    command: "setEffectTarget",
    dom: { el: "effectTargetSelect" },
    label: "Effect Target:",
    section: "object",
    link: linkEffectTarget,
    cli: { flag: "effectTarget", arg: "<t>", help: "sprite | layer | ..." },
  },
  {
    key: "object",
    default: "sprite",
    kind: "enum",
    // The sprite, then the 3D Shape plugin's built-in solids, then the imported
    // 3D models. The preview keeps the same model list in MODEL_OBJECTS, and
    // tests/31 asserts the two agree - a name only in one of them is a dropdown
    // entry that silently shows nothing.
    values: [
      "sprite",
      "box",
      "prism",
      "wedge",
      "pyramid",
      "corner-out",
      "corner-in",
      ...PREVIEW_MODELS,
    ],
    command: "setObject",
    dom: { el: "objectSelect" },
    label: "Object:",
    section: "object",
    link: linkObject,
    onUi: (bp, _object, settings) => syncScaleAxisRows(settings),
    cli: { flag: "object", arg: "<o>", help: "sprite | box | ..." },
  },
  {
    // Declared before the camera and the scales: it moves every instance in the
    // layout, so the scene geometry has to settle first.
    key: "canvasWidth",
    default: 240,
    kind: "number",
    min: 16,
    max: 4096,
    step: 1,
    precision: 0,
    command: "setCanvasSize",
    apply: applyCanvasSize,
    applyGroup: "canvasSize",
    dom: { el: "canvasWidthInput" },
    label: "Resolution:",
    section: "technical",
    cli: { flag: "canvasWidth", arg: "<n>", help: "Canvas width in pixels" },
  },
  {
    key: "canvasHeight",
    default: 240,
    kind: "number",
    min: 16,
    max: 4096,
    step: 1,
    precision: 0,
    command: "setCanvasSize",
    apply: applyCanvasSize,
    applyGroup: "canvasSize",
    dom: { el: "canvasHeightInput" },
    section: "technical",
    cli: { flag: "canvasHeight", arg: "<n>", help: "Canvas height in pixels" },
  },
  {
    key: "cameraMode",
    default: "2d",
    kind: "enum",
    values: ["2d", "perspective", "orthographic"],
    command: "setCameraMode",
    dom: { el: "cameraModeSelect" },
    label: "Camera:",
    section: "scene",
    // Auto rotate is meaningless in 2D, so the whole group hides with it.
    onUi: (bp, value) => {
      const group = document.getElementById("autoRotateGroup");
      if (group) group.style.display = value === "2d" ? "none" : "flex";
    },
    cli: {
      flag: "camera",
      arg: "<m>",
      help: "2d | perspective | orthographic",
    },
  },
  {
    key: "autoRotate",
    default: true,
    kind: "bool",
    command: "setAutoRotate",
    dom: { el: "autoRotateCheckbox" },
    label: "Auto Rotate",
    section: "scene",
    cli: { flag: "autoRotate", help: "Stop the auto rotation" },
  },
  {
    key: "showBackgroundCube",
    default: true,
    kind: "bool",
    command: "setShowBackgroundCube",
    dom: { el: "showBackgroundCubeCheckbox" },
    label: "Show 3D Background",
    section: "scene",
    cli: { flag: "backgroundCube", help: "Hide the background cube" },
  },
  {
    key: "bgOpacity",
    default: 0.15,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    command: "setBgOpacity",
    dom: { el: "bgOpacitySlider", valueEl: "bgOpacityValue" },
    label: "BG Opacity:",
    section: "scene",
    cli: { flag: "bgOpacity", arg: "<n>", help: "Background opacity" },
  },
  {
    key: "bg3dOpacity",
    default: 0.15,
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    command: "setBg3dOpacity",
    dom: { el: "bg3dOpacitySlider", valueEl: "bg3dOpacityValue" },
    label: "3D BG Opacity:",
    section: "scene",
    cli: { flag: "bg3dOpacity", arg: "<n>", help: "3D background opacity" },
  },
  {
    // No control of its own - the preview reports it back when you scroll.
    key: "zoomLevel",
    default: 1,
    kind: "number",
    command: "setZoomLevel",
    section: "scene",
    cli: { flag: "zoom", arg: "<n>", help: "Zoom level" },
  },

  // Textures load before the scales below, because loading a sprite texture
  // re-derives the sprite's base size in the preview.
  {
    key: "spriteTextureUrl",
    default: null,
    kind: "texture",
    textureType: "sprite",
    previewFunction: "loadSpriteUrl",
    reload: "whenEmpty",
    apply: applyTexture,
    dom: {
      previewEl: "spriteTexturePreview",
      clearBtnEl: "clearSpriteTextureBtn",
    },
    label: "Sprite Texture:",
    section: "textures",
    cli: { flag: "spriteTexture", arg: "<f>", help: "Sprite texture image" },
  },
  {
    key: "shapeTextureUrl",
    default: null,
    kind: "texture",
    textureType: "shape",
    previewFunction: "loadShapeUrl",
    reload: "whenEmpty",
    apply: applyTexture,
    dom: {
      previewEl: "shapeTexturePreview",
      clearBtnEl: "clearShapeTextureBtn",
    },
    label: "Shape Texture:",
    section: "textures",
    cli: { flag: "shapeTexture", arg: "<f>", help: "3D shape texture image" },
  },
  {
    // The 3D models ship with a grid texture baked in, which is also what makes
    // this control possible: C3 decides at import time whether a mesh samples a
    // texture at all, so a model with no material would ignore this silently.
    key: "modelTextureUrl",
    default: null,
    kind: "texture",
    textureType: "model",
    previewFunction: "loadModelUrl",
    reload: "whenEmpty",
    apply: applyTexture,
    dom: {
      previewEl: "modelTexturePreview",
      clearBtnEl: "clearModelTextureBtn",
    },
    label: "Model Texture:",
    section: "textures",
    cli: { flag: "modelTexture", arg: "<f>", help: "3D model texture image" },
  },
  {
    key: "bgTextureUrl",
    default: null,
    kind: "texture",
    textureType: "bg",
    previewFunction: "loadBgUrl",
    reload: "whenEmpty",
    apply: applyTexture,
    dom: { previewEl: "bgTexturePreview", clearBtnEl: "clearBgTextureBtn" },
    label: "Background Texture:",
    section: "textures",
    cli: { flag: "bgTexture", arg: "<f>", help: "Background texture image" },
  },

  {
    // Applies to whichever of the sprite / 3D shape is showing - setObject
    // makes exactly one of them visible, so one control is unambiguous.
    // Stored as #rrggbb the whole way through: JSON-clean, no float drift
    // through the .c3sg round-trip, and the same type as the colour input.
    key: "objectColor",
    default: "#ffffff",
    kind: "color",
    command: "setObjectColor",
    dom: { el: "objectColorInput" },
    label: "Color:",
    section: "object",
    cli: {
      flag: "objectColor",
      arg: "<hex>",
      help: "Object tint, e.g. #ff8800",
    },
  },
  {
    key: "objectAngleX",
    default: 0,
    kind: "number",
    min: 0,
    max: 360,
    step: 1,
    precision: 0,
    command: "setObjectAngle",
    apply: applyObjectAngle,
    applyGroup: "objectAngle",
    dom: { el: "objectAngleXSlider", valueEl: "objectAngleXValue" },
    label: "Rotation:",
    section: "object",
    cli: {
      flag: "objectAngleX",
      arg: "<deg>",
      help: "Object X rotation in degrees",
    },
  },
  {
    key: "objectAngleY",
    default: 0,
    kind: "number",
    min: 0,
    max: 360,
    step: 1,
    precision: 0,
    command: "setObjectAngle",
    apply: applyObjectAngle,
    applyGroup: "objectAngle",
    dom: { el: "objectAngleYSlider", valueEl: "objectAngleYValue" },
    section: "object",
    cli: {
      flag: "objectAngleY",
      arg: "<deg>",
      help: "Object Y rotation in degrees",
    },
  },
  {
    // The Z axis keeps the unsuffixed key - it is the one that predates the
    // other two, so old files and API callers still name it `objectAngle`.
    key: "objectAngle",
    default: 0,
    kind: "number",
    min: 0,
    max: 360,
    step: 1,
    precision: 0,
    command: "setObjectAngle",
    apply: applyObjectAngle,
    applyGroup: "objectAngle",
    dom: { el: "objectAngleSlider", valueEl: "objectAngleValue" },
    section: "object",
    cli: {
      flag: "objectAngle",
      arg: "<deg>",
      help: "Object Z rotation in degrees",
    },
  },
  {
    key: "objectOffsetX",
    default: 0,
    kind: "number",
    min: -50,
    max: 50,
    step: 1,
    precision: 0,
    command: "setObjectOffset",
    apply: applyObjectOffset,
    applyGroup: "objectOffset",
    dom: { el: "objectOffsetXSlider", valueEl: "objectOffsetXValue" },
    label: "Offset:",
    section: "object",
    cli: {
      flag: "objectOffsetX",
      arg: "<pct>",
      help: "Object X offset, % of the room",
    },
  },
  {
    key: "objectOffsetY",
    default: 0,
    kind: "number",
    min: -50,
    max: 50,
    step: 1,
    precision: 0,
    command: "setObjectOffset",
    apply: applyObjectOffset,
    applyGroup: "objectOffset",
    dom: { el: "objectOffsetYSlider", valueEl: "objectOffsetYValue" },
    section: "object",
    cli: {
      flag: "objectOffsetY",
      arg: "<pct>",
      help: "Object Y offset, % of the room (down is positive)",
    },
  },
  {
    key: "objectOffsetZ",
    default: 0,
    kind: "number",
    min: -50,
    max: 50,
    step: 1,
    precision: 0,
    command: "setObjectOffset",
    apply: applyObjectOffset,
    applyGroup: "objectOffset",
    dom: { el: "objectOffsetZSlider", valueEl: "objectOffsetZValue" },
    section: "object",
    cli: {
      flag: "objectOffsetZ",
      arg: "<pct>",
      help: "Object Z offset, % of the room (towards the viewer)",
    },
  },
  {
    key: "objectScale",
    default: 1,
    kind: "number",
    min: 0.1,
    max: 3,
    step: 0.05,
    command: "setObjectScale",
    apply: applyObjectScale,
    applyGroup: "objectScale",
    dom: { el: "objectScaleSlider", valueEl: "objectScaleValue" },
    label: "Scale:",
    section: "object",
    cli: {
      flag: "objectScale",
      arg: "<n>",
      help: "Object scale (X when unlinked)",
    },
  },
  {
    key: "objectScaleY",
    default: 1,
    kind: "number",
    min: 0.1,
    max: 3,
    step: 0.05,
    command: "setObjectScale",
    apply: applyObjectScale,
    applyGroup: "objectScale",
    dom: { el: "objectScaleYSlider", valueEl: "objectScaleYValue" },
    section: "object",
    cli: {
      flag: "objectScaleY",
      arg: "<n>",
      help: "Object Y scale (needs --no-object-scale-linked)",
    },
  },
  {
    key: "objectScaleZ",
    default: 1,
    kind: "number",
    min: 0.1,
    max: 3,
    step: 0.05,
    command: "setObjectScale",
    apply: applyObjectScale,
    applyGroup: "objectScale",
    dom: { el: "objectScaleZSlider", valueEl: "objectScaleZValue" },
    section: "object",
    cli: {
      flag: "objectScaleZ",
      arg: "<n>",
      help: "3D shape Z scale (needs --no-object-scale-linked)",
    },
  },
  {
    key: "objectScaleLinked",
    default: true,
    kind: "bool",
    command: "setObjectScale",
    apply: applyObjectScale,
    applyGroup: "objectScale",
    dom: { el: "objectScaleLinkedCheckbox" },
    section: "object",
    onUi: (bp, _linked, settings) => syncScaleAxisRows(settings),
    cli: {
      flag: "objectScaleLinked",
      help: "Scale the object's axes independently",
    },
  },
  {
    key: "roomScale",
    default: 1,
    kind: "number",
    min: 0.5,
    max: 3,
    step: 0.05,
    command: "setRoomScale",
    dom: { el: "roomScaleSlider", valueEl: "roomScaleValue" },
    label: "Room Scale:",
    section: "scene",
    cli: { flag: "roomScale", arg: "<n>", help: "Room scale" },
  },

  // Everything below reaches the runtime through the iframe URL, so changing it
  // reloads the preview rather than posting a command.
  {
    key: "samplingMode",
    default: "trilinear",
    kind: "enum",
    values: ["trilinear", "bilinear", "nearest"],
    reload: true,
    queryParam: "samplingMode",
    dom: { el: "samplingModeSelect" },
    label: "Sampling:",
    section: "technical",
    cli: {
      flag: "sampling",
      arg: "<m>",
      help: "trilinear | bilinear | nearest",
    },
  },
  {
    // Live, not a reload: the runtime re-parameterises textures that are
    // already uploaded, and a reload would throw away the user's loaded ones.
    key: "anisotropicFiltering",
    default: "auto",
    kind: "enum",
    values: ["auto", "off", "2x", "3x", "4x", "8x", "16x"],
    command: "setAnisotropicFiltering",
    dom: { el: "anisotropicFilteringSelect" },
    label: "Anisotropic:",
    section: "technical",
    cli: {
      flag: "anisotropic",
      arg: "<m>",
      help: "auto | off | 2x | 4x | 8x | 16x",
    },
  },
  {
    key: "shaderLanguage",
    default: "webgpu",
    kind: "enum",
    values: ["webgpu", "webgl2", "webgl1"],
    reload: true,
    queryParam: "shaderLanguage",
    dom: { el: "shaderLanguageSelect" },
    label: "Language:",
    section: "technical",
    cli: { flag: "language", arg: "<l>", help: "webgl1 | webgl2 | webgpu" },
  },
  {
    key: "forceRotatedTexture",
    default: false,
    kind: "bool",
    reload: true,
    queryParam: "forceRotatedTexture",
    dom: { el: "forceRotatedTextureCheckbox" },
    label: "Force Rotated Texture",
    section: "technical",
    cli: {
      flag: "forceRotatedTexture",
      help: "Pack the frame sideways, as C3 does when spritesheeting rotates it",
    },
  },

  {
    key: "startupScript",
    default: "",
    kind: "string",
    dom: { el: "previewStartupScript" },
    section: "script",
    // Not a previewCommand - it has its own message type.
    apply: (bp, target, value) => bp.sendStartupScript(value, target),
    cli: { flag: "startupScript", arg: "<s>", help: "Startup script source" },
  },
];

export const PREVIEW_SETTING_KEYS = new Set(PREVIEW_SETTINGS.map((d) => d.key));

export const PREVIEW_SETTINGS_BY_KEY = new Map(
  PREVIEW_SETTINGS.map((d) => [d.key, d]),
);

// Keyed by the short name the texture host helpers pass around ("sprite",
// "shape", "model", "bg"), so setTextureUrl / loadPreviewTexture / clearTexture
// look their descriptor up instead of each carrying its own if/else chain.
export const PREVIEW_TEXTURES_BY_TYPE = new Map(
  PREVIEW_SETTINGS.filter((d) => d.textureType).map((d) => [d.textureType, d]),
);

// Keys that used to exist, and what they became. `spriteScale` and `shapeScale`
// were merged into one `objectScale`; a file that carries both keeps the sprite
// one, since the sprite is the default object.
const LEGACY_PREVIEW_SETTINGS = [
  ["spriteScale", "objectScale"],
  ["shapeScale", "objectScale"],
];

// Fold a saved previewSettings blob onto the current key set. Unknown keys that
// are not legacy are passed through untouched, so a file written by a newer
// build survives a round-trip through an older one.
export function migratePreviewSettings(saved = {}) {
  const migrated = { ...saved };

  for (const [from, to] of LEGACY_PREVIEW_SETTINGS) {
    if (migrated[from] === undefined) continue;
    if (migrated[to] === undefined) migrated[to] = migrated[from];
    delete migrated[from];
  }

  return migrated;
}

export function makeDefaultPreviewSettings() {
  const settings = {};
  for (const d of PREVIEW_SETTINGS) settings[d.key] = d.default;
  return settings;
}

// Normalise a raw patch value to the stored representation.
export function coercePreviewSetting(d, raw) {
  switch (d.kind) {
    case "number":
      return Number(raw);
    case "bool":
      return !!raw;
    case "texture":
      return raw || null;
    case "string":
      return String(raw ?? "");
    default:
      return raw;
  }
}
