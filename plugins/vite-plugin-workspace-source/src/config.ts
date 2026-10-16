import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports -- This independent plugin uses its Vite peer.
import { loadEnv } from "vite"

import type {
  WorkspaceSourceConfig,
  WorkspaceSourceOptions,
  WorkspaceSourcePackage,
  WorkspaceSourceProject,
} from "./types.js"

/**
 * Loaded workspace registration and its location.
 */
export interface WorkspaceSourceRegistration {
  readonly workspaceRoot: string
  readonly configPath: string
  readonly config: WorkspaceSourceConfig
}

/**
 * Resolved settings for one synchronization or Vite invocation.
 */
export interface WorkspaceSourceContext extends WorkspaceSourceRegistration {
  readonly projectRoot: string
  readonly project: WorkspaceSourceProject
  readonly enabled: boolean
}

/**
 * Dependency fields relevant to registered workspace packages.
 */
interface WorkspaceManifest {
  readonly name?: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

/**
 * Locate and load the nearest workspace registration without modifying it.
 * @param projectRoot - Directory from which to search upwards.
 * @example const registration = await loadWorkspaceRegistration(process.cwd())
 */
export async function loadWorkspaceRegistration(
  projectRoot: string
): Promise<WorkspaceSourceRegistration> {
  // A timestamp lets Vite reload registration changes without a permanent module cache.
  let directory = resolve(projectRoot)

  for (;;) {
    const configPath = resolve(directory, "workspace-source.config.ts")

    if (existsSync(configPath)) {
      const url = pathToFileURL(configPath)

      url.searchParams.set("mtime", String(statSync(configPath).mtimeMs))

      const loaded: { default: WorkspaceSourceConfig } = await import(url.href)

      return { workspaceRoot: directory, configPath, config: loaded.default }
    }

    const parent = dirname(directory)

    if (parent === directory) {
      throw new Error(`Cannot find workspace-source.config.ts from ${projectRoot}`)
    }

    directory = parent
  }
}

/**
 * Read one project's environment using the same rules as Vite.
 * @param options - Project directory and optional environment mode.
 * @example const context = await loadWorkspaceSourceContext({ projectRoot: process.cwd() })
 */
export async function loadWorkspaceSourceContext(
  options: WorkspaceSourceOptions
): Promise<WorkspaceSourceContext> {
  const projectRoot = resolve(options.projectRoot)

  const registration = await loadWorkspaceRegistration(projectRoot)

  const project = registration.config.projects.find(
    (item) => resolve(registration.workspaceRoot, item.root) === projectRoot
  )

  if (project === undefined) {
    throw new Error(`Workspace source project is not registered: ${projectRoot}`)
  }

  const env = loadEnv(options.mode ?? "development", projectRoot, "VITE_USE_SOURCE")

  return {
    ...registration,
    projectRoot,
    project,
    enabled: env.VITE_USE_SOURCE === "true",
  }
}

/**
 * Resolve only the project's registered dependency closure and its own package.
 * @param context - Loaded project, environment and workspace registration.
 * @example const entries = resolveSourceEntries(context)
 */
export function resolveSourceEntries(
  context: WorkspaceSourceContext
): Readonly<Record<string, string>> {
  const { config, projectRoot, workspaceRoot } = context

  const selected = new Set<string>()

  // Dependency versions need not use workspace:; examples can override published packages.
  const visit = (manifestRoot: string): void => {
    const manifest: WorkspaceManifest = JSON.parse(
      readFileSync(resolve(manifestRoot, "package.json"), "utf8")
    )

    for (const name of Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      const dependency = config.packages[name]

      if (dependency !== undefined && !selected.has(name)) {
        selected.add(name)
        visit(resolve(workspaceRoot, dependency.root))
      }
    }
  }

  // Self imports stay local; the switch controls dependencies rather than the current project.
  for (const [name, definition] of Object.entries(config.packages)) {
    if (resolve(workspaceRoot, definition.root) === projectRoot) {
      selected.add(name)
    }
  }

  if (context.enabled) {
    visit(projectRoot)
  }

  const entries: Record<string, string> = {
    "@": resolve(projectRoot, "src"),
    "@/*": resolve(projectRoot, "src/*"),
  }

  for (const name of selected) {
    const definition: WorkspaceSourcePackage = config.packages[name]

    for (const [key, entry] of Object.entries(definition.entries)) {
      const specifier = key === "." ? name : `${name}/${key.slice(2)}`

      entries[specifier] = resolve(workspaceRoot, definition.root, entry)
    }
  }

  return entries
}
