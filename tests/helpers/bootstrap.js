// Thin alias over the shared headless boot module so the tests and the CLI
// stand the app up in exactly the same way. See headless/boot.js.
//
// Usage in a test file:
//   import { bootstrap } from "./helpers/bootstrap.js";
//   const { blueprint } = await bootstrap();

export { boot as bootstrap, ROOT } from "../../headless/boot.js";
