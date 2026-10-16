import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { relative, resolve, sep } from "node:path"

import { loadWorkspaceSourceContext, resolveSourceEntries } from "./config.js"

import type { WorkspaceSourceContext } from "./config.js"
import type { WorkspaceSourceOptions, WorkspaceSourceSyncResult } from "./types.js"

/**
 * Write the generated paths only when their contents changed.
 * @param context - Resolved project registration and environment.
 * @example writeWorkspaceSourcePaths(context)
 */
export function writeWorkspaceSourcePaths(
  context: WorkspaceSourceContext
): WorkspaceSourceSyncResult {
  const paths: Record<string, string[]> = {}

  for (const [specifier, source] of Object.entries(resolveSourceEntries(context))) {
    const target = relative(context.projectRoot, source).split(sep).join("/")

    paths[specifier] = [target.startsWith(".") ? target : `./${target}`]
  }

  const filePath = resolve(context.projectRoot, "tsconfig.workspace-source.json")

  const content = `${JSON.stringify({ compilerOptions: { paths } }, null, 2)}\n`

  const changed = !existsSync(filePath) || readFileSync(filePath, "utf8") !== content

  if (changed) {
    writeFileSync(filePath, content)
  }

  return { projectRoot: context.projectRoot, filePath, enabled: context.enabled, changed }
}

/**
 * Synchronize a project's editor/type-check paths with VITE_USE_SOURCE.
 * @param options - Project directory and environment mode.
 * @example await syncWorkspaceSource({ projectRoot: process.cwd() })
 */
export async function syncWorkspaceSource(
  options: WorkspaceSourceOptions
): Promise<WorkspaceSourceSyncResult> {
  return writeWorkspaceSourcePaths(await loadWorkspaceSourceContext(options))
}
