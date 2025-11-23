// Node type definition class
export class NodeType {
  constructor(
    name,
    inputs,
    outputs,
    color = "#3a3a3a",
    shaderCode = {},
    category = "Misc",
    tags = [],
    noTranslation = false
  ) {
    this.name = name;
    this.inputs = inputs; // Array of {name, type}
    this.outputs = outputs; // Array of {name, type}
    this.color = color;
    this.category = category; // Category for grouping in search
    this.tags = tags; // Additional search tags
    this.noTranslation = noTranslation; // Disable translation for port names

    // Shader code for different targets
    // Each target has { dependency: string, execution: function }
    this.shaderCode = {
      webgl1: shaderCode.webgl1 || { dependency: "", execution: null },
      webgl2: shaderCode.webgl2 || { dependency: "", execution: null },
      webgpu: shaderCode.webgpu || { dependency: "", execution: null },
    };
  }

  // Helper methods to get code for specific targets
  getDependency(target = "webgl2") {
    return this.shaderCode[target]?.dependency || "";
  }

  getExecution(target = "webgl2") {
    return this.shaderCode[target]?.execution || null;
  }
}
