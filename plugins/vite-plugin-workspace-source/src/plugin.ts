import { loadWorkspaceSourceContext, resolveSourceEntries } from "./config.js"
import { writeWorkspaceSourcePaths } from "./sync.js"

import type { WorkspaceSourceOptions } from "./types.js"
import type { Alias, ConfigEnv, Plugin, ResolvedConfig, UserConfig } from "vite"

/**
 * Share workspace source mappings with Vite while keeping library builds external.
 * @param options - Project directory; Vite supplies the active mode.
 * @example plugins: [workspaceSource({ projectRoot: import.meta.dirname })]
 */
export function workspaceSource(options: WorkspaceSourceOptions): Plugin {
  // Vite watches registered configuration dependencies and environment files on reload.
  let workspaceConfigPath: string | undefined

  /**
   * Resolve aliases and synchronize editor paths during development only.
   * @param userConfig - Current Vite configuration.
   * @param env - Vite command and active mode.
   */
  const config = async (
    userConfig: UserConfig,
    env: ConfigEnv
  ): Promise<UserConfig | undefined> => {
    const context = await loadWorkspaceSourceContext({
      projectRoot: options.projectRoot,
      mode: env.mode,
    })

    workspaceConfigPath = context.configPath

    if (env.command === "build" && context.project.kind === "library") {
      return undefined
    }

    if (env.command === "serve") {
      writeWorkspaceSourcePaths(context)
    }

    const alias: Alias[] = Object.entries(resolveSourceEntries(context))
      .sort(([left], [right]) => {
        return (
          Number(left.includes("*")) - Number(right.includes("*")) ||
          right.length - left.length
        )
      })
      .map(([specifier, source]) => {
        const pattern = specifier
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("(.*)")

        return {
          find: new RegExp(`^${pattern}$`),
          replacement: source.replace("*", "$1"),
        }
      })

    return { envDir: userConfig.envDir ?? context.projectRoot, resolve: { alias } }
  }

  /**
   * Include the shared registration in Vite's normal configuration restart mechanism.
   * @param resolved - Vite's resolved configuration and watched dependencies.
   */
  const configResolved = (resolved: ResolvedConfig): void => {
    if (
      workspaceConfigPath !== undefined &&
      !resolved.configFileDependencies.includes(workspaceConfigPath)
    ) {
      resolved.configFileDependencies.push(workspaceConfigPath)
    }
  }

  return { name: "workspace-source", config, configResolved }
}
