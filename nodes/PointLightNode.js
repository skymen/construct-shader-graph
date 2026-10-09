import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

// One point light on a surface: Lambert diffuse and Blinn-Phong specular with a
// smooth falloff to zero at Range. The viewer looks straight down -z (an
// orthographic 2D screen), so the specular half vector uses (0, 0, 1).
// Position, Normal and Light Pos just need to share one space; Depth Map Surface
// gives layout space. Distances there run to thousands of pixels, hence highp.
const glsl = `void pointLight_calc(highmedp vec3 p, highmedp vec3 n, highmedp vec3 lp, vec3 color,
                     highmedp float intensity, highmedp float range, highmedp float shininess,
                     out vec3 diffuse, out vec3 specular) {
    highmedp vec3 l = lp - p;
    highmedp float dist = length(l);
    l /= max(dist, 0.0001);
    highmedp float ndl = max(dot(n, l), 0.0);
    highmedp float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), shininess) * step(0.0001, ndl);
    highmedp float att = clamp(1.0 - dist / max(range, 0.0001), 0.0, 1.0);
    att *= att;
    diffuse = color * (intensity * ndl * att);
    specular = color * (intensity * spec * att);
}`;

const glslExec = (inputs, outputs) => `    vec3 ${outputs[0]};
    vec3 ${outputs[1]};
    pointLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]}, ${inputs[5]}, ${inputs[6]}, ${outputs[0]}, ${outputs[1]});`;

export const PointLightNode = new NodeType(
  "Point Light",
  [
    { name: "Position", type: "vec3" },
    { name: "Normal", type: "vec3", defaultValue: [0, 0, 1] },
    { name: "Light Pos", type: "vec3", defaultValue: [0, 0, 200] },
    { name: "Light Color", type: "vec3", defaultValue: [1, 1, 1] },
    { name: "Intensity", type: "float", defaultValue: 1 },
    { name: "Range", type: "float", defaultValue: 500 },
    { name: "Shininess", type: "float", defaultValue: 32 },
  ],
  [
    { name: "Diffuse", type: "vec3" },
    { name: "Specular", type: "vec3" },
  ],
  NODE_COLORS.colorVec3,
  {
    webgl1: { dependency: glsl, execution: glslExec },
    webgl2: { dependency: glsl, execution: glslExec },
    webgpu: {
      dependency: `struct PointLight {
    diffuse: vec3<f32>,
    specular: vec3<f32>,
}

fn pointLight_calc(p: vec3<f32>, n: vec3<f32>, lp: vec3<f32>, color: vec3<f32>, intensity: f32, range: f32, shininess: f32) -> PointLight {
    var l = lp - p;
    let dist = length(l);
    l = l / max(dist, 0.0001);
    let ndl = max(dot(n, l), 0.0);
    let spec = pow(max(dot(n, normalize(l + vec3<f32>(0.0, 0.0, 1.0))), 0.0), shininess) * step(0.0001, ndl);
    var att = clamp(1.0 - dist / max(range, 0.0001), 0.0, 1.0);
    att = att * att;
    var res: PointLight;
    res.diffuse = color * (intensity * ndl * att);
    res.specular = color * (intensity * spec * att);
    return res;
}`,
      execution: (inputs, outputs) => `    let ${outputs[0]}_light = pointLight_calc(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]}, ${inputs[4]}, ${inputs[5]}, ${inputs[6]});
    var ${outputs[0]}: vec3<f32> = ${outputs[0]}_light.diffuse;
    var ${outputs[1]}: vec3<f32> = ${outputs[0]}_light.specular;`,
    },
  },
  "Lighting",
  ["light", "point", "lamp", "bulb", "diffuse", "specular", "blinn", "phong", "falloff", "range", "attenuation"]
);

PointLightNode.manual = {
  description:
    "Lights a surface with one point light: diffuse (N.L) and Blinn-Phong specular, fading smoothly to nothing at Range. Add several together for several lights.",
  html: `
    <div class="tip">
      <strong>Spaces:</strong> Position, Normal and Light Pos must share one space. With Depth Map Surface that is layout space, so a light's layout X/Y and a height above the back plane go straight into Light Pos.
    </div>
    <div class="tip">
      <strong>Usage:</strong> multiply the summed Diffuse with the art (plus some ambient), then add Specular on top.
    </div>
  `,
};
