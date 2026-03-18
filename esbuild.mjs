import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");
const isMinify = process.argv.includes("--minify");

/** @type {import("esbuild").BuildOptions} */
const common = {
  bundle: true,
  minify: isMinify,
  sourcemap: !isMinify,
  jsx: "automatic",
  jsxImportSource: "preact",
  // Redirect React imports to preact/compat so shadcn/Radix components work
  alias: {
    "react": "preact/compat",
    "react-dom": "preact/compat",
    "react-dom/client": "preact/compat/client",
    "react/jsx-runtime": "preact/jsx-runtime",
    "react/jsx-dev-runtime": "preact/jsx-runtime",
  },
};

const entryPoints = [
  { in: "src/webviews/sidebar/index.tsx", out: "media/sidebar" },
  { in: "src/webviews/createAgent/index.tsx", out: "media/createAgent" },
];

if (isWatch) {
  const ctxs = await Promise.all(
    entryPoints.map(({ in: entry, out: outfile }) =>
      context({ ...common, entryPoints: [entry], outfile: outfile + ".js" })
    )
  );
  await Promise.all(ctxs.map((ctx) => ctx.watch()));
  console.log("[esbuild] Watching webviews…");
} else {
  await Promise.all(
    entryPoints.map(({ in: entry, out: outfile }) =>
      build({ ...common, entryPoints: [entry], outfile: outfile + ".js" })
    )
  );
  console.log("[esbuild] Webviews built.");
}
