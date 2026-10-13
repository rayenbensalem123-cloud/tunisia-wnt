// Minimal ESM loader hook so plain `node` can resolve this repo's "@/..."
// TypeScript path alias (tsconfig.json: "@/*" -> "./*") the same way Next.js
// does at build time. Used only by our standalone test scripts.
import { pathToFileURL, fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function resolveExtensionless(absNoExt) {
  for (const ext of [".ts", ".tsx", ".mts", "/index.ts"]) {
    if (fs.existsSync(absNoExt + ext)) return absNoExt + ext
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = path.join(repoRoot, specifier.slice(2))
    const withExt = fs.existsSync(abs) ? abs : resolveExtensionless(abs)
    if (withExt) return nextResolve(pathToFileURL(withExt).href, context)
    return nextResolve(pathToFileURL(abs).href, context)
  }
  // Relative, extensionless TS imports (e.g. "../lib/bingo-logic"), the kind
  // bundlers (and bun) resolve but Node's own ESM resolver does not.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL && !/\.[a-zA-Z]+$/.test(specifier)) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    const abs = path.resolve(parentDir, specifier)
    const withExt = resolveExtensionless(abs)
    if (withExt) return nextResolve(pathToFileURL(withExt).href, context)
  }
  // Some packages (e.g. next's "next/server" subpath) ship CJS files with no
  // package.json "exports" map, which Node's ESM resolver won't extension-
  // complete for bare specifiers. Fall back to a plain ".js" guess.
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && !/\.[a-zA-Z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw err
  }
}
