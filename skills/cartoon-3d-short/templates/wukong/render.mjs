import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [out, range, conc = "2", scale = "1"] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "WukongShort", browserExecutable, chromiumOptions });
const [a, b] = range.split("-").map(Number);
let last = 0; const t0 = Date.now();
await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, outputLocation: out, frameRange: [a, b], concurrency: Number(conc), scale: Number(scale),
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames - last >= 30) { last = renderedFrames; console.log("frames", renderedFrames, ((Date.now() - t0) / 1000).toFixed(0) + "s"); } } });
console.log("done", ((Date.now() - t0) / 1000).toFixed(0) + "s");
process.exit(0);
