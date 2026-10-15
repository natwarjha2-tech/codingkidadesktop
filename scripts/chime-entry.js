// Build entry for the vendored Chime SDK browser bundle.
// esbuild bundles this into src/renderer/lib/chime-sdk.min.js as a global
// `ChimeSDK` (IIFE), so the vanilla-JS renderer can use window.ChimeSDK.* via a
// plain <script> tag (no bundler at runtime), exactly like hls.min.js.
export * from "amazon-chime-sdk-js";
