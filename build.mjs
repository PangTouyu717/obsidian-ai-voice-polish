import esbuild from "esbuild";
import builtinModules from "builtin-modules";

const prod = process.argv[2] === "build";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outdir: ".",
  outbase: "src",
});

if (prod) {
  await context.rebuild();
  console.log("✅ Build complete: main.js");
  process.exit(0);
} else {
  console.log("👀 Watching for changes...");
  await context.watch();
}
