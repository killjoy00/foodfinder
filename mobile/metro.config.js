// The phone app reuses the web app's pure decision logic (../lib) directly,
// so Metro needs to watch the repo root as well as this workspace.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
// expo export trims watchFolders to the project root when the on-demand
// filesystem is active, which breaks the ../lib imports — keep it off
config.resolver.unstable_onDemandFilesystem = false;
// prefer the app's own dependency tree over the Next.js app's; the shared
// ../lib modules are pure TypeScript with no npm imports, so nothing else
// from the web app's node_modules can leak in
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

// @shared/* → ../lib/* (mirrors the tsconfig paths entry, which Metro
// can't apply on its own for folders outside the project root)
const fs = require("fs");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@shared/")) {
    const base = path.join(repoRoot, "lib", moduleName.slice("@shared/".length));
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (fs.existsSync(base + ext)) return { filePath: base + ext, type: "sourceFile" };
    }
    throw new Error(`@shared alias: no file for ${moduleName} under ${repoRoot}/lib`);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
