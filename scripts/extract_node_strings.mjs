import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NODE_TYPES } from "../nodes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, "../lang/en-US.json");

const result = {
  nodes: {},
  inputOutputs: {},
  outputs: {},
  categories: {},
  tags: {},
};

// Helper to add unique key-value
const add = (category, key) => {
  if (!key) return;
  // User wants "Value": "Value"
  result[category][key] = key;
};

// Helper to process a node instance
const processNode = (node) => {
  if (!node) return;

  // Name
  if (node.name) {
    add("nodes", node.name);
  }

  // Inputs
  if (node.inputs && Array.isArray(node.inputs)) {
    node.inputs.forEach((input) => add("inputOutputs", input.name));
  }

  // Outputs
  if (node.outputs && Array.isArray(node.outputs)) {
    node.outputs.forEach((output) => add("inputOutputs", output.name));
  }

  // Category
  if (node.category) {
    add("categories", node.category);
  }

  // Tags
  if (node.tags && Array.isArray(node.tags)) {
    node.tags.forEach((tag) => add("tags", tag));
  }
};

console.log("Processing nodes...");

for (const nodeKey in NODE_TYPES) {
  try {
    const node = NODE_TYPES[nodeKey];
    processNode(node);
  } catch (e) {
    console.error(`Error processing node ${nodeKey}:`, e);
  }
}

// Sort keys for consistent output
const sortedResult = {};
for (const cat in result) {
  sortedResult[cat] = {};
  Object.keys(result[cat])
    .sort()
    .forEach((key) => {
      sortedResult[cat][key] = result[cat][key];
    });
}

fs.writeFileSync(outputFile, JSON.stringify(sortedResult, null, 4));
console.log(`Generated ${outputFile}`);
