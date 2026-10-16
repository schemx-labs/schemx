#!/usr/bin/env node
import { resolve } from "node:path"

import { loadWorkspaceRegistration } from "./config.js"
import { syncWorkspaceSource } from "./sync.js"

/**
 * Synchronize a single project or all registered projects without starting Vite.
 * @param args - CLI arguments after the executable name.
 */
async function main(args: readonly string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("workspace-source sync [--project <directory> | --all] [--mode <mode>]")

    return
  }

  if (args[0] !== "sync") {
    throw new Error("Expected command: workspace-source sync")
  }

  let projectRoot = process.cwd()

  let mode = "development"

  let all = false

  let projectSpecified = false

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === "--all") {
      all = true
    } else if (argument === "--project" || argument === "--mode") {
      const value = args[index + 1]

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for ${argument}`)
      }

      if (argument === "--project") {
        projectRoot = resolve(value)
        projectSpecified = true
      } else {
        mode = value
      }

      index += 1
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (all && projectSpecified) {
    throw new Error("Use either --all or --project")
  }

  let projects = [projectRoot]

  if (all) {
    const registration = await loadWorkspaceRegistration(projectRoot)

    projects = registration.config.projects.map((project) =>
      resolve(registration.workspaceRoot, project.root)
    )
  }

  for (const root of projects) {
    const result = await syncWorkspaceSource({ projectRoot: root, mode })

    console.log(
      `${result.changed ? "Updated" : "Unchanged"} ${result.filePath} (${result.enabled ? "source" : "artifacts"})`
    )
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
