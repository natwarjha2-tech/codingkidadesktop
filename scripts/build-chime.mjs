// Build the vendored Chime SDK browser bundle → src/renderer/lib/chime-sdk.min.js
//
// Chime SDK pulls in the AWS SDK, whose node-http-handler references node core
// modules (node:https, node:http2, node:stream, node:child_process, …). In a
// BROWSER build those code paths are never taken (the SDK uses fetch + WebRTC),
// but esbuild still tries to resolve the imports. We neutralize them with a
// tiny plugin that maps every `node:*` import to an empty module. The result is
// a self-contained IIFE exposing `window.ChimeSDK`, loaded via a plain <script>
// in the vanilla-JS renderer (exactly like hls.min.js / pdf.min.js).

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Plugin: resolve any `node:*` builtin to an empty stub so the browser bundle
// doesn't fail. Safe because these are node-only transport fallbacks unused in
// the browser (Chime uses fetch/XHR + WebRTC).
const stubNodeBuiltins = {
  name: "stub-node-builtins",
  setup(b) {
    b.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, namespace: "node-stub" }));
    b.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({ contents: "export default {};", loader: "js" }));
  },
};

build({
  entryPoints: [path.join(root, "scripts", "chime-entry.js")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "ChimeSDK",
  platform: "browser",
  target: "chrome120",
  outfile: path.join(root, "src", "renderer", "lib", "chime-sdk.min.js"),
  plugins: [stubNodeBuiltins],
  logLevel: "info",
})
  .then(() => console.log("Chime bundle built OK"))
  .catch((e) => {
    console.error("Chime bundle FAILED:", e.message);
    process.exit(1);
  });
