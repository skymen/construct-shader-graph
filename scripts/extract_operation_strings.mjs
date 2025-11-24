import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NODE_TYPES } from "../nodes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, "../lang/operations.json");

const operations = {};

// Helper to add unique operation label
const addOperation = (label) => {
  if (!label) return;
  // Store as "label": "label" for easy translation
  operations[label] = label;
};

console.log("Processing nodes with operations...");

for (const nodeKey in NODE_TYPES) {
  try {
    const node = NODE_TYPES[nodeKey];

    // Check if node has operations
    if (
      node.hasOperation &&
      node.operationOptions &&
      Array.isArray(node.operationOptions)
    ) {
      node.operationOptions.forEach((op) => {
        if (op.label) {
          addOperation(op.label);
        }
      });
    }
  } catch (e) {
    console.error(`Error processing node ${nodeKey}:`, e);
  }
}

// Sort keys for consistent output
const sortedOperations = {};
Object.keys(operations)
  .sort()
  .forEach((key) => {
    sortedOperations[key] = operations[key];
  });

fs.writeFileSync(outputFile, JSON.stringify(sortedOperations, null, 2));
console.log(
  `Generated ${outputFile} with ${
    Object.keys(sortedOperations).length
  } operations`
);
