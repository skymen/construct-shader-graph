// A host adapter over the test bootstrap, exposing the same interface
// cli/host/node.js does. This lets the CLI's command modules be exercised
// against the in-test BlueprintSystem instead of standing up a second jsdom
// and Vite server inside vitest.

import { bootstrap } from "./bootstrap.js";

export async function makeCliHost() {
  const booted = await bootstrap();

  return {
    kind: "test",
    api: booted.api,
    get blueprint() {
      return booted.blueprint;
    },
    NODE_TYPES: booted.NODE_TYPES,
    Wire: booted.Wire,
    async call(methodPath, args = []) {
      return booted.api.call(methodPath, args);
    },
    manifest() {
      return booted.api.getManifest();
    },
    zipBundle(bundle, type = "uint8array") {
      return booted.blueprint.zipAddonBundle(bundle, type);
    },
    async close() {},
  };
}
