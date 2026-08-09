// The three code generation targets, described once.
//
// This list used to be spelled out as a literal in seven places - the codegen
// loop, the View Code modal, the addon bundle, the CLI, the scripting API - and
// each copy also implied a filename and an addon.json renderer name that lived
// somewhere else again. A project can now switch a target off (issue #76), so
// every one of those places has to ask which targets are on rather than assume
// three, and that question needs a single place to live.
//
// Order is load-bearing: it is the order shaders are generated, written into the
// .c3addon, and shown in the language tabs.

export const SHADER_TARGETS = ["webgl1", "webgl2", "webgpu"];

// The shaderSettings key that switches each target on. Flat booleans rather than
// a nested object on purpose: shaderSettings is shallow-copied both into and out
// of history snapshots, so a nested object would be shared by every snapshot.
export const TARGET_SETTING_KEYS = {
  webgl1: "targetWebgl1",
  webgl2: "targetWebgl2",
  webgpu: "targetWebgpu",
};

// What each target is called in addon.json's "supported-renderers".
export const TARGET_RENDERERS = {
  webgl1: "webgl",
  webgl2: "webgl2",
  webgpu: "webgpu",
};

// The file each target is written to inside the .c3addon.
export const TARGET_FILENAMES = {
  webgl1: "effect.fx",
  webgl2: "effect.webgl2.fx",
  webgpu: "effect.wgsl",
};

// Display names, for tabs and error messages.
export const TARGET_LABELS = {
  webgl1: "WebGL 1",
  webgl2: "WebGL 2",
  webgpu: "WebGPU",
};

// Which targets a project generates. A target counts as enabled unless its
// setting is explicitly false, so projects saved before this setting existed -
// and any caller passing a bare object - get all three.
//
// Never returns empty. The UI refuses to switch off the last target, but a
// hand-edited .c3sg can still ask for it, and a project that generates nothing
// is less useful than one that ignores the request.
export function enabledTargetsFor(shaderSettings = {}) {
  const enabled = SHADER_TARGETS.filter(
    (target) => shaderSettings[TARGET_SETTING_KEYS[target]] !== false,
  );
  return enabled.length ? enabled : [...SHADER_TARGETS];
}
