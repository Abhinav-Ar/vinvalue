import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const violations = [];

async function filesUnder(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat().filter((path) => sourceExtensions.has(extname(path)));
}

async function forbidImports(directory, forbiddenLayers) {
  for (const file of await filesUnder(directory)) {
    const source = await readFile(join(root, file), "utf8");
    for (const layer of forbiddenLayers) {
      if (source.includes(`@/${layer}/`)) violations.push(`${file} must not import the ${layer} layer`);
    }
  }
}

await forbidImports("models", ["app", "controllers", "views"]);
await forbidImports("controllers", ["app", "views"]);
await forbidImports("shared", ["app", "controllers", "models", "views"]);

for (const file of await filesUnder("app")) {
  if (!/(?:page\.(?:jsx?|tsx?)|route\.(?:js|ts))$/.test(file) || file === "app/layout.tsx") continue;
  const lines = (await readFile(join(root, file), "utf8")).trim().split("\n");
  if (lines.length > 3) violations.push(`${relative(root, join(root, file))} should remain a thin Next.js adapter`);
}

if (violations.length) {
  console.error(`MVC architecture violations:\n- ${violations.join("\n- ")}`);
  process.exit(1);
}

console.log("MVC architecture boundaries are valid.");
