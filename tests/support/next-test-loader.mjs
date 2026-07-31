import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const extensions = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

function resolveCandidatePath(basePath) {
  return extensions
    .map((extension) => `${basePath}${extension}`)
    .find((candidate) => existsSync(candidate));
}

function resolveWorkspacePath(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  const workspacePath = path.resolve(process.cwd(), specifier.slice(2));
  const match = resolveCandidatePath(workspacePath);

  return match ? pathToFileURL(match).href : null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.resolve(process.cwd(), "tests/support/empty-server-only.mjs")).href,
    };
  }

  if (specifier.startsWith("next/")) {
    const nextPath = path.resolve(process.cwd(), "node_modules", `${specifier}.js`);

    if (existsSync(nextPath)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(nextPath).href,
      };
    }
  }

  const workspaceUrl = resolveWorkspacePath(specifier);

  if (workspaceUrl) {
    return {
      shortCircuit: true,
      url: workspaceUrl,
    };
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const parentPath = context.parentURL ? new URL(".", context.parentURL).pathname : process.cwd();
    const localPath = specifier.startsWith("/")
      ? specifier
      : path.resolve(parentPath, specifier);
    const match = resolveCandidatePath(localPath);

    if (match) {
      return {
        shortCircuit: true,
        url: pathToFileURL(match).href,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
